# RocketMQ 架构与存储模型

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：掌握 RocketMQ 四大组件协作流程、CommitLog 顺序写原理、ConsumeQueue 索引结构与主从/Dledger 高可用方案。

## 一、四大组件

```text
Producer → NameServer(路由) → Broker(存储) ← Consumer
                    ↑
         Broker 每 30s 注册心跳
```

| 组件 | 职责 |
|------|------|
| NameServer | 无状态路由中心，Topic→Broker 映射；各节点互不通信 |
| Broker | 消息存储与投递主体；Master 可写，Slave 只读 |
| Producer | 发消息：选 Topic → 从 NameServer 取 QueueList → 轮询/哈希选队列 |
| Consumer | 拉消息：从 Broker 长轮询 pull → 本地消费 → 提交 offset |

## 二、存储模型

### 2.1 CommitLog（核心）

```text
所有 Topic 的消息混合追加写入同一个 CommitLog 文件（1GB/个）
├── commitlog
│   ├── 00000000000000000000  (第一个文件，文件名=起始偏移量)
│   ├── 000000001073741824
│   └── ...
```

```java
// 目的：演示消息写入 CommitLog 的物理结构
// 消息格式：总长度(4B) | MagicCode(4B) | 序列化体 | ... | Topic | QueueId | 存储时间戳
// 结果：顺序写磁盘，SSD 下顺序写可达 ~600MB/s
// 错误用法：大量小消息(128B) → 虽然顺序写但 fsync 频率成瓶颈 → 需 group commit
```

**写入策略**：
- **同步刷盘（SYNC_FLUSH）**：`flushDiskType=SYNC_FLUSH` → 每条消息 fsync 后才返回 ACK。金融级可靠但吞吐低。
- **异步刷盘（ASYNC_FLUSH）**：写入 PageCache 即返回，后台线程批量 fsync。默认，吞吐高。

### 2.2 ConsumeQueue（逻辑队列索引）

```text
ConsumeQueue 文件结构：每个条目 20B 定长
├── topic_test / 0 / 00000000000000000000
└── 每条记录：CommitLog Offset(8B) | Size(4B) | Tag HashCode(8B)
```

```java
// 目的：Consumer 拉消息时通过 ConsumeQueue 定位 CommitLog 物理位置
// 流程：Consumer 给出 queueOffset → Broker 查 ConsumeQueue 得 (physOffset, size)
//      → 从 CommitLog physOffset 读出完整消息
// 输出：定长 20B 使 queueOffset = index × 20，O(1) 定位
// 说明：ConsumeQueue 由 ReputMessageService 异步构建（~ms 级延迟）
```

### 2.3 IndexFile（按 Key 查询）

类似 HashMap + 链表冲突解决，按 Message Key 哈希定位物理 offset，支持控制台按 Key 查消息轨迹。

## 三、主从与高可用

### 3.1 传统 Master-Slave

- Master：可读写；Slave：只读，定时从 Master 拉 CommitLog（异步复制）。
- Slave 落后 Master 几条消息；Master 挂后 Slave 可读但不可写（丢新消息风险）。

### 3.2 Dledger（DLedger = Raft）

```text
3 节点组：Leader(可写) + Follower × 2
选举：Raft 过半投票 → Leader 挂后 ~3s 选出新 Leader
复制：CommitLog 条目经 Leader → Follower 多数确认后 ACK Producer
```

```yaml
# 目的：Broker 开启 Dledger 模式
brokerConfig:
  brokerRole: SLAVE_SYNCING  # 说明：Dledger 自动管理角色
  enableDledgerStore: true   # 结果：CommitLog 切换为 Dledger 日志存储
  enableControllerMode: false # 4.x 用 Dledger；5.x 用 Controller 替代
```

## 四、消息拉取流程

```java
// 目的：Consumer 长轮询拉取消息的核心代码路径
DefaultMQPushConsumer consumer = new DefaultMQPushConsumer("group1");
consumer.subscribe("TopicTest", "*");  // 订阅全部 Tag
// 内部流程：
// 1. PullMessageService 线程发 PullMessage 到 Broker
// 2. Broker 若无新消息 → hold 住连接 15s（长轮询）
// 3. 新消息到达 → 立即返回
// 输出：Consumer 本地 MessageListener 回调消费
consumer.start();
```

## 五、关联技术

- NameServer 集群无状态：部署多个互不通信
- Broker 配置 `mapedFileSizeCommitLog=1G`（可缩至 256M 适应云盘）
- TransientStorePool（堆外内存预分配 → 写 → Commit 到 PageCache）
- RocketMQ 5.x 引入 Controller + Proxy 层替代 Dledger
