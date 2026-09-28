# AT 模式与全局锁 · 面试题

## 题 1：AT 和 TCC 的本质区别？

| 维度 | AT | TCC |
|------|----|----|
| 侵入性 | 零（只需 undo_log） | 高（需手写 Try/Confirm/Cancel） |
| 回滚方式 | 自动（框架生成反向 SQL） | 手动（Cancel 方法业务逻辑） |
| 性能 | 有全局锁开销 | 无全局锁（Try 阶段加业务锁） |
| 适用 | CRUD 型微服务 | 资金/库存需资源预留 |

## 题 2：undo_log 膨胀如何处理？

- 根因：长事务未结束 → 大量 branch 的 undo 待清理。
- 排查：`SELECT count(*), xid FROM undo_log GROUP BY xid ORDER BY count DESC LIMIT 10`。
- 解决：① 缩短全局事务边界（只包必要逻辑）；② 调整 undo_log_delete_period（默认 24h）；③ 手动清理已完成事务的孤立 undo。

## 题 3：全局锁等待超时怎么优化？

```java
// 目的：减少全局锁竞争
// 方案 A：拆细事务粒度——让不同请求修改不同行（分库分表键设计）
// 方案 B：热点行用 TCC 代替 AT（避免全局锁）
// 方案 C：增大 lockRetryInterval + lockRetryTimes（不推荐——治标）
// 错误用法：全局事务内套循环逐行 UPDATE 100 次 → 持 100 行锁 → 大面积竞争
```

## 题 4：AT 模式能用于分库分表场景吗？

可以，但需注意：
- 每个分片库都要建 undo_log 表。
- 全局锁按 `resource_id(库标识) + table_name + pk` 唯一 → 跨库不冲突。
- ShardingSphere + Seata 集成：Seata 代理数据源需在分片层之下。

## 题 5：Seata AT 对 MySQL Binlog 有什么要求？

- 建议 `binlog_format=ROW`（精确记录行变更，undo 的 image 比对更可靠）。
- 至少 `binlog_retention_hours` 足够长（用于极端场景下从 Binlog 恢复）。
- 必须开启 InnoDB 事务引擎。

## 题 6：XID 传播链路是怎样的？

```text
TM(@GlobalTransactional) → Seata 生成 XID → RootContext.bind(xid)
→ Feign 拦截器：RequestHeader "TX_XID" = xid → 传递到下游
→ 下游 Filter：RootContext.bind(xid from header) → RM 注册 Branch
→ Dubbo/gRPC：同理通过 attachment/metadata 传播
```
