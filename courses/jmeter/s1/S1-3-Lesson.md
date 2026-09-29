# 与 Gatling 选型对比（关联）

> 本节难度：★★☆☆☆
> 重要程度：★★★☆☆
> 学习产出：能从压力模型、资产形态、生态与团队技能四个维度论证 JMeter 与 Gatling 的选型边界，说出"录制回放/图形化交付给非开发"何时是决定性优势，以及选择 JMeter 时要主动付出的维护税。

## 一、根子上差在压力模型

JMeter：一个虚拟用户=一个平台线程，请求阻塞等待——直观、通用，但 50k 并发要 50k 线程，内存与上下文切换先扛不住；Gatling：绿色线程模型（少量平台线程 + 异步/协程状态机），单机万级并发是其招牌。结论：**目标并发 ≤ 数千且协议多样，JMeter 的线程模型完全够；要单机模拟数万到达率，Gatling（或 wrk/k6）才有资格上桌**。

## 二、资产形态：.jmx XML vs 代码

| 维度 | JMeter | Gatling |
|------|--------|---------|
| 载体 | .jmx（XML 图形化元件树） | Scala/Java 代码（类型安全 DSL） |
| 评审 | XML diff 痛苦，元件挪位置产生巨量噪音 | 普通 code review、PR 可行 |
| 复用 | Include Module/属性拼接，重构能力弱 | 函数、抽象、版本化库 |
| 门槛 | 会 HTTP 概念即可上手，可录制浏览器操作 | 要求写代码，团队需 Scala/Java 功底 |
| 数据驱动 | CSV/函数，UI 里配置 | feeder 机制，代码里组合 |

JMeter 的"录制+拖拽"对**非开发角色（测试、SRE）自助压测**是真实生产力；Gatling 的"压测脚本即产品代码"适合**工程团队把容量验证长驻 CI**。

## 三、生态与协议面

JMeter 胜在广：HTTP/TCP/JMS/JDBC/LDAP/MongoDB、WebSocket，插件管理器生态（Throughput Shaping、Dubbo 插件），报告与 Ant/Jenkins 集成成熟——**非 HTTP 协议压测往往是 JMeter 一票通过的理由**。Gatling 胜在深：HTTP/WS 一类的 DSL 体验、官方 HTML 报告的分位图质量、与 CI 的纯命令行协作优雅，企业版有分布但开源版协议面窄（JDBC 等需自研）。

## 四、同一需求两把刀：秒杀场景的实现对照

```text
图目的：同一"5 万用户 30s 内匀速进入抢库存"需求在两种工具里的实现路径与瓶颈
JMeter 写法：Open Thread Group(target 100000/min) + CSV 切片 + JSON 断言
  结果：需 3~4 台压力机分布式拼到达率，master 汇总要调优
  反例：用经典线程组硬开 5 万线程 → 压力机先炸，误判服务容量
Gatling 写法：constantUsersPerSec(1700).during(30) + campaignFeeder 分片 + jsonPath 断言
  结果：单机 4C8G 即可维持；报告自带分位曲线
  说明：若团队无人熟 Scala，此优势归零——技能税高于工具税时选 JMeter
```

同一需求的 Gatling 侧写法（对照上块，体会"脚本即代码"的评审面）：

```scala
// 目的：把"5 万用户 30s 匀速进入"表达成可评审代码，到达率驱动与 JMeter Open Thread Group 同构
val flash = scenario("抢库存")
  .feed(campaignFeeder) // 说明：feeder 轮流供参数，对应 CSV Data Set；耗尽策略 circular/exception 要在定义处显式选定
  .inject(constantUsersPerSec(1700).during(30.seconds))
// 反例：atOnceUsers(50000) ❌ 瞬时五万并发先把压力机和端口池打回原形，再误判目标系统容量
// 结果：单机 4C8G 维持到达率；断言不过退出码非零，容量门禁直接接进流水线
```

## 五、选择 JMeter 时要认下的税

①脚本资产腐化：jmx 无类型检查，改接口字段靠肉眼全局替换（可配 JSR223 缓解）；②单机容量墙与分布式运维成本（RMI、时钟、文件分发）；③监听器/GUI 误用的"假瓶颈"文化——需要用规范约束。反之选 Gatling 的税是 Scala 招聘面收窄与 DSL 学习期。**没有全赢选型：按"谁来写、压什么协议、要多大并发、资产怎么养"四问打分**。

## 六、关联技术

JMeter 侧能力细节在 [组件模型与非 GUI 执行](S1-1-Lesson.md) 与 [并发模型、思考时间与 TPS/RT 解读](S1-2-Lesson.md)；对向视角（DSL 手感、异步模型与何时选 Gatling）在 [与 JMeter 选型对比（关联）](../../gatling/s1/S1-3-Lesson.md)；两者共同的下游——服务端瓶颈定位在 [火焰图怎么看与常见瓶颈](../../async-profiler/s1/S1-1-Lesson.md)。
