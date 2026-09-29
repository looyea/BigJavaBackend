# 派生查询、自定义仓储与事务边界

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能把 Spring Data JPA 的仓储能力组织成"派生查询打底、动态条件补强、Fragment 兜底、事务边界收口"的四层结构。仓储方法有**三种来源**：①**方法名派生**——`findByStatusAndCreatedAfter` 被解析成谓词，关键字（`OrderBy`/`After`/`Between`/`In`）拼错或属性名对不上会启动即报错；②**`@Query`**——JPQL（用**实体/属性名**不是表/列名）或 `nativeQuery=true` 原生 SQL，配 `@Param` 命名参数，写操作加 `@Modifying` 并用 `clearAutomatically`/`flushAutomatically` 避免一级缓存读到旧值；③**投影**（接口/DTO 只取需要的列）。多可选筛选用 **Specification**（Criteria API 组合 `Predicate`、`JpaSpecificationExecutor`）或 **Example**（按实体样例 + `ExampleMatcher` 忽略大小写/空值）动态拼装，杜绝"每种组合写一个方法"。**Fragment 自定义仓储**：声明 `OrderRepositoryCustom` + 实现类 `OrderRepositoryImpl`（Bean 名必须=接口名+`Impl`），把 `EntityManager` 手写逻辑并入同一 `Repository`。事务边界：`SimpleJpaRepository` 类级 `@Transactional(readOnly=true)`、写方法覆盖为可写——`readOnly` 抑制 flush 但脏检查仍在，别把写放在只读事务里；**OSIV**（`spring.jpa.open-in-view=true` 是默认）让懒加载在视图渲染期也能触发，表面"不报错"实则把 N+1 与连接占用拖到最外层，应关闭。识破"方法名拼错启动失败""`@Modifying` 漏事务抛 `TransactionRequiredException`""OSIV 掩盖 `LazyInitializationException` 让 N+1 在页面渲染才暴露"等坑。

## 一、仓储方法的三种来源

```java
// 目的：三种途径声明查询——方法名派生、@Query、动态条件, 各有适用边界
public interface OrderRepository extends JpaRepository<OrderEntity, Long>,
        JpaSpecificationExecutor<OrderEntity>, OrderRepositoryCustom {
    // 说明：方法名派生——关键字被解析成谓词, OrderBy/After/And 或属性名拼错则启动即报"属性不存在"
    List<OrderEntity> findByStatusAndCreatedAfter(Status s, LocalDateTime t);
    @Query("select o from Order o where o.uid = :uid and o.amount > :min") // 结果：JPQL 用实体/属性名, 不是表/列名
    List<OrderEntity> findBig(@Param("uid") Long uid, @Param("min") BigDecimal min);
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Order o set o.status = :s where o.id in :ids") // 反例：写操作漏 @Transactional ❌ 抛 TransactionRequiredException
    int markPaid(@Param("ids") List<Long> ids, @Param("s") Status s);
}
```

## 二、动态条件：Specification 与 Example

```java
// 目的：把"多可选筛选"动态拼成谓词, 避免为每种组合各写一个查询方法
public static Specification<OrderEntity> filter(Status s, LocalDateTime after, BigDecimal min) {
    return (root, q, cb) -> {                              // 说明：root 实体路径, cb 谓词构建器
        List<Predicate> ps = new ArrayList<>();            // 反例：直接拼 HQL 字符串 ❌ 既易注入又难维护
        if (s != null)     ps.add(cb.equal(root.get("status"), s));      // 结果：条件为空就不加入, 天然处理"可选"
        if (after != null) ps.add(cb.greaterThan(root.get("created"), after));
        if (min != null)   ps.add(cb.greaterThan(root.get("amount"), min));
        return cb.and(ps.toArray(new Predicate[0]));       // 说明：Specification.where(a).and(b) 可组合复用
    };
}
```

## 三、Fragment 自定义仓储

```java
// 目的：把 EntityManager 手写复杂查询并入同一个 Repository 接口, 对外统一暴露
public interface OrderRepositoryCustom {                 // 说明：自定义方法契约(不写继承)
    List<OrderEntity> nativeRank(int limit);
}
public class OrderRepositoryImpl implements OrderRepositoryCustom { // 结果：Bean 名规则=仓储接口名+Impl, 框架自动织入
    @PersistenceContext EntityManager em;                // 反例：命名成 OrderRepositoryCustomImpl ❌ 不会被识别为 Fragment
    public List<OrderEntity> nativeRank(int limit) {
        return em.createNativeQuery("select * from orders order by score desc limit ?", OrderEntity.class)
                .setParameter(1, limit).getResultList(); // 说明：原生 SQL 走 EntityManager, 由 Fragment 并入派生仓储
    }
}
```

## 四、事务边界与 OSIV 陷阱

```text
图目的：默认事务读写划分与 open-in-view 该不该关
SimpleJpaRepository: 类级 @Transactional(readOnly=true), save/delete 覆盖为可写
readOnly=true 抑制 flush, 但对托管实体赋值仍可能被脏检查写回——别把写塞进只读事务
OSIV(open-in-view 默认 true): 把 EntityManager 绑到请求线程, 视图层懒加载能触发
表面"不抛 LazyInitializationException", 实则把 N+1 与 DB 连接占用拖到渲染期最外层
建议: 关闭 open-in-view, 在服务层用 JOIN FETCH/EntityGraph 提前抓好关联
```

## 五、关联课程

派生查询取回的实体处于何种状态、脏检查何时 flush，承接 [持久化上下文与实体状态](./S1-1-Lesson.md)；关闭 OSIV 后用抓取策略根治的懒加载放大问题见 [N+1 与抓取策略](./S1-2-Lesson.md)；`@Modifying` 依赖的声明式事务边界与 `@Transactional` 失效场景见 [事务传播与失效场景](../../spring-core/s2/S2-2-Lesson.md)。
