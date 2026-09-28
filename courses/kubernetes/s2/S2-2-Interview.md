# ConfigMap/Secret 与 PV/PVC/CSI · 面试题

## 题 1：ConfigMap 的注入方式各有何限制？

- 环境变量（env/envFrom）：进程启动时快照，改 ConfigMap 对运行中 Pod 无效，必须重启（结果："改了不生效"的第一 suspects）。
- 卷挂载（volume）：kubelet 周期同步文件（≤1min），无需重启，但应用必须真的重新读该文件（Spring 要刷新机制/文件监听，否则内存还是旧值）。
- 加分：想"改配置=自动滚动"用 checksum 注解把 ConfigMap 版本写进 Pod template，值变触发 Deployment 更新（关联 s1-2）。

## 题 2：Secret 安全吗？base64 算加密吗？

- 不算——base64 是可逆编码，`-d` 即还原，Secret 默认是明文可读（异常：以为标了 Secret 就安全）。
- 真防护来自：etcd 静态加密（encryption provider）、RBAC 收紧 get secret 权限、审计日志、避免写进 git/镜像。
- 加强：投影卷可 tmpfs 内存挂载；现代用 ExternalSecrets/CSI 从 Vault/KMS 动态注入 + 轮换，让密钥不落仓库不落 etcd 明文（说明：Secret 是"载体"不是"保险箱"）。

## 题 3：PV、PVC、StorageClass、CSI 各是什么角色？

- PVC：开发的需求单（容量/访问模式/存储类）；PV：集群里一块真实存储（生命周期独立于 Pod）。
- StorageClass：造 PV 的"配方"（选哪个 provisioner、参数、回收/扩容策略），支持动态供给。
- CSI：存储后端接入 K8s 的标准驱动接口（Node/Controller/Identity），把"attach/mount/快照/扩容"标准化（结果：换云/换存储只换 driver）。
- 一句话串起来：PVC 按 SC 触发 CSI provisioner 自动造 PV 并绑定（动态供给）。

## 题 4：静态供给 vs 动态供给？

- 静态：管理员预先手建一批 PV，PVC 从中挑一个匹配的（结果：受限于预制池，容量/类型不匹配就 Pending）。
- 动态：PVC 带 storageClass，provisioner 按需真造盘+建 PV+绑定（示例：云盘 K8s 场景主流）。
- 追问回收：reclaimPolicy Delete（PVC 删则底层盘也删，慎用！）vs Retain（保留数据待人工处理）——误配 Delete 删 PVC 丢数据是高危事故（异常：把有状态卷设了 Delete）。

## 题 5：RWO/RWX 区别，选错会怎样？

- RWO：单节点读写挂载（多数云盘）；RWX：多节点同时读写（NFS/CephFS/GCS 等）；还有 ROX 只读多挂。
- 选错后果：多副本 Pod 抢挂一个 RWO 卷→被调度到不同节点时挂载失败/Pending（异常：VolumeReadWriteOnce 不满足多节点）；StatefulSet 分散到多节点尤其常见。
- 正确姿势：需要共享就用支持 RWX 的 SC，或改架构（每副本独立 PVC）。

## 题 6：改了 ConfigMap，应用死活不生效，你的排查路径？

1. 判注入方式：`kubectl get deploy -o yaml` 看是 env 还是 volume（env→根本不会热更，先重启/滚动，问题到此为止）。
2. volume 方式：进容器 `cat` 挂载文件看是否已更新（结果：没更新→kubelet 同步延迟/挂错路径/subPath 导致不刷新这个已知坑）。
3. 文件已新但行为没变→应用没重读（Spring 缓存了旧值，需刷新机制）（说明：三层分段——K8s 同步、挂载可见、应用重读，逐层证伪比乱重启快）。
