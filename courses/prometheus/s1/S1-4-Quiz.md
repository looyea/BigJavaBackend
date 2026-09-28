# Alertmanager 告警与 Grafana 看板（关联） · 小测

### 1. 告警规则中 for: 2m 的作用是？（6分）

- A. 告警持续 2 分钟后自动恢复
- B. 表达式需连续满足 2 分钟才从 pending 转为 firing 发通知（防抖）
- C. 每 2 分钟重新评估一次
- D. 通知发送超时为 2 分钟

> 答案：B
> 解析：瞬时毛刺停留在 pending 即消退，不发通知——这是降噪第一道闸。

### 2. Alertmanager 的 group_by 目的是？（6分）

- A. 分摊存储
- B. 按标签把同类告警合并成一条通知，避免风暴
- C. 路由到多个 Prom
- D. 分组评估规则

> 答案：B
> 解析：如 group_by:[alertname,cluster]，50 个实例同款告警合成一条聚合消息。

### 3. 机房级故障导致 300 条实例告警同时 firing，用什么机制只留 1 条根因告警？（6分）

- A. repeat_interval
- B. inhibit_rules（父告警压制匹配 same label 的子告警）
- C. group_wait
- D. Grafana annotation

> 答案：B
> 解析：抑制规则 source=ClusterDown、equal=[cluster] → 同集群 warning 全被压住。

### 4. 计划内发布窗口希望暂停某服务告警，正确操作是？（6分）

- A. 删除告警规则
- B. 创建 Silence（静默），按标签匹配、到期自动恢复
- C. 关掉 Alertmanager
- D. 把阈值调大

> 答案：B
> 解析：`amtool silence add service=order --duration=2h`，目的：临时屏蔽且留痕可审计。

### 5. 表达式满足但一条通知都没收到，下列排查路径正确的是？（6分）

- A. 只看 Grafana
- B. Prom /alerts 页看状态 → AM 路由匹配 → receiver 网关日志，逐级定位
- C. 重启服务器
- D. 直接改表达式

> 答案：B
> 解析：firing 但没有通知 = 路由/接收器问题；pending 不发 = for 未到，先分清环节。

### 6. RED 方法关注的三个服务维度是？（6分）

- A. CPU/内存/磁盘
- B. Rate 请求量、Errors 错误率、Duration 延迟
- C. 注册、发现、健康检查
- D. Read、Edit、Delete

> 答案：B
> 解析：RED 面向请求型服务；USE（Utilization/Saturation/Errors）才面向资源。

### 7. Grafana 模板变量 `label_values(http_requests_total, service)` 的效果是？（6分）

- A. 固定查询一个服务
- B. 动态生成 service 下拉选项并联动所有面板查询
- C. 创建新指标
- D. 生成告警规则

> 答案：B
> 解析：变量随指标出现自动更新，Repeat 面板 + var-xxx 深链是值班效率关键。

### 8. 关于告警规则写法的最佳实践，正确的有（多选）？（9分）

- A. expr 引用 recording rule 的预计算序列，降低评估开销
- B. annotations 提供 runbook 链接与 {{ $value }} 实时值
- C. 所有告警统一 severity=critical 以保证被看到
- D. 为关键 job 配 absent() 无数据兜底告警

> 答案：A、B、D
> 解析：C 会导致"狼来了"——分级（critical 电话 / warning 群消息）才可持续。

### 9. 以下属于 Alertmanager 职责的有（多选）？（9分）

- A. 告警去重与分组
- B. 计算 PromQL 表达式
- C. 静默与抑制
- D. 失败通知的重试

> 答案：A、C、D
> 解析：B 是 Prometheus 规则评估引擎的职责；AM 只管"事件之后的通知治理"。

### 10. 简答题：大促期间告警群刷屏 2000+ 条，事后如何系统性治理？给出至少 5 个抓手。（40分）

- 要点1：审计规则——top 噪音告警按 fired 次数排序，删阈值错误或无动作价值的（说明：每条告警必须对应一个可执行动作）
- 要点2：AM 分组——group_by alertname+cluster，调 group_wait/interval，结果：风暴合并成个位数通知
- 要点3：抑制链——ClusterDown/NodeDown 作 source 压制实例级 warning，目的：只暴露根因
- 要点4：分级路由——critical 电话、warning 群、info 仅看板，禁止全量同渠道
- 要点5：静默流程化——发布/演练通过 CI 自动开 silence 到期回收，反例：临时改规则忘改回造成监控真空
- 要点6：无数据兜底与 SLO burn rate 告警补充，输出：从"症状轰炸"转向"后果驱动"

> 答案：见要点
> 解析：告警治理=规则质量×通知拓扑，两者都要有度量（噪音率、响应率）闭环。
