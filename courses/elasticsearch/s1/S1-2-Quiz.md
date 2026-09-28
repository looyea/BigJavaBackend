# 写入流程与近实时可见 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. ES 文档写入成功后，"能被搜索到"取决于哪个动作？（6分）

- A. translog 追加
- B. replica 确认
- C. refresh 生成可搜索的 segment
- D. 客户端收到 200
> 答案：C
> 解析：写入先进 in-memory buffer，只有 refresh 把它变成一个 segment 后才进入可搜索视图，这就是"近实时"的由来。

### 2. ES 默认的 refresh_interval 与可见性关系，正确的是？（6分）

- A. 0ms，完全实时
- B. 默认 1s，故为近实时(NRT)
- C. 默认 30s
- D. 与可见性无关
> 答案：B
> 解析：默认每秒 refresh 一次，写入最快 1 秒后可见，所以是 NRT 而非实时。

### 3. translog 的主要作用是？（6分）

- A. 加速搜索
- B. 顺序写日志，宕机后重放恢复未落盘数据
- C. 存储倒排索引
- D. 做分词
> 答案：B
> 解析：buffer 里的数据未落盘易丢，translog 每次写都追加并（默认 request 级）fsync，宕机重放找回尾部数据。

### 4. 关于 Lucene segment 不可变，下列说法正确的是？（6分）

- A. 更新会原地修改段
- B. 删除会立即释放磁盘
- C. 更新=标记旧文档删除+追加新文档，删除只打标记，靠 merge 回收
- D. 段永远不需要合并
> 答案：C
> 解析：段不可写改，删除用 .del 位图标记、更新产生新版本，二者都在 merge 时才被物理清除。

### 5. 想保证"读-改-写"不丢更新，应使用？（6分）

- A. 提高 refresh 频率
- B. _seq_no + primary_term 乐观并发（If-Seq-No）
- C. 增加副本数
- D. 关闭 translog
> 答案：B
> 解析：带 If-Seq-No/If-Primary-Term，主分片校验不符返回 409 conflict，实现 CAS 式防覆盖。

### 6. `op_type=create` 的语义是？（6分）

- A. 覆盖已存在文档
- B. 仅在文档不存在时写入，已存在则 version_conflict
- C. 删除文档
- D. 更新版本号
> 答案：B
> 解析：create 防误覆盖，适合"只允许新增"的场景；要更新用普通 index 或带并发控制的更新。

### 7. 一次性写入后要求立即可搜，代价最小的常规做法是？（6分）

- A. 把全局 refresh_interval 调到 1ms
- B. 对该请求设置 refresh=wait_for
- C. 关闭副本
- D. 关闭 translog
> 答案：B
> 解析：wait_for 只让这一条请求阻塞到下次 refresh，影响面可控；全局调小 refresh 是反模式，会小段爆炸。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. 一条写请求从主分片到落盘，经过的环节有？（多选）（9分）

- A. 按 routing 定位主分片
- B. 写 in-memory buffer 并追加 translog
- C. refresh 生成 segment、flush 落盘
- D. 后台 merge 合并段
> 答案：A、B、C、D
> 解析：路由→buffer+translog→副本确认→refresh 可见→flush 落盘→merge 整理，构成完整写入生命周期。

### 9. 以下哪些是提升写入吞吐/可见性时的错误做法？（多选）（9分）

- A. 为求实时把 refresh_interval 设为几毫秒
- B. 为求吞吐把 translog durability 改 async 却不接受丢数风险
- C. 大批量导入时临时把副本设为 0、refresh 设 -1，导完再恢复
- D. 无节制增加并发写入线程直至拒绝服务
> 答案：A、B、D
> 解析：批量导入"临时关副本+关 refresh 再恢复"(C) 是官方推荐提速手段；A/B/D 分别导致小段爆炸、宕机丢数、集群过载，均错误。

## 三、简答题（共 40 分）

### 10. 简答题：描述 ES 一条文档从写入到可被搜索、再到最终落盘整理的全过程，并解释为什么 ES 是"近实时"、删除/更新为什么不立即释放空间。（40分）

> 参考答案：
- 要点1：routing 定位主分片 → 写 buffer+追加 translog → replica 确认返回 → refresh 生成可搜索 segment → flush fsync 落盘清 translog → 后台 merge 合并。（16分）
- 要点2：可见性取决于 refresh 而非写入，默认 1s 一次，故写入后最快约 1s 才可见=近实时 NRT。（10分）
- 要点3：segment 不可变，删除只打 .del 标记、更新=删旧+加新，物理空间与旧版本要等 merge 才回收。（10分）
- 要点4：需要即时可搜用 refresh=wait_for，避免全局调小 refresh_interval 造成小段爆炸。（4分）
