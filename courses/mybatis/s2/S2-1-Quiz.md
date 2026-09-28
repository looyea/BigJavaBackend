# 类型处理器、结果映射与关联查询 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. TypeHandler 的本质职责是（6分）

- A. 生成 SQL
- B. 定义某个 Java 类型与 JDBC 类型之间的双向转换（写入 setParameter、读取 getResult）
- C. 管理事务
- D. 打印日志

> 答案：B
> 解析：TypeHandler 打通"列 ↔ 属性"类型不匹配，如枚举、JSON、LocalDateTime、逗号集合，读写各转一次。

### 2. 把 JSON 列直接映射成 Java 对象，应（6分）

- A. 每次手工 getString 再 parse
- B. 写一个 TypeHandler，在 setNonNullParameter 序列化、getResult 反序列化
- C. 改用存 String 字段永远不转对象
- D. 用 resultMap 的 id

> 答案：B
> 解析：TypeHandler 让读写自动完成序列化/反序列化，属性直接是结构化对象，免去散落的手工转换。

### 3. 枚举持久化最稳妥的做法是（6分）

- A. 按 ordinal 存 int
- B. 存 name 或显式业务 code
- C. 不存
- D. 存 hashCode

> 答案：B
> 解析：ordinal 会因枚举重排而漂移，使历史数据全部错映射；用稳定的 name/code 才不受顺序影响。

### 4. 一对一、一对多关联分别用什么标签？（6分）

- A. `<collection>` / `<association>`
- B. `<association>`（一对一）/ `<collection>`（一对多）
- C. 都用 `<result>`
- D. `<join>`

> 答案：B
> 解析：association 表"有一个"（订单→用户），collection 表"有多个"（订单→明细）。

### 5. 嵌套结果（一条 JOIN + resultMap 装配）相对嵌套查询的主要优势是（6分）

- A. 写法更复杂
- B. 避免 N+1，一次查询装配完成
- C. 支持延迟加载
- D. 不需要 resultMap

> 答案：B
> 解析：嵌套结果把关联数据在一条 JOIN 里取回、由 resultMap 自动装配；嵌套查询分次查易触发 N+1。

### 6. 一对多嵌套结果装配里，决定"哪些行属于同一父对象"的是（6分）

- A. 列名
- B. resultMap 中声明的 `<id>`
- C. SQL 顺序
- D. 表名

> 答案：B
> 解析：JOIN 产生笛卡尔展开行，MyBatis 靠 `<id>` 定界聚合；漏配 `<id>` 会导致明细重复或串行错装。

### 7. discriminator 的用途是（6分）

- A. 分页
- B. 按某列值把结果行路由到不同子类型，实现多态映射
- C. 缓存
- D. 事务隔离

> 答案：B
> 解析：如按 type 列把行映射成 Credit/Debit 等子类，discriminator 提供结果级别的多态分发。

### 8.（多选）下列哪些适合用自定义 TypeHandler 处理？（9分）

- A. JSON 对象列 ↔ POJO
- B. 逗号分隔字符串 ↔ List
- C. 枚举 ↔ 稳定 code
- D. 普通 int 列 ↔ int 属性

> 答案：A、B、C
> 解析：D 是内建默认映射无需自定义；A/B/C 都需要 Java↔JDBC 的定制转换。

### 9.（多选）关于关联查询的常见坑有（9分）

- A. 用嵌套查询装配一对多却不做延迟控制，导致 N+1
- B. 一对多 resultMap 漏配 `<id>` 使明细重复
- C. JSON/枚举列写入未指定 jdbcType 报未知类型错
- D. 给主键配 `<id>`

> 答案：A、B、C
> 解析：A/B/C 都是典型错误；D 是正确做法不是坑。

### 10. 设计一个订单查询映射：订单含一个用户（一对一）和多条明细（一对多），明细里有 JSON 属性列和枚举状态列。请给出 resultMap 与 TypeHandler 方案，并说明如何避免 N+1 与装配重复。（40分）

> 参考答案：
- 要点1：结构映射——用 `<association>` 装用户、`<collection>` 装明细，主表与明细各配 `<id>` 定界，避免 JOIN 笛卡尔行装配重复/串行（10分）
- 要点2：无 N+1——优先嵌套结果（一条 JOIN + resultMap 自动装配），不轻易用嵌套查询；确需延迟加载再配 fetchType（10分）
- 要点3：类型定制——JSON 列写 TypeHandler 序列化/反序列化、枚举存稳定 name/code（绝不 ordinal），必要时显式声明 jdbcType=VARCHAR 防写入报错（10分）
- 要点4：多态——若明细存在子类型，用 discriminator 按列值路由到不同 resultMap/类型，保证读回即正确对象（10分）
