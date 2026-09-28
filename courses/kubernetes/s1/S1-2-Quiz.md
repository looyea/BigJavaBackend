# Deployment、ReplicaSet 与滚动发布回滚 · 小测

### 1. Deployment 升级镜像版本时，实际创建新 Pod 的是？（6分）

- A. API Server
- B. 新生成的 ReplicaSet
- C. kubelet 主动
- D. Scheduler

> 答案：B
> 解析：改 template → Deployment 建新 RS → 新 RS 负责拉起新 Pod、旧 RS 缩容（结果：版本链 Deployment→RS→Pod）。

### 2. `maxUnavailable: 0` 的含义是？（6分）

- A. 不允许升级
- B. 滚动全程可用 Pod 数不低于期望副本数（零容量缺口）
- C. 最多 0 个新 Pod
- D. 必须蓝绿

> 答案：B
> 解析：不牺牲任何当前可用副本，需靠 maxSurge 先起新的再杀旧的（示例：配合 surge=1 实现不降容发布）。

### 3. 若 replicas=2 且 maxUnavailable=50%，滚动时最少可用副本约为？（6分）

- A. 2
- B. 1
- C. 0
- D. 3

> 答案：B
> 解析：允许 50%（=1）不可用，峰值可能只剩 1 副本接流量（错误配置：小副本数高百分比→容量腰斩风险）。

### 4. 精确回滚到指定版本的命令是？（6分）

- A. kubectl rollback
- B. kubectl rollout undo deploy/x --to-revision=3
- C. kubectl edit
- D. kubectl apply --force

> 答案：B
> 解析：`rollout undo --to-revision` 指定历史版本；`rollout history` 先查可用 revision（说明：生产建议显式版本号）。

### 5. 滚动发布"稳不稳"最关键的依赖是？（6分）

- A. 镜像大小
- B. readinessProbe 正确配置（新 Pod 真就绪才接流量、才推进下一步）
- C. 节点数量
- D. namespace

> 答案：B
> 解析：没 readiness → 容器一起来就算 ready → 半启动实例接流量且滚动照常杀旧（结果：surge 参数形同虚设）。

### 6. `minReadySeconds` 的作用是？（6分）

- A. 探针间隔
- B. 新 Pod ready 后再观察 N 秒无异常才算可用、才继续推进
- C. 优雅停机时间
- D. 镜像拉取超时

> 答案：B
> 解析：给慢热应用/缓存预热一个观察窗口，是"ready 后别急着推进"的保护（加分：与 HPA 冷却期配合）。

### 7. 原生 K8s 做粗粒度金丝雀的方式是？（6分）

- A. 改 Service 类型
- B. 两个 Deployment（stable/canary）共享 selector，按副本数比例分流
- C. 改镜像 tag
- D. 加节点

> 答案：B
> 解析：canary 副本占比≈流量占比（近似）；局限是无法按请求头/精确百分比，那要靠 mesh TrafficSplit。

### 8. 关于蓝绿与滚动发布，正确的有（多选）（9分）

- A. 蓝绿瞬时全量切换、回滚即切回旧环境
- B. 蓝绿代价是发布期双倍资源
- C. 滚动发布无需额外环境、逐步替换
- D. 蓝绿比滚动更安全所以应总是用蓝绿

> 答案：ABC
> 解析：A/B 是蓝绿特征，C 是滚动特征；D 错——"总是蓝绿"浪费资源且非所有场景需要瞬时切换（结果：按频率/成本/回滚速度权衡）。

### 9. 下列哪些是发布事故的高危配置？（多选）（9分）

- A. maxUnavailable 设大百分比且副本数很少
- B. 不配 readinessProbe 就滚动
- C. revisionHistoryLimit=0（几乎无回滚点）
- D. 升级前跑 rollout status 阻塞确认

> 答案：ABC
> 解析：A（容量骤降）/B（半启动接流）/C（回无可回）都是坑；D 是正确的发布守护动作（应做，不选）。

### 10. 简答题：为一个核心交易服务（replicas=6、要求发布期零中断）设计滚动发布策略，并说明发布/回滚的判定与风险预案。（40分）

- 要点1：策略参数——maxUnavailable=0、maxSurge=1~2，保证全程可用副本≥6（目的：大促/低延迟不容容量缺口；验收：发布过程可用 Pod 曲线不跌破 6）。
- 要点2：就绪门控——配 readinessProbe（如 /actuator/health/readiness）+ minReadySeconds=15，新实例真预热才接流量并推进（错误用例：无 readiness→半启动接流雪崩）。
- 要点3：优雅退出衔接——preStop 钩子 + terminationGracePeriodSeconds 覆盖在途请求，配合 s1-3 的"先摘流量再停进程"（说明：零中断=就绪侧+退出侧两头都要）。
- 要点4：发布判定——脚本用 `kubectl rollout status` 阻塞至完成或超时，超时即告警并触发回滚（输出：rollout 成功/失败作为 CI/CD 闸门）。
- 要点5：回滚预案——保留 revisionHistoryLimit≥5 确保有回滚点，显式 `undo --to-revision`，并知道回滚也走滚动不是瞬移（结果：回滚同样需要 readiness 把关）。
- 要点6：精细灰度诉求——若要按 1%/按头验证新版，原生副本比不够，引入 mesh TrafficSplit（istio/linkerd 关联）；资源侧确认节点有余量容纳 surge 峰值，否则发布 Pending（异常：surge 起不来导致 rollout 卡住）。

> 答案：见要点
