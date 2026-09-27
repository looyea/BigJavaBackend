# 持久化上下文与实体状态 · 作业

## 作业 1：实体状态观察日志

**目标**：在一个 Spring Boot 项目中观察实体在不同阶段的状态变化。

**要求**：
1. 创建 `Article` 实体（id/title/content），使用 `@GeneratedValue(IDENTITY)`。
2. 编写一个 `@Transactional` 方法，依次执行：new → persist → flush → clear → 再次修改 name。
3. 在每步之后打印 `em.contains(entity)` 的结果和 `entity.getId()` 的值。
4. 观察 clear 后修改 title 是否产生 UPDATE SQL（开启 `show_sql=true`）。

**提交**：截图控制台输出 + 贴出代码。

## 作业 2：批量导入优化

**目标**：将 50 万条 CSV 数据导入数据库，对比两种方案的耗时与内存占用。

**方案 A**：逐条 `em.persist()`，不做 flush/clear。

**方案 B**：每 500 条执行 `em.flush()` + `em.clear()`，并设置 `hibernate.jdbc.batch_size=50`。

**要求**：
1. 记录两种方案的总耗时和峰值堆内存（JVisualVM 或 `-Xlog:gc`）。
2. 分析方案 A 报 OOM 或超时的原因（与持久化上下文快照的关系）。
3. 给出方案 B 为什么内存恒定的解释。

## 作业 3：merge 陷阱复现

**目标**：复现"merge 后修改原对象导致更新丢失"的经典 Bug。

```java
// 目的：观察 merge 返回值与原对象的关系
User detached = userRepository.findByIdFromCache(1L); // 从 Redis 反序列化得到游离对象
User managed = em.merge(detached);
detached.setName("WRONG");  // 错误用法：修改游离对象，不会被脏检查跟踪
managed.setName("RIGHT");   // 结果：只有此处修改会被 flush 到 DB
```

1. 运行后查 DB 中 name 字段值。
2. 将 `detached.setName("WRONG")` 放在 merge 之前，观察结果是否变化。
3. 写出你对"merge 返回新对象"的理解。
