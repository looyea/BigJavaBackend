# N+1 与抓取策略

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：能识别 N+1 问题的根因，掌握 JOIN FETCH、EntityGraph、@BatchSize 三种治理手段并取舍。

## 一、N+1 问题复现

### 1.1 场景描述

```java
// 目的：演示 N+1——查 100 个 Order，每个 Order 懒加载 Customer
@Entity
public class Order {
    @Id @GeneratedValue
    private Long id;
    private String orderNo;
    @ManyToOne(fetch = FetchType.LAZY)  // 结果：默认代理，首次访问才 SELECT
    private Customer customer;
}

// 错误用法：JPQL 不 fetch customer，循环中触发懒加载
@Transactional(readOnly = true)
public List<String> listCustomerNames() {
    List<Order> orders = em.createQuery("SELECT o FROM Order o", Order.class)
        .getResultList();                  // 第 1 条 SQL：SELECT * FROM orders → 100 行
    return orders.stream()
        .map(o -> o.getCustomer().getName()) // 每条触发 SELECT * FROM customers WHERE id=?
        .toList();                          // 输出：共执行 1+100=101 条 SQL
}
```

### 1.2 为什么默认 LAZY？

- EAGER 在集合上会导致笛卡尔积爆炸。
- LAZY + 序列化/Controller 层访问 → `LazyInitializationException`（上下文已关闭）。

## 二、JOIN FETCH

```java
// 目的：一条 SQL 把关联对象一起查出来
List<Order> orders = em.createQuery(
    "SELECT o FROM Order o JOIN FETCH o.customer", Order.class)
    .getResultList();  // 结果：单条 SQL SELECT o.*, c.* FROM orders o JOIN customers c ON ...
```

**注意**：
- JOIN FETCH 的实体不能被分页（`setFirstResult/setMaxResults` 会抛 `UnsupportedOperationException`，因为 DISTINCT 在内存去重）。
- 多个 `List` 集合同时 JOIN FETCH → `HibernateMultiLoadException`（Multiple bag fetch）。

## 三、EntityGraph（JPA 2.1+）

### 3.1 命名 EntityGraph

```java
// 目的：在实体上声明可复用的抓取图
@NamedEntityGraph(
    name = "Order.withCustomerAndItems",  // 说明：唯一标识
    attributeNodes = {
        @NamedAttributeNode("customer"),
        @NamedAttributeNode("items")      // 结果：同时抓取两个关联
    }
)
@Entity
public class Order { ... }
```

### 3.2 动态 EntityGraph（Spring Data JPA）

```java
// 目的：Repository 方法上一行注解即可解决 N+1
public interface OrderRepository extends JpaRepository<Order, Long> {
    @EntityGraph(attributePaths = {"customer", "items"})  // 输出：自动 JOIN FETCH
    List<Order> findByStatus(OrderStatus status);          // 结果：一条 SQL 拿到完整对象图
}
// 错误用法：EntityGraph 与 @Query(nativeQuery=true) 不能同时使用
```

## 四、@BatchSize（Hibernate 私有）

```java
// 目的：懒加载触发时批量 IN 查询，减少 SQL 数量
public class Order {
    @OneToMany(mappedBy = "order")
    @BatchSize(size = 20)  // 结果：首次访问 items 时，同时加载 20 个 Order 的集合
    private List<Item> items;
}
// 输出：100 个 Order 只需 1(orders) + 5(items: 100/20) = 6 条 SQL
// 说明：不能与 JOIN FETCH 同时使用（BatchSize 针对懒加载触发）
```

application.yml 配置全局默认：
```yaml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 20  # 结果：所有未标 @BatchSize 的关联也按 20 批量加载
```

## 五、三种方案对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| JOIN FETCH | 明确知道需要哪个关联 | 一次查完 | 不能分页、集合爆炸 |
| EntityGraph | Spring Data 方法级控制 | 声明式、可复用 | 复杂图需调优 |
| @BatchSize | 懒加载不可避免时 | 保持 LAZY 语义 | 仍有 N/batch 条 SQL |

## 六、关联技术

- Hibernate `hibernate.query.plan_cache_max_size`（查询计划缓存）
- `@Fetch(FetchMode.SUBSELECT)`：子查询方式加载集合
- Blaze-Persistence：支持分页 + FETCH 关联的框架
- Spring `@Transactional` 边界对懒加载的影响（OSIV / open-in-view）
