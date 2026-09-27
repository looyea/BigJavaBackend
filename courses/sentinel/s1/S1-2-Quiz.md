# 熔断降级与系统自适应保护 · 小测

### 1. 熔断三态的正确流转是？（6分）

- A. Open→Closed→Half-Open
- B. Closed→Open→Half-Open→Closed(或回Open)
- C. Half-Open→Closed→Open
- D. Closed→Half-Open→Open

> 答案：B
> 解析：正常 Closed → 触发阈值变 Open(全拒绝) → timeWindow 后 Half-Open(试探) → 成功回 Closed/失败回 Open。

### 2. 慢调用比例策略中 slowRatioThreshold 的含义是？（6分）

- A. 熔断持续时长
- B. RT 超过此值则算"慢调用"
- C. 慢调用通过数
- D. 最小请求数

> 答案：B
> 解析：如设 500ms → RT > 500ms 的请求计为"慢"，比例超 count 阈值触发。

### 3. minRequestAmount 的作用是？（6分）

- A. 最小线程数
- B. 窗口内请求数不足此值时不做熔断判断（避免误判）
- C. 熔断恢复后的最小通过数
- D. 最小连接数

> 答案：B
> 解析：若窗口内只有 1 个异常请求(100%)就熔断太敏感 → 需达到最低样本量。

### 4. 系统自适应保护规则针对的是？（6分）

- A. 单个资源
- B. 整个应用/系统级指标（Load/RT/线程/QPS）
- C. 某个 Feign Client
- D. 数据库连接

> 答案：B
> 解析：SystemRule 是全局兜底——不区分资源，任何入口请求都受约束。

### 5. 熔断触发后 fallback 中不应该做什么？（6分）

- A. 返回缓存数据
- B. 返回默认值
- C. 再次远程调用同一下游服务
- D. 记录降级日志

> 答案：C
> 解析：下游已经触发了熔断 → 再调只会加重负担/雪崩。

### 6. timeWindow 的含义是？（6分）

- A. 统计窗口时长
- B. 熔断持续时长（Open 状态保持多久后进入 Half-Open）
- C. 请求超时时间
- D. 重试间隔

> 答案：B
> 解析：timeWindow 后进入 Half-Open 放一个请求试探下游是否恢复。

### 7. 限流和熔断最本质的区别是？（6分）

- A. 无区别
- B. 限流看"量"（QPS），熔断看"质"（RT/异常率）
- C. 熔断比限流性能差
- D. 限流只能单机

> 答案：B
> 解析：FlowRule 按流量大小决策；DegradeRule 按调用质量决策。

### 8. 以下哪些是 Sentinel 熔断策略？（多选）（9分）

- A. 慢调用比例
- B. 异常比例
- C. 异常数
- D. 线程数

> 答案：A、B、C
> 解析：D 是 FlowRule 的限流维度，不是熔断策略。

### 9. 系统保护规则 Load 阈值如何设定合理？（多选）（9分）

- A. 通常设为 CPU 核心数 × 2
- B. 设为无穷大等于不生效
- C. 应该与 maxThread 配合使用
- D. 只能设整数

> 答案：A、B、C
> 解析：Load=核数×2 是经验值；D 错——SetRule 接受 double。

### 10. 简答题：描述一个完整的"熔断→降级→恢复"流程，并说明每步的技术要点。（40分）

- 要点1：Closed→触发：慢调用比例超 50%，minRequestAmount 达到 → 状态变 Open
- 要点2：Open→全拒绝：后续请求直接走 fallback → 返回本地缓存/兜底数据
- 要点3：timeWindow 到期→Half-Open：放 1 个真实请求试探下游
- 要点4：试探成功→Closed：恢复正常流量；失败→回 Open→继续拒绝
- 要点5：技术要点：fallback 禁止远程调用；需配告警通知值班；规则持久化到 Nacos

> 答案：见要点
> 解析：熔断是保护调用方不被慢下游拖死的保险丝。
