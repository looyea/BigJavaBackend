# MyBatis 与 JPA/Spring 整合及选型（关联） · 作业

### 作业 1：让 MyBatis 跑在 Spring 事务里

- 目标：验证 MyBatis 操作与 `@Transactional` 共处同一事务、异常整体回滚。
- 任务：用 mybatis-spring-boot-starter + `@MapperScan` 接入，写一个转账方法调用两个 Mapper 更新，抛 RuntimeException 观察是否一起回滚；再故意把方法改成同类自调用，验证事务失效。
- 验收标准：正常路径两句同事务提交；异常时一起回滚、无手工 commit/close；自调用/private 场景能复现"事务不生效"。
- 参考解法要点：SqlSessionTemplate 取当前事务绑定的 SqlSession；默认只对 RuntimeException 回滚，注意 rollbackFor。

### 作业 2：动态数据源读写分离

- 目标：写走主、读走从，且切换在事务开启前完成。
- 任务：用 `AbstractRoutingDataSource` + ThreadLocal key + AOP 注解实现读写路由；用 `@Transactional(readOnly=true)` 触发走从库；构造一个"事务中途改 key"的用证其无效。再在异步线程里复现上下文丢失导致路由错乱并修复。
- 验收标准：读语句实际打到从库、写到主库；能演示事务开启后切库无效；异步场景显式传递/重建路由上下文。
- 参考解法要点：determineCurrentLookupKey 早绑定；连接池/事务管理器共享一致。

### 作业 3：JPA vs MyBatis 选型论证 + 混用方案

- 目标：对一个真实模块给出有依据的技术选型或混用设计。
- 任务：选一模块（含规整 CRUD + 若干复杂报表查询），说明哪些用 JPA、哪些用 MyBatis（或全用其一），论证依据；若混用，画出如何统一事务管理器与数据源、避免两套 Session 不回滚。
- 验收标准：选型理由落到"对象中心 vs SQL 中心""SQL 可控性""N+1/报表表达力"等具体维度；混用方案明确共享事务/数据源。
- 参考解法要点：CQRS 倾向——JPA 写模型、MyBatis 复杂读；黑盒扛不住就交 MyBatis，别硬凑。
