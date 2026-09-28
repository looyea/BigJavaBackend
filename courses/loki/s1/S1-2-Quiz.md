# LogQL 与 Grafana 集成 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. 一条合法 LogQL 日志查询必须以什么开头？（6分）

- A. `|=` 行过滤
- B. `{标签选择器}`
- C. `rate(`
- D. 关键词全文
> 答案：B
> 解析：LogQL 强制先选流（走标签索引），后续 `|=`/parser 都是对该流集合的扫描过滤——不存在"无选择器全文检索"。

### 2. `| json | level="ERROR"` 与 `|= "ERROR"` 的区别是？（6分）

- A. 完全等价
- B. 前者解析成字段后按 level 字段精确匹配，后者是对整行子串扫描
- C. 后者更快
- D. 前者不走索引所以更慢且不能过滤
> 答案：B
> 解析：显式过滤器作用于解析后的结构化字段，语义精确；行过滤命中任意位置的子串（可能误命中正文里的 ERROR 字样）。

### 3. 要统计每个服务近 5 分钟错误行速率，正确写法是？（6分）

- A. `sum by(app)(rate({app="payment"} | json | level="ERROR" [5m]))`
- B. `count_over_time({app="payment"}[5m])`
- C. `{level="ERROR"} | rate`
- D. `avg_over_time(ERROR [5m])`
> 答案：A
> 解析：日志查询外包 rate/count_over_time 转指标查询，按 5m 窗口算行/秒再按 app 聚合；B 缺错误过滤、C/D 语法不成立。

### 4. `unwrap` 的用途是？（6分）

- A. 解压 chunk
- B. 从日志的结构化字段里取一个数值做数值型聚合（avg/quantile 等）
- C. 反转时间序
- D. 去掉标签
> 答案：B
> 解析：`avg_over_time({... | json | unwrap duration}[5m]) by (method)`——但精度与成本都不如指标系统，重要 SLI 仍以 Prometheus 为准。

### 5. 实现"从日志一键跳转到对应 Trace"依赖 Grafana 数据源的什么配置？（6分）

- A. Annotation
- B. Derived fields（正则提取 traceId + 配 Tempo/Jaeger 链接）
- C. Variables
- D. Library panel
> 答案：B
> 解析：derived field 用正则从行中抽 traceId 并生成外部链接，闭合"指标→trace→日志"排障动线。

### 6. 关于 LogQL 告警的稳健写法，正确的是？（6分）

- A. 一定用裸 `count_over_time` 最灵敏
- B. 优先 `rate` 并设 `limit`，因 at-least-once 链路重放会瞬时抬行数
- C. 告警查询窗口越大越好
- D. Loki 不支持告警
> 答案：B
> 解析：重放/回填会让行数突刺造成误报，rate + 合理窗口 + limit 更稳；D 错误——Grafana Alerting 原生支持 LogQL。

### 7. 宽时间窗查询卡顿，query-frontend 提供的关键缓解是？（6分）

- A. 给日志建全文索引
- B. 按时间/字节自动切片（split）并行执行 + 历史时段结果缓存
- C. 把数据搬到 SSD
- D. 降低日志级别
> 答案：B
> 解析：chunk 不可变使历史时段缓存命中率高，是 Loki 相对 ES 的天然优势之一；A 违背模型（正文不索引）。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于 LogQL 解析器，正确的有？（9分）

- A. `| json` 适合结构化日志，字段直接可过滤
- B. `| logfmt` 解析 key=value 文本
- C. `| regexp "..."` 开销最低应优先使用
- D. `| detect_labels` 可临时把字段当标签过滤而不改变流标识
> 答案：ABD
> 解析：C 错误——正则兜底最贵，应尽量避免；A/B/D 描述正确，detect_labels 排障好用但别依赖。

### 9. （多选）哪些做法会让一次 Grafana 日志查询扫描量失控？（9分）

- A. `{app=~".+"}` 匹配所有流
- B. 时间窗选近 7 天且带复杂 `|~` 正则
- C. 先用精确标签 + 短窗口再逐步放宽
- D. `| json` 后不过滤直接聚合全部服务全部字段
> 答案：ABD
> 解析：C 是正确的收敛姿势不是失控源；A/B/D 都在"标签没圈小"或"窗口/正则过大"上踩坑。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 为一个 Spring Boot 服务（logback 输出 JSON，含 traceId）设计一套"排障 + 告警"的 Grafana + Loki 方案，说明查询写法与性能注意。（40分）

> 参考答案：
- 要点1：查询骨架——`{app="x",env="prod"} | json | level="ERROR"`，先标签圈流再结构化过滤，加 `| limit` 控回传；
- 要点2：日志→Trace——derived field 正则提 `traceId`，配 Tempo/Jaeger 链接，形成指标→trace→日志动线；
- 要点3：告警——`sum by(app)(rate({...|json|level="ERROR"}[5m])) > 阈值 for 5m`，用 rate 抗重放突刺；
- 要点4：数值聚合克制——unwrap 派生 latency 分位仅做参考，SLI 回 Prometheus；
- 要点5：性能护栏——query-frontend split + 结果缓存、max_query_parallelism、禁止无边界正则；
- 要点6：基数纪律——detect_labels 只临时用，level/env 进标签，traceId 不进标签（呼应 s1-1）。
