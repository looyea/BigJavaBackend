# VirtualService/DestinationRule 流量切分

> 本节难度：★★★★☆
> 重要程度：★★★☆☆
> 学习产出：掌握 VS/DR 协作模型、按权重与请求特征的路由规则，以及连接池、离群驱逐、重试超时等韧性配置。

## 一、VS 与 DR 的分工

```text
VirtualService     = "怎么选目的地"：匹配请求（host/header/权重）→ 指向某 host 的某 subset。
DestinationRule    = "目的地长什么样"：定义 subsets（按 label 分版本）+ 端点级策略（连接池/负载均衡/离群驱逐）。
关系：VS 的 subset 名必须能在 DR 里找到，否则路由直接 503（经典错误）。
```

```yaml
# 目的：reviews 服务按版本分桶
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata: { name: reviews }
spec:
  host: reviews.prod.svc.cluster.local
  subsets:
    - name: v1
      labels: { version: v1 }      # 说明：label 选择器圈定 endpoint
    - name: v2
      labels: { version: v2 }
```

## 二、流量切分三板斧

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata: { name: reviews-vs }
spec:
  hosts: [reviews.prod.svc.cluster.local]
  http:
    - match:
        - headers:
            end-user: { exact: "tester" }      # 板斧1：内部测试用户 100% 去 v2
      route: [{ destination: { host: reviews, subset: v2 } }]
    - match:
        - uri: { prefix: "/reviews/canary" }   # 按路径切（目的：灰度指定接口）
      route: [{ destination: { host: reviews, subset: v2 } }]
    - route:                                     # 板斧2：默认按权重
        - destination: { host: reviews, subset: v1 }
          weight: 90
        - destination: { host: reviews, subset: v2 }
          weight: 10                             # 结果：90/10 金丝雀放量
    # 板斧3：mirror 流量复制（见下）
```

- 规则顺序即优先级：第一条命中的 match 生效，后面全部忽略（错误示例：把权重兜底放在第一条 → 特殊匹配永远进不去）。
- 权重是按"请求"掷骰子，长连接/连接复用场景实际比例会偏离（说明会话粘滞影响）。

## 三、流量镜像（mirror）

```yaml
    - route: [{ destination: { host: reviews, subset: v1 } }]   # 真实响应来自 v1
      mirror:
        host: reviews
        subset: v2                     # 说明：同请求异步复制发给 v2
      mirrorPercentage: { value: 100 } # 目的：v2 新版本"影子验证"，用户零感知
```

- 镜像流量错误不计入用户 SLA；v2 的资源容量必须预留（反例：100% 镜像打挂刚扩容的服务）。

## 四、韧性策略（DestinationRule 侧）

```yaml
spec:
  host: reviews.prod.svc.cluster.local
  trafficPolicy:
    loadBalancer: { simple: LEAST_REQUEST }        # 说明：慢节点自动少分流量
    connectionPool:
      tcp: { maxConnections: 100 }
      http: { h2UpgradePolicy: UPGRADE, http1MaxPendingRequests: 100 }  # 目的：排队上限即熔断前哨
    outlierDetection:                              # 离群驱逐 = 被动熔断
      consecutive5xxErrors: 5                      # 连错 5 次
      interval: 30s
      baseEjectionTime: 60s                        # 结果：坏 endpoint 摘除 1 分钟
      maxEjectionPercent: 50                       # 防雪崩：最多摘一半
```

```yaml
# VS 侧重试与超时（与 Spring Retry/Feign 重试形成三层叠加，务必只留一层做重试！）
    - route: [{ destination: { host: reviews, subset: v1 } }]
      retries: { attempts: 3, perTryTimeout: 2s, retryOn: "5xx,connect-failure" }
      timeout: 5s                                  # 目的：总预算兜底
# 错误示例：外层 ingress 3 次重试 × 内层 sidecar 3 次 = 9 倍流量放大 → 雪崩帮凶
```

## 五、南北向：Gateway 资源

```yaml
# 入口流量同样可切：Gateway(L4 监听) + VS(hosts=gateway域名) 复用上面全部规则
# 金丝雀全链路 = ingress weight 10% + 东西向 weight 10% 同步放量（两侧独立可调）
```

- `hosts` 字段决定 VS 作用范围：网格内服务名（东西向）或网关域名（南北向），写错=规则整体不生效且无报错（高频坑）。

## 六、关联技术

- 渐进交付自动化：Argo Rollouts/Flagger 操控 VS weight 指标回滚（与 argocd 分区呼应）。
- 故障注入：VS `fault: delay/abort` 先验证韧性策略真的生效（混沌最小实验）。
- 下一小节：mTLS 与可观测 —— 身份维度让 AuthorizationPolicy 精确到 principal。
