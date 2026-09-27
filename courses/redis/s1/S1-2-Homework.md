# 作业题 · 持久化与高可用架构

> 作业不判分，做完对照参考答案自查。需要 3~6 个 redis 实例（docker 起最方便）。

## 作业 1：丢数据窗口实测（必做）

写循环脚本每秒 `INCR counter`，分别在三种配置下 `kill -9` 再重启：① 只有 RDB（save 默认）；② AOF everysec；③ AOF always。记录 counter 重启后的值与预期差。

注释说明：三种档位的丢数据窗口各是多少、always 在机械盘上 TPS 掉到多少。

## 作业 2：主从部分重同步观察（必做）

搭一主一从，调小 `repl-backlog-size 1kb`，从库 `CLIENT PAUSE 30000`（或 iptables 断网）制造断线，期间主库持续写 10 万条；恢复后在两库 `INFO replication` 看 `master_sync_full_ok`（全量）还是 `master_sync_partial_ok`（增量）。再把 backlog 调大重做一遍对比。

注释记录：什么条件决定"能续传还是全量"（replid 一致 + offset 仍在 backlog 窗口内）。

## 作业 3：Sentinel 自动故障转移（必做）

一主两从 + 3 哨兵，`kill -9` 主库，观察哨兵日志：SDOWN→ODOWN（quorum）→选 leader→选举新主（依据 replication offset 与 priority）→其它从改指向→客户端 `SENTINEL get-master-addr-by-name` 返回新地址。

**参考答案要点**：全程 10~30s；旧主复活后自动成为新主的从库——注意 `min-replicas-to-write` 可让孤立旧主拒绝写，防双主窗口。

## 作业 4：Cluster 建群与跨槽验证（必做）

```bash
# 例子目的：亲眼看 MOVED 重定向与 hash tag 的同槽效果
redis-cli --cluster create 127.0.0.1:{7000..7005} --cluster-replicas 1 --cluster-yes   # 3主3从
redis-cli -p 7000 MGET user:1 user:2      # 错误用法预期：(error) CROSSSLOT Keys in request don't hash to the same slot
redis-cli -p 7000 MGET u:{1}:name u:{1}:age   # 正确：{1} 同 tag → 同槽，MGET 成功
redis-cli -p 7000 CLUSTER KEYSLOT "u:{1}:name"  # 与手工预期比对（花括号内子串参与哈希）
```

注释贴出两条 MGET 的不同结果与 KEYSLOT 值。

## 作业 5：COW 内存尖峰复现（选做）

小内存容器（如 300M）跑 200M 数据集的 Redis，开着 `save ""` 手动 `BGSAVE` 的同时全速写入，观察容器 OOMKilled。

**参考答案要点**：fork 后写入越猛、被复制页越多，内存=基础+脏页副本；治理：加大 maxmemory 余量 / 错峰持久化 / 大实例改用副本做快照。
