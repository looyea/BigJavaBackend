# 卷、镜像仓库与 Compose · 面试题

## 题 1：volume、bind mount、tmpfs 分别什么时候用？

- volume：Docker 托管、生产数据首选（DB/上传文件），容器删了数据在、易迁移备份（结果：解耦宿主路径）。
- bind mount：需要直接看/改宿主文件——开发热更新、挂配置文件（配 :ro 更安全）。
- tmpfs：只存内存、重启即清——临时密钥、敏感缓存，绝不留盘。
- 追问：容器可写层能不能当存储？答：不能，`rm` 即丢、跨容器不共享、性能也差（异常：删容器=删库）。

## 题 2：`-v mydata:/app/data` 挂到镜像里已有文件的目录，第一次和第二次分别发生什么？

- 首次（卷为空）：Docker 把镜像里 /app/data 的内容复制进卷（结果：看得到镜像默认文件）。
- 之后（卷已有数据）：卷内容遮蔽镜像，新镜像里新增/变更的文件不会出现（异常：升级后缺配置文件，是这里的经典坑）。
- 治理：配置类要么进卷统一管理、要么改用配置注入（ConfigMap 思路），别指望卷自动同步镜像。

## 题 3：镜像 tag 和 digest 的区别，为什么回滚建议用 digest？

- tag 是可移动指针（`shop-order:1.0` 可被再次 push 覆盖），digest（sha256）是内容寻址、不可变（结果：同 digest 永远同镜像）。
- 生产部署锁 tag 到具体版本已是底线，追求严格可重现按 digest 拉（`@sha256:...`）。
- 错误用法：用 latest——回滚时它指向"最后一次 push 的东西"，回无可回（示例事故：故障回滚拉到的还是故障版本）。

## 题 4：docker-compose 的 depends_on 能替代健康检查吗？

```yaml
# 目的：depends_on 管启动"顺序"，healthcheck+condition 管"就绪"
services:
  order:
    depends_on:
      mysql: { condition: service_healthy }   # 等 mysql 探针通过才起 order
  mysql:
    healthcheck: { test: ["CMD","mysqladmin","ping","-h","localhost"], retries: 10 }
# 反例：裸 depends_on: [mysql] → mysql 容器进程起了但还没能接受连接 → order 首启连不上崩溃
```

- 加分：即便有 condition，应用侧仍应有连接重试（网络抖动/mysql 重启时编排层不会再帮你排顺序）。

## 题 5：私有 registry 与 Maven 私服，治理思路上有哪些相通？

- 统一制品源 + 代理加速：registry 代理 Docker Hub、Nexus 代理 central，团队走内网缓存（结果：外网抖动不影响构建）。
- 不可变与命名规约：镜像禁 latest / Maven release 不可覆盖，都是"制品一旦发布不许变"。
- 扫描与准入：registry 侧漏洞扫描/签名（延伸 s2-3）≈ 私服的黑白名单/enforcer 门禁（说明：制品仓是安全与治理的 choke point）。

## 题 6：从 Compose 到 K8s，本节概念怎么映射？

| Compose | Kubernetes |
|---------|-----------|
| services | Deployment/Pod |
| volume | PV/PVC（见 kubernetes s2-2） |
| ports | Service/Ingress |
| depends_on + healthcheck | 探针 + InitContainer/启动顺序 |
| environment / .env | ConfigMap/Secret |
- 关键升级：Compose 是单机声明式编排，K8s 是跨节点、带调度和自愈的编排（结果：概念连续、能力跃迁，学过 Compose 上手 K8s YAML 快很多）。
