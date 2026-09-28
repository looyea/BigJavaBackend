# Linkerd 架构与极简数据面 · 面试题

## 题 1：Linkerd 为什么能做到 sidecar 只有 2MB？

核心是**功能边界换资源**：linkerd2-proxy 用 Rust/Tokio 做纯异步 L4 连接转发，不实现完整 L7 filter 链、不做可插拔扩展、不缓存全量路由表（路由决策来自 destination 控制面，代理只执行）。Envoy 内存大头在 HTTP/2 流控状态机、filter 配置与集群管理，Linkerd 把这些"要么砍掉要么上移控制面"。

## 题 2：控制面挂了，数据面会怎样？为什么？

不受影响。配置模型是"控制面推送 + 代理本地缓存"：proxy 启动时拿到路由与端点快照，之后增量更新。destination 宕机只意味着**新**的部署/路由变更不下发，存量转发继续。这也是考察"控制面故障半径"设计的经典答案：好的网格让控制面成为"非请求路径"组件。

## 题 3：ServiceProfile 与 Istio VirtualService 的定位差异？

- ServiceProfile：面向**被调服务**声明路由名、可重试性、超时——是给 L4 代理补 L7 语义的"说明书"，不是流量拆分工具。
- VirtualService：面向**调用方/入口**的完整 L7 路由（权重、头匹配、镜像、多 destination）。
- 结论：Linkerd 的流量切分能力（traffic split CRD）远少于 Istio，复杂灰度要借 Flagger/Argo Rollouts。

## 题 4：gRPC 指标为什么可能退化成 TCP 级？如何修？

Linkerd 靠协议检测识别 HTTP/2；若 Service 端口命名不是 `http`/`grpc`/`http2` 等约定名，或流量走了不被检测的端口，就按不透明 TCP 统计——没有路由级 RPS/成功率。修复：规范端口名，或在 Pod 注解强制指定协议（结果：tap 与指标恢复路由维度）。

## 题 5：什么场景明确选 Linkerd 而不是 Istio？

1. 需求就是 mTLS + 遥测 + 基础重试超时（零信任最小集）。
2. 集群规模大、sidecar 资源账单敏感（每 Pod 省 30-70MB 数量级）。
3. 团队小，养不起 CRD 全家桶的排障复杂度。
反例：需要细粒度灰度（按头分流、镜像流量）、OPA 深度策略、多协议扩展 → Linkerd 能力边界外，硬用会到处打洞。
