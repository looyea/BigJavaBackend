# HTTP/2 与 HTTP/3（QUIC）

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：二进制分帧、流/连接多路复用、头部 HPACK 与动态表、服务器推送与优先级；QUIC 用 UDP 消灭传输层队头阻塞、0-RTT、连接迁移与用户态拥塞控制。

> 上一节说清了 HTTP/1.1 的两宗罪：**应用层队头阻塞**与**头部明文冗余**。h2 用"二进制分帧 + 多路复用 + 头部压缩"解决了前两点（但把队头阻塞下沉给了 TCP），h3/QUIC 则连传输层队头阻塞一起端掉。本节是 s2-4"队头阻塞因果链"的落地。（重要度 4/5，重点标准；承接 s2-4/s3-1，铺垫 s3-3 TLS 与 s4-3 全链路）

## 一、HTTP/2 的四大改进

| 维度 | HTTP/1.1 | HTTP/2 |
|---|---|---|
| 报文格式 | 文本 | **二进制分帧**（更健壮、易解析） |
| 并发 | 一连接一请求（多连接硬扛） | **单连接多路复用**（多 stream 交错） |
| 头部 | 明文、重复 | **HPACK 压缩** + 动态表 |
| 服务端推 | 无 | **Server Push**（已近乎废弃） |
| 底层 | TCP | TCP（TLS 事实上强制） |

### 1. 二进制分帧层：帧 → 消息 → 流

h2 把通信拆成三层：
- **帧（Frame）**：最小单位，如 HEADERS 帧、DATA 帧、SETTINGS 帧、WINDOW_UPDATE 帧、RST_STREAM 帧。所有帧头 9 字节含 **Stream ID**。
- **消息（Message）**：一个请求/响应 = 若干帧（一个 HEADERS + 若干 DATA）。
- **流（Stream）**：一条连接上的**双向字节流**，由唯一 Stream ID 标识；客户端发起的用奇数 ID、服务端发起的用偶数 ID。多个流的帧可以**任意交错**，接收端按 ID 重组 —— 这就是**多路复用**，消灭了 h1 的应用层队头阻塞。

### 2. HPACK 头部压缩：静态表 + 动态表 + 哈夫曼

- **静态表**：58 个常见头（`:method: GET`、`content-type` 等）预置索引，发个整数即可。
- **动态表**：连接两端的 FIFO 缓存，把这次见过的头存下来，下次引用索引；有大小上限（`SETTINGS_HEADER_TABLE_SIZE`）。
- **哈夫曼编码**：对字面量字符串做 Huffman 压缩。
- 效果：重复的 Cookie/UA 头从几百字节压到几个字节。**风险**：BREACH/CRIME 类侧信道攻击会通过压缩长度猜密文（s3-3 安全语境），故敏感头要慎用压缩或拆分。

### 3. 流优先级与资源提示

- 帧带依赖树（早期规范），让浏览器先渲染关键资源；实际实现差异大，RFC 9218 用更简单的 **urgency** 重定义。
- `103 Early Hints` / `Link: rel=preload` 提示预取关键资源。

### 4. Server Push（了解即可，已凉了）

- 服务端在响应里主动 `PUSH_PROMISE` 推关联资源。**已被主流浏览器弃用**（缓存命中判断复杂、可能推无用字节），实践中用 preload/内联替代。面试说出"曾设计但基本废弃"即可。

## 二、流控与并发控制

- h2 有**基于信用的流控**：`WINDOW_UPDATE` 帧通告"我还能收多少字节"，粒度**同时作用于单流和整连接**（区别于 TCP 只按连接）。这防止一个快流饿死其它流、也防止接收缓冲溢出（思想同 s2-3 rwnd，netty/s3-2 背压同源）。
- `SETTINGS_MAX_CONCURRENT_STREAMS` 限制并发流数；`RST_STREAM` 可**单独取消一个流而不关整条连接**（h1 只能关连接）。

## 三、h2 的阿喀琉斯之踵：传输层队头阻塞

**多路复用把应用层 HOL 消灭了，但所有流仍跑在同一条 TCP 上**：
- TCP 要求按序交付字节（s2-3/s2-4）。**只要丢一个 TCP 段，这条连接上所有 stream 的数据都得等它重传成功才能向上交付** —— 哪怕那些帧属于别的、完全无关的请求。
- 弱网/高 RTT 下，h2 可能**比 h1 多连接还慢**：h1 的 6 条连接彼此独立，一条丢包只卡它自己；h2 一条丢包全卡。
- **结论**：应用层并行 ≠ 传输层并行，只要底层是"单一有序字节流"，HOL 就无法根除。这是逼出 QUIC 的唯一动机。

## 四、HTTP/3 与 QUIC

**QUIC = 跑在 UDP 上的、用户态实现的、多流且每流独立可靠的传输协议**；HTTP/3 = 用 QUIC 替代 TCP(+TLS) 承载的 HTTP 语义。

| 维度 | TCP + TLS + HTTP/2 | QUIC + HTTP/3 |
|---|---|---|
| 传输 | TCP（内核） | **UDP + 用户态可靠层** |
| 队头阻塞 | 有（连接级） | **无（每流独立丢包恢复）** |
| 握手建连 | TCP 1-RTT + TLS 1/2-RTT | **合并，0-RTT/1-RTT** |
| 连接标识 | 五元组(IP+Port) | **Connection ID**（可迁移） |
| 拥塞控制 | 内核固定 | **用户态可插拔、逐连接** |
| 头部压缩 | HPACK | **QPACK**（容忍乱序） |

### QUIC 的四个关键设计

