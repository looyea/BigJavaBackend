# 网格的延迟/资源成本与何时不用（关联）

> 本节难度：★★★★☆
> 本节重要性：★★★☆☆
> 学习产出：能量化 Sidecar 数据平面的延迟与资源成本，掌握降低网格开销的手段，能给出"什么时候不用网格"的清晰判据，并与 Linkerd 做出选型对比。

## 一、成本从哪来：每跳两次的账

```text
图目的：一个请求过网格要多付什么。
无网格：App → 网络 → App（1 次协议处理）
有网格：App → localhost 进 Sidecar → 网络 → 对端 Sidecar → App（每端各一次 inbound+outbound 转发）
构成：UNIX socket 进出 + iptables 重定向 + LB/路由决策 + TLS(RBAC) 编解码 + 指标/日志产出
结果：单机内延迟增加约 0.5~2ms/跳（均值），尾延迟在连接 churn 下更难看；资源是每 Pod 一个 proxy 的 CPU/内存底租。
```

- 规模账：500 Pod × sidecar 约 0.1~0.5 核 + 50~150Mi，集群光数据面底租就是几十核——小流量业务这笔钱买不来收益。

## 二、给 Java 服务的特别关注点

```yaml
# 常见降成本配置组合（示例）
metadata:
  annotations:
    sidecar.istio.io/inject: "false"        # 对纯批处理/内部心跳类 Pod 直接不注入（错误预期：全 ns 无脑注入）
  resources:                                # sidecar 资源写在 injector 的 PodTemplate 补丁里
    requests: { cpu: 100m, memory: 128Mi }
    limits:   { cpu: "1",   memory: 512Mi }   # 反例：limits 给太小 → proxy 线程被 CFS 节流，P99 诡异飙升
# 异常关注：JVM 长连接 + mTLS 证书轮转窗口偶发 handshake 失败；gRPC 长连接负载不均要靠 L7 模式解（s1-2）
```

- 大对象序列化协议（Dubbo 二进制）走网格 L7 探测可能识别失败退化为 TCP 模式——收益打折但成本照付（先 PoC 再全量）。

## 三、Linkerd 对照：两种哲学

| 维度 | Istio | Linkerd |
|------|-------|---------|
| 数据面 | Envoy（C++，功能极全） | proxy2（Rust，极简只干 L5/L7 路由+mTLS） |
| 功能面 | 流量+安全+可观测+策略全家桶 | 专注透明代理与黄金指标，少而稳 |
| 资源/延迟 | sidecar 较重，需精细调 | 底租显著更低（官方与社区常引 ~同量级 1/3~1/5） |
| 复杂度 | 高（CRD 多、演进快、坑多） | 低（装完即用，KRSH：K8s 原生友好） |
| 生态位 | 大厂平台化、多协议、Gateway API 激进 | 中小团队、纯 K8s 流量、运维人力省 |

## 四、何时不用网格（判据比功能更重要）

1. **低延迟内联场景**：撮合/行情/支付核心链路把每跳毫秒看得比治理重——用 SDK 侧熔断限流（sentinel）+ 应用自观测替代。
2. **团队没人力养它**：网格故障形态复杂（sidecar 起不来、证书过期、注入时序），无平台团队时是"引入一个新的分布式系统"（反例：5 人创业团队上 istio 追潮流）。
3. **非 K8s 或 VM 混部**：网格价值锚定 K8s Service，虚机为主的存量系统收益极低。
4. **协议特化重**：私有 TCP 协议、超长连接、组播——L7 能力用不上，L4 mTLS 又可用更轻手段（IPsec/服务内 TLS）替代。
5. 规模过小：几十个 Pod 的集群，一套 nginx/grpc LB + 库级重试就够，网格的边际收益覆盖不了底租。

## 五、决定用之前的量化程序

- PoC 三门槛：①目标协议在网格下的 P99 增量大屏（对照基线）；②全链路压测下 proxy 资源水位与节点扩容成本；③演练一次"istiod 挂/sidecar CrashLoop"的爆炸半径（异常场景：控制面故障不应影响存量数据面转发——验证它）。
- 通过标准写进 ADR：延迟预算、成本预算、回滚开关（namespace 级关闭注入即回滚）。

## 六、关联技术

- 网格收益面（流量切分/mTLS/可观测）见 istio s1-1~s1-3；Linkerd 详述在 linkerd 包（其 s1-1 有反向对比视角）。
- 不用网格时的替代件：spring-cloud-gateway（南北向）、sentinel/resilience4j（东西向容错）、opentelemetry（无边车埋点）。
