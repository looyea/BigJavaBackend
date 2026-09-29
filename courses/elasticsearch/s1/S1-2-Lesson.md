# 写入流程与近实时可见

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能画出 ES 一条文档的写入路径（primary → in-memory buffer + translog → refresh 生成 segment → fsync 落盘 → merge 段合并），讲清"为什么是近实时(NRT)而非实时"以及 `refresh_interval`、`translog`  durability、`flush` 各自作用；理解段不可变带来的删除/更新代价与段合并的 GC；掌握 routing、`op_type=create` 防覆盖、`_seq_no`/`primary_term` 乐观并发，并能权衡"要即时可见"时的 `refresh=wait_for` 取舍。

## 一、一条文档写入的完整路径

```text
图目的：写请求从主分片到可搜索，跨越多个阶段
1) 路由：shard = hash(routing) % 主分片数，请求先到 primary 分片
2) primary 写 in-memory buffer + 追加 translog（顺序写，防宕机丢数据）
3) replica 确认后才返回客户端成功（保证副本数）
4) refresh：buffer 里的文档生成一个新 segment 并进入 OS cache → 此刻才可被搜索
5) flush：translog 对应的 segment 真正 fsync 落盘、translog 清空
6) merge：后台把小 segment 合并成大 segment，淘汰已删/已改的旧文档
```

## 二、为什么是"近实时"而不是实时

默认 `refresh_interval=1s`：写入后最快 1 秒才生成可搜索的 segment，所以 ES 是 NRT。

```text
图目的：可见性由 refresh 决定，而非写入决定
写入成功 ≠ 立即可搜：文档先进 buffer，未 refresh 前不在任何 segment 里，搜索看不到
调小 refresh_interval → 更快可见，但更频繁生成小 segment → 搜索/合并开销飙升（反模式）
要点名即时可见：单次请求带 "refresh=wait_for"（或 immediate），代价是该请求阻塞到刷新完成
```

```java
// 目的：不同可见性/安全需求下的写入参数选择
IndexRequest r = new IndexRequest("products").id("42")
    .opType(DocWriteRequest.OpType.CREATE)          // 结果：create 语义，已存在则 version_conflict，防误覆盖
    .source(json, XContentType.JSON)
    .setRefreshPolicy(WriteRequest.RefreshPolicy.WAIT_UNTIL); // 说明：等下一次定时 refresh 后再返回
// 反例：写入后立即 search 却断言"一定查到" ❌ NRT 下未 refresh 不可见，测试偶发失败
// 反例：把 refresh_interval 设成 100ms 追求实时 ❌ 小 segment 爆炸，搜索变慢、合并压力大
// 反例：translog durability 改成 async 换吞吐 ❌ 宕机可能丢失 last refresh 之后的数据
```

## 三、translog：宕机不丢数据的保险

```text
图目的：顺序写的日志如何兜住随机写的不可靠
translog 每写一条都追加，默认 request 级 fsync（每次写请求都 sync 到磁盘）→ 抗宕机
宕机恢复：重放 translog 把未落盘(buffer 里)的文档恢复到可搜索状态
request vs async：request 安全但每请求 fsync；async 后台定时 sync 更快但可能丢尾部数据（默认 request）
flush = 把 segment 落盘 + 清空 translog，二者此消彼长
```

## 四、段不可变：删除/更新的真实代价

Lucene 的 segment 一旦生成就不可修改，这塑造了 ES 的读写性格：

```text
图目的：不可变段下的更新、删除与合并
删除：不物理删，只在 .del 位图标记为已删（搜索时过滤掉）
更新：= 旧文档标记删除 + 追加一条新文档到 buffer，两段并存直到 merge
merge：后台合并小段为大段，顺带物理清除被标记删除/旧版本的文档，回收空间
副作用：大量删除后未 merge 前，段仍占空间且搜索要扫更多段 → 高更新场景需关注段数量
```

- `deletes_used`、段数量与 merge 线程是容量与性能规划的关键观测点（衔接下节容量规划）。

## 五、并发写：乐观并发控制

```java
// 目的：用 _seq_no + primary_term 做"读-改-写"防丢更新（CAS 语义）
// 客户端带上 If-Seq-No / If-Primary-Term，主分片校验不匹配则返回 409 conflict
IndexRequest ir = new IndexRequest("acc").id("A")
    .setIfSeqNo(seqNo).setIfPrimaryTerm(primaryTerm)   // 结果：并发写只有先到者成功，其余重试
    .source(updated, XContentType.JSON);
// 反例：两个线程各读版本后盲写覆盖 ❌ 后写覆盖先写，丢更新
// 反例：靠 "读时 version 再判断" 应用层自旋 ❌ 高并发下 ABA 与竞态，应交给 seq_no 主分片判定
```

## 六、关联课程

段与分片的容量、冷热分层见 [聚合、深分页与集群容量规划](S1-3-Lesson.md)；写入路径里的副本确认（replica ack 后才返回）与 [分区、副本与 ISR 机制](../../kafka/s1/S1-1-Lesson.md) 的 ISR/ack 多数派思想同源；“用顺序写日志兜住随机写”的 translog 设计也与 Kafka 的 log 结构存储一脉相承。
