# 持久化与高可用架构

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：分清 **RDB（快照，fork+COW，恢复快、会丢数据）与 AOF（追加日志，appendfsync 三档、体积大恢复慢）** 及 7.x **混合持久化**（AOF rewrite 时头部存 RDB 体）；理解 **主从复制**的全量/增量（backlog、replid、`psync2` 断线续传）链路；掌握 **Sentinel 哨兵**（监控/选主/多数派投票自动 failover）解决"主挂了谁来顶"，以及 **Cluster 分槽**（16384 slot、MOVED/ASK 重定向、`CLUSTER SETSLOT IMPORTING/MIGRATING` 迁移）解决"单机容量与写扩展"。落点在金融"缓存可否重建"与电商大集群拓扑取舍。

## 一、RDB：快照的快与狠（★★★★☆）

`SAVE`/`BGSAVE` 生成二进制快照。**fork 子进程 + 写时复制（COW）**：父进程继续服务，子进程持有内存"影像"写盘。

```bash
# 例子目的：配置 RDB 触发策略并理解 fork 瞬间的内存风险
redis-cli CONFIG SET save "3600 100 300 10 60 10000"   # 1h内≥100改/5min内≥10改/1min内≥1万改 各触发一次 BGSAVE（正确：多档兜底）
redis-cli BGSAVE                                        # 手动触发（正确返回 Background saving started）
redis-cli -h replica LASTSAVE                           # 看上次成功快照 Unix 时间戳，监控用（正确：以"是否推进"判活，而非进程活着）
# 正确使用结果：恢复大实例时 RDB 直接加载，远快于重放 AOF
# 错误用法：40G 大实例 + 写繁忙 + maxmemory 贴近物理内存 → fork 无法保证 2 倍虚拟地址空间预留失败/ COW 页复制洪峰 OOM（大内存实例关 RDB 或上 AOF-only）
```

> RDB 的代价就是**两个"怕"**：怕 fork 瞬间内存紧张（COW）、怕宕机丢掉最后一次快照之后的写（分钟级）。

## 二、AOF 与混合持久化（★★★★☆）

AOF 记录写命令：`appendfsync always`（每命令 fsync，安全但慢）/ **`everysec`（默认，最多丢 1 秒）** / `no`（交给 OS）。文件膨胀靠 **AOF rewrite** 用当前数据反推最小命令集（子进程执行，新写进 aof_rewrite_buf 合并）。

```bash
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec                  # 默认档（正确：金融可 always+电池备份缓存的 SSD，一般业务 everysec）
redis-cli CONFIG SET aof-use-rdb-preamble yes              # 7.x 默认开：rewrite 时头部用 RDB 二进制体（正确：兼顾 RDB 加载速度与 AOF 丢数据窗口）
redis-cli CONFIG SET auto-aof-rewrite-min-size 1gb         # AOF 超 1G 且翻倍才 rewrite（防小文件频繁重写）
# 正确使用结果：重启加载"RDB 头 + 增量 AOF 命令"，恢复速度与数据安全双赢
# 错误用法：always + HDD → fsync 成为吞吐瓶颈，延迟毛刺全来自磁盘（先问硬件再谈档位）
```

## 三、主从复制：全量与增量（★★★★☆）

```flow
新从上线（目的：看清全量与断线续传两条路径）
全量：从 REPLICAOF → 主 BGSAVE 快照 + 记录期间写缓冲 → 传输应用 → 进入命令流实时回放
断线重连：psync2 比对 replid+offset → 差异仍在 backlog 环形缓冲内 → 部分重同步（只补缺口）
                                    缺口被挤出 backlog → 退化为全量（replica rebootstrap，大实例灾难）
```

- 主从**不做分片**：每个从都是全量数据；写只走主，读可散到从。
- `repl-backlog-size` 要按"复制带宽 × 可容忍断线时长"调大，避免频繁全量再压垮主库。

## 四、Sentinel：谁来顶掉死掉的主（★★★☆☆）

哨兵集群（≥3、奇数）做三件事：**监控**（每 10s ping 探活）、**主观下线→客观下线**（达到 quorum 的哨兵同意才判死，防网络抖动误杀）、**自动故障转移**（哨兵间 Raft 式选 leader → 按优先级/复制进度选新主 → 通知其它从库改指向 → 旧主复活降为从）。客户端通过哨兵拿到当前主地址（`SENTINEL get-master-addr-by-name`）。

