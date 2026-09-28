# HPA/VPA 与资源 request/limit、QoS · 小测

### 1. 调度器决定 Pod 能否放上节点时依据的是（6分）

- A. limits
- B. requests
- C. 实际用量
- D. QoS 档位

> 答案：B
> 解析：调度是"预订"逻辑，按 requests 判断节点剩余可分配量；实际用量参与的是驱逐而非调度。

### 2. CPU 利用率型 HPA 的计算分母是（6分）

- A. 节点的 CPU 总量
- B. 容器的 CPU limit
- C. 容器的 CPU request
- D. 当前实际 CPU 用量

> 答案：C
> 解析：averageUtilization=70 指"平均用量/request=70%"，所以 request 设多大直接决定扩容灵敏度。

### 3. 节点内存压力下最先被驱逐的是（6分）

- A. Guaranteed Pod
- B. Burstable 中超用最多的
- C. BestEffort Pod
- D. 运行最久的 Pod

> 答案：C
> 解析：驱逐排序先按 QoS 从低到高，BestEffort（什么都没设）是第一批次；之后才在 Burstable 内按超出 request 比例排。

### 4. Java 服务内存设置的主流建议是（6分）

- A. request 小 limit 大，留出突发空间
- B. request=limit，配合 MaxRAMPercentage 规划堆
- C. 只设 limit 不设 request
- D. 不设限制，交给 JVM 自适应

> 答案：B
> 解析：内存不可压缩，request=limit 才能进 Guaranteed 且避免节点超卖被驱逐；堆大小按 limit 的百分比切分，剩余留给堆外。

### 5. HPA 与 VPA 同时作用于 CPU request 的典型后果是（6分）

- A. 互相加速收敛
- B. 震荡：VPA 调大 request→利用率降→HPA 缩容
- C. 自动互斥无需处理
- D. 仅内存维度冲突

> 答案：B
> 解析：HPA 的利用率分母正是 request，VPA 改分母等于动了 HPA 的判据，二者对同一指标会形成反馈循环。

### 6. Pod 状态为 Evicted 的正确理解是（6分）

- A. 应用 OOM 崩溃
- B. 探针失败被重启
- C. 节点资源压力导致被 kubelet 驱逐，由控制器重建
- D. 镜像拉取失败

> 答案：C
> 解析：Evicted 是节点层面的资源回收，不是容器自身异常；重建的新 Pod 可能调度到其他节点。

### 7. 应对秒级脉冲流量的合理方案是（6分）

- A. 把 HPA 采样间隔改为 1 秒
- B. 结合 KEDA/预测式扩容等按业务指标的机制
- C. 提高 maxReplicas 即可
- D. 关闭 stabilizationWindow

> 答案：B
> 解析：HPA 有采集与稳定窗口延迟，天生只解分钟级增长；脉冲场景要用队列深度/QPS 等业务指标驱动（KEDA），A/C/D 都是治标幻觉。

### 8. 关于 QoS 档位判定正确的有哪些（多选）（9分）

- A. 只设 limit 不设 request 的容器是 BestEffort
- B. 所有容器 cpu 与 memory 的 request=limit 时 Pod 为 Guaranteed
- C. Pod 内一个容器 BestEffort、另一个 Guaranteed，则整 Pod 为 Guaranteed
- D. 只设 requests 未设 limits 的容器属于 Burstable

> 答案：BD
> 解析：只设 limit 时 request 自动拷贝成 limit，反而是 Guaranteed 而非 BestEffort（A 错，典型想当然）；Pod 档位取成员中最差的一档，混合是 Burstable（C 错）。

### 9. 关于 CPU limit 的说法正确的有哪些（多选）（9分）

- A. CPU 是可压缩资源，超限表现为节流而非杀进程
- B. 设了 CPU limit 就永远不会被驱逐
- C. 高并发低延迟服务可能因 CFS 配额周期产生 P99 毛刺
- D. CPU limit 同时决定该 Pod 的调度优先级

> 答案：AC
> 解析：内存超限是 OOMKill（不可压缩），CPU 超限只是被限流（可压缩）；驱逐看节点压力与 QoS，与是否设 CPU limit 无直接豁免关系；调度优先级由 PriorityClass 决定。

### 10. 某订单服务频繁触发 HPA 扩容但扩容后 CPU 利用率仍高，副本数却不再增长，请列出至少 4 个排查方向。（40分）

- 要点1：是否已达 maxReplicas 上限（说明：desired 被截断则不再增长）。
- 要点2：新 Pod 是否 Pending——节点可分配资源不足或亲和/污点无处落（结果：扩了但没真正接流量）。
- 要点3：CPU request 是否设得过小，70% 目标对应的绝对值远低于真实需要。
- 要点4：metrics-server 采集是否异常，HPA 显示 <unknown>（异常：指标断供则判定不扩）。
- 要点5：scaleDown stabilization 或 HPA 的 behavior 里 up 限流（periodSeconds/factor）配置过保守。
- 要点6：负载根因是慢依赖（DB 瓶颈），加副本无效，应看业务指标而非 CPU。

> 答案：见要点
