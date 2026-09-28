# ConfigMap/Secret 与 PV/PVC/CSI

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：掌握 ConfigMap/Secret 的注入方式与热更新边界，理解 PV/PVC/StorageClass/CSI 的配置与存储抽象分层，能处理"配置改了不生效""PVC 一直 Pending"两类高频问题。

## 一、ConfigMap：配置与镜像解耦

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: order-config }
data:
  application-override.yaml: |        # 整段配置文件作为 key
    server.port=8080
    shop.feature.coupon=true
  DB_HOST: mysql.shop.svc             # 单键值
```

```yaml
# 两种注入方式，热更新能力完全不同（本节第一考点）
containers:
- name: app
  envFrom: [ configMapRef: { name: order-config } ]        # 方式1 环境变量：改了必须重启 Pod 才生效
  volumeMounts: [ { name: cfg, mountPath: /etc/config } ]   # 方式2 挂文件：更新后约 ≤1min 自动同步进容器
volumes: [ { name: cfg, configMap: { name: order-config } } ]
# 错误预期①：以为 env 注入的配置能热更 —— ConfigMap 改了，运行中 Pod 的 env 不变（env 是进程启动时快照）
# 错误预期②：文件挂载能看到新内容，但应用若不重新读文件（Spring 需 spring-cloud 刷新或自监听）仍用旧值
```

## 二、Secret：同样是键值，多的是"待遇"

```bash
kubectl create secret generic db-cred --from-literal=password='s3cr3t'   # base64 编码，不是加密！
kubectl get secret db-cred -o jsonpath='{.data.password}' | base64 -d     # 输出：明文——所以 etcd 静态加密/RBAC 收紧才是真防护
# 与 ConfigMap 差异：对象可被 CSI/云 KMS 集成加密存储、可专用投影卷（默认 tmpfs 内存盘不落磁盘）、通常更小 TTL 轮换
# 反例：把 Secret 明文写进 Deployment YAML 提交 git（异常：密钥泄漏只能靠轮换+历史清除，代价极高）
```

- 现代姿势：外部密钥系统（Vault/云 Secret Manager）经 CSI 驱动或 ExternalSecrets 注入，避免 Secret 散落仓库与 etcd 明文。

## 三、存储抽象：PV/PVC/StorageClass 三层解耦

```text
图目的：谁申请、谁提供、谁自动造。
PVC（开发写）：我要 20Gi RWX 存储 ←→ 绑定 ←→ PV（集群资源）：实际的一块盘（由管理员静态建 或 StorageClass 动态造）
StorageClass：定义"按需自动造 PV"的配方（provisioner=CSI 驱动、参数、回收策略）
结果：开发只面对 PVC、不关心底层是云盘/NFS；PV 生命周期独立于 Pod（重建 Pod 数据还在）。
```

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
spec:
  accessModes: [ ReadWriteOnce ]        # RWO 单节点读写 / RWX 多节点读写（NFS/CephFS 支持）/ ROP 只读多挂
  resources: { requests: { storage: 20Gi } }
  storageClassName: fast-ssd            # 选配方触发动态供给
```

## 四、CSI：让任意存储后端接入的标准接口

- CSI（Container Storage Interface）= 存储界的"驱动协议"：云厂商/存储厂写一个 CSI Driver（Node/Controller/Identity 三服务），K8s 通过它做卷的 attach/mount/扩容快照（说明：in-tree volume 插件正全面迁移到 CSI，历史遗留答法要更新）。
- 动态供给链：PVC(带 storageClass) → provisioner 调后端真造一块盘 → 自动建对应 PV 并绑定（结果：管理员不用手堆 PV）。
- 访问模式与拓扑是坑位：云盘多为 RWO、跨 AZ 有拓扑限制，StatefulSet 多副本挂同一 RWO 盘会调度失败（异常：Pending 因 Volume mismatch 拓扑）。

## 五、两类高频故障处置

1. PVC 一直 Pending：`kubectl describe pvc` 看 Events——storageClass 不存在/provisioner 未起/后端容量配额满/绑定模式 WaitForFirstConsumer 需等 Pod 调度（错误预期：看到 Pending 就删重建，实际 WaitForFirstConsumer 下"先起 Pod 才供给"是正常设计）。
2. 改了 ConfigMap 不生效：确认注入方式（env 要重启、volume 自动同步但应用要重读），或改用 checksum 注解触发滚动（结果：把 config 变更写进 Pod template 注解，值变即自动滚新副本）。

## 六、关联技术

- 配置注入在 Java 侧对应 Spring 外部化配置加载顺序（spring-config 包 s1 关联）；StatefulSet 用 PVC 模板为每副本造独立卷见 s2-2 之外的有状态章节。
- Secret 挂载与 s2-3/docker 侧 tmpfs 理念一致；存储监控与容量告警见 prometheus（PV 使用率）。
