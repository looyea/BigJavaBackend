# 作业题 · RLock 可重入锁与看门狗续期

> 作业不判分，做完对照参考答案自查。需要本地 Redis + Redisson 工程（`Redisson.create()` 默认配置即可连单机）。

## 作业 1：重入计数可视化（必做）

```java
// 例子目的：同一线程连续 lock() 三次、unlock() 三次，每步用 redis-cli 观测 Hash
RLock lock = redisson.getLock("demo:re");
lock.lock();   // 外部执行 HGETALL demo:re → 应看到 field=uuid:threadId, value=1（正确使用结果：锁体是 Hash 不是 String）
lock.lock();   // value=2（重入 +1，未阻塞——错误用法对照：若用 SET NX 一次性锁，这里会自死锁）
lock.lock();   // value=3
lock.unlock(); // value=2（此时 TTL 仍在，锁未释放）
lock.unlock(); // value=1
lock.unlock(); // Hash 被 DEL，redis-cli EXISTS demo:re 返回 0（正确：减到 0 才真删）
```

注释贴每步 `HGETALL`/`TTL` 输出，验证"减到 0 才删"。

## 作业 2：看门狗续期实测（必做）

`lock()` 后不 unlock，线程 `sleep(40s)`。每 5s 用 `TTL demo:wd` 记录一次。

**参考答案要点**：TTL 不会跌破到 0，而是被反复重置回 ~30s（每 10s 续一次）→ 证明看门狗在跑；对比 `lock(5,SECONDS)` 版：TTL 一路降到 0 锁消失，看门狗未启用。

## 作业 3：锁提前失效复现（必做）

两线程抢 `lock(3, SECONDS)`，持锁线程在临界区 sleep 6s。用日志时间戳证明：第 3s 锁自动释放后，第二个线程在第一个还没跑完时就进入了临界区（互斥被破坏）。

**参考答案要点**：这就是"leaseTime < 业务耗时 + 无看门狗"的事故模型；修法是用无参 `lock()` 或把临界区缩到远小于 leaseTime。

## 作业 4：跨线程解锁保护（选做）

线程 A `lock()`，线程 B 调 `unlock()`，捕获并记录异常类型与信息。

**参考答案要点**：抛 `IllegalMonitorStateException`——Redisson 校验 field 里的 `uuid:threadId` 归属，防止把别人的锁释放掉；解锁必须在持锁线程做。

## 作业 5：宕机自释观测（选做）

`lock()` 持锁后直接 `kill -9` 应用进程，另起客户端每 5s 观测 `EXISTS` 锁 key，记录多久消失。

**参考答案要点**：进程被杀 → 看门狗随进程死 → 锁不再续期 → 约 30s（默认 lockWatchdogTimeout）后自动过期释放。这正是分布式锁"宕机不死锁"的安全阀，也是"看门狗依赖客户端存活"的边界。
