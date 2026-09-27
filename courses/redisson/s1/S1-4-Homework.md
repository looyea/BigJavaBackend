# 作业题 · 与 Lettuce 协同及分布式锁落地边界（关联）

> 作业不判分，做完对照参考答案自查。需要同一工程同时引 `spring-boot-starter-data-redis` 与 `redisson-spring-boot-starter`。

## 作业 1：跨客户端 codec 互通（必做）

```java
// 例子目的：Redisson RAtomicLong 写计数，RedisTemplate 读同一 key
// 阶段A（错误用法）：Redisson 默认 codec → redisTemplate.opsForValue().get("cnt") 返回乱码/null
// 阶段B（正确）：Redisson 配 StringCodec 后重跑 → RedisTemplate 读到干净的数字字符串
RAtomicLong cnt = redisson.getAtomicLong("cnt"); cnt.incrementAndGet();  // 正确使用结果：两侧字节可互读，验证"共读 key 必须对齐 codec"
```

注释贴阶段 A/B 两次 `GET cnt`（redis-cli）与 RedisTemplate 读到的值，说明差异根因。

## 作业 2：锁粒度吞吐对比（必做）

实现一个"扣库存"接口两版：粗粒度 `redisson.getLock("stock:lock")` vs 细粒度 `getLock("stock:lock:" + skuId)`，50 线程对不同 skuId 并发压测，记录 QPS。

**参考答案要点**：粗锁把所有 sku 串行化、QPS 极低且随 sku 数无提升；细锁不同 sku 并行、QPS 显著上升——"锁到资源级"是吞吐前提。

## 作业 3：锁降级路径验证（必做）

在作业2细锁版加 `tryLock(50ms, 3000ms)` + 拿不到降级到 DB 乐观锁（`UPDATE ... SET stock=stock-? WHERE id=? AND stock>=?`）。压测中**手动停掉 Redis**，观察业务是否仍能通过降级路径正确扣减、无超卖。

**参考答案要点**：Redis 挂→拿不到锁→自动落到 DB 乐观锁，正确性由 DB 条件更新保证；证明"锁是降压、DB 是兜底"的分层，业务不因 Redis 故障全线不可用。

## 作业 4：误解锁保护复现（选做）

写一段"没抢到锁也在 finally 无条件 `unlock()`"的代码，观察抛 `IllegalMonitorStateException`；改成 `if (got && lock.isHeldByCurrentThread()) unlock()` 复测正常。

**参考答案要点**：只解自己持有的锁是 unlock 铁律；否则线程 A 的超时锁被线程 B 抢走后，A 醒来 unlock 会误删 B 的锁 → 连锁互斥破坏。

## 作业 5：锁使用规范评审（选做）

审你司现有加锁代码，按本课清单打分：① 单实例却用了分布式锁？② 终值正确性依赖锁而非 DB？③ 锁粒度过粗？④ 无 tryLock 超时/无降级？⑤ unlock 未判持有者？列 top3 风险与整改建议。

**参考答案要点**：产出体现"能不锁就不锁、正确性别压给锁、锁要细 + 有界 + 可降级 + 安全释放"的边界认知。
