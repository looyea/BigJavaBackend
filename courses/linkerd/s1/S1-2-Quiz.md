# 能力边界与 Istio 选型（关联） · 小测

### 1. Linkerd 原生具备的流量切分能力是？（6分）

- A. 按 Header 精确分流
- B. TrafficSplit 按权重切分新连接
- C. 流量镜像到影子服务
- D. 多阶段路由级金丝雀语法

> 答案：B
> 解析：Header 分流/镜像是 Istio VirtualService 的能力，Linkerd 刻意不做。

### 2. TrafficSplit 权重作用于哪类流量？（6分）

- A. 所有请求逐条划分
- B. 新建连接按权重划分，存量长连接不迁移
- C. 仅 HTTP/2
- D. 仅 gRPC

> 答案：B
> 解析：L4 连接级切分，长连接（如 gRPC 多路复用）需客户端重连才反映权重。

### 3. 金丝雀自动推进/回滚通常交给谁？（6分）

- A. linkerd2-proxy 内置分析
- B. Flagger / Argo Rollouts 读指标决策
- C. destination 组件
- D. ServiceProfile

> 答案：B
> 解析：Linkerd 只提供切分原语，"看指标决定加权或回滚"是渐进交付控制器的职责。

### 4. 关于 Linkerd 与 mTLS/授权的关系，正确的说法是？（6分）

- A. 默认 mTLS 即默认白名单授权
- B. mTLS 解决加密与身份，授权需另配 deny-all + 显式允许
- C. 授权粒度与 Istio AuthorizationPolicy 完全相同
- D. 不支持任何网络策略

> 答案：B
> 解析：装完网格默认"全部服务加密互通"，不配策略东西向照样任意可达（mTLS ≠ 授权）。

### 5. 双 mesh（Istio + Linkerd）同集群并行的主要障碍是？（6分）

- A. 语言不同
- B. 两者 iptables 劫持规则冲突，无法同时接管同一 Pod
- C. Prometheus 版本不兼容
- D. 证书算法不同

> 答案：B
> 解析：数据面劫持是排他的；迁移要按命名空间灰度换边，不能同 Pod 叠两套 sidecar。

### 6. 选型口诀"为用不到的能力付费"针对的是？（6分）

- A. 选 Linkerd 省钱
- B. 需求只有 mTLS+遥测却部署 Istio 全家桶
- C. 不买商业版
- D. 不用 WASM

> 答案：B
> 解析：深度 L7 治理没有需求时，Istio 的 CRD 复杂度与资源账单就是纯负债。

### 7. Linkerd 的实时排障第一入口是？（6分）

- A. istioctl pc routes
- B. linkerd tap
- C. Kiali 拓扑
- D. Envoy admin 15000

> 答案：B
> 解析：tap 能像 tcpdump 一样盯某个工作负载的活流量与指标，等价于 Istio 的多个工具合一。

### 8. 以下哪些属于 Linkerd 的能力边界（不支持或明显弱于 Istio）？（多选）（9分）

- A. 按 Header/Cookie 的 L7 分流
- B. 默认 mTLS
- C. Lua/WASM 过滤器扩展
- D. OPA 级细粒度授权策略

> 答案：A、C、D
> 解析：B 恰是 Linkerd 的默认强项；A/C/D 是它相对 Istio 的留白。

### 9. 金丝雀发布在 Linkerd 集群里可观测的正确做法包括（多选）？（9分）

- A. 灰度期间对比 v1/v2 的错误率与 P99
- B. 只看 Pod 数量比例即宣布健康
- C. 用 Flagger 指标分析自动回滚
- D. tap 抽查新版本实例的活流量

> 答案：A、C、D
> 解析：B 是典型反例——权重切了不等于健康，没有指标对拍的灰度形同裸奔。

### 10. 简答题：给出"从 Istio 迁到 Linkerd（或反向）"的决策与迁移方案要点。（40分）

- 要点1：先做能力对照审计：列出现网用到的 VS/DR/AuthorizationPolicy 特性，按头分流、镜像若在用则只能选 Istio（错误用例：低估已用特性导致迁回）
- 要点2：需求收敛验证：多数团队实际只用了 mTLS+遥测+权重灰度，迁 Linkerd 可把 sidecar 内存账单降一个数量级
- 要点3：迁移按命名空间灰度：同一 ns 不能双 mesh 并存（iptables 冲突），逐 ns"拆一边装一边"，迁移窗口用 PERMISSIVE/双证书保证互通
- 要点4：双写对拍：Prometheus 同时抓两套网格指标，Grafana 面板对齐 RED 口径，验证无观测真空再下线旧控制面
- 要点5：授权重表达：Istio AuthorizationPolicy 逐条翻译为 Linkerd 网络策略，翻译不了的（principal 级 ABAC）是选 Linkerd 的硬阻断
- 要点6：回滚预案：迁移期间保留旧 ns 注入注解，出现 503 风暴可整 ns 回切（结果：单向门变双向门）

> 答案：见要点
> 解析：网格迁移的风险都在"隐性已用特性"与"观测真空"，审计与对拍缺一不可。
