# 卷、镜像仓库与 Compose · 小测

### 1. 生产数据库数据最推荐的持久化方式是？（6分）

- A. 写容器可写层
- B. volume（命名卷）
- C. tmpfs
- D. 直接 bind 宿主 root 目录读写

> 答案：B
> 解析：volume 由 Docker 管理生命周期、容器删除数据保留、可迁移；写可写层一 rm 就丢（异常：删容器=删库）。

### 2. bind mount 与 volume 的核心区别是？（6分）

- A. 没有区别
- B. bind 挂宿主指定路径由用户管，volume 由 Docker 在自有目录管理
- C. volume 只能只读
- D. bind 不能持久化

> 答案：B
> 解析：路径可控性 vs 托管性——开发热更用 bind（直接改宿主文件），生产数据用 volume（解耦宿主路径）。

### 3. `--tmpfs` 挂载的特性是？（6分）

- A. 持久落盘
- B. 只存内存、容器停止即消失，适合临时敏感数据
- C. 跨容器共享
- D. 自动备份

> 答案：B
> 解析：tmpfs 不落盘，重启/删除即清空（结果：放密钥/临时缓存，重启不留痕；绝不能放需要持久的数据）。

### 4. `-v mydata:/app/config:ro` 中 `:ro` 的作用是？（6分）

- A. 随机挂载
- B. 只读挂载，容器不能写回宿主/卷
- C. 读写加密
- D. 递归挂载

> 答案：B
> 解析：只读防止容器篡改宿主配置，是纵深防御的一个细节（说明：配置类挂载尽量加 :ro）。

### 5. 把本地镜像推到私有仓库 nexus.shop.internal 的正确第一步是？（6分）

- A. 直接 docker push 镜像名
- B. docker tag 加上 registry 前缀完整地址
- C. docker commit
- D. docker login 后即可 push 原名

> 答案：B
> 解析：推送地址必须含仓库前缀（`nexus.shop.internal/...`），否则推的是 Docker Hub；login 是认证、tag 是寻址，两步都要。

### 6. 生产镜像为什么不该只用 latest tag？（6分）

- A. latest 下载更慢
- B. latest 可变导致不可重现、无法可靠回滚
- C. latest 不能 push
- D. latest 体积更大

> 答案：B
> 解析：tag 应唯一且语义化（版本号/commit），保证同一 tag 永远对应同一镜像（异常：回滚时 latest 已被覆盖，回无可回）。

### 7. docker-compose 中 `depends_on` 保证的是？（6分）

- A. 依赖服务健康可用后再启动
- B. 仅容器启动顺序，不等待就绪
- C. 网络互通
- D. 数据卷共享

> 答案：B
> 解析：depends_on 只控制 start 顺序，MySQL 容器起了不代表能连接（错误预期→首启连不上），就绪要靠 healthcheck + condition。

### 8. 要让 order 等 MySQL 真正就绪再启动，可行手段有（多选）（9分）

- A. 给 mysql 配 healthcheck
- B. order 的 depends_on 用 condition: service_healthy
- C. 应用侧连接加指数退避重试
- D. 把 depends_on 写成列表即可

> 答案：ABC
> 解析：A/B 是 compose 原生就绪门控，C 是应用兜底（网络抖动/重启同样需要）；D 的列表形式只保证顺序不保证健康（错误用法）。

### 9. 关于 volume 遮蔽镜像目录，正确的有（多选）（9分）

- A. 空 volume 首次挂到非空镜像目录会把镜像内容复制进卷
- B. 之后升级镜像，卷里旧数据不会自动同步镜像新增文件
- C. 挂载点始终以镜像内容优先
- D. 可能出现"升级后缺新增配置文件"

> 答案：ABD
> 解析：A/B 描述首建复制与后续遮蔽，D 是其后果；C 错——一旦有卷数据，卷内容优先、遮蔽镜像（异常：新配置不生效）。

### 10. 简答题：用 docker-compose 搭一套"MySQL+Redis+订单服务+网关"的本地开发环境，要求数据可持久、启动有序、可一键清理。给出关键设计与踩坑预防。（40分）

- 要点1：拓扑与网络——backend 网放 mysql/redis/order，frontend 网放 gateway/order，只有 gateway 配 ports 对外，DB/缓存不暴露（目的：本机也演练最小暴露面，关联 s2-1）。
- 要点2：持久化——mysql 用命名卷 mysql-data:/var/lib/mysql、redis 用卷或 AOF；配置用 bind:ro 挂宿主改好的 conf（验收：down 不带 -v 后数据仍在，误删容器不丢库）。
- 要点3：就绪顺序——mysql/redis 配 healthcheck，order 用 depends_on condition: service_healthy，应用连接层再加重试（错误用例：裸 depends_on 导致首启连不上必挂）。
- 要点4：镜像来源——order/gateway 用 build 指向本地 Dockerfile（走 s1-2 多阶段），依赖镜像锁具体版本 tag 不用 latest（说明：开发环境也要可重现）。
- 要点5：清理策略——down 停容器保留卷，down -v 才清卷（写明团队规约何时用哪个），避免误清数据（结果：把"删库"变成显式动作）。
- 要点6：环境变量与密钥——DB 密码等走 .env 或 secrets/tmpfs，不硬编码进 compose 提交进仓库（反例：明文密码进 git；补充：生产迁移时这套 service 语义对应 K8s Deployment/Secret，见 kubernetes s2-2）。

> 答案：见要点
