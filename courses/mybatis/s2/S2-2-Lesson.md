# 插件机制与拦截器实战

> 本节难度：★★★★★
> 重要程度：★★★★☆
> 学习产出：能吃透 MyBatis 插件（Interceptor）的运行机制并手写实用的分页/多租户插件。MyBatis 只在四个对象上开放了可拦截的"接缝"，即 **四大拦截点**：`Executor`（update/query/flushCache，缓存与调度层）、`StatementHandler`（prepare/parameterize/batch，SQL 语句准备）、`ParameterHandler`（setParameters，参数设值）、`ResultSetHandler`（handleResultSets，结果映射）。拦截器实现 `Interceptor`（`intercept`/`plugin`/`setProperties`）+ `@Intercepts({@Signature(type,method,args)})` 声明拦谁、拦哪个方法；`plugin()` 里用 `Plugin.wrap(target, this)` 生成**动态代理**把目标层层包起来，多个插件按配置顺序**责任链式**从外到内嵌套。手写分页插件的典型做法：拦 `Executor.query`，取出原 `BoundSql` 与 `RowBounds`，改写 SQL 追加 `LIMIT ? OFFSET ?`（或用 `StatementHandler.prepare` 改语句）、先跑 count 再跑数据查询；多租户插件则在 SQL 上自动拼接 `tenant_id = ?` 条件。要理解 **`intercept` 里 Invocation 的 proceed 机制**、属性注入 `setProperties`、以及"改 SQL 要处理 count 与 order by、别名、子查询"的边界。MyBatis-Plus 的分页/多租户/乐观锁/防全表更新都是这套拦截器机制的工业级实现。识破"忘写 @Signature 拦截不生效""直接字符串拼 LIMIT 未参数化注入风险""分页未先关原 order by 导致 count 慢""插件顺序错让结果被覆盖"等坑。

## 一、四大拦截点与责任链

```text
图目的：MyBatis 只在这四个对象开接缝, 插件按配置顺序包成代理链
Executor:          update/query/flushCache —— 缓存与调度层(分页插件常拦这里)
StatementHandler:  prepare/parameterize/batch —— SQL 准备(改语句/加 LIMIT)
ParameterHandler:  setParameters —— 参数设值(注入租户参数)
ResultSetHandler:  handleResultSets —— 结果映射(脱敏/字段改写)
链式: plugin() 用 Plugin.wrap 生成动态代理, 多插件从外到内嵌套, 顺序影响最终行为
```

## 二、手写一个最小可用的拦截器

```java
// 目的：声明式拦截 Executor.query, 演示分页插件骨架(改写 SQL 追加 LIMIT)
@Intercepts(@Signature(type = Executor.class, method = "query",
        args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}))
public class PageInterceptor implements Interceptor {
    public Object intercept(Invocation inv) throws Throwable {   // 说明：proceed() 前可改参数/SQL, 之后可改结果
        RowBounds rb = (RowBounds) inv.getArgs()[2];
        if (rb != RowBounds.DEFAULT) {                            // 结果：命中分页则把 LIMIT 拼进 BoundSql 再放行
            rewriteLimit(inv.getArgs()[0], rb);                   // 目的：物理分页, 避免内存假分页全量捞
            rb = RowBounds.DEFAULT;
        }
        return inv.proceed();                                     // 反例：不判 DEFAULT 直接改 SQL ❌ 非分页查询被破坏
    }
    public Object plugin(Object t) { return Plugin.wrap(t, this); }  // 说明：按需生成代理, 未声明签名则原样返回
    public void setProperties(Properties p) { /* 方言等配置注入 */ }
}
// 反例：只写类不加 @Intercepts/@Signature ❌ MyBatis 不知拦谁, 插件静默不生效 ❌
```

## 三、分页与多租户的落地要点

```text
图目的：把拦截点用起来——两类最常用工业插件
分页: 拦 Executor.query → 先 count(去掉 order by, 包一层 SELECT count) → 再按方言拼 LIMIT/OFFSET(参数化)
多租户: 在 StatementHandler/BoundSql 阶段给 SELECT/UPDATE/DELETE 自动加 WHERE tenant_id=? → 防越权串数据
边界: count 与数据查询都要正确处理别名/子查询/无 where; 方言差异(Oracle rownum vs MySQL limit)
```

## 四、坑与底线

- **改 SQL 必参数化**：LIMIT/OFFSET、租户 ID 走占位符绑定，别裸字符串拼接，防注入与语法错。
- **插件顺序与幂等**：多插件嵌套时，改 SQL 的插件先后顺序会影响最终语句；上线前用真实语句验证不被重复/覆盖改写。

## 五、关联课程

执行流程与 Executor/缓存层次见 [MyBatis 执行流程与一级二级缓存](../s1/S1-1-Lesson.md)；动态 SQL 与 resultMap（拦截器改写的对象来源）承接 [动态 SQL、resultMap 与插件原理](../s1/S1-2-Lesson.md)；MyBatis-Plus 内置分页/乐观锁插件正是本机制的实现，见 [MyBatis-Plus 工程提效](../s1/S1-3-Lesson.md)；结果集阶段脱敏改写与结果映射相关，见 [类型处理器、结果映射与关联查询](./S2-1-Lesson.md)。
