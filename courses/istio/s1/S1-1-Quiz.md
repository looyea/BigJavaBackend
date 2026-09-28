# 控制面/数据面与 Sidecar 注入 · 小测

### 1. Istio 数据面由什么组成？（6分）

- A. istiod
- B. Envoy 代理（Sidecar/IngressGateway）
- C. Kiali
- D. kube-proxy

> 答案：B
> 解析：所有策略执行发生在 Envoy；istiod 是控制面只负责下发。

### 2. xDS 配置在 Istio 中由谁生成并下发？（6分）

- A. 每个 Envoy 自己计算
- B. istiod 监听 K8s/CRD 变化生成 xDS 推送
- C. API Server etcd watch
- D. Kubectl 手动推送

> 答案：B
> 解析：VS/DR/Pod/Service 事件在 istiod 内编译成 Listener/Route/Cluster/Endpoint（LDS/RDS/CDS/EDS）。

### 3. Sidecar 自动注入的实现机制是？（6分）

- A. DaemonSet 网络插件
- B. MutatingAdmissionWebhook 在 Pod 创建时改写 spec
- C. operator 定期重启 Pod
- D. ConfigMap 挂载

> 答案：B
> 解析：准入阶段追加 istio-proxy 容器 —— 所以改名存不补注入已运行 Pod（需 rollout）。

### 4. 应用流量进入 sidecar 的拦截方式是？（6分）

- A. DNS 劫持到服务名
- B. initContainer 配 iptables 把进出流量 REDIRECT 到 Envoy 端口
- C. 修改应用代码调用 localhost:15001
- D. Service 类型改 ExternalName

> 答案：B
> 解析：OUTPUT→15001（出）、INPUT→15006（入）；应用对代理完全无感知（结果：零改码）。

### 5. 让某个批处理 Job 的 Pod 不进网格，应使用？（6分）

- A. 删除 namespace 标签（影响全命名空间）
- B. Pod 注解 sidecar.istio.io/inject: "false"
- C. 停掉 istiod
- D. 设置 retry: 0

> 答案：B
> 解析：工作负载级豁免注解；A 是命名空间级一刀切，Job 与在线服务混部时不可取。

### 6. 给已启用注入的命名空间打了新 tag 后老 Pod 没 sidecar，正确解释是？（6分）

- A. Istio bug
- B. 注入只发生在 Pod CREATE 准入时刻，需重建（rollout restart）才生效
- C. 需要等 24 小时
- D. tag 拼写错误

> 答案：B
> 解析：spec 静态改写模型决定的行为；`kubectl rollout restart deploy/xx` 是标准动作。

### 7. 排查"VS 配置不生效"的合理工具链是？（6分）

- A. 重启集群
- B. istioctl analyze 查配置合法性 + istioctl pc 查 Envoy 实际收到的 xDS
- C. 直接改 Envoy 容器内文件
- D. 看 Kiali 颜色

> 答案：B
> 解析：先验证"配置对不对"再验证"下发没下发"——analyze→pc routes→proxy 日志三段论。

### 8. 关于多容器 Pod 与网格，正确的说法有（多选）？（9分）

- A. 共享网络命名空间，所有容器流量被同一 sidecar 接管
- B. 未装探针的日志收集容器出网也会被代理（可能非预期）
- C. 只有主容器流量被拦截
- D. 可用 excludeInboundPorts/excludeOutboundPorts 精确旁路

> 答案：A、B、D
> 解析：C 是常见误解——iptables 是 Pod 网络命名空间级，不区分容器。

### 9. 以下端口与用途对应正确的有（多选）？（9分）

- A. 15001 — Envoy 出站拦截
- B. 15006 — Envoy 入站拦截
- C. 15021 — 健康检查/就绪端口
- D. 15090 — Prometheus 抓 Envoy 指标

> 答案：A、B、C、D
> 解析：这组保留端口全对——应用占用其一会导致 Pod 启动失败或指标异常（背下来）。

### 10. 简答题：描述从 `kubectl apply` 一个注入了 sidecar 的新 Pod，到第一条请求被 Envoy 治理的完整链路。（40分）

- 要点1：API Server 持久化前经 MutatingWebhook → istiod 返回 patch：插入 istio-init 与 istio-proxy 容器（说明：准入改写）
- 要点2：istio-init 以 NET_ADMIN 配 iptables 规则后退出，结果：进出流量分别 REDIRECT 15001/15006
- 要点3：istio-proxy 启动，向 istiod(15012) 建立 xDS stream，拉取 LDS/RDS/CDS/EDS 与证书（SDS）
- 要点4：就绪探针过 15021 后 Pod Ready，Service Endpoints 加入该 Pod IP
- 要点5：首条请求：源 sidecar 匹配 VS 路由→负载均衡选 endpoint→mTLS 加密发出→目的 sidecar 15006 转发给应用，双向指标进遥测（说明：全链路由数据面完成，应用零参与）
- 反例补充：若第 3 步 istiod 不可达 → sidecar 起不来（holdApplicationUntilProxyStarts 可缓解启动竞态）

> 答案：见要点
> 解析：把"注入-拦截-下发-转发"四段机制串成一条时间线，是网格入门面试的标准深答题。
