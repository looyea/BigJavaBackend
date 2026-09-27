# N+1 与抓取策略 · 面试题

## 题 1：什么是 N+1 问题？如何检测？

**答**：查 N 条主记录后，遍历时逐条触发懒加载 SELECT，共产生 1+N 次 SQL。检测手段：
- `hibernate.generate_statistics=true` 观察 `prepareStatementCount`。
- 开启 `p6spy` 打印所有 SQL 及调用栈。
- Spring Boot Actuator `/actuator/hibernate-metrics`（micrometer）。
- 代码审查：for 循环中访问未 fetch 的关联。

## 题 2：JOIN FETCH 和 `fetch = FetchType.EAGER` 的区别？

| 维度 | JOIN FETCH | EAGER |
|------|-----------|-------|
| 控制粒度 | 查询级（这条 JPQL 才 fetch） | 实体级（凡查此实体都 fetch） |
| 可控性 | 高——不同场景用不同 fetch 策略 | 低——所有查询被强制 JOIN |
| 分页兼容 | 不兼容 | 不兼容 |

```java
// 目的：同一实体在不同场景下用不同策略
@Entity
public class Order {
    @ManyToOne(fetch = FetchType.LAZY)  // 默认 LAZY，避免不必要加载
    private Customer customer;
}
// 场景 A：列表只要 orderNo → 不 fetch，避免 JOIN
// 场景 B：详情页要 customer → JOIN FETCH 或 @EntityGraph
```

## 题 3：为什么 EntityGraph 和 nativeQuery 冲突？有替代方案吗？

**根因**：`@EntityGraph` 的实现原理是 Hibernate 在解析 JPQL 时注入 LEFT JOIN FETCH 子句。nativeQuery 直接发原生 SQL，Hibernate 无法拦截改写。

**替代方案**：
1. 把 native 改为 JPQL。
2. 拆两步查询：native 查 IDs → JPQL + EntityGraph 按 IDs 取完整对象。
3. 使用 `@SqlResultSetMapping` + `@ConstructorResult` 做 DTO 投影。

## 题 4：分页场景如何优雅加载关联数据？

```java
// 目的：两阶段加载——先分页取 IDs，再批量取完整对象图
public Page<OrderVO> listOrders(int page, int size) {
    // 第 1 条 SQL：只查 ID 分页（走索引覆盖，极快）
    Page<Long> ids = orderRepo.findIds(PageRequest.of(page, size));
    // 第 2 条 SQL：按 IDs + EntityGraph 拿完整数据
    List<Order> orders = orderRepo.findByIdInWithGraph(ids.getContent());
    return orders.stream().map(OrderVO::from).toList();
}
// 结果：2 条 SQL，支持分页，无 N+1
// 错误用法：直接在 Pageable 查询上加 JOIN FETCH → 报 UnsupportedOperationException
```

## 题 5：`@BatchSize` 的实际触发时机是什么？与 `default_batch_fetch_size` 的关系？

- **@BatchSize**：标记在具体关联字段上，当该字段懒加载首次被访问时触发——Hibernate 收集当前 Session 中同一类型的所有待加载实体，一次 `WHERE id IN (?,?,...,?)` 取回。
- **default_batch_fetch_size**：全局默认值（application.yml），对所有未标 @BatchSize 的关联生效。
- **优先级**：字段级 @BatchSize > 全局 default_batch_fetch_size > 默认值（无批处理=1）。

```java
// 目的：验证 BatchSize 触发——需同一 Session 内有多个同类型实体
List<Order> orders = em.createQuery("SELECT o FROM Order o", Order.class)
    .setMaxResults(50).getResultList();  // 50 个 Order，LAZY items
Order first = orders.get(0);
first.getItems().size();  // 结果：触发 batch——一次 IN 查 50 个 order 的 items
// 输出：仅 2 条 SQL（orders + items batch）而非 51 条
// 错误用法：若 orders 列表已经通过 em.clear() 清空 → 无法触发 batch（每个实体独立懒加载）
```
