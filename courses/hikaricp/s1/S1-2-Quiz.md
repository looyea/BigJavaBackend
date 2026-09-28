# 连接池参数调优与容量测算 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. HikariCP 官方给出的池大小经验公式大致是（6分）

- A. 核心数×2 + 有效磁盘数
- B. 内存 GB×100
- C. QPS×2
- D. 固定 200

> 答案：A
> 解析：`connections ≈ CPU 核数×2 + 磁盘数` 给出 CPU/IO 平衡起点，最终靠压测找吞吐-延迟拐点。

### 2. 关于"池越大吞吐越高"，正确的理解是（6分）

- A. 成立，连接越多越好
- B. 不成立，超过数据库承受力后更多连接只会加剧排队/锁竞争、降低吞吐
- C. 只取决于 `connectionTimeout`
- D. 与数据库无关

> 答案：B
> 解析：吞吐受 DB CPU/锁/IO 上限约束，池开太大反增上下文切换与 DB 端压力。

### 3. 想要"固定大小池"避免突发时反复建连，应（6分）

- A. `minimumIdle` 设很小
- B. `minimumIdle = maximumPoolSize`
- C. 关掉 `maxLifetime`
- D. 调大 `connectionTimeout`

> 答案：B
> 解析：让最小空闲等于最大，连接数恒定，避免流量突增时临时建连（TCP+认证+SSL 代价高）。

### 4. `maxLifetime` 必须显著小于数据库侧的哪个值，否则会取出死连接？（6分）

- A. `max_connections`
- B. `wait_timeout`（连接空闲被服务端单方面关闭的时间）
- C. `innodb_buffer_pool_size`
- D. `net_read_timeout` 任意值

> 答案：B
> 解析：若池认为连接还活着、而服务端已按 `wait_timeout` 断开，取出即 `Communications link failure`；`maxLifetime` 要留 30~60s 余量小于它。

### 5. `connectionTimeout` 指的是（6分）

- A. SQL 执行超时
- B. 从池借到一个连接的最长等待，超时抛异常
- C. 连接空闲回收时间
- D. TCP 握手时间

> 答案：B
> 解析：它是"借连接"的等待上限（默认 30s），设太长会在池耗尽时把请求线程一个个拖死。

### 6. `idleTimeout` 生效的前提是（6分）

- A. `minimumIdle < maximumPoolSize`（非固定池）
- B. `maxLifetime=0`
- C. 关闭 keepalive
- D. 永远生效

> 答案：A
> 解析：固定池（min=max）不回收空闲连接，`idleTimeout` 无意义；只有允许缩容时它才回收超出 `minimumIdle` 的空闲连接。

### 7. `keepaliveTime` 的主要作用是（6分）

- A. 加速建连
- B. 定期对空闲连接发探测，提前剔除被防火墙/NAT 静默断开的死连接
- C. 增大池
- D. 替代事务

> 答案：B
> 解析：中间层可能在空闲期悄悄断连，keepalive 主动探测、把死连接在借出前换掉。

### 8.（多选）以下哪些属于合理的容量/超时调优做法？（9分）

- A. 先查数据库 `wait_timeout`/代理空闲断开时间，再定 `maxLifetime`
- B. 用压测找吞吐-延迟拐点确定 `maximumPoolSize`
- C. 为提高并发把池直接开到 500
- D. 业务波动大时优先用固定池减少建连抖动

> 答案：A、B、D
> 解析：C 是反例——远超 DB 承受力的大池会加剧锁竞争与切换，吞吐不升反降。

### 9.（多选）关于固定池与动态池，正确的有（9分）

- A. 固定池 `min=max`，连接数恒定、突发不建连
- B. 动态池压低 `minimumIdle`，闲时省连接但突发有建连延迟
- C. 固定池下 `idleTimeout` 不起作用
- D. 动态池一定能带来更高吞吐

> 答案：A、B、C
> 解析：D 错——动态池只是省资源，不必然提升吞吐；官方更推荐简单稳定的固定池。

### 10. 一个 OLTP 服务把 HikariCP 的 `maximumPoolSize` 设为 300，数据库报大量锁等待、应用偶发 `Communications link failure`（DB `wait_timeout=600s`），且 `maxLifetime` 设为 1800s。请给出容量与超时的整改方案。（40分）

> 参考答案：
- 要点1：容量收敛——300 远超 DB 承受力，按"核数×2+磁盘"起点、用压测找拐点，把 `maximumPoolSize` 降到几十量级（如 20~40），缓解锁竞争与切换（10分）
- 要点2：固定池——设 `minimumIdle=maximumPoolSize` 消除突发建连抖动，`idleTimeout` 随之无意义可忽略（10分）
- 要点3：修死连接——`maxLifetime=1800s > wait_timeout=600s` 正是 `Communications link failure` 根因，改为显著小于 600s（如 300s 并留余量），并按需配 `keepaliveTime` 探测（10分）
- 要点4：借连接超时——`connectionTimeout` 保持合理（秒级）用于快速失败，配合 `leakDetectionThreshold` 确认是否有泄漏占住连接，而非靠调大池/超时掩盖（10分）
