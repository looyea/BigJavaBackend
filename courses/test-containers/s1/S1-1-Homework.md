# 用容器替代内存桩与数据准备 · 作业

## 作业 1：把一个 H2 测试升级为真 MySQL（动手题）

**目标**：亲手感受"假绿"如何被真容器戳穿。

**任务**：
1. 写一个用 `ON DUPLICATE KEY UPDATE` 的 upsert（或依赖 `JSON` 列 / `utf8mb4` 大小写不敏感排序），先在 H2 下跑——预期报错或行为不符；
2. 用 `@Testcontainers + MySQLContainer("mysql:8.0.x")` + `@DynamicPropertySource` 改造，让同一段代码在真库通过；
3. 打开 Flyway，让它对容器库跑 migration，验证建表脚本在真 MySQL 方言下可执行；
4. 记录 H2 与真 MySQL 的差异点（至少 2 处），写进测试注释。

**验收标准**：H2 版有意的失败被保留为证据（如 `@Disabled` + 注释说明为何失败）；真容器版全绿；能说清"这条测试在 H2 下会给你什么错误的安全感"。

**参考解法要点**：`MySQLContainer` 首次启动数秒属正常，用单例模式缓解；断言用 Testcontainers 暴露的 `getMappedPort`。

## 作业 2：单例容器 + 数据隔离（工程题）

**目标**：解决"每个测试类都冷启动、集成测试太慢"和"共享数据互相污染"。

**任务**：
1. 用静态单例 `PostgreSQLContainer` 让 5 个 `@DataJpaTest` 类共享一个库；
2. 给每个测试类分配独立 schema（或 `@Sql` 前后清表），验证任意测试顺序都稳定通过；
3. 对比改造前后 `mvn verify` 的总耗时；
4. 故意在两个测试里操作同一张不清理的数据，复现一次"顺序相关的偶发失败"再修复。

**验收标准**：给出耗时对比数据；随机化测试执行顺序仍全绿；能说清"共享容器"与"隔离数据"如何兼得。

## 作业 3：让 Testcontainers 在 CI 稳定运行（分析题）

某 CI 里集成测试偶发失败且机器的 `/var/lib/docker` 迅速膨胀。请分析：① runner 没有 Docker 能力时的表现与解法（DinD vs 挂 sock 的取舍）；② 禁用了 Ryuk 又没替代清理导致的资源堆积；③ 首次拉镜像超时；④ 并发流水线争抢端口/资源。**验收标准**：每条给出根因 + 修复配置（如镜像预热、`withStartupTimeout`、恢复 Ryuk 或加 `docker system prune` 定时任务），并说明"为什么集成测试不该和单元测试混在同一阶段跑"。