1. **每流独立可靠（消灭 HOL）**：QUIC 把"有序 + 重传"做到**每个 stream 各自的序号空间**。某个包丢了只影响承载它的那条流，其它流的包照常交付。这正是 s2-4 因果链的终点解法。
2. **0-RTT / 1-RTT 建连**：TLS 1.3 已并入 QUIC 握手，一次交互同时完成传输 + 加密握手；有会话票（resumption）时首个请求数据可 **0-RTT** 发出（但有重放风险，只用于幂等/初次，s3-3）。相比 TCP+TLS 冷启动省 2~3 个 RTT，高 RTT 移动网收益巨大。
3. **连接迁移（Connection ID）**：连接身份用 **Connection ID** 而非四元组。**手机从 Wi-Fi 切 4G、NAT 后换端口**，IP/Port 变了也不用重连（TCP 会断重建）。对移动 App、频繁切网场景是质变。
4. **用户态拥塞控制**：cc 逻辑在应用库（如 Go/Rust/quiche）而非内核，可随应用发版更新、可每连接不同算法，迭代速度远超内核 TCP。

### QPACK（为何 HPACK 不够用）

HPACK 依赖"头部按序到达"来维护动态表；QUIC 允许乱序，若照搬会重新引入 HOL。QPACK 通过**独立的编码器流/解码器流 + 容忍乱序的索引设计**避免"压缩字典反过来制造队头阻塞"。

## 五、工程现实与取舍（别只唱赞歌）

- **h2 落地成熟**：Nginx/网关/Java（JDK 11+ HttpClient、Jetty、Tomcat 9+ 需 ALPN 与 TLS）；gRPC 强依赖 h2（多流 + 双向 stream）。
- **h3/QUIC 的代价**：① **CPU 更高**（用户态处理每个 UDP 包、加解密、无内核/GRO/TSO 硬件卸载红利）；② **生态与运维**（防火墙/QoS 对 UDP 不友好、可观测工具链较新）；③ 服务端要能处理 UDP 洪泛（QUIC 用 **Address Validation + Retry 帧**抗放大攻击）。
- **选型建议**：内网 RPC、低丢包链路 → h2/gRPC 足够；**面向公网移动用户、高 RTT/高丢包、需要切网不断连** → h3/QUIC 收益明显；CDN/加速厂商普遍已默认开 h3。

## 六、三大行业场景钩子

- **电商**：移动 App 首屏大量小请求 + 用户常在弱网/切网，前端接入 **h3/QUIC**（CDN 侧开启）显著降 LCP、切网不掉线；服务端内部微服务调用仍走 **h2/gRPC**，无需上 h3。
- **金融**：行情推送（大量并发小消息）用 h2 多流 + 服务端流控天然契合；但对外接入要考虑**监管对加密与可审计**，h3 的可观测/留痕工具要先补齐再上。
- **电力**：终端海量、链路差、经常 NAT/切网，**QUIC 的连接迁移 + 0-RTT** 直击"频繁重连 + 建连慢"痛点；但嵌入式终端要评估 UDP 栈与 QUIC 库的内存/CPU 占用（往往比精简 TCP 重）。

## 七、例子：JDK HttpClient 用 HTTP/2（正确用法与错误用法）

```java
// 例子目的：用 JDK 11+ HttpClient 显式协商 HTTP/2，当场看版本并感受多流复用
import java.net.*;
import java.net.http.*;
import java.net.http.HttpClient.Version;
class H2Demo {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newBuilder()          // 声明优先用 HTTP/2
            .version(Version.HTTP_2)                         // 底层靠 ALPN 在 TLS 握手中协商（s3-3）
            .connectTimeout(java.time.Duration.ofSeconds(3))
            .build();
        HttpResponse<String> resp = client.send(            // 同步发送（异步为 sendAsync）
            HttpRequest.newBuilder(URI.create("https://api.example.com/ping")).build(),
            HttpResponse.BodyHandlers.ofString());
        System.out.println(resp.version());                  // 正确使用结果：服务端支持时输出 HTTP_2，否则回退 HTTP_1_1
        System.out.println(resp.statusCode());               // 正常输出 200
        // 连接复用的体现：同一 client 实例发多个请求会共用一条 TCP 上的多个 stream，不会每请求新建连接
    }
}
// 错误用法 1：对新 client 设了 .version(HTTP_2) 却每次 new HttpClient() → 连接不复用，每请求重建 TLS+握手，把 h2 多路复用优势全抵消（高频 GC/端口耗尽）
// 错误用法 2：对端只监听明文 h2c（prior knowledge）却用 https:// + HTTP_2 → ALPN 不存在，静默降级到 HTTP/1.1，期待的多路复用根本没生效
// 错误用法：指望 Java HttpClient 自动用 0-RTT/Server Push → JDK 未暴露这两能力，它们需专用 h3 库（如 netty-incubator-codec-quic）
```

## 八、要点回顾

1. h2 = **二进制分帧 + 单连接多路复用（流）+ HPACK 头压缩 + 双向流控 + 优先级**；消灭应用层 HOL 与头部冗余。
2. **Server Push 已近乎废弃**，用 preload 替代。
3. h2 致命伤：**多流共享一条 TCP → 传输层队头阻塞**，弱网下可能不如 h1 多连接。
4. **QUIC/H3 才是根治**：每流独立重传（解 HOL）、0-RTT/1-RTT 建连、**Connection ID 连接迁移**、用户态可插拔拥塞控制、QPACK。
5. 代价：**CPU 更高、UDP 生态/运维、抗 DDoS（Address Validation）**；选型：内网 h2/gRPC、公网移动弱网 h3。
6. 一句话串因果：**要并行→多路复用→仍一条 TCP→传输层 HOL→只能换掉 TCP→QUIC(每流独立,建于 UDP)**。
