# 连接泄漏、超时与故障定位 · 作业

### 作业 1：制造并捕获一次连接泄漏

- 目标：会用 `leakDetectionThreshold` 定位"拿了没还"的代码。
- 任务：写一个故意不 `close`（把 `Connection` 存字段、异常路径漏还）的方法，配置 `leakDetectionThreshold=5000`，压几次触发 WARN，读出日志里的借出线程栈；然后改成 try-with-resources 复测告警消失。
- 验收标准：泄漏版本能打出带借出点栈的 WARN 并最终 `getConnection` 超时；修复后不再出现；能解释"只告警不回收"的含义。
- 参考解法要点：阈值按最长合理事务设；对比 `active/waiting` 指标变化佐证。

### 作业 2：区分借连接超时与 SQL 执行超时

- 目标：能把两类超时症状与处置方向分开。
- 任务：分别构造——①池很小 + 连接全被占满触发 `connectionTimeout` 报错；②一条被人为拖慢的 SQL 触发 `setQueryTimeout`/`socketTimeout`。记录两者报错信息与池指标差异。
- 验收标准：①报 `Connection is not available`、`active≈max/waiting>0`；②报查询超时但池连接并不全是"借不到"；能说出各自应查的方向（池占用 vs DB 慢）。
- 参考解法要点：借连接超时要查占用/泄漏；执行超时要查 DB 慢查询/锁；不要互相窜改参数。

### 作业 3：池耗尽假象的线程栈定位

- 目标：验证"看着像池太小、实为连接被长占"的排查闭环。
- 任务：在一个接口里让线程借到连接后去调用一个慢的外部 HTTP（仍持有连接），压满池；用 `jstack` 多次采样，找出持有连接的线程栈；据此提出"把外部调用移出事务/连接作用域"的改造。
- 验收标准：能通过线程栈指出连接被非 DB 操作长时间占用；给出缩短占用时长的方案（超时、移出事务、异步化）。
- 参考解法要点：`HikariPoolMXBean`/Micrometer `hikaricp_connections_active`、`_pending`；占用时长比池大小更值得治。
