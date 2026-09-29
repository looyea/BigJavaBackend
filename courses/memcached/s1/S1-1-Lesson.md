# Slab 架构与与 Redis 的对比

> 本节难度：★★☆☆☆
> 重要程度：★★☆☆☆
> 学习产出：理解 Memcached 的 Slab/Chunk 内存管理机制、LRU 淘汰策略，以及它为什么在功能与灵活性上被 Redis 取代。

## 一、Memcached 架构设计

### 1.1 定位与核心特征

Memcached 是纯内存 KV 缓存，设计目标：**简单、多线程、高吞吐**。无持久化、无主从、无数据结构（只存 bytes）。

```text
目的：展示 Memcached 的整体请求处理模型
Client → TCP 连接池 → [N 个 Worker Thread 各自 epoll] → 全局 Slab 分配器 → 内存页
                                                            ↓
                                                   全局 LRU / Chunk 复用
```

### 1.2 Slab 分配器

Memcached 解决"频繁 malloc/free 导致内存碎片"的方案：

```flow
目的：展示 Slab 分层分配机制——按大小分级避免外部碎片
Slab Class 1: chunk_size=96B  → 1MB page 分 10923 个 chunk → 存 ≤96B 的 item
Slab Class 2: chunk_size=120B → 1MB page 分 8738 个 chunk  → 存 97~120B 的 item
...
Slab Class N: chunk_size=X    → 超过最大 chunk 的 item 拒绝存或单独大页
```

- **Page**：默认 1MB 连续内存块，分配给某个 Slab Class 后不再改属。
- **Chunk**：Page 内按该 Class 的 chunk_size 等分。
- **Item**：用户数据放在 Chunk 中，超出 Chunk 大小时借用下一页（Limited Item / Linked List Item）。

```c
/* 目的：Slab 分配伪代码——展示 item 如何找到对应 class */
/* 错误用法: 预设 chunk 大小梯度不合理 → 大量 item 跨 class 浪费空间 */
/* 反例: 存 1MB value → 需要 10923 个 96B chunk 的链表，性能极差 */
int slab_clsid_for_size(size_t nbytes) {
    for (int i = 0; i < POWER_SIZE; i++) {
        if (slab_class[i].chunk_size >= sizeof(item) + nbytes)
            return i;  // 结果：返回第一个能容纳的 class
    }
    return -1;  // 错误：超过最大 class → 拒绝存入
}
```

### 1.3 多线程模型

- 1 个 Listener 线程接受连接 → 分发到 N 个 Worker 线程。
- 每个 Worker 独立 epoll 事件循环，处理请求。
- Slab 分配器用全局互斥锁保护（性能瓶颈，高并发时锁争抢）。

## 二、淘汰策略

- **LRU（全局）**：内存满时按最后访问时间淘汰最久未用 item。
- **Slab 内部 LRU**：每个 Chunk 空闲链表，分配优先复用。
- 无 TTL 主动清理：过期 item 在被访问时惰性删除（lazy expiration）。
- 不支持"按大小/按频率"等精细策略（对比 Redis 的 8 种 maxmemory-policy）。

## 三、与 Redis 的核心对比

| 维度 | Memcached | Redis |
|------|-----------|-------|
| 数据结构 | 仅 bytes KV | String/Hash/List/Set/ZSet/Stream/... |
| 持久化 | 无 | RDB + AOF |
| 高可用 | 无（客户端一致性哈希分片） | 主从/哨兵/Cluster |
| 线程模型 | 多线程 | 单线程（6.0+ IO 多线程） |
| 内存管理 | Slab/Chunk/Page | jemalloc + 各类编码转换 |
| 淘汰策略 | 全局 LRU | 8 种可配（LRU/LFU/noeviction...） |
| 最大 Value | 1MB | 512MB |
| 集群方案 | 客户端分片（一致性哈希） | 原生 Cluster（16384 slot） |
| 适用 | 纯缓存、超大 key 量、极简场景 | 通用（缓存 + 数据结构 + 分布式锁等） |

## 四、为什么 Memcached 逐渐退场

1. **无持久化**：重启全部丢失；Redis 可 AOF 保证不丢。
2. **无主从/集群**：高可用靠客户端，扩缩容需 rehash 全量 key。
3. **数据结构单一**：复杂业务（排行榜/计数器/分布式锁）需应用层实现。
4. **多线程 Slab 锁瓶颈**：高并发时性能不如单线程无锁的 Redis。
5. **生态迁移**：新一代项目默认选 Redis；Memcached 仅存于老旧系统。

## 五、Memcached 仍有价值的场景

- 超大 key 量 + 简单 KV（Session Store）：多线程模型天然利用多核。
- 不需要数据结构与持久化的纯读缓存层。
- 历史系统兼容：老 PHP/Java 项目大量使用 Memcached 客户端，短期迁移成本高。
