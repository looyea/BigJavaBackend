# 类型处理器、结果映射与关联查询 · 面试题

## 题 1：TypeHandler 是干什么的？怎么用？

- 定义 Java 类型 ↔ JDBC 类型双向转换：写走 setParameter、读走 getResult。
- 继承 BaseTypeHandler，实现 setNonNullParameter + 几个 getResult 重载，注册可全局/包扫描/字段级。
- 加分：举 JSON 列、逗号集合、枚举、LocalDateTime 等实际用途。

## 题 2：数据库存 JSON 对象，你怎么映射成 Java 对象？

- 写一个 JSON TypeHandler：写入序列化、读取反序列化，属性直接是结构化对象。
- 避免在每个 DAO 里手工 getString + parse。
- 加分：提到写入需显式 jdbcType=VARCHAR 防止"MyBatis 无法判断可空类型"报错。

## 题 3：枚举怎么持久化最稳？

- 存 name 或显式业务 code，绝不存 ordinal。
- 用 TypeHandler 或直接映射保证读写一致。
- 加分：讲清 ordinal 会因枚举重排导致历史数据全部错映射的事故。

## 题 4：association 和 collection 有什么区别？两种装配方式？

- association 一对一（订单→用户），collection 一对多（订单→明细）。
- 嵌套结果：一条 JOIN + resultMap 自动装配、无 N+1，推荐；嵌套查询：select+column 分次查、易 N+1、靠延迟加载缓解。
- 加分：指出嵌套结果必须配 `<id>` 定界父对象，否则明细重复/错装。

## 题 5：一对多装配为什么会重复？

- JOIN 产生笛卡尔展开行，MyBatis 需要 `<id>` 判定"哪些行属于同一父对象"。
- 漏配 `<id>` 就无法聚合边界，出现明细串行或重复。
- 加分：能画出 JOIN 展开表并说明 `<id>` 的去重作用。

## 题 6：discriminator 解决什么问题？

- 按某列值把结果行路由到不同子类型，实现结果级多态映射（如按 pay_type 分发子类）。
- 公共字段放基础 resultMap、差异字段放各分支 case。
- 加分：对比"业务层 if-else 手工转型"，说明多态映射更内聚。
