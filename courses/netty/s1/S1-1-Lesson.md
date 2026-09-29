# 五种 IO 模型与同步/异步、阻塞/非阻塞

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：两类三时点坐标系分清阻塞与非阻塞、同步与异步；BIO 线程模型的成本、IO 多路复用的出现、select/poll/epoll 三者差异与 ET/LT、AIO 在 Linux 上的局限。

> 这是理解 Netty / Redis / Nginx 的一切前提。绝大多数人把"阻塞/非阻塞"和"同步/异步"混为一谈，本节先把这两个维度**钉死**，再用"两个系统调用 + 三个时点"的坐标系把五种模型一次性讲清，并解释 select/poll/epoll 到底差在哪、AIO 为什么在 Linux 上水土不服。（重要度 4/5，重点标准；铺垫 s1-2/s1-3/s2-1）

## 一、先立坐标系：两个维度千万别混

一次网络读（`recvfrom`）在内核里分**两个阶段**：
1. **等待数据就绪**（wait-to-be-ready / WBR）：数据还没从网卡到内核缓冲，等它到。
2. **把数据从内核拷到用户空间**（copy-in / copy）。

两个正交维度：

| 维度 | 作用阶段 | 判据 |
|---|---|---|
| **阻塞 / 非阻塞** | 主要看**阶段 1（等待数据）** | 调用了要不要原地等？等=阻塞；立刻返回、自己轮询=非阻塞 |
| **同步 / 异步** | 看**阶段 2（数据拷贝）+ 结果通知** | 拷贝由**调用者自己/被阻塞等它完成**=同步；拷贝由**内核完成后回调通知你**=异步 |

- **阻塞 vs 非阻塞**：函数没拿到结果就返回（非阻塞）还是挂起线程直到有结果（阻塞）。
- **同步 vs 异步**：核心 IO 操作（尤其数据拷贝）**谁来做、做完怎么告诉你**。同步=你得自己参与/等着；异步=全交给内核，办完通知你（回调/信号）。

> 一句话记住：**"阻塞与否"问的是等数据时要不要傻等；"同步与否"问的是数据从内核拷到用户这段活谁干、干完通知你还是你盯着。** 前面五种模型里，只有**信号驱动**和**异步 IO** 是真正的分水岭。

## 二、五种 IO 模型

```
                       阶段1(等数据)          阶段2(拷数据)
1 阻塞 BIO        内核等待, 线程阻塞    线程阻塞直到拷完      ← 同步阻塞
2 非阻塞 NIO      立即返回, 用户轮询    线程阻塞直到拷完      ← 同步非阻塞
3 IO多路复用      select/epoll 阻塞在   线程阻塞直到拷完      ← 同步非阻塞
                  "多个fd的等待"
4 信号驱动        立即返回, 就绪发SIGIO  在handler里recvfrom  ← 同步非阻塞(数据拷贝仍自己做)
5 异步IO AIO      立即返回              内核拷完再通知你      ← 真·异步
```

### 1. 阻塞 IO（BIO）
`read()` 直接挂起线程，直到数据到达且拷贝完成。一个连接一个线程 → 并发 = 线程数，**C10K 直接被线程栈内存 + 上下文切换打死**。传统 Tomcat AJP/老式 BIO 即此。

### 2. 非阻塞 IO
`read()` 若内核还没数据，立即返回 `EWOULDBLOCK`/`0`，用户**轮询**再试。省了"傻等"，但**轮询本身烧 CPU**，且阶段 2 拷贝仍阻塞。单独用没意义，必配多路复用。

### 3. IO 多路复用（multiplexing）★ 后端主战场
用**一个线程**通过 `select/poll/epoll` 同时"盯"成万个 fd，哪个就绪就处理哪个 —— 这就是 **Reactor 的地基**（s1-2）。本质仍是"同步非阻塞"：等待由内核多路复用完成（不占用户线程轮询），但**数据拷贝还得用户线程调 `read` 自己做**。

### 4. 信号驱动 IO（SIGIO）
`sigaction` 注册 handler + fd 设 `O_ASYNC`，内核数据就绪时发 `SIGIO` 信号，handler 里再 `recvfrom` 拷贝。**阶段 1 异步了，但阶段 2 拷贝仍自己做** → 归为同步。实际用得少（信号处理麻烦、高频信号丢）。

