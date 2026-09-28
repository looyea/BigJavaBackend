# 派生查询、自定义仓储与事务边界 · 作业

### 作业 1：三种查询来源各写一个并对比

- 目标：掌握方法名派生、`@Query`、`Specification` 各自的适用场景。
- 任务：对订单实体，写一个派生方法 `findByStatusAndCreatedBetween`、一个 JPQL `@Query`（带 `@Param`）、一个用 `JpaSpecificationExecutor` 的动态筛选（状态/金额可选）。故意把一个派生方法的属性名写错，观察启动期报错信息。
- 验收标准：三种查询都能跑通并返回正确结果；属性名拼错时在应用启动即失败而非运行期；能说明 JPQL 用实体/属性名而非表/列名。
- 参考解法要点：`extends JpaRepository<..>, JpaSpecificationExecutor<..>`；`@Query` 命名参数配 `@Param`；空条件不加入 `Predicate` 列表。

### 作业 2：用 Fragment 并入一段手写原生查询

- 目标：把需要 `EntityManager` 的复杂查询统一进同一个 Repository。
- 任务：定义 `OrderRepositoryCustom` 接口与 `OrderRepositoryImpl` 实现（注入 `EntityManager` 执行一段带窗口函数的排行原生查询），使其通过 `OrderRepository` 直接调用。再把实现类改名成 `OrderRepositoryCustomImpl` 之外的错误名，观察失效。
- 验收标准：`orderRepository.nativeRank(...)` 可用；命名不符合"接口名+Impl"约定时该 Fragment 方法不被织入、注入报错；能解释命名规则。
- 参考解法要点：Fragment 接口 + `接口名+Impl`；`createNativeQuery(...).setParameter(...)`；与派生方法共享同一 Repository 代理。

### 作业 3：事务边界与关闭 OSIV

- 目标：厘清读写事务划分，消除视图层懒加载隐患。
- 任务：给查询方法加 `@Transactional(readOnly=true)`、写方法用可写事务；对一个 `@Modifying` 批量更新后立刻查询的场景，对比加/不加 `clearAutomatically` 的结果差异；将 `spring.jpa.open-in-view=false` 打开前后，触发一个视图层访问懒加载关联的场景并记录异常。
- 验收标准：`@Modifying` 缺事务抛 `TransactionRequiredException`、补事务后可执行；`clearAutomatically` 生效前后能读出旧值/新值差异；关闭 OSIV 后 N+1 在服务层暴露、用 JOIN FETCH 解决。
- 参考解法要点：只读事务承载查询；写放可写事务；OSIV 关闭后在服务层提前抓取关联而非依赖渲染期懒加载。
