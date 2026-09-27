# Reactor 模式：从单线程到主从多 Reactor · 小测验

### 1. Reactor 与 Proactor 的根本分界在于（15分）

- A. 用不用多路复用
- B. 数据从内核拷到用户这一步：Reactor 由 Handler 自己同步读，Proactor 由底层拷完再回调
- C. 有没有 Acceptor
- D. 用几个线程

> 答案：B
> 解析：Reactor 只通知"fd 就绪了你来读"，read/write（含内核→用户拷贝）由处理器同步完成，配同步非阻塞；Proactor 是底层（AIO）把数据拷完再通知，配真异步。

### 2. Netty 采用的 Reactor 形态是（15分）

- A. 单 Reactor 单线程（全部串行）
- B. 单 Reactor 多线程（一个 Reactor 管所有 accept+读写）
- C. 主从多 Reactor（boss 只管 accept，多个 worker 各扛一批连接读写）
- D. Proactor（AIO）

> 答案：C
> 解析：Netty ServerBootstrap 用 boss group 专做 accept，worker group（默认 2×核数、每个是独立线程+独立 epoll）分摊读写，既消除 accept 单点又用满多核。

### 3.【多选】关于"一个 Channel 终身绑定一个 EventLoop"，下列说法正确的有（20分）

- A. 同一 Channel 的事件在该线程串行执行，改其共享状态天然线程安全、无需加锁
- B. 它保证了单连接读/写/编解码的处理顺序，避免字节流状态机乱序
- C. 可以让一个慢业务 Handler 只影响它自己那一个连接，波及其它连接
- D. 并行粒度是 EventLoop 数量而非连接数量，想提并行度应调 worker 线程数

> 答案：ABD
> 解析：C 说反了。正因为同一 EventLoop 承载多个 Channel，一个慢/阻塞 Handler 会连累该线程上**所有**其它连接 —— 所以 IO 线程绝不碰重活。A、B、D 都是单线程绑定的收益与正确推论。

### 4. "在 Handler 里同步查数据库/调下游 RPC"会带来什么后果（10分）

- A. 只是这一个请求变慢，无整体影响
- B. 阻塞该 EventLoop 线程，拖垮同线程上所有其它连接的读写
- C. 自动切换到业务线程池执行
- D. 触发 GC

> 答案：B
> 解析：Reactor 铁律"IO 线程绝不阻塞"。Handler 跑在 EventLoop 上，同步阻塞会把整条 EventLoop 卡住，一批连接全部停摆；重活必须投递到业务线程池。

### 5. Redis 的命令处理模型最接近哪一代 Reactor（10分）

- A. 主从多 Reactor
- B. Proactor
- C. 单 Reactor 单线程（多路复用 + 命令执行串行）
- D. 无 Reactor，纯 BIO 线程池

> 答案：C
> 解析：Redis 用多路复用单线程串行执行命令，靠"内存操作够快"避免阻塞，正是单 Reactor 单线程；6.0 的多 IO thread 只并行化 read/write syscall，命令执行仍单线程。

### 6. 简答：把"单 Reactor 单线程 → 单 Reactor 多线程 → 主从多 Reactor"三代演进动机讲清楚，并说明主从模型分别解决了前两代的什么问题。（30分）

> 参考答案：
> - 要点：单线程版 accept+read+业务+write 全挤一个线程，最好写、无锁，但**一旦业务耗时全服务器卡住、无法用多核做计算**（Redis 因业务是内存操作才适用）。
> - 要点：为解"业务阻塞拖垮 IO"，第二版把**解码后的业务**丢进 Worker 线程池，Reactor 只做读+解码 → 但 accept 和所有连接的读写**仍挤在单个 Reactor 线程**，高并发下它本身成瓶颈（accept 单点、一个线程搬全部 fd）。
> - 要点：主从版再拆一层——**boss Reactor 专职 accept**，accept 后把 Channel 轮询分配给**多个 worker Reactor**，每个独立线程+独立 epoll 各管一批连接读写。
> - 要点：于是同时解决前两代问题：既保留"业务出 IO 线程"（不阻塞），又消除 accept 单点、把读写均摊到多核，连接数与线程数解耦（可百万连接只几十线程）。
> - 加分：点出 Netty 的 boss/worker `NioEventLoopGroup` 即此模型，并呼应"IO 线程仍不得跑重活"。
