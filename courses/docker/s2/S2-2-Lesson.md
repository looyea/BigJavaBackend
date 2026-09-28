# 卷、镜像仓库与 Compose

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：分清 bind mount/volume/tmpfs 三种持久化方式与适用场景，掌握镜像打 tag 推送私有仓库的完整流程，能用 docker-compose 一键编排多容器开发环境。

## 一、三种挂载：数据放哪、谁来管

```bash
# 1) volume（Docker 管理，推荐生产数据）：存放在 /var/lib/docker/volumes/<name>/_data
docker volume create mysql-data
docker run -d -v mysql-data:/var/lib/mysql mysql:8        # 目的：容器删了数据仍在，由 Docker 统一生命周期管理
# 2) bind mount（挂宿主具体目录，配置/开发热更常用）
docker run -d -v /host/conf:/app/config:ro shop-order:1.0  # :ro 只读挂载，防容器改宿主（安全细节）
# 3) tmpfs（仅内存，不落盘，临时密钥/敏感缓存）
docker run -d --tmpfs /app/tmp:size=64m shop-order:1.0
# 反例：把 DB 数据写容器可写层（不挂卷）→ 容器一 rm 数据全丢（异常事故：误删容器等于删库）
```

- 选择口诀：数据库/需持久 → volume；宿主已有目录要共享/热改配置 → bind；临时敏感 → tmpfs。

## 二、挂载点陷阱：volume 遮蔽镜像目录内容

```bash
docker run -d -v mydata:/app/config app   # 若 /app/config 首次挂载时 mydata 为空
# 结果：Docker 会把镜像里 /app/config 已有内容"复制"进空 volume（首建）；但换镜像版本时旧 volume 不会自动同步新文件
# 错误预期：以为挂卷后镜像里的默认配置永远在——其实卷里的旧数据会遮蔽新镜像（异常：升级后缺新增配置文件）
```

## 三、镜像仓库：tag → login → push 三步

```bash
docker build -t shop-order:1.4.2 .
docker tag shop-order:1.4.2 nexus.shop.internal/docker/shop-order:1.4.2   # 目的：加仓库前缀才是完整推送地址
docker login nexus.shop.internal                                          # 私有仓库需认证（凭据存 ~/.docker/config.json）
docker push nexus.shop.internal/docker/shop-order:1.4.2
# 反例一：push 用 latest 覆盖生产版本 → 无法回滚、不可重现（错误用法：镜像 tag 必须唯一且语义化）
# 反例二：只 docker tag 不改运行引用 → 拉的还是旧仓库地址（说明：消费端也得写全 registry 前缀）
```

- registry 与 Maven 私服同构思路（回看 maven s2-2）：都是"团队制品的统一仓 + 代理加速"。

## 四、docker-compose：一份 YAML 起一整套

```yaml
# docker-compose.yml —— 目的：把多容器拓扑（网络/卷/依赖）代码化，一条命令复现
services:
  mysql:
    image: mysql:8
    environment: { MYSQL_ROOT_PASSWORD: dev }
    volumes: [ mysql-data:/var/lib/mysql ]     # 复用 volume，数据跨 up/down 保留
  order:
    build: ./shop-order
    depends_on: [ mysql ]                      # 只保证启动顺序，不保证 DB 就绪（常见误解）
    networks: [ backend ]
    ports: [ "8080:8080" ]
networks:
  backend: { }
volumes:
  mysql-data: { }
```

```bash
docker compose up -d      # 起全部；down 停并删容器（卷默认保留）
# 错误预期：以为 depends_on 等 DB "可用" → 应用连不上还在初始化的 MySQL（异常：首次冷启动必挂，需 healthcheck+重试）
```

## 五、compose 的就绪与优雅停止

```yaml
  mysql:
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      retries: 10
  order:
    depends_on:
      mysql: { condition: service_healthy }   # 目的：等健康检查通过再起，替代裸 depends_on
    stop_grace_period: 30s                     # 给应用排空连接的时间（呼应优雅停机）
```

## 六、关联技术

- volume/网络是 s2-1 隔离模型的存储侧对应物；镜像 tag/仓库治理延伸到 s2-3 安全。
- Compose 的 service/depends_on/healthcheck 在 K8s 里升级为 Deployment/InitContainer/探针（见 kubernetes s1-1、s1-3），思路连续。
