# 写入流程与近实时可见 · 面试题

## 题 1：Elasticsearch 为什么是"近实时"而不是"实时"？

- 写入先进 in-memory buffer，只有 refresh 把 buffer 变成一个新 segment 后才进入可搜索视图，默认 refresh 每秒一次。
- 所以"写成功"和"能搜到"之间有一个 refresh 周期的延迟，这就是 NRT 的本质。
- 加分：能点出可见性由 refresh 决定、durability 由 translog/flush 决定，二者是正交的两条线。

## 题 2：写一条文档，数据到底落在哪些地方？各起什么作用？

- in-memory buffer（待 refresh 成段）、translog（顺序写、宕机重放防丢）、segment（refresh 后可搜索、不可变）。
- 副本分片确认后才向客户端返回成功，保证冗余；flush 把段 fsync 落盘并清 translog。
- 加分：讲清 refresh（近实时可见，轻量）与 flush（持久化，较重）的分工与此消彼长。

## 题 3：translog 的 request 与 async 模式怎么选？

- request 每次写请求都 fsync，最安全但每请求一次磁盘同步；async 后台定时 sync，吞吐更高但宕机可能丢尾部数据。
- 默认 request；对可容忍极小概率丢数、追求写入吞吐的场景才考虑 async。
- 加分：能联系"顺序写日志换随机写性能"这一通用设计（与 Kafka/WAL 同源），说明代价模型。

## 题 4：为什么删除和更新不会立刻释放磁盘？

- Lucene 段不可变：删除只在 .del 位图打标记，更新=标记旧文档删除+追加新文档。
- 被标记的旧文档与新版本并存，只有后台 merge 合并段时才物理清除、回收空间。
- 加分：指出高更新/删除场景段数量膨胀会拖慢搜索，需要关注 merge 策略与 forcemerge。

## 题 5：写入后断言"一定查得到"，测试却偶发失败，怎么回事？

- 根因是 NRT：断言发生在 refresh 之前，文档还在 buffer 未成段，搜索看不到。
- 正确做法：写入带 `refresh=wait_for`，或轮询直到可见，而不是给全局调小 refresh_interval。
- 加分：解释为什么"1ms refresh_interval"是反模式（小段爆炸、搜索与合并压力剧增）。

## 题 6：ES 怎么做并发写的冲突控制？和数据库乐观锁像吗？

- 用 `_seq_no`+`primary_term` 实现乐观并发：写请求带 If-Seq-No/If-Primary-Term，主分片不符返回 409，天然 CAS。
- 与数据库 version 乐观锁理念一致，但判定放在主分片、避免应用层"读时判断"的竞态与 ABA。
- 加分：能就"账务强一致"给出边界——关键余额更新可回落到数据库事务，ES 作检索视图，不把 NRT 系统当账本。
