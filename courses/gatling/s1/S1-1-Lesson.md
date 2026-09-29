# Gatling DSL 与场景编排

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：能读懂并写出 Gatling 仿真骨架（protocol→scenario→injection→assertions），用 feeder/chain-exec 编排带关联的业务链路，并说清 `exitHereIfFailed`、`tryOnce`、`group` 对结果口径的影响。

## 一、骨架四段：一个仿真就是一个函数

```java
class OrderSim extends Simulation {
    HttpProtocolBuilder http = http                                  // 目的：协议级公共配置，免去逐请求重复
        .baseUrl("http://order-svc:8080")
        .acceptHeader("application/json");

    ScenarioBuilder scn = scenario("下单链路")                        // 说明：场景=虚拟用户生命周期脚本
        .exec(login)                                                  // chain 复用：登录子链
        .exitHereIfFailed();                                          // 结果：前置失败即终止本用户，不产生脏数据请求

    {
        setUp(scn.inject(atOnceUsers(100)))                          // 注入模型：到达率/爬坡在这里定
            .protocols(http)
            .assertions(global().responseTime().percentile75().lt(400),
                        global().successRatio().gt(0.995));          // 反例：不写断言的仿真退出码永远是 0，CI 形同虚设
    }
}
```

与 JMeter"树"的对应关系：protocol≈HTTP 默认值，chain≈控制器+取样器，injection≈线程组，assertions≈断言+聚合报告——概念全在，只是从拖拽变成类型安全的代码。

## 二、关联与参数化：saveAs + feeder

```java
ChainBuilder login = group("登录") {                                  // 目的：报告按业务步骤聚合而非单请求
    exec(http("doLogin").post("/login").body(StringBody("{...}")))
        .check(jsonPath("$.data.token").saveAs("token"));             // 结果：token 进本会话变量，失败默认标记该请求 KO
};
FeederBuilder<String> users = csv("data/users.csv").circular();      // 说明：循环消费防数据耗尽反例
// 下游：scenario 链首 .feed(users) 领数，再 http("create").post("/orders").header("Authorization", "#{token}")
```

`random()`/`wireFeed` 对应不同数据策略；不设 `circular` 时数据耗尽会让后半程用户拿不到参数直接报错（反例：压测后半段变成错误风暴）；`circular` 复用则要评估"同一用户被并发使用"的互踩语义。

## 三、流程控制三兄弟

- `exitHereIfFailed()`：链路前置步骤失败即中止该虚拟用户——不加它会带着缺失变量继续打后续接口，制造大量无意义 4xx（污染错误率）；
- `tryOnce`/`doIf`/`asLongAs`：条件与单次重试，幂等验证用 `tryOnce` 包住写操作；
- `pause(1)`（或 `populationUniform` 思考时间）：不加 pause 的场景=火力全开模型，结论口径要与 JMeter 无思考时间场景同样标注。

## 四、注入 DSL 即压测模型

`atOnceUsers(100)` 瞬时并发、`rampUsersPerSec(a).to(b).during(t)` 线性爬坡、`constantUsersPerSec(500).during(10m)` 稳态到达率、`heavisideUsers(...)` 阶跃脉冲（秒杀开抢建模）。多段拼接 `inject(ramp...).during(2m), constant...during(8m)` 就是"爬坡→稳态→平台"的容量曲线——**注入写法直接决定 TPS/RT 曲线的解释口径，评审仿真先看 inject**。

## 五、报告与断言的 CI 姿势

HTML 报告开箱含分位曲线与请求分布；`assertions` 写 SLA（如 `global().failedRequests().percent().lt(0.5)`）让 `gatling:run` 以退出码表达红绿灯，接 [GitLab CI/Jenkins](../../gitlab-ci/s1/S1-1-Lesson.md) 只需一行 maven task；`-Dgatling.simulationClass=...` 非交互执行，禁用 GUI 依赖（Gatling 本来就没有图形编辑器）。

## 六、关联技术

异步模型与容量结论解读在 [异步模型、指标与容量结论](S1-2-Lesson.md)；与 JMeter 的对向比较在 [与 JMeter 选型对比（关联）](S1-3-Lesson.md)；压测时服务端瓶颈下钻见 [方法级观测与调用链耗时](../../arthas/s1/S1-1-Lesson.md)。
