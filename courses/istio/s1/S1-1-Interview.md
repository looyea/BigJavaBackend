# 控制面/数据面与 Sidecar 注入 · 面试题

## 题 1：用一段话讲清 Istio 的架构。

```text
每 Pod 一个 Envoy sidecar 接管进出流量（数据面），istiod 把 K8s 资源+Istio CRD 编译成
xDS 配置动态下发并签发 mTLS 证书（控制面）。收益：L7 治理能力（重试/熔断/金丝雀/加密）
与业务代码彻底解耦；代价：每 Pod 资源开销 + 每跳延迟 + 平台复杂度。
```

## 题 2：istiod 挂了，正在运行的网格会怎样？

- 已下发到 Envoy 的配置继续生效 —— 存量流量不断（数据面自治）。
- 受影响：新 Pod 注入失败（webhook 不可用）、服务伸缩/变更不再下发（EDS 停更）、证书到期无法轮转（长时间会造成 mTLS 握手失败）。
- 结论：istiod 是高可用关键组件（多副本+PDB），但不是"挂了立刻全线瘫痪"的单点（说明面试区分度）。
- 错误认知："控制面无状态所以随便挂" —— 忽略了证书轮转与配置收敛的时间炸弹。

## 题 3：sidecar 模式下延迟增加来自哪里？大概多少？

1. 两跳内核态转发（应用→proxy→应用）与用户态协议解析：HTTP 单跳典型 +0.5~2ms。
2. TLS 握手（mTLS 会话复用后摊薄，但首连可观）。
3. 连接池竞争与 CPU 争抢（proxy 与应用同 Pod 抢核）。
- 追问"怎么量化"：起直连 vs 走网格的同路径压测对比 P50/P99；Kiali/遥测里 `istio_request_duration_milliseconds` 的 report 拆分（结果数据说话）。

## 题 4：什么流量不会被 sidecar 接管？列举四类。

1. 显式豁免：excludeIPRanges/excludePorts、注入=false 的负载。
2. 非 TCP/HTTP 协议盲区：如某些 UDP/内核旁路（协议感知受限）。
3. Pod 外流量：节点上非网格进程（DaemonSet 未注入部分）。
4. 启动竞态窗口：istio-proxy 就绪前应用自己发起的连接（passthrough）。
- 引申：安全边界讨论 —— "进了 Pod 都算在网格内"是错觉，豁免清单要进安全评审。

## 题 5：CNI 插件模式解决什么问题？

- 默认 initContainer 需要 NET_ADMIN 特权 —— 违反最小权限基线（金融合规常直接否掉）。
- Istio CNI 插件（DaemonSet 在节点侧配 iptables）去掉该特权；同时缓解启动顺序竞态。
- 说明：这属于"平台工程细节"，答出来对 Kubernetes 安全加固经验是强加分。

## 题 6：EnvoyFilter 为什么被称为"双刃剑"？

```text
能力：直接改 xDS 输出（插 filter、调连接池底层参数）—— 官方模型覆盖不了都能兜底。
风险：
1. 绑定 Envoy 内部 API：Istio 升级 = Envoy 大版本跳 = 自定义 filter 静默失效或崩溃（结果不可控）；
2. 作用域是"配置字节"而非语义：同一 filter 名冲突会互相覆盖，多团队共管一网格时互相踩；
治理：EnvoyFilter 需架构评审白名单 + 版本升级前专项回归（目的：逃生舱只能应急不能常驻）。
```
