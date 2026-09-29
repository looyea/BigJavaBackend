# 能力边界与 Istio 选型（关联）

> 本节难度：★★★★☆
> 重要程度：★★☆☆☆
> 学习产出：能列出 Linkerd 与 Istio 的能力矩阵差异，掌握金丝雀落地方式与"选轻/选全"的决策边界。

## 一、能力边界盘点：Linkerd 有什么、没什么

```text
图目的：以 Istio 全量能力为参照，标出 Linkerd 的覆盖区间与留白。
有：默认 mTLS、HTTP/gRPC 遥测与 tap、幂等路由自动重试/超时、TrafficSplit（按百分比权重）、
    ServiceNetworkPolicy（默认拒绝的粗粒度授权）、多集群。
弱/无：按 Header/Cookie 的 L7 分流、流量镜像、Lua/WASM 扩展策略、细粒度 RBAC 策略引擎（OPA）、
    Ingress 完整语义（Edge 堆栈提供但远弱于 Istio Gateway）、EnvoyFilter 级逃生舱。
结果：Linkerd 的"极简"是刻意的能力取舍，不是还没做完——选型要按需求对照，而非按版本猜测。
```

## 二、金丝雀：TrafficSplit + 渐进控制器

```yaml
# 目的：Service 指向 Split，把 10% 流量给 v2（权重在 Linkerd 的 L4 连接级生效）
apiVersion: v1
kind: Service
metadata: { name: orders }
spec:
  selector: { linkerd.io/canary: orders }   # 说明：selector 命中"活跃版本"的 Pod
  ports: [{ name: http, port: 80 }]
---
apiVersion: split.smi-spec.io/v1alpha1
kind: TrafficSplit
metadata: { name: orders-split }
spec:
  service: orders                # 输出：用户访问的稳定 Service 名
  backends:
    - service: orders-v1
      weight: 90                 # 结果：90% 连接去旧版本
    - service: orders-v2
      weight: 10                 # 说明：权重按新连接划，长连接需配合滚动才迁移
# 错误用法：只改权重不做 Flagger 自动分析 → 10% 放出去没人看指标 → 灰度形同虚设
```

实践上金丝雀闭环交给 **Flagger / Argo Rollouts**：控制器读 Prometheus 指标（错误率/P99）自动加权或回滚，Linkerd 只提供切分原语。

## 三、零信任粒度：默认拒绝怎么表达

```bash
linkerd -n prod tap deploy/orders                  # 目的：实时看谁在调 orders（排障第一入口）
# 授权：ServiceProfile 之外用集群级/命名空间级 NetworkPolicy 语义
# 反例：以为"装了 Linkerd 就自动白名单" —— 默认是全部允许加密互通，
#       不配 deny-all + 显式允许，东西向依然任意可达（mTLS ≠ 授权）
```

- Istio 对应物：AuthorizationPolicy（principal 级、method 级、细）；
- Linkerd 的授权更粗（服务/命名空间可达性），复杂 ABAC 需求是明确的能力边界。

## 四、选型矩阵：什么时候选谁

| 维度 | 选 Linkerd | 选 Istio |
|------|-----------|----------|
| 核心诉求 | mTLS+遥测+基础重试 | 深度 L7 流量治理 |
| 灰度方式 | 权重金丝雀（配 Flagger） | Header/镜像/多阶段全语法 |
| 团队预算 | 1-2 人兼职运维 | 专职平台小组 |
| 资源账单 | 每 Pod ~2MB 敏感 | 可承受每 Pod 数十 MB |
| 扩展需求 | 无定制协议/策略 | WASM/EnvoyFilter 定制 |
| 演进兼容 | 均可接 OTel 遥测后端 | 同左 |

```text
图目的：一条可带回的决策链。
问1：只需要"加密+看得见+幂等重试"吗？是 → Linkerd。
问2：需要按头分流/镜像/策略引擎吗？是 → Istio（或 Ambient 降本折中）。
问3：两者都嫌重？→ 只有 mTLS 需求可考虑 cert-manager+SPIFFE 自研，或 K8s NetworkPolicy 起步。
结果：选型差异本质是"复杂度预算"，不是功能多寡——为用不到的能力付费才是最贵的反例。
```

## 五、关联技术

- 与 Istio 共存：双 mesh 同集群不可行（iptables 抢占），迁移=灰度换边+双写指标对拍。
- 与 OTel：Linkerd 的 span 经 OTLP 出口可接 Tempo/Jaeger，遥测栈与 Istio 统一（s1-4 结论复用）。
- 与 Flagger/Argo Rollouts：金丝雀的"分析大脑"，把权重推进/回滚自动化。
