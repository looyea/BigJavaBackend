# 探针与优雅停机 · 小测

### 1. livenessProbe 失败会导致？（6分）

- A. 仅摘流量不重启
- B. 容器被重启
- C. Pod 被删除
- D. 节点隔离

> 答案：B
> 解析：liveness 判"该进程活着吗"，失败按阈值重启容器；摘流量是 readiness 的职责（错误配置：把两者混为一谈）。

### 2. readinessProbe 失败的效果是？（6分）

- A. 重启容器
- B. 该 Pod IP 从 Service 端点摘除，不再接流量
- C. 删除 Pod
- D. 停止节点

> 答案：B
> 解析：readiness 管"能不能接请求"，失败只摘流不重启，恢复后自动回流量（结果：依赖抖动时这是柔性降级点）。

### 3. 启动需要 90s 的 Spring 应用，最该配哪个探针避免被误杀？（6分）

- A. liveness
- B. startupProbe
- C. readiness
- D. 都不配

> 答案：B
> 解析：startupProbe 在启动预算内压制 liveness/readiness，跑通后才启用后两者（示例：failureThreshold×periodSeconds 给足启动时间）。

### 4. 依赖的 DB 短暂不可用，正确反应应是？（6分）

- A. liveness 失败重启 Pod
- B. readiness 失败摘流量，等 DB 恢复自动回来
- C. 删除 Deployment
- D. 扩副本

> 答案：B
> 解析：重启解决不了"外部依赖没好"，反而扩大故障（错误配置：让 liveness 探测依赖 DB 的聚合健康=雪崩放大器）。

### 5. Pod 删除时序中，preStop 钩子与摘流量的关系是？（6分）

- A. 先摘流完成再执行 preStop，绝对有序
- B. 摘流传播与 preStop/终止是并发进行的
- C. preStop 在 SIGKILL 之后
- D. 无 preStop

> 答案：B
> 解析：EndpointSlice 摘除经 kube-proxy 传播有延迟，与 preStop、SIGTERM 并发——所以要用 preStop sleep 兜住"流量还在进就已关"窗口（经典 502 根因）。

### 6. terminationGracePeriodSeconds 默认与用途是？（6分）

- A. 10s，启动超时
- B. 30s，从删除开始给进程优雅退出的总预算，超则 SIGKILL
- C. 60s，镜像拉取
- D. 无限

> 答案：B
> 解析：宽限期要 > preStop 等待 + 应用排空时间（错误配置：宽限 30 < 排空 40 → 被硬切）。

### 7. Spring Boot 开启优雅关闭的关键配置是？（6分）

- A. server.shutdown=immediate
- B. server.shutdown=graceful + timeout-per-shutdown-phase
- C. management.endpoints 关闭
- D. 无需配置

> 答案：B
> 解析：graceful 让收到 SIGTERM 后停止接新请求、在途请求在超时预算内做完（说明：与 K8s 宽限期协同才有效）。

### 8. 关于 ENTRYPOINT 与信号，正确的有（多选）（9分）

- A. shell 形式 ENTRYPOINT 会让 shell 成 PID 1，SIGTERM 可能到不了 java
- B. exec 形式 `["java","-jar",...]` 让 java 直接是主进程、能收到 SIGTERM
- C. PID 1 问题可用 tini/dumb-init 解决
- D. 信号传递与优雅停机无关

> 答案：ABC
> 解析：A/B/C 都是让 SIGTERM 真正到达应用的关键；D 错——收不到 SIGTERM 就无从优雅排空（错误用例：配了 graceful 但用 shell 入口无效）。

### 9. 下列属于探针误配典型症状的有（多选）（9分）

- A. liveness 探测含外部依赖，DB 抖动引发全量 Pod 重启
- B. 无 readiness 导致滚动发布把半启动实例计入
- C. startup 预算太小，慢启动应用被 liveness 反复杀
- D. 配了 preStop sleep 降低发布 502

> 答案：ABC
> 解析：A/B/C 都是探针配错的事故；D 是正确实践（降低错误，非误配，不选）。

### 10. 简答题：某服务每次滚动发布总有少量请求 502/连接重置，请从探针与停机时序定位并给出零停机改造方案。（40分）

- 要点1：定位现象——502 发生在旧 Pod 终止窗口：新请求仍被路由到已在 SIGTERM 排空的实例（原因：EndpointSlice 摘除传播慢于进程关闭，readiness 只管进不管出）。
- 要点2：加 preStop sleep——删除时先 `sleep 5~10` 等摘流在集群各 kube-proxy 生效，再触发关闭（目的：把"出流量"也变成可控时序）。
- 要点3：应用侧优雅关闭——server.shutdown=graceful + 合理 phase 超时，收到 SIGTERM 停止接新连接、等在途请求完成（验收：日志见 graceful shutdown 排空记录，无 in-flight 丢弃）。
- 要点4：宽限期匹配——terminationGracePeriodSeconds > preStop sleep + 排空超时（错误配置：默认 30 而排空需 40 → 被 SIGKILL 硬切，改造为 45）。
- 要点5：信号可达——ENTRYPOINT 改 exec 形式或加 tini，确保 java 作为主进程真能收到 SIGTERM（异常：配了 graceful 但 shell 入口吞信号，等于没配）。
- 要点6：就绪侧收尾——readiness 用依赖就绪组避免半启动接流、滚动配 maxUnavailable=0（关联 s1-2），并压测验证：发布全程 5xx 曲线为 0 即为达标。

> 答案：见要点
