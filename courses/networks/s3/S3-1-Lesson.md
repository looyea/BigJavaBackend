# HTTP/1.x：报文、持久连接与缓存

> HTTP 是后端每天都在写、却最少被"读懂协议语义"的一层。本节不背字段，而是把**报文结构 → 连接复用 → 幂等性/状态码 → 缓存决策链**讲成一台可推理的状态机，它直接决定你的接口该返什么状态码、缓存头怎么配、为什么大促把源站打穿。（重要度 5/5，核心精讲；承接 s2-4 队头阻塞，铺垫 s3-2/s3-3/s3-4）

## 一、报文结构：请求行/状态行 + 头 + 空行 + 体

```
请求                                   响应
POST /api/order HTTP/1.1               HTTP/1.1 200 OK
Host: shop.example.com                 Date: ...
Content-Type: application/json         Content-Type: application/json
Content-Length: 57                     Content-Length: 128
                                       Cache-Control: max-age=60, ...
{"sku":1,"qty":2}                      <空行>
                                       {"orderId":...}
```

- **头部字段大小写不敏感**（`Content-Type` == `content-type`），值区分语境。
- **头与体之间必须有一个空行（`\r\n\r\n`）**，这是报文头部结束的标志 —— 呼应 s2-4 的"分隔符定界"。
- `Host` 头在 HTTP/1.1 **强制**（虚拟主机基础，一台 IP 承多个域名）。

**两种"body 长度"确定方式**（对应 s2-4 定界）：
- `Content-Length: N`：显式字节数（需预先知道长度）。
- `Transfer-Encoding: chunked`：**分块传输**，每块 `[十六进制长度]\r\n数据\r\n`，结尾 `0\r\n\r\n`。用于流式/长度未知（动态生成、gzip 边压边发）。**chunked 与 Content-Length 互斥**。

## 二、连接复用：从短连接到 keep-alive

