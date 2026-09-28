# 架构、控制平面与 Pod 生命周期 · 作业

## 作业 1：观察调和循环

**目标**：用亲手实验坐实"声明式自愈"。

1. 起一个 `replicas=3` 的 Deployment，`kubectl delete pod` 删掉一个，`kubectl get pod -w` 观察新 Pod 被自动补齐（输出：旧 Pod Terminating 同时新 Pod Pending→Running 的时间线）。
2. 手工 `kubectl edit` 把 replicas 改回、再改一个非法值，观察控制器如何对待你的手动改动（结果：理解 desired 来自对象声明而非运行态）。
3. 记录一段 `kubectl get events --sort-by=.lastTimestamp` 输出，找出补副本相关的 ReplicaSet 事件。

## 作业 2：生命周期卡点复现

**目标**：制造并诊断三类典型异常状态。

1. 故意写一个不存在的镜像 tag → 复现 ImagePullBackOff，`kubectl describe` 摘录错误事件（错误用例：区分 ErrImagePull 与拉取超时）。
2. 写一个启动即 `exit 1` 的容器 → 复现 CrashLoopBackOff，用 `kubectl logs --previous` 抓到崩溃前输出（验收：能拿到已重启实例的日志）。
3. 设置一个超过集群总量的 cpu request → 复现 Pending + FailedScheduling，从 Events 读出 `Insufficient cpu`（说明：这三个 describe/logs 手法是排障三板斧）。

## 作业 3：画架构图与叙述流

**目标**：把组件协作内化成可讲述的知识。

1. 默画控制平面+数据平面组件图，标出 apply 一次请求的流向（API Server/etcd/Scheduler/kubelet/Controller Manager）。
2. 用 5 句话向同事讲清"为什么删 Pod 会自动重建"，必须出现"期望状态/调和/控制器"三个词（验收：对方能复述）。
3. 反例说明：写一段"把 K8s 当虚拟机"的操作清单并逐条标注会被哪个机制调和掉（错误用例治理）。
