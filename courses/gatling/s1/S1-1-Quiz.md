# Gatling DSL 与场景编排 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. Gatling 仿真里相当于 JMeter"线程组"职责的是？（6分）

- A. protocol 配置
- B. inject 注入模型（atOnceUsers/rampUsersPerSec/constantUsersPerSec 等）
- C. group
- D. feeder
> 答案：B
> 解析：setUp(scn.inject(...)) 定义到达率/爬坡/持续——压测的流量模型全在注入 DSL 里，评审仿真第一步就看它。

### 2. `jsonPath("$.data.token").saveAs("token")` 的作用是？（6分）

- A. 断言 token 存在
- B. 提取响应字段存入当前虚拟用户会话变量，供后续请求插值使用
- C. 写入全局缓存
- D. 生成测试数据
> 答案：B
> 解析：这就是 Gatling 的"关联"；check 里的 saveAs 失败会同时把请求标 KO——提取不到即错误。

### 3. 登录失败后不希望该虚拟用户继续打下单接口，应？（6分）

- A. 删掉后续请求
- B. 链路中放 exitHereIfFailed()
- C. 设超时
- D. 用 tryOnce 包裹整个场景
> 答案：B
> 解析：前置失败即终止本用户生命周期，避免带缺失变量继续发请求制造无意义 4xx 污染错误率统计。

### 4. feeder 数据不设 `.circular()` 且行数不足时，典型后果是？（6分）

- A. 自动重跑
- B. 数据耗尽后用户拿不到参数报错，压测后半段变错误风暴
- C. 静默忽略
- D. 报告更准
> 答案：B
> 解析：容量按"行数≥总迭代数"预算，或明确 circular 并评估同用户并发互踩语义。

### 5. `group("登录"){...}` 的价值是？（6分）

- A. 执行更快
- B. 报告按业务步骤聚合统计（步骤级 OK/KO 与耗时），而非只见零散请求
- C. 自动重试
- D. 并发隔离
> 答案：B
> 解析：报告口径从"接口"升维到"业务动作"，SLA 讨论与故障定位都以步骤为单位。

### 6. 要让 CI 用退出码表达压测红绿灯，依赖的是？（6分）

- A. HTML 报告存在
- B. assertions 块声明 SLA（如 successRatio>0.995、P75<400ms）
- C. -Dgatling.simulationClass
- D. pause 设置
> 答案：B
> 解析：Gatling 以 assertion 结果决定进程退出码，不写断言则永远 0——"没有断言的仿真在 CI 里等于没跑"。

### 7. 模拟"秒杀开抢瞬间 1 万用户涌入"最贴切的注入是？（6分）

- A. constantUsersPerSec(1) 慢慢来
- B. heavisideUsers / atOnceUsers 阶跃脉冲配合短持续
- C. 只用 rampUsers
- D. 手动多开进程
> 答案：B
> 解析：heaviside 阶跃建模瞬时到达；纯线性 ramp 会把脉冲抹平成三角波，低估瞬时锁竞争。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于场景编排的说法正确的有？（9分）

- A. chain（ChainBuilder）可独立定义并被多场景 exec 复用，等价于公共子流程
- B. pause(1) 模拟思考时间，不加则场景是"火力全开"模型
- C. doIf/asLongAs 提供条件与循环，使同一脚本可表达分支用户行为
- D. 一个 Simulation 只能有一个 scenario
> 答案：ABC
> 解析：D 错——setUp 可并列多个 scenario 各自注入（如浏览流+下单流混压），还能 mix 权重组合。

### 9. （多选）哪些写法会让压测结论失真？（9分）

- A. 关键 check 漏写 saveAs 提取失败未被察觉（默认严格模式下会被放大，但混压 lenient 时可能漏）
- B. 用 atOnceUsers(5000) 却按"稳态容量"汇报
- C. assertions 只写响应时间不写成功率
- D. feeder 用 circular 且业务要求每用户单次消费
> 答案：ABCD
> 解析：A 数据链路断裂后续请求全打错；B 把脉冲峰值当稳态；C 掩盖"慢但错"；D 同用户重复消费制造假并发冲突。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 写一份"购物车结算链路"的 Gatling 场景设计：协议与会话、feeder 策略、chain 结构（含 group 与失败处理）、注入模型、断言与 CI 接入。（40分）

> 参考答案：
- 要点1：http protocol 统一 baseUrl/头，登录 chain 以 jsonPath saveAs token，后续请求 header 插值；
- 要点2：feeder：用户 csv circular 还是 iterator 视"同用户可否并发"决定，行数≥总迭代预算并写明依据；
- 要点3：scenario=group(登录)→group(加购)→group(结算)，每段后 exitHereIfFailed 或 exitHereIf(条件)，写操作用 tryOnce 防重复；
- 要点4：注入用 rampUsersPerSec 到目标 + constantUsersPerSec 稳态两段拼接，pause(populationUniform(1,3)) 表达思考时间；
- 要点5：assertions 双指标：successRatio>0.995 且 P99<800ms、按 group 名分步骤断言，让失败定位到业务步骤；
- 要点6：CI：maven gatling 插件非交互跑，退出码进门禁，HTML 报告归档制品（关联 gitlab-ci/Jenkins），压测机资源与监控同 JMeter 纪律。
