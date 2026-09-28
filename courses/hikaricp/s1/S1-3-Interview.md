# 连接泄漏、超时与故障定位 · 面试题

## 题 1：什么是连接泄漏？怎么发现？

- 借出的连接没被归还（未 close、异常路径漏还、存字段跨方法裸用），可用连接被慢慢占光。
- 用 HikariCP `leakDetectionThreshold`：借出超时未还即打 WARN 并附借出线程栈，直接定位代码。
- 加分：强调它只告警不强制回收，最终症状是 `getConnection` 抛 `Connection is not available, request timed out`。

## 题 2：`leakDetectionThreshold` 怎么设？会误报吗？

- 按"最长合理事务/查询时长"设，太短会把正常的长事务误判成泄漏刷屏。
- 它给的是"借出点"的栈，帮你找到谁拿了没还，而不是自动帮你还。
- 加分：说清"泄漏告警必须当 error 追根因，不能设了就算治理完"。

## 题 3：线上报 `Connection is not available, request timed out`，你的排查顺序？

- 先看池指标 `active/idle/waiting`：`active≈max 且 waiting>0` = 连接被占满，而非池"太小"。
- 抓 jstack 多次采样看持有连接的线程卡在哪（慢 SQL、外部调用、死循环），并跟进泄漏告警。
- 加分：反射性加大 `maximumPoolSize` 往往掩盖真因，应先缩短"占用时长"。

## 题 4：借连接超时、SQL 执行超时、事务超时分别由什么控制、指向什么？

- 借连接超时：`connectionTimeout`，指向池耗尽/泄漏。
- SQL 执行超时：`Statement.setQueryTimeout` / JDBC `socketTimeout`，指向 DB 慢查询/锁等待。
- 事务超时：`@Transactional(timeout=)`，指向事务内最慢那段操作。
- 加分：强调把三者混为一谈会朝错误方向调参，症状与报错文案各不相同。

## 题 5：为什么说"池耗尽常常是假象"？

- 表象是"借不到连接"，真因多是连接被长时间占用——慢 SQL、事务里调外部接口、或泄漏没还。
- 治本是缩短单连接占用时长（查询超时、拆事务、外部调用移出事务/连接作用域），而不是无限扩池。
- 加分：结合容量公式说明池上限本就受 DB 承受力约束，扩池可能反压垮 DB。

## 题 6：怎么从代码层面根治泄漏？

- 一律 try-with-resources 获取 `Connection`/`Statement`/`ResultSet`，异常路径也自动归还。
- 不把 `Connection` 存成字段跨方法裸用；用框架（Spring JPA/MyBatis）托管连接生命周期。
- 加分：提到配合 `leakDetectionThreshold` 做上线后回归监控，把它当"发现没写对的归还路径"的兜底。
