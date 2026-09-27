# 小测验：MyBatis 执行流程与一级二级缓存

### 1. MyBatis 一级缓存的作用域是？（10分）
- A. 全局（SqlSessionFactory 级别）
- B. SqlSession 级别
- C. Mapper namespace 级别
- D. 线程级别
> 答案：B
> 解析：一级缓存（PerpetualCache）绑定在 SqlSession 内的 BaseExecutor 中，SqlSession 关闭则缓存消失。

### 2. 以下哪个不是 MyBatis Executor 类型？（10分）
- A. SimpleExecutor
- B. BatchExecutor
- C. CachingExecutor
- D. StreamExecutor
> 答案：D
> 解析：MyBatis 有 Simple/Reuse/Batch 三种基本 Executor + CachingExecutor 装饰器；没有 StreamExecutor。

### 3. 二级缓存在什么情况下会失效？（多选，10分）
- A. 同一 namespace 执行了 update 并 commit
- B. 达到 flushInterval 设定的时间
- C. 任何 namespace 执行了 delete
- D. 缓存条目数达到 size 上限（按淘汰策略）
> 答案：A、B、D
> 解析：C 错误——只有同一 namespace 内的增删改才 flush 该 namespace 的二级缓存；跨 namespace 不互相失效。

### 4. 一级缓存的 key 不包含以下哪个信息？（10分）
- A. MappedStatement 的 id
- B. SQL 语句文本
- C. 数据库连接 URL
- D. 查询参数
> 答案：C
> 解析：一级缓存 CacheKey = statementId + RowBounds + SQL + 参数列表；不包含连接 URL。

### 5. 在 Spring 集成下，两次 Mapper 调用何时共享同一个 SqlSession？（10分）
- A. 同一个 Controller 方法中
- B. 同一个 @Transactional 方法中
- C. 同一个 HTTP 请求中
- D. 任何时候都共享
> 答案：B
> 解析：SqlSessionTemplate 通过 Spring 事务管理器绑定 SqlSession 到当前事务；同一事务内复用同一 SqlSession，一级缓存生效。

### 6. MyBatis 执行 SQL 时，StatementHandler 在哪里被创建？（10分）
- A. SqlSessionFactory 初始化时
- B. SqlSession.openSession 时
- C. Executor.doQuery 时
- D. Configuration 解析 XML 时
> 答案：C
> 解析：每次执行查询/更新时，Executor 通过 Configuration.newStatementHandler 创建 StatementHandler。

### 7. 判断："MyBatis 二级缓存默认开启，无需配置。"（5分）
- A. 正确
- B. 错误
> 答案：B
> 解析：全局 cacheEnabled 默认 true，但必须在 Mapper XML 中声明 `<cache/>` 标签该 namespace 才真正启用二级缓存。

### 8. 以下关于 CachingExecutor 的描述，正确的有？（多选，10分）
- A. 它是装饰器模式，包装在 SimpleExecutor 外面
- B. 它管理一级缓存
- C. 它管理二级缓存（TransactionalCacheManager）
- D. 关闭二级缓存时它仍然存在但不做缓存操作
> 答案：A、C、D
> 解析：B 错误——一级缓存由内部被装饰的 BaseExecutor 管理；CachingExecutor 只负责二级缓存层。

### 9. 简答题：描述 MyBatis 从 selectList 调用到最终返回 Java 对象的完整执行链路。（15分）
> 参考答案：
> - SqlSession.selectList → CachingExecutor.query（先查二级缓存 TransactionalCacheManager）
> - 未命中 → BaseExecutor.query（查一级缓存 PerpetualCache，CacheKey 包含 stmtId+SQL+参数）
> - 未命中 → doQuery：创建 StatementHandler → 获取 Connection → Prepare Statement
> - ParameterHandler.setParameters 填充参数（通过 TypeHandler 转换）
> - Statement.execute 得到 ResultSet
> - ResultSetHandler.handleResultSets：按 ResultMap + TypeHandler 映射每列为对象属性
> - 结果写入一级缓存（和二级缓存待 commit 后写入）→ 返回

### 10. 简答题：为什么生产环境通常建议关闭 MyBatis 二级缓存？给出至少 3 个理由。（10分）
> 参考答案：
> - 分布式部署下各 JVM 本地缓存互不感知，数据不一致
> - 跨 namespace 不互相 flush：多表关联查询可能读到脏数据
> - readOnly=false 需要对象序列化 clone，性能开销大且对象必须 Serializable
> - 淘汰策略简单（仅 FIFO/LRU/SOFT/WEAK），不如 Redis/Caffeine 灵活
> - 维护成本高：需要精确配置 flush 关系，不如上层统一用分布式缓存方案