- **HTTP/1.0 默认短连接**：每个请求新建一条 TCP 连接，做完就关。代价：每请求一次握手（s2-2）+ 慢启动（s2-4，小对象根本来不及涨 cwnd 就传完了）→ 高 RTT 下极慢。
- **HTTP/1.0 keep-alive**（需显式 `Connection: keep-alive`）/**HTTP/1.1 默认持久连接**：一条 TCP 上串行跑多个请求-响应，省握手与慢启动。
- **代价 = 应用层队头阻塞**：一条连接**同一时刻只有一个请求在途**（请求-响应严格配对），前一个慢，后一个只能等。浏览器只能**开 6 条左右并发连接**硬扛 → 这正是 h2 多路复用要解决的（s3-2）。
- `Connection: close` 显式关闭；keep-alive 空闲由 `Keep-Alive: timeout=, max=` 或服务器 idle timeout 回收。**服务端 idle timeout 必须 < 中间 LB/CDN 的 timeout**，否则会复用一条"对端已悄悄关掉"的连接 → 偶发 502/EOF（这是极高频线上坑，呼应 s2-2 优雅发布）。

## 三、方法语义与幂等性（接口设计的正确性地基）

| 方法 | 有 body | 安全(只读) | 幂等 | 语义 |
|---|---|---|---|---|
| GET | 否 | ✅ | ✅ | 读资源，可缓存 |
| HEAD | 否 | ✅ | ✅ | 同 GET 只回头（探活/取大小） |
| PUT | 是 | ❌ | ✅ | **整体替换**，同一 URL 重复 PUT 结果相同 |
| POST | 是 | ❌ | ❌ | 创建/提交，重复可能生成多单 |
| PATCH | 是 | ❌ | 看实现 | 局部更新 |
| DELETE | 否 | ❌ | ✅ | 删除，重复删"已不存在"应回 404/409 而非 500 |

- **安全 = 不改变服务器状态**；**幂等 = 多次调用与一次调用效果相同**。二者不同：DELETE 幂等但不安全。
- **为什么重要**：重试与超时策略全押在这上面。网络抖动时**只能自动重试幂等/安全方法**；POST 下单不能盲重试（要靠**幂等键**去重，呼应电商下单）。

## 四、状态码家族：5 大类 + 后端最常用的十来个

- **1xx** 信息（`100 Continue`：大 body 前先问服务器收不收）。
- **2xx** 成功：`200 OK`、`201 Created`（POST/PUT 建资源）、`204 No Content`（成功但无 body，常用于 DELETE/CORS 预检）。
- **3xx** 重定向/缓存：`301` 永久重定向（**会被浏览器缓存，慎用**，改错了要清缓存）、`302` 临时、`304 Not Modified`（缓存协商命中，见第六节）。
- **4xx** 客户端错：`400` 参数错、`401` 未认证、`403` 已认证但无权限、`404` 不存在、`405` 方法不允许、`408` 请求超时、`409 Conflict`（并发冲突/重复提交）、`422` 语义校验失败、**`429 Too Many Requests`**（限流，带 `Retry-After`）。
- **5xx** 服务端错：`500` 通用、`502 Bad Gateway`（上游/后端返回无效，网关侧高发，呼应 s2-2/s3-4）、`503` 过载/维护（可带 `Retry-After`）、`504 Gateway Timeout`（上游超时）。

> 面试/评审高频辨析：**401 vs 403**（没登录 vs 没权限）；**502 vs 504**（上游回了个坏的 vs 上游压根没在时限内回）；**301 vs 302**（缓存语义与 method 是否可变）。

## 五、内容协商与压缩

- `Accept` / `Accept-Encoding` / `Accept-Language`（请求）↔ `Content-Type` / `Content-Encoding`（响应）。
- `Content-Encoding: gzip/br`：传输压缩；`Vary: Accept-Encoding` 告诉缓存"压缩与否要分开存"，**漏配 Vary 会让 CDN 把 gzip 内容发给不支持的客户端**（经典乱码事故）。

## 六、缓存：决策链 + 两大模式（最出价值的工程段）

HTTP 缓存是"离用户最近的 CDN/浏览器缓存"能打掉 80% 回源的根本原因。

**两级判断（简化决策链）**：
```
有缓存副本？
 ├─ 否 ────────────────────────────► 回源请求（完整 200）
 └─ 是
     ├─ 仍在"新鲜期"(未过期) ──────► 直接用缓存（200 from cache，不发请求）
     └─ 已过期
         ├─ 带验证器发条件请求 ────► 304 Not Modified（用缓存，省 body）
         └─ 服务器说变了 ─────────► 200 新内容（更新缓存）
```

**模式一：强缓存（不问服务器，直接看本地）**
- `Cache-Control`（HTTP/1.1，**优先**）：`max-age=60`（新鲜期 60 s）、`s-maxage`（给 CDN/共享缓存）、`no-cache`（**每次都协商**，见下）、`no-store`（**完全不缓存**，含敏感数据如银行卡页）、`public`/`private`（能否被 CDN 存）、`must-revalidate`。
- `Expires`（HTTP/1.0，绝对时间，**受客户端时钟偏差影响**，已被 max-age 取代，兼容用）。

**模式二：协商缓存（过期后问服务器"还能用吗"）**
- `ETag` / `If-None-Match`：内容指纹（强→弱 `W/"..."`），最准。命中回 **304 无 body**。
- `Last-Modified` / `If-Modified-Since`：修改时间，粒度只到秒、且"改了时间没改内容/改了内容时间没变"会误判 → ETag 更可靠但更贵（要算哈希）。

**优先级**：`Cache-Control` > `Expires`；`ETag(If-None-Match)` > `Last-Modified(If-Modified-Since)`。

**典型配置**：
- 静态资源（带 hash 的 js/css）：`Cache-Control: public, max-age=31536000, immutable`（文件名含 hash 永不改名 → 敢缓存一年）。
- 首页 HTML：`Cache-Control: no-cache`（每次协商）保证发布即时可见。
- 用户隐私接口：`Cache-Control: private, no-store`。

## 七、HTTP/1.1 的其它高频字段

- `Content-Length` vs `chunked`（第一节）。
- `Range` / `206 Partial Content`：断点续传、分片下载。
- `Connection`、`Keep-Alive`（第二节）。
- `Cookie` / `Set-Cookie`（配合 `HttpOnly`/`Secure`/`SameSite` 做会话，跨站与 CSRF 在 s3-3 安全语境讲）。
- 跨域 `Origin` + `Access-Control-*`（CORS：`Access-Control-Allow-Origin`、预检 `OPTIONS` + `Access-Control-Request-Method`）——前后端分离必踩，本质是浏览器同源策略。

## 八、三大行业场景钩子

- **电商**：商品详情页静态化 + `max-age` + CDN，把回源压到最低；下单接口 `no-store` 且**幂等键**防重复提交；大促发布换带 hash 的静态资源文件名，配合 HTML `no-cache` 让新版瞬时生效（避免用户拿新 HTML 引旧 JS 报错）。
- **金融**：行情快照 `max-age=1~3 s` 强缓存 + 协商兜底，既抗刷又不太旧；敏感页一律 `no-store`、`private`，禁止 CDN 落地；401/403 严格区分，鉴权失败绝不返回业务数据。
- **电力**：海量终端上报走 POST（非幂等），必须服务端幂等去重（同一 `采集时间+测点` 重复上报只记一次）；主站下发的批量文件用 `Range` 断点续传应对弱网吧。

## 九、要点回顾

1. 报文 = 行 + 头 + **空行** + 体；body 长度靠 **Content-Length 或 chunked**（互斥）。
2. **持久连接**省握手/慢启动，但带来**应用层队头阻塞**，浏览器靠多连接硬扛；服务端 idle timeout 要 **<** 中间层，避免复用死连接 502。
3. **幂等/安全**决定重试策略：只自动重试幂等安全方法，POST 靠幂等键。
4. 状态码语义要准：401/403、502/504、301/302、429+Retry-After。
5. 缓存两模式：**强缓存**（`Cache-Control:max-age`，不发请求）+ **协商缓存**（`ETag/Last-Modified`→304）；`Cache-Control` 优先于 `Expires`，`ETag` 优先于 `Last-Modified`。
6. 静态 hash 资源 `max-age=1y, immutable`；HTML `no-cache`；隐私 `no-store, private`；压缩必配 `Vary: Accept-Encoding`。
