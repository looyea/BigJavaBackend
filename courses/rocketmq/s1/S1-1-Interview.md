# RocketMQ 架构与存储模型 · 面试题

## 题 1：为什么 RocketMQ 用混合 CommitLog 而不是按 Topic 分文件？

按 Topic 分文件 → 写磁盘变成多文件随机写（磁头寻道），吞吐急剧下降。混合 CommitLog 保证**单文件顺序追加**，利用 SSD/HDD 顺序写性能。代价：读消息需通过 ConsumeQueue 二次定位。

## 题 2：ConsumeQueue 是如何构建的？延迟多久可用？

ReputMessageService 后台线程不断从 CommitLog 增量读取新写入的消息，解析出 topic/queueId/offset/size/tagHash → 追加到对应 ConsumeQueue 文件。正常延迟 < 1ms；高负载可配置 `transientStorePoolEnable` 提升写性能。

## 题 3：RocketMQ 如何保证消息不丢？从三个环节分析

| 环节 | 保证手段 |
|------|----------|
| Producer → Broker | 同步发送 + 重试 2 次 + 事务消息 |
| Broker 存储 | SYNC_FLUSH + SYNC_MASTER（双写确认） |
| Broker → Consumer | Consumer 手动 ACK（CONSUME_SUCCESS 才提交 offset） |

任一环用异步/自动确认 → 都可能丢。

## 题 4：NameServer 挂了怎么办？

NameServer 无状态且互不通信。Producer/Consumer 本地缓存路由表，只要有一个 NameServer 存活即可工作。全部挂掉后已有连接仍可收发消息（直连 Broker），直到 Broker 心跳变化无法感知。

## 题 5：Dledger 和 Controller 模式的区别？

- **Dledger**（4.x）：CommitLog 底层替换为 DLedger（Raft 日志），Broker 自带选举，运维需保证 3 节点同组。
- **Controller**（5.x）：将选主逻辑抽到独立 Controller 集群，Broker 仍用原生 CommitLog + 异步复制，减少存储层改造。优势：Broker 代码与单 Master 一致；故障切换秒级但吞吐高于 Dledger 同步复制。

## 题 6：消息堆积百万条时如何紧急处理？

```java
// 目的：临时扩容 Consumer 并行消费
// 方案 1：增加 Consumer 实例（前提：Queue 数 ≥ 实例数）
// 结果：消费组自动 Rebalance，每个实例分到 Queue
// 方案 2：新建临时 Topic + 批量转发 Consumer（轻量逻辑）→ 多实例并行
DefaultMQPushConsumer tempConsumer = new DefaultMQPushConsumer("temp_group");
tempConsumer.subscribe("堆积Topic", "*");
tempConsumer.registerMessageListener((msgs, ctx) -> {
    // 输出：只做转发不做重逻辑 → 快速消化
    tempProducer.sendBatch(convert(msgs));  // 结果：转到新 Topic 多队列
    return CONSUME_SUCCESS;
    // 错误用法：此处 sleep(1s) 模拟重逻辑 → 反而降低消化速度，应只做轻量转发
});
```

## 题 7：TransientStorePool 原理及适用场景？

堆外内存池（DirectByteBuffer）预分配 5GB → 消息先写堆外 → CommitService 批量 copy 到 FileRegion（PageCache）→ 刷盘。减少 JVM GC 对写入路径的干扰，适合大消息体 + 高吞吐场景。开启配置：`transientStorePoolEnable=true` + `flushDiskType=ASYNC_FLUSH`。
