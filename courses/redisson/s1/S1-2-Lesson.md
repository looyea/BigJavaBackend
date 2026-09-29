# RedLock 争议与读写锁/信号量/闭锁

> 本节难度：★★★★★
> 重要程度：★★★★★
> 学习产出：① 讲清 **RedLock（红锁）** 要解决的"主从异步复制丢锁"问题与算法（向 N 个**独立** Redis 实例逐个加锁、过半成功且总耗时 < lease 才算持锁），并**客观呈现 antirez 与 Martin Kleppmann 的世纪论战**（GC 停顿 / 时钟漂移 / 无 fencing token 导致红锁仍不保证互斥），给出"多数业务用不用红锁"的判断；② 掌握 Redisson 另一组同步器：`RReadWriteLock`（读写锁，读读共享、读写互斥）、`RSemaphore`（分布式信号量限并发）、`RCountDownLatch`（分布式闭锁等 N 个任务完成）、`RFairLock`/`RFencedLock`（公平锁与带栅栏令牌的锁）。落到"限流/多步任务编排/防止主从切换丢锁"选型。

## 一、RedLock：想解决什么、怎么解（★★★★★）

**问题**：单主 Redisson 锁在主从架构下有窗口——锁写到 master 未及复制到 replica，master 崩溃、replica 升主 → 锁丢失，两个客户端同时持锁（呼应 s1-1 面试追问）。

**RedLock 算法**（Redisson `getRedLock`）：

```java
// 例子目的：向 5 个完全独立的 Redis 主节点加锁，过半(≥3)成功且总耗时未超 lease 才算获得红锁
RLock l1 = redisson1.getLock("res");  // 5 个独立实例（正确：必须独立部署、无主从复制关系，否则一起挂=白搭）
... // redisson2..5 同 key
RedissonRedLock lock = new RedissonRedLock(l1, l2, l3, l4, l5);
lock.lock();                          // 依次向 5 节点加锁(带各自 TTL)，统计成功数
// 成功判定：① 过半节点加锁成功；② 总耗时(所有尝试之和) < lock 的 leaseTime —— 否则立刻全部释放重试
// 正确使用结果：单个节点宕机/丢数据不影响互斥（需多数派同时失效才会破防）
// 错误用法：把 5 个"同一主从集群的 5 个从"当独立节点 → 主挂了从一起丢锁，红锁退化为单点（独立性是红锁成立的前提）
```

## 二、世纪论战：红锁到底靠不靠谱（★★★★★，面试顶级深水区）

```flow
例子目的：RedLock 争议两条立场对照，帮你在面试里给出有判断的复述
Kleppmann(质疑方) --> {依赖时间做安全}: GC停顿/时钟漂移/NTP跳变可让持锁者"醒来时锁已过期但仍以为自己持有" → 无 fencing token → 互斥被破
antirez(作者方)  --> {论战}: 认为 Kleppmann 误读了算法、且任何系统在足够恶劣的故障模型下都不安全；但承认需时钟/进程行为大致正常
收敛到工程判断 --> {结论}: 红锁显著降低"主从切换丢锁"概率，但≠绝对互斥；要强正确性用基于共识的 CP 系统(ZK/etcd) 或 fencing token
```

**关键概念 fencing token（栅栏令牌）**：给每次加锁分配单调递增号，资源侧拒绝比当前号旧的请求——即便旧持锁者 GC 醒来带着旧号来写，也会被资源挡下。**Redis 原生锁做不到**（没有单调递增令牌的强保证），这是 Kleppmann 攻击的命门。

**工程结论**（写进脑子）：

- 追求**效率锁**（防常见并发、允许极小概率失效，绝大多数业务）→ 单主 Redisson `RLock` + 幂等/重试足够，红锁的运维成本与延迟不划算；
- 追求**正确性锁**（金钱、不可回滚操作，绝不能两个同时进）→ 别指望 Redis，用 **CP 系统（ZooKeeper/etcd）+ fencing token**，或直接数据库唯一约束/串行化事务。

## 三、读写锁 / 信号量 / 闭锁（★★★★☆）