### 5. 异步 IO（AIO / POSIX aio / Linux io_uring）★ 真异步
`aio_read` 提交后**立即返回**，内核把"等数据 + 拷数据"**全干完**，再通过回调/信号通知你 → 阶段 1、2 都异步 = **Proactor 模式**的地基。

## 三、select / poll / 三个死穴，epoll 怎么破

| 维度 | select | poll | epoll |
|---|---|---|---|
| fd 上限 | `FD_SETSIZE` 常 1024 | 无（链表） | 无（独立内核对象） |
| 数据结构 | 3 个 `fd_set` 位图 | `pollfd` 数组 | 红黑树(注册集) + 就绪链表 |
| 每次调用 | **全量拷贝** fd 集到内核 + **O(n) 遍历** | 同样全量拷贝 + O(n) | **注册与控制分离**：`epoll_ctl` 注册一次，`epoll_wait` 只拿**就绪列表** |
| 复杂度 | 每调用 O(n) | O(n) | `epoll_ctl` O(1)、`epoll_wait` O(就绪数) |
| 水平/边沿 | 仅 LT | 仅 LT | **LT + ET** |

- **select 三大痛**：fd 上限、每次用户/内核全量拷贝、线性扫描。
- **epoll 三大改进**：① `epoll_create` 建内核事件表，fd 用 `epoll_ctl(ADD/MOD/DEL)` **注册一次**，不用每次带上；② 数据就绪由**回调**把 fd 挂到**就绪链表**，`epoll_wait` 只返回**就绪的那些** → 1 万连接只有 100 活跃时，成本 O(100) 而非 O(10000)；③ 支持 **ET 边沿触发**。

### LT vs ET（水平 / 边沿，面试高频）
- **LT（level-triggered，默认）**：只要 fd 还有数据没读完，`epoll_wait` **每次都会再通知** → 编程简单、可慢读，Netty 默认 LT。
- **ET（edge-triggered）**：只在状态**变化那一刻**通知一次 → 必须**一次性循环读到 `EWOULDBLOCK`**（否则漏数据），效率更高（减少 `epoll_wait` 唤醒）但易写错。Nginx 用 ET。

## 四、AIO 为什么在 Linux 上"雷声大雨点小"

- JDK 的 `AsynchronousChannel`（`AsynchronousSocketChannel`）在 **Windows 用 IOCP（真异步）**，但在 **Linux 上底层其实是自己用 epoll + 线程池模拟**，并非内核真异步 → 收益有限、还多一层线程切换。
- 传统 **POSIX/Linux AIO（`io_submit`）对**普通磁盘文件**较成熟，对**网络 socket** 支持很差**（很多操作退化为阻塞），所以 Netty 官方长期**主推 epoll transport（NIO 多路复用）而非 AIO**，Netty 的 `AioSocketChannel` 后来被标记废弃。
- **新变量 io_uring**（Linux 5.1+）：真正统一的异步 SQ/CQ ring 接口，网络 + 磁盘都异步，Netty 已有 `io_uring` transport。**但生产主流仍是 epoll**（成熟、生态稳），io_uring 属"值得关注、逐步落地"。

> 结论：**高并发网络后端的事实标准 = IO 多路复用（epoll）+ Reactor**，不是 AIO。别被"异步听起来更快"误导 —— Linux 网络 AIO 名不副实。

## 五、Java 里的映射（把模型落到 API）

| 模型 | Java API |
|---|---|
| BIO | `java.io`：`ServerSocket.accept()`、`InputStream.read()` 阻塞 |
| NIO 多路复用 | `java.nio`：`Selector.select()` + `SocketChannel`（s1-3） |
| AIO | `java.nio.channels.AsynchronousSocketChannel`（Linux 下模拟） |

- Netty 走的是**中间那条：NIO/epoll 多路复用 + Reactor 线程模型**（s1-2、s2-1），并在 Linux 上直接用 **native epoll transport**（s4-1 那些内核选项也是在这条路上才能设）。

## 六、例子：BIO 阻塞读 vs NIO 多路复用非阻塞读（正确用法与错误用法）

