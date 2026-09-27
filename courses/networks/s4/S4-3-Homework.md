# 从输入 URL 到页面渲染全链路 · 课后作业

> 两题各 50 分：一题用工具把一次真实访问逐段量化，一题做一次端到端性能优化设计。做完你就有了"慢请求定位"的完整手感。

## 作业 1：把一次真实访问拆成"分段计时报告"（50 分）

**要求**：
1. 选一个公网站点（或自建含 DB 的页面），用 `curl -w` 采集 5 次的 `time_namelookup/connect/appconnect/starttransfer/total`，求平均。
2. 用浏览器 DevTools Network 打开同一页面，看 Waterfall：记录主文档请求各阶段（Queueing/Stalled、DNS、Connect、SSL、TTFB、Content Download）与子资源数量、并发情况。
3. 判断该站是 h1/h2/h3（看 Protocol 列），并解释子资源的并发/复用表现差异。
4. 指出这次访问中**最大耗时段**落在链路哪一步，给出至少两条针对性优化建议。

**验收标准**：
- 有一张"分段耗时表"，能算出建连、TLS、TTFB、下载各占比。
- 能说出 TTFB 大 → 后端、下载大 → 带宽/资源、Stalled 大 → 并发排队(HOL/连接上限)。
- 优化建议与链路某一段明确挂钩。

**参考答案要点**：
- h2/h3 子资源复用连接、Stalled 少；h1 受 6 连接上限、Stalled 明显。
- 优化：CDN 就近、开 TLS 会话复用、静态 hash + max-age、图片压缩/懒加载、SSR 降 TTFB、上 h3 抗弱网 HOL。

## 作业 2：设计"电商商详页首屏 P90 < 1.5s"的端到端方案（50 分）

**背景**：大促临近，商详页移动端首屏 P90 3.8s，要压到 1.5s 以内。

**要求**：沿"URL→渲染"全链路，为**每一段**给出优化手段 + 度量指标 + 风险，产出一页方案：
1. DNS / 建连 / TLS 段
2. 传输段（协议版本、拥塞、CDN）
3. 服务端段（TTFB）
4. 应用层缓存段
5. 渲染段

**验收标准**：
- 每段至少 1 个手段 + 1 个可量化指标（如 GSLB 命中、TLS 握手 RTT、TTFB P90、LCP、CDN 命中率）。
- 体现"先测量后优化"：给出压测/灰度/监控埋点方案（分段计时 + TraceID 全链路）。
- 指出优化间的取舍（如强缓存提升命中 vs 更新延迟；上 h3 提升弱网 vs CPU 成本）。

**参考答案要点**：
- DNS：HTTPDNS + dns-prefetch + 就近 GSLB；建连/TLS：长连接 + TLS1.3/会话复用 + 边缘就近终止。
- 传输：静态走 CDN 高命中 + 图片瘦身 + 评估 h3；服务端：缓存前置/SSR/异步/慢 SQL 治理降 TTFB；缓存：hash 静态资源 max-age=1y + HTML no-cache；渲染：关键 CSS 内联 + JS defer + LCP 元素预加载 + 骨架屏。
- 度量：压测脚本采 `curl -w` 各段 + 前端 Core Web Vitals 上报 + 后端 TraceID；按 P90/P99 定位瓶颈段再迭代。
