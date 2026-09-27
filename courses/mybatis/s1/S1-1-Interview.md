# 面试题：MyBatis 执行流程与一级二级缓存

## 高频面试题

### Q1：描述 MyBatis 一条 SQL 的完整执行流程。

**答题要点**：
- SqlSessionFactory.openSession → 创建 DefaultSqlSession + Executor
- SqlSession.selectList → MappedStatement 获取 SQL 与配置
- CachingExecutor 查二级缓存 → BaseExecutor 查一级缓存（CacheKey）
- 未命中 → doQuery：newStatementHandler → Connection.prepareStatement → ParameterHandler.setParameters → execute
- ResultSetHandler 按 ResultMap + TypeHandler 映射结果
- 写入缓存返回

**追问方向**：SqlSession 是线程安全的吗？（答：不是，DefaultSqlSession 内部有 Executor 状态；Spring 用 SqlSessionTemplate 代理保证线程安全）

### Q2：一级缓存和二级缓存的区别？

**答题要点**：
- 一级：SqlSession 级别，默认开启不可关闭；同一 Session 相同查询命中
- 二级：namespace 级别，需配置 `<cache/>`；跨 SqlSession 共享（同一 namespace）
- 一级存对象引用（同一实例）；二级可配 readOnly 决定是否序列化
- 一级失效：SqlSession.close/clearCache/同 Session 内 update
- 二级失效：同 namespace commit 后 update/flushInterval/size 淘汰

**追问方向**：Spring 集成下一期缓存还生效吗？（答：同一事务内 SqlSessionTemplate 复用同一 SqlSession → 一级缓存生效；不同事务不同 SqlSession → 不生效）

### Q3：MyBatis 如何防止 SQL 注入？

**答题要点**：
- `#{}` 预编译占位符：生成 `?` → PreparedStatement.setXxx，参数不进 SQL 文本
- `${}` 字符串拼接：直接替换到 SQL → 有注入风险
- 动态表名/列名必须用 `${}` 时需在 Java 层做白名单校验
- `<foreach>` 批量操作内部仍用 `#{}` 占位

**追问方向**：`#{}` 底层怎么实现的？（答：解析为 ParameterMapping → GenericTypeHandler.setParameter → ps.setObject(index, value)）

### Q4：MyBatis 的架构分几层？每层的核心接口？

**答题要点**：
- API 层：SqlSession + Mapper 接口（用户直接使用）
- 参数与结果处理层：TypeHandler + ResultSetHandler
- 执行层：Executor + StatementHandler
- 配置层：Configuration + MappedStatement + SqlSource（StaticSqlSource/DynamicSqlSource）
- 插件层：Interceptor（责任链，环绕 Executor/StatementHandler/ParameterHandler/ResultSetHandler）

**追问方向**：为什么 Mapper 接口没有实现类也能用？（答：MapperProxy（JDK 动态代理）拦截所有方法调用 → 根据方法全限定名找 MappedStatement → 调 SqlSession）

### Q5：批量插入有哪些方式？性能差异？

**答题要点**：
- 循环 SqlSession.insert（SimpleExecutor）：每条一次网络+prepare，最慢
- SqlSession(ExecutorType.BATCH) + flushStatements：攒批后 executeBatch，JDBC 层减少交互
- `<foreach>` 拼接 `INSERT INTO t VALUES (...),(...)`：单条大 SQL，DB 一次解析
- 性能：BATCH ≈ foreach >> Simple；foreach 受 max_allowed_packet 限制

**追问方向**：BatchExecutor 一级缓存怎么处理？（答：update 语句使一级缓存全部清空，批量执行时缓存意义不大）

### Q6：SqlSession 与 Connection 的关系？

**答题要点**：
- 一个 SqlSession 持有一个 Executor → Executor 持有一个 Connection（懒获取）
- Connection 从 DataSource 获取（Spring 下由事务管理器管理）
- SqlSession.close → Executor.close → 归还 Connection（连接池模式下不真关）
- 非 Spring 环境需手动 openSession → 操作 → commit/close

**追问方向**：如果 SqlSession 不 close 会怎样？（答：连接泄漏、一级缓存内存增长、事务未提交持锁）

### Q7：MyBatis 的 TypeHandler 扩展点怎么用？

**答题要点**：
- 场景：数据库存 JSON 字符串 → 映射为 Java List/Object；枚举 → 数据库 tinyint
- 实现：自定义 TypeHandler 泛型 → 注册到 Configuration 或 XML typeHandler 属性
- MyBatis 3.4.5+ 内置 `ObjectTypeHandler`；Jackson TypeHandler 社区库
- 注解方式：`@MappedTypes` + `@MappedJdbcTypes`

**追问方向**：数据库存逗号分隔字符串映射为 List<String>？（答：自定义 TypeHandler 在 setParameter 时 join、getResult 时 split）

### Q8：MyBatis 与 JPA/Hibernate 的对比？

**答题要点**：
- MyBatis：半自动 ORM，SQL 由开发者控制，灵活度高
- JPA：全自动 ORM，实体映射+自动生成 SQL，快速开发 CRUD
- 复杂查询/存储过程/批量：MyBatis 更适合
- 领域模型/聚合根/DDD：JPA 实体状态机有天然优势
- 学习曲线：JPA 入门快精通难（N+1、脏检查陷阱）；MyBatis 门槛低但重复代码多

**追问方向**：你的项目如何选型？（答：互联网/高频 SQL 调优 → MyBatis；企业 CRUD 密集 + 领域建模 → JPA 或两者混合）
