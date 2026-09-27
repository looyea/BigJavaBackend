# HTTP/1.x：报文、持久连接与缓存 · 面试题

> HTTP 面试题的陷阱在"背了字段但不理解语义"。高分答案是：状态码选得准、幂等讲得清、缓存链路画得出、连接复用坑说得出来。

## 考点 1：HTTP 报文与 body 长度

**起手**：服务器怎么知道响应 body 有多长？

**期望**：
- 两种方式：**`Content-Length`**（已知长度）或 **`Transfer-Encoding: chunked`**（分块，边生成边发，结尾 `0\r\n\r\n`），二者互斥。
- 头体之间靠空行 `\r\n\r\n` 分隔（呼应 s2-4 分隔符定界）。

**追问链**：
1. chunked 用在哪？→ 长度未知/流式输出（动态生成、大文件边压边发、SSE 类）。
2. 请求里 `100 Continue` 是干嘛的？→ 大 body 发送前先探服务器是否接受（Expect: 100-continue）。

## 考点 2：方法语义、幂等与安全

**起手**：GET 和 POST 的本质区别？PUT 和 POST 呢？

**期望**：
- 语义：POST 创建/提交（非幂等），PUT 整体替换（幂等）。
- 安全=只读（GET/HEAD），幂等=多次=一次（GET/PUT/DELETE 幂等）。

**追问链**：
1. DELETE 幂等吗？安全吗？→ 幂等（重复删效果同）但不安全（改状态）。
2. 幂等性有什么用？→ 决定能否自动重试；POST 下单要靠**幂等键**在业务层去重。
3. GET 能有 body 吗？→ 规范不建议、多数实现忽略；参数走 query。

## 考点 3：状态码辨析（送分/送命两极）

**起手**：随挑几组辨析。

**期望**：
- **401 vs 403**：未认证 vs 无权限。
- **502 vs 504**：上游返回无效 vs 上游超时。
- **301 vs 302**：永久（被浏览器/缓存固化，慎用）vs 临时。
- **304**：协商缓存命中，不重复传 body。
- **429**：限流，配 `Retry-After`；**503**：过载/维护，也可 `Retry-After`。

**追问链**：
1. 为什么 301 慎用？→ 一旦发错会被客户端长期缓存，很难回收（换成 302 或加短 max-age）。
2. 业务失败到底回 200 还是 4xx/5xx？→ 讲清 REST 语义（真 4xx/5xx）与国内"统一 200 + body code"两种流派及各自对监控/重试的影响，能对比即高分。

## 考点 4：缓存（几乎必问，且能出实操题）

**起手**：浏览器输入 URL 回车，命中缓存的完整判断过程？

**期望（决策链）**：
- 有没有副本 → 新鲜期内直接用（**强缓存** `Cache-Control:max-age`/`Expires`，不发请求）→ 过期则发**条件请求**（`If-None-Match:ETag` / `If-Modified-Since`）→ 命中 **304** 复用、否则 **200** 换新。

**追问链**：
1. `no-cache` 和 `no-store` 区别？→ no-cache=可存但每次必须协商；no-store=根本不存（敏感数据）。
2. `ETag` vs `Last-Modified`？→ ETag 内容指纹更准（解决秒级不变/内容变时间不变），但更贵；Last-Modified 粒度到秒。
3. 优先级？→ Cache-Control > Expires；ETag > Last-Modified。
4. 静态资源怎么配最优？→ 文件名带 hash：`max-age=1y, immutable`；HTML：`no-cache`；这样发布即换 hash 文件天然生效。

## 考点 5：连接复用与线上坑（架构向）

**起手**：keep-alive 有什么坑？为什么偶发 502？

**期望**：
- 持久连接省握手/慢启动但有**应用层队头阻塞**，浏览器多连接硬扛。
- **服务端 idle timeout 必须 < 中间 LB/CDN timeout**：否则中间层复用一条服务端已悄悄关掉的连接 → 请求发到死连接 → 502/EOF，重试即好（间歇性）。
- 呼应发布场景：滚动重启关连接 → 优雅下线先摘流量（s2-2）。

**追问链**：
1. 为什么 HTTP/1.1 要开 6 条连接？→ 规避单连接串行 HOL；但连接本身有 TCP 握手+慢启动成本，两难，h2 多路复用解决。
2. `Connection` 头在 h1 和 h2/h3 的差异？→ h2 移除逐跳 Connection 头，复用交给流；h3 走 QUIC 无 TCP 连接概念。

## 考点 6：CORS（前后端分离必踩）

**起手**：什么时候会触发预检请求？

**期望**：
- 同源策略由浏览器执行；跨域"简单请求"直接带 `Origin` 发，服务器回 `Access-Control-Allow-Origin` 才放行。
- **非简单请求**（自定义头、PUT/DELETE、`Content-Type: application/json` 等）先发 **`OPTIONS` 预检**（`Access-Control-Request-Method/Headers`），通过后才会发真实请求。
- 带 Cookie 要 `Allow-Credentials: true` 且 `Allow-Origin` 不能是 `*`；`SameSite` 影响 Cookie 是否随跨站请求发送（s3-3 安全语境）。
