# 持久化上下文与实体状态

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：掌握 JPA 四级实体状态流转与脏检查触发时机，能在实际项目中判断何时该 flush、何时该 detach。

## 一、持久化上下文（Persistence Context）

### 1.1 是什么

持久化上下文 = EntityManager 内部维护的一级缓存（L1 Cache），跟踪所有被托管实体的状态变化。它的生命周期 = 一个事务（Transaction-Scoped）或与 Session 绑定（Extended）。

```java
// 目的：演示 Spring Boot 中 EntityManager 的注入与基本使用
// 说明：@PersistenceContext 注入的是线程绑定的共享代理，事务内自动 flush
@Repository
public class UserRepository {
    @PersistenceContext
    private EntityManager em;  // 结果：得到 Spring 管理的代理，无需手动 close

    public User findById(Long id) {
        return em.find(User.class, id);  // 输出：托管态实体，受脏检查跟踪
    }
}
```

### 1.2 与 Hibernate Session 的关系

| 概念 | JPA 规范 | Hibernate 实现 |
|------|----------|----------------|
| 持久化上下文 | EntityManager | Session |
| 工厂 | EntityManagerFactory | SessionFactory |
| 一级缓存 | 上下文内 | Session 级 |

## 二、实体四种状态

```text
瞬时(Transient) → 托管(Managed) → 游离(Detached) → 移除(Removed)
                   persist/merge       close/evict       remove
```

### 2.1 瞬时态（Transient）

```java
// 目的：new 出来的对象未被 EntityManager 托管
User u = new User("Tom", 20);  // 结果：无 ID（若用 DB 生成策略），不在 L1 缓存中
// 错误用法：直接调 em.contains(u) → false；此时修改属性不会触发任何 SQL
```

### 2.2 托管态（Managed）

```java
// 目的：persist 后实体进入托管态，脏检查生效
// 说明：Spring @Transactional 保证同一线程同一事务共享持久化上下文
@Transactional
public void updateName(Long id, String name) {
    User u = em.find(User.class, id);  // 输出：托管态，已在 L1 缓存
    u.setName(name);                    // 结果：标记 dirty，无需手动 update
}  // 事务提交 → flush → 自动生成 UPDATE SQL
```

### 2.3 游离态（Detached）

```java
// 目的：事务结束后实体变为游离态，修改不再被跟踪
User u;
try (var em = emf.createEntityManager()) {
    em.getTransaction().begin();
    u = em.find(User.class, 1L);     // 托管态
    em.getTransaction().commit();     // 此处关闭上下文
}
u.setName("Alice");  // 错误用法：游离态修改不会同步到 DB，无异常但数据丢失
```

### 2.4 移除态（Removed）

```java
// 目的：em.remove() 将托管实体标记为移除
@Transactional
public void deleteById(Long id) {
    User u = em.find(User.class, id);
    em.remove(u);  // 结果：实体进入 Removed 状态，flush 时发出 DELETE
}
// 错误用法：对游离态实体调 remove → IllegalArgumentException
```

## 三、脏检查（Dirty Checking）

### 3.1 触发时机

1. **事务提交前**（`@Transactional` 方法返回）
2. **查询前自动 flush**（Hibernate `FlushModeType.AUTO`）
3. **手动 `em.flush()`**

```java
// 目的：演示自动 flush 触发——查询前脏检查确保结果一致
@Transactional
public void demo() {
    User u = em.find(User.class, 1L);
    u.setAge(30);                         // 标记 dirty
    List<User> list = em.createQuery(       // 结果：先 flush UPDATE，再 SELECT
        "SELECT u FROM User u WHERE u.age=30", User.class)
        .getResultList();                   // 输出：list 包含刚改的 u
}
```

### 3.2 性能陷阱

- **大列表全托管** → flush 时逐字段比较快照：内存 + CPU 开销大
- 解决方案：`@Transactional(readOnly = true)` 跳过脏检查；或批量处理时定期 `em.clear()`

```java
// 目的：批量插入 10 万行时防止 OOM
@Transactional
public void batchInsert() {
    for (int i = 0; i < 100_000; i++) {
        em.persist(new User("u" + i, i));
        if (i % 500 == 0) {
            em.flush();   // 输出：每 500 条刷一次 SQL
            em.clear();   // 结果：清空 L1 缓存，释放内存
        }
    }
}
// 错误用法：不调 flush/clear → 全部堆积在持久化上下文 → OutOfMemoryError
```

## 四、merge 与 persist 区别

| 方法 | 参数状态 | 返回值 | 原对象 |
|------|----------|--------|--------|
| `persist(u)` | 瞬时 → 托管 | void | 本身变为托管 |
| `merge(u)` | 游离 → 新托管副本 | 托管副本 | 仍为游离 |

```java
// 目的：游离实体重新进入托管态
User detached = getFromCache();  // 说明：来自 Redis 的游离对象
User managed = em.merge(detached);  // 结果：返回新托管对象，后续用 managed
// 错误用法：merge 后继续修改 detached → 不同步到 DB
```

## 五、关联技术

- Spring `@Transactional` 传播机制
- Hibernate `Interceptor` / JPA `EntityListener`
- 二级缓存（Ehcache / Infinispan）