```java
// 例子目的：把"阻塞/非阻塞、单线程盯一个 fd vs 一个线程盯多个 fd"落成可运行代码对比
import java.io.*; import java.net.*; import java.nio.*; import java.nio.channels.*;
class IoModelDemo {
    // 【BIO】accept()/read() 都会挂起当前线程直到就绪 —— 同步阻塞
    static void bio() throws IOException {
        ServerSocket ss = new ServerSocket(8080);
        Socket s = ss.accept();          // 阻塞：无新连接时线程挂在这里
        byte[] buf = new byte[1024];
        int n = s.getInputStream().read(buf); // 阻塞：对端未发数据时挂起（阶段1+阶段2 都阻塞）
        // 错误用法：为每个连接新建一个线程 → 10 万连接=10 万线程，光栈内存几十 GB、上下文切换打爆 CPU（C10K 根因）
    }

    // 【NIO 多路复用】一个 Selector 盯多个 Channel，只处理就绪的 —— 同步非阻塞
    static void nio() throws IOException {
        Selector sel = Selector.open();
        ServerSocketChannel ssc = ServerSocketChannel.open();
        ssc.configureBlocking(false);        // 正确用法：注册到 Selector 前必须非阻塞，否则…
        ssc.register(sel, SelectionKey.OP_ACCEPT); // 只关心"连接到达"事件
        // 错误用法：ssc 保持阻塞态就 register → 抛 IllegalStateException("Non-blocking mode not set")
        while (true) {
            sel.select();                    // 阻塞点在内核多路复用（不占用户线程轮询），返回就绪个数
            for (SelectionKey k : sel.selectedKeys()) { // 只遍历"就绪的那几个"→ O(活跃)而非 O(总连接)
                k.attach(null);              // 处理后就绪集已消费
            }
            sel.selectedKeys().clear();      // 正确用法：手动清空已处理 key，否则下轮重复处理
            // 错误用法：不 clear() → 上轮的 key 仍在 selectedKeys 里，重复处理/逻辑错乱
        }
    }
}
// 正确使用结果：nio() 用1 根线程就能盯成万个连接，成本随"活跃连接数"而非"总连接数"增长
// 这就是下一节 Reactor 与 Netty 的地基；数据拷贝仍靠用户线程 read → 属"同步非阻塞"
```

## 七、三大行业场景钩子

- **电商**：营销网关扛 C10K+ 长连接，若还在 BIO"一连接一线程"，10 万连接 = 10 万线程 → 光栈内存就几十 GB、切换打爆 CPU；换 Netty(Reactor+epoll) 后**几根 IO 线程**扛住连接，业务线程池只做计算。
- **金融**：行情推送服务器海量订阅连接，用 epoll LT + 连接数限流；对**磁盘**（流水落盘）可用 AIO/io_uring 真异步，对**网络**仍走 epoll —— 理解"两类 IO 成熟度不同"才不会用错。
- **电力**：主站百万终端 TCP 长连接，select 的 1024 上限直接不够用且 O(n) 扫描拖垮 → 必须 epoll；ET 虽省 CPU 但嵌入式固件团队易写漏数据，务实选 LT。

## 八、要点回顾

1. 两维度分清：**阻塞/非阻塞看阶段 1（等数据要不要傻等）**；**同步/异步看阶段 2（拷贝谁做、完成是否回调通知）**。
2. 五模型：BIO(同步阻塞) / 非阻塞 / **多路复用(同步非阻塞，后端主流)** / 信号驱动(仍同步) / **AIO(真异步)**。
3. **select 三痛**（上限/全量拷贝/O(n)），**epoll 三改**（事件表注册一次、只返回就绪集、LT+ET），成本从 O(总连接) 降到 O(活跃连接)。
4. **LT 每次都通知（好写）、ET 只通知一次（要读到空）**；Netty=LT、Nginx=ET。
5. **Linux 网络 AIO 名不副实**（JDK 用 epoll 模拟、socket AIO 差）→ Netty 主推 epoll；磁盘 AIO/io_uring 才是真异步的主场。
6. 事实标准：**多路复用(epoll) + Reactor**，别迷信"异步一定更快"。
