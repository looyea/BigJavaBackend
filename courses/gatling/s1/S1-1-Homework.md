# Gatling DSL 与场景编排 · 作业

## 作业 1：迁移一条 JMeter 链路（动手题）

**目标**：把"登录→下单→取消"的 .jmx 翻译成类型安全的 Simulation。

**任务**：
1. 记录原计划的并发/思考/断言语义（到达率、CSV 消费方式、业务码断言）；
2. 等价实现：protocol 公共配置、login chain（saveAs token）、feeder 对应 CSV（说明选 circular 还是 iterator 的理由）、group 划分与 exitHereIfFailed；
3. 断言映射：把 JMeter 断言翻译成 assertions（successRatio+P99），跑出报告并对照两边 P99 差异是否在噪音范围内；
4. 用 `-Dgatling.simulationClass` 非交互执行，写一条 CI job。

**验收标准**：两工具同压同一环境的 TPS/P99 偏差 <10%，或能解释偏差来源（连接复用/并发模型）；DSL 里无一处字符串魔法值散落（常量收口）。

## 作业 2：混压场景编排（工程题）

**目标**：一条 setUp 内混跑"浏览流 70% / 下单流 25% / 售后流 5%"。

**任务**：
1. 三个 scenario 各自注入（constantUsersPerSec 按权重分配到达率），或演示 mixture 写法；
2. 浏览流只读、下单流写操作 tryOnce、售后流依赖前序 saveAs 的订单号（跨场景不可共享会话——说明如何在数据层预置）；
3. 断言按 group 分解：任何一步 successRatio 掉到阈值下都能从报告一步定位业务步骤。

**验收标准**：报告出现三业务线的分组统计；能回答"为什么会话变量不能跨 scenario 传递"。

## 作业 3：仿真评审清单（文档题）

**任务**：起草团队《Gatling 仿真 Code Review 清单》：注入模型与结论口径匹配、feeder 行数预算计算、pause 有无及标注、check 是否覆盖业务码、断言双指标（成功率+分位）、chain 复用与常量管理、报告归档与环境标签。每条给"反例代码片段+修正"。

**验收标准**：每条都含可判定的检查动作（看哪一行、问什么问题）；至少一条覆盖"脉冲注入被当稳态汇报"的判例。
