# 连接池核心参数与故障表现 · 小测

### 1. HikariCP 的 maximumPoolSize 推荐设置为？（6分）

- A. 越大越好，至少 100
- B. 约等于 CPU 核心数×2 + 磁盘数
- C. 等于数据库 max_connections
- D. 固定为 50

> 答案：B
> 解析：HikariCP 官方公式 optimal = cores×2 + spindles；超过后线程切换开销抵消收益。

### 2. connectionTimeout 默认值和超时异常类型是？（6分）

- A. 10s / TimeoutException
- B. 30s / SQLTransientConnectionException
- C. 60s / Connection refused
- D. 无限 / 无异常

> 答案：B
> 解析：默认 30000ms；超时抛 SQLTransientConnectionException（含 "Connection is not available"）。

### 3. maxLifetime 应设置为什么值？（6分）

- A. 无限长，尽量复用连接
- B. 略大于 MySQL wait_timeout
- C. 略小于 MySQL wait_timeout 或网络设备 idle timeout
- D. 等于 connectionTimeout

> 答案：C
> 解析：连接必须在数据库/中间设备主动关闭前被池回收，否则借出半开连接报错。

### 4. leakDetectionThreshold 的效果是？（6分）

- A. 自动回收超时连接
- B. 打印借出连接时的堆栈日志，辅助定位泄漏代码
- C. 抛出异常中断业务
- D. 关闭连接池并重启

> 答案：B
> 解析：HikariCP 不会自动回收（怕误杀慢事务），仅 WARN 级别打印堆栈供开发者排查。

### 5. 以下哪种情况不会导致池耗尽？（6分）

- A. 慢 SQL 长时间占用连接
- B. @Transactional 嵌套调用传播为 REQUIRED 复用同一连接
- C. 并发请求数 > maxPoolSize 且 connectionTimeout 很短
- D. 连接借出后忘记归还

> 答案：B
> 解析：REQUIRED 传播加入已有事务复用同一连接，不额外占用；其余三项均会导致耗尽。

### 6. 超时链路的正确排序（从外到内）是？（6分）

- A. MySQL → HikariCP → Tomcat → 网关 → 客户端
- B. 客户端 → 网关 → Tomcat → HikariCP → MySQL
- C. 网关 → 客户端 → HikariCP → MySQL → Tomcat
- D. Tomcat → 客户端 → MySQL → 网关 → HikariCP

> 答案：B
> 解析：请求从客户端进入 → 网关转发 → Tomcat 线程 → 获取连接 → 执行 SQL，每层超时应递减。

### 7. HikariCP 如何保证连接可用性？（6分）

- A. 每次借出执行 SELECT 1 探活
- B. 仅靠 maxLifetime 主动轮换 + keepaliveTime（4.3.1+）
- C. 后台线程每秒全量 ping
- D. 依赖 JDBC 驱动自动重连

> 答案：B
> 解析：SELECT 1 太慢不适合热路径；HikariCP 用 maxLifetime 轮换，新版加 keepaliveTime 定期保活。

### 8. 以下对 minimumIdle 说法正确的是（多选）？（9分）

- A. 等于 maximumPoolSize 时形成固定大小池
- B. 小于 max 时形成弹性池，空闲超 idleTimeout 会缩回 min
- C. 默认值为 0（无最小保留）
- D. 官方推荐 min=max 以获得确定性性能

> 答案：A、B、D
> 解析：C 错——默认 minIdle=maxPoolSize（固定池），不是 0；官方推荐固定大小避免扩缩波动。

### 9. 连接池监控中 threadsAwaitingConnection > 0 说明什么？（多选）（9分）

- A. 所有连接都在使用中，有线程在等空闲
- B. 连接池配置过大需缩减
- C. 可能存在慢 SQL 或连接泄漏
- D. 应立即重启应用

> 答案：A、C
> 解析：B 错——需要等待说明池太小或借用时间过长；D 错——应观察指标而非盲目重启。

### 10. 简答题：解释"池大小并非越大越好"的原因，并给出从故障现象到参数调整的完整排查思路。（40分）

- 要点1：超过 CPU 核数后线程切换成本增加，且 DB 侧处理能力有限（InnoDB 行锁争用加剧）
- 要点2：故障现象——connectionTimeout 异常 + threadsAwaiting > 0 + Active=max
- 要点3：排查顺序：检查慢 SQL（SHOW PROCESSLIST）→ 确认是否有泄漏（leakDetection 日志）→ 分析并发量 vs 池大小
- 要点4：调整策略：若确实高并发 → 加池+分库；若是慢 SQL → 优化而非加池；若是泄漏 → 修代码

> 答案：见要点
> 解析：核心思维是"池耗尽是果不是因"，找到占用连接的真因再调参。
