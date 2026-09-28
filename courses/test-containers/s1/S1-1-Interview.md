# 用容器替代内存桩与数据准备 · 面试题

## 题 1：为什么你不该用 H2 假装 MySQL 做集成测试？

- 方言与行为不一致：H2 不认 `ON DUPLICATE KEY UPDATE`、MySQL `JSON` 列、`utf8mb4` 排序规则、特定行锁语义——测试假绿，生产第一天 SQL 暴雷；
- 迁移脚本验证不了：Flyway 建表 DDL 在 H2 能跑不代表真 MySQL 能跑；
- Testcontainers 方案：测试里用 Docker 起与生产同 tag 的真中间件，用完即弃、每次干净。

## 题 2：Spring Boot 里怎么让测试连到随机端口的容器？

- 容器映射端口是随机的，不能用固定 localhost:3306；
- `@DynamicPropertySource` 静态方法把 `mysql.getJdbcUrl()/getUsername()/getPassword()` 注册进 Spring `Environment`；
- 加分：配合 `@ServiceConnection`（Spring Boot 3.1+）可零样板自动接线，本质还是动态属性注入。

## 题 3：每次起容器太慢，怎么优化？

- 单例容器模式：`static final` 容器 + 静态块 `start()`（不加 `@Container`），全测试 JVM 复用一次；
- 数据隔离靠每测试独立 schema / `@Sql` 清表 / `@DataJpaTest` 事务回滚——共享容器但互不污染；
- 可选 `~/.testcontainers.properties` 开 `testcontainers.reuse.enable=true` 本地复用（CI 慎用，有状态残留风险）；
- 镜像预热 + 用 alpine/精简 tag + `withStartupTimeout` 控制冷启动。

## 题 4：Testcontainers 在 CI 跑不起来/不稳定，常见原因？

- runner 无 Docker：需 DinD 或挂 `docker.sock`（后者快但要处理权限与安全隔离）；
- Ryuk 回收：受限环境 Ryuk 起不来 → 容器残留，`/var/lib/docker` 膨胀；禁 Ryuk 必须有替代 `docker system prune`；
- 首次拉镜像慢/超时：预热镜像或私有 registry、调 startupTimeout；
- 并发争抢：多流水线同机端口/资源冲突，IT 与单测分阶段（failsafe `*IT`）、必要时独占 runner。

## 题 5：Ryuk 是什么，为什么重要？

- 资源回收 sidecar：注册全局钩子，测试会话结束自动删除本次创建的所有容器/网络/卷；
- 没有它，异常退出/被 kill 时容器会残留，CI 机磁盘被吃光；
- 关掉它的唯一正当理由是环境确实跑不了那个容器，但要自己补清理，否则是稳定性定时炸弹。

## 题 6：是不是所有测试都该上真容器？

- 不是。真容器有冷启动成本与 Docker 依赖，纯领域逻辑/单元逻辑用 Mockito 桩更快更聚焦；
- 边界原则：**跨进程边界**（真 DB 方言、MQ 消费幂等、缓存过期、ES 映射）才值得真容器，进程内协作靠单测 + 少量切片/端到端；
- 加分：呼应测试金字塔——底层大量快单测、中层 Testcontainers 集成、顶层少量端到端，用成本换可信度的平衡，而非"全上真组件把 CI 跑成 20 分钟"。
