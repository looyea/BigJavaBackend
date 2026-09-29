# RLock 可重入锁与看门狗续期

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：拆开 Redisson `RLock` 的三块基石——**用 Hash 结构存"锁→线程→重入次数"**（`HSET` field 格式 `uuid:threadId`）、**加锁/重入/释放全部 Lua 原子执行**、**看门狗（watchdog）在无显式 leaseTime 时自动续期**防"业务没跑完锁先过期"。能与 `SET NX PX` 一次性锁逐点对比，说清 `lock()` 与 `lock(leaseTime)` 的本质差别、可重入为何必须带线程标识、`unlock` 误用（非持有线程解锁）的异常。落点是电商下单/库存这类"长临界区 + 宕机安全"场景的正确加锁姿势。

## 一、为什么 `SET NX PX` 不够，RLock 补了什么（★★★★★）

手写一次性锁的三个致命缺口，Redisson 全填上：

| 缺口 | 一次性 `SET NX PX` | Redisson `RLock` |
| --- | --- | --- |
| 可重入 | 同线程二次加锁自死锁 | Hash field 带 `uuid:threadId` + 计数器，重入 `HINCRBY +1` |
| 持有者识别 | value 存令牌，仍需自己比对 | 令牌(锁名)+field 精确定位"谁的哪次" |
| 过期与续期 | 固定 PX，业务超时即失锁 | 无 leaseTime 时**看门狗自动续期** |
| 阻塞等待 | 自己轮询 | 基于 **Pub/Sub** 通知唤醒，非空转 |

```lua
-- 例子目的：Redisson 加锁 Lua 的骨架（简化），一次 RTT 内原子完成"判归属/重入/初设+过期"
-- KEYS[1]=锁名  ARGV[1]=过期毫秒  ARGV[2]=uuid:threadId
if (redis.call('exists', KEYS[1]) == 0) then                       -- 锁不存在：首次获取
  redis.call('hincrby', KEYS[1], ARGV[2], 1);                      -- 建 Hash，本线程重入计数=1（正确：用 Hash 而非 String，才能记录"哪个线程重入了几次"）
  redis.call('pexpire', KEYS[1], ARGV[1]);                         -- 设过期（默认 30s，交给看门狗续）
  return nil;                                                      -- 返回 nil 表示加锁成功
elseif (redis.call('hexists', KEYS[1], ARGV[2]) == 1) then         -- 锁存在且是本人：可重入
  redis.call('hincrby', KEYS[1], ARGV[2], 1);                      -- 计数 +1（错误用法：若只判 exists 不判归属，会把别人的锁"重入"给自己 → 互斥失效）
  redis.call('pexpire', KEYS[1], ARGV[1]);
  return nil;
end;
return redis.call('pttl', KEYS[1]);                                -- 已被他人持有：返回剩余 TTL，客户端据此订阅解锁通知再重试
```

## 二、数据结构与可重入语义（★★★★☆）

- 一把 `RLock` 在 Redis 里是一个 **Hash**：`key = "mylock"`, `field = "8823-f:...:1001"(uuid:threadId)`, `value = 重入次数`。
- **可重入**：同一线程二次 `lock()` → `hincrby` 该 field +1，不阻塞；`unlock()` → -1，减到 0 才真正 `del` 并发解锁消息。
- **为什么 field 要带 threadId**：锁的粒度是"线程"，只有把持有者标识精确到线程，才能既支持同线程重入、又阻止跨线程冒领。锁的过期靠 `PEXPIRE` 兜底——**持锁进程宕机后锁自动到期释放**，这是它比 JDK `Lock` 强的地方（JDK 锁随进程死）。

```java
// 例子目的：可重入 + 释放配对的正确姿势
RLock lock = redisson.getLock("order:lock:1001");
lock.lock();                                 // 无 leaseTime → 启用看门狗（下文三）
try {
    if (needSubStep()) {
        lock.lock();                         // 同线程重入：计数 1→2，立即返回不阻塞（正确使用结果：嵌套方法各自 lock/unlock 成对，不会自死锁）
        try { /* 子临界区 */ } finally { lock.unlock(); }   // 计数 2→1，仍未释放（错误用法：重入后少写一次 unlock → 计数不归零，锁泄漏到过期或被看门狗一直续 → 别的线程永久拿不到）
    }
    /* 主临界区 */
} finally {
    lock.unlock();                           // 计数 1→0：真正删除锁 + 发布解锁通知
}
```

