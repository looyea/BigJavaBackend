# DSL 拓扑与 KStream/KTable · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. Kafka Streams 的运行形态是？（6分）

- A. 独立提交的集群作业
- B. 嵌入应用进程、以库形式运行的流处理
- C. 数据库触发器
- D. 定时批任务
> 答案：B
> 解析：KS 是应用内的库，用多线程处理、加实例即扩容，输入输出都是 Kafka topic，无需独立引擎。

### 2. "每条记录代表某 key 的最新状态（可被覆盖）"对应哪种抽象？（6分）

- A. KStream
- B. KTable
- C. GlobalKTable 的追加流
- D. Processor
> 答案：B
> 解析：KTable 是变更日志/物化视图，按 key 保留最新值；KStream 每条是独立事件不覆盖。

### 3. 把"逐条点击事件"累加成"每用户点击计数表"，正确路径是？（6分）

- A. map 直接改值
- B. groupByKey 后 aggregate 累加
- C. filter 丢弃重复
- D. toStream
> 答案：B
> 解析：按 key 分组用 aggregate 增量累加得到 KTable 计数；纯 map/mapValues 不能跨记录聚合。

### 4. 改变记录 key（决定后续分区/聚合维度）应使用哪个算子？（6分）

- A. mapValues
- B. filter
- C. selectKey
- D. print
> 答案：C
> 解析：selectKey/map 改 key 会触发 repartition；mapValues 只改 value 不动 key、不重分区。

### 5. 用订单事件流去补充"用户最新画像"做富化，最合适的 join 是？（6分）

- A. KStream-KStream
- B. KStream-KTable
- C. KTable-KTable
- D. 外置数据库轮询
> 答案：B
> 解析：流表 join 是典型维表富化——事件流按 key 查表的最新值，最常用且状态可控。

### 6. KStream-KStream join 的状态特点是？（6分）

- A. 无状态
- B. 两侧都需缓存近期事件窗口，状态随窗口保留期增长
- C. 只存最新一条
- D. 存到外部数据库
> 答案：B
> 解析：流流 join 要在窗口内保留两侧事件以待匹配，保留期越长状态越大，需与数据延迟匹配。

### 7. KS 的本地 State Store 如何做到故障后恢复？（6分）

- A. 完全不恢复
- B. 备份到压缩的 changelog topic，重启从 store+changelog 恢复
- C. 存到 ZooKeeper
- D. 每次重算全量历史
> 答案：B
> 解析：状态用本地 RocksDB，并持续写 compacted changelog topic 作备份，恢复时重建。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. 关于 KStream 与 KTable，下列说法正确的有？（多选）（9分）

- A. KStream 是 insert-only 事件流，每条独立
- B. KTable 按 key 保留最新值，可理解为物化视图
- C. 同一 topic 可依处理语义当流或表看待
- D. KTable 会保留每个 key 的所有历史版本
> 答案：A、B、C
> 解析：D 错，KTable 只保最新值（旧版本被覆盖，历史可体现在 changelog 但表本身是最新视图）。

### 9. 以下 DSL 用法/后果，正确的有？（多选）（9分）

- A. mapValues 不触发重分区
- B. selectKey 会触发 repartition（内部多一个 topic）
- C. 聚合窗口应配 Materialized 指定 store 及保留策略
- D. 不 selectKey 直接 groupBy 任意字段做"用户维度"聚合一定正确
> 答案：A、B、C
> 解析：D 错，聚合维度由 key 决定，维度选错结果即错，需先 selectKey 到正确字段。

## 三、简答题（共 40 分）

### 10. 简答题：用 Kafka Streams 实现"订单事件流实时关联用户最新画像、并按用户窗口聚合消费额"，说明哪部分是 KStream/KTable、用什么算子、join 选哪种、状态如何持久化恢复。（40分）

> 参考答案：
- 要点1：orders 建 KStream（事件流），user-profile 建 KTable（每用户最新画像）。（10分）
- 要点2：用 KStream-KTable join 按 userId 富化画像；改 key/维度用 selectKey，会触发 repartition。（12分）
- 要点3：按用户 groupBy/窗口 aggregate 累加消费额，配 Materialized 指定窗口 store 与保留。（10分）
- 要点4：本地 RocksDB State Store + compacted changelog topic 做故障恢复；扩缩容靠实例增删触发 rebalance。（8分）
