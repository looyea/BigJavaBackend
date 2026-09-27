# 从输入 URL 到页面渲染全链路 · 小测验

### 1. 浏览器敲下回车后，最先可能发生、从而跳过后续网络步骤的是（15分）

- A. DNS 解析
- B. HTTP 强缓存命中（max-age 未过期）
- C. TCP 握手
- D. 页面渲染

> 答案：B
> 解析：若命中强缓存（s3-1），浏览器直接用本地副本，DNS/TCP/TLS/请求全部跳过，是最快路径。

### 2. 决定后续走 HTTP/1.1、/2 还是 /3 的协商发生在哪一步（15分）

- A. DNS 的 TXT 记录
- B. TCP 握手选项
- C. TLS 握手的 ALPN
- D. HTTP 状态码

> 答案：C
> 解析：ALPN（Application-Layer Protocol Negotiation）在 TLS 握手里协商应用协议（h2/h3），省一次往返（s3-3/s3-2）。h3/QUIC 则在 Alt-Svc 提示下走 UDP。

### 3.【多选】一次"页面打开慢"，用 `curl -w` 分段计时可区分的慢点有（20分）

- A. DNS（time_namelookup 大）
- B. TCP+TLS 建连（time_connect/time_appconnect 大）
- C. 后端处理（time_starttransfer−time_appconnect 大，即 TTFB）
- D. 内容下载（time_total−time_starttransfer 大）

> 答案：ABCD
> 解析：四个占位符的差值正好把 DNS、建连、TLS、后端处理(TTFB)、传输(下载)逐段切开，是全链路定性的第一步（s4-2）。

### 4. 填空题：TTFB 很大而 connect/appconnect 正常时，慢的根因通常在 ____（填"网络"或"服务端")。（10分）

> 答案：服务端 / 后端
> 解析：建连与 TLS 正常说明网络通路 OK，TTFB（等首字节）大 = 服务端处理慢（GC/慢查询/下游），别冤枉网络（s4-2 心法）。

### 5. 关于浏览器"关键渲染路径"，正确的是（10分）

- A. 同步 `<script>` 会阻塞 HTML 解析/DOM 构建
- B. CSS 不阻塞渲染
- C. JS 永远不影响首屏
- D. 图片加载会阻塞 DOM 解析

> 答案：A
> 解析：同步脚本会中断 DOM 构建（故用 defer/async）。CSS 阻塞渲染（要 CSSOM）；图片异步加载不阻塞 DOM 解析。JS 常是首屏大头。

### 6. 简答：面试"从输入 URL 到页面显示发生了什么"，请用一条因果链完整作答（覆盖 DNS/TCP/TLS/HTTP/LB/渲染），并挑两处说明各自对应的排障工具。（30分）

> 参考答案：
> - 要点（链路顺序）：URL 解析→查强缓存→**DNS**(递归+迭代/GSLB 就近)→**TCP 三次握手**(半/全连接队列)→**TLS 握手**(SNI/ALPN/证书校验/ECDHE 会话密钥)→(可选过 **LB** 四层→七层→服务发现)→发 **HTTP**(h1/h2/h3)→服务端处理→**响应回传**(min(rwnd,cwnd) 拥塞/流控、缓存头)→浏览器**解析 HTML/CSS→DOM/CSSOM→渲染树→布局→绘制→合成**→子资源重复上述。
> - 排障工具要点（任选两处且正确）：DNS 慢用 `dig`/`time_namelookup`；建连/TLS 慢用 `curl -w time_connect/appconnect` + `ss -lnt`(队列) + `openssl s_client`；传输/丢包用 `ss -tin`(retrans/cwnd) 或 tcpdump+Wireshark；后端慢(TTFB) 用链路追踪 TraceID 对齐网关/服务/DB 哪一跳。
> - 加分：点出 h2/h3 对子资源并发的影响、以及"先测量再优化"的原则。
