# 注入原理与预处理防御

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：从 SQL 执行计划层面讲透注入为何发生，辨死 MyBatis `${}` 与 `#{}` 的本质差异；能用预处理 + 白名单根治注入，正确处理"动态表名/列名/ORDER BY 无法参数化"的顽场景，并给出服务端永远兜底校验的铁律。

## 一、注入的本质：数据被当成了代码

SQL 注入不是"特殊字符"问题，而是**拼接让攻击者的输入改变了语句结构**。数据库先把字符串解析成执行计划再取数据，若用户输入在解析阶段就被当作 SQL 语法的一部分，语义即被劫持。

```sql
-- 目的：一句看懂"结构被篡改"
-- 反例（字符串拼接）❌
SELECT * FROM user WHERE name='` + input + `' AND pwd='` + pwd + `'
-- 当 input = admin' --    结果拼成：
SELECT * FROM user WHERE name='admin' --' AND pwd='...'   -- 注释掉密码校验，绕过登录 ❌
-- 说明：危险不在单引号本身，而在 input 参与了 SQL 的"语法解析"，而非仅作"值"
```

## 二、预处理为什么能根治：编译与取值分离

参数化查询（PreparedStatement）分两步：先把**带占位符的 SQL 模板**发给数据库编译定好执行计划，再单独发送参数值。参数永远只被当作"值"，无论内容多花哨都改不了已定结构。

```java
// 目的：MyBatis 里 #{} 与 ${} 的一线之隔
// ✅ #{} 编译为 JDBC 占位符 ?，值走参数通道，天然防注入
@Select("SELECT * FROM orders WHERE user_id = #{uid} AND status = #{st}")
List<Order> byUser(int uid, String st);

// ❌ ${} 是字符串直插（SQL 文本拼接），等于放弃预处理
@Select("SELECT * FROM orders WHERE user_id = ${uid}")   // 反例：${} 拼接，注入面洞开
List<Order> bad(int uid);
// 结果：uid 传 "1 OR 1=1" 即拖全表；#{} 会把整串当一个值比较，永不会变成语法
```

铁律：**能用 `#{}` 的地方绝不用 `${}`**。`${}` 只在"必须拼进结构"（表名、列名、排序方向）时出现，而那些位置**恰恰不能靠它兜底安全**。

## 三、顽场景：动态表名 / 列名 / ORDER BY

预处理的占位符只能替换"值"，替换不了表名、列名、`ORDER BY` 方向——这些位置写 `?` 数据库会报语法错。此时参数化无能为力，唯一正解是**白名单映射**。

```java
// 目的：ORDER BY 动态列 + 升降序的安全写法——白名单，不是过滤关键字
private static final Set<String> SORTABLE = Set.of("create_time", "amount", "id");
private static final Set<String> DIR = Set.of("asc", "desc");
public String orderBy(String col, String dir) {
    if (!SORTABLE.contains(col)) throw new IllegalArgumentException("非法排序列: " + col); // 反例防御：黑名单漏一词即破
    if (!DIR.contains(dir.toLowerCase())) dir = "asc";
    return " ORDER BY " + col + " " + dir;      // 结果：拼进去的都是自家枚举值，攻击者输入永不直达
}
// 反例：用 replace("--","").replace("union","") 过滤关键字做"防注入" ❌
//        大小写/编码/嵌套（如 ununionion）可绕过，黑名单永远不全——正解是白名单枚举
```

要点：**白名单（只放行已知合法项）而非黑名单（试图枚举所有非法）**；动态表名同理，用业务枚举映射真实表名，绝不把用户输入直接拼进 `${tableName}`。

## 四、注入家族的其他成员

SQL 只是最出名的一个，同一"数据当代码"的原理会复发在：

- **命令注入**：把用户输入拼进 `Runtime.exec` / shell 命令 → 用参数数组传参、绝不拼字符串。
- **LDAP / NoSQL 注入**：Mongo 查询对象若直接吃前端 JSON，`{"$ne":null}` 即绕过——校验类型、只取白名单字段。
- **OS 路径拼接**：`base + userPath` 导致 `../` 穿越——规范化后校验仍在 base 下。
- **二阶注入**：存入时看似安全，取出后又拼进新 SQL——防御要贯穿"每次使用"，不止"入库那一刻"。

## 五、关联课程

`${}` 与 `<if>` 动态 SQL 的完整机制在 [MyBatis 相关课](../../mybatis/s1/S1-1-Lesson.md)；越权与业务逻辑漏洞在 [反序列化、越权与业务逻辑漏洞](S1-3-Lesson.md)；XSS/CSRF 在 [XSS / CSRF 与 CSP](S1-2-Lesson.md)；接口签名与防篡改在 [接口签名、防重放与 KMS](../../data-security/s1/S1-2-Lesson.md)。
