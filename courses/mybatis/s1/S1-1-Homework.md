# 课后作业：MyBatis 执行流程与一级二级缓存

## 作业 1：执行流程源码追踪（40分）

环境：下载 MyBatis 3.5.x 源码，用 IDEA Debug 跟踪。

要求：
1. 从 `DefaultSqlSession.selectList()` 开始，设置断点，逐步跟踪到 JDBC `PreparedStatement.execute()` 被调用。画出调用栈（至少 8 层）。
2. 找到一级缓存 `PerpetualCache` 被读取的代码行，记录 CacheKey 的 `update()` 方法接收了哪些参数。
3. 找到 CachingExecutor 中 `TransactionalCacheManager` 拦截写入的代码，说明为什么未 commit 前缓存对其他 SqlSession 不可见。
4. 观察插件链（Interceptor Chain）在哪里构建，写出 `Plugin.wrap(target, interceptorChain)` 的调用位置。

## 作业 2：缓存陷阱复现（30分）

要求：用 Spring Boot + MyBatis 复现以下问题并给出解决方案：
1. **一级缓存脏读**：在同一个 Service 方法（无 @Transactional）中调用两次 `userMapper.selectById(1)`，中间用原生 JDBC UPDATE name='changed'。观察第二次是否读到旧值？为什么？
2. **二级缓存跨 namespace 脏读**：UserMapper 和 OrderMapper 都缓存了 User 信息，UserMapper.updateUser 后 OrderMapper 的缓存未失效。复现并修复。
3. **readOnly=true 引用污染**：开启 readOnly=true，从缓存取出对象修改属性后，再次取出发现值被污染。解释原因。

## 作业 3：Executor 选型与性能对比（30分）

场景：需要批量插入 100 万条数据。

要求：
1. 分别用 SimpleExecutor（逐条 insert）、BatchExecutor、`<foreach>` 拼接多值 INSERT 实现，记录耗时与内存。
2. 分析为什么 BatchExecutor 比逐条快：对比 JDBC addBatch 与每次 prepare/execute/close 的开销。
3. 讨论 ReuseExecutor 在循环执行相同 SQL 时一级缓存与 Statement 复用的交互效果。
4. 写结论：什么场景用什么 Executor 最合适？
