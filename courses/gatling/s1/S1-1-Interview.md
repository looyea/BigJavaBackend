# Gatling DSL 与场景编排 · 面试题

## 题 1：Gatling 脚本里一个"虚拟用户"的生命周期是怎样的？

- scenario 定义用户"一生"：从注入时刻诞生，沿 chain 逐节点推进（发请求→等响应→check→saveAs→pause 挂起等待）；
- 推进由状态机+事件驱动：等待期不占线程，pause 是往全局定时器投一个延时任务，到期恢复——这是它单机高并发的根因（下一节细讲）；
- exitHereIfFailed/exitHereIf 可提前终结；会话（Session）携带本用户变量直到消亡，跨 scenario 不共享；
- 加分：对比 JMeter"线程跑循环"——JMeter 用户=线程串行，Gatling 用户=可挂起状态机，"50k 并发"在两边是完全不同量级的资源。

## 题 2：saveAs 提取失败会发生什么？check 体系怎么决定"成功/失败"？

- check 全部通过请求才记 OK；jsonPath 没命中即 check 失败→请求 KO→下游插值 "#{token}" 缺失又会被标 ELKO 错（不会发出带垃圾头的请求，除非显式 laxSession）；
- status.is(200) 与 jsonPath 是"与"关系，多个 check 可链式；业务码断言写 `jsonPath("$.code").is("0")`；
- 加分：说口径——报告的成功率=OK/(OK+KO)，KO 含 check 失败与通信异常；不设 check 时只要 HTTP 没炸就全绿，与 JMeter 无断言同坑。

## 题 3：feeder 的 circular/random/iterator 语义与选型？

- 默认 iterator：顺序消费，耗尽后新取数为空→后续用户报错停摆，所以行数必须≥总迭代预算；
- circular：耗尽回头复用——长稳压测数据不足时的解药，但同一行被并发使用要评估业务互踩（同用户并发下单）；
- random：随机取样，模拟真实热点分布；wireFeed/自定义 FeedBuilder 对接造数服务；
- 加分：给预算公式（到达率×时长×场景权重）并强调"造数与压测脚本同仓版本化"，feeder 列名即接口契约的一部分。

## 题 4：注入 DSL 里 atOnceUsers、ramp、constantUsersPerSec、heaviside 分别回答什么问题？

- atOnceUsers(n)：n 个用户同时进场——瞬时并发/连接风暴问题；
- rampUsersPerSec(a).to(b)：线性爬坡——找拐点、观察 GC/队列随负载演化；
- constantUsersPerSec(x).during(t)：稳态到达率——SLA 验证与浸泡测试（soak）；
- heavisideUsers：阶跃脉冲——秒杀开抢建模；
- 加分：多段拼接表达"爬坡→稳态→突增"复合剧本，并提醒：报告解读必须回到注入形态，脉冲场景的平均 TPS 无意义。

## 题 5：为什么"评审一个仿真脚本先看 inject 和 assertions"？

- inject 决定流量模型：模型不对（无思考时间的脉冲当稳态、到达率给不够），后面 DSL 再漂亮结论也废；
- assertions 决定"红绿灯语义"：无断言=退出码恒 0，CI 门禁形同虚设；断言要双指标（成功率+分位）并按 group 分步骤；
- 加分：再补第三条评审项"数据策略"（feeder 选型与行数预算）——模型、判据、数据三样定了，脚本其余只是表达。

## 题 6：多个业务混合压测怎么组织？会话隔离带来什么问题？

- 组织法：多 scenario 各自 inject（按真实流量占比分配到达率），或 `peakLoad/constantUsersPerSec` mix——报告里按 group 天然分线；
- 会话隔离问题：Session 不跨 scenario，"售后流要用下单流的订单号"这类依赖要降到数据层预置（feeder 从造数服务领取"已有订单"池）而不是幻想共享会话；
- 副作用监控：混压下相互干扰（缓存命中、锁竞争）正是保真度所在——分开压的结论会低估资源竞争；
- 加分：给出配比依据（生产网关流量统计）与"关键线独立 SLA 断言"，混压失败要能回答"哪条业务线违约"。
