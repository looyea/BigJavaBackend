# Spring 事件机制与初始化回调 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. Spring `@EventListener` 默认的执行方式是（6分）

- A. 异步、独立线程
- B. 同步、在发布者的同一线程执行
- C. 跨进程投递
- D. 持久化到磁盘后回放

> 答案：B
> 解析：默认同步同线程，除非加 `@Async`；它是进程内事件，不持久化也不跨进程。

### 2. 要让"业务事务真正提交后"才发通知，应使用（6分）

- A. 普通 `@EventListener`
- B. `@TransactionalEventListener(phase = AFTER_COMMIT)`
- C. `@PostConstruct`
- D. `InitializingBean`

> 答案：B
> 解析：AFTER_COMMIT 保证只在事务提交后触发，回滚则不发，避免"没成功却通知"。

### 3. 三种初始化回调的正确触发顺序是（6分）

- A. initMethod → afterPropertiesSet → @PostConstruct
- B. @PostConstruct → afterPropertiesSet → initMethod
- C. 三者随机
- D. afterPropertiesSet → @PostConstruct → initMethod

> 答案：B
> 解析：JSR-250 的 @PostConstruct 最先，其次 Spring 接口 afterPropertiesSet，最后容器定义的 initMethod。

### 4. 想在"整个应用完全就绪"后做缓存预热，最合适的落点是（6分）

- A. bean 的 @PostConstruct
- B. 监听 ApplicationReadyEvent
- C. 构造函数
- D. static 代码块

> 答案：B
> 解析：@PostConstruct 只保证自身依赖就绪、兄弟 bean 未必好；ApplicationReadyEvent 表示容器整体就绪。

### 5. 关于事件监听器抛异常，下列说法正确的是（6分）

- A. 同步监听器抛异常不会影响发布者
- B. 同步监听器抛出的运行时异常会传播回发布者，可能触发业务回滚
- C. 事件异常一律被吞掉
- D. 会自动重试

> 答案：B
> 解析：默认同步执行，监听器异常会抛回 publishEvent 调用处，进而可能回滚，需自行隔离或用异步/提交后阶段。

### 6. 下列哪项不是选择 @PostConstruct 的理由（6分）

- A. 非侵入，不绑定 Spring 接口
- B. 在依赖注入完成后触发
- C. 能保证所有其他单例都已就绪
- D. 是标准 JSR-250 注解

> 答案：C
> 解析：@PostConstruct 只针对当前 bean，不保证全容器就绪；需要全局就绪应用 SmartInitializingSingleton/ApplicationReadyEvent。

### 7. 关于 Spring 事件与消息中间件的关系，正确的认识是（6分）

- A. Spring 事件可直接替代 Kafka/RocketMQ
- B. Spring 事件是进程内、内存、不持久化的解耦，跨进程/可靠投递需真正的 MQ
- C. Spring 事件天然支持削峰与重试
- D. MQ 就是进程内事件

> 答案：B
> 解析：进程内事件重启即丢、不跨 JVM；可靠投递、削峰、回溯这些必须交给 MQ。

### 8.（多选）适合用 `@TransactionalEventListener(phase=AFTER_COMMIT)` 的场景有（9分）

- A. 支付事务提交后才发短信/推送
- B. 事务回滚也必须执行的写库
- C. 订单落库成功后才异步发积分
- D. 与主事务生死绑定的同步扣减库存

> 答案：A、C
> 解析：AFTER_COMMIT 用于"成功了才做"的旁路副作用；B/D 属于主事务内的强一致逻辑，不该放到提交后异步。

### 9.（多选）关于事件机制的正确实践有（9分）

- A. 异步事件走 @Async + 线程池，注意队列满被拒
- B. 关键通知应落库+补偿，不依赖内存事件万无一失
- C. 监听器里可随意抛异常而不影响主流程
- D. 用 @Order 控制同一事件多个监听器的执行顺序

> 答案：A、B、D
> 解析：C 错，同步监听器异常会回传发布者；异步/提交后隔离、可靠靠落库补偿、顺序靠 @Order 才是正解。

### 10. 电商下单支付成功后要：记审计日志（同步、随事务）、发通知与加积分（只在成功后异步、不影响主链路、回滚不能做）。请结合 Spring 事件机制与初始化回调给出方案与踩坑点。（40分）

> 参考答案：
- 要点1：领域事件建模——支付成功 publishEvent(OrderPaidEvent)，解耦"发生"与"处理"，发布者不依赖下游（10分）
- 要点2：审计同步随事务、通知/积分用 @TransactionalEventListener(AFTER_COMMIT)+@Async，保证回滚不触发、且不拖慢主链路（10分）
- 要点3：异步监听器异常隔离与可靠——@Async 线程池防队列满拒绝，关键旁路落库+补偿重试，不把异常抛回发布者导致回滚（10分）
- 要点4：初始化时机——预热类启动逻辑放 ApplicationReadyEvent/SmartInitializingSingleton，别在 @PostConstruct 里调用未就绪的兄弟 bean（10分）
