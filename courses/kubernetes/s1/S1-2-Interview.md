# Deployment、ReplicaSet 与滚动发布回滚 · 面试题

## 题 1：Deployment 和 ReplicaSet 为什么要分两层？

- RS 只管一件事："维持匹配模板的 N 个副本"，不懂版本；Deployment 在其上加了"版本"维度——每次 template 变更生成新 RS，管新旧 RS 的此消彼长（结果：滚动/回滚能力来自这层版本管理）。
- 历史原因：早期直接操作 RC/RS，升级靠手工，痛点催生了 Deployment 这一声明式发布控制器。
- 实践约定：不手建 RS（除非特殊固定版本场景），一切走 Deployment，RS 是它的实现细节。

## 题 2：maxSurge 和 maxUnavailable 怎么配？给三个场景。

1. 核心低延迟服务：`maxUnavailable=0, maxSurge=25%`——容量一点不能掉，宁可超编（前提：集群资源有余量；异常：surge 起不来 rollout 会卡）。
2. 资源紧张/后台服务：`maxUnavailable=25%, maxSurge=0`——不超编，接受短暂降容换低成本。
3. 组合默认：两者皆可百分比，注意 replicas 很小时百分比向下取整的坑（示例：replicas=2 时 25%→0，等效没设）。

## 题 3：滚动发布中新版本 Pod 一直起不来，会发生什么？怎么止损？

- 现象：新 RS 有 Pod Pending/CrashLoop，Deployment 推进停滞（unavailable 触顶后不再杀旧 Pod——旧版本继续服务，这是保护不是故障扩大）。
- 止损：`kubectl rollout undo` 回滚；根因四查——镜像拉取(s1-1)/探针配错(s1-3)/资源不足(s3-1)/依赖不可用（说明：rollout 卡住≠服务挂，旧副本还在）。
- 加分：CI/CD 里用 `rollout status --timeout` 自动判定失败并回滚，别留人肉值守。

## 题 4：蓝绿、金丝雀、滚动，选型怎么说？

- 滚动：无额外环境、资源省、每次部分替换——默认选择；弱点=新旧共存期行为混合，观测复杂。
- 蓝绿：双环境一键切换，回滚秒级、无共存期；贵（双倍资源）、数据库兼容性要想清楚（异常：新旧版本对同库 schema 预期不一致）。
- 金丝雀：小流量验证最有价值，K8s 原生只能按副本近似，精细按头/按百分比分流要 mesh（istio/linkerd TrafficSplit）或 Ingress 灰度注解。

## 题 5：回滚一次"出问题"的发布，除了 undo 还要注意什么？

1. undo 也是滚动：仍走 surge/unavailable 流程与 readiness 把关，不是瞬时生效（结果：回滚期间也要监控）。
2. 有状态副作用要评估：DB migration、缓存格式、消息 schema 被新版本改过——回滚代码不回滚数据是常见事故（示例：新版加了必填列，旧代码写 NULL 直接报错；应对：迁移向前兼容/expand-contract）。
3. revisionHistoryLimit 是否留够了回滚点（默认 10，被调 0 就尴尬）。

## 题 6：Deployment 的 selector 为什么不建议用随机 label（如 pod-template-hash 之外的东西）？

- Deployment 自动把 `pod-template-hash` 注入 selector 与 template label，隔离新旧 RS 的 Pod 归属（目的：一次发布中两版本 Pod 共存但 RS 各管各的）。
- 人为往 selector 加会变的标签（版本/时间戳）→ 新 RS 选不到旧 Pod 或互相抢 Pod（异常：发布行为错乱、孤儿 RS）。
- 规范：selector 用语义稳定的键（app: order），版本信息只进 template 的 image/annotations（说明：CHANGE-CAUSE 注解帮审计，不参与选择）。
