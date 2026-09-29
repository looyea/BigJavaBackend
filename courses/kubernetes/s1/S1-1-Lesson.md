# 架构、控制平面与 Pod 生命周期

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：画出 K8s 控制平面与节点组件协作图，理解"声明式 + 控制循环"这一核心模型，掌握 Pod 从 Pending 到 Running 的生命周期与状态机，能定位常见启动阶段卡点。

## 一、控制平面：一群做"期望状态调和"的循环

```text
图目的：一次 kubectl apply 后各组件如何协作把现实拧成期望。
kubectl → API Server（唯一写 etcd 的入口，鉴权/校验/准入全过它）
API Server → etcd（持久化对象状态，集群的"事实底本"）
Scheduler watch 未调度的 Pod → 选节点 → 写回 binding 决定
kubelet（每节点）watch 分给自己的 Pod → 调 CRI 起容器 → 上报状态
Controller Manager（Deployment/ReplicaSet/Endpoint 等控制器）各自跑调和循环
结果：没有任何组件"命令"别人干活，全靠各自 watch + 调和 —— 这是理解 K8s 一切行为的钥匙。
```

## 二、声明式模型：desired vs current，靠调和不靠脚本

```bash
# 目的：你描述"要 3 副本"，ReplicaSet 控制器负责把当前副本数调成 3——挂一个补一个
kubectl scale deploy shop-order --replicas=3
kubectl delete pod <某pod>       # 结果：控制器发现 current(2)!=desired(3) → 立即补一个新 Pod
# 反例：把 K8s 当 VM 用——SSH 进容器改状态、手工起进程（异常：控制器不认识你手改的东西，随时被"调和"掉）
```

- 关键心智：对象都是"意图记录"，运行态由控制器持续逼近意图；理解这点，自愈/滚动发布/HPA 全都不言自明。

## 三、Pod：最小调度单位，不只是一个容器

```yaml
apiVersion: v1
kind: Pod
metadata: { name: order, labels: { app: order } }
spec:
  containers:
  - name: app
    image: shop-order:1.0
  # 同 Pod 内容器共享 NET Namespace（同一个 IP、localhost 互通）与可选存储卷
  # 目的：把"必须同节点、紧耦合协作"的容器打包（如应用+sidecar 日志采集）
  # 反例：无脑把所有服务塞一个 Pod —— 部署/伸缩粒度绑死，等于回到单体
```

- Pod 是"牛马"不是"宠物"：随时可能被杀重建，IP 会变——所以永远通过 Service 访问（s2-1 铺垫）。

## 四、Pod 生命周期状态机

```bash
kubectl get pod order -w
# Pending（已建但未 Running：调度中/拉镜像中/Init 容器跑中）
#   → ContainerCreating（选到节点、创建沙箱、pull image、起容器）
#   → Running（至少一容器在跑）→ Succeeded/Failed（一次性 Job 终态）/ CrashLoopBackOff（异常重启退避）
kubectl describe pod order    # 排障看 Events 段：FailedScheduling/ImagePullBackOff/OOMKilled 都在此暴露
```

- 阶段细分：spec.containers 之前可插 Init 容器（串行、跑完才进主容器）——做"等 DB 就绪/迁移脚本"（呼应 docker s2-2 depends_on 的升级版）。

## 五、常见卡点与定位手法

1. 一直 Pending：资源 request 不满足/无节点匹配亲和 → `kubectl describe` 看 Events 里 FailedScheduling 原因（示例：`0/3 nodes are available: Insufficient cpu`）。
2. ImagePullBackOff：镜像地址/tag/私有仓凭据（imagePullSecrets）错（异常：ErrImagePull vs 网络超时提示不同）。
3. CrashLoopBackOff：容器反复退出 → `kubectl logs --previous` 看上一次崩溃前日志（关键手法，当前日志可能已被重启刷掉）。
4. OOMKilled 反复：limit 与 JVM 感知问题（回看 docker s1-3）。

## 六、关联技术

- 组件通信全走 API Server + etcd，与 Service Mesh 控制面（istio/linkerd）是同构的"watch 调和"模型。
- 滚动发布见 s1-2、探针（liveness/readiness 如何介入本节状态机）见 s1-3、网络访问模型见 s2-1；观测生命周期事件见 prometheus/kubewatch 一类工具。
