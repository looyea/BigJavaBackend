# 面试题：动态 SQL、resultMap 与插件原理

## 高频面试题

### Q1：MyBatis 动态 SQL 的实现原理是什么？

**答题要点**：
- XML 解析阶段：ScriptSqlSource / DynamicSqlSource 持有 SqlNode 列表（IfSqlNode/ForEachSqlNode/TextSqlNode 等）
- 运行时：每次 getBoundSql 遍历 SqlNode 链，对参数对象做 OGNL 求值决定拼接
- `<where>` 等标签通过 FilteredDynamicContext 实现前缀/后缀裁剪
- 最终生成含 `?` 的 SQL 文本 + ParameterMapping 列表

**追问方向**：为什么动态 SQL 不能缓存最终 SQL？（答：不同参数组合产生不同 SQL 文本；RawSqlSource 才可缓存）

### Q2：`#{}` 和 `${}` 的区别？各适用什么场景？

**答题要点**：
- `#{}`：预编译占位符 → JDBC `?` → setXxx → 防 SQL 注入；不能用于表名/列名
- `${}`：字符串直接替换 → 可用于动态 ORDER BY / 表名 / schema 名；有注入风险
- 最佳实践：`#{}` 处理值；`${}` 处理结构（必须白名单校验）

**追问方向**：`#{list[0].name}` 这种写法怎么解析的？（答：MyBatis 反射获取 list.get(0).getName()，按 TypeHandler 设为 ?）

### Q3：MyBatis 的 resultMap 中 `<association>` 延迟加载的实现原理？

**答题要点**：
- 配置 lazyLoadingEnabled=true + fetchType="lazy"
- ResultSetHandler 构造代理对象（Javassist 生成子类），属性被访问时触发后续 select 查询
- 未访问则不发 SQL——解决 N+1
- 限制：代理只对 getter 有效；序列化可能触发加载；一级缓存可能导致延迟失效

**追问方向**：延迟加载与 Spring @Transactional 的交互问题？（答：事务外访问 lazy 属性 → SqlSession 已关闭 → LazyInitializationException；需在事务内访问或改用 JOIN FETCH）

### Q4：MyBatis 插件的链式代理机制？

**答题要点**：
- Configuration 持有 InterceptorChain（List<Interceptor>）
- 创建四大对象时调 `interceptorChain.pluginAll(target)` → 逐层 Plugin.wrap(JDK 动态代理)
- 最终对象是 N 层代理包装；调用方法时从外层到内层依次 intercept
- 最后注册的插件在最外层 → 先执行 intercept

**追问方向**：如何在插件中获取原始对象（剥掉代理）？（答：MetaObject/系统反射 `target.target.target...` 逐层取 h.target）

### Q5：分页插件需要解决哪些方言问题？

**答题要点**：
- MySQL：`LIMIT offset, size`
- Oracle：`SELECT * FROM (SELECT a.*, ROWNUM rn FROM (...) a WHERE ROWNUM <= end) WHERE rn > start`
- SQL Server：`OFFSET x ROWS FETCH NEXT y ROWS ONLY`（2012+）；旧版 `TOP + NOT IN`
- 自动检测方言：通过 `Connection.getMetaData().getDatabaseProductName()`
- count 优化：去掉 ORDER BY / SELECT 列改为 COUNT(0)；复杂子查询不优化

**追问方向**：PageHelper 为什么用 ThreadLocal 传分页参数？（答：拦截 Executor.query 时没有额外入口传参，ThreadLocal 是"请求上下文"最简单的方式；必须在 finally 清除防内存泄漏）

### Q6：MyBatis 如何做逻辑删除 + 自动填充创建时间？

**答题要点**：
- 原生 MyBatis：SQL 手写 `WHERE deleted=0`；INSERT 时写 `create_time = NOW()`
- 自动填充：MyBatis-Plus 的 @TableField(fill=INSERT) + MetaObjectHandler
- 逻辑删除：@TableLogic 注解 + 配置自动在查询追加 `deleted=0`；delete → UPDATE SET deleted=1
- 纯 MyBatis 方案：自定义 Interceptor 拦截 Executor.update 改写 SQL

**追问方向**：逻辑删除对唯一索引有什么影响？（答：deleted 记录仍占唯一索引 → 新建同名记录冲突；解决：唯一索引包含 deleted 字段或用时间戳）
