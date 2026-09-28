# 插件机制与拦截器实战 · 作业

### 作业 1：手写一个物理分页插件

- 目标：拦 `Executor.query`，把带 RowBounds/分页参数的查询改写成方言 `LIMIT/OFFSET` 物理分页。
- 任务：实现 Interceptor + `@Signature`，在 intercept 中取出 BoundSql，先执行 count（去掉 order by、必要时包一层 SELECT count），再按 MySQL 方言追加 `LIMIT ? OFFSET ?`（占位符绑定）。对比开启前后：大表分页不再全量捞。
- 验收标准：非分页查询不被改写（判 DEFAULT）；count 正确且不因 order by 变慢；LIMIT 走参数化无注入；能打印改写后 SQL 自证。
- 参考解法要点：plugin 用 Plugin.wrap；setProperties 配方言；处理无 where/别名/子查询边界。

### 作业 2：多租户插件 + 与分页插件共存

- 目标：给 SELECT/UPDATE/DELETE 自动注入 `tenant_id = ?`，并与分页插件按序协作互不破坏。
- 任务：在语句准备阶段解析并追加租户条件（租户 ID 从上下文/ThreadLocal 取、参数化绑定）。配置分页与多租户两个插件，用若干真实语句验证：既带租户条件又带 LIMIT，改写不被覆盖或重复。
- 验收标准：业务 SQL 不写租户条件也不串数据；两插件顺序明确、结果语句正确；INSERT/特殊语句按规则跳过注入。
- 参考解法要点：责任链嵌套顺序影响最终 SQL；上线前对典型语句回归。

### 作业 3：ResultSetHandler 结果脱敏插件

- 目标：在结果映射阶段对敏感字段（手机号/身份证）自动脱敏。
- 任务：拦 `ResultSetHandler.handleResultSets`，对约定注解或字段名的返回值做掩码处理；验证查询结果里敏感列已脱敏、原始对象无明文散落。
- 验收标准：脱敏在统一插件完成而非散落业务代码；非敏感字段不受影响；可与 TypeHandler 方案对比说明适用场景。
- 参考解法要点：proceed 后遍历结果改写字段；与"类型处理器、结果映射"小节联动比较两种切入点。
