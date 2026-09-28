# 插件机制与拦截器实战 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. MyBatis 插件可拦截的"四大对象"是（6分）

- A. SqlSession、Mapper、Result、Config
- B. Executor、StatementHandler、ParameterHandler、ResultSetHandler
- C. Connection、Statement、ResultSet、Driver
- D. Filter、Interceptor、Listener、Servlet

> 答案：B
> 解析：MyBatis 只在这四个对象的特定方法上开放拦截接缝，分别在调度/SQL 准备/参数设值/结果映射阶段。

### 2. 声明一个拦截器"拦谁、拦哪个方法"靠的是（6分）

- A. 配置文件 plugin=类名
- B. `@Intercepts` + `@Signature(type, method, args)`
- C. 实现 Serializable
- D. 方法命名约定

> 答案：B
> 解析：@Signature 精确指定被拦截对象类型、方法名与参数签名；只写实现类不加签名，插件静默不生效。

### 3. `plugin()` 方法里 `Plugin.wrap(target, this)` 的作用是（6分）

- A. 执行 SQL
- B. 用动态代理把目标对象包起来，命中签名才拦截、否则原样返回
- C. 关闭连接
- D. 解析 resultMap

> 答案：B
> 解析：wrap 生成代理织入拦截逻辑；多插件按配置顺序从外到内形成责任链，代理只对声明的签名生效。

### 4. `Invocation.proceed()` 的语义是（6分）

- A. 中断执行
- B. 放行调用真实目标方法，proceed 前可改参数/SQL、后可改返回结果
- C. 回滚事务
- D. 重新解析 SQL

> 答案：B
> 解析：proceed 执行被代理的真实方法；拦截器正是靠"前后插手"实现改写 SQL、注入参数、脱敏结果。

### 5. 手写物理分页插件通常拦哪个点、做什么？（6分）

- A. 拦 ResultSetHandler，截断行数
- B. 拦 Executor.query，先 count 再按方言改写 SQL 追加 LIMIT/OFFSET
- C. 拦 Connection，限制连接数
- D. 用 RowBounds 内存分页即可

> 答案：B
> 解析：物理分页要改写 SQL 追加 LIMIT；RowBounds 是内存假分页会全量捞，不是真正的物理分页。

### 6. 多租户插件的核心动作是（6分）

- A. 按租户分库连接
- B. 在 SQL 上自动为 SELECT/UPDATE/DELETE 追加 `WHERE tenant_id=?`，防越权串数据
- C. 给表改名
- D. 加密数据

> 答案：B
> 解析：多租户拦截器在语句准备阶段统一注入租户条件，让业务 SQL 无需手写也不串数据。

### 7. 分页插件计算 count 时的正确处理是（6分）

- A. 直接对原带 order by 的 SQL count
- B. 去掉 order by、按需要包一层 SELECT count，避免慢与语法问题
- C. 不查 count
- D. count 用 LIMIT 1

> 答案：B
> 解析：保留 order by 做 count 会拖慢且某些方言报错；工业分页插件会清理 order by、处理别名/子查询后再 count。

### 8.（多选）关于拦截器改 SQL，正确的做法有（9分）

- A. LIMIT/租户 ID 用占位符参数化绑定
- B. 上线前用真实语句验证插件顺序不会重复/覆盖改写
- C. 直接字符串拼用户输入进 LIMIT
- D. 处理 count 时清理无谓 order by

> 答案：A、B、D
> 解析：C 有注入与语法风险，是错误做法；A/B/D 是稳妥工程实践。

### 9.（多选）下列哪些是 MyBatis-Plus 用拦截器机制实现的工业功能？（9分）

- A. 分页插件
- B. 多租户插件
- C. 乐观锁插件
- D. 依赖注入 Bean

> 答案：A、B、C
> 解析：分页/多租户/乐观锁/防全表更新都是拦截器实现；D 属 Spring 容器职责，不是 MyBatis 插件。

### 10. 为一个 SaaS 系统实现"分页 + 多租户"两个 MyBatis 插件，要求互不破坏、防注入、count 正确。请给出方案。（40分）

> 参考答案：
- 要点1：拦点选择——分页拦 Executor.query（或 StatementHandler.prepare 改语句），多租户在语句准备阶段给 SELECT/UPDATE/DELETE 加 tenant_id=?；各自 @Signature 精确声明方法与参数（10分）
- 要点2：责任链与顺序——用 Plugin.wrap 织入代理，明确两插件先后顺序并用真实 SQL 验证改写不被覆盖/重复（proceed 前后插手）（10分）
- 要点3：分页正确性——先 count（清理 order by、处理别名/子查询、按方言），再参数化拼 LIMIT/OFFSET；拒绝 RowBounds 内存假分页（10分）
- 要点4：安全底线——LIMIT/租户 ID 一律占位符绑定不裸拼字符串，防注入；上线前对典型语句回归验证（10分）
