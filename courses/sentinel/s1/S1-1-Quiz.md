# 滑动窗口与流控效果 · 小测

### 1. Sentinel 滑动窗口底层数据结构是？（6分）

- A. HashMap
- B. LeapArray（环形数组）
- C. 红黑树
- D. 优先队列

> 答案：B
> 解析：LeapArray 是固定大小的数组循环使用，每个元素是一个 Window（含 pass/block/rt）。

### 2. FLOW_GRADE_THREAD 限流含义是？（6分）

- A. 每秒请求数
- B. 当前并发线程数超过阈值即拒绝
- C. CPU 线程数
- D. 连接池大小

> 答案：B
> 解析：按实时并发线程限流，适合耗时波动大的场景。

### 3. 关联限流中 controlBehavior 字段存的是？（6分）

- A. 限流算法名称
- B. 参照资源名（触发限流依据的另一个资源）
- C. 排队超时
- D. 预热时长

> 答案：B
> 解析：STRATEGY_RELATE 时该字段含义变为"当哪个资源超标时限制当前资源"。

### 4. Warm Up 模式下 coldFactor 默认值是？（6分）

- A. 1
- B. 2
- C. 3
- D. 5

> 答案：C
> 解析：默认 coldFactor=3 → 冷启动阈值 = count/3，在 warmUpPeriodSec 内线性升到 count。

### 5. RateLimiter（漏桶排队）模式适用于？（6分）

- A. 用户同步 HTTP 请求
- B. MQ 消费/后台任务削峰
- C. 数据库连接池
- D. WebSocket

> 答案：B
> 解析：排队需等待——同步 HTTP 等待体验差；异步/后台场景可容忍排队。

### 6. 链路限流由什么组合唯一确定？（6分）

- A. URL + Method
- B. resource + limitApp（调用来源）
- C. IP + Port
- D. ThreadName

> 答案：B
> 解析：同一资源从不同入口（origin）进入被视为不同链路。

### 7. 规则持久化到 Nacos 的好处是？（6分）

- A. 提升限流性能
- B. Dashboard 重启不丢规则 + 支持动态推送
- C. 减少内存占用
- D. 支持更多算法

> 答案：B
> 解析：默认规则存内存/Agent → Dashboard 重启丢失；持久化后可靠且热更新。

### 8. 以下哪些是 Sentinel 流控效果？（多选）（9分）

- A. 快速失败
- B. Warm Up
- C. 队列等待(RateLimiter)
- D. 熔断降级

> 答案：A、B、C
> 解析：D 是熔断规则的降级行为，不是流控效果。

### 9. LeapArray 窗口滑动时旧窗口数据的处理是（多选）？（9分）

- A. 重置所有指标（pass=0）
- B. 保留作为历史记录永久存储
- C. 复用为当前新窗口
- D. 写入磁盘

> 答案：A、C
> 解析：环形数组复用空间，旧窗口重置后当作新窗口使用。

### 10. 简答题：一个搜索服务冷启动场景如何配置 Sentinel 流控？（40分）

- 要点1：资源名=search，QPS 阈值=200
- 要点2：controlBehavior=WARM_UP，warmUpPeriodSec=10，coldFactor=3
- 要点3：效果：前 10s 从 66 QPS 线性升到 200 → 给 ES 连接池预热时间
- 要点4：同时配线程数限流 count=50 作为兜底（RT 高时快速拒绝）
- 要点5：规则持久化到 Nacos，Dashboard 改动即时生效

> 答案：见要点
> 解析：冷启动预热避免瞬间流量压垮未就绪的服务。
