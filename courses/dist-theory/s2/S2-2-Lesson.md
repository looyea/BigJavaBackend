# 分布式锁的工程与坑

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：能用"安全性/活锁/性能/运维依赖"四维给 Redis 单实例锁、RedLock、ZooKeeper 临时顺序节点锁、数据库锁做选型答辩；亲手识别看门狗续期的前提与失效场景；写出带 fencing token 的锁使用范式，理解为什么"没有 token 的分布式锁挡不住 GC 停顿的旧持有者"。

```flow
例子目的：一次 GC 停顿如何击穿"看起来正确"的分布式锁——锁过期与业务未完成赛跑，两个持有者同时进入临界区
线程1 -> Redis: SET lock uuid-A NX PX=30s 获取成功
线程1 -> 线程1: 进入 60s Full GC 停顿
时钟流逝 -> Redis: lock-A 30s 过期被自动删除
线程2 -> Redis: SET lock uuid-B NX 获取成功并进入临界区
线程1苏醒 -> 资源: 与线程2并发写同一资源(互斥被破坏!)
线程2 -> Redis: DEL lock(误删的其实是自己的, 但更糟版本是线程1删了线程2的锁)
```

## 一、分布式锁的四条正确性底线

一把合格的分布式锁要同时满足：

1. **互斥**：任意时刻至多一个持有者（安全性）；
2. **不死锁**：持有者崩溃后锁可再获得（过期机制/会话机制）；
3. **只解自己的锁**：释放操作校验持有者身份且原子（Lua），防止 A 超时后误删 B 的锁；
4. **对时钟停顿免疫**：持有者卡顿（GC/缺页/VM 迁移）导致"以为还持有"——这是前 3 条都满足后仍会破防的一条，答案是 **fencing token**。

```java
// 例子目的：展示"过期时间怎么设都不对"的两难，以及看门狗方案的结构
class LockTimeoutDilemma {
    void naive(RedissonLikeClient c) throws Exception {
        c.tryLock("order-42", 10, TimeUnit.SECONDS);   // 例子：固定 10s 过期
        doBusiness();                                   // 错误用法：业务耗时 8s~30s 波动——结果：P99 业务超过 10s 时锁先过期，第二个持有者进入，互斥破裂
        c.unlock("order-42");                           // 说明：unlock 校验 uuid 只解决"误删他人锁"，解决不了"双持有"本身
    }
    void watchdog(RedissonLikeClient c) throws Exception {
        c.tryLock("order-42");                          // 例子：不传 leaseTime → Redisson 走看门狗模式
        // 目的：后台线程每 leaseTime/3（默认 10s）检查持有者线程还活着就续期到 30s
        doBusiness();                                   // 输出：业务多久锁就活多久；持有者进程崩溃→续期停止→30s 后自动释放
        c.unlock("order-42");                           // 结果：正常路径闭环——但注意：网络分区时续期失败而业务还在跑，锁照样过期（见第四节）
    }
}
```

## 二、四种实现的机制与破绽

**1. Redis 单实例（SET NX PX + Lua del）**：性能最高（μs 级）；破绽在 Redis 本身——主从异步复制下 **主节点带锁未同步即宕化，从升主后锁"消失"**，新持有者与旧持有者并存。单机 Redis 重启（无 AOF）同样丢锁。

**2. RedLock**：向 N=6 个独立 Redis master 依次加锁，过半成功且总耗时 < TTL 才算持有，释放广播全部。目标就是修掉主从丢锁问题。Kleppmann 的质疑（2016）：① 时钟漂移——任一节点时钟快跳会让锁提前过期；② GC 停顿——客户端拿到锁后停顿，恢复后不自知已过期（RedLock 无 token 无法防御）；③ 依赖"时钟近似单调"这一分布式里最弱的假设。作者 Antirez 反驳但**未提供 token 机制**，学界共识：RedLock 的安全性弱于其宣传。

**3. ZooKeeper（临时顺序节点）**：`ephemeral sequential` 节点 + watch 前驱——天然防羊群、会话断开自动释放。机制优势：**仲裁者有状态**（zxid 单调），旧 leader 恢复后发现自己 term 落后自动退位，客户端收到异常——这正是 fencing 的协议内建版。缺点：写吞吐低（走 ZAB 多数派）、大量临时节点内存压力、session 超时两难（短=抖动误杀，长=死锁久）。

**4. 数据库**：`SELECT ... FOR UPDATE` 或唯一索引 insert 抢锁。事务与业务天然同域（最稳的"同库互斥"）；缺点：行锁随连接、长事务占用、无等待队列（轮询）、表膨胀。适合作**降级兜底**而不是主方案。

