# VirtualService/DestinationRule 流量切分 · 面试题

## 题 1：Istio 的金丝雀与蓝绿、Argo Rollouts 的关系？

- 蓝绿 = 两套完整环境 + 一次性切 100%（回滚快但双倍资源、无渐进）。
- 金丝雀 = 同 Service 内按权重渐进（Istio VS 天然支持）。
- Argo Rollouts：把"放量-观测-继续/回滚"自动化（Canary Analysis 读 Prometheus 指标决定步进），Istio 只是它操控的 traffic controller 之一（结论：网格给能力，控制器给流程）。

## 题 2：VS 配了 90/10 但监控看到 v2 只有 2%，可能原因？

```text
1. 流量并非都经过该 VS：调用方未入网格/直连 Pod IP（sidecar bypass）。
2. gRPC/长连接复用：连接建立时已定目标，权重只对新连接生效（结果：老连接"钉住"v1）。
3. 规则顺序：前面有 match 截走了 8% 正常流量。
4. 统计口径：看的是 destination 指标的服务级而非 subset 级（labels.version 未透传）。
排查顺序：istioctl pc routes 确认下发 → 再看具体调用方身份。
```

## 题 3：离群驱逐与 Sentinel/Hystrix 熔断的本质区别？

| 维度 | outlierDetection | 应用级熔断 |
|------|------------------|-----------|
| 粒度 | endpoint（实例） | 方法/依赖（更细语义） |
| 视角 | 网络/实例健康 | 业务错误码可参与 |
| 动作 | 摘流量换健康实例 | 快速失败/fallback |
| 归属 | 基础设施层（零代码） | 业务层（有代码） |

- 高分答：两者互补——网格管"哪台机器坏了"，应用熔断管"哪个业务逻辑失败了"；业务 500（HTTP 200 带错误码）网格看不见（说明 error classification 边界）。

## 题 4：连接池限制（http1MaxPendingRequests）触顶后发生什么？

- 新请求直接 local 拒绝（503 UF/Overflow），不再排队 —— 这是 Envoy 的过载保护（目的：快速失败优于雪崩式堆积）。
- 表现：发起方 sidecar 计 503，被调方日志无此请求（"没到就到不了"排障特征）。
- 实践：值 = 被调方线程/连接承载能力的映射，压测定量而非拍脑袋；配合 LEAST_REQUEST 与自动扩缩形成闭环。

## 题 5：如何用网格做无损发布（连接级）？

1. 优雅排空：draining——`terminationDrainTimeout`（DR）让 Pod 下线前旧连接渐进关闭。
2. 连接迁移：新连接按权重进新版本，长连接旧版本等自然消亡。
3. 健康检查兜底：readiness 挂 preStop sleep，确保 EDS 摘除先于进程退出（常见 502 根因就是顺序反了）。
4. 验收指标：发布窗口内 5xx 计数与连接 reset 率（结果：应 <0.01%）。

## 题 6：DR 的 host 写短名 `reviews` 与 FQDN 的差异？

- 短名按"配置所在 namespace + 搜索域"解析 —— 跨 namespace 引用（mesh 级 VS 指向别 ns 服务）时可能解析到错误服务（同名！）。
- 规范：生产配置一律写 FQDN（`reviews.prod.svc.cluster.local`），多集群下还要带 cluster 后缀。
- 反例事故：test 与 prod 同名服务、DR 放根 namespace 用短名 → 测试流量进生产（错误示例的真实版）。
