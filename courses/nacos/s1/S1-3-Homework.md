# Nacos 集群运维与鉴权、与 Eureka/Consul 对比（关联） · 作业

### 作业 1：起一个三节点集群并压测存储瓶颈

- 目标：验证"集群共享外置 MySQL"下 DB 才是真单点/瓶颈。
- 任务：用外置 MySQL 起 3 节点 Nacos 集群（放行 8848 + gRPC 偏移端口），注册大量服务与配置；观察 DB 连接数/QPS 压力，把单实例 MySQL 换成主从后对比稳定性；记录 kill 一个 Nacos 节点后服务发现仍可用的现象。
- 验收标准：能说清集群节点无状态但共享 DB 需 HA；展示 DB 打满与改善后的差异；kill 单节点不影响注册/发现。
- 参考解法要点：Derby（单机）vs MySQL（集群）；DB 容量/连接池是高可用关键。

### 作业 2：用 namespace/group 做环境与租户隔离

- 目标：杜绝测试服务被生产发现、配置串环境。
- 任务：创建 dev/test/prod 三个 namespace，把同一服务分别注册到不同 namespace，验证生产订阅者只看到生产实例；再按业务线用 group 细分；故意让两个环境共用 namespace 复现"误发现"。
- 验收标准：跨 namespace 不可见；共用 namespace 时能复现串环境；给出"每环境独立 namespace"的规范。
- 参考解法要点：namespace 决定配置/服务作用域；group 做二级细分；客户端 `namespace` 配置要与环境一致。

### 作业 3：默认裸奔加固——开鉴权 + HTTPS

- 目标：消除默认账号/token、无 TLS 的安全风险。
- 任务：开启 `nacos.core.auth.enabled=true`、替换默认 `nacos/nacos` 账号密码与 `secretKey`，配置用户/角色/权限；在 Nacos 前置 Nginx 配 HTTPS，未授权访问 OpenAPI 应被拒。对比加固前用默认密码匿名改配置的攻击路径。
- 验收标准：加固前能匿名改配置（复现风险）、加固后被鉴权拦截；传输走 TLS；默认密钥/密码被替换。
- 参考解法要点：token 密钥、鉴权插件、公网入口强制 TLS + 最小权限。