## 三、Fencing Token：被面试忽略的主角

```java
// 例子目的：fencing token 如何在存储层挡住"过期但自认为有效"的旧锁持有者
class FencedStore {
    long lastToken = 0;                                  // 说明：存储端记住见过的最大令牌（锁服务发的单调递增序号）
    boolean write(long token, Object data) {
        if (token < lastToken) {                          // 目的：拒绝一切携带旧令牌的写——旧持有者 GC 苏醒后的写入在此折断
            return false;                                 // 输出：客户端收到 403 RetryWithNewerToken
        }
        lastToken = token;                                // 结果：新令牌记录在案，写入执行
        return true;
    }
}
// 锁服务侧：每次加锁成功返回 (lockValue, token=incr(counter))——ZooKeeper 的 zxid/version、Chubby 的 sequence number 都是这个 token
// 关键：Redis SET NX 给不出单调递增序列（除非自己用 INCR 包一层），这是 Redis 系锁在"严格正确"上的结构性短板
```

一句话答辩：**没有 fencing 的锁，正确性依赖"持有者不会停顿超过 TTL"这一无法验证的假设；有 fencing，正确性收敛到存储层的单调比较**。

## 四、效率锁 vs 正确性锁：先问锁保护什么

- **效率锁（efficiency lock）**：错了也只是浪费——重复计算、多做一次缓存回填、任务跑两遍。Redis 锁完全够用，TTL 拍脑袋设。
- **正确性锁（correctness lock）**：错了就出事故——双写余额、双开断路器、双发计费指令。要么上 ZK/etcd（带 token 语义），要么**改用 CAS 把互斥下沉到数据层**（`UPDATE ... WHERE version=?`）——很多"需要分布式锁"的场景其实需要的是乐观锁。

**选型表**：

| 诉求 | 方案 | 理由 |
| --- | --- | --- |
| 高并发防重复执行（幂等前置） | Redis SETNX+Lua+看门狗 | 性能优先，错了可重试 |
| 选主/单实例任务 | ZK/etcd 或 Redlock 不如用 ZooKeeper 锁原语 | 需要会话语义与通知 |
| 资金互斥 | 数据库条件更新/唯一键（不用通用锁） | 互斥下沉到数据行 |
| 跨云严格互斥 | etcd + lease + revision token | 共识+fencing 一体 |

## 五、常见线上问题

- **看门狗失效场景**：显式传 leaseTime 则不启动看门狗（Redisson 语义），文档写"自动续期"但参数配错等于没有。
- **锁粒度=全局**：`lock("stock")` 锁整个品类，吞吐坍缩；key 必须落到最小冲突单元（skuId 级）。
- **续期成功但业务线程已被中断**：finally unlock 与中断竞态——统一交给框架（Redisson 的锁可重入计数+unlock 校验持有线程）。
- **Redis 主从切换丢锁双写**：库存超卖的教科书成因；治理=改 ZK/etcd 或把扣减改为存储层 CAS。
- **把 tryLock 无超时写成阻塞 lock**：线程堆积→雪崩；生产代码强制 `tryLock(waitTime, leaseTime 或看门狗)`。

## 六、动手题

1. 用 20 线程 + 一把 Redis 锁（无看门狗、TTL=2s）跑 3s 波动的任务，统计"同刻双持有"次数；再改 TTL=10s 看误删他人锁问题；最后上 Redisson 看门狗复测。
2. 给任意 KV 存储加 fencing token（本节 FencedStore），用 `kill -STOP` 模拟持有者停顿 15s，验证苏醒后写入被拒。

## 七、关联技术栈

Redisson RLock/看门狗实现细节（见 Redisson 包 S1-1/S1-2）、ZooKeeper Curator InterProcessLock、etcd concurrency 包（Campaign 即选主+rev token）、Seata 全局锁（同构问题在事务域的投影）、ShardingSphere 分布式主键生成器的锁协调。

## 八、本节小结

分布式锁的坑分两层：**机制层**（过期与业务时长赛跑→看门狗；误删→身份校验+Lua；主从丢锁→共识化）与**假设层**（GC 停顿击穿一切 TTL 假设→fencing token）。工程结论：效率锁用 Redis 大胆快，正确性锁优先把互斥下沉到数据层 CAS，非用通用锁不可时选带会话与单调序号的 ZK/etcd 而不是 RedLock——锁的正确性从来不在锁服务本身，而在"谁有资格否决过期持有者"这个最终仲裁点。
