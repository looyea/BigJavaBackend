# Linkerd 架构与极简数据面 · 小测

### 1. linkerd2-proxy 的实现语言与定位是？（6分）

- A. C++，完整 L7 代理
- B. Rust，L4 连接代理 + 协议感知
- C. Go，L7 网关
- D. Java，Servlet 过滤器

> 答案：B
> 解析：Rust/Tokio 带来约 2MB 内存占用；不解析完整 HTTP 语义是"极简"的根源。

### 2. Linkerd 默认开启的能力是？（6分）

- A. mTLS（identity 组件自动签发轮转证书）
- B. WASM 扩展
- C. 分布式追踪采样
- D. 全局限流

> 答案：A
> 解析：默认全网格 mTLS 是 Linkerd 的核心卖点，无需像 Istio 手动切 STRICT。

### 3. destination 组件的职责是？（6分）

- A. 证书签发
- B. 把服务/Pod 元数据翻译成路由与拆分决策推给 proxy
- C. 注入 sidecar
- D. 存储指标

> 答案：B
> 解析：destination 相当于 Istio 的 pilot，是控制面的"大脑"。

### 4. ServiceProfile 中 isRetryable 应设给哪些路由？（6分）

- A. 所有路由都开，提高成功率
- B. 仅幂等路由（如 GET）
- C. 仅 POST 创建路由
- D. 由 proxy 自动推断，无需配置

> 答案：B
> 解析：非幂等重试会造成重复扣款/重复下单；Linkerd 要求显式声明可重试路由。

### 5. 对 yaml 执行 linkerd inject 后存量 Pod 要进网格还需？（6分）

- A. 重启控制面
- B. rollout restart 重建 Pod（注入发生在创建时）
- C. 重新安装 Linkerd
- D. 什么都不用，注解即时生效

> 答案：B
> 解析：sidecar 注入是 admission webhook 在 Pod CREATE 时改写 spec，存量 Pod 不变。

### 6. gRPC 服务在 Linkerd 中指标退化为 TCP 级的常见原因是？（6分）

- A. gRPC 不被支持
- B. 协议检测误判为不透明 TCP 流量
- C. mTLS 握手失败
- D. ServiceProfile 未删除

> 答案：B
> 解析：protocol detection 依赖端口名约定（如 http、grpc 或端口名后缀），误配则按 TCP 统计。

### 7. destination 控制面故障时数据面行为是？（6分）

- A. 全部流量中断
- B. 存量 proxy 继续按最后下发的配置转发
- C. 自动降级为明文
- D. Pod 全部重启

> 答案：B
> 解析：配置是"推拉+缓存"模型，控制面只影响新配置下发，转发不依赖控制面在线。

### 8. 以下哪些属于 Linkerd 控制面组件？（多选）（9分）

- A. destination
- B. identity
- C. proxy-injector
- D. citadel

> 答案：A、B、C
> 解析：citadel 是 Istio 的证书组件名；Linkerd 对应的是 identity。

### 9. 与 Envoy 相比，linkerd2-proxy 的特点包括（多选）？（9分）

- A. 内存占用显著更小
- B. 支持完整 L7 filter/WASM 生态
- C. 配置面极简（注解 + ServiceProfile）
- D. L4 转发为主、协议感知为辅

> 答案：A、C、D
> 解析：B 恰是 Envoy 的优势，Linkerd 为极简放弃了可插拔扩展。

### 10. 简答题：画出一次被接管的跨 Pod 请求在 Linkerd 数据面的完整路径，并说明端口与加密发生在哪一段。（40分）

- 要点1：应用发起出站连接 → iptables 按链规则 REDIRECT 到本 Pod proxy 的 outbound 端口 4140
- 要点2：本端 proxy 查 destination 下发的路由决策，确定目标 endpoint 并建立 mTLS（identity 签发的短周期证书，SPIFFE 身份）
- 要点3：流量经 proxy 间的连接级加密隧道（类比 Istio Ambient 的 HBONE，但为 Linkerd 自有实现）到达对端 Pod proxy 的 inbound 端口 4143
- 要点4：对端 proxy 校验证书身份后解密，转发给本地应用容器（应用全程零改动、明文只在 Pod 内内核空间之外不可见）
- 要点5：两端 proxy 各自产出 source/destination 视角指标，由自带 Prometheus 聚合，tap 可实时观察活流量
- 要点6：错误用例说明：若某跳未注入 proxy（如豁免容器），则该跳走明文直连，mTLS 边界随注入范围而变

> 答案：见要点
> 解析：理解 4140/4143 与"身份随注入"两点，就能解释大部分网格连通性故障。
