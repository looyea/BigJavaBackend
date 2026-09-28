# 派生查询、自定义仓储与事务边界 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. 方法名派生查询里，属性名/关键字拼错会发生什么（6分）

- A. 运行到该查询才报错
- B. 应用启动阶段即因无法解析谓词而报错
- C. 静默返回空
- D. 自动纠正

> 答案：B
> 解析：Spring Data 在启动时解析方法名构建查询，`OrderBy/After/And` 或属性名对不上会立刻失败，暴露得早。

### 2. `@Query` 里写 JPQL，应使用（6分）

- A. 表名和列名
- B. 实体名和属性名
- C. 视图名
- D. 任意字符串

> 答案：B
> 解析：JPQL 面向对象模型，用的是 `@Entity` 名与字段属性名；只有 `nativeQuery=true` 才写真实表/列。

### 3. 用 `@Modifying` 执行批量 update 后，紧接着的同事务查询读到旧值，最应（6分）

- A. 换新连接
- B. 加 `clearAutomatically=true`（必要时 `flushAutomatically=true`）清一级缓存
- C. 忽略
- D. 改用派生查询

> 答案：B
> 解析：`@Modifying` 绕过实体直改数据库，Persistence Context 里的旧托管实例未刷新，清缓存才能读到最新。

### 4. `@Modifying` 方法若没有事务（既无 `@Transactional`）会（6分）

- A. 正常执行
- B. 抛 `TransactionRequiredException`
- C. 自动开启事务
- D. 只读返回 0

> 答案：B
> 解析：执行更新/删除必须在事务中，缺失即抛 `TransactionRequiredException`，这是常见漏配坑。

### 5. 面对"多个可选筛选条件"的动态查询，最合适的方案是（6分）

- A. 为每种组合写一个派生方法
- B. 用 Specification（或 Example）按需组合谓词
- C. 全部走原生 SQL 字符串拼接
- D. 关闭二级缓存

> 答案：B
> 解析：`JpaSpecificationExecutor` 用 Criteria API 组合 `Predicate`，条件为空就不加，天然处理可选筛选。

### 6. Fragment 自定义仓储的实现类命名必须满足（6分）

- A. 以 `Fragment` 结尾
- B. = 自定义接口名 + `Impl`（如 `OrderRepositoryCustom`→`OrderRepositoryCustomImpl`）
- C. 等于主仓储接口名 + `Impl`
- D. 随意，加 `@Component` 即可

> 答案：B
> 解析：Spring Data 按"Fragment 接口名 + Impl"约定自动织入，命名不符则不会被识别并入仓储。

### 7. 关于 `open-in-view`（OSIV），正确的说法是（6分）

- A. 默认关闭，需手动开启
- B. 默认开启，把 EntityManager 绑到请求线程，易在视图层触发懒加载、掩盖 N+1
- C. 只影响写性能
- D. 能根治懒加载异常所以应保留

> 答案：B
> 解析：OSIV 默认 true，让视图渲染期懒加载不报错，却把 N+1 与连接占用拖到最外层，建议关闭并在服务层抓取。

### 8.（多选）下列属于仓储查询合理组织方式的有（9分）

- A. 简单等值/区间用方法名派生
- B. 复杂或多选用 `@Query`/Specification
- C. 需要 `EntityManager` 手写时用 Fragment 并入同一 Repository
- D. 所有查询一律拼字符串原生 SQL

> 答案：A、B、C
> 解析：D 是反例——裸拼字符串既难维护又有注入风险，应交给派生/JPQL/参数化。

### 9.（多选）关于事务边界与只读，说法正确的有（9分）

- A. `SimpleJpaRepository` 类级默认 `readOnly=true`，写方法覆盖为可写
- B. 把对托管实体的赋值放进 `readOnly` 事务，仍可能因脏检查被写回
- C. `readOnly=true` 可用于纯查询以获得潜在优化并抑制flush
- D. `readOnly` 事务里执行 `save` 一定成功且立即生效

> 答案：A、B、C
> 解析：D 错——只读事务不应承载写操作，可能不 flush 或抛错；写要落在可写事务里。

### 10. 一个"订单列表多条件筛选"接口：条件（状态/时间区间/金额下限/关键字）都可选，还要按用户权限追加过滤，并统计总数。请给出仓储与事务的组织方案。（40分）

> 参考答案：
- 要点1：动态条件——用 Specification 组合可选 `Predicate`（空则不加），权限过滤做成可复用的 `Specification.where(...).and(perm)`，避免组合爆炸（10分）
- 要点2：分页与统计——继承 `JpaSpecificationExecutor` 用 `findAll(spec, Pageable)` 返回 `Page`，总数由其 `totalElements` 提供，不自拼 count SQL（10分）
- 要点3：只读边界——查询方法置于 `@Transactional(readOnly=true)`，服务层用 JOIN FETCH/EntityGraph 提前抓关联并关闭 OSIV，防 N+1（10分）
- 要点4：兜底与写——个别复杂统计用 Fragment(`XxxRepositoryCustom`+`...Impl`) 走 EntityManager；若有批量改状态则 `@Modifying` 配事务与 `clearAutomatically`（10分）
