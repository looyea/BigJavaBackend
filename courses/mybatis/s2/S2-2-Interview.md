# 插件机制与拦截器实战 · 面试题

## 题 1：MyBatis 插件能拦截哪些对象？

- 四大对象：Executor、StatementHandler、ParameterHandler、ResultSetHandler。
- 分别对应调度/缓存、SQL 准备、参数设值、结果映射阶段。
- 加分：说出各自可拦的方法（query/update、prepare/parameterize、setParameters、handleResultSets）。

## 题 2：一个拦截器怎么写才生效？

- 实现 Interceptor（intercept/plugin/setProperties）+ `@Intercepts(@Signature(type,method,args))`。
- plugin 里 `Plugin.wrap` 生成动态代理；漏写 @Signature 会静默不生效。
- 加分：讲清 @Signature 的 args 必须和目标方法签名完全一致。

## 题 3：多个插件是怎么串起来的？

- 按配置顺序用 Plugin.wrap 层层包成代理责任链，从外到内嵌套。
- 顺序会影响最终行为，尤其都改 SQL 时。
- 加分：proceed 前改参数/SQL、proceed 后改结果的"前后插手"模型。

## 题 4：物理分页插件的原理？和 RowBounds 区别？

- 拦 Executor.query，先 count 再按方言改写 SQL 加 LIMIT/OFFSET（参数化）。
- RowBounds 是内存假分页——全量捞出再截取，大表致命。
- 加分：count 要去掉 order by、处理别名/子查询，避免慢与方言报错。

## 题 5：多租户插件怎么做？

- 在语句准备阶段给 SELECT/UPDATE/DELETE 自动追加 `tenant_id=?`，租户 ID 参数化绑定。
- 让业务 SQL 不写租户条件也不串数据。
- 加分：INSERT/特殊语句按规则跳过；和分页插件共存时要验证改写顺序不互相覆盖。

## 题 6：改 SQL 的插件要注意什么安全与工程问题？

- 一律占位符参数化，别裸拼字符串——防注入与语法错。
- 明确插件顺序、上线前用真实语句回归，防重复/覆盖改写。
- 加分：点出 MyBatis-Plus 的分页/多租户/乐观锁/防全表更新就是这套拦截器机制的工业实现。
