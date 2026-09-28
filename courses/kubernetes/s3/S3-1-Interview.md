# HPA/VPA 与资源 request/limit、QoS · 面试题

## 题 1：request 和 limit 到底怎么设？讲讲你的方法论。

- request：调度与容量规划的预订值，取自压测得到的"稳态用量"（结果：设小了节点超卖被驱逐、HPA 乱扩；设大了集群闲置）。
- limit：运行的硬天花板，仅对不可压缩资源（内存）有保护意义——memory 建议 request=limit 锁 Guaranteed；cpu 是否设 limit 要辩证：设了防"吵闹邻居"，但 CFS 节流会带来 P99 毛刺（异常：低延迟交易服务设了紧 cpu limit，大促反而变慢）。
- 方法论一句话：先压测出单实例容量，再反推 request；limit 是"隔离策略"而非"安全阀"，内存必锁、CPU 看场景。

## 题 2：QoS 三档怎么判定？为什么重要？

- Guaranteed：每个容器 cpu 与 memory 都 request=limit；Burstable：设了但不满足 Guaranteed；BestEffort：全没设。Pod 取成员最差档。
- 重要性体现在两个排序：节点内存压力时 kubelet 按 BestEffort→Burstable→Guaranteed 驱逐；内核 OOM score 也参考该序（说明：这是"谁先死"的制度化答案，不是玄学）。
- 加分：只设 limit 不设 request 时 request 自动拷贝成 limit——很多团队以为进了 Burstable，实际是 Guaranteed，判卷点常在这。

## 题 3：HPA 按 CPU 70% 扩容，为什么线上经常"扩晚了"或"不扩"？

1. 分母陷阱：利用率=用量/request，request 偏大则永远显示"很闲"（结果：看起来不扩）。
2. 采集链路：metrics-server 挂了或延迟，HPA 显示 `<unknown>`，直接停止决策（异常场景必查 APIService）。
3. 反应窗口：默认 15s 采样 + stabilize，脉冲流量到来时 HPA 还没反应过来——它天生只应对分钟级趋势。
4. behavior 限流：scaleUp 的 periodSeconds/factor 被调保守，或已达 maxReplicas 截断。
- 高阶答法：改用 QPS/队列深度等业务指标（KEDA），把"容量提前量"从 CPU 里解放出来。

## 题 4：VPA 和 HPA 能一起用吗？

- 同指标（CPU request）上不能：VPA 改 request 等于改 HPA 的分母，二者互相拉扯产生震荡（错误做法：生产同时开两个的 auto 模式）。
- 可行的组合：HPA 管副本 + VPA 只开 recommendation 模式离线给出 request 建议；或 HPA 用 CPU、VPA 只管 memory（不同维度）；KEDA 类按业务指标伸缩也能与 VPA 共存但仍需谨慎。
- 加分：VPA 更新会触发 Pod 重建（evict+recreate），对 Java 应用意味着冷启动与 JIT 重编译，需评估预热策略。

## 题 5：Pod 反复 OOMKilled（exit 137），排查步骤？

1. 分清两个 137：容器 memory limit 超限被 cgroup OOMKill，还是 JVM 自己 OutOfMemoryError 退出（看日志有没有 java 堆栈，异常在应用层还是基础设施层）。
2. limit 侧：`kubectl describe pod` 看 lastState 与 limit 值；容器内存=堆+元空间+直接内存+线程栈+代码缓存，MaxRAMPercentage=100 必爆（结果：留 25%~30% 给堆外是通行做法）。
3. 应用侧：NMT（`-XX:NativeMemoryTracking=summary`）+ jcmd 快照对比看堆外泄漏；堆内泄漏走 heap dump（关联 jvm 包）。
4. 流量侧：确认是否大促/缓存加载等瞬时分配峰值，考虑调大 limit 或削峰。

## 题 6：被 Evicted 的 Pod 和 CrashLoopBackOff 有什么本质区别？

- Evicted：节点资源压力的基础设施行为，Pod 已被打上失败状态、由控制器在别处重建，容器日志往往正常（说明：根因在"节点"不在"这个 Pod"）。
- CrashLoopBackOff：容器自己反复启动失败，指数退避重启，根因在应用/配置/镜像（`kubectl logs --previous` 看崩溃前日志）。
- 处置差异：驱逐要解决容量与 QoS（补 request、挪节点、扩节点池）；崩溃循环要修应用本身——把驱逐当崩溃去 debug JVM 是典型的方向性浪费。
