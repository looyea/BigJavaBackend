# 索引生命周期 ILM 与冷热架构 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. ILM 中 rollover 的正确描述是？（6分）

- A. 定时把索引复制一份到冷节点
- B. 写入别名指向的索引达到阈值后新建序号索引并切换写入指针
- C. 删除最老的索引
- D. 把分片拆分到更多节点
> 答案：B
> 解析：rollover 是"开新索引 + write alias 前移"，旧索引立刻变只读并进入后续阶段，A/C/D 是别的动作。

### 2. 日志索引 rollover 阈值最常用的一组是？（6分）

- A. `max_size: 30~50gb（主分片）` + `max_age` 兜底
- B. `max_age: 1h` 保证检索快
- C. `max_docs: 10`
- D. 不设阈值，永远写一个索引
> 答案：A
> 解析：分片 40GB 量级兼顾段管理与查询并行；1h 一滚造碎索引（B 错），单索引永不过期会让 hot 层无限膨胀（D 错）。

### 3. forcemerge 只能在什么状态下安全执行？（6分）

- A. 索引仍在高速写入时
- B. 索引已只读（如 rollover 后的 warm 阶段）
- C. 集群 red 时
- D. 任意时刻
> 答案：B
> 解析：对活跃索引 merge 会产生超大不可变段并持续吸收写入段再生，任务卡死、磁盘暴涨；只读索引 merge 一次收益永久。

### 4. shrink 动作的前提条件包含？（6分）

- A. 索引必须处于 cold 阶段
- B. 索引需设置 write blocks 且主分片健康，目标分片数是当前的因子
- C. 必须先删除副本
- D. 无前提，随时可缩
> 答案：B
> 解析：shrink 要求只读与健康分片，且目标分片须整除原分片数（如 6→3→1）；ILM 自动加 write_blocks，人肉操作常漏。

### 5. searchable_snapshot（cold/frozen 阶段）的本质收益是？（6分）

- A. 查询比热层更快
- B. 数据本体放对象存储、本地仅缓存，存储成本降一个量级
- C. 自动去重日志
- D. 替代快照备份
> 答案：B
> 解析：代价是首查需远程取数明显变慢，之后靠节点本地缓存加速；它是分层降本手段，不替代 SLM 备份的容灾定位。

### 6. 关于写入/搜索别名，最佳实践是？（6分）

- A. 应用直接写具体索引名 `applog-000042`
- B. 应用写 write alias，检索用覆盖全系列的搜索 alias
- C. 别名与索引一一对齐即可不用 is_write_index
- D. 只用一个别名同时承担读写
> 答案：B
> 解析：写死索引名会让 rollover 后写入失败或写进旧只读索引；`is_write_index: true` 标记让 rollover 能自动前移。

### 7. 一天 200GB 日志保留 30 天，成本结构最合理的分层是？（6分）

- A. 全量 SSD + 双副本
- B. 近 7 天热 SSD，其余温 HDD，合规保留段用对象存储
- C. 全量放对象存储
- D. 只留 3 天，其余丢弃
> 答案：B
> 解析：绝大多数排障查询落在最近 72 小时，热层为体验花钱、远端为留存省钱；A 浪费、C 查询不可用、D 违反审计要求。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）ILM 的 hot 阶段可以执行的动作包括？（9分）

- A. rollover
- B. set_priority
- C. forcemerge 到 1 段
- D. flush
> 答案：ABD
> 解析：hot 阶段动作集含 rollover/set_priority/flush 等；forcemerge 属于 warm/cold 动作，对写入中索引执行是错误用法（C 不选）；migrate 也是 warm 阶段动作，不能出现在 D 里。

### 9. （多选）哪些做法会引发日志集群事故？（多选）（9分）

- A. 人肉 `DELETE applog-*` 与 ILM delete 阶段并存
- B. `max_age: 1h` 高频滚动
- C. 为 keyword 字段关闭 norms 与 doc_values 之外的检索优化
- D. 滚动阈值按全索引 500GB 而不看主分片大小，造成单分片超 100GB
> 答案：ABD
> 解析：A 通配误删竞态、B 碎索引爆炸、D 超大分片无法迁移/rebalance；C 是常规优化不是事故源。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 为一个日增 100GB、需保留 90 天（金融审计要求）的日志集群设计完整生命周期方案：滚动、分层、动作序列与风险点。（40分）

> 参考答案：
- 要点1：滚动——主分片 40~50GB 触发 + max_age 7d 兜底，write alias + is_write_index，序号命名；
- 要点2：分片规划——按 1 shard/GB 堆估节点容量，hot 节点池 SSD、专角色隔离；
- 要点3：阶段动作——hot（priority 100/flush）→ warm 7d 后（shrink、forcemerge 1 段、allocate data=warm、priority 50）→ cold 30d 后（searchable_snapshot 到对象存储）→ 90d delete；
- 要点4：成本账——100GB/天 × 90 天 × 膨胀系数约 2 倍，热层只承载 7 天量，其余走 HDD 与对象存储；
- 要点5：合规——保留期由 delete phase 的 min_index_age 表达并纳入审计证据，禁止人肉删除；备份另走 SLM 快照（生命周期删除不等于备份）；
- 要点6：风险——forcemerge/shrink 时机、碎索引、冷查询缓存挤占堆需独立节点池，另附监控（_ilm/explain、phase 滞留时长告警）。
