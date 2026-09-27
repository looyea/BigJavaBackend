# 持久化上下文与实体状态 · 面试题

## 题 1：请解释 JPA 中 Persistence Context 的作用，与 MyBatis 的一级缓存有何异同？

**参考答案**：

Persistence Context 是 EntityManager 维护的实体池，具备三重职责：标识映射（同一事务内同 ID 返回同一对象）、脏检查（flush 时比较快照）、协调写入（按操作排序生成 SQL）。

与 MyBatis 一级缓存对比：
- 相同：作用域都是 SqlSession / 事务级别；都按语句执行后清空。
- 不同：MyBatis 缓存的是查询结果集（List），JPA 缓存的是实体对象图 + 快照；JPA 有写回能力（dirty → UPDATE），MyBatis 纯只读。

## 题 2：`em.persist()` 后一定立刻发 INSERT 吗？什么时候才真正执行？

**不一定**。persist 只是将瞬时实体纳入托管并分配 ID（若用 SEQUENCE 策略会提前取号）。真正的 INSERT 在 flush 时发出：
1. 事务提交前自动 flush；
2. JPQL 查询前自动 flush（FlushMode.AUTO）；
3. 手动 `em.flush()`。

但若使用 IDENTITY 主键生成策略，persist 会立即触发 INSERT 以获取数据库自增值——这是 SEQUENCE/TABLE 与 IDENTITY 的关键区别。

## 题 3：一个方法里查了 5000 条实体，为什么事务提交特别慢？如何优化？

**根因**：5000 个托管实体的快照比较。flush 时 Hibernate 对每个属性逐字段 diff，时间复杂度 O(n × fields)；加上持久化上下文占用大量堆内存，GC 压力大。

**优化手段**：
- `@Transactional(readOnly = true)` 跳过脏检查。
- 查询后 `em.clear()` 或 `session.setFlushMode(NEVER)`。
- 使用 DTO 投影（`SELECT new com.xx.ArticleDTO(a.title, a.author)`）——不产生托管实体。
- 分页 + Streamable 减少单次加载量。

## 题 4：merge 和 persist 分别在什么场景下使用？对返回值有什么要求？

| 场景 | 选择 | 原因 |
|------|------|------|
| 新建对象写库 | persist | 瞬时 → 托管，无需关心返回 |
| 从 Redis/前端传来的游离对象写回 | merge | 需要重新纳入管理，**必须用返回值** |

```java
// 目的：前端 PUT 更新，反序列化后为游离态
@PutMapping("/{id}")
public User update(@RequestBody User dto) {  // 游离态
    User managed = em.merge(dto);            // 返回托管副本
    managed.setUpdateTime(LocalDateTime.now()); // 只有 managed 的修改会被 flush
    return managed;
}
// 错误用法：persist(dto) 对游离对象抛 EntityExistsException 或 PersistenceException
```

## 题 5：Extended PersistenceContext 适合什么场景？它的风险是什么？

**适合**：多步向导表单（Wizard）、对话式流程——用户在多个 HTTP 请求间编辑同一组实体，中间事务可能提交/回滚，但实体始终保持托管。

**风险**：
- 持久化上下文跨事务 → 内存占用大，高并发下可能导致 OOM。
- 长时间持有数据库连接（绑定了 Spring 的 EntityManagerHolder）。
- 脏检查范围大，flush 代价高。
- 并发修改冲突概率增大（乐观锁 `@Version` 是必须的）。
