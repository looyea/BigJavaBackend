# 用容器替代内存桩与数据准备

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：理解 Testcontainers 用真实中间件容器替代 H2/内存桩的价值与代价，能用 `@Container`/单例容器写可复现的集成测试，并掌握 CI 里跑得动它的工程前提。

## 一、为什么内存桩会骗过你

用 H2 假装 MySQL、用内存 Map 假装 Redis，是"集成测试假绿"的头号来源：

- 方言差异：H2 不认 MySQL 的 `ON DUPLICATE KEY UPDATE`、不认 `JSON` 列、不认你依赖的行锁与 `utf8mb4` 排序；上生产第一天 SQL 就报错；
- 行为差异：真 Redis 有过期/驱逐/序列化，内存桩全没有，分布式锁、缓存击穿逻辑根本没被测到；
- 版本漂移：桩是"你以为的中间件"，容器是"和线上同 tag 的中间件"。

Testcontainers 的立场：**测试要连真东西，但用完即弃、每次干净**。它在测试进程里用 Docker 拉起与生产同镜像的 Kafka/Postgres/Redis/ES，测完自动销毁。

## 二、最小可用：一个真实 MySQL 的 Repository 测试

```java
@SpringBootTest
// 目的：连真 MySQL 而非 H2，验证方言相关的 upsert 与约束
@Testcontainers
class OrderRepositoryIT {

    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0.36")  // 与生产同大版本
            .withDatabaseName("orders")
            .withReuse(false);            // 说明：默认不复用，保证每次干净、可复现

    // 关键：把容器的随机端口/库注入到 Spring 数据源，而不是写死 localhost:3306
    @DynamicPropertySource
    static void ds(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", mysql::getJdbcUrl);
        r.add("spring.datasource.username", mysql::getUsername);
        r.add("spring.datasource.password", mysql::getPassword);
    }

    @Autowired OrderRepository repo;
    // 说明：容器映射端口是随机的，任何"写死 localhost:3306"的配置都会翻车——连接信息只能从容器对象取

    @Test
    void upsert_shouldWorkOnRealMysql() {
        // 结果：migration + upsert 都按真 MySQL 行为执行，这条测试就是一次微型生产预演
        repo.upsert(new Order("o-1", 100));      // 依赖 ON DUPLICATE KEY，H2 跑必错、这里过
        repo.upsert(new Order("o-1", 250));
        assertThat(repo.byId("o-1").getAmount()).isEqualTo(250);  // 结果：真实 upsert 生效
    }
}
```

Flyway/Liquibase 会在测试启动时对真库跑 migration——顺带把"迁移脚本在真方言下能不能执行"也验证了，这是 H2 给不了的。

## 三、性能与复用：单例容器模式

每次 new 容器太慢（MySQL 启动几秒）。跨测试类共享用 **Testcontainers 单例模式**：

```java
// 目的：全测试 JVM 只起一个 Postgres，靠独立 schema 隔离，兼顾真实与速度
class PgFactory {
    // 反例：把它声明成每个测试类的 @Container 字段 → 每个类都冷启动一次，集成测试跑 20 分钟
    static final PostgreSQLContainer<?> PG =
            new PostgreSQLContainer<>("postgres:16-alpine");  // 静态、不加 @Container 即单例
    static { PG.start(); }   // 说明：JVM 级启动一次，由 Ryuk 回收容器兜底
    // 结果：整个 IT 套件只付一次冷启动账单；风险是残留状态要靠自己清表/独立 schema 兑现"隔离"二字
}
```

配套 `@DataJpaTest` + `@Sql` 每个测试建自己 schema 或清表，做到"共享容器、隔离数据"。

## 四、能跑的 Docker 数据/中间件远不止 DB

```java
@Container static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.6.0"));
@Container static GenericContainer<?> redis =
        new GenericContainer<>("redis:7.2").withExposedPorts(6379);   // 任意镜像都能起
@Container static ElasticsearchContainer es = new ElasticsearchContainer("docker.elastic.co/elasticsearch/elasticsearch:8.13.0");
// 反例：字段既不加 @Container 也不调 start()——容器根本没起，测试连不上还以为是网络/DNS 问题
// 结果：测消费幂等、缓存过期、ES 映射，都对着真组件行为，而不是桩的想象
```

## 五、CI 里跑得动的前提

Testcontainers 要在 CI 里真能起容器，工程门槛别忽略：

- CI runner 要能用 Docker：Docker-in-Docker 或挂 `docker.sock`（后者更快但要处理权限/安全）；
- ** Ryuk（资源回收器）** 负责测完删容器，某些受限 CI 里 Ryuk 起不来会残留垃圾——用 `TESTCONTAINERS_RYUK_DISABLED` 时必须有别的清理机制，否则磁盘会被镜像堆爆（异常表现：CI 机 `/var/lib/docker` 疯长）；
- 拉镜像耗时用 `withStartupTimeout` 与镜像预热缓存；离线环境预置私有 registry；
- 别把 IT（集成测试）和 unit 混跑：用 `maven-failsafe`（`*IT` 后缀）单独阶段，快测在 PR、集成在合并后。

## 六、关联技术

`@DynamicPropertySource`/切片测试依赖 [JUnit 5 架构](../../junit/s1/S1-1-Lesson.md) 与 [Mockito 与 Spring 切片](../../mockito/s1/S1-4-Lesson.md)；容器编排背景在 [Kubernetes](../../kubernetes/s1/S1-1-Lesson.md)；什么时候该用真容器、什么时候内存桩够用，取舍见 [JUnit 与协同](../../junit/s1/S1-4-Lesson.md)。
