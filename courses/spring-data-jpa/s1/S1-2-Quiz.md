# N+1 与抓取策略 · 小测

### 1. N+1 问题产生的根本原因是？（6分）

- A. 数据库索引缺失导致全表扫描
- B. LAZY 加载在遍历集合时逐条触发额外 SELECT
- C. SQL 语句未使用 JOIN 语法
- D. 连接池大小不足以支撑并发查询

> 答案：B
> 解析：1 条主查询 + N 条懒加载子查询 = N+1 次网络往返，本质是抓取策略不当。

### 2. JOIN FETCH 后使用分页会导致什么问题？（6分）

- A. SQL 语法错误
- B. 分页结果正确但性能下降
- C. 抛出 UnsupportedOperationException 或结果不准确
- D. 自动退化为子查询

> 答案：C
> 解析：Hibernate 对 FETCH JOIN 后的集合做内存 DISTINCT 去重，无法在 SQL 层正确 LIMIT/OFFSET。

### 3. @EntityGraph 注解与以下哪个注解不能同时使用？（6分）

- A. @Query
- B. @Transactional
- C. @Query(nativeQuery = true)
- D. @Modifying

> 答案：C
> 解析：EntityGraph 需要 Hibernate 解析 JPQL 来注入 JOIN FETCH，nativeQuery 是原生 SQL 无法干预。

### 4. @BatchSize(size=20) 的效果是？（6分）

- A. 一次 JOIN 加载 20 条关联记录
- B. 懒加载触发时用 WHERE id IN (?,...) 一次加载 20 个父实体的集合
- C. 批量 INSERT 每 20 条 flush 一次
- D. SQL 缓存最多存 20 个执行计划

> 答案：B
> 解析：@BatchSize 针对的是"当加载一个实体的关联时，顺带把同批其他实体的关联也 IN 查出来"。

### 5. 多对多集合使用 List 而非 Set 时，同时 JOIN FETCH 两个 List 会？（6分）

- A. 正常工作
- B. 抛出 HibernateMultiLoadException（Multiple bag 问题）
- C. 自动转为 Set
- D. 产生死循环

> 答案：B
> 解析：List（bag）没有唯一标识，同时 fetch 两个 bag 无法正确分组行→列的映射关系。

### 6. Spring Boot 默认 spring.jpa.open-in-view=true 的隐患是？（6分）

- A. 数据库连接数暴增
- B. Controller 层序列化时懒加载异常被掩盖，但问题延迟到更高层暴露
- C. 无法使用 DTO 投影
- D. 自动关闭脏检查

> 答案：B
> 解析：OSIV 让 EntityManager 存活到视图渲染结束，表面上不报错但隐藏了 N+1，且事务外仍占连接。

### 7. 以下哪种方案适合"分页查询 Order 列表并展示 customer.name"？（6分）

- A. 设置 customer 为 EAGER
- B. JPQL SELECT o, c FROM Order o JOIN o.customer c + 分页
- C. @BatchSize(size=50) 或先查分页 IDs 再批量关联
- D. 在循环中逐条 em.find(Customer.class, id)

> 答案：C
> 解析：A 影响全局；B JOIN FETCH 不能分页（非投影版）；D 就是 N+1；C 在保持分页的同时批量加载关联。

### 8. 关于 @Fetch(SUBSELECT) 说法正确的是（多选）？（9分）

- A. 加载集合时发出 WHERE order_id IN (子查询) 一次性取回
- B. 只能用于集合（@OneToMany/@ManyToMany）
- C. 可以替代 JOIN FETCH 并支持分页
- D. 与 @BatchSize 互斥

> 答案：A、B
> 解析：C 错——SUBSELECT 是懒加载触发时的策略，不能解决分页问题；D 错——两者可共存，优先级取决于触发方式。

### 9. 治理 N+1 的最佳实践包括（多选）？（9分）

- A. 在 Repository 层用 @EntityGraph 声明抓取路径
- B. 全局关闭 LAZY，所有关联设为 EAGER
- C. 使用 DTO 投影（constructor expression）只取需要的字段
- D. 配置 hibernate:generate_statistics 监控查询次数

> 答案：A、C、D
> 解析：B 是反模式——EAGER 不可控会导致笛卡尔积和性能雪崩；A/C/D 是业界公认最佳实践。

### 10. 简答题：比较 JOIN FETCH、EntityGraph、@BatchSize 三种方案的原理、优缺点和适用场景。（40分）

- 要点1：JOIN FETCH——JPQL 显式 JOIN，一次 SQL 拿全部数据；优点是彻底消除 N+1；缺点是不能分页、多 List 冲突
- 要点2：EntityGraph——声明式定义抓取图，可命名或动态；优点是方法级控制无需改 JPQL；缺点是 nativeQuery 不生效
- 要点3：@BatchSize——懒加载触发时按批次 IN 查询；优点保留 LAZY 灵活性；缺点仍有 1+N/batch 次 SQL
- 要点4：选择依据——明确关联用 JOIN/EntityGraph，分页场景用 BatchSize 或二次查询，字段少用 DTO 投影

> 答案：见要点
> 解析：三种方案互补而非互斥，生产中常结合使用。
