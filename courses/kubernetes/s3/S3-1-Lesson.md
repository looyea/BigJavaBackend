# HPA/VPA 与资源 request/limit、QoS

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：会正确设置 Java 容器的 request/limit 并判断 QoS 档位，能配置 HPA 的指标与伸缩行为，理解 VPA 定位与节点驱逐机制，能解释"扩了副本却不扛压""Pod 被莫名其妙杀掉"两类事故。

## 一、资源模型：request 是调度依据，limit 是运行天花板

```yaml
resources:
  requests: { cpu: "1",    memory: "2Gi" }   # 调度器按 request 找节点（装得下才放）
  limits:   { cpu: "2",    memory: "2Gi" }   # cpu limit 靠 CFS 配额限流；memory limit 超了直接 OOMKill
# 错误预期①：不写 requests 只写 limit —— 调度按 limit 视为 request 挤爆节点，或落入 BestEffort 首批被驱逐
# 错误预期②：memory request ≠ limit —— Java 堆按 MaxRAMPercentage 算的是 limit 的百分比，节点压满时仍可能被驱逐
```

- Java 容器最佳实践：memory 的 request=limit（锁死一档，配合 `-XX:MaxRAMPercentage=70` 留 30% 给堆外/元空间/线程栈），cpu 可 request<limit 借突发（说明：cpu limit 争议大，高并发服务常建议只设 request 不设 limit，避免 CFS 节流造成 P99 毛刺）。

## 二、QoS 三档：决定谁先被杀

```text
图目的：节点内存吃紧时内核 OOM 与 kubelet 驱逐的排序依据。
Guaranteed：所有容器 request=limit（cpu 与 memory 都等）→ 最后被杀
Burstable： 设了 request 但不满足 Guaranteed → 中间档，按超出 request 的比例排序
BestEffort： 什么都没设 → 驱逐/OOM 的第一批牺牲品
结果：生产 Java 服务至少进 Burstable，核心链路冲 Guaranteed；"裸奔"容器等于主动当炮灰。
```

## 三、HPA：按指标调副本数

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: order-service }
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }  # 分母是 request！
  behavior:
    scaleDown: { stabilizationWindowSeconds: 300 }   # 5min 冷静期防抖动（错误预期：不设→流量毛刺导致反复扩缩）
```

- 坑一：CPU 利用率的分母是 **request**——request 设小了，HPA 天天"满载"狂扩；设大了永远"很闲"不扩（结果：HPA 与 request 必须成套设计）。
- 坑二：默认 15s 采集 + 1min 稳定窗口，秒级突发流量先靠 limit 的 cpu 突发扛，HPA 只解决分钟级增长（说明：应对脉冲流量要配 KEDA/预测式扩容而非调 HPA 采样）。

## 四、VPA 与自定义指标

- VPA（Vertical Pod Autoscaler）调的是单 Pod 的 request/limit："观察真实用量→推荐/自动改配置"，与 HPA 正交；但**同资源上 HPA 按 CPU% 扩副本 + VPA 调 request 会互相打架**（异常：recommender 把 request 调大→利用率瞬间下降→HPA 缩容→循环震荡），Java 圈主流只开 VPA 的 recommendation 模式离线校准 request。
- 自定义指标走 Prometheus Adapter / KEDA：按 QPS、队列积压、连接数扩缩（示例：`rate(http_server_requests_seconds_count[1m])/副本数` 作为目标 QPS），比 CPU 更贴近业务容量。

## 五、驱逐：节点压力下的资源回收

- kubelet 在节点内存/磁盘/PID 压力下按 QoS 从差到好驱逐 Pod（Evicted 状态，结果：被驱逐的 Pod 由控制器重建，不是"崩溃"）；软驱逐给优雅退出窗口，硬驱逐直接 SIGKILL。
- 排障口诀：`kubectl describe pod` 见 `Reason: Evicted` → 查节点压力与同节点"邻居"；见 OOMKilled exit 137 → 查容器 limit 与 JVM MaxRAMPercentage（关联 docker s1-3）。

## 六、关联技术

- 探针与滚动发布的容量保底见 kubernetes s1-2/s1-3；调度层的亲和/污点决定扩容 Pod 落在哪，见 s3-2。
- JVM 容器内存感知是 request/limit 设计的前置知识（docker s1-3）；压测得到的单实例容量是设置 request 的事实源（jmeter 包）。
