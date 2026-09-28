# ConfigMap/Secret 与 PV/PVC/CSI · 作业

## 作业 1：两种注入方式的热更差异

**目标**：用实验坐实"env 不热更、volume 热更但需重读"。

1. 建 ConfigMap 存一个 feature 开关，分别用 envFrom 和 volume 挂载注入同一应用，改 ConfigMap 后观察：env 方式应用拿旧值（须删 Pod 重建才变）、volume 方式容器文件 ≤1min 变了（输出：两种方式的时间线对照）。
2. volume 方式下让应用真正读到新值（配 spring-cloud 刷新或加文件监听），对比"文件变了但内存没变"的中间态（错误预期：以为挂上文件就自动生效）。
3. 给 Deployment 加 ConfigMap checksum 注解，改配置后观察 Deployment 自动滚动新副本（验收：配置变更触发一次受控发布）。

## 作业 2：Secret 安全治理

**目标**：体验 Secret 不是加密这一事实并加固。

1. `kubectl create secret` 后 `get -o yaml` 再 `base64 -d` 还原明文（输出：证明默认不加密）。
2. 把 Secret 明文写进 Deployment YAML 提交，用 git 历史证明泄漏难清（错误用例），改为 ExternalSecrets/从 Vault 拉取的方式重构（结果：仓库无明文）。
3. 用投影卷把 Secret 挂成内存文件，验证应用读取且容器重启不留盘（说明：呼应 docker tmpfs）。

## 作业 3：动态供给与 PVC 排障

**目标**：走通 PVC→PV 并复现一个 Pending。

1. 建 StorageClass(某 CSI driver)+PVC(20Gi RWO)，起一个 Pod 挂载写数据、删 Pod 重建验证数据仍在（验收：PV 生命周期独立于 Pod）。
2. 故意写一个不存在的 storageClassName，`kubectl describe pvc` 复现 Pending 并读出原因（错误用例），修复后绑定成功。
3. 配 WaitForFirstConsumer 模式，观察 PVC 先 Pending、Pod 调度后才 Bound，写一句为什么这是正常而非故障（提示：拓扑感知供给）。
