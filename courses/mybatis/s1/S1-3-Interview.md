# 面试题：MyBatis-Plus 工程提效

## 高频面试题

### Q1：MyBatis-Plus 的 BaseMapper 通用 CRUD 是怎么实现的？

**答题要点**：
- AbstractMapper + DefaultSqlInjector 在启动时动态注入 MappedStatement
- 每个 BaseMapper 方法（insert/selectById/updateById...）对应一个 AbstractMethod 实现
- 运行时根据泛型实体类反射生成表名/列名/字段映射 SQL
- 本质是"批量生成 MyBatis XML 中等价配置的编程式替代"

**追问方向**：如何自定义通用方法？（答：继承 AbstractMethod + 覆盖 injectedSqlSource + 注册到自定义 DefaultSqlInjector）

### Q2：MyBatis-Plus 分页插件的原理？与 PageHelper 有何不同？

**答题要点**：
- MP：InnerInterceptor 拦截 Executor → 改写 BoundSql 加 LIMIT + 自动执行 count SQL
- PageHelper：外层 ThreadLocal 传参 + 拦截 Executor 改写 SQL
- MP 分页用 MybatisPlusInterceptor 统一管理多插件（可叠加乐观锁/逻辑删除/多租户）
- PageHelper 是独立插件，与 MP 生态可能冲突（两者不混用）

**追问方向**：分页 count 很慢怎么优化？（答：手动写轻量 count SQL（MP 支持 `selectPage(page, wrapper, countId)`）；或关闭 count 改前端"下一页"模式）

### Q3：@TableLogic 逻辑删除有哪些注意事项？

**答题要点**：
- 只对 MP 自动生成的 SQL 生效（BaseMapper 方法）；手写 XML 不自动追加条件
- 唯一索引问题：deleted 记录仍占索引 → 唯一索引需包含 deleted 字段
- 查询"所有（含已删除）"需自定义 XML 或用 @InterceptorIgnore
- removeById 返回 true 但实际是 UPDATE，注意语义区分
- 批量删除：removeByIds 生成 `UPDATE SET deleted=1 WHERE id IN (...)`

**追问方向**：逻辑删除后如何物理清理？（答：定时任务手写 DELETE SQL + `WHERE deleted=1 AND update_time < NOW() - INTERVAL 90 DAY`）

### Q4：MyBatis-Plus 的乐观锁在分布式环境下的可靠性？

**答题要点**：
- @Version 依赖 DB 行锁（UPDATE WHERE version=old）保证原子性——单库内可靠
- 分布式多库场景：如果同一行只写同一个 DB 分片，仍可靠
- 不解决 ABA 问题（version 只递增所以无 ABA）
- 更新返回 0 → 业务层自行重试（加指数退避）或直接报错
- 高冲突场景考虑悲观锁 SELECT FOR UPDATE 或无锁设计

**追问方向**：并发冲突率高时乐观锁性能差怎么办？（答：拆分热点行为多行（如余额拆分为 10 份）；或用 CAS + 重试队列；或消息串行化）

### Q5：MyBatis-Plus 的 Active Record 模式为什么团队项目不推荐？

**答题要点**：
- Entity 继承 Model<T> → 实体类持有 SqlSessionFactory 静态引用，与框架强耦合
- 违反单一职责：实体类既做数据载体又做持久化操作
- 单元测试困难：无法 Mock 持久化行为
- 与 DDD/六边形架构中"领域实体不依赖基础设施"原则冲突
- 推荐：Service 层 + Mapper 分离，Entity 是纯 POJO

**追问方向**：什么时候 AR 模式可以用？（答：个人项目/快速原型/极小团队不讲究分层时）

### Q6：MetaObjectHandler 自动填充有哪些坑？

**答题要点**：
- 只对 MP 的 insert/update 方法生效；`jdbcTemplate.update` 或自定义 XML SQL 不触发
- `insertFill` 中 `strictInsertFill` 只填空值字段（已有值不覆盖）；`setFieldValByName` 强制覆盖
- 多线程下 handler 获取当前登录用户：必须用 ThreadLocal/SecurityContext，不能用 static
- 与 @TableLogic 的 update_time 冲突：纯"删除"操作也是 UPDATE → 触发 updateFill（可能不合预期）

**追问方向**：如何只对部分表自动填充？（答：handler 内 `metaObject.getOriginalObject().getClass()` 判断实体类型决定是否填充）

### Q7：MyBatis-Plus 的条件构造器有 SQL 注入风险吗？

**答题要点**：
- 正常的 `.eq(User::getName, input)` → 底层 `#{}` 预编译，安全
- `.last(input)` / `.apply("xxx = " + input)` → 拼接，不安全
- `.orderByDesc(input)` → 列名拼接，需白名单校验
- `.in("column", collection)` → collection 元素用 `#{}` 安全；column 名是字符串不预编译
- 最佳实践：Wrapper 参数只传值不传结构；order by / column 名用枚举映射

**追问方向**：MP 的 `{0}` apply 安全吗？（答：`apply("col = {0}", val)` → 内部替换为 `#{}` 占位，是安全的；`apply("col = " + val)` 才不安全）
