# RocketMQ 架构与存储模型 · 作业

## 作业 1：本地部署与 CommitLog 观察

**目标**：单机部署 NameServer + Broker，观察消息写入后文件变化。

1. 下载 RocketMQ 5.x，启动 NameServer（端口 9876）和 Broker（默认配置）。
2. 用 Dashboard 创建一个 Topic `test_topic`（4 队列）。
3. 用 `mq-producer` 发送 100 条消息。
4. 进入 `~/store/commitlog/` 目录，观察文件大小与 mtime 变化。
5. 进入 `~/store/consumequeue/test_topic/0/`，用 `hexdump -C` 查看前 40B（2 条记录）。

**验收**：提交 hexdump 截图并标注 Offset/Size/TagHash 三个字段位置。

## 作业 2：刷盘与复制策略性能对比

**目标**：对比四种配置下 Producer 发送 1 万条消息的耗时。

| 配置 | 预期 |
|------|------|
| ASYNC_FLUSH + ASYNC_MASTER | 最快 |
| SYNC_FLUSH + ASYNC_MASTER | 受 fsync 限制 |
| ASYNC_FLUSH + SYNC_MASTER | 受网络复制延迟 |
| SYNC_FLUSH + SYNC_MASTER | 最慢最可靠 |

修改 broker.conf 分别启动，用 JMeter 压测并记录 TPS 和 99 分位延迟。

## 作业 3：Dledger 集群搭建

**目标**：本地 3 Broker 组成 Dledger 组，验证 Leader 切换。

1. 启动 3 个 Broker（不同端口、不同 dataPath），配置 `enableDledgerStore=true`。
2. 观察日志确认 Leader 选举完成。
3. Producer 持续发消息，kill Leader 进程。
4. 记录重新选举耗时和消息是否丢失。
