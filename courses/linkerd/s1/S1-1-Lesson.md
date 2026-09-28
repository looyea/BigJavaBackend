# Linkerd 架构与极简数据面

> 本节难度：★★★★☆
> 本节重要性：★★☆☆☆
> 学习产出：掌握 Linkerd 控制面组件与 linkerd2-proxy 的设计取舍，理解其与 Istio/Envoy 在资源模型和能力边界上的差异。

## 一、设计哲学：只做网格的"必需集"

```text
图目的：对比两代 Sidecar 网格的资源模型与设计取向。
Istio  = 每 Pod 一个 Envoy（C++，功能全量：L7 路由/策略/扩展），能力换资源。
Linkerd = 每 Pod 一个 linkerd2-proxy（Rust/Tokio，约 2MB 内存、亚十毫核 CPU），
         L4 连接代理为主 + 默认 mTLS + 极简运维，"装完就能用、默认就安全" 是口号。
结果：小规模/成本敏感/只要零信任与遥测 → Linkerd 有吸引力；深度 L7 治理 → Istio。
```

## 二、安装与注入：一行命令起步

```bash
linkerd install --set proxyLogLevel=info | kubectl apply -f -   # 目的：装控制面（含 CRD）
linkerd check                                                    # 输出：CLI 与控制面逐项体检（RBAC/证书/版本）
linkerd inject deploy/order-svc.yaml                             # 结果：给 Pod 模板加 linkerd.io/inject: enabled
# 错误用法：inject 后只看 yaml 已改就以为生效 → 存量 Pod 未重建 → rollout restart 才真正进网格
```

## 三、数据面：linkerd2-proxy 的取舍

```text
图目的：一次被接管的请求在 Pod 内的流转路径与端口分工。
应用出网 → iptables 重定向 → proxy outbound 4140 → 对端 proxy inbound 4143 → 对端应用。
- L4 转发为主：不解析完整 HTTP 语义（性能与内存极小的根源）；
- 但识别 HTTP/1、HTTP/2、gRPC 帧边界做指标（RPS/延迟/成功率）与路由提示；
- 协议检测（protocol detection）自动区分 TCP/HTTP —— 误判 gRPC 为 TCP 时指标退化（常见坑）。
结果：95% 网格事故（重试/熔断/路由）不需要完整 L7 代理也能做，因为决策由控制面下发、代理只执行。
```

| 维度 | linkerd2-proxy | Envoy |
|------|----------------|-------|
| 语言/内存 | Rust / ~2MB | C++ / ~30-70MB |
| 抽象层级 | L4 + 协议感知 | 完整 L7 |
| 扩展 | 基本不可插拔 | filter/WASM 生态 |
| 配置面 | 极简（注解+ServiceProfile） | CRD 全家桶 |

## 四、控制面四组件

```text
图目的：控制面职责拆分——谁发证书、谁做路由决策、谁出遥测。
- destination：核心大脑，把 Pod/Service 元数据翻译成"路由与拆分决策"推给 proxy（类似 pilot）；
- identity：内置证书签发（类似 citadel），默认全网格 mTLS，无需手动开；
- proxy-injector / sp-validator：admission webhook 注入与配置预检（istio 同款机制）；
- tap + web + metrics：实时观测 API（能"盯"某个 Pod 的活流量）与自带 Prometheus。
结果：升级/故障域小——destination 挂了仅影响新配置下发，存量代理继续转发。
```

## 五、ServiceProfile：L7 语义的入口

```yaml
# 目的：给 orders 服务声明路由语义，解锁按路由的重试/超时/错误率
apiVersion: linkerd.io/v1alpha2
kind: ServiceProfile
metadata:
  name: orders.default.svc.cluster.local   # 说明：必须等于被调服务的集群内 DNS 名
spec:
  routes:
    - name: GET /orders/{id}
      isRetryable: true                     # 结果：幂等 GET 由 sidecar 自动重试，应用不感知
      timeout: 500ms                        # 输出：超时切断并计入路由级指标
  retryClass:                                # 目的：全局退避策略（固定/指数）
    - maxRetries: 3                          # 说明：避免重试风暴放大下游
# 错误用法：给 POST /orders 也设 isRetryable: true → 非幂等重试 → 重复下单事故
```

## 六、关联技术

- CNI 插件模式：去掉 NET_ADMIN initContainer，安全合规场景标配。
- 多集群：cluster-wide 模式跨集群发现服务（Gateway 互联），比 Istio 联邦简单。
- 下一小节：能力边界与 Istio 选型 —— L4/L7、金丝雀落地与"何时选轻不选全"。
