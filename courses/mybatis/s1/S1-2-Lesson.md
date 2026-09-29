# 动态 SQL、resultMap 与插件原理

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：掌握 MyBatis 动态 SQL 标签的底层解析机制、resultMap 关联映射与嵌套查询的区别，以及 Interceptor 插件的责任链原理与分页/多租户实战。

## 一、动态 SQL 解析机制

### 1.1 SqlSource 类型

- **RawSqlSource**：SQL 固定无动态标签（`#{}` 占位保留为 ?）。
- **DynamicSqlSource**：含 `<if>/<where>/<foreach>` 等动态标签，每次执行都重新解析生成 SQL。

```java
// 目的：DynamicSqlSource 每次 getBoundSql 都走 MixedSqlNode 链求值
// 错误用法: 大量 <if> 嵌套 → 每次查询都遍历整个节点树，CPU 热点
MappedStatement ms = configuration.getMappedStatement("com.example.UserMapper.search");
BoundSql boundSql = ms.getBoundSql(paramMap);  // 结果：动态拼接最终 SQL + 参数映射列表
```

### 1.2 核心标签原理

| 标签 | 实现类 | 作用 |
|------|--------|------|
| `<if>` | IfSqlNode | test 为 true 则 apply 子节点 |
| `<where>` | WhereSqlNode（TrimSqlNode 子类）| 自动去前导 AND/OR + 包裹 WHERE |
| `<set>` | SetSqlNode（TrimSqlNode）| 去末尾逗号 + 包裹 SET |
| `<foreach>` | ForEachSqlNode | 迭代集合，生成 `(?,?,?)` 或自定义 open/close/separator |
| `<choose>` | ChooseSqlNode | if-else 语义，命中第一个 true 即停 |
| `<sql>/<include>` | SQLFragment | 复用 SQL 片段，编译期展开 |
| `<bind>` | BindSqlNode | OGNL 表达式结果绑定为变量（如 LIKE 拼接） |

```xml
<!-- 目的：动态条件查询——根据非空参数拼接 WHERE 子句 -->
<select id="search" resultType="User">
    SELECT id, name, age FROM users
    <where>  <!-- 结果：自动去除前导 AND；有内容才加 WHERE -->
        <if test="name != null and name != ''">
            AND name LIKE CONCAT('%', #{name}, '%')  <!-- #{} 防注入 -->
        </if>
        <if test="minAge != null">
            AND age >= #{minAge}
        </if>
        <choose>
            <when test="orderById">ORDER BY id DESC</when>
            <otherwise>ORDER BY create_time DESC</otherwise>
        </choose>
    </where>
</select>
```

### 1.3 OGNL 表达式

`test` 属性用 OGNL（Object-Graph Navigation Language）求值：`name != null and name.length() > 0`。注意：单个字符 `'y'` 会被解析为 char 而非 String。

## 二、resultMap 映射

### 2.1 基本映射

```xml
<resultMap id="userMap" type="User">
    <id column="id" property="id" jdbcType="BIGINT"/>  <!-- 结果：主键标记，用于区分行 -->
    <result column="user_name" property="name"/>       <!-- 列名≠属性名时显式映射 -->
</resultMap>
```

### 2.2 关联映射：association vs collection

```xml
<!-- 目的：一对一关联——Order 中包含 User 对象 -->
<resultMap id="orderMap" type="Order">  <!-- 说明：type 指定顶层 Java 类型 -->
    <id column="order_id" property="id"/>  <!-- 结果：主键映射，用于区分行 -->
    <association property="user" javaType="User">  <!-- 结果：嵌套对象映射 -->
        <id column="user_id" property="id"/>
        <result column="user_name" property="name"/>  <!-- 列名≠属性名时必须显式映射 -->
    </association>
</resultMap>

<!-- 目的：一对多——User 包含 List<Order> -->
<resultMap id="userWithOrders" type="User">
    <id column="user_id" property="id"/>
    <collection property="orders" ofType="Order">  <!-- 结果：嵌套集合，ofType 指定元素类型 -->
        <id column="order_id" property="id"/>
        <result column="amount" property="amount"/>
    </collection>
</resultMap>
```

### 2.3 JOIN vs 嵌套查询（N+1）

| 方式 | 配置 | 优点 | 缺点 |
|------|------|------|------|
| 嵌套结果（JOIN）| resultMap + 多列 | 一次 SQL 拿到所有数据 | 行膨胀、列名冲突 |
| 嵌套查询（select）| `<association select="...">` | SQL 简洁 | N+1 问题（默认）|

```xml
<!-- 目的：嵌套查询 + lazyLoading 延迟加载避免 N+1 -->
<!-- 错误用法: fetchType="lazy" 但全局 lazyLoadingEnabled=false → 不生效 -->
<!-- 说明：column="user_id" 把父查询列值作为子查询参数传入 -->
<association property="user" column="user_id" select="getUserById" fetchType="lazy"/>
```

## 三、插件（Interceptor）原理

### 3.1 责任链与四大可拦截对象

```java
// 目的：MyBatis 插件通过 JDK 动态代理包装四大对象
// 可拦截：Executor / StatementHandler / ParameterHandler / ResultSetHandler
// 错误用法: 拦截 Executor.update 改 SQL → update 走 update 方法不走 query
@Intercepts({
    @Signature(type = StatementHandler.class, method = "prepare", args = {Connection.class, Integer.class})
})
public class PageInterceptor implements Interceptor { ... }
```

插件链构建：`InterceptorChain.pluginAll(target)` → 从后往前逐层 Plugin.wrap → 最终对象被多层代理。

### 3.2 分页插件实战（PageHelper 原理）

```java
// 目的：拦截 StatementHandler.parameterize → 改写 BoundSql 加 LIMIT
// 结果：原 SQL SELECT * FROM users → SELECT * FROM users LIMIT 0, 10
// 反例: 不 count 直接返回 total=0 → 前端分页控件失效
// 说明：PageHelper 先执行 count SQL 再拼 LIMIT，两次查询
public class SimplePageInterceptor implements Interceptor {
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        StatementHandler handler = (StatementHandler) invocation.getTarget();
        BoundSql boundSql = handler.getBoundSql();
        String newSql = boundSql.getSql() + " LIMIT 0, 10";  // 简化演示
        MetaObject metaObject = SystemMetaObject.forObject(boundSql);
        metaObject.setValue("sql", newSql);  // 结果：反射修改 SQL 文本
        return invocation.proceed();
    }
}
```

### 3.3 多租户插件

- 拦截 Executor.query → 获取 BoundSql → 在 WHERE 后追加 `AND tenant_id = ?`。
- 从 ThreadLocal / SecurityContext 获取当前租户 ID。
- 典型框架：MyBatis-Plus TenantLineInnerInterceptor（基于 JSqlParser 改写 SQL）。

## 四、常见坑与最佳实践

- `${}` 不预编译：仅用于表名/列名（白名单校验），值永远用 `#{}`。
- `<if test="status != ''">`：Integer 0 会被判为空（OGNL 规则），改用 `status != null`。
- `<foreach>` 拼接超长 SQL：MySQL max_allowed_packet 默认 4MB，百万 IN 需分批。
- resultMap 列名冲突：JOIN 多表同名列必须用 columnPrefix 或别名。
