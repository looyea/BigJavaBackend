# 架构、控制平面与 Pod 生命周期 · 小测

### 1. K8s 集群中唯一直接读写 etcd 的组件是？（6分）

- A. kubelet
- B. Scheduler
- C. API Server
- D. Controller Manager

> 答案：C
> 解析：所有组件都通过 API Server 访问状态，etcd 只有 API Server 直接碰（结果：鉴权/校验/准入集中在它）。

### 2. K8s 的核心工作模型是？（6分）

- A. 命令式脚本按顺序执行
- B. 声明式期望状态 + 控制器调和循环
- C. RPC 调用链
- D. 消息队列驱动

> 答案：B
> 解析：你写"要 3 副本"，控制器不断把当前调向期望；这是自愈/发布/伸缩的共同底座。

### 3. K8s 中最小的可调度单位是？（6分）

- A. 容器
- B. Pod
- C. Node
- D. Deployment

> 答案：B
> 解析：调度器以 Pod 为单位选节点；一个 Pod 可含多个共享网络/卷的容器。

### 4. 同一 Pod 内两个容器默认能互相访问，是因为？（6分）

- A. 同一进程
- B. 共享 NET Namespace（同 IP、localhost 互通）
- C. 同一镜像
- D. 同一节点即可

> 答案：B
> 解析：Pod 内容器共享网络与可选卷，用 localhost 互访（结果：sidecar 模式成立的前提）。

### 5. Pod 一直是 Pending，最应先查？（6分）

- A. 应用日志
- B. `kubectl describe` 的 Events（调度失败/资源不足/镜像问题）
- C. 数据库
- D. Service

> 答案：B
> 解析：Pending 说明还没跑起来，Events 里 FailedScheduling/Insufficient cpu 直接给因（错误预期：先去 logs 但容器根本没起）。

### 6. CrashLoopBackOff 时看崩溃前日志的正确命令是？（6分）

- A. kubectl logs <pod>
- B. kubectl logs <pod> --previous
- C. kubectl describe
- D. kubectl exec

> 答案：B
> 解析：--previous 取上一个已崩溃容器实例的日志（结果：当前实例刚起还没日志时靠它定位崩溃原因）。

### 7. Init 容器的典型用途是？（6分）

- A. 常驻业务处理
- B. 主容器启动前串行完成的前置任务（等依赖就绪/迁移/拉配置）
- C. 替代 liveness 探针
- D. 提供网络

> 答案：B
> 解析：Init 容器跑完退出、主容器才起，做"就绪前置"（呼应 docker depends_on 的强化版）。

### 8. 关于组件职责，正确的有（多选）（9分）

- A. Scheduler 负责给未绑定节点的 Pod 选节点
- B. kubelet 负责在本节点按 PodSpec 起/管容器并上报状态
- C. etcd 保存集群期望与当前状态，是事实底本
- D. API Server 只读不写，写由 kubelet 完成

> 答案：ABC
> 解析：A/B/C 是三大组件本职；D 错——写 etcd 只能经 API Server（错误表述）。

### 9. 把 K8s 当虚拟机用的错误做法有（多选）（9分）

- A. SSH 进容器手工改配置
- B. 在容器里起常驻手启进程
- C. 给 Pod 配固定 IP 直连绕开 Service
- D. 用 Deployment 声明副本数

> 答案：ABC
> 解析：A/B 会被控制器"调和"掉、破坏不可变；C 违反 Pod 即牛马模型；D 才是正确姿势（结果：D 是正解不选）。

### 10. 简答题：一个 Pod 从 `kubectl apply` 到 Running，完整走一遍系统流程并指出每个可能卡住的环节。（40分）

- 要点1：kubectl→API Server：鉴权、schema 校验、准入控制（Mutating/Validating，如资源 limit 强制注入），此步可能因 RBAC/校验拒绝而 apply 失败。
- 要点2：API Server 写 etcd 生成 Pod 对象（未绑定节点，状态 Pending）；说明：此刻还没容器。
- 要点3：Scheduler watch 到未调度 Pod，过滤+打分选节点，写回 binding；卡点：资源 request 不满足/亲和污点不匹配→一直 Pending（describe 看 FailedScheduling）。
- 要点4：目标节点 kubelet watch 到分给自己的 Pod，调 CRI 创建 Pod 沙箱、跑 Init 容器、pull 镜像、起主容器；卡点：ImagePullBackOff（地址/凭据）、Init 卡住、探针未配导致依赖未就绪。
- 要点5：容器进入 Running 后由三探针判定健康与是否接流量（见 s1-3），就绪失败可能 CrashLoopBackOff（用 logs --previous 定位崩溃，配 OOMKilled 见 docker s1-3）。
- 要点6：全程由对应控制器（ReplicaSet/Deployment）持续调和副本数，任一环修复后集群自动收敛——答出"每个卡点对应一个组件"即体现体系化理解（验收：能背出 Pending/ContainerCreating/CrashLoop 三类 Event 关键词）。

> 答案：见要点
