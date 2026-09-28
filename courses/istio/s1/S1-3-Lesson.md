# mTLS、可观测与 Ambient 演进

> 本节难度：★★★★☆
> 本节重要性：★★★☆☆
> 学习产出：掌握对等/严格 mTLS 模式与证书轮转、网格遥测三件套，理解 Ambient 模式去 Sidecar 的架构动机。

## 一、mTLS：身份与加密

```yaml
# 目的：命名空间强制严格 mTLS（只接受网格内加密流量）
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata: { name: strict-mtls, namespace: prod }
spec:
  mtls: { mode: STRICT }           # 结果：明文请求被 sidecar 直接拒绝
---
# 默认模式 PERMISSIVE（迁移期双栈）：明文与 mTLS 都可进 —— 灰度安全垫
# 粒度：mesh 级 → namespace 级 → 端口级（Pod 上单独开明文端口用非 STRICT 兜底）
# 错误场景：后端切 STRICT 但 Gateway 未配对应 mTLS → 南北向明文入站被拒 → 外部用户瞬间 503
```

- 身份模型：证书 SAN = `spiffe://cluster/ns/prod/sa/order-svc` —— 服务账号即身份，AuthorizationPolicy 按 principal 授权（零信任基线：身份先于网络）。
- 证书机制：istiod 签发短周期证书（默认 24h，约 1/2~1/3 生命期自动轮转），私钥经 SDS 下发 Envoy，不落盘 K8s Secret（目的：泄露窗口最小化）。
- 迁移路线：PERMISSIVE 全网跑通 → 观察指标确认 100% mTLS → 逐 ns 切 STRICT（错误做法：直接全局 STRICT，未注入的命名空间瞬间断流）。

## 二、网格可观测三件套

```text
Metrics：Envoy 内置 istio_requests_total / _bytes / _duration_milliseconds 家族，
         维度含 response_code、destination_service、reported（谁上报：source/destination）。
         Prometheus 默认抓 15090 —— 零配置即得全网格 RED 指标。
Logging：accessLog 配 File/OTLP 后端，结构化 JSON 含 downstream/remotes 身份字段。
Tracing：sidecar 生成 span（entry/span 两段），经 OTLP/Zipkin 上报 —— 与应用 span 自动缝合。
```

```yaml
# 目的：Telemetry CRD 按成本分级采样
apiVersion: telemetry.istio.io/v1
kind: Telemetry
spec:
  selector: { matchLabels: { app: high-qps-gateway } }
  tracing:
    - providers: [{ name: otel-skywalking }]
      randomSamplingPercentage: 1     # 输出：高 QPS 入口只采 1%，核心链路服务保 100%
  metrics:
    - reporters: [{ destination: true }]  # 说明：只保留目的端上报，指标量减半
```

- Kiali：拓扑 + 流量动画 + 配置校验可视化，排"配置生效吗"类问题第一入口。

## 三、Ambient Mesh：去 Sidecar 演进

```text
Sidecar 之痛：每 Pod 一个 Envoy → 内存随 Pod 数线性涨、注入时序问题、语言无关但"进程伴生"。
Ambient 拆成两层：
  ztunnel（节点级 DaemonSet）：L4 mTLS + 认证 + L4 指标 —— Rust 实现，每节点一个。
  waypoint（按 namespace/SA 可选部署的独立 Envoy）：L7 路由/重试/L7 策略。
数据路径：app → 本节点 ztunnel ──HBONE(双向 mTLS 隧道)──> 对端 ztunnel → app（L4 全程加密）。
结果：90% 场景不再需要每 Pod Envoy；要 L7 治理的那部分服务才挂 waypoint（成本精准投放）。
```

- 协议细节：HBONE = HTTP/2 CONNECT 隧道携带原始流量 + 身份头，对端 ztunnel 解封装。
- 现状判断（面试口径）：Ambient 自 1.20+ 逐步 GA 中，L7 能力靠 waypoint 仍在补齐；存量 Sidecar 集群迁移需灰度评估，不能一句话"下一代碾压"（结论要有边界）。

## 四、Sidecar vs Ambient 对比

| 维度 | Sidecar | Ambient |
|------|---------|---------|
| 资源模型 | 每 Pod 一 Envoy | 每节点 ztunnel + 按需 waypoint |
| L7 能力 | 全量、成熟 | waypoint 提供，逐版本补齐 |
| 注入时序问题 | 有（竞态/豁免） | 无（Pod 不改造） |
| CNI 依赖 | 可选 | 必须（内核重定向） |
| 适用 | 深度流量治理现状 | 大规模/资源敏感/新建集群 |

## 五、关联技术

- SPIFFE 生态：Istio 身份即 SPIFFE ID，可与其它 SPIFFE 体系互认（跨 mesh 信任域联邦）。
- 授权纵深：mTLS 解决"谁在说话"，AuthorizationPolicy 解决"能说什么"——缺后者的 STRICT 只是加密不是白名单（常见安全误解）。
- 下一小节（s1-4 关联）：网格的延迟/资源成本核算与"何时不用 Istio"的反向决策。
