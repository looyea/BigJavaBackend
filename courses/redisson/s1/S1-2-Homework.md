# 作业题 · RedLock 争议与读写锁/信号量/闭锁

> 作业不判分，做完对照参考答案自查。红锁题需 5 个独立 Redis 实例（docker 起 5 个不同端口、彼此无复制关系），其余单机即可。

## 作业 1：读写锁并发度实测（必做）

```java
// 例子目的：5 读线程 + 1 写线程并发跑，打印各自进入/退出时间戳
RReadWriteLock rwl = redisson.getReadWriteLock("cfg");
// 读线程：rwl.readLock().lock() → sleep(2) → unlock     // 正确使用结果：5 个读者进入时间几乎重叠（读读共享，不互斥）
// 写线程：rwl.writeLock().lock() → sleep(2) → unlock     // 观察：写锁申请期间，新到的读者被挡在门外，直到写者释放（写独占）
// 错误用法对照：把写线程也用 readLock 包住改数据 → 与读者并发跑，出现脏读/半更新
```

注释贴时间戳，验证"读读并行、读写互斥"。

## 作业 2：信号量限集群并发 + 泄漏复现（必做）

`RSemaphore sem; sem.trySetPermits(3)`，起 10 线程 `tryAcquire(3s)` 后 sleep(2) 再 release。

再改一版：故意让异常路径不 `release`，反复跑直到 `availablePermits()==0`，之后所有 `tryAcquire` 全失败。

**参考答案要点**：许可是跨节点的全局计数，同时最多 3 个进入即"分布式限并发"；漏 release = 许可泄漏，最终整个功能被永久堵死——必须 finally 归还。

## 作业 3：CountDownLatch 编排分片任务（必做）

主线程 `RCountDownLatch(3)`，起 3 个分片任务各 `countDown()`；主 `await(5, SECONDS)` 后汇总。

**参考答案要点**：有一个任务崩溃没 countDown 时，**必须用带超时的 await**，否则主线程永久阻塞；对比 JDK CountDownLatch——Redisson 版能跨 JVM，是"多实例协同等一组事件"的现成件。

## 作业 4：红锁 vs 单主锁 可用性对照（选做）

5 独立实例搭红锁，压测中 `kill` 掉 1~2 个实例，观察红锁仍可用（过半在）；再 kill 到只剩 2 个（不过半），验证加锁开始失败/阻塞。

**参考答案要点**：红锁的容错=可容忍 N/2-1 个节点故障；但记住 Kleppmann 的批评——它挡的是"节点宕机丢锁"，挡不住"客户端 GC 停顿导致锁过期后仍写"，那种要靠 fencing token，红锁本身不提供。

## 作业 5：选型备忘（选做）

给团队写半页：① 什么需求用单主 RLock；② 什么需求必须上 CP 系统/fencing；③ 红锁在我们系统里有没有位置。

**参考答案要点**：体现"效率锁够用就别上红锁、正确性锁别信 Redis"的判断链，避免为"听起来更安全"盲目引入 5 节点红锁徒增运维。
