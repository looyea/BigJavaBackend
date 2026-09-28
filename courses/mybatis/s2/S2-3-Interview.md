# MyBatis 与 JPA/Spring 整合及选型（关联） · 面试题

## 题 1：MyBatis 怎么和 Spring 事务整合？

- mybatis-spring-boot-starter 自动配 SqlSessionFactory，`@MapperScan` 注册 Mapper，SqlSessionTemplate 取"当前事务绑定的 SqlSession"执行。
- 于是 `@Transactional` 能统一管 MyBatis 操作，异常整体回滚，无需手工 commit/close。
- 加分：提醒 @Transactional 对 private/自调用不生效、默认只回滚 RuntimeException。

## 题 2：SqlSessionTemplate 和 SqlSession 区别？

- SqlSession 非线程安全、需手工开关；Template 是 Spring 管理的线程安全单例。
- Template 内部按事务同步取绑定的 Session，用完自动管理。
- 加分：这就是"复用 Spring 事务"的机制根源。

## 题 3：JPA 和 MyBatis 你会怎么选？

- 领域复杂、对象为中心、CRUD 规整选 JPA；DBA 主导、复杂查询/报表/批量、要精细控 SQL 与方言选 MyBatis。
- 不必一刀切。
- 加分：能讲清 JPA 黑盒 SQL、N+1、报表弱这些代价，以及 MyBatis 样板维护代价。

## 题 4：能一个工程混用两者吗？

- 能，CQRS 倾向：JPA 管写模型、MyBatis 管复杂读/报表。
- 前提：统一 Spring 事务管理器与数据源，否则两套 Session 各管各、不回滚。
- 加分：强调"看似一起提交实则各管各"是混用最阴险的坑。

## 题 5：读写分离/动态数据源怎么实现、有什么坑？

- AbstractRoutingDataSource + ThreadLocal key，事务开启前确定路由；readOnly=true 可作线索。
- 坑：事务一旦开始连接已绑定、中途切库无效；异步/嵌套线程丢 ThreadLocal 导致路由错乱。
- 加分：给出上下文传递/重建的解决办法。

## 题 6：JPA 的性能问题什么时候该放弃它？

- 复杂统计/报表、需精确控制执行计划、批量写入等黑盒扛不住的场景。
- 用原生查询或交给 MyBatis，而非硬凑实体映射。
- 加分：点出"先量后选"——用真实 SQL 与执行计划说话，别为教条坚持某一 ORM。
