# mTLS、可观测与 Ambient 演进 · 面试题

## 题 1：讲清 Istio mTLS 的一次完整握手（数据面视角）。

```text
1. 源 sidecar 收到应用明文请求 → 命中目标 cluster 的 TLS 上下文（istiod 经 SDS 下发）。
2. 发起 TLS 握手：出示自己的证书（SAN=spiffe://.../sa/src-svc），校验对端证书链（信任域一致）。
3. 目的 sidecar 验签通过 → 结合 PeerAuthentication 模式决定是否放行 → 明文转给应用。
4. 证书约半天轮换：SDS 热更新，长连接不因轮转断开（追问点：不断靠 Envoy secret 原子替换）。
关键：应用全程只见明文 —— 加密是基础设施行为（结果：零代码改造）。
```

## 题 2：只有 mTLS STRICT，安全上够吗？

- 不够：STRICT 保证"网格内身份可信 + 传输加密"，但任何带证书的服务都能访问任何服务（默认全通）。
- 缺的是授权层：deny-all + 按 principal/方法/路径白名单（AuthorizationPolicy）。
- 还缺：east-west 外的入口侧鉴权（JWT RequestAuthentication）、审计（accessLog 身份字段）、密钥管理（CA 证书轮转与信任根保护）。
- 高分点：说出"零信任 = 持续验证身份 + 最小权限授权，mTLS 只完成前一半"。

## 题 3：为什么 Ambient 把 L4 与 L7 拆开？

```text
观察：绝大多数网格价值（mTLS、身份、L4 指标、访问策略）只需 L4，且逐包一致。
每 Pod Envoy 90% 的工作其实是 L4 转发 —— 为它付出全量内存与注入复杂度不划算。
拆法：节点级 ztunnel 吃掉 L4（Rust 低内存），L7 是"按需付费"的 waypoint（只给需要金丝雀/重试的服务挂）。
结果：治理粒度不变、成本模型从 O(Pod) 变 O(节点)+O(需要L7的服务)。
追问"为什么不干脆全去代理"：内核/ebpf 拿不到 L7 语义与用户态连接管理细节（说明边界）。
```

## 题 4：网格指标的 response_flags 有什么用？举三个排障场景。

- `UF`：无可用上游（subset 配错/DR 缺失/驱逐摘光）→ 查 endpoint 与 DR。
- `UO`：circuit breaker/连接池溢出 → 查 outlier 与 maxPending 配置（被限流了不是下游挂了）。
- `DC`：下游连接中断（客户端提前断开/Pod 驱逐）→ 与发布事件对齐。
- 说明：503 的"锅源"三分法（自己/网络/下游）几乎全靠 flags 判读，比看状态码高效一个量级。

## 题 5：Trace 上 sidecar span 和应用 span 怎么缝合？

- 源 sidecar 在出站请求注入/复用 trace 头（W3C），建 exit span；目的 sidecar 建 entry span 再传给应用。
- 应用内 SDK（OTel/其他）继续传播同一 traceId → 一条 Trace 交替出现 proxy 段与应用段。
- 结果价值：proxy span 时长 - 应用 span 时长 ≈ 网络+排队开销，跨集群慢问题定位利器。
- 反例：应用自己换 traceId（自定义传播不接标准头）→ 链路在应用内"分身"（说明传播规范必须全栈统一）。

## 题 6：CA 被攻破的风险模型与缓解？

1. 短证书 + 自动轮转：拿到私钥的有效利用窗口 ~小时级（默认设计即缓解）。
2. 信任域隔离：多集群/多租户分根，跨域走联邦互信而非共享根（爆炸半径控制）。
3. 集群内：istiod 的签发权限受 CSR 审批策略约束（SA 绑定校验），防横向伪造身份。
4. 进阶：接外部 PKI/Vault 作密钥源，审计签发日志异常（高频申请 = 失陷信号）。
