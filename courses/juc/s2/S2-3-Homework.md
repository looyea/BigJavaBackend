# 并发容器与同步器 · 作业

> 不判分，对照参考要点自查。

## 作业 1：原子复合操作（必做）

多线程对同一 key 分别用 `if(!map.containsKey(k)){慢初始化; map.put(k,v);}` 与 `map.computeIfAbsent(k, key->慢初始化)`，观察前者可能初始化两次、后者幂等一次。写结论。

**参考要点**：containsKey+put 之间有竞态；computeIfAbsent/putIfAbsent 对桶加锁保证"检查+放入"原子，且同 key 计算只执行一次。

## 作业 2：三同步器 demo（必做）

分别实现：① `CountDownLatch(3)` 主线程 `await()`、3 个子任务各 `countDown()`；② `CyclicBarrier(3, barrierAction)` 3 线程两轮 `await()` 对齐；③ `Semaphore(2)` 5 线程争先进入、验证同时最多 2 个。各写一句话点明 state 含义。

**参考要点**：Latch state=事件计数减到0；Barrier 计数到齐触发+可循环；Semaphore state=许可数。

## 作业 3：CHM null 与弱一致（必做）

验证 `chm.put("k", null)` 抛 NPE；`chm.get(missingKey)` 返回 null。解释为何 CHM 禁 null（get 返回 null 无法区分"没有键"与"值是 null"，而并发下无法像 HashMap 用 containsKey 兜底判定）。

**参考要点**：HashMap 单线程可用 containsKey 消歧，CHM 并发下 containsKey+get 非原子无法可靠区分，故直接禁 null。

## 作业 4：CopyOnWriteArrayList 权衡（选做）

把一份"几乎只读、偶尔更新"的监听器列表分别用 `synchronizedList(new ArrayList)` 与 `CopyOnWriteArrayList` 承载，模拟高并发读 + 极低频写，比较读性能与一次写触发的复制开销，给出选型结论。

**参考要点**：COW 读无锁、迭代不抛 CME 但看到旧快照；写复制整数组代价大 → 读多写极少才划算。

## 作业 5：Semaphore 限流兜底（必做）

用 `Semaphore(K)` 包住对下游的调用，`tryAcquire(timeout)` 超时则走降级。故意让某分支异常时漏 `release()`，观察许可耗尽卡死，再用 try/finally 修复。说明它如何护住下游（呼应线程池/虚拟线程）。

**参考要点**：acquire 成功才进、finally 必 release；许可=最大并发数，超时/失败降级避免打爆下游。
