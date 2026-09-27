/* 课程总目录：大技术分区 → 课程包 → 阶段 → 小节
 * 小节元组：[小节id, 标题, 内容简介, 难度星, 重要性星]
 * 课程内容全部为 Markdown：courses/<包id>/<阶段id>/<小节id>/{lesson,quiz,homework,interview}.md
 */

export const CATEGORIES = [
  {
    id: 'java-language', name: 'Java基础语言',
    desc: '语言本体、年度演进、并发与虚拟机，是后端一切的地基。',
    packages: [
      {
        id: 'java-basics', name: 'Java 语言基础（2015 前全量）', importance: 5,
        desc: '语法、面向对象、集合、泛型、IO、反射、Lambda 与 Stream，补齐到 JDK 8 的完整语言版图。',
        stages: [
          { id: 's1', name: '阶段一 · 语言基石与类型系统', sections: [
            ['s1-1', '面向对象核心与多态真相', '类/接口/抽象类的边界，重写与重载，多态的虚方法表机制。', 2, 5],
            ['s1-2', '集合框架全景', 'Collection/Map 体系，ArrayList 与 LinkedList 的性能边界。', 3, 5],
            ['s1-3', 'HashMap 的深度解剖', '哈希定位、扰动函数、树化退化、扩容 rehash 全过程。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · 泛型、异常与现代语法', sections: [
            ['s2-1', '泛型与类型擦除', '通配符、PECS 原则、擦除带来的限制与工程影响。', 3, 4],
            ['s2-2', '异常体系与最佳实践', '受检与非受检的取舍，异常链、try-with-resources。', 2, 4],
            ['s2-3', 'Lambda 与 Stream API', '函数式接口、惰性求值、并行流的陷阱。', 3, 4],
          ]},
        ],
      },
      {
        id: 'java-modern', name: 'Java 9→25 年度演进', importance: 4,
        desc: '2015 年之后每一年 JDK 的变化特点，直到 2026 年 4 月，理解演进背后的驱动力。',
        stages: [
          { id: 's1', name: '阶段一 · 模块化与语法减负', sections: [
            ['s1-1', 'Java 9-11：模块化与 LTS 落地', 'JPMS、var、ZGC 前夜，企业为什么停在 8 与 11。', 3, 3],
            ['s1-2', 'Java 17 LTS：语言结构现代化', 'sealed、record、instanceof 模式匹配。', 3, 4],
          ]},
          { id: 's2', name: '阶段二 · 并发模型与性能重塑', sections: [
            ['s2-1', 'Java 21 LTS：虚拟线程时代', 'Structured Concurrency、Sealed 完成、分代 ZGC。', 4, 5],
            ['s2-2', 'Java 22-25：Project Loom/Panama 收口', 'FMM、外部函数与内存 API、生成式元编程预览。', 4, 4],
          ]},
        ],
      },
      {
        id: 'juc', name: 'JUC 并发编程专题', importance: 5,
        desc: 'J.U.C 全套：内存模型、锁、原子类、线程池、并发容器、AQS。必须专题攻克。',
        stages: [
          { id: 's1', name: '阶段一 · 并发内存模型与锁', sections: [
            ['s1-1', 'JMM、happens-before 与三大特性', '可见性/原子性/有序性，重排序与内存屏障。', 4, 5],
            ['s1-2', 'volatile 与原子类', '指令级保证、CAS、ABA、LongAdder 的分段思想。', 4, 5],
            ['s1-3', 'synchronized 锁升级', '偏向/轻量/重量级，monitor 与 Object 头。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · AQS 与并发工具', sections: [
            ['s2-1', 'AQS 源码剖析', 'CLH 队列、state 语义、独占与共享模式。', 5, 5],
            ['s2-2', '线程池七参数与执行流程', '核心线程、队列、拒绝策略、动态调参。', 4, 5],
            ['s2-3', '并发容器与同步器', 'ConcurrentHashMap、CountDownLatch、CyclicBarrier、Semaphore。', 4, 4],
          ]},
        ],
      },
      {
        id: 'jvm', name: 'JVM 与 GC 专题', importance: 5,
        desc: '类加载、运行时内存、执行引擎、垃圾回收器与调优，架构师的性能底层语言。',
        stages: [
          { id: 's1', name: '阶段一 · 内存结构与执行机制', sections: [
            ['s1-1', '运行时数据区与方法区演进', '栈/堆/元空间，Direct Memory 边界。', 3, 5],
            ['s1-2', '类加载机制与双亲委派', '加载器分层、破坏双亲委派的场景（SPI、Tomcat）。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · GC 与调优', sections: [
            ['s2-1', '垃圾判定与回收算法', '可达性分析、卡表、分代与Region。', 4, 5],
            ['s2-2', 'G1 / ZGC / Shenandoah', '停顿模型、写屏障、彩色指针。', 5, 5],
            ['s2-3', '线上调优方法论', '参数、日志、Full GC 排查路径与容量规划。', 5, 5],
          ]},
        ],
      },
    ],
  },
  {
    id: 'frameworks', name: '相关框架',
    desc: 'Spring 生态与 Jakarta EE 标准，企业级应用的工程骨架。',
    packages: [
      {
        id: 'spring-boot', name: 'Spring Boot 4.1（含 2.0 / 3.0 全量）', importance: 5,
        desc: '以 Boot 4.1 为主线，回溯 2.0/3.0 的关键差异；自动配置、Starter、Actuator、原生镜像与虚拟线程实践。',
        stages: [
          { id: 's1', name: '阶段一 · 起步与容器装配', sections: [
            ['s1-1', 'Spring Boot 是什么，它解决了什么问题', '从 XML 地狱到约定优于配置；Boot 的定位、优缺点与适用规模；Hello World 从零部署。', 1, 5],
            ['s1-2', '自动配置机制与 SpringApplication.run 启动流程', '@SpringBootApplication 三注解拆解；启动六阶段与自动配置筛选链源码走查。', 4, 5],
            ['s1-3', 'IoC 容器与 Bean 生命周期', 'BeanDefinition、作用域、后置处理器链、循环依赖三级缓存。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · 配置、Web 与可观测', sections: [
            ['s2-1', '配置体系与 Profile 治理', '属性源优先级、@ConfigurationProperties 校验、配置中心接入。', 2, 4],
            ['s2-2', 'Spring MVC 请求处理全链路', 'DispatcherServlet 九大组件、参数解析、异常解析、内容协商。', 3, 5],
            ['s2-3', 'Actuator 与可观测性', 'Micrometer 指标、健康检查、Endpoint 安全暴露。', 3, 4],
          ]},
          { id: 's3', name: '阶段三 · 云原生与高性能', sections: [
            ['s3-1', '虚拟线程与高并发改造', 'Boot 3.2+ 开启 spring.threads.virtual.enabled 后集群行为的变化。', 4, 5],
            ['s3-2', 'GraalVM 原生镜像打包', 'AOT 处理、closed-world 假设、反射配置的代价与收益。', 5, 4],
          ]},
        ],
      },
      {
        id: 'spring-mvc', name: 'Spring MVC 深入', importance: 4,
        desc: 'Web 层框架本体：请求映射、参数绑定、视图与 REST 风格设计。',
        stages: [
          { id: 's1', name: '阶段一 · 核心机制', sections: [
            ['s1-1', '请求处理链路映射机制', 'HandlerMapping、HandlerAdapter、拦截器顺序。', 3, 4],
            ['s1-2', '参数解析与返回值处理', 'ArgumentResolver、消息转换器、@RequestBody 过程。', 3, 4],
          ]},
        ],
      },
      {
        id: 'jakarta-ee', name: 'Jakarta EE 11', importance: 3,
        desc: '标准与生态的关系：Servlet、CDI、JPA、JAX-RS 与 Boot 的分工。',
        stages: [
          { id: 's1', name: '阶段一 · 规范全景', sections: [
            ['s1-1', 'Jakarta EE 11 与 Web Profile', '规范组成、API 与 SPI、与 Spring 的映射关系。', 3, 3],
            ['s1-2', 'CDI 依赖注入标准', 'Bean 定义、限定符、拦截器、与 IoC 的差异。', 3, 3],
          ]},
        ],
      },
      {
        id: 'graalvm', name: 'GraalVM 与原生镜像', importance: 3,
        desc: 'AOT 编译、Truffle 多语言、原生镜像构建与冷启动收益。',
        stages: [
          { id: 's1', name: '阶段一 · 原生镜像实践', sections: [
            ['s1-1', '原生镜像原理与限制', 'closed-world、reachability metadata、启动加速比。', 4, 3],
          ]},
        ],
      },
    ],
  },
  {
    id: 'data-storage', name: '数据库与缓存',
    desc: '关系型、分布式 NewSQL、多级缓存与对象存储，数据的落地与读取。',
    packages: [
      {
        id: 'mysql', name: 'MySQL 8.0', importance: 5,
        desc: 'InnoDB 存储引擎、索引与执行计划、事务与 MVCC、锁、主从与高可用架构。',
        stages: [
          { id: 's1', name: '阶段一 · 架构与索引', sections: [
            ['s1-1', 'MySQL 体系结构与一条 SQL 的旅程', 'Server 层与引擎层、连接器、缓冲池、redo/binlog。', 3, 5],
            ['s1-2', 'B+ 树索引与执行计划', '聚簇/二级索引、回表、覆盖索引、EXPLAIN 全字段。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · 事务与锁', sections: [
            ['s2-1', '事务隔离与 MVCC', 'ReadView、undo log、幻读的解决方式。', 5, 5],
            ['s2-2', '锁机制与死锁排查', '行锁/间隙锁/next-key、MDL、在线 DDL。', 5, 5],
          ]},
        ],
      },
      {
        id: 'postgresql', name: 'PostgreSQL', importance: 4,
        desc: '多版本存储、扩展生态（PostGIS/pgvector）、与 MySQL 的选型差异。',
        stages: [
          { id: 's1', name: '阶段一 · 内核特性', sections: [
            ['s1-1', 'MVCC 与 VACUUM 机制', '事务快照、膨胀与回收、autovacuum 调参。', 4, 4],
          ]},
        ],
      },
      { id: 'tidb', name: 'TiDB 分布式数据库', importance: 3,
        desc: 'HTAP 架构、Region 分裂、SQL 调优与迁移场景。',
        stages: [ { id: 's1', name: '阶段一 · 架构与选型', sections: [
          ['s1-1', 'TiDB 计算存储分离架构', 'PD、TiKV、TiFlash 与一致性调度。', 4, 3],
        ]} ] },
      {
        id: 'redis', name: 'Redis', importance: 5,
        desc: '数据结构与编码、持久化、主从/哨兵/集群、缓存一致性与三大经典问题。',
        stages: [
          { id: 's1', name: '阶段一 · 数据结构与原理', sections: [
            ['s1-1', '五大类型与底层编码', 'ziplist/listpack、quicklist、跳表、渐进 rehash。', 3, 5],
            ['s1-2', '持久化与高可用架构', 'RDB/AOF、主从复制、哨兵与 Cluster 分槽。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · 缓存工程问题', sections: [
            ['s2-1', '缓存穿透/击穿/雪崩', '空值与布隆过滤器、互斥重建、过期打散。', 4, 5],
            ['s2-2', '缓存与数据库一致性', 'Cache Aside、延迟双删、订阅 binlog。', 5, 5],
          ]},
        ],
      },
      { id: 'redis-clients', name: 'Redis 客户端：Lettuce 与 Redisson', importance: 4,
        desc: 'Netty 响应式客户端、分布式锁、限流器、布隆过滤器等高级对象。',
        stages: [ { id: 's1', name: '阶段一 · 客户端选型与实战', sections: [
          ['s1-1', 'Lettuce 与 Jedis 的本质差异', '连接模型、线程安全、连接池策略。', 3, 4],
          ['s1-2', 'Redisson 分布式锁与看门狗', '可重入锁、RedLock 争议、读写锁。', 4, 5],
        ]} ] },
      { id: 'caffeine', name: 'Caffeine 本地缓存', importance: 3,
        desc: 'W-TinyLFU 淘汰算法、异步加载、与 Redis 构成的多级缓存。',
        stages: [ { id: 's1', name: '阶段一 · 本地缓存与多级缓存', sections: [
          ['s1-1', 'W-TinyLFU 与失效策略', '窗口区/主区、expireAfterAccess、加载器。', 4, 3],
        ]} ] },
      { id: 'minio', name: 'MinIO 对象存储', importance: 3,
        desc: 'S3 兼容协议、纠删码、预签名 URL 与海量非结构化数据。',
        stages: [ { id: 's1', name: '阶段一 · 对象存储实践', sections: [
          ['s1-1', 'MinIO 架构与上传下载模式', '纠删码、分片上传、直传与签名。', 3, 3],
        ]} ] },
      { id: 'memcached', name: 'Memcached（逐渐被取代）', importance: 2,
        desc: '历史地位与 Slab 分配机制，理解它为什么退场。',
        stages: [ { id: 's1', name: '阶段一 · 设计与退场原因', sections: [
          ['s1-1', 'Slab 架构与与 Redis 的对比', '纯内存 KV、无持久化、扩展性瓶颈。', 2, 2],
        ]} ] },
    ],
  },
  {
    id: 'persistence', name: '持久层与连接池',
    desc: 'SQL 到对象的映射层，以及数据库连接的池化管理。',
    packages: [
      { id: 'mybatis', name: 'MyBatis / MyBatis-Plus', importance: 5,
        desc: '映射器代理、动态 SQL、插件链、Plus 的条件构造器与代码生成。',
        stages: [ { id: 's1', name: '阶段一 · 核心原理', sections: [
          ['s1-1', 'MyBatis 执行流程与一级二级缓存', 'SqlSession、Executor、缓存边界与失效。', 4, 5],
          ['s1-2', 'MyBatis-Plus 工程提效', 'BaseMapper、Wrapper、分页插件、乐观锁插件。', 2, 4],
        ]} ] },
      { id: 'spring-data-jpa', name: 'Spring Data JPA', importance: 4,
        desc: '实体状态机、N+1 问题、派生查询与事务边界。',
        stages: [ { id: 's1', name: '阶段一 · 抽象与陷阱', sections: [
          ['s1-1', '持久化上下文与实体状态', '瞬时/托管/游离/移除，脏检查触发时机。', 4, 4],
          ['s1-2', 'N+1 与抓取策略', 'JOIN FETCH、EntityGraph、@BatchSize。', 4, 5],
        ]} ] },
      { id: 'druid', name: 'Druid（偏监控）', importance: 3,
        desc: 'SQL 监控、防注入 WallFilter、慢 SQL 定位。',
        stages: [ { id: 's1', name: '阶段一 · 监控能力', sections: [
          ['s1-1', 'Druid 监控与过滤器链', 'StatFilter、WallFilter、监控台安全。', 3, 3],
        ]} ] },
      { id: 'hikaricp', name: 'HikariCP（偏性能）', importance: 4,
        desc: '为什么它更快：并发池结构、字节码级优化、关键参数。',
        stages: [ { id: 's1', name: '阶段一 · 池化性能', sections: [
          ['s1-1', '连接池核心参数与故障表现', 'maximumPoolSize、连接泄漏、超时链路。', 3, 5],
        ]} ] },
    ],
  },
  {
    id: 'middleware', name: '中间件',
    desc: '消息与事件驱动：解耦、削峰、最终一致性的承载体。',
    packages: [
      { id: 'rocketmq', name: 'RocketMQ', importance: 4,
        desc: '事务消息、顺序消息、消息回溯，国内电商主力消息中间件。',
        stages: [ { id: 's1', name: '阶段一 · 架构与可靠性', sections: [
          ['s1-1', 'RocketMQ 架构与存储模型', 'CommitLog、ConsumeQueue、主从与 Dledger。', 4, 4],
          ['s1-2', '事务消息与最终一致性', '半消息、回查机制、订单场景应用。', 4, 5],
        ]} ] },
      { id: 'rabbitmq', name: 'RabbitMQ', importance: 3,
        desc: 'Exchange 路由模型、镜像队列、死信与延迟消息。',
        stages: [ { id: 's1', name: '阶段一 · 路由与可靠性', sections: [
          ['s1-1', 'Exchange 类型与消息投递保证', 'confirm、ack、死信队列、幂等消费。', 3, 4],
        ]} ] },
      { id: 'kafka', name: 'Kafka（高通量）', importance: 4,
        desc: '分区与顺序、零拷贝、高吞吐场景下的位移管理与重平衡。',
        stages: [ { id: 's1', name: '阶段一 · 高通量设计', sections: [
          ['s1-1', '分区、副本与 ISR 机制', '日志结构存储、ack 语义、min.insync.replicas。', 4, 5],
          ['s1-2', '消费组与再平衡', ' Cooperative 重平衡、位移提交、精确一次。', 4, 4],
        ]} ] },
    ],
  },
  {
    id: 'microservice', name: '微服务治理',
    desc: '注册配置、网关、流量治理、分布式事务与可观测性体系。',
    packages: [
      { id: 'spring-cloud-alibaba', name: 'Spring Cloud Alibaba', importance: 4,
        desc: 'Nacos + Sentinel + Seata 组合的国内主流微服务方案。',
        stages: [ { id: 's1', name: '阶段一 · 服务治理全景', sections: [
          ['s1-1', '微服务组件选型地图', '注册/配置/网关/熔断/事务各层的替代方案。', 3, 5],
        ]} ] },
      { id: 'nacos', name: 'Nacos 注册与配置中心', importance: 4,
        desc: 'AP/CP 切换、长轮询配置推送、服务健康检查。',
        stages: [ { id: 's1', name: '阶段一 · 原理与运维', sections: [
          ['s1-1', '服务注册发现与心跳模型', '临时实例、Distro、集群一致性。', 4, 4],
          ['s1-2', '配置中心与灰度推送', '长轮询、加密配置、多环境隔离。', 3, 4],
        ]} ] },
      { id: 'gateway', name: 'Spring Cloud Gateway', importance: 4,
        desc: 'Route/Predicate/Filter 模型、限流、统一鉴权。',
        stages: [ { id: 's1', name: '阶段一 · 网关工程', sections: [
          ['s1-1', '网关三大件与全局过滤器', '断言工厂、过滤器顺序、鉴权落地。', 3, 4],
        ]} ] },
      { id: 'openfeign', name: 'OpenFeign 与 LoadBalancer', importance: 3,
        desc: '声明式调用、超时重试、客户端负载均衡策略。',
        stages: [ { id: 's1', name: '阶段一 · 远程调用', sections: [
          ['s1-1', 'Feign 调用链与超时重试陷阱', '连接池、Retryer、 Ribbon 到 LoadBalancer。', 3, 4],
        ]} ] },
      { id: 'sentinel', name: 'Sentinel 流量治理', importance: 4,
        desc: '流控算法、熔断降级、热点参数与集群限流。',
        stages: [ { id: 's1', name: '阶段一 · 稳定性防护', sections: [
          ['s1-1', '滑动窗口与流控效果', '直接/关联/链路，排队与预热模式。', 4, 5],
        ]} ] },
      { id: 'seata', name: 'Seata 分布式事务', importance: 4,
        desc: 'AT/TCC/Saga/XA 四模式，全局锁与补偿机制。',
        stages: [ { id: 's1', name: '阶段一 · 事务模式', sections: [
          ['s1-1', 'AT 模式与全局锁', 'undo_log、脏写防护、与本地事务边界。', 5, 5],
        ]} ] },
      { id: 'observability', name: 'SkyWalking / OpenTelemetry / Prometheus / Grafana', importance: 4,
        desc: 'Trace-Log-Metric 三大支柱的统一采集与告警闭环。',
        stages: [ { id: 's1', name: '阶段一 · 可观测体系', sections: [
          ['s1-1', '链路追踪与 OTel 语义约定', 'Span 模型、采样策略、Agent 无侵入埋点。', 4, 4],
          ['s1-2', '指标采集与看板告警', 'PromQL、 exporter、Grafana 面板设计。', 3, 4],
        ]} ] },
      { id: 'mesh', name: 'Istio 与 Linkerd 服务网格', importance: 3,
        desc: 'Sidecar 数据平面、流量切分、mTLS 与语言无关治理。',
        stages: [ { id: 's1', name: '阶段一 · 网格边界', sections: [
          ['s1-1', 'Sidecar 与 Java 生态的取舍', '控制面/数据面、延迟成本、何时不用网格。', 4, 3],
        ]} ] },
      { id: 'shardingsphere', name: 'ShardingSphere 分库分表', importance: 4,
        desc: '分片路由、读写分离、分布式主键与数据迁移。',
        stages: [ { id: 's1', name: '阶段一 · 数据分片', sections: [
          ['s1-1', '分片算法与跨库查询改写', '标准/复合/ Hint 分片，归并引擎。', 5, 5],
        ]} ] },
    ],
  },
  {
    id: 'testing', name: '测试',
    desc: '从单元到混沌：可交付系统的信心来自验证的密度。',
    packages: [
      { id: 'junit-mockito', name: 'JUnit 5 与 Mockito', importance: 4,
        desc: '参数化测试、扩展模型、Mock/Spy/注入与测试替身原则。',
        stages: [ { id: 's1', name: '阶段一 · 单元与切片测试', sections: [
          ['s1-1', 'JUnit 5 生命周期与参数化', '@ParameterizedTest 数据源、动态测试。', 2, 4],
          ['s1-2', 'Mockito 与 Boot 切片测试', '@WebMvcTest、@DataJpaTest、Mock 边界。', 3, 4],
        ]} ] },
      { id: 'perf-test', name: 'JMeter 与 Gatling', importance: 3,
        desc: '压测模型、指标解读、瓶颈定位与容量结论输出。',
        stages: [ { id: 's1', name: '阶段一 · 性能验证', sections: [
          ['s1-1', '压测脚本与指标体系', 'TPS/RT/错误率，思考时间与并发模型。', 3, 4],
        ]} ] },
      { id: 'sonar', name: 'SonarQube 静态分析', importance: 3,
        desc: '质量阈、技术债度量与 CI 中的质量门禁。',
        stages: [ { id: 's1', name: '阶段一 · 质量门禁', sections: [
          ['s1-1', '规则集与门禁策略', 'Quality Gate、增量覆盖率、误报处理。', 2, 3],
        ]} ] },
      { id: 'chaos', name: '混沌工程（Chaos Mesh）', importance: 3,
        desc: '故障注入实验设计、爆炸半径控制、稳态假设验证。',
        stages: [ { id: 's1', name: '阶段一 · 故障演练', sections: [
          ['s1-1', '实验设计与 K8s 故障类型', 'Pod/网络/IO 故障，演练闭环。', 4, 3],
        ]} ] },
    ],
  },
  {
    id: 'devops', name: '构建、运维与 CI/CD',
    desc: '代码到线上的一条流水线，以及可观测与回滚能力。',
    packages: [
      { id: 'maven-gradle', name: 'Maven 与 Gradle', importance: 4,
        desc: '依赖调解、BOM 管理、插件机制、构建缓存与多模块。',
        stages: [ { id: 's1', name: '阶段一 · 构建体系', sections: [
          ['s1-1', '依赖冲突与最近优先原则', '版本调解、exclusion、dependencyManagement。', 3, 5],
        ]} ] },
      { id: 'docker-k8s', name: 'Docker 与 Kubernetes', importance: 5,
        desc: '镜像分层、JVM 容器感知、探针、滚动发布与资源配额。',
        stages: [ { id: 's1', name: '阶段一 · 容器化', sections: [
          ['s1-1', 'Java 应用的 Dockerfile 优化', '分层构建、JLink、内存与 CPU limit 感知。', 3, 5],
          ['s1-2', 'K8s 调度与探针配置', 'liveness/readiness/startup、优雅停机。', 4, 5],
        ]} ] },
      { id: 'cicd', name: 'GitLab CI / GitHub Actions / Argo CD', importance: 3,
        desc: '流水线设计、制品晋级、GitOps 持续部署。',
        stages: [ { id: 's1', name: '阶段一 · 流水线与 GitOps', sections: [
          ['s1-1', '流水线阶段与缓存复用', '并行策略、制品库、环境晋级。', 3, 3],
        ]} ] },
      { id: 'log-platform', name: 'ELK 与 Loki 日志体系', importance: 3,
        desc: '日志采集分层、索引生命周期、低成本检索方案。',
        stages: [ { id: 's1', name: '阶段一 · 日志平台', sections: [
          ['s1-1', 'ELK 与 Loki 的成本取舍', '全文索引 vs 标签索引、ILM 策略。', 3, 3],
        ]} ] },
    ],
  },
  {
    id: 'tuning', name: '性能调优工具',
    desc: '定位问题的手术刀：线上不停机观测、火焰图与对象内存布局。',
    packages: [
      { id: 'arthas', name: 'Arthas 在线诊断', importance: 4,
        desc: 'trace/watch/jad/profiler，无侵入定位慢调用与类冲突。',
        stages: [ { id: 's1', name: '阶段一 · 线上诊断实战', sections: [
          ['s1-1', '方法级观测与调用链耗时', 'trace 条件表达式、watch 输出、类加载器排查。', 3, 5],
        ]} ] },
      { id: 'async-profiler', name: 'Async-Profiler 火焰图', importance: 4,
        desc: '安全点采样、CPU/alloc/lock 模式、火焰图解读。',
        stages: [ { id: 's1', name: '阶段一 · 采样与解读', sections: [
          ['s1-1', '火焰图怎么看与常见瓶颈', '宽平顶、GC 线程、native 栈。', 4, 5],
        ]} ] },
      { id: 'jol', name: 'JOL 对象内存布局', importance: 3,
        desc: '字段重排、压缩指针、缓存行填充的量化验证。',
        stages: [ { id: 's1', name: '阶段一 · 对象尺寸测量', sections: [
          ['s1-1', '对象头、对齐与伪共享', 'javaf 输出解读、@Contended 收益。', 4, 3],
        ]} ] },
    ],
  },
  {
    id: 'security', name: '安全',
    desc: '认证授权、令牌体系与注入类攻击的系统性防御。',
    packages: [
      { id: 'spring-security', name: 'Spring Security', importance: 4,
        desc: '过滤器链、认证模型、授权表达式与方法级安全。',
        stages: [ { id: 's1', name: '阶段一 · 过滤器链与授权', sections: [
          ['s1-1', '安全过滤器链执行顺序', 'SecurityContext、认证入口、异常翻译。', 4, 5],
        ]} ] },
      { id: 'shiro', name: 'Shiro', importance: 2,
        desc: 'Subject/Realm 模型，与 Security 的选型边界。',
        stages: [ { id: 's1', name: '阶段一 · 权限模型', sections: [
          ['s1-1', 'Realm 与权限粒度设计', '角色/权限字符串、缓存与会话。', 3, 2],
        ]} ] },
      { id: 'oauth2-jwt', name: 'OAuth2.0 与 JWT', importance: 4,
        desc: '授权码模式、令牌结构、刷新与吊销、SSO 落地。',
        stages: [ { id: 's1', name: '阶段一 · 协议与令牌', sections: [
          ['s1-1', '四种授权模式与 PKCE', 'scope、redirect_uri 校验、令牌存储。', 4, 5],
          ['s1-2', 'JWT 结构与签名验证', ' Claims、过期与刷新、无状态登出难题。', 3, 5],
        ]} ] },
      { id: 'web-defense', name: 'SQL 注入与 XSS 防御（必备模块）', importance: 5,
        desc: '预编译本质、参数校验、输出编码、CSP 与 CSRF。',
        stages: [ { id: 's1', name: '阶段一 · 攻防基础', sections: [
          ['s1-1', '注入原理与预处理防御', 'MyBatis ${} 与 #{}、动态表名白名单。', 3, 5],
          ['s1-2', 'XSS / CSRF 与 CSP', '反射/存储型、SameSite、转义与策略头。', 3, 5],
        ]} ] },
    ],
  },
  {
    id: 'extras', name: '其他补充',
    desc: '搜索与持久化工作流，跨越单体到分布式的能力补位。',
    packages: [
      { id: 'elasticsearch', name: 'Elasticsearch', importance: 4,
        desc: '倒排索引、分词、写入近实时、聚合与深分页方案。',
        stages: [ { id: 's1', name: '阶段一 · 检索原理', sections: [
          ['s1-1', '倒排索引与分词器链路', 'mapping、analysis、相关度打分。', 4, 4],
          ['s1-2', '写入流程与近实时可见', 'translog、refresh、段合并。', 4, 4],
        ]} ] },
      { id: 'temporal', name: 'Temporal 持久化工作流', importance: 3,
        desc: '确定性执行、重放机制、Saga 的工程化替代。',
        stages: [ { id: 's1', name: '阶段一 · 工作流引擎', sections: [
          ['s1-1', 'Workflow/Activity 与重放', '确定性约束、重试策略、版本升级。', 5, 3],
        ]} ] },
    ],
  },
  {
    id: 'topics', name: '专题',
    desc: '跨技术整合：必须给出实际例子与通用特点，架构师视角的主战场。',
    packages: [
      { id: 'high-concurrency', name: '高并发（总纲）', importance: 5,
        desc: '从接入到存储的分层削峰与扩展：缓存、异步、池化、无状态化、水平拆分。',
        stages: [
          { id: 's1', name: '阶段一 · 方法论与总览', sections: [
            ['s1-1', '高并发三大原则与容量模型', '无状态、缓存、异步；Little 定律与 TPS 推导。', 4, 5],
            ['s1-2', '跨技术联动：秒杀全链路', '网关限流 + Redis 预扣 + MQ 削峰 + DB 兜底。', 5, 5],
          ]},
        ],
      },
      { id: 'high-availability', name: '高可用（总纲）', importance: 5,
        desc: '冗余、隔离、降级、限流、容灾：可用性目标如何拆到每一层。',
        stages: [ { id: 's1', name: '阶段一 · 可用性与故障治理', sections: [
          ['s1-1', 'SLA 拆解与故障域划分', '99.99% 到每层的预算，多可用区部署。', 4, 5],
          ['s1-2', '跨技术联动：降级与熔断体系', 'Sentinel + 线程池隔离 + 兜底缓存 + 开关平台。', 5, 5],
        ]} ] },
      { id: 'distributed-id', name: '分布式 ID', importance: 4,
        desc: '号段、雪花、Leaf、UUID 的取舍：趋势递增与时钟回拨处理。',
        stages: [ { id: 's1', name: '阶段一 · 方案与工程细节', sections: [
          ['s1-1', '雪花算法与时钟回拨', '位分配、workerId 注册、等待或备用位。', 4, 5],
          ['s1-2', '号段模式与 Leaf 双 Buffer', '批量预取、DB 兜底、发号性能。', 4, 4],
        ]} ] },
      { id: 'idempotent', name: '幂等性', importance: 5,
        desc: '唯一索引、令牌、状态机、乐观锁：接口与消息消费的一致做法。',
        stages: [ { id: 's1', name: '阶段一 · 幂等设计模式', sections: [
          ['s1-1', '重复请求的四类解法', 'Token 机制、DB 唯一约束、状态机、去重表。', 4, 5],
          ['s1-2', '消息消费幂等与事务消息', '消费位点、去重缓存、本地事务表。', 5, 5],
        ]} ] },
      { id: 'ecommerce', name: '国内电子商务流程与应用', importance: 4,
        desc: '购物车→下单→库存→支付→履约全链路，含大促与售后逆向流程。',
        stages: [ { id: 's1', name: '阶段一 · 交易主链路', sections: [
          ['s1-1', '下单链路与库存扣减', '订单快照、预扣与实扣、超时释放。', 4, 5],
          ['s1-2', '支付与对账体系', '支付渠道、异步通知、差错账处理。', 4, 5],
        ]} ] },
      { id: 'fintech', name: '国内银行金融流程与应用', importance: 4,
        desc: '账务核心、复式记账、对账、清算、监管与两地三中心。',
        stages: [ { id: 's1', name: '阶段一 · 账务与一致性', sections: [
          ['s1-1', '核心账务与复式记账模型', '科目、借贷平衡、日切与总账。', 5, 5],
          ['s1-2', '对账、清算与资损防控', '三方对账、差错挂账、金额精度。', 5, 5],
        ]} ] },
      { id: 'power-grid', name: '国内电力集团内容与应用', importance: 3,
        desc: '采集与计量、负荷预测、时序数据、政企交付与信创约束。',
        stages: [ { id: 's1', name: '阶段一 · 行业系统形态', sections: [
          ['s1-1', '用电采集与时序数据处理', '高频上报、批量入库、时序库选型。', 4, 3],
        ]} ] },
      { id: 'media-sns', name: '国内自媒体与 SNS 应用', importance: 3,
        desc: 'Feed 流推拉模型、关系链、计数器、内容审核与热点治理。',
        stages: [ { id: 's1', name: '阶段一 · 内容与关系', sections: [
          ['s1-1', 'Feed 流推拉结合与热 Key', '注册/写扩散、多级时间线、热点打散。', 5, 4],
        ]} ] },
    ],
  },
];

/* ---------- 派生索引与工具 ---------- */

export const secKey = (sec) => `${sec.pkg}#${sec.stage}#${sec.id}`;

export const INDEX = { pkg: {}, section: {}, cat: {} };
CATEGORIES.forEach((cat) => {
  INDEX.cat[cat.id] = cat;
  (cat.packages || []).forEach((pkg) => {
    pkg.categoryId = cat.id;
    INDEX.pkg[pkg.id] = pkg;
    (pkg.stages || []).forEach((stage) => {
      stage.sections = stage.sections.map(([sid, title, summary, diff, imp]) => ({
        id: sid, title, summary, difficulty: diff, importance: imp, pkg: pkg.id, stage: stage.id,
      }));
      stage.sections.forEach((sec) => { INDEX.section[secKey(sec)] = sec; });
    });
  });
});

export function findSection(pkgId, stageId, secId) {
  /* 路由中的编号允许大写书写（如 #/sec/SpringBoot/S1/S1-1），按小写 id 归一后再查索引 */
  return INDEX.section[`${pkgId}#${stageId}#${secId}`.toLowerCase()] || null;
}

/**
 * 小节内容文件：课程包文件夹 / 阶段文件夹 / 阶段编号-小节编号-种类.md（见规格《课程包内容文件及文件夹结构》）
 * 编号部分按示例写作大写（S1-1-Lesson.md），站内 id 与路由、进度键仍为小写，只在本函数内转大写，
 * Windows 文件系统不区分大小写，两者不会冲突。
 */
export const secDir = (sec) => `courses/${sec.pkg}/${sec.stage}`;
export const secFile = (sec, kind) => `${secDir(sec)}/${sec.id.toUpperCase()}-${kind}.md`;
