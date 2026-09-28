# 类型处理器、结果映射与关联查询 · 作业

### 作业 1：为 JSON 列与枚举列写 TypeHandler

- 目标：让"配置 JSON 列"和"状态枚举列"直接映射成对象/枚举，读写自动转换。
- 任务：实现一个 `JsonTypeHandler`（写序列化、读反序列化）与一个枚举 TypeHandler（存 name/code 而非 ordinal），在 resultMap 或字段上注册；写入再读回验证对象一致。构造一个"枚举重排"场景，证明用 ordinal 会错映射、用 code 不会。
- 验收标准：JSON 列读回即为结构化对象、无需手工 parse；枚举持久化不依赖顺序；写入不报"未知 jdbcType"（必要时显式声明）。
- 参考解法要点：BaseTypeHandler 实现 setNonNullParameter + 三个 getResult；注册可全局/包扫描/字段级 typeHandler。

### 作业 2：一条 JOIN 装配订单-用户-明细

- 目标：用嵌套结果一次性装配一对一 + 一对多，避免 N+1 与装配重复。
- 任务：写一条 JOIN 查询订单、其用户、其多条明细，配 resultMap：`<id>` 定界主表与明细、`<association>` 装用户、`<collection>` 装明细。故意删掉明细的 `<id>` 观察重复现象，再恢复。统计查询次数证明只有一次。
- 验收标准：一次 SQL 完成装配、无逐明细额外查询；`<id>` 缺失时能复现明细重复/串行错装、补回后正常。
- 参考解法要点：JOIN 产生笛卡尔行，靠 `<id>` 判定父对象边界；能解释嵌套结果与嵌套查询取舍。

### 作业 3：discriminator 多态映射

- 目标：按类型列把结果行映射成不同子类型对象。
- 任务：设计一张 payments 表含 `pay_type`（credit/debit/balance），用 discriminator 按该列把行分发到不同子类 resultMap，读回得到各自子类型实例。
- 验收标准：不同 pay_type 行返回对应 Java 子类型；公共字段用基础 resultMap、差异字段用分支；无 if-else 手工转型散落业务层。
- 参考解法要点：discriminator 的 `column` + `javaType` + `<case value= resultMap=>` 组织多态；与业务层策略模式可对照。
