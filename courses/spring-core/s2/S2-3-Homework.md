# Spring 事件机制与初始化回调 · 作业

### 作业 1：用事件解耦支付成功后的旁路动作

- 目标：把"发通知、加积分、记审计"从支付主流程里剥离，主流程只发布事件。
- 任务：定义 `OrderPaidEvent`，支付服务 `publisher.publishEvent(...)`；审计用 `@EventListener` 同步写日志，通知与积分用 `@TransactionalEventListener(phase=AFTER_COMMIT)` + `@Async` 处理（需 `@EnableAsync`）。
- 验收标准：事务回滚时通知/积分监听不触发；主链路耗时不因发短信而上升；开启异步后监听在独立线程执行。
- 参考解法要点：区分"随事务的同步"与"提交后的异步"两类副作用；异步监听器内部 try-catch 防止异常回传。

### 作业 2：验证三种初始化回调的顺序与边界

- 目标：亲手确认 @PostConstruct、afterPropertiesSet、initMethod 的触发次序。
- 任务：写一个 bean 同时实现 `InitializingBean`、标注 `@PostConstruct` 方法、并在 `@Bean(initMethod=...)` 指定第三种，打印三行日志顺序；再造一个场景：在 @PostConstruct 里调用另一个尚未就绪的 bean 观察问题。
- 验收标准：日志顺序为 @PostConstruct → afterPropertiesSet → initMethod；说明 @PostConstruct 不保证全局就绪，改用它应走 SmartInitializingSingleton。
- 参考解法要点：首选非侵入的 @PostConstruct；把"依赖整个容器就绪"的逻辑上移到容器级回调。

### 作业 3：给启动加一道就绪自检

- 目标：应用真正可服务前，确认关键依赖可用。
- 任务：监听 `ApplicationReadyEvent`，在其中对 DB/Redis 做健康探测并预热热点缓存；探测失败时打印明确告警（或阻断启动）。
- 验收标准：预热在依赖就绪后执行、不出现 NPE；能体现"容器就绪"与"单 bean 就绪"的层级差异。
- 参考解法要点：ApplicationReadyEvent 是 Boot 完全就绪信号；把一次性启动任务放这里，而非塞进被每 bean 回调放大的 BeanPostProcessor。
