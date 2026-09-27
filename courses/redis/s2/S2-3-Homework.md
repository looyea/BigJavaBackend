# 作业题 · 大 Key、热 Key 与内存治理

> 作业不判分，做完对照参考答案自查。需要本地 Redis（可 docker），部分题需两台终端（一压测一观测）。

## 作业 1：DEL vs UNLINK 卡顿实测（必做）

```bash
redis-cli -n 9 HSET big $(for i in $(seq 1 1000000); do echo -n "f$i v$i"; done) 2>/dev/null   # 造 100 万域大 Hash（正确：终端里逐条太长可写脚本灌）
redis-cli -n 9 --latency &                         # 后台持续测延迟基线
time redis-cli -n 9 DEL big                         # 错误用法示范：同步删（预期卡顿数百 ms，--latency 出现尖刺）
redis-cli -n 9 --latency &                         # 重新观察基线
time redis-cli -n 9 UNLINK big                      # 正确：立即返回、后台回收（预期毫秒级）
```

注释贴两次的耗时与延迟曲线差异，解释"单线程 O(n) 命令伤及无辜"。

## 作业 2：近似 LRU 与采样数（必做）

`maxmemory 50mb`、灌 5 万个 1KB key，A 组 `maxmemory-samples 5`、B 组 `10`，各制造"一次性扫描 1 万个冷 key"的刷屏流量后再灌新数据，统计被淘汰 key 中"真实最久未用"的占比。

**参考答案要点**：samples 越大越接近真 LRU（命中率损失越小）但淘汰更耗 CPU；LFU 策略下"一次刷屏"晋升的 key 更少（衰减机制）——复测对比。

## 作业 3：热 Key 定位与本地缓存改造（必做）

压测流量：1 个爆款 key 占 80% QPS + 10 万长尾。切 `maxmemory-policy allkeys-lfu`，用 `redis-cli --hotkeys` 验证能圈出爆款；给爆款加 Caffeine（TTL 200ms）后复测 Redis QPS。

注释记录：加本地缓存前后 Redis 的 QPS、P99 对比；讨论 200ms 陈旧窗口对业务是否可接受（呼应 s2-2 分级）。

## 作业 4：大 Key 拆分改造（选做）

把"全量城市字典"大 Hash（50 万域）拆成 `city:{shard 0..31}`（field 哈希路由），实现 `getCity/setCity` 透明路由层，压测 `HGETALL` 场景改为"按分片并发 + 本地合并"的延迟变化。

**参考答案要点**：读写都不再单命令 O(n)；注意拆后"原子性"消失（跨分片无事务），业务上字典类读多写少可接受。

## 作业 5：碎片与水位巡检脚本（选做）

写脚本每分钟采集 `INFO memory` 的 used_memory / maxmemory / mem_fragmentation_ratio / evicted_keys，超阈值（水位 70%、碎片 1.5、evicted 增速异常）输出告警。

**参考答案要点**：evicted_keys 持续增长=容量不足或 TTL 设计失衡，比"内存满"更早暴露问题；把三指标接入团队看板即完成"治理常态化"。
