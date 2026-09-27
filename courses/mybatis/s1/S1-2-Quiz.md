# 小测验：动态 SQL、resultMap 与插件原理

### 1. MyBatis 动态 SQL 的 test 属性使用什么表达式语言？（10分）
- A. SpEL
- B. OGNL
- C. JUEL
- D. MVEL
> 答案：B
> 解析：MyBatis 使用 OGNL（Object-Graph Navigation Language）解析 test 条件表达式。

### 2. `<where>` 标签的自动处理逻辑是？（10分）
- A. 只在第一个条件前加 WHERE，自动去除后续 AND
- B. 如果子节点有内容输出，在最前面加 WHERE 并去除第一个前导 AND/OR
- C. 始终输出 WHERE 关键字
- D. 不处理 AND/OR，只加 WHERE
> 答案：B
> 解析：WhereSqlNode 继承 TrimSqlNode，配置了 prefix="WHERE" + prefixesToOverride="AND |OR "。

### 3. 以下哪种写法存在 SQL 注入风险？（10分）
- A. `WHERE id = #{id}`
- B. `ORDER BY ${sortColumn}`
- C. `WHERE name LIKE CONCAT('%', #{keyword}, '%')`
- D. `IN <foreach collection="ids" item="i" open="(" close=")" separator=",">#{i}</foreach>`
> 答案：B
> 解析：`${}` 是字符串直接拼接不做预编译，如果 sortColumn 来自用户输入则可注入。`#{}` 用占位符安全。

### 4. resultMap 中 `<association>` 和 `<collection>` 分别用于？（10分）
- A. 一对一；一对多
- B. 多对一；多对多
- C. 一对一；多对多
- D. 嵌套查询；嵌套结果
> 答案：A
> 解析：association 映射嵌套对象（一对一/多对一）；collection 映射嵌套集合（一对多）。

### 5. MyBatis 插件可以拦截的四大对象不包括？（10分）
- A. Executor
- B. StatementHandler
- C. SqlSessionFactory
- D. ResultSetHandler
> 答案：C
> 解析：@Intercepts 的 @Signature type 只能是 Executor/StatementHandler/ParameterHandler/ResultSetHandler。

### 6. 嵌套查询 select 方式的主要问题是？（10分）
- A. 不能处理一对一
- B. N+1 查询问题
- C. 不支持 resultMap
- D. 无法使用 TypeHandler
> 答案：B
> 解析：查 100 个用户 + 每用户关联查一次订单 = 1+100 次 SQL；默认非延迟加载时必然 N+1。

### 7. 判断："MyBatis 插件链中先注册的插件先执行。"（5分）
- A. 正确
- B. 错误
> 答案：B
> 解析：pluginAll 从后往前包装代理，所以最后注册的插件最外层——先被执行。

### 8. 以下关于 `<foreach>` 的说法，正确的有？（多选，10分）
- A. 可用于 IN 条件生成 `(?,?,?)`
- B. 可用于批量 INSERT 拼接多组 VALUES
- C. item 变量名必须与 Java 参数名一致
- D. index 属性在 List 中是索引、在 Map 中是 key
> 答案：A、B、D
> 解析：C 错误——item 是在 foreach 内部引用的别名，与 Java 参数名无关。

### 9. 简答题：描述 MyBatis 分页插件（如 PageHelper）的工作原理，包括如何改写 SQL 和执行 count。（15分）
> 参考答案：
> - 拦截 Executor.query：用 ThreadLocal 传入分页参数（pageNum/pageSize）
> - 第一次执行：把原 SQL 包装为 `SELECT COUNT(0) FROM (原SQL) tmp` 获取总数
> - 第二次执行：改写原 SQL 加 `LIMIT offset, size`（方言适配 Oracle 用 ROWNUM）
> - 返回 Page<T> 对象（继承 ArrayList 附带 total/pageNum/pages 属性）
> - 通过 MetaObject 反射修改 BoundSql.sql 实现改写

### 10. 简答题：resultMap 嵌套结果（JOIN）和嵌套查询（select）各适用什么场景？如何避免 N+1？（10分）
> 参考答案：
> - 嵌套结果（JOIN）：数据量小、关联表少、列不冲突时优先——一次 SQL 拿完
> - 嵌套查询（select）：关联对象只在需要时才加载，适合一对多且子数据量大
> - 避免 N+1：fetchType="lazy" + 全局 lazyLoadingEnabled=true；或改用 JOIN 一次查出
> - 最佳实践：列表页用 JOIN 带少量关联字段；详情页按需用嵌套查询延迟加载
