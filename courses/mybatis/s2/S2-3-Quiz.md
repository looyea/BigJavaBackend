# MyBatis 与 JPA/Spring 整合及选型（关联） · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. MyBatis 复用 Spring 事务的关键组件是（6分）

- A. 手工 new SqlSession 并自己 commit
- B. SqlSessionTemplate（线程安全单例，内部使用当前事务绑定的 SqlSession）
- C. 原生 JDBC Connection
- D. ThreadPoolExecutor

> 答案：B
> 解析：SqlSessionTemplate 由 Spring 管理、按当前事务取绑定的 SqlSession 执行，配合 @Transactional 实现同事务、异常回滚，无需手工提交关闭。

### 2. `@MapperScan` 的作用是（6分）

- A. 扫描实体类建表
- B. 批量把 Mapper 接口生成代理并注册为 Bean
- C. 扫描 XML 语法
- D. 开启事务

> 答案：B
> 解析：@MapperScan 免去每个接口 @Mapper，按包批量注册 Mapper 代理 Bean，由容器注入使用。

### 3. 动态数据源切换必须在什么时候确定？（6分）

- A. 事务执行到任意时刻都能切
- B. 事务开启之前确定，事务一旦开始连接已绑定、中途切库无效
- C. 只在启动时定一次
- D. 每句 SQL 前都切

> 答案：B
> 解析：AbstractRoutingDataSource 在获取连接时按 key 路由；事务开启后 Connection 固定，再改 ThreadLocal key 也不生效。

### 4. 关于 JPA/Hibernate 的定位，正确的是（6分）

- A. 面向 SQL、每句手写
- B. 面向领域模型与状态管理：实体托管、脏检查、派生查询，适合对象为中心、CRUD 规整场景
- C. 只能写原生 SQL
- D. 不能自动建表

> 答案：B
> 解析：JPA 以对象/领域为中心，自动脏检查与 DDL；代价是 SQL 黑盒、N+1 与复杂报表表达弱。

### 5. 更适合选 MyBatis 的场景是（6分）

- A. 领域模型复杂、以实体为中心
- B. DBA 主导、复杂查询/报表/批量、需精细控制 SQL 与方言
- C. 完全不想写 SQL
- D. 需要自动脏检查

> 答案：B
> 解析：MyBatis 让你掌控每一句 SQL，适合复杂查询与性能调优；代价是映射样板与 SQL 手工维护。

### 6. 一个工程混用 JPA 与 MyBatis 时必须（6分）

- A. 各开各的事务管理器
- B. 统一事务管理器与数据源，避免两套 Session 割裂导致不回滚
- C. 关闭 Spring 事务
- D. 各自用不同连接池

> 答案：B
> 解析：混用（CQRS 倾向：JPA 写、MyBatis 复杂读）须共享同一 Spring 事务/数据源，否则看似一起提交实则各管各。

### 7. `@Transactional` 不生效的典型原因是（6分）

- A. 标在 public 方法
- B. 标在 private 方法或类内自调用，代理不拦截
- C. 抛 RuntimeException
- D. 用 MyBatis

> 答案：B
> 解析：Spring 事务基于代理，private 或同类自调用绕过代理导致事务静默失效；默认对 RuntimeException 回滚。

### 8.（多选）JPA 相对 MyBatis 的典型短板有（9分）

- A. 生成的 SQL 黑盒、不易精确调优
- B. 复杂报表/多表统计 SQL 难表达
- C. 需要关注 N+1 与抓取策略
- D. 支持实体托管与脏检查

> 答案：A、B、C
> 解析：D 是 JPA 的优势而非短板；A/B/C 是其以对象为中心带来的取舍代价。

### 9.（多选）关于动态数据源/读写分离，正确的有（9分）

- A. determineCurrentLookupKey 从 ThreadLocal 取路由 key
- B. @Transactional(readOnly=true) 可作读写路由线索
- C. 异步/嵌套线程丢 ThreadLocal 会导致路由错乱
- D. 事务中途可随意切库

> 答案：A、B、C
> 解析：D 错误——事务开启后连接绑定，中途切库无效。

### 10. 团队纠结"全用 JPA 还是全用 MyBatis"，还要引入读写分离与多租户。请给出选型与整合方案。（40分）

> 参考答案：
- 要点1：按中心决策选型——领域复杂、对象为中心、CRUD 规整选 JPA；DBA 主导、复杂查询/报表/批量、要精细 SQL 与方言选 MyBatis；不必非此即彼（10分）
- 要点2：混用策略（CQRS 倾向）——JPA 管写模型、MyBatis 管复杂读/报表，但必须统一 Spring 事务管理器与数据源，防两套 Session 不回滚（10分）
- 要点3：Spring 整合——mybatis-spring-boot-starter + @MapperScan + SqlSessionTemplate 复用事务，@Transactional 注意别标 private/自调用（10分）
- 要点4：读写分离/多租户——AbstractRoutingDataSource 在事务开启前按 ThreadLocal key 路由，异步/嵌套注意上下文丢失；黑盒扛不住的复杂 SQL 交给 MyBatis 兜底（10分）
