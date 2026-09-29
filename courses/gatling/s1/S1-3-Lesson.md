# 与 JMeter 选型对比（关联）

> 本节难度：★★☆☆☆
> 重要程度：★★★☆☆
> 学习产出：从 Gatling 视角给出"何时该选它"的判断树——脚本可维护与版本控制诉求、团队代码能力、并发量级与 CI 流水线契合度，并诚实列出 Gatling 打不过 JMeter 的场景。

## 一、Gatling 的主场长什么样

三条判据命中任意两条，Gatling 优先：①压测脚本要进版本库长期演进（PR 评审、复用抽象、与业务代码同仓）；②万级虚拟用户/高到达率（异步模型省线程）；③压测是 CI/CD 门禁的常驻环节（纯命令行+断言退出码天生亲和流水线）。反例：给只会 Postman 的同事交付 .scala——工具再强也是零。

```java
// 目的：同一"爬坡→稳态→脉冲"剧本在 Gatling 里的表达力——组合子即文档
setUp(
    checkout.injectOpen(
        rampUsersPerSec(50).to(500).during(Duration.ofMinutes(3)),   // 说明：爬坡找拐点
        constantUsersPerSec(500).during(Duration.ofMinutes(10)),     // 稳态验 SLA
        heavisideUsers(2000).during(Duration.ofSeconds(2)))          // 结果：开抢脉冲压瞬时锁竞争
   .protocols(httpBasicAuth)
   .assertions(global().successRatio().gt(0.995),
               global().responseTime().percentile99().lt(800));
// 反例：同一剧本在 JMeter 里=3 个线程组+2 个 shaping 插件+一串属性拼接，评审时没人能一眼看全
```

## 二、脚本可维护性：代码 vs XML 的真实差距

Gatling 场景=函数：公共链（登录/签名）抽成 ChainBuilder 复用、参数用常量与 case class 收口、IDE 重构一键改全部引用、类型检查在编译期拦住"字段改名忘改脚本"；jmx 是 XML 元件树，diff 噪音大、复用靠 Include Module、正确性靠运行时肉眼。代价对称：Gatling 有 DSL 学习期（Scala 印象分吓退人，Java DSL 可用但社区样例仍以 Scala 为主），且**没有录制器**——API 文档不全时探索成本高于 JMeter Recorder 一把梭。

## 三、诚实的短板清单

协议面窄（HTTP/WS/JSON-RPC 为主，JDBC/JMS/Dubbo 要自研或走 JMeter）；无 GUI 对非开发不友好；报告定制不如 JMeter+Grafana 生态灵活；团队离开"会写代码的那个人"就停摆——所以公共 feeder/断言库与文档化场景模板是 Gatling 落地的配套刚需，不是可选项。

## 四、选型叙事模板（面试与评审通用）

"我们按**谁维护/什么协议/多大量/进不进 CI** 四问打分：核心链路容量与门禁归 Gatling（代码化+异步吞吐），冷协议与非开发自助场景归 JMeter（GUI+录制+插件广度），两边共享造数与口径字典，重大结论互相对拍原始样本。"——把工具之争收敛为场景分配，是这组关联课（[JMeter 侧的对向视角](../../jmeter/s1/S1-3-Lesson.md)）共同想传递的判断方式。

## 五、关联技术

DSL 细节在 [Gatling DSL 与场景编排](S1-1-Lesson.md)；报告与容量方法论在 [异步模型、指标与容量结论](S1-2-Lesson.md)；JMeter 能力面见 [组件模型与非 GUI 执行](../../jmeter/s1/S1-1-Lesson.md)；压测编排进流水线的方法在 [GitLab CI 流水线模型](../../gitlab-ci/s1/S1-1-Lesson.md)。