## 五、Cluster：分槽扩容（★★★★☆）

16384 个 slot 分摊到多个主节点；key 经 `CRC16(key) mod 16384` 定位（`{tag}` 可强制多 key 同槽）；客户端缓存槽表，收 **MOVED**（槽已迁走，更新表重试）/**ASK**（迁移进行中，去目标试一次）重定向。

```bash
redis-cli --cluster create 10.0.0.1:7001 10.0.0.2:7002 10.0.0.3:7003 10.0.0.4:7001 \
  10.0.0.5:7002 10.0.0.6:7003 --cluster-replicas 1     # 3 主 3 从一键建群（正确：主数 ≥3 才有 quorum 可自动 failover）
redis-cli -c -p 7001 SET user:100 v                     # -c 开启客户端重定向（正确：生产要用支持 Cluster 的客户端 Lettuce/Jedis Cluster）
redis-cli -p 7001 SET user:100 v                        # 错误用法：不带 -c/集群客户端，恰好 key 不在本槽 → 直接 (MOVED 5xxx 10.0.0.2:7002) 报错给业务
redis-cli CLUSTER KEYSLOT "order:{100}:item"            # 1234（正确：{100} 做 hash tag，让订单主/子行同槽才能多 key 操作）
# 错误用法：滥用 hash tag 把百万 key 塞同一槽 → 单节点热点，分片名存实亡
```

> 边界：Cluster 下 **MGET/LUA/事务跨槽受限**；无全局 `DBSIZE` 语义；rebalance 迁移按 slot 原子搬迁。为何 16384=2^14：心跳包携带槽位图仅 2KB 可接受，且实用集群规模上限约千节点。

## 六、选型：单机 / 主从 / 哨兵 / Cluster（★★★★☆）

| 形态 | 解决 | 典型场景 |
| --- | --- | --- |
| 主从（手动） | 读扩展 + 数据冗余 | 低峰可人工切换的小业务 |
| Sentinel | **自动 failover** | 容量单机能扛、可用性要求高（金融单点大内存常见） |
| Cluster | **写扩展 + 容量** | 电商海量 key（>10G 热数据）、读多写多 |

## 七、动手题

1. 分别 `kill -9` 后重启，对比"只有 RDB / 只有 AOF everysec / 混合"三种配置丢了多少秒数据。
2. 搭一主一从，拔网线 60s 再恢复，用 `INFO replication` 的 `master_repl_offset` 观察是部分重同步还是全量。
3. 用 `--cluster create` 建 3 主 3 从，验证跨槽 MGET 报错与 `{tag}` 修复。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| BGSAVE 期间实例 OOM | fork COW 洪峰 + maxmemory 贴顶；大实例慎用 RDB |
| 从库反复全量同步 | backlog 太小 / 主从 replid 断裂，扩 `repl-backlog-size` |
| 主从切换后短暂双主 | 旧主网络分区复活未被 fencing，哨兵配置 `priority` 与最小从数防脑裂 |
| Cluster 里事务报错 CROSSSLOT | 多 key 不同槽，用 `{tag}` 或改单 key 设计 |
| 宕机后缓存全丢引发回源风暴 | 把"可重建"当"不需要持久化"，重建风暴压垮 DB（缓存雪崩，s2-1） |

## 九、关联技术栈

- **向前**：编码决定 value 大小、影响 fork/COW 成本 ↔ s1-1
- **向后**：热 Key 打爆单分片 ↔ s2-3；缓存全丢的回源风暴 ↔ s2-1
- **横向**：Redis 高可用 vs MySQL MGR 的 quorum 思想一致 ↔ mysql s3-2；Lettuce/Redisson 对 Cluster/Sentinel 的支持 ↔ lettuce/redisson 包

## 十、本节小结

持久化两条路：**RDB 快照**（fork+COW，恢复快、分钟级丢数据、大实例怕 fork）与 **AOF 日志**（everysec 折中、rewrite 防膨胀），7.x **混合持久化**兼得两者；高可用三层递进：**主从**给冗余与读扩展（psync2 + backlog 断线续传防全量风暴）、**Sentinel** 用多数派投票+选主实现自动 failover、**Cluster** 以 16384 slot + MOVED/ASK 重定向实现写扩展，代价是跨槽操作受限（hash tag 治标、滥用成热点）。选型口径：容量够就 Sentinel，要扩容才 Cluster——持久化开关则是"重启后还能不能扛"的底线问题，不是可选项。
