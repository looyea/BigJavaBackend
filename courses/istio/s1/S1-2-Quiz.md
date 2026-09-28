# VirtualService/DestinationRule 流量切分 · 小测

### 1. VS 与 DR 的职责划分是？（6分）

- A. VS 定义 subset，DR 做路由
- B. VS 负责请求匹配与路由权重，DR 定义 subset 与目标端点策略
- C. 二者等价
- D. DR 只管南北向

> 答案：B
> 解析："VS 选路、DR 定义目的地长什么样"；VS 引用了 DR 不存在的 subset → 503。

### 2. 金丝雀发布 5% 流量的最小配置是？（6分）

- A. 改 Service selector
- B. VS route 里 v1 weight 95 + v2 weight 5（subset 已在 DR 定义）
- C. 复制一份 Deployment 换域名
- D. 调 HPA

> 答案：B
> 解析：权重路由是 Istio 金丝雀的原生姿势，秒级生效、秒级回滚（weight 归零）。

### 3. http 规则数组的匹配语义是？（6分）

- A. 全部规则叠加生效
- B. 自上而下第一条命中的规则生效，其余忽略
- C. 随机选一条
- D. 按字典序

> 答案：B
> 解析：所以兜底权重规则必须放最后——放最前则 header/路径特例永远不生效（典型事故）。

### 4. 流量镜像（mirror）的特点是？（6分）

- A. 用户等待两份响应
- B. 异步复制请求到镜像目标，真实响应仍来自 route 目标，镜像错误用户不可见
- C. 只能镜像 1%
- D. 会改请求内容

> 答案：B
> 解析：影子验证新版本的标配；风险点是镜像目标容量不足被"白嫖"流量打挂。

### 5. outlierDetection 属于哪类机制？（6分）

- A. 主动健康检查
- B. 被动离群驱逐（连续错误达到阈值暂时摘除 endpoint）
- C. 限流
- D. 熔断器半开探测

> 答案：B
> 解析：基于真实请求的 5xx/连接失败计数驱逐，配合 maxEjectionPercent 防整体摘空。

### 6. 带重试的调用链 ingress(attempts:3) → A(attempts:3) → B，B 过载时流量最多放大几倍？（6分）

- A. 3 倍
- B. 9 倍
- C. 6 倍
- D. 1 倍

> 答案：B
> 解析：重试层数相乘（3×3）——这就是"重试预算"要全局收敛为一层的数学原因。

### 7. VS 的 hosts 写成不存在的服务名，症状是？（6分）

- A. 明确报错弹窗
- B. 规则静默不生效，流量走默认行为
- C. Pod 起不来
- D. istiod 崩溃

> 答案：B
> 解析：Istio 大量配置错误是"无声失败"——istioctl analyze 是唯一可靠的 lint 手段。

### 8. 以下哪些是 DestinationRule trafficPolicy 的能力（多选）？（9分）

- A. 负载均衡算法（ROUND_ROBIN/LEAST_REQUEST/RING_HASH）
- B. 连接池上限（TCP 连接数、HTTP 排队数）
- C. 请求超时 timeout
- D. 离群驱逐参数

> 答案：A、B、D
> 解析：C 的 timeout/retries 在 VS 的 http 路由层——"目标策略 DR、调用策略 VS"记忆。

### 9. 要做到"同一用户始终命中同一版本"（会话粘滞），可用（多选）？（9分）

- A. RING_HASH 负载均衡 + DR 里指定一致性哈希的 header（如 Cookie）
- B. 应用层 session 复制
- C. header 精确匹配规则给白名单用户固定路由
- D. 加大权重

> 答案：A、C
> 解析：B 是应用集群方案与网格无关；D 只改变比例不产生粘滞（结果：刷新页面版本漂移）。

### 10. 简答题：设计"支付服务 v2 金丝雀上线"的完整网格方案（含放量、验证、回滚三阶段），指出必须预防的三个坑。（40分）

- 要点1：准备——v1/v2 双 Deployment（同 Service，version label 区分），DR 定义 subsets，VS 初始 100/0；说明结构前提
- 要点2：影子期——mirror 100% 到 v2 + 故障注入对照验证 v2 依赖可达，结果：真实用户零风险暴露缺陷
- 要点3：放量期——内部 header 规则（employee=true→v2）先行，再 1/5/20/50/100 权重阶梯，每档观察 v2 的 5xx 与 P99 指标（配 SLO 门禁，可用 Flagger 自动化）
- 要点4：回滚——weight 一键归零 + 保留 v2 Deployment 供复盘；结论：网格回滚秒级，远优于镜像回退
- 要点5：坑1=重试叠加放大（只留一层）；坑2=subset 拼写/漏 DR 导致 503 静默失败；坑3=DB/中间件连接数未预留（v2 新 Pod 全量重连打爆连接池）
- 要点6：加分——南北向 Gateway 与东西向 VS 两级权重联动，避免"入口 5% 但内部 100% v2"的错切

> 答案：见要点
> 解析：把"能力语法"升级为"发布工程"，是这节的真正考核目标。