| 同步器 | JDK 对应 | Redis 语义 | 典型场景 |
| --- | --- | --- | --- |
| `RReadWriteLock` | `ReentrantReadWriteLock` | 读锁 Hash 计数共享、写锁独占 | 配置读多写少：多线程并发读、发布时独占写 |
| `RSemaphore` | `Semaphore` | ZSet/计数控制许可数，跨节点限并发 | 限"同时下载/推送"的任务数=许可 |
| `RCountDownLatch` | `CountDownLatch` | 计数器归零唤醒等待方 | 等 N 个分片任务全部完成再汇总 |
| `RFairLock`/`RReadWriteLock` 公平版 | 公平 `ReentrantLock` | 队列 FIFO 授权 | 防抢锁饥饿 |

```java
// 例子目的：读写锁——大量线程读热点配置，仅发布线程能写
RReadWriteLock rw = redisson.getReadWriteLock("sys:config");
rw.readLock().lock();    // 读读共享：多个读者同时持有（正确：读锁用 Hash 记录读者数，不互斥）
try { return redisson.getMap("sys:config").readAllMap(); } finally { rw.readLock().unlock(); }
...
rw.writeLock().lock();   // 写独占：申请写锁时阻塞所有新读者（错误用法：拿 readLock 去改数据 → 别的读者同时在读，改到一半被读走脏配置）
try { /* 刷新配置 */ } finally { rw.writeLock().unlock(); }

// 例子目的：分布式信号量——全集群最多 10 个实例同时执行导出
RSemaphore sem = redisson.getSemaphore("export:perm");
sem.trySetPermits(10);                    // 设定总许可（跨所有节点生效，这才是"分布式"限并发——单机 Semaphore 限的是本进程）
if (sem.tryAcquire(3, TimeUnit.SECONDS)) { // 抢不到 3s 后失败返回，别无限等
    try { doExport(); } finally { sem.release(); }   // 必须归还许可（错误用法：漏 release → 许可只减不增，最终全集群导出被永久堵死）
}
```

## 四、动手题

1. 用 `RReadWriteLock`：起 5 读线程 + 1 写线程，观察写锁申请期间新读者被阻塞、读者之间并行（`TTL`/日志时间戳）。
2. `RSemaphore(3)` 起 10 线程 `tryAcquire`，验证同时最多 3 个进入、且漏 release 会耗尽许可。
3. 起 3 个分片任务用 `RCountDownLatch(3)` 归零，主线程 `await` 后汇总，打印时序。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 上了红锁仍偶发重复执行 | GC 长停顿/主从同时丢数据 + 无 fencing token，红锁非绝对互斥 |
| 红锁延迟高、吞吐掉 | 5 独立节点串行加锁 + 过半判定，网络 RTT 叠加 |
| `RSemaphore` 许可越用越少直至为 0 | 持有方异常路径漏 `release`（许可泄漏） |
| 写锁饥饿 | 持续有读者进入，公平读写锁未启用 |
| CountDownLatch 主线程永久 await | 某子任务崩溃没 `countDown`——需带超时的 await |

## 六、关联技术栈

- **向前**：单主 RLock 与看门狗 ↔ s1-1；主从异步复制 ↔ redis s1-2
- **向后**：限流器 RRateLimiter、布隆 ↔ s1-3；锁落地边界 ↔ s1-4
- **横向**：fencing/CP 共识 ↔ dist-theory（ZooKeeper/Raft）；限并发 ↔ 高并发专区

## 七、本节小结

RedLock 是对"单主锁怕主从切换丢锁"的多数派加固——N 个独立实例过半加锁才算持锁；但 Kleppmann 的批评一针见血：**依赖时间又无 fencing token 的锁，在 GC 停顿/时钟漂移下仍可能破防**，所以红锁只降低概率、不提供绝对互斥，正确性锁该交给 CP 系统或栅栏令牌。工程上别把红锁当银弹：多数场景"单主 RLock + 幂等"性价比更高。Redisson 的另一组同步器（读写锁、信号量、闭锁、公平锁）则把 JDK 并发工具搬到了跨节点维度——`RSemaphore` 限全集群并发、`RCountDownLatch` 等多分片完成，注意它们共享同一铁律：**获取必在 finally 归还、等待必带超时**，否则许可泄漏与永久阻塞比单机版更致命。下一节转向布隆过滤器、限流器与 RMapCache。
