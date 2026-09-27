/* 课程总目录（唯一的"骨架事实源"，驱动首页所有大方块）：
 *   大技术分区 category → 课程包 package → 阶段 stage → 小节 section
 * 小节元组：[小节id, 标题, 一句话知识点, 难度星(1-5), 重要性星(1-5)]
 * 课程内容全部为 Markdown：courses/<包id>/<阶段id>/<阶段编号-小节编号>-{Lesson,Quiz,Homework,Interview}.md
 * 设计基线：以资深架构师视角组织，覆盖电商 / 金融 / 电力三类行业的真实所需；
 *   重要级(imp) 决定讲解详略（见 app.js depthOf：5 核心精讲 · 4 重点标准 · 3 标准概览 · ≤2 简明速览）
 *   阶段/小节的排列即学习顺序（由浅入深、地基在前）。
 */

export const CATEGORIES = [
  /* ============================ 一、计算机与算法基础 ============================ */
  {
    id: 'cs-fundamentals', name: '计算机与算法基础',
    desc: '数据结构算法、计算机网络、IO 与 Netty——离开这些，框架原理与系统设计都无从谈起。',
    packages: [
      {
        id: 'data-algorithms', name: '数据结构与算法', importance: 5,
        desc: '复杂度思维 → 线性结构 → 树与堆 → 图/排序/查找 → 算法设计范式，逐层拆透，兼顾工程选型与面试高频。',
        stages: [
          { id: 's1', name: '阶段一 · 复杂度与线性结构', sections: [
            ['s1-1', '复杂度分析与大 O 思维', '时间/空间复杂度、均摊分析、为什么后端热路径只接受 O(1)/O(log n)/O(n)，以及它如何对应索引/缓存/批量等架构决策。', 2, 5],
            ['s1-2', '数组与链表', '连续内存 vs 指针链接的访问/缓存/增删权衡，ArrayList 与 LinkedList 的复杂度真相与选型边界。', 2, 4],
            ['s1-3', '栈、队列与双端队列', 'LIFO/FIFO 语义，ArrayDeque 取代 Stack，栈做表达式/DFS/回溯、队列做 BFS/削峰，Deque 通吃。', 2, 4],
            ['s1-4', '哈希表原理与冲突处理', '哈希函数与定桶、链地址 vs 开放寻址、负载因子与扩容 rehash、退化防护，以及 HashMap/ConcurrentHashMap 家族定位。', 3, 5],
          ]},
          { id: 's2', name: '阶段二 · 树与堆（重点展开）', sections: [
            ['s2-1', '二叉树与二叉搜索树', '遍历（前中后/层序）、由遍历序列还原、BST 有序性与查找/插入删除，最坏退化成链表的动机。', 3, 5],
            ['s2-2', '平衡树与红黑树', 'AVL 与旋转、红黑树五条性质与插入修复、TreeMap/TreeSet 应用，为何工程偏爱红黑而非严格平衡。', 4, 4],
            ['s2-3', '堆、优先队列与堆排序', '完全二叉树数组表示、上浮下沉、O(n) 建堆、Top-K 与堆排序，只保证堆顶极值的偏序本质。', 3, 5],
            ['s2-4', 'B/B+ 树、Trie、跳表、并查集、布隆过滤器', '磁盘多叉矮胖的 B+ 树为何做索引、前缀 Trie、Redis 跳表、聚并查集、概率型布隆过滤器的代价与误判。', 4, 4],
          ]},
          { id: 's3', name: '阶段三 · 图、排序与查找', sections: [
            ['s3-1', '图的存储、遍历与经典算法', '邻接矩阵/表、BFS/DFS、最短路（Dijkstra/BFS 无权）、拓扑排序与环检测、并查集判连通。', 4, 4],
            ['s3-2', '排序算法全景与稳定性', '比较下界 Ω(n log n)、快/归/堆/基数、稳定性与多关键字、JDK DualPivotQuicksort 与 TimSort、外部排序与并行排序。', 4, 5],
            ['s3-3', '查找与二分', '二分边界模板（lower/upperBound）、防溢出、旋转数组、以及“二分答案”把最优化转成判定的套路。', 3, 5],
          ]},
          { id: 's4', name: '阶段四 · 算法设计范式', sections: [
            ['s4-1', '双指针与滑动窗口', '对撞/快慢双指针靠单调性降维，滑动窗口“扩张→违规收缩→更新”模板把区间枚举降到 O(n)。', 3, 5],
            ['s4-2', '递归与分治', '信任子问题、基准与规模递减、栈溢出改迭代；子问题独立用分治、重叠则转 DP，主定理估复杂度。', 3, 4],
            ['s4-3', '贪心', '贪心选择性质 + 最优子结构的证明、交换论证、区间调度/霍夫曼，以及必须退回 DP 的反例。', 3, 4],
            ['s4-4', '动态规划', '状态定义与转移方程、一维/二维/背包/区间/LIS/编辑距离、记忆化 vs 递推、空间优化。', 4, 5],
            ['s4-5', '回溯与搜索', '决策树 DFS + 撤销、剪枝与去重，排列/组合/子集/N 皇后/数独，与 DFS/BFS 搜索的关系。', 4, 4],
            ['s4-6', '位运算、前缀和、差分、单调栈与单调队列', 'O(1) 空间位统计与异或技巧、区间和/差分的降维、下一个更大元素与柱状图、滑动窗口最值的单调队列。', 4, 3],
          ]},
        ],
      },
      {
        id: 'networks', name: '计算机网络', importance: 5,
        desc: '从链路与 IP 地基，到 TCP 传输、HTTP/HTTPS 应用语义、DNS/CDN/LB 基础设施与 Linux 工程调优，最后串成一次请求的全链路。',
        stages: [
          { id: 's1', name: '阶段一 · 分层、链路与网络层地基', sections: [
            ['s1-1', '分层模型、封装与分组交换', 'OSI 与 TCP/IP 四层职责划分、封装与解封装、为什么要分层；带宽/时延/RTT 四个量化口径与吞吐上界的估算。', 2, 4],
            ['s1-2', '以太网、交换机与 VLAN', 'MAC 地址与 ARP 解析、帧格式与 MTU、广播域与冲突域；交换机自学习、VLAN 隔离与 trunk/access，以及 MPLS 的定位。', 2, 3],
            ['s1-3', 'IP、子网划分与路由', 'IP 头关键字段、CIDR 与子网掩码/网关计算、路由表最长前缀匹配与默认路由、NAT 与内网穿透、ICMP 与 ping/traceroute 的原理。', 3, 4],
          ]},
          { id: 's2', name: '阶段二 · 传输层与连接管理', sections: [
            ['s2-1', 'UDP 与 Socket API 语义', '无连接/不可靠/有界的报文体、校验和、端口与五元组；connect/write/read/close 语义、write 缓冲返回 0 的真相，以及组播/广播与 QUIC 为何建在 UDP 上。', 2, 4],
            ['s2-2', 'TCP 三次握手 / 四次挥手与状态机', '序号与 SYN/ACK 的确认语义、为什么不能两次、半连接与全连接队列（backlog/syncookies）、TIME_WAIT 的两个作用与堆积治理、FIN-WAIT-2 泄漏与 RST 场景。', 3, 5],
            ['s2-3', 'TCP 可靠传输与流量控制', 'ARQ/累积确认/快速重传与 RTO 计算、Karn 算法、滑动窗口与零窗口探测、持续连接计时器、窗口收缩与 Nagle/延迟 ACK 交互、乱序与重复段处理。', 4, 5],
            ['s2-4', '拥塞控制、粘包拆包与队头阻塞', '慢启动/拥塞避免/快重传/快恢复四阶段与 cwnd-rwnd 共同决定发送速率、BBR 与 CUBIC 的取舍、字节流为何需要应用层定界、TCP 与 HTTP/2 的队头阻塞。', 4, 5],
          ]},
          { id: 's3', name: '阶段三 · 应用层协议与安全', sections: [
            ['s3-1', 'HTTP/1.x：报文、持久连接与缓存', '请求/响应报文与分块传输、keep-alive 与浏览器并发上限、队头阻塞成因；方法语义与幂等性、状态码家族、Cache-Control/ETag/Last-Modified 缓存决策链。', 3, 5],
            ['s3-2', 'HTTP/2 与 HTTP/3（QUIC）', '二进制分帧、流/连接多路复用、头部 HPACK 与动态表、服务器推送与优先级；QUIC 用 UDP 消灭传输层队头阻塞、0-RTT、连接迁移与用户态拥塞控制。', 3, 4],
            ['s3-3', 'HTTPS、TLS 1.2/1.3 与证书体系', '对称+非对称+摘要的混合设计、完整握手与密钥调度、证书链校验与 CA 信任、SNI、双向 mTLS、会话复用与 0-RTT 重放风险、前向安全、cert 轮换与常见握手失败定位。', 4, 5],
            ['s3-4', 'DNS、CDN 与负载均衡', '递归/迭代解析、记录类型与 TTL 多级缓存、GSLB 智能线路与 HTTPDNS；CDN 回源与缓存命中策略；四层 LVS/DR 与七层 Nginx、一致性哈希与会话保持、健康检查与平滑上下线。', 3, 4],
          ]},
          { id: 's4', name: '阶段四 · 网络工程与全链路综合', sections: [
            ['s4-1', 'Socket 选项、Linux 内核参数与网络调优', 'TCP_NODELAY / SO_RCVBUF/SO_SNDBUF / SO_LINGER / SO_REUSEPORT / TCP_DEFER_ACCEPT / keepalive 三参数；backlog、somaxconn、文件描述符与端口范围、conntrack 表满、BBR 与万兆网调优清单。', 4, 4],
            ['s4-2', '抓包与网络排障方法论', 'tcpdump/tshark/Wireshark 过滤器语法、ss -tin 读拥塞窗口与重传、重传/乱序/RST/零窗口的包络特征识别，以及“慢在哪一段”的四段定位法与线上定位 SOP。', 3, 4],
            ['s4-3', '从输入 URL 到页面渲染全链路', '把 DNS→TCP→TLS→LB→网关→服务→DB→缓存→回传→渲染 串成一条因果链；HTTP/2 多路复用与资源加载优先级、TTFT/LCP 指标、以及一次慢请求在该链路上如何逐层测量。', 3, 5],
          ]},
        ],
      },
      {
        id: 'netty', name: 'Netty 与 NIO', importance: 4,
        desc: 'IO 模型、NIO 三件套、Netty 核心抽象与线程模型，以及粘包、背压、百万连接调优——网关、MQ 客户端、RPC 框架共同的底座。',
        stages: [
          { id: 's1', name: '阶段一 · IO 模型演进与 Java NIO', sections: [
            ['s1-1', '五种 IO 模型与同步/异步、阻塞/非阻塞', '两类三时点坐标系分清阻塞与非阻塞、同步与异步；BIO 线程模型的成本、IO 多路复用的出现、select/poll/epoll 三者差异与 ET/LT、AIO 在 Linux 上的局限。', 3, 4],
            ['s1-2', 'Reactor 模式：从单线程到主从多 Reactor', 'Reactor 与 Proactor 的分界、单线程/线程池/主从三层模型的责任切分，Netty 与 Redis/Nginx 模型对比，以及“为什么一个 Channel 只能绑一个 EventLoop”。', 3, 4],
            ['s1-3', 'Java NIO 三大件 Channel/Buffer/Selector', 'ByteBuffer 的 position/limit/capacity 与 flip 法则、直接内存与 OOM、scatter/gather；Selector 注册与 keys 迭代陷阱；FileChannel 零拷贝 mmap/transferTo 与 Kafka 的应用。', 4, 4],
          ]},
          { id: 's2', name: '阶段二 · Netty 核心抽象', sections: [
            ['s2-1', 'EventLoop、Channel、ChannelPipeline 与 Handler', 'Netty 启动骨架与七大核心接口；Pipeline 双向链表、入站/出站传播规则、异常传播、handler 执行线程与 `@ChannelHandler.Sharable`、阻塞任务为何必须走单独线程池。', 4, 5],
            ['s2-2', 'ByteBuf、内存模型与引用计数', 'ByteBuf 对比 ByteBuffer、读写双指针、池化 PooledByteBufAllocator 与 jemalloc 分代、直接内存、`ReferenceCountUtil` 与 release 泄漏定位、`LEAK` 日志与 CompositeByteBuf 零拷贝。', 4, 4],
            ['s2-3', '编解码器与粘包/拆包治理', 'LengthFieldBasedFrameDecoder 五个参数的推导、Delimiter/LineBased/FixedLength 选型、序列化（Protobuf/JSON）与 ObjectInputValidation、`ByteToMessageDecoder` 累积与半包丢弃、HTTP 编解码器复用。', 4, 4],
          ]},
          { id: 's3', name: '阶段三 · 并发模型与生产实战', sections: [
            ['s3-1', 'EventLoop 线程模型、Future/Promise 与优雅关闭', '无锁串行化的收益与陷阱、`execute/onWorkerThread`、`EventLoopGroup` 与 `DefaultEventExecutorGroup` 分离重任务、ChannelGroup 广播、`Future.addListener` 避免阻塞、`shutdownGracefully` 与定时任务精度。', 4, 4],
            ['s3-2', '心跳、空闲检测、背压与百万连接调优', 'IdleStateHandler 与双向心跳超时设计、FlushConsolidationHandler 合批刷写、WriteBufferWaterMark 高/低水位与自动读写开关、Channel.isWritable 背压传导；文件描述符、内存、TCP 参数、SO_REUSEPORT 多进程的容量规划与指标监控。', 4, 5],
            ['s3-3', 'Netty 实战：HTTP 服务、RPC 与生态集成', '用 Netty 实现 HTTP/1.1 服务与自定义协议的完整代码走查；Spring WebFlux/Reactor Netty、Dubbo/gRPC、Elasticsearch、Kafka 客户端、RocketMQ 为何选 Netty；网关（Spring Cloud Gateway）与业务线程模型的关系。', 4, 4],
          ]},
        ],
      },
    ],
  },

  /* ============================ 二、Java 基础语言 ============================ */
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
            ['s1-4', '字符串、包装类型与对象等值契约', 'String 常量池与不可变、自动装箱缓存、equals/hashCode/Comparable 契约——HashMap 正确性的前提。', 3, 5],
          ]},
          { id: 's2', name: '阶段二 · 泛型、异常与现代语法', sections: [
            ['s2-1', '泛型与类型擦除', '通配符、PECS 原则、擦除带来的限制与工程影响。', 3, 4],
            ['s2-2', '异常体系与最佳实践', '受检与非受检的取舍，异常链、try-with-resources。', 2, 4],
            ['s2-3', 'Lambda 与 Stream API', '函数式接口、惰性求值、并行流的陷阱。', 3, 4],
            ['s2-4', '数值精度、日期时间与字符编码', 'BigDecimal 与金额精度、java.time 与时区/夏令时、UTF-8 与乱码根因——金融/电力/电商都会踩的基础坑。', 3, 5],
          ]},
          { id: 's3', name: '阶段三 · IO、反射与代理', sections: [
            ['s3-1', '文件 IO、字符流与序列化', '字节/字符流分层、装饰器模式、Serializable 的坑与替代。', 2, 3],
            ['s3-2', '反射、注解与动态代理', 'Class 元数据、注解处理器、JDK 与 CGLIB 代理对比（框架之根）。', 4, 5],
            ['s3-3', 'Optional 与语言级设计取向', '空值治理、函数式 API，理解"避免过度抽象"的分寸。', 2, 3],
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
            ['s2-1', 'Java 21 LTS：虚拟线程时代', 'Structured Concurrency、分代 ZGC，Loom 如何改写并发成本。', 4, 5],
            ['s2-2', 'Java 22-25：Loom/Panama 收口', 'FMM、外部函数与内存 API、生成式元编程预览。', 4, 4],
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
            ['s1-3', 'synchronized 锁升级', '偏向/轻量/重量级，monitor 与对象头。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · AQS 与并发工具', sections: [
            ['s2-1', 'AQS 源码剖析', 'CLH 队列、state 语义、独占与共享模式。', 5, 5],
            ['s2-2', '线程池七参数与执行流程', '核心线程、队列、拒绝策略、动态调参。', 4, 5],
            ['s2-3', '并发容器与同步器', 'ConcurrentHashMap、CountDownLatch、CyclicBarrier、Semaphore。', 4, 4],
          ]},
          { id: 's3', name: '阶段三 · 并发进阶与实战', sections: [
            ['s3-1', 'ThreadLocal 与内存泄漏', '线程局部存储结构、弱引用、线程池复用下的清理。', 4, 4],
            ['s3-2', '锁优化与无锁并发', '自旋/分段/读写锁、伪共享与 @Contended、无锁队列思想。', 5, 4],
            ['s3-3', '并发设计模式与生产者消费者模型', 'Future/CompletableFuture 编排、Actor 与 CSP 对比、背压。', 4, 5],
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
            ['s2-1', '垃圾判定与回收算法', '可达性分析、卡表、分代与 Region。', 4, 5],
            ['s2-2', 'G1 / ZGC / Shenandoah', '停顿模型、写屏障、彩色指针。', 5, 5],
            ['s2-3', '线上调优方法论', '参数、日志、Full GC 排查路径与容量规划。', 5, 5],
          ]},
          { id: 's3', name: '阶段三 · 线上排障实操', sections: [
            ['s3-1', 'OOM / CPU 飙高 / 频繁 Full GC 排查手册', '从现象到定位的完整路径：jstack、jmap、GC 日志、Arthas 联动出结论。', 5, 5],
            ['s3-2', '堆转储分析与内存泄漏定位', 'MAT 支配树、泄漏嫌疑判定、线程池/缓存/ThreadLocal 常见泄漏现场。', 4, 5],
          ]},
        ],
      },
    ],
  },

  /* ============================ 三、相关框架 ============================ */
  {
    id: 'frameworks', name: '相关框架',
    desc: 'Spring 生态与 Jakarta EE 标准，企业级应用的工程骨架。',
    packages: [
      {
        id: 'spring-boot', name: 'Spring Boot 4.1（含 2.0 / 3.0 全量）', importance: 5,
        desc: '以 Boot 4.1 为主线，回溯 2.0/3.0 的关键差异；自动配置、Starter、Actuator、原生镜像与虚拟线程实践。',
        stages: [
          { id: 's1', name: '阶段一 · 起步与容器装配', sections: [
            ['s1-1', 'Spring Boot 是什么，它解决了什么问题', '从 XML 地狱到约定优于配置；Boot 的定位、优缺点与适用规模。', 1, 5],
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
        id: 'spring-core', name: 'Spring Framework 核心（IoC 与 AOP）', importance: 5,
        desc: '容器与面向切面的底层机制，脱离 Boot 单独立起来理解 Spring 本体。',
        stages: [
          { id: 's1', name: '阶段一 · IoC 与 DI', sections: [
            ['s1-1', 'BeanFactory 与 ApplicationContext', '容器层次、BeanDefinition 元数据、初始化时机差异。', 3, 5],
            ['s1-2', '依赖注入与循环依赖', '构造/setter 注入、三级缓存解决单例循环依赖的边界。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · AOP 与事务', sections: [
            ['s2-1', 'AOP 与动态代理', 'JDK/CGLIB 代理选择、切面执行顺序、自调用失效的根源。', 4, 5],
            ['s2-2', '事务传播与失效场景', '七大传播行为、@Transactional 失效的八种典型情况。', 4, 5],
          ]},
        ],
      },
      {
        id: 'spring-mvc', name: 'Spring MVC 深入', importance: 4,
        desc: 'Web 层框架本体：请求映射、参数绑定、视图与 REST 风格设计。',
        stages: [
          { id: 's1', name: '阶段一 · 核心机制', sections: [
            ['s1-1', '请求处理链路与映射机制', 'HandlerMapping、HandlerAdapter、拦截器顺序。', 3, 4],
            ['s1-2', '参数解析与返回值处理', 'ArgumentResolver、消息转换器、@RequestBody 过程。', 3, 4],
          ]},
          { id: 's2', name: '阶段二 · 工程实践与新范式', sections: [
            ['s2-1', 'REST 设计、全局异常与统一返回', '资源建模、幂等与版本、@ControllerAdvice 与错误契约。', 3, 4],
            ['s2-2', 'WebFlux 与响应式编程', 'Reactor/背压、非阻塞链路适用边界，与虚拟线程的取舍。', 4, 3],
          ]},
        ],
      },
      {
        id: 'spring-ai', name: 'Spring AI 与大模型应用集成', importance: 3,
        desc: '2025-2026 增长最快的后端能力：模型接入、工具调用、RAG 与向量检索的工程化。',
        stages: [
          { id: 's1', name: '阶段一 · 模型接入与编排', sections: [
            ['s1-1', 'ChatClient、Prompt 模板与结构化输出', '统一模型抽象、流式响应、把 LLM 输出映射为 POJO。', 3, 4],
            ['s1-2', 'Tool/Function Calling 与 Agent 编排', '工具注册、ReAct 循环、成本与超时治理。', 4, 4],
          ]},
          { id: 's2', name: '阶段二 · 检索增强与向量存储', sections: [
            ['s2-1', 'RAG：切分、Embedding 与召回', '文档流水线、向量库选型(pgvector/Milvus)、混合检索与重排。', 4, 4],
            ['s2-2', '可观测、评估与安全防护', '调用链埋点、幻觉/回归评估、Prompt 注入与成本护栏。', 4, 3],
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

  /* ============================ 四、分布式系统 ============================ */
  {
    id: 'distributed', name: '分布式系统',
    desc: '一致性理论、共识协议、分布式事务与锁、数据分片——从单机走向规模的分水岭。',
    packages: [
      {
        id: 'dist-theory', name: '分布式系统理论', importance: 5,
        desc: 'CAP/BASE、一致性谱系、共识算法、逻辑时钟，以及分布式事务、锁、ID 的工程落地。',
        stages: [
          { id: 's1', name: '阶段一 · 一致性与共识', sections: [
            ['s1-1', 'CAP / BASE 与一致性谱系', '线性一致/顺序/因果/最终一致的取舍，为何 CAP 三选二是误导。', 4, 5],
            ['s1-2', '分布式共识：Paxos / Raft / ZAB', '多数派、选主、日志复制，注册中心为何用这些协议。', 5, 5],
            ['s1-3', '逻辑时钟、全局有序与幂等去重', 'Lamport/向量时钟、真时钟 NTP/PTP 的漂移，去重与定序。', 5, 4],
          ]},
          { id: 's2', name: '阶段二 · 分布式协调与工程', sections: [
            ['s2-1', '分布式事务模型全景', '2PC/3PC、TCC、Saga、本地消息表、事务消息的适用与代价。', 5, 5],
            ['s2-2', '分布式锁的工程与坑', 'Redis 续期/RedLock 争议、ZooKeeper 临时顺序节点、看门狗。', 4, 5],
            ['s2-3', '分布式 ID 方案与取舍', '雪花与时钟回拨、号段模式与 Leaf 双 Buffer、UUID 的定位。', 4, 5],
          ]},
        ],
      },
      {
        id: 'dist-data', name: '数据分片与分布式一致性落地', importance: 5,
        desc: '分库分表、读写分离、多活与容灾、缓存一致性——把理论落到数据层。',
        stages: [
          { id: 's1', name: '阶段一 · 数据扩展', sections: [
            ['s1-1', '分库分表与分布式主键', '水平/垂直拆分、ShardingSphere 路由、跨库查询与扩容迁移。', 5, 5],
            ['s1-2', '读写分离与复制延迟治理', '主从架构、延迟从库、强制走主与业务容忍度设计。', 4, 4],
          ]},
          { id: 's2', name: '阶段二 · 高可用与一致', sections: [
            ['s2-1', '缓存一致性与双写方案', 'Cache Aside、延迟双删、订阅 binlog（Canal）的边界。', 5, 5],
            ['s2-2', '异地多活与容灾架构', '单元化、数据就近、RPO/RTO、流量调度与脑裂防护。', 5, 5],
          ]},
        ],
      },
    ],
  },

  /* ============================ 五、架构设计与方法论 ============================ */
  {
    id: 'architecture', name: '架构设计与方法论',
    desc: '设计模式、DDD、架构风格、CAP 权衡与系统设计方案——架构师的主战场。',
    packages: [
      {
        id: 'design-patterns', name: '设计模式与重构', importance: 4,
        desc: '23 种模式在 JDK/Spring 中的真实出处，SOLID 与坏味道的识别与重构手法。',
        stages: [
          { id: 's1', name: '阶段一 · 模式精讲', sections: [
            ['s1-1', '设计原则 SOLID 与组合优于继承', '开闭/依赖倒置/里氏替换，如何指导框架与业务分层。', 3, 4],
            ['s1-2', '创建型与结构型模式', '工厂/建造者/单例（容器）、代理/装饰/适配器/桥接的实战。', 3, 4],
            ['s1-3', '行为型模式', '策略/模板方法/观察者/责任链/状态——业务去 if-else 的利器。', 3, 5],
          ]},
          { id: 's2', name: '阶段二 · 模式落地与重构', sections: [
            ['s2-1', '框架里的设计模式', 'Spring 的 IoC/AOP/Mvc、JDK IO、MyBatis 插件中的模式溯源。', 4, 4],
            ['s2-2', '过度设计与反模式、重构手法', '识别模式滥用，用重构而非套路透化坏味道。', 4, 3],
          ]},
        ],
      },
      {
        id: 'ddd-architecture', name: 'DDD 与架构方法论', importance: 5,
        desc: '战略/战术建模、分层与六边形架构、从单体到分布式的演进与权衡。',
        stages: [
          { id: 's1', name: '阶段一 · 领域驱动设计', sections: [
            ['s1-1', '战略设计：统一语言与限界上下文', '子域划分、上下文映射，把业务边界对齐系统边界。', 4, 5],
            ['s1-2', '战术设计：聚合、实体、值对象与领域事件', '不变式守卫、聚合根、事件驱动解耦建模。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · 架构风格与演进', sections: [
            ['s2-1', '分层、六边形与整洁架构', '依赖方向向内、端口适配器，业务与技术解耦。', 4, 5],
            ['s2-2', '单体 / SOA / 微服务 / Serverless 权衡', '没有银弹：按团队与业务阶段选架构，警惕过早微服务化。', 5, 5],
            ['s2-3', 'CQRS、事件溯源与架构决策 ADR', '读写模型分离、事件即真相，用 ADR 记录权衡可追溯。', 5, 4],
          ]},
        ],
      },
      {
        id: 'system-design', name: '系统设计与场景题', importance: 5,
        desc: '大规模系统设计方法论 + 高频场景面经，把前面所有技术串成方案。',
        stages: [
          { id: 's1', name: '阶段一 · 设计方法论与估算', sections: [
            ['s1-1', '系统设计答题框架', '需求澄清→容量估算→API/数据模型→高层设计→深挖→权衡。', 4, 5],
            ['s1-2', '容量估算与瓶颈识别', 'QPS/存储/带宽推导，读写比与热点，从估算到选型。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · 高并发电商与内容场景', sections: [
            ['s2-1', '秒杀 / 短链 / Feed 流', '超卖防护、发号与跳转、推拉结合与热 Key 治理。', 5, 5],
            ['s2-2', '限流器 / 排行榜 / 附近的人', '令牌桶与滑动窗口、ZSet、GeoHash 与倒排块。', 5, 5],
          ]},
          { id: 's3', name: '阶段三 · 基础设施与行业架构', sections: [
            ['s3-1', '分布式消息 / 缓存 / ID 生成器设计', '从 0 设计一个高可靠组件，覆盖一致性与扩容。', 5, 4],
            ['s3-2', 'API 网关 / Web 爬虫 / 支付对账系统', '路由鉴权限流、抓取调度去重、金融级对账与资损防控。', 5, 5],
          ]},
        ],
      },
    ],
  },

  /* ============================ 六、数据库与缓存 ============================ */
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
          { id: 's3', name: '阶段三 · 日志、备份与高可用', sections: [
            ['s3-1', 'binlog、redo、undo 与两阶段提交', '刷盘参数、崩溃恢复，为什么需要两阶段提交。', 4, 5],
            ['s3-2', '主从复制、高可用与冷热备份', '异步/半同步/GTID、MHA/MGR，备份恢复与数据校验。', 4, 5],
            ['s3-3', '慢查询治理与 SQL 优化实战', '慢日志、执行计划调优、索引失效场景、深分页与大批量写的优化套路。', 4, 5],
          ]},
        ],
      },
      { id: 'postgresql', name: 'PostgreSQL', importance: 4,
        desc: '多版本存储、扩展生态（PostGIS/pgvector）、与 MySQL 的选型差异。',
        stages: [ { id: 's1', name: '阶段一 · 内核特性', sections: [
          ['s1-1', 'MVCC 与 VACUUM 机制', '事务快照、膨胀与回收、autovacuum 调参。', 4, 4],
          ['s1-2', '扩展生态与选型（PostGIS/pgvector）', '向量检索、地理数据，何时 PG 优于 MySQL。', 3, 3],
        ]} ] },
      { id: 'tidb', name: 'TiDB 分布式数据库', importance: 3,
        desc: 'HTAP 架构、Region 分裂、SQL 调优与迁移场景。',
        stages: [ { id: 's1', name: '阶段一 · 架构与选型', sections: [
          ['s1-1', 'TiDB 计算存储分离架构', 'PD、TiKV、TiFlash 与一致性调度。', 4, 3],
          ['s1-2', '在线扩缩容与迁移、HTAP 取舍', 'Region 分裂、DDL 在线变更、与传统分库分表对比。', 4, 3],
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
            ['s2-3', '大 Key、热 Key 与内存治理', '发现与拆分、读写分离、淘汰策略与内存碎片。', 4, 5],
          ]},
        ],
      },
      { id: 'lettuce', name: 'Lettuce', importance: 4,
        desc: '基于 Netty 的线程安全 Redis 客户端：单连接多线程共享、异步/响应式 API、连接池与 Cluster/Sentinel 支持。',
        stages: [ { id: 's1', name: '阶段一 · 客户端原理与选型', sections: [
          ['s1-1', 'Lettuce 架构与 Jedis 的本质差异', 'Netty 异步非阻塞、单连接多线程安全共享、连接模型与线程安全对比。', 3, 4],
          ['s1-2', '连接池、Cluster/Sentinel 与异步/响应式 API', 'commons-pool2 池化、RedisClusterClient、Pub/Sub、Reactive API。', 3, 4],
          ['s1-3', 'Lettuce 与 Redisson 的定位与选型（关联）', '纯客户端 vs 分布式对象框架，能否共用底层连接。', 3, 3],
        ]} ] },
      { id: 'redisson', name: 'Redisson', importance: 5,
        desc: 'Redis 上的分布式对象框架：可重入锁与看门狗、RedLock 争议、读写锁/信号量、布隆过滤器与限流器。',
        stages: [ { id: 's1', name: '阶段一 · 分布式锁与高级对象', sections: [
          ['s1-1', 'RLock 可重入锁与看门狗续期', '哈希结构、Lua 原子性、watchdog 自动续期与释放。', 4, 5],
          ['s1-2', 'RedLock 争议与读写锁/信号量/闭锁', '多节点红锁的时钟漂移质疑、公平锁、RLock 之外的同步器。', 5, 5],
          ['s1-3', '布隆过滤器、限流器与 RMapCache', 'RBloomFilter、RRateLimiter、本地缓存 + 失效广播。', 4, 4],
          ['s1-4', '与 Lettuce 协同及分布式锁落地边界（关联）', 'Netty 底层、Spring Boot 整合、锁粒度与降级。', 4, 4],
        ]} ] },
      { id: 'caffeine', name: 'Caffeine 本地缓存', importance: 3,
        desc: 'W-TinyLFU 淘汰算法、异步加载、与 Redis 构成的多级缓存。',
        stages: [ { id: 's1', name: '阶段一 · 本地缓存与多级缓存', sections: [
          ['s1-1', 'W-TinyLFU 与失效策略', '窗口区/主区、expireAfterAccess、加载器。', 4, 3],
          ['s1-2', '多级缓存与一致性广播', '本地+Redis 组合、失效消息、命中率与容量权衡。', 4, 4],
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

  /* ============================ 七、持久层与连接池 ============================ */
  {
    id: 'persistence', name: '持久层与连接池',
    desc: 'SQL 到对象的映射层，以及数据库连接的池化管理。',
    packages: [
      { id: 'mybatis', name: 'MyBatis / MyBatis-Plus', importance: 5,
        desc: '映射器代理、动态 SQL、插件链、Plus 的条件构造器与代码生成。',
        stages: [ { id: 's1', name: '阶段一 · 核心原理', sections: [
          ['s1-1', 'MyBatis 执行流程与一级二级缓存', 'SqlSession、Executor、缓存边界与失效。', 4, 5],
          ['s1-2', '动态 SQL、resultMap 与插件原理', '<if>/<foreach>、拦截器责任链实现分页与多租户。', 3, 4],
          ['s1-3', 'MyBatis-Plus 工程提效', 'BaseMapper、Wrapper、分页插件、乐观锁插件。', 2, 4],
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

  /* ============================ 八、中间件 ============================ */
  {
    id: 'middleware', name: '中间件',
    desc: '消息与事件驱动：解耦、削峰、最终一致性的承载体。',
    packages: [
      { id: 'rocketmq', name: 'RocketMQ', importance: 4,
        desc: '事务消息、顺序消息、消息回溯，国内电商主力消息中间件。',
        stages: [ { id: 's1', name: '阶段一 · 架构与可靠性', sections: [
          ['s1-1', 'RocketMQ 架构与存储模型', 'CommitLog、ConsumeQueue、主从与 Dledger。', 4, 4],
          ['s1-2', '事务消息与最终一致性', '半消息、回查机制、订单场景应用。', 4, 5],
          ['s1-3', '顺序、幂等、堆积与重试死信', '全局/分区顺序、消费幂等、堆积处理与 DLQ 设计。', 4, 5],
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
          ['s1-2', '消费组与再平衡', 'Cooperative 重平衡、位移提交、精确一次。', 4, 4],
        ]} ] },
      { id: 'job-scheduling', name: '分布式任务调度', importance: 4,
        desc: 'Quartz → XXL-Job/ElasticJob：定时触发的演进、分片、幂等与失败补偿，电商对账/电力采集/金融日切都离不开。',
        stages: [ { id: 's1', name: '阶段一 · 调度架构与实战', sections: [
          ['s1-1', '定时任务的演进与分布式调度架构', '单机 Timer/Quartz 的问题，中心化调度 vs 去中心化，XXL-Job 执行器模型。', 3, 4],
          ['s1-2', '分片、幂等与失败补偿', '任务分片并行、重复触发防护、失败重试与告警、对账/日切场景落地。', 4, 4],
        ]} ] },
    ],
  },

  /* ============================ 九、微服务治理 ============================ */
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
          ['s1-2', '网关限流、熔断与统一认证', 'RequestRateLimiter、与 Sentinel/OAuth2 集成的入口方案。', 4, 4],
        ]} ] },
      { id: 'openfeign', name: 'OpenFeign 与 LoadBalancer', importance: 3,
        desc: '声明式调用、超时重试、客户端负载均衡策略。',
        stages: [ { id: 's1', name: '阶段一 · 远程调用', sections: [
          ['s1-1', 'Feign 调用链与超时重试陷阱', '连接池、Retryer、Ribbon 到 LoadBalancer。', 3, 4],
        ]} ] },
      { id: 'sentinel', name: 'Sentinel 流量治理', importance: 4,
        desc: '流控算法、熔断降级、热点参数与集群限流。',
        stages: [ { id: 's1', name: '阶段一 · 稳定性防护', sections: [
          ['s1-1', '滑动窗口与流控效果', '直接/关联/链路，排队与预热模式。', 4, 5],
          ['s1-2', '熔断降级与系统自适应保护', '慢调用/异常比、Load 保护与规则持久化。', 4, 5],
        ]} ] },
      { id: 'seata', name: 'Seata 分布式事务', importance: 4,
        desc: 'AT/TCC/Saga/XA 四模式，全局锁与补偿机制。',
        stages: [ { id: 's1', name: '阶段一 · 事务模式', sections: [
          ['s1-1', 'AT 模式与全局锁', 'undo_log、脏写防护、与本地事务边界。', 5, 5],
          ['s1-2', 'TCC / Saga / XA 与模式选型', '强一致到最终一致的梯度，各模式的适用业务与代价。', 5, 4],
        ]} ] },
      { id: 'rpc', name: 'RPC 与跨语言序列化', importance: 4,
        desc: 'gRPC/Dubbo 调用链，Protobuf/Hessian 序列化与接口兼容演进。',
        stages: [ { id: 's1', name: '阶段一 · 调用与协议', sections: [
          ['s1-1', 'RPC 原理与 Dubbo 架构', '服务暴露/引用、SPI 扩展、负载均衡与集群容错。', 4, 5],
          ['s1-2', 'gRPC、Protobuf 与序列化兼容', 'IDL 契约、字段兼容、跨语言与流式调用。', 4, 4],
        ]} ] },
      { id: 'opentelemetry', name: 'OpenTelemetry', importance: 4,
        desc: 'Trace/Metric/Log 统一采集标准：API/SDK/Collector 与 OTLP、语义约定、上下文传播与 Java Agent 无侵入埋点。',
        stages: [ { id: 's1', name: '阶段一 · 采集标准与埋点', sections: [
          ['s1-1', 'OTel 架构：API/SDK/Collector 与 OTLP', '三支柱数据模型、Collector pipeline、导出到任意后端。', 4, 4],
          ['s1-2', 'Trace 传播与语义约定', 'W3C traceparent、Span/Attribute 规范、跨进程上下文传播。', 4, 4],
          ['s1-3', 'Java Agent 无侵入埋点与采样', '字节码增强、头/尾部采样、与 Spring Boot 集成。', 4, 4],
          ['s1-4', '与 SkyWalking/Prometheus 的关系（关联）', '标准 vs 产品、迁移与共存。', 3, 3],
        ]} ] },
      { id: 'prometheus', name: 'Prometheus', importance: 4,
        desc: '指标采集与查询：数据模型与四种指标类型、PromQL、服务发现、Exporter 与 Alertmanager 告警。',
        stages: [ { id: 's1', name: '阶段一 · 指标体系与查询', sections: [
          ['s1-1', '数据模型与四种指标类型', 'Counter/Gauge/Histogram/Summary、标签维度、pull 拉取模型。', 3, 4],
          ['s1-2', 'PromQL 与直方图分位计算', 'rate/irate、histogram_quantile、P99 与埋点选型。', 4, 4],
          ['s1-3', '服务发现、Exporter 与长期存储', 'SD 机制、常用 exporter、远端存储/Thanos 与高可用。', 4, 4],
          ['s1-4', 'Alertmanager 告警与 Grafana 看板（关联）', '分组抑制、路由，与 Grafana 可视化协同。', 3, 4],
        ]} ] },
      { id: 'grafana', name: 'Grafana', importance: 3,
        desc: '多源统一可视化与告警：数据源、面板/变量、Dashboard as Code，联动 Prometheus/Loki/ES。',
        stages: [ { id: 's1', name: '阶段一 · 看板与告警', sections: [
          ['s1-1', '数据源与面板/查询编辑', '混合数据源、变量与模板、常用可视化。', 2, 3],
          ['s1-2', 'Dashboard as Code、告警与权限', 'JSON/Provisioning、统一告警规则、组织与权限。', 3, 3],
        ]} ] },
      { id: 'skywalking', name: 'SkyWalking', importance: 3,
        desc: '国产开源 APM：链路追踪、服务拓扑、指标与分析，Agent 采集与后端存储。',
        stages: [ { id: 's1', name: '阶段一 · APM 与链路', sections: [
          ['s1-1', 'SkyWalking 架构与探针原理', 'Agent/Collector/UI、字节码增强、Segment/Span 模型。', 4, 3],
          ['s1-2', '服务拓扑、指标与分析、告警', '自动拓扑、服务/实例/端点三级指标、LAL 与告警。', 4, 3],
          ['s1-3', '与 OpenTelemetry 集成及选型（关联）', 'OTel 接入、与自建 APM 的取舍。', 3, 3],
        ]} ] },
      { id: 'istio', name: 'Istio', importance: 3,
        desc: '主流服务网格：Envoy Sidecar 数据面、Istiod 控制面、流量治理、mTLS 与可观测。',
        stages: [ { id: 's1', name: '阶段一 · 网格与流量治理', sections: [
          ['s1-1', '控制面/数据面与 Sidecar 注入', 'Envoy、Istiod、自动注入与拦截机制。', 4, 3],
          ['s1-2', 'VirtualService/DestinationRule 流量切分', '按权重/头路由、金丝雀、熔断与重试。', 4, 3],
          ['s1-3', 'mTLS、可观测与 Ambient 演进', 'PeerAuthentication、网格遥测、去 Sidecar 的 Ambient 模式。', 4, 3],
          ['s1-4', '网格的延迟/资源成本与何时不用（关联）', 'Sidecar 开销、复杂度，与 Linkerd 对比。', 4, 3],
        ]} ] },
      { id: 'linkerd', name: 'Linkerd', importance: 2,
        desc: '轻量服务网格：Rust 代理、极简控制面、L4 mTLS 与低资源占用，与 Istio 的定位差异。',
        stages: [ { id: 's1', name: '阶段一 · 轻量网格', sections: [
          ['s1-1', 'Linkerd 架构与极简数据面', 'linkerd2-proxy、控制面组件、与 Envoy 的差异。', 4, 2],
          ['s1-2', '能力边界与 Istio 选型（关联）', 'L4/L7 mTLS、重试/超时、金丝雀，何时选轻不选全。', 4, 2],
        ]} ] },
      { id: 'shardingsphere', name: 'ShardingSphere 分库分表', importance: 4,
        desc: '分片路由、读写分离、分布式主键与数据迁移（与 dist-data 互补：此为组件实战）。',
        stages: [ { id: 's1', name: '阶段一 · 数据分片', sections: [
          ['s1-1', '分片算法与跨库查询改写', '标准/复合/Hint 分片，归并引擎。', 5, 5],
          ['s1-2', '分布式主键、读写分离与弹性迁移', '雪花/UUID 主键、影子库压测与在线扩容迁移。', 5, 4],
        ]} ] },
    ],
  },

  /* ============================ 十、构建、运维与云原生 ============================ */
  {
    id: 'devops', name: '构建、运维与 CI/CD',
    desc: '代码到线上的一条流水线，以及可观测与回滚能力。',
    packages: [
      { id: 'maven', name: 'Maven', importance: 5,
        desc: '事实标准构建工具：POM 坐标与依赖调解、继承与聚合多模块、生命周期与插件、私服与 BOM。',
        stages: [
          { id: 's1', name: '阶段一 · 依赖与工程结构', sections: [
            ['s1-1', 'POM 坐标、依赖范围与冲突调解', 'GAV、scope、最近优先/最短路径、exclusion、dependencyManagement。', 3, 5],
            ['s1-2', '继承、聚合与多模块、BOM', 'parent/BOM、modules、版本统一与依赖管理。', 3, 5],
          ]},
          { id: 's2', name: '阶段二 · 构建机制与私服', sections: [
            ['s2-1', '生命周期、插件与打包', 'clean/default/site 三生命周期、插件绑定、fat-jar 与 shaded。', 3, 4],
            ['s2-2', '私服 Nexus、mirror 与 settings.xml', 'deploy/release vs snapshot、镜像加速、依赖缓存。', 3, 4],
            ['s2-3', 'Maven vs Gradle 选型与迁移（关联）', '声明式 XML vs 命令式 DSL，何时切换。', 3, 3],
          ]},
        ] },
      { id: 'gradle', name: 'Gradle', importance: 4,
        desc: '高性能构建工具：DSL、配置期/执行期、任务与依赖、增量与构建缓存、多项目与性能调优。',
        stages: [ { id: 's1', name: '阶段一 · DSL 与构建性能', sections: [
          ['s1-1', 'build.gradle、settings 与 Groovy/Kotlin DSL', '配置期 vs 执行期、task 图、与 Maven 声明式差异。', 3, 4],
          ['s1-2', '依赖声明与冲突解决', 'configuration、transitive、constraints/BOM、implementation vs api。', 3, 4],
          ['s1-3', '增量构建、构建缓存与 Daemon 提速', 'up-to-date 检查、build cache、配置缓存、并行。', 4, 4],
          ['s1-4', '与 Maven 互操作及选型（关联）', '迁移、发布到 Maven 仓库、何时用 Gradle。', 3, 3],
        ]} ] },
      { id: 'docker', name: 'Docker 与容器技术', importance: 5,
        desc: '容器化基础：Namespace/CGroup/UnionFS 原理、镜像分层与 Dockerfile、JVM 容器感知、网络存储与 Compose。',
        stages: [
          { id: 's1', name: '阶段一 · 容器与镜像原理', sections: [
            ['s1-1', '容器 vs 虚拟机与底层隔离', 'Namespace、CGroup、UnionFS、镜像分层与写时复制。', 3, 5],
            ['s1-2', 'Dockerfile 与 Java 镜像优化', '多阶段构建、JLink、Spring Boot 分层 jar、镜像瘦身。', 3, 5],
            ['s1-3', 'JVM 的容器资源感知', 'cgroup 内存/CPU limit、MaxRAMPercentage、GC 线程数与 OOMKilled。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · 网络、存储与编排入门', sections: [
            ['s2-1', '网络模型与容器互联', 'bridge/host/overlay、端口映射、DNS 与服务发现。', 3, 4],
            ['s2-2', '卷、镜像仓库与 Compose', 'bind/volume/tmpfs、registry 推送、Docker Compose 本地多容器。', 3, 4],
            ['s2-3', '镜像安全与最佳实践', '非 root、最小基镜像、trivy 扫描、构建缓存治理。', 3, 4],
          ]},
        ] },
      { id: 'kubernetes', name: 'Kubernetes', importance: 5,
        desc: '容器编排事实标准：Pod 生命周期、Deployment 滚动发布、探针与优雅停机、Service/Ingress、配置存储、HPA 与调度。',
        stages: [
          { id: 's1', name: '阶段一 · 核心对象与发布', sections: [
            ['s1-1', '架构、控制平面与 Pod 生命周期', 'API Server/etcd/scheduler/kubelet、Pod/容器探针阶段。', 3, 5],
            ['s1-2', 'Deployment、ReplicaSet 与滚动发布回滚', '声明式、maxSurge/maxUnavailable、金丝雀与蓝绿。', 4, 5],
            ['s1-3', '探针与优雅停机', 'liveness/readiness/startup、preStop、连接排空与零停机发布。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · 网络、配置与存储', sections: [
            ['s2-1', 'Service 四种类型、Ingress 与 DNS', 'ClusterIP/NodePort/LB/Headless、七层入口、网络策略。', 4, 5],
            ['s2-2', 'ConfigMap/Secret 与 PV/PVC/CSI', '配置注入、密钥、存储抽象与动态供给。', 3, 4],
          ]},
          { id: 's3', name: '阶段三 · 弹性与调度治理', sections: [
            ['s3-1', 'HPA/VPA 与资源 request/limit、QoS', '弹性伸缩指标、Guaranteed/Burstable/BestEffort、驱逐。', 4, 5],
            ['s3-2', '调度、亲和/污点与命名空间/RBAC', 'nodeSelector、反亲和、污点容忍、多租户与权限。', 4, 4],
          ]},
        ] },
      { id: 'gitlab-ci', name: 'GitLab CI', importance: 3,
        desc: 'GitLab 内置 CI：.gitlab-ci.yml 流水线、Stage/Job、Runner、缓存/制品与环境晋级。',
        stages: [ { id: 's1', name: '阶段一 · 流水线设计', sections: [
          ['s1-1', '流水线模型：Stage/Job/Script 与 Runner', '自动/手动、needs DAG、Shell/Docker executor。', 3, 3],
          ['s1-2', '缓存、制品与 K8s 部署集成', 'cache vs artifacts、镜像构建、helm/kubectl 发布。', 3, 3],
          ['s1-3', '与 GitHub Actions 的取舍（关联）', '自建 vs 托管、生态与成本。', 2, 2],
        ]} ] },
      { id: 'github-actions', name: 'GitHub Actions', importance: 3,
        desc: 'GitHub 生态 CI/CD：Workflow/Job/Step、触发器、Runner、Action 复用与密钥管理。',
        stages: [ { id: 's1', name: '阶段一 · 工作流与复用', sections: [
          ['s1-1', 'Workflow 语法、触发器与 Runner', 'on 事件、matrix、hosted/self-hosted runner。', 3, 3],
          ['s1-2', 'Action 复用、Marketplace 与密钥', '组合式/JS Action、secrets、缓存与制品。', 3, 3],
          ['s1-3', '与 GitLab CI 的取舍（关联）', '开源免费额度、生态集成、自建合规。', 2, 2],
        ]} ] },
      { id: 'argocd', name: 'Argo CD', importance: 3,
        desc: 'GitOps 持续部署：声明式同步、App of Apps、镜像自动升级与回滚。',
        stages: [ { id: 's1', name: '阶段一 · GitOps 声明式发布', sections: [
          ['s1-1', 'GitOps 原理与 Argo CD 架构', '拉模型、Application CRD、同步状态与漂移检测。', 3, 3],
          ['s1-2', 'App of Apps、镜像升级与自动回滚', '应用编排、Image Updater 与 CI 衔接、健康评估。', 3, 3],
          ['s1-3', '与 Flux 及推拉模型对比（关联）', 'CD 工具选型、与流水线边界。', 3, 2],
        ]} ] },
      { id: 'elk', name: 'ELK（Elasticsearch 日志栈）', importance: 3,
        desc: '全文检索日志方案：Beats/Logstash 采集、ES 索引与 ILM、Kibana 可视化与成本取舍。',
        stages: [ { id: 's1', name: '阶段一 · 日志采集与检索', sections: [
          ['s1-1', 'ELK 组件与数据流', 'Filebeat/Logstash/ES/Kibana 职责与 pipeline。', 3, 3],
          ['s1-2', '索引生命周期 ILM 与冷热架构', 'rollover、热温冷、分片与成本。', 3, 3],
          ['s1-3', 'ELK vs Loki：全文索引取舍（关联）', '倒排全文 vs 标签索引，查询能力与成本对比。', 3, 3],
        ]} ] },
      { id: 'loki', name: 'Loki', importance: 3,
        desc: '低成本日志聚合：只索引标签、对象存储后端、Promtail/Alloy 采集与 LogQL 查询。',
        stages: [ { id: 's1', name: '阶段一 · 标签索引与查询', sections: [
          ['s1-1', 'Loki 架构与标签模型', 'Ingester/Querier/Store、对象存储、只索引 label。', 3, 3],
          ['s1-2', 'LogQL 与 Grafana 集成', '流/范围查询、派生标签、与 Prometheus 标签对齐。', 3, 3],
          ['s1-3', '与 ELK 选型对比（关联）', '成本敏感、日志为主的场景取舍。', 3, 3],
        ]} ] },
      { id: 'linux-shell', name: 'Linux 与 Shell（工程师基本功）', importance: 3,
        desc: '常用命令、性能四件套、日志定位脚本、网络与权限排查。',
        stages: [ { id: 's1', name: '阶段一 · 线上排查基本功', sections: [
          ['s1-1', '进程/内存/CPU/IO 四件套与 Top/vmstat', '快速定位 CPU 飙高、内存泄漏、IO 打满。', 3, 4],
          ['s1-2', '网络、磁盘与日志定位脚本', 'ss/netstat、iostat、awk/grep 组合的一行式排障。', 3, 4],
        ]} ] },
    ],
  },

  /* ============================ 十一、测试 ============================ */
  {
    id: 'testing', name: '测试',
    desc: '从单元到混沌：可交付系统的信心来自验证的密度。',
    packages: [
      { id: 'junit', name: 'JUnit 5', importance: 4,
        desc: 'Java 单元测试事实标准：Jupiter 架构、生命周期、断言聚合、参数化/动态测试与扩展模型。',
        stages: [ { id: 's1', name: '阶段一 · 测试框架', sections: [
          ['s1-1', 'JUnit 5 架构、生命周期与断言', 'Platform/Jupiter、@BeforeAll 到 @Nested、assertAll。', 2, 4],
          ['s1-2', '参数化、动态与重复测试', '@ParameterizedTest 各 ValueSource、@MethodSource、@DynamicTest。', 2, 4],
          ['s1-3', '扩展模型与条件执行', 'Extension API、@EnabledOnOs、回调与测试报告。', 3, 3],
          ['s1-4', '与 Mockito/Testcontainers/Spring Boot Test 协同（关联）', '组合使用与职责边界。', 3, 3],
        ]} ] },
      { id: 'mockito', name: 'Mockito', importance: 4,
        desc: 'Mock 框架：Mock/Spy/Stub、打桩与验证、注解注入、ArgumentCaptor、strictness 与过度 Mock 反模式。',
        stages: [ { id: 's1', name: '阶段一 · 测试替身', sections: [
          ['s1-1', 'Mock/Spy/Stub 与 when/verify', '打桩、行为验证、参数匹配器、UnnecessaryStubbing。', 2, 4],
          ['s1-2', '注解注入、ArgumentCaptor 与深度 Stub', '@Mock/@InjectMocks、捕获入参、链式返回。', 3, 4],
          ['s1-3', '静态/final Mock、strictness 与过度 Mock', 'mockStatic、MockMaker、避免测试实现细节。', 4, 4],
          ['s1-4', 'Spring Boot 切片测试（关联 JUnit）', '@WebMvcTest/@DataJpaTest、@MockitoBean、Mock 边界。', 3, 4],
        ]} ] },
      { id: 'test-containers', name: 'Testcontainers 与集成测试', importance: 3,
        desc: '用真实 DB/中间件容器做可重复的端到端集成测试。',
        stages: [ { id: 's1', name: '阶段一 · 依赖真实化', sections: [
          ['s1-1', '用容器替代内存桩与数据准备', 'MySQL/Redis/Kafka 容器、@Container 复用、迁移脚本。', 3, 3],
        ]} ] },
      { id: 'jmeter', name: 'JMeter', importance: 3,
        desc: '图形化压测工具：线程组/取样器/断言/监听器、参数化、分布式压测与指标解读。',
        stages: [ { id: 's1', name: '阶段一 · 压测模型与指标', sections: [
          ['s1-1', '组件模型与非 GUI 执行', '线程组、HTTP 取样器、CSV 参数化、断言、聚合报告。', 2, 3],
          ['s1-2', '并发模型、思考时间与 TPS/RT 解读', '集合点、吞吐量整形、P99、瓶颈定位。', 3, 4],
          ['s1-3', '与 Gatling 选型对比（关联）', '录制回放 vs 代码化、协程吞吐。', 2, 3],
        ]} ] },
      { id: 'gatling', name: 'Gatling', importance: 3,
        desc: '代码化高性能压测：DSL 场景编排、异步非阻塞高并发、断言与 HTML 报告。',
        stages: [ { id: 's1', name: '阶段一 · 场景与报告', sections: [
          ['s1-1', 'Gatling DSL 与场景编排', 'injectOpen/AtOnce、feeders、协议与断言。', 3, 3],
          ['s1-2', '异步模型、指标与容量结论', '协程高并发、SLA 断言、报告解读。', 3, 4],
          ['s1-3', '与 JMeter 选型对比（关联）', '脚本可维护、版本控制、与团队现有工具链匹配。', 2, 3],
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

  /* ============================ 十二、性能调优工具 ============================ */
  {
    id: 'tuning', name: '性能调优工具',
    desc: '定位问题的手术刀：线上不停机观测、火焰图与对象内存布局。',
    packages: [
      { id: 'arthas', name: 'Arthas 在线诊断', importance: 4,
        desc: 'trace/watch/jad/profiler，无侵入定位慢调用与类冲突。',
        stages: [ { id: 's1', name: '阶段一 · 线上诊断实战', sections: [
          ['s1-1', '方法级观测与调用链耗时', 'trace 条件表达式、watch 输出、类加载器排查。', 3, 5],
          ['s1-2', '热更新、反编译与线上排查', 'jad/sc/retransform、线程死锁与 CPU 高定位。', 4, 4],
        ]} ] },
      { id: 'async-profiler', name: 'Async-Profiler 火焰图', importance: 4,
        desc: '安全点采样、CPU/alloc/lock 模式、火焰图解读。',
        stages: [ { id: 's1', name: '阶段一 · 采样与解读', sections: [
          ['s1-1', '火焰图怎么看与常见瓶颈', '宽平顶、GC 线程、native 栈。', 4, 5],
        ]} ] },
      { id: 'jol', name: 'JOL 对象内存布局', importance: 3,
        desc: '字段重排、压缩指针、缓存行填充的量化验证。',
        stages: [ { id: 's1', name: '阶段一 · 对象尺寸测量', sections: [
          ['s1-1', '对象头、对齐与伪共享', 'javap 输出解读、@Contended 收益。', 4, 3],
        ]} ] },
    ],
  },

  /* ============================ 十三、安全 ============================ */
  {
    id: 'security', name: '安全',
    desc: '认证授权、令牌体系与注入类攻击的系统性防御。',
    packages: [
      { id: 'spring-security', name: 'Spring Security', importance: 4,
        desc: '过滤器链、认证模型、授权表达式与方法级安全。',
        stages: [ { id: 's1', name: '阶段一 · 过滤器链与授权', sections: [
          ['s1-1', '安全过滤器链执行顺序', 'SecurityContext、认证入口、异常翻译。', 4, 5],
          ['s1-2', '认证授权模型与权限设计', 'Authentication/GrantedAuthority、RBAC/ABAC/数据权限。', 4, 5],
        ]} ] },
      { id: 'shiro', name: 'Shiro', importance: 2,
        desc: 'Subject/Realm 模型，与 Security 的选型边界。',
        stages: [ { id: 's1', name: '阶段一 · 权限模型', sections: [
          ['s1-1', 'Realm 与权限粒度设计', '角色/权限字符串、缓存与会话。', 3, 2],
        ]} ] },
      { id: 'oauth2', name: 'OAuth 2.0 / OIDC', importance: 4,
        desc: '授权框架：核心角色与四种授权模式、授权码 + PKCE、scope、OIDC 与 SSO 落地。',
        stages: [ { id: 's1', name: '阶段一 · 协议与授权模式', sections: [
          ['s1-1', '核心角色与四种授权模式', '授权码/隐式/密码/客户端凭证的适用与废弃。', 3, 5],
          ['s1-2', '授权码 + PKCE、scope 与令牌存储', 'redirect_uri 校验、state 防 CSRF、refresh token 轮换。', 4, 5],
          ['s1-3', 'OIDC、SSO 与令牌关系（关联 JWT）', 'id_token、单点登录/登出，与 JWT 结构配合。', 4, 4],
        ]} ] },
      { id: 'jwt', name: 'JWT', importance: 4,
        desc: '自包含令牌：三段结构与签名验证、Claims、过期与刷新、吊销与无状态登出难题。',
        stages: [ { id: 's1', name: '阶段一 · 令牌结构与验证', sections: [
          ['s1-1', 'JWT 结构与签名验证', 'Header/Payload/Signature、HS256/RS256、验签与过期。', 3, 5],
          ['s1-2', 'Claims、刷新与算法攻击防护', '标准 claim、alg=none/混淆、密钥管理与 kid。', 4, 5],
          ['s1-3', '无状态登出、吊销与与 OAuth2 协同（关联）', '黑名单/短令牌、旋转，与授权码模式配合。', 4, 4],
        ]} ] },
      { id: 'web-defense', name: 'SQL 注入与 XSS 防御（必备模块）', importance: 5,
        desc: '预编译本质、参数校验、输出编码、CSP 与 CSRF。',
        stages: [ { id: 's1', name: '阶段一 · 攻防基础', sections: [
          ['s1-1', '注入原理与预处理防御', 'MyBatis ${} 与 #{}、动态表名白名单。', 3, 5],
          ['s1-2', 'XSS / CSRF 与 CSP', '反射/存储型、SameSite、转义与策略头。', 3, 5],
          ['s1-3', '反序列化、越权与业务逻辑漏洞', '反序列化攻击面、水平/垂直越权校验、支付/库存等业务分支被薅的防线。', 4, 5],
        ]} ] },
      { id: 'data-security', name: '数据加密与接口签名', importance: 4,
        desc: '传输/存储加密、脱敏、密钥管理 KMS、金融级防重放签名。',
        stages: [ { id: 's1', name: '阶段一 · 加密与签名体系', sections: [
          ['s1-1', '对称/非对称/哈希与密码存储', 'AES/RSA/BCrypt、国密 SM、脱敏与字段加密。', 4, 5],
          ['s1-2', '接口签名、防重放与 KMS', '签名串规范、时间戳+nonce、密钥轮转与托管。', 4, 5],
        ]} ] },
    ],
  },

  /* ============================ 十四、其他补充 ============================ */
  {
    id: 'extras', name: '其他补充',
    desc: '搜索与持久化工作流，跨越单体到分布式的能力补位。',
    packages: [
      { id: 'elasticsearch', name: 'Elasticsearch', importance: 4,
        desc: '倒排索引、分词、写入近实时、聚合与深分页方案。',
        stages: [ { id: 's1', name: '阶段一 · 检索原理', sections: [
          ['s1-1', '倒排索引与分词器链路', 'mapping、analysis、相关度打分。', 4, 4],
          ['s1-2', '写入流程与近实时可见', 'translog、refresh、段合并。', 4, 4],
          ['s1-3', '聚合、深分页与集群容量规划', 'terms 聚合、search_after 与 scroll、分片与冷热架构。', 4, 4],
        ]} ] },
      { id: 'temporal', name: 'Temporal 持久化工作流', importance: 3,
        desc: '确定性执行、重放机制、Saga 的工程化替代。',
        stages: [ { id: 's1', name: '阶段一 · 工作流引擎', sections: [
          ['s1-1', 'Workflow/Activity 与重放', '确定性约束、重试策略、版本升级。', 5, 3],
        ]} ] },
      { id: 'flink', name: 'Flink 流处理', importance: 4,
        desc: '有状态流计算引擎：事件时间与水位线、窗口、状态后端、exactly-once 与 CDC/数据管道。',
        stages: [ { id: 's1', name: '阶段一 · 流处理核心', sections: [
          ['s1-1', '流处理模型、窗口与事件时间', '算子 DAG、KeyedStream、窗口类型、乱序处理。', 4, 4],
          ['s1-2', '水位线、状态后端与 exactly-once', 'Watermark、RocksDB、Checkpoint 与两阶段提交。', 4, 4],
          ['s1-3', 'CDC、数据管道与流批一体', 'Flink CDC 采集 binlog、Kafka 中转、湖仓与 OLAP 选型。', 4, 3],
          ['s1-4', '与 Kafka Streams 选型（关联）', '独立引擎 vs 库、状态规模与运维。', 3, 3],
        ]} ] },
      { id: 'kafka-streams', name: 'Kafka Streams', importance: 3,
        desc: '以库形式嵌入应用的流处理：拓扑 DSL、KTable/状态 store、精确一次与与 Flink 对比。',
        stages: [ { id: 's1', name: '阶段一 · 库式流处理', sections: [
          ['s1-1', 'DSL 拓扑与 KStream/KTable', 'map/aggregate/join、changelog、本地状态。', 4, 3],
          ['s1-2', '状态存储、精确一次与与 Flink 对比（关联）', 'processor API、EOS、何时选库不选引擎。', 4, 3],
        ]} ] },
    ],
  },

  /* ============================ 十五、专题（行业与跨技术整合） ============================ */
  {
    id: 'topics', name: '专题',
    desc: '跨技术整合与行业实战：必须给出实际例子与通用特点，架构师视角的主战场。',
    packages: [
      { id: 'high-concurrency', name: '高并发（总纲）', importance: 5,
        desc: '从接入到存储的分层削峰与扩展：缓存、异步、池化、无状态化、水平拆分。',
        stages: [
          { id: 's1', name: '阶段一 · 方法论与总览', sections: [
            ['s1-1', '高并发三大原则与容量模型', '无状态、缓存、异步；Little 定律与 TPS 推导。', 4, 5],
            ['s1-2', '跨技术联动：秒杀全链路', '网关限流 + Redis 预扣 + MQ 削峰 + DB 兜底。', 5, 5],
          ]},
          { id: 's2', name: '阶段二 · 分场景工程手段', sections: [
            ['s2-1', '热点治理与读写分离', '本地+多级缓存、动静分离、库存分桶与热点账户合并。', 5, 5],
            ['s2-2', '池化、异步化与削峰填谷', '连接/线程池、MQ 解耦、批量合并与最终一致。', 4, 5],
          ]},
        ],
      },
      { id: 'high-availability', name: '高可用（总纲）', importance: 5,
        desc: '冗余、隔离、降级、限流、容灾：可用性目标如何拆到每一层。',
        stages: [ { id: 's1', name: '阶段一 · 可用性与故障治理', sections: [
          ['s1-1', 'SLA 拆解与故障域划分', '99.99% 到每层的预算，多可用区部署。', 4, 5],
          ['s1-2', '跨技术联动：降级与熔断体系', 'Sentinel + 线程池隔离 + 兜底缓存 + 开关平台。', 5, 5],
          ['s1-3', '单元化与异地多活、容量与演练', '异地多活落地、压测与混沌演练闭环。', 5, 5],
        ]} ] },
      { id: 'idempotent', name: '幂等性', importance: 5,
        desc: '唯一索引、令牌、状态机、乐观锁：接口与消息消费的一致做法。',
        stages: [ { id: 's1', name: '阶段一 · 幂等设计模式', sections: [
          ['s1-1', '重复请求的四类解法', 'Token 机制、DB 唯一约束、状态机、去重表。', 4, 5],
          ['s1-2', '消息消费幂等与事务消息', '消费位点、去重缓存、本地事务表。', 5, 5],
        ]} ] },
      { id: 'ecommerce', name: '国内电子商务流程与应用', importance: 4,
        desc: '购物车→下单→库存→支付→履约全链路，含大促与售后逆向流程。',
        stages: [
          { id: 's1', name: '阶段一 · 交易主链路', sections: [
            ['s1-1', '下单链路与库存扣减', '订单快照、预扣与实扣、超时释放。', 4, 5],
            ['s1-2', '支付与对账体系', '支付渠道、异步通知、差错账处理。', 4, 5],
          ]},
          { id: 's2', name: '阶段二 · 大促、营销与逆向', sections: [
            ['s2-1', '促销价格计算与优惠券引擎', '叠加规则、价格快照、可退与预算控制。', 4, 4],
            ['s2-2', '购物车、搜索推荐与售后逆向履约', '购物车合并、检索召回、退款/退换货状态机。', 4, 4],
          ]},
        ],
      },
      { id: 'fintech', name: '国内银行金融流程与应用', importance: 4,
        desc: '账务核心、复式记账、对账、清算、监管与两地三中心。',
        stages: [
          { id: 's1', name: '阶段一 · 账务与一致性', sections: [
            ['s1-1', '核心账务与复式记账模型', '科目、借贷平衡、日切与总账。', 5, 5],
            ['s1-2', '对账、清算与资损防控', '三方对账、差错挂账、金额精度。', 5, 5],
          ]},
          { id: 's2', name: '阶段二 · 风控、合规与容灾', sections: [
            ['s2-1', '支付路由、风控与反欺诈', '渠道路由、限额限次、实时规则与名单。', 5, 4],
            ['s2-2', '两地三中心、监管合规与信创', '单元化容灾、审计留痕、国产化替代约束。', 5, 4],
          ]},
        ],
      },
      { id: 'power-grid', name: '国内电力集团内容与应用', importance: 3,
        desc: '采集与计量、负荷预测、时序数据、政企交付与信创约束。',
        stages: [ { id: 's1', name: '阶段一 · 行业系统形态', sections: [
          ['s1-1', '用电采集与时序数据处理', '高频上报、批量入库、时序库选型。', 4, 3],
          ['s1-2', '负荷预测、计量计费与政企信创', '预测模型工程化、阶梯电价、私有化与等保信创。', 4, 3],
        ]} ] },
      { id: 'media-sns', name: '国内自媒体与 SNS 应用', importance: 3,
        desc: 'Feed 流推拉模型、关系链、计数器、内容审核与热点治理。',
        stages: [ { id: 's1', name: '阶段一 · 内容与关系', sections: [
          ['s1-1', 'Feed 流推拉结合与热 Key', '注册/写扩散、多级时间线、热点打散。', 5, 4],
          ['s1-2', '关系链、计数器与内容审核', '好友推荐、计数一致性、机审+人审与限流。', 5, 3],
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
