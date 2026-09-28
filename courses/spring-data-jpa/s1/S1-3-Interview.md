# 派生查询、自定义仓储与事务边界 · 面试题

## 题 1：Spring Data JPA 的仓储方法从哪来？

- 方法名派生：`findBy...OrderBy...` 在启动时解析成谓词，拼错即启动失败。
- `@Query`：JPQL（实体/属性名）或 `nativeQuery` 原生 SQL，配 `@Param`；写操作加 `@Modifying`。
- 动态条件用 `Specification`/`Example`；复杂手写用 Fragment 自定义仓储。
- 加分：能对比三者的可维护性——派生简洁、JPQL 灵活、Specification 组合可选条件最合适。

## 题 2：多可选筛选条件你怎么设计查询，避免方法爆炸？

- 用 `JpaSpecificationExecutor` + `Specification`，把每个可选条件按需 `cb.and`，为空就不加。
- 权限、租户等通用过滤做成可复用 `Specification`，`.and(...)` 组合。
- 加分：对比手写字符串拼接 HQL 的注入与维护风险；分页用 `findAll(spec, Pageable)` 直接拿 `Page` 与总数。

## 题 3：Fragment 自定义仓储怎么接入？命名有什么讲究？

- 定义 `XxxRepositoryCustom` 接口 + 实现类，命名必须是"自定义接口名 + Impl"，框架自动织入到主仓储。
- 实现里注入 `EntityManager`/`JdbcTemplate` 写复杂逻辑，调用方只面对同一个 Repository。
- 加分：指出命名不符（如 `XxxCustomImpl` 拼错后缀）会不被识别，常见踩坑点。

## 题 4：`@Modifying` 更新后为什么读到旧值？怎么处理？

- 批量 update/delete 绕过实体直接改库，Persistence Context 里旧托管实例没刷新。
- 加 `@Modifying(clearAutomatically=true, flushAutomatically=true)`，必要时先 flush 再执行、执行后清一级缓存。
- 加分：强调 `@Modifying` 必须在事务中，否则抛 `TransactionRequiredException`。

## 题 5：JPA 仓储的默认事务边界是怎样的？只读事务有什么用？

- `SimpleJpaRepository` 类级 `@Transactional(readOnly=true)`，`save/delete` 等方法覆盖为可写。
- `readOnly=true` 抑制 flush、给数据库潜在优化提示，适合纯查询；但把对托管实体的赋值放进只读事务仍可能被脏检查写回。
- 加分：能说明写操作要显式落在可写事务、以及自调用导致 `@Transactional` 失效的代理问题。

## 题 6：什么是 OSIV？为什么建议关闭？

- `spring.jpa.open-in-view`（默认 true）把 EntityManager 绑到整个请求线程，视图层也能触发懒加载。
- 好处是"看着不报 `LazyInitializationException`"，代价是把 N+1 与 DB 连接占用拖到渲染期最外层、放大性能问题。
- 加分：给出关闭后的正确姿势——在服务层用 JOIN FETCH/EntityGraph 提前抓好关联再返回。
