# 用容器替代内存桩与数据准备 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. 用 H2 代替 MySQL 做集成测试，最大的风险是？（6分）

- A. H2 太慢
- B. 方言/约束/锁行为不一致，测试假绿、上生产才暴雷
- C. H2 不支持事务
- D. 无法写 Repository
> 答案：B
> 解析：H2 不认 `ON DUPLICATE KEY`、JSON 列、行锁与特定排序规则等；这正是 Testcontainers 用真镜像的动机。

### 2. Testcontainers 里让 Spring 连上随机端口的容器的关键机制是？（6分）

- A. 改 application.yml 写死端口
- B. `@DynamicPropertySource` 把容器 `getJdbcUrl()` 等注入环境
- C. 用环境变量
- D. 反射
> 答案：B
> 解析：容器端口是随机映射的，必须通过 `@DynamicPropertySource` 动态注入数据源属性，而非静态配置。

### 3. `@Container` 标注在测试实例字段上（非 static）的默认生命周期是？（6分）

- A. 整个 JVM 一个
- B. 每个测试方法/类启动并停止一个，隔离但慢
- C. 永不停止
- D. 手动管理
> 答案：B
> 解析：非 static `@Container` 随测试类实例起停，干净但重复冷启动慢；跨类共享要改用单例容器模式。

### 4. 单例容器（static、不加 @Container）解决的主要问题是？（6分）

- A. 数据隔离
- B. 每个测试类都冷启动容器导致集成测试过慢
- C. 内存泄漏
- D. 端口冲突
> 答案：B
> 解析：静态块 `start()` 一次、全 JVM 复用，配合每测试独立 schema/清表实现"共享容器、隔离数据"，兼顾真实与速度。

### 5. Ryuk 组件的作用是？（6分）

- A. 加速启动
- B. 测试结束后自动回收容器/网络，防止资源残留
- C. 跑 SQL
- D. mock 中间件
> 答案：B
> 解析：禁用 Ryuk（`TESTCONTAINERS_RYUK_DISABLED`）又无替代清理时，CI 机 `/var/lib/docker` 会被残留容器/镜像堆爆。

### 6. 集成测试（*IT）与单元测试在构建里应如何安排？（6分）

- A. 混在一起跑
- B. 用 maven-failsafe 把 IT 单独阶段，快测走 PR、集成按需/合并后跑
- C. 只跑 IT
- D. 禁用 IT
> 答案：B
> 解析：IT 依赖 Docker、耗时且可能受环境限制，分阶段既保证反馈速度又让重测试可控。

### 7. Testcontainers 在 CI 能运行的前提是？（6分）

- A. CI 装了 JDK 就行
- B. runner 能使用 Docker（DinD 或挂 docker.sock）
- C. 必须有 K8s
- D. 必须联网下载源码
> 答案：B
> 解析：它本质是调 Docker 起容器，CI 无 Docker 能力则跑不动；挂 docker.sock 快但要处理权限与安全。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）相比内存桩，真容器测试的收益包括？（9分）

- A. 验证真实 SQL 方言与迁移脚本可执行
- B. 覆盖 Redis 过期/驱逐等真实行为
- C. 完全不需要 Docker 环境
- D. 与生产同版本中间件，减少版本漂移
> 答案：ABD
> 解析：C 错——真容器测试恰恰依赖 Docker；A/B/D 是其核心价值。

### 9. （多选）关于"共享容器、隔离数据"的正确做法有？（9分）

- A. 静态单例容器 + 每个测试独立 schema
- B. 用 `@Sql` 或测试前后清表保证互不污染
- C. 所有测试直接共用同一份数据也不清理
- D. 结合 `@DataJpaTest` 事务回滚减少残留
> 答案：ABD
> 解析：C 会造成测试相互依赖、顺序相关的偶发失败；数据必须隔离或回滚。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 团队要把一批"H2 + 内存桩"的伪集成测试迁移到 Testcontainers，并让它们进 CI。请给出迁移与工程化方案。（40分）

> 参考答案：
- 要点1：先分层——纯单测保持无依赖快跑，真正打DB/MQ的升级为 *IT，用 failsafe 分阶段；
- 要点2：容器管理——高频共享的 DB 用单例容器（static+start），按镜像与生产对齐版本，禁 latest；
- 要点3：Spring 接线——`@DynamicPropertySource` 注入 url/user/pwd，migration（Flyway）对真库跑；
- 要点4：数据隔离——每测试独立 schema 或 `@Sql` 清表 / 事务回滚，保证可重复；
- 要点5：CI 前提——runner 提供 Docker（挂 sock/DinD）、Ryuk 正常或加替代清理、镜像预热缓存、设 startupTimeout；
- 要点6：取舍说明——并非全上真容器，纯领域逻辑用 Mockito 桩更快，真容器留给"跨进程边界"验证，控制总时长。
