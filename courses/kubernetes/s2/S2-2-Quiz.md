# ConfigMap/Secret 与 PV/PVC/CSI · 小测

### 1. ConfigMap 通过环境变量注入后，修改 ConfigMap，运行中的 Pod？（6分）

- A. 立即看到新值
- B. env 不变，需重启 Pod 才生效
- C. 自动滚动更新
- D. 报错

> 答案：B
> 解析：env 是进程启动时快照，ConfigMap 改了也不会变（错误预期：以为所有注入都能热更）；挂文件方式才会同步。

### 2. ConfigMap 以卷挂载方式注入，更新后的行为是？（6分）

- A. 永不更新
- B. 约 ≤1min 自动更新容器里的文件内容，但应用需重新读文件
- C. 触发 Pod 重建
- D. 需要重启 kubelet

> 答案：B
> 解析：kubelet 周期性同步卷内容；关键是应用要真的重读（Spring 需刷新机制），否则文件变了内存仍旧值。

### 3. Secret 里的数据本质是？（6分）

- A. 非对称加密
- B. base64 编码（默认不加密，需 etcd 静态加密/RBAC 才安全）
- C. 哈希不可逆
- D. 明文存内存

> 答案：B
> 解析：`base64 -d` 即还原（结果：Secret 不等于安全，防护靠 etcd 加密、RBAC、避免落 git）。

### 4. PVC、PV、StorageClass 的关系是？（6分）

- A. 三者同级
- B. PVC 申请、PV 是实际存储资源、StorageClass 定义动态造 PV 的配方
- C. PV 申请、PVC 提供
- D. StorageClass 存数据

> 答案：B
> 解析：开发面向 PVC，绑定到 PV；SC 让"按需自动 provision PV"（结果：开发不用管底层盘）。

### 5. 让开发写 PVC 时自动创建对应 PV，依赖的是？（6分）

- A. 手动建 PV
- B. StorageClass 指定的 CSI provisioner 动态供给
- C. ConfigMap
- D. Secret

> 答案：B
> 解析：动态供给=provisioner 按 SC 配方真造盘并自动建 PV 绑定（说明：省去管理员手堆 PV）。

### 6. CSI 是什么？（6分）

- A. 云服务商缩写
- B. 容器存储接口标准，让任意存储后端以驱动接入 K8s
- C. 一种文件系统
- D. 网络协议

> 答案：B
> 解析：CSI Driver 提供 Node/Controller/Identity 服务实现 attach/mount/扩容（结果：in-tree 插件正迁移到 CSI）。

### 7. ReadWriteOnce 访问模式含义是？（6分）

- A. 多节点同时读写
- B. 只能被单个节点以读写挂载
- C. 只读
- D. 不能持久

> 答案：B
> 解析：RWO=单节点读写（云盘常见）；RWX 才多节点读写（NFS/CephFS）；误解会引发调度/挂载异常。

### 8. 关于配置注入与安全，正确的有（多选）（9分）

- A. 密钥不应明文写进 Deployment YAML 提交 git
- B. Secret 投影卷可配 tmpfs 不落盘
- C. 可用 ExternalSecrets/CSI 从 Vault 同步密钥
- D. base64 编码即等于加密

> 答案：ABC
> 解析：A/B/C 是密钥治理正解；D 错——base64 可逆非加密（错误预期）。

### 9. PVC 一直 Pending，可能原因有（多选）（9分）

- A. storageClassName 写错/对应 SC 不存在
- B. provisioner（CSI 驱动）未运行
- C. 后端存储容量/配额不足
- D. 绑定模式 WaitForFirstConsumer 需等 Pod 先调度

> 答案：ABCD
> 解析：四项都会让 PVC 停在 Pending（说明：D 尤其易被误当故障，其实"等 Pod 调度再供给"是正常设计）。

### 10. 简答题：把一个 Spring Boot 服务的配置与密钥迁移到 K8s 配置体系，并解决"改了配置不生效"。给出完整方案。（40分）

- 要点1：拆分内容——非敏感参数进 ConfigMap（分环境各一份或用 Kustomize overlay），DB 密码/TLS 进 Secret；目的：敏感面最小化、可分别治理（错误用法：全塞 ConfigMap 明文）。
- 要点2：注入方式选择——需要"改即生效且不想重启"的走文件挂载（application-override），启动期即定的（端口/JVM）走 env；Spring 侧配 spring-cloud-kubernetes 或监听挂载目录重读（说明：env 注入热更不生效是必踩坑）。
- 要点3：变更生效策略——对必须重启才生效的配置，给 Pod template 加 ConfigMap checksum 注解，值变→template 变→Deployment 自动滚动（结果：配置变更即受控发布，衔接 s1-2/s1-3 优雅滚动）。
- 要点4：密钥来源升级——用 ExternalSecrets/CSI 从 Vault/KMS 拉，Secret 不入库、定期轮换（验收：git 历史无明文密钥、etcd 开静态加密）。
- 要点5：持久化配置存储——若有上传/规则文件需持久，走 PVC+StorageClass 动态供给，注意 RWO/RWX 与拓扑；StatefulSet 每副本独立 PVC（关联 s2-2 存储模型）。
- 要点6：排障闭环——"不生效"先判注入方式（env/volume）再判应用是否重读，`kubectl get cm -o yaml` 核对已更新、`exec` 进容器看挂载文件内容（输出：三步定位到是同步延迟还是应用没重读）。

> 答案：见要点
