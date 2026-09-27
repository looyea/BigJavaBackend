# N+1 与抓取策略 · 作业

## 作业 1：N+1 检测与修复

**目标**：在给定项目中定位并修复所有 N+1 问题。

**步骤**：
1. 克隆示例仓库，开启 `logging.level.org.hibernate.SQL=DEBUG` 和 `hibernate.generate_statistics=true`。
2. 调用 `/api/orders` 接口，统计日志中的 SELECT 数量。
3. 使用三种方案分别修复（JOIN FETCH / @EntityGraph / @BatchSize），记录每种方案的 SQL 条数。
4. 对比修复前后响应时间。

**验收**：SQL 条数从 1+N 降到 ≤ 3。

## 作业 2：分页 + 关联查询方案选型

**场景**：电商后台订单列表，分页 20 条/页，每行展示"买家名"和"商品件数"。

**要求**：
1. 分析为什么不能直接 `JOIN FETCH o.customer + Pageable`。
2. 给出两种可行方案：
   - 方案 A：先查分页 IDs，再 `WHERE id IN (:ids)` + EntityGraph 二次查。
   - 方案 B：JPQL 投影 `SELECT new OrderVO(o.id, c.name, SIZE(o.items))`。
3. 实现方案 A，用 `@DataJpaTest` 验证 SQL 数量为 2 条。

## 作业 3：OSIV 开关实验

**目标**：验证 `spring.jpa.open-in-view=false` 后 N+1 异常暴露的位置。

1. 关闭 OSIV，调用返回 `Order`（含 LAZY customer）的 Controller。
2. 观察 Jackson 序列化时报 `LazyInitializationException` 的堆栈。
3. 使用 DTO + `@EntityGraph` 修复，不再报异常。
4. 写出你对 OSIV 是"掩盖问题而非解决问题"的论证。