## 三、看门狗（watchdog）续期机制（★★★★★，必考）

- 触发条件：**调用 `lock()`/`lockInterruptibly()` 未指定 leaseTime** 时，锁默认 TTL=30s（`lockWatchdogTimeout`），后台 Netty 定时任务每 **TTL/3 ≈ 10s** 检查一次，若线程仍持锁就 `PEXPIRE` 重置回 30s。
- 意义：业务跑 5 分钟，锁一直被续、不会被别人抢走；而**进程宕机→续期停止→锁最多 30s 后自动释放**，兼顾"不超时失锁"与"宕机不死锁"。
- 关键陷阱：**一旦显式传 `leaseTime`（如 `lock(10, SECONDS)`），看门狗不工作**——10s 到点无条件释放，业务没跑完就会失锁。

```java
// 例子目的：两种 lock 的过期行为对比（高频线上事故源）
lock.lock();                    // 正确：不传 leaseTime → 看门狗接管，持锁期间自动续，宕机才到期释放
// 业务耗时不可控（调下游/大批量循环）时，靠看门狗兜住"超时失锁"
...
finally { lock.unlock(); }      // 释放同时取消该线程的续期任务

lock.lock(5, TimeUnit.SECONDS); // 谨慎：显式 leaseTime → 看门狗关闭，5s 后无条件释放
// 错误用法：业务可能跑 8s，5s 时锁已没了 → 另一线程拿到锁并发进入临界区 → 数据竞态/重复扣减（"锁提前失效"是分布式锁第一大坑）
```

> 判据：**持锁时长可预估且远小于 leaseTime** 才用带参 `lock`；时长不可控就用无参 `lock()` 让看门狗续——但要接受"看门狗依赖客户端进程存活"。

## 四、动手题

1. 同一线程嵌套 `lock()/unlock()` 两次，中途用 `HGETALL mylock` 观察 value 从 1→2→1→0 的变化。
2. `lock()` 后 `sleep(35s)` 不放锁，用 `TTL` 观测看门狗把过期时间不断重置回 30s；再 `kill -9` 进程，观察锁 30s 后自动消失。
3. 把 `lock()` 换成 `lock(3, SECONDS)` 后让业务 sleep 5s，用两个线程验证"锁提前失效导致并发进入"。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 锁到点自动释放，另一线程并发进入 | 用了显式 leaseTime 且 < 业务耗时，看门狗没生效 |
| 加锁线程被阻塞很久 | 未传 waitTime 用 `tryLock`，或持锁方迟迟不释放（看门狗在给它续） |
| 锁"消失"但没 unlock | 进程重启/网络断，锁到 TTL 自动过期（看门狗依赖进程存活） |
| 非持锁线程 `unlock` 抛 `IllegalMonitorStateException` | Redisson 校验解锁者身份——正常保护，别在别的线程解锁 |
| 大量线程空转抢锁打爆 Redis | 用 `tryLock` 短周期裸轮询，未走 Redisson 的订阅等待 |

## 六、关联技术栈

- **向前**：`SET NX PX` 一次性锁与 Lua 释放 ↔ redis s2、lettuce s1-3；Pub/Sub 唤醒 ↔ redis s1
- **向后**：RedLock 多节点、读写锁/公平锁 ↔ s1-2；信号量/闭锁 ↔ s1-2
- **横向**：可重入语义 ↔ juc `ReentrantLock`；幂等与防重 ↔ 幂等专区

## 七、本节小结

`RLock` 的本质是"**用 Redis Hash 把'谁-重入几次'建模，用 Lua 把判归属/增减计数/设过期合成一次原子操作**"，由此一次性锁做不到的三件事全部补齐：可重入（field=`uuid:threadId`+计数）、持有者安全释放、以及最重要的——**看门狗自动续期**：无 leaseTime 时锁默认 30s、每 10s 续、进程一挂自然到期，同时避免"业务没跑完锁先失效"和"宕机死锁"。落地记住一条铁律：**持锁时长不可控就别传 leaseTime，交给看门狗**；传了就要保证 leaseTime 显著大于最坏业务耗时，否则等于给自己埋"锁提前失效"的雷。下一节讲多节点 RedLock 的争议与其它同步器。
