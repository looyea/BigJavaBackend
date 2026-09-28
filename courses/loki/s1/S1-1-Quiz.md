# Loki 架构与标签模型 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. Loki 中"流（stream）"的定义是？（6分）

- A. 一个服务的所有日志
- B. 共享同一标签集（label set）的一组日志行
- C. 一个 chunk 文件
- D. 一个租户的命名空间
> 答案：B
> 解析：标签集全同才同流，任何一个标签值不同即新流——与 Prometheus series 同构，这也是基数控制的对象。

### 2. Loki 的索引里存的是？（6分）

- A. 日志正文的分词倒排
- B. 标签集到 chunk 的映射
- C. 每行日志的偏移量
- D. Grafana 看板定义
> 答案：B
> 解析：正文永远不进索引、压缩后整体存对象存储，这是 Loki 低写入成本的根源，也决定了查询必须"标签圈定 + 行过滤"。

### 3. 负责接收写入并按流哈希路由的组件是？（6分）

- A. Querier
- B. Distributor
- C. Compactor
- D. Alertmanager
> 答案：B
> 解析：Distributor 校验标签、按哈希环把同一条流恒定路由到同一组 ingester；ingester 内存攒 chunk 再 flush。

### 4. 生产环境 Ingester 副本数（RF）的常见取值及其含义是？（6分）

- A. 1，单点即可
- B. 3，同一条流写入 3 个 ingester 副本防丢，查询以最新副本为主
- C. 0，全靠对象存储
- D. 等于 Pod 数
> 答案：B
> 解析：RF=3 时内存占用 ×3，这是"Loki 便宜"里最容易被忽略的计算成本项。

### 5. 下列哪个字段应该放进标签？（6分）

- A. trace_id
- B. user_id
- C. env（prod/staging/dev）
- D. 带查询参数的 URL
> 答案：C
> 解析：env 只有三个值；A/B/D 都是无界基数，进标签等于流爆炸——trace_id 应放 structured metadata。

### 6. chunk 被"关闭"后发生什么？（6分）

- A. 立刻删除
- B. 压缩后 flush 到对象存储，之后不可变，由 compactor 归并并按保留期删除
- C. 留在内存永久加速
- D. 转成 ES 索引
> 答案：B
> 解析：关闭条件通常是时间（~24h）或大小；不可变块 + 对象存储是 Loki 成本模型的支柱。

### 7. 多租户隔离依靠什么机制？（6分）

- A. 每个租户一个 Loki 集群
- B. 请求头 X-Scope-OrgID + 每租户配额（速率/保留期）
- C. 标签里写 tenant 字段即可
- D. Grafana 团队权限
> 答案：B
> 解析：OrgID 是写入与查询的一等维度，配额按租户生效；A 是极端隔离手段，成本高；C/D 不构成数据面隔离。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于 Distributor 与 Ingester，正确的有？（9分）

- A. Distributor 会校验标签合法性与每租户速率，超限直接拒绝
- B. 同一条流恒定路由到同一组 ingester，保证流内时序
- C. Ingester 挂掉且 WAL 未开启时，内存中未 flush 的日志会丢
- D. chunk flush 到对象存储后仍会被反复改写去重
> 答案：ABC
> 解析：D 错误——chunk 关闭后不可变，compactor 是对冗余块做归并替换而非改写内容。

### 9. （多选）哪些做法会造成 Loki 流基数爆炸？（多选）（9分）

- A. 把 pod 名放进标签且应用频繁滚动重建（无状态服务每副本名唯一）
- B. 采集器默认展开全部 Kubernetes 标签
- C. 用 level、namespace 作为标签
- D. 把业务单号写进标签做快速检索
> 答案：ABD
> 解析：A 在高速滚动场景贡献大量已死流、B 是最常见的"无白名单"事故、D 是无界基数；C 是标准低基数维度。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 为一家有 60 个微服务的电商公司设计 Loki 标签规范与采集管线，并说明如何防止规范被破坏。（40分）

> 参考答案：
- 要点1：标签白名单——env/namespace/app(或服务名)/level/container，pod 名评估滚动频率后决定去留；
- 要点2：禁止项——trace_id、user_id、order_id、URL、时间戳类进标签，traceId 走 structured metadata 供跳转；
- 要点3：采集管线——Promtail/Alloy 服务发现 + relabel 白名单 + json stage 提取 level 等字段再 labels；
- 要点4：护栏——max-global-streams-count、per-tenant 速率限制、ingester 流上限告警；
- 要点5：监控——active streams 增速看板、被拒绝写入日志计数，异常陡增触发变更回查；
- 要点6：治理——标签规范写进平台准入（CI 校验采集配置 diff）、新服务接入 checklist、违规 namespace 降采样或隔离租户。
