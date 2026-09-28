# 实验设计与 K8s 故障类型

> 本节难度：★★★★☆
> 本节重要性：★★★☆☆
> 学习产出：掌握混沌工程的实验设计原则（稳态假设、变量控制、爆炸半径渐进），能用 Chaos Mesh 在 K8s 上注入 Pod/网络/IO/压力等故障，并理解每种故障验证的是系统哪一层韧性。

## 一、混沌不是"搞破坏"，是有假设的实验

一次合格的混沌实验 = 一个科学实验，缺一不可：

- **稳态假设（Steady State）**：先用可量化指标定义"系统正常"（如订单成功率>99.9%、P99<500ms），实验前后都测它；
- **变量 = 真实故障**：把"数据中心断电、节点宕机、依赖超时"这类现实事件作为要注入的变量；
- **对照**：对照组（不注入）与实验组同时跑，差异才归因于故障；
- **爆炸半径渐进**：从 staging → 生产单服务 → 单可用区 → 区域级，绝不一上来全集群。

没有稳态假设的"拔网线看看会不会挂"是玩具，不是混沌工程。

## 二、Chaos Mesh 的 CRD 故障目录

Chaos Mesh 用 CR 声明故障，按验证目标分类：

| 故障 CRD | 注入什么 | 验证哪层韧性 |
|----------|---------|-------------|
| PodChaos | 删 Pod / 让 Pod 失败 | 副本自愈、K8s 重调度、无状态可重启 |
| NetworkChaos | 延迟/丢包/分区/DNS 故障 | 超时与重试配置、熔断、跨 AZ 容灾 |
| IOChaos | 文件读写延迟/错误 | 依赖磁盘/存储的健壮性、日志写失败不拖垮主流程 |
| StressChaos | CPU/内存压力 | 资源 limit、HPA、OOM 行为、限流降级 |
| TimeChaos | 篡改容器时钟 | 定时任务/Token 过期/对账时间窗逻辑 |
| HTTPChaos | 篡改请求/响应、状态码 | 下游异常返回时的容错 |

## 三、两个最常用的实验

```yaml
# 目的：删订单服务的 Pod，验证"无状态 + 多副本 + 探针"能否做到用户无感自愈
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata: { name: kill-order-pod, namespace: chaos-testing }
spec:
  action: pod-kill
  mode: one                       # 结果：先只杀一个副本，控制爆炸半径
  selector:
    namespaces: [prod]
    labelSelectors: { app: order-service }
  duration: "30s"
  # 说明：mode: one + duration 组合是首轮演练的标准配置——随机挑一个副本，到期由 chaos-controller 自动清理 CR
  # 反例心智：把 PodChaos 的结论套到有状态服务——数据副本恢复与无状态"替换即走"完全不是一回事
  # 结果：稳态指标（下单成功率）短暂下探后回稳 → "多副本+探针+自愈"韧性基线成立
---
# 目的：给 payment→risk 的调用注入 800ms 延迟，验证超时/熔断是否按预期触发
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata: { name: delay-risk, namespace: chaos-testing }
spec:
  action: delay
  mode: all
  selector: { namespaces: [prod], labelSelectors: { app: payment-gateway } }
  delay: { latency: "800ms", jitter: "100ms" }
  # 说明：延迟注入在调用方 payment-gateway 的 Pod 上，超时配置（如 300ms）在我们手里，熔断应当在此刻触发
  # 结果：RT 被超时封顶、降级响应占比≈熔断计数，说明容错链路真的生效——这才叫验证
  # 反例：不先设合理的服务超时（如用了默认无限超时）就跑 → 结果：延迟直接把线程池拖死，
  # 这不是混沌"发现问题"，是你根本没配超时——先补齐容错再实验才有信息量
```

## 四、实验设计流程（Game Day）

```text
图目的：一次混沌演练的标准时序，强调"可中止"与"复盘"两个常被省略的环节
排期(通知干系人+定值班)→ 定稳态指标+成功/中止阈值 → 小爆炸半径注入
   → 实时监控(触发中止线立即停，abort 条件先行) → 撤故障 → 对比稳态 → 复盘建 action
# 关键：中止条件(abort criteria)要在注入前写好——错误做法是"看着不对劲手动关"，
#        生产演练必须自动熔断式回滚（Chaos Mesh 的 duration 到期自愈 + dashboard 一键 pause）
```

## 五、生产混沌的安全护栏

- **先观测后混沌**：没有 [ELK/Loki 日志](../../elk/s1/S1-1-Lesson.md) 与指标看板，注入后你无法判断稳态是否被破坏，等于蒙眼实验；
- **避开高峰与业务敏感期**：电商大促封网期、金融结算窗口绝不排期；
- **数据类故障慎入**：IOChaos/删除带状态服务的 PV 前必须先验证备份可恢复，混沌不是拿来赌数据的；
- **权限与审批**：生产注入走变更审批、限定命名空间与 ServiceAccount，`mode` 从 `one`/`fixed-percent` 起步；
- **闭环到韧性改进**：每次实验的产出是"暴露的缺陷 + 修复项"（补超时/补熔断/补副本反亲和），不是"我们做了混沌"这张证书。

## 六、关联技术

韧性前提是先有 [高可用体系与熔断降级](../../high-availability/s1/S1-1-Lesson.md)、[幂等](../../idempotent/s1/S1-1-Lesson.md) 设计；故障注入的观察依赖 [可观测三支柱](../../elk/s1/S1-1-Lesson.md)；K8s 层自愈机制（探针/HPA/反亲和）在 [Kubernetes](../../kubernetes/s1/S1-1-Lesson.md)。
