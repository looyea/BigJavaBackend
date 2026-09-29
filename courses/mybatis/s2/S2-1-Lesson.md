# 类型处理器、结果映射与关联查询

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能把数据库列与 Java 属性之间"对不上"的映射，用 MyBatis 的三大机制优雅打通。核心是 **TypeHandler**：定义某个 Java 类型 ↔ JDBC 类型的双向转换（`setParameter` 写、`getResult` 读），用来落枚举、`LocalDateTime`、JSON 对象、逗号分隔集合等——注册方式有全局 `<typeHandlers>`、包扫描、字段级 `jdbcType/typeHandler` 指定、以及 MyBatis-Plus 的 `@TableField(typeHandler=...)`。**结果映射 resultMap** 处理列名≠属性名、主键 `<id>`、普通 `<result>`；**关联查询**用 `<association>`（一对一，如订单→用户）与 `<collection>`（一对多，如订单→明细），各有**嵌套结果**（一条 JOIN SQL + resultMap 自动装配，推荐、无 N+1）与**嵌套查询**（`select`+`column` 延迟加载、简单但易 N+1）两种实现路径。**discriminator** 按某列值把行路由到不同子类型，实现多态映射（如按 type 映射 Payment/Credit/Debit）。要点：嵌套结果要正确声明 `<id>` 以去重聚合行、`collection` 靠主键判定边界；嵌套查询配 `aggressiveLazyLoading`/`fetchType` 控制加载。识破"association 用嵌套查询触发 N+1""枚举 ordinal 漂移导致历史数据错映射""JSON 列 TypeHandler 未指定 jdbcType 写入报 null 类型错""忘配 `<id>` 使一对多装配重复"等坑。

## 一、TypeHandler：定制 Java↔JDBC 转换

```java
// 目的：把 JSON 列直接映射成对象, 读写各转一次, 免去手工序列化
public class JsonTypeHandler<T> extends BaseTypeHandler<T> {
    public void setNonNullParameter(PreparedStatement ps, int i, T p, JdbcType t)
            throws SQLException {
        ps.setString(i, JSON.toJSONString(p));   // 说明：写库——对象序列化成 JSON 字符串再绑定参数
    }
    public T getNullableResult(ResultSet rs, String col) throws SQLException {
        String v = rs.getString(col);            // 结果：读库——字符串反序列化为目标对象, 属性即拿到结构化值
        return v == null ? null : JSON.parseObject(v, type);
    }
    // 其余 getResult 重载同理按列索引/CallableStatement 转换
}
// 反例：枚举不指定持久化策略、按 ordinal 存 int ❌ 一旦枚举顺序调整, 历史数据全部错映射 ❌ 应存 name 或显式 code
```

## 二、association / collection：嵌套结果 vs 嵌套查询

```text
图目的：一对一/一对多两种装配路径的取舍
<association> 一对一(订单→用户) | <collection> 一对多(订单→明细)
嵌套结果(nested): 一条 JOIN + resultMap 自动装配 —— 无 N+1, 推荐; 必须声明 <id> 去重聚合行
嵌套查询(nested select): <collection select=".." column="id"> 分次查 —— 写法简单但易 N+1, 配延迟加载缓解
discriminator: 按列值把行路由到不同子类型, 实现多态结果映射
```

## 三、装配正确性要点

```text
图目的：一对多装配最容易出错的两个开关
① resultMap 里给主表配 <id column="order_id">, 否则聚合行无法定界, 明细会重复/串行
② collection 的每行来自 JOIN 的笛卡尔展开, MyBatis 靠 <id> 判定"是不是同一父对象"
③ JSON/枚举列写入报"未知 jdbcType"→ 显式声明 jdbcType=VARCHAR 或 typeHandler
```

## 四、坑与底线

- **默认偏用嵌套结果**：除非确需延迟加载，别用嵌套查询，一条 JOIN 就能装配的别拆成 N+1 次查询。
- **枚举持久化用稳定值**：存 name 或业务 code，绝不存 ordinal，防止重排破坏历史数据。

## 五、关联课程

映射结果落进缓存边界见 [MyBatis 执行流程与一级二级缓存](../s1/S1-1-Lesson.md)；resultMap 与动态 SQL 的基础用法承接 [动态 SQL、resultMap 与插件原理](../s1/S1-2-Lesson.md)；MyBatis-Plus 里用 `@TableField(typeHandler=...)` 的提效姿势见 [MyBatis-Plus 工程提效](../s1/S1-3-Lesson.md)；ResultSet 阶段被插件改写的原理与拦截器相关，见 [插件机制与拦截器实战](./S2-2-Lesson.md)。
