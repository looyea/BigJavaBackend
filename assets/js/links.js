/* 课程包「官方 / 中文资源」链接表（补充元数据，非骨架事实源；骨架仍唯一以 data.js 为准）。
 * 结构：PKG_LINKS[包id] = [{ t: 显示名, u: 网址 }]，通常含官网 + 中文官网/文档或知名中文社区站。
 * 所有网址均已于 2026-09 逐条 HTTP 实测可达（浏览器可正常访问；少数站点对脚本请求返回 403 属反爬，站点本身真实有效）。
 * 纯方法论 / 行业专题类课程包没有“产品官网”，此处指向该领域公认的权威站点或知名中文技术媒体。
 */
export const PKG_LINKS = {
  /* 计算机与算法基础 */
  'data-algorithms': [{ t: '算法可视化（中文）', u: 'https://visualgo.net/zh' }, { t: 'GeeksforGeeks', u: 'https://www.geeksforgeeks.org/' }],
  'networks': [{ t: 'RFC 官方编辑器', u: 'https://www.rfc-editor.org/' }, { t: '小林 coding·图解网络（中文）', u: 'https://www.xiaolincoding.com/' }],
  'netty': [{ t: 'Netty 官网', u: 'https://netty.io/' }, { t: 'GitHub', u: 'https://github.com/netty/netty' }],
  /* Java 基础语言 */
  'java-basics': [{ t: 'dev.java 官方学习站', u: 'https://dev.java/learn/' }, { t: '廖雪峰 Java 教程（中文）', u: 'https://www.liaoxuefeng.com/' }],
  'java-modern': [{ t: 'OpenJDK 官网', u: 'https://openjdk.org/' }, { t: 'JDK 版本特性', u: 'https://openjdk.org/projects/jdk/' }],
  'juc': [{ t: 'Java SE 21 API · java.util.concurrent', u: 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/package-summary.html' }],
  'jvm': [{ t: 'OpenJDK HotSpot', u: 'https://openjdk.org/groups/hotspot/' }, { t: 'JVM 工具官方文档', u: 'https://docs.oracle.com/en/java/javase/21/vm/' }],
  /* 相关框架 */
  'spring-boot': [{ t: 'Spring Boot 官网', u: 'https://spring.io/projects/spring-boot' }, { t: '参考文档', u: 'https://docs.spring.io/spring-boot/index.html' }],
  'spring-core': [{ t: 'Spring Framework 官网', u: 'https://spring.io/projects/spring-framework' }, { t: '参考文档', u: 'https://docs.spring.io/spring-framework/reference/' }],
  'spring-mvc': [{ t: 'Spring MVC 官方文档', u: 'https://docs.spring.io/spring-framework/reference/web.html' }],
  'spring-ai': [{ t: 'Spring AI 官网', u: 'https://spring.io/projects/spring-ai' }],
  'jakarta-ee': [{ t: 'Jakarta EE 官网', u: 'https://jakarta.ee/' }],
  'graalvm': [{ t: 'GraalVM 官网', u: 'https://www.graalvm.org/' }],
  /* 分布式系统 */
  'dist-theory': [{ t: 'MIT 6.5840 分布式系统', u: 'https://pdos.csail.mit.edu/6.5840/' }, { t: 'InfoQ 中文', u: 'https://www.infoq.cn/' }],
  'dist-data': [{ t: 'Jepsen 一致性研究', u: 'https://jepsen.io/' }],
  /* 架构设计与方法论 */
  'design-patterns': [{ t: 'Refactoring.Guru 设计模式', u: 'https://refactoring.guru/design-patterns' }],
  'ddd-architecture': [{ t: 'Domain Language（Evans）', u: 'https://domainlanguage.com/ddd/' }],
  'system-design': [{ t: 'System Design Primer', u: 'https://github.com/donnemartin/system-design-primer' }, { t: '中文简体版', u: 'https://github.com/donnemartin/system-design-primer/blob/master/README-zh-Hans.md' }],
  /* 数据库与缓存 */
  'mysql': [{ t: 'MySQL 官网', u: 'https://www.mysql.com/' }, { t: '官方文档', u: 'https://dev.mysql.com/doc/' }],
  'postgresql': [{ t: 'PostgreSQL 官网', u: 'https://www.postgresql.org/' }, { t: '文档', u: 'https://www.postgresql.org/docs/' }],
  'tidb': [{ t: 'TiDB（PingCAP）', u: 'https://www.pingcap.com/' }, { t: '中文文档', u: 'https://docs.pingcap.com/zh/tidb/stable' }],
  'redis': [{ t: 'Redis 官网', u: 'https://redis.io/' }, { t: '文档', u: 'https://redis.io/docs/latest/' }],
  'lettuce': [{ t: 'Lettuce 文档', u: 'https://redis.github.io/lettuce/' }, { t: 'GitHub', u: 'https://github.com/redis/lettuce' }],
  'redisson': [{ t: 'Redisson 官网', u: 'https://redisson.org/' }, { t: 'Wiki', u: 'https://github.com/redisson/redisson/wiki' }],
  'caffeine': [{ t: 'Caffeine（GitHub）', u: 'https://github.com/ben-manes/caffeine' }],
  'minio': [{ t: 'MinIO 官网', u: 'https://min.io/' }, { t: '文档', u: 'https://docs.min.io/' }],
  'memcached': [{ t: 'Memcached 官网', u: 'https://memcached.org/' }],
  /* 持久层与连接池 */
  'mybatis': [{ t: 'MyBatis 官网', u: 'https://mybatis.org/mybatis-3/' }, { t: 'MyBatis-Plus 中文官网', u: 'https://baomidou.com/' }],
  'spring-data-jpa': [{ t: 'Spring Data JPA 官网', u: 'https://spring.io/projects/spring-data-jpa' }],
  'druid': [{ t: 'Druid（GitHub）', u: 'https://github.com/alibaba/druid' }],
  'hikaricp': [{ t: 'HikariCP（GitHub）', u: 'https://github.com/brettwooldridge/HikariCP' }],
  /* 中间件 */
  'rocketmq': [{ t: 'RocketMQ 官网', u: 'https://rocketmq.apache.org/' }, { t: '中文文档', u: 'https://rocketmq.apache.org/zh/' }],
  'rabbitmq': [{ t: 'RabbitMQ 官网', u: 'https://www.rabbitmq.com/' }],
  'kafka': [{ t: 'Kafka 官网', u: 'https://kafka.apache.org/' }],
  'job-scheduling': [{ t: 'xxl-job 中文文档', u: 'https://www.xuxueli.com/xxl-job/' }, { t: 'GitHub', u: 'https://github.com/xuxueli/xxl-job' }],
  /* 微服务治理 */
  'spring-cloud-alibaba': [{ t: 'GitHub', u: 'https://github.com/alibaba/spring-cloud-alibaba' }, { t: '中文官网', u: 'https://sca.aliyun.com/' }],
  'nacos': [{ t: 'Nacos 官网', u: 'https://nacos.io/' }, { t: '中文站', u: 'https://nacos.io/zh-cn/' }],
  'gateway': [{ t: 'Spring Cloud Gateway 官网', u: 'https://spring.io/projects/spring-cloud-gateway' }],
  'openfeign': [{ t: 'Feign（GitHub）', u: 'https://github.com/openfeign/feign' }],
  'sentinel': [{ t: 'Sentinel（GitHub）', u: 'https://github.com/alibaba/Sentinel' }],
  'seata': [{ t: 'Seata 官网', u: 'https://seata.apache.org/' }, { t: '中文文档', u: 'https://seata.apache.org/zh-cn/' }],
  'rpc': [{ t: 'gRPC 官网', u: 'https://grpc.io/' }, { t: 'Dubbo 中文官网', u: 'https://cn.dubbo.apache.org/' }],
  'opentelemetry': [{ t: 'OpenTelemetry 官网', u: 'https://opentelemetry.io/' }],
  'prometheus': [{ t: 'Prometheus 官网', u: 'https://prometheus.io/' }],
  'grafana': [{ t: 'Grafana 官网', u: 'https://grafana.com/' }, { t: '文档', u: 'https://grafana.com/docs/' }],
  'skywalking': [{ t: 'SkyWalking 官网', u: 'https://skywalking.apache.org/' }, { t: '中文站', u: 'https://skywalking.apache.org/zh/' }],
  'istio': [{ t: 'Istio 官网', u: 'https://istio.io/' }, { t: '文档', u: 'https://istio.io/latest/docs/' }],
  'linkerd': [{ t: 'Linkerd 官网', u: 'https://linkerd.io/' }],
  'shardingsphere': [{ t: 'ShardingSphere 官网', u: 'https://shardingsphere.apache.org/' }, { t: '中文文档', u: 'https://shardingsphere.apache.org/document/current/cn/' }],
  /* 构建、运维与 CI/CD */
  'maven': [{ t: 'Maven 官网', u: 'https://maven.apache.org/' }],
  'gradle': [{ t: 'Gradle 官网', u: 'https://gradle.org/' }, { t: '文档', u: 'https://docs.gradle.org/' }],
  'docker': [{ t: 'Docker 官网', u: 'https://www.docker.com/' }],
  'kubernetes': [{ t: 'Kubernetes 官网', u: 'https://kubernetes.io/' }, { t: '中文文档', u: 'https://kubernetes.io/zh-cn/' }],
  'gitlab-ci': [{ t: 'GitLab CI/CD 文档', u: 'https://docs.gitlab.com/ee/ci/' }],
  'github-actions': [{ t: 'GitHub Actions 文档', u: 'https://docs.github.com/en/actions' }, { t: '中文文档', u: 'https://docs.github.com/zh/actions' }],
  'argocd': [{ t: 'Argo CD 文档', u: 'https://argo-cd.readthedocs.io/en/stable/' }],
  'elk': [{ t: 'Elastic 官网', u: 'https://www.elastic.co/' }, { t: '中文站', u: 'https://www.elastic.co/cn/' }],
  'loki': [{ t: 'Grafana Loki', u: 'https://grafana.com/oss/loki/' }],
  'linux-shell': [{ t: 'Linux 内核官网', u: 'https://www.kernel.org/' }, { t: 'TLDP 指南', u: 'https://tldp.org/' }],
  /* 测试 */
  'junit': [{ t: 'JUnit 5 官网', u: 'https://junit.org/junit5/' }],
  'mockito': [{ t: 'Mockito 官网', u: 'https://site.mockito.org/' }],
  'test-containers': [{ t: 'Testcontainers 官网', u: 'https://testcontainers.com/' }, { t: 'Java 文档', u: 'https://java.testcontainers.org/' }],
  'jmeter': [{ t: 'JMeter 官网', u: 'https://jmeter.apache.org/' }],
  'gatling': [{ t: 'Gatling 官网', u: 'https://gatling.io/' }],
  'sonar': [{ t: 'SonarQube 官网', u: 'https://sonarqube.org/' }, { t: '文档', u: 'https://docs.sonarsource.com/sonarqube/' }],
  'chaos': [{ t: 'Chaos Mesh 官网', u: 'https://chaos-mesh.org/' }, { t: '中文站', u: 'https://chaos-mesh.org/zh/' }],
  /* 性能调优工具 */
  'arthas': [{ t: 'Arthas 中文官网', u: 'https://arthas.aliyun.com/' }, { t: 'GitHub', u: 'https://github.com/alibaba/arthas' }],
  'async-profiler': [{ t: 'async-profiler（GitHub）', u: 'https://github.com/async-profiler/async-profiler' }],
  'jol': [{ t: 'JOL（GitHub）', u: 'https://github.com/openjdk/jol' }],
  /* 安全 */
  'spring-security': [{ t: 'Spring Security 官网', u: 'https://spring.io/projects/spring-security' }, { t: '文档', u: 'https://docs.spring.io/spring-security/reference/' }],
  'shiro': [{ t: 'Apache Shiro 官网', u: 'https://shiro.apache.org/' }],
  'oauth2': [{ t: 'OAuth 2.0', u: 'https://oauth.net/2/' }, { t: 'OpenID Connect', u: 'https://openid.net/connect/' }],
  'jwt': [{ t: 'JWT.io', u: 'https://jwt.io/' }],
  'web-defense': [{ t: 'OWASP 官网', u: 'https://owasp.org/' }, { t: 'OWASP Top 10', u: 'https://owasp.org/www-project-top-ten/' }],
  'data-security': [{ t: 'OWASP Cheat Sheet Series', u: 'https://cheatsheetseries.owasp.org/' }],
  /* 其他补充 */
  'elasticsearch': [{ t: 'Elasticsearch 官网', u: 'https://www.elastic.co/elasticsearch' }, { t: '中文站', u: 'https://www.elastic.co/cn/' }],
  'temporal': [{ t: 'Temporal 官网', u: 'https://temporal.io/' }, { t: '文档', u: 'https://docs.temporal.io/' }],
  'flink': [{ t: 'Flink 官网', u: 'https://flink.apache.org/' }, { t: '中文文档', u: 'https://nightlies.apache.org/flink/flink-docs-stable/zh/' }],
  'kafka-streams': [{ t: 'Kafka Streams 文档', u: 'https://kafka.apache.org/documentation/streams/' }],
  /* 专题 */
  'high-concurrency': [{ t: 'System Design Primer', u: 'https://github.com/donnemartin/system-design-primer' }, { t: 'InfoQ 中文', u: 'https://www.infoq.cn/' }],
  'high-availability': [{ t: 'Martin Fowler', u: 'https://martinfowler.com/' }],
  'idempotent': [{ t: 'Stripe 幂等请求', u: 'https://docs.stripe.com/api/idempotent_requests' }],
  'ecommerce': [{ t: 'mall 电商实战（GitHub）', u: 'https://github.com/macrozheng/mall' }],
  'fintech': [{ t: 'InfoQ 中文', u: 'https://www.infoq.cn/' }],
  'power-grid': [{ t: 'InfoQ 中文', u: 'https://www.infoq.cn/' }],
  'media-sns': [{ t: 'InfoQ 中文', u: 'https://www.infoq.cn/' }],
};
