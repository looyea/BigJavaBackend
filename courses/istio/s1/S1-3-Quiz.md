# mTLS、可观测与 Ambient 演进 · 小测

### 1. PeerAuthentication STRICT 模式下，一个未注入 sidecar 的旧客户端访问网格服务会？（6分）

- A. 正常通行
- B. 明文无法完成 mTLS 协商，连接被拒
- C. 自动降级 PERMISSIVE
- D. 由 istiod 代签证书后放行

> 答案：B
> 解析：STRICT 只接受 TLS 连接；未注入客户端没有发起 mTLS 的能力——全局 STRICT 前必须完成注入覆盖。

### 2. Istio 证书的身份主体是什么？（6分）

- A. Pod IP
- B. SPIFFE ID（命名空间+服务账号）
- C. Deployment 名
- D. 节点名

> 答案：B
> 解析：身份绑 SA 不绑 IP（IP 会变）；授权策略按 principal 即签发证书里的身份。

### 3. 默认证书有效期与轮转机制？（6分）

- A. 10 年静态证书
- B. 约 24h 短证书，istiod 经 SDS 在生命期过半前自动轮换
- C. 人工 kubectl 更新 Secret
- D. 不需要证书

> 答案：B
> 解析：短周期把"私钥泄露窗口"压到小时级；轮转是 Envoy 热更新不断流（结果验证）。

### 4. 网格指标由谁上报会产生"双份计数"？（6分）

- A. source 与 destination sidecar 都可上报同一请求
- B. 应用自己上报
- C. Prometheus 重复抓取
- D. Kiali 转发

> 答案：A
> 解析：`reported` 维度区分；总量查询要先过滤 reporter 类型，否则 QPS 恰好翻倍（经典坑）。

### 5. Telemetry CRD 中 randomSamplingPercentage=1 的含义？（6分）

- A. 1% 请求被拒绝
- B. 1% 的 Trace 被采样上报
- C. 指标保留 1 天
- D. 日志级别 1

> 答案：B
> 解析：分布式 tracing 成本主控阀；高 QPS 入口给小比例、关键链路给 100% 是标准分级。

### 6. Ambient 模式中 ztunnel 负责什么？（6分）

- A. L7 路由与重试
- B. 节点级 L4 mTLS（HBONE 隧道）、认证与 L4 指标
- C. 证书签发
- D. Sidecar 注入

> 答案：B
> 解析：L7 治理交给可选的 waypoint Envoy；istiod 仍管控制面（各组件职责勿混）。

### 7. mTLS 与 AuthorizationPolicy 的关系？（6分）

- A. 开了 STRICT 就等于做了访问控制
- B. mTLS 提供身份与加密，能否访问仍要 AuthorizationPolicy 定义
- C. 二者功能重叠
- D. 授权只能基于 IP 段

> 答案：B
> 解析：零信任 = 身份（mTLS）+ 授权（policy）两层；只加密不设白名单，网格内任意服务仍可互访（常见安全误解）。

### 8. 以下哪些属于 Envoy 内置网格指标（多选）？（9分）

- A. istio_requests_total
- B. istio_request_duration_milliseconds_bucket
- C. istio_tcp_connections_opened_total
- D. jvm_memory_used_bytes

> 答案：A、B、C
> 解析：D 是应用 JVM 指标（micrometer 世界）；网格指标刻画"流经代理的流量"。

### 9. Ambient 相对 Sidecar 的收益与代价，正确的有（多选）？（9分）

- A. 省掉每 Pod 一个 Envoy 的内存与 CPU
- B. 不再有注入时序与豁免管理问题
- C. L7 能力已全部超越 Sidecar 模式
- D. 依赖 CNI 插件做内核重定向，网络栈复杂度上移

> 答案：A、B、D
> 解析：C 不成立——waypoint 的 L7 特性仍在追赶（如部分路由/策略语义），迁移要按能力清单核对（说明演进有边界）。

### 10. 简答题：为金融私有云集群设计"全链路加密 + 最小权限 + 可观测"的 Istio 安全遥测方案，说明灰度顺序与验证手段。（40分）

- 要点1：现状盘点：注入覆盖率、未入网格负载清单（VM/DB 用 ServiceEntry 或豁免策略），目的：STRICT 前置条件量化
- 要点2：mTLS 灰度：全 mesh PERMISSIVE → 按 ns 观察 `response_flags`/明文计数归零 → 逐 ns STRICT（结果：每次爆炸半径一个 ns）
- 要点3：授权收敛：默认 deny-all AuthorizationPolicy（根级），再按调用关系白名单放行 principal→操作（说明：先加密后收权顺序不能反）
- 要点4：遥测分级：默认目的端上报指标（避免双份）、accessLog 采样输出、Trace 按链路分级 1%~100%，OTLP 进统一后端（与 OTel/SW 集成呼应）
- 要点5：验证手段：抓包证明明文端口已是 TLS 载荷、未授权 principal curl 返回 RBAC 拒绝、轮转窗口内长连接不断（三项演练输出报告）
- 要点6：持续保障：证书/策略变更进 GitOps 评审，Kiali+istioctl analyze 做 CI 门禁（反例：手工 kubectl 改安全策略无审计）

> 答案：见要点
> 解析：把"加密、授权、观测"三件事组织成有依赖顺序的工程流水线，是网格安全的满分框架。
