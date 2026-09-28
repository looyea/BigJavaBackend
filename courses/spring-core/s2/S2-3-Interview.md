# Spring 事件机制与初始化回调 · 面试题

## 题 1：Spring 事件是同步还是异步的？

- 默认同步——监听器在发布者的同一线程执行，除非加 `@Async`（并开启 `@EnableAsync`）。
- 它是进程内事件，不持久化、不跨进程，别把它当 MQ。
- 加分：同步监听器抛异常会回传发布者、可能触发回滚；要隔离就用异步或 AFTER_COMMIT 阶段。

## 题 2：@EventListener 和 @TransactionalEventListener 有什么区别？

- @EventListener 事件一发布就执行，不管事务最终是否提交。
- @TransactionalEventListener 可绑定事务阶段，AFTER_COMMIT 只在事务真正提交后触发、回滚不发。
- 加分：典型用法——支付成功后发短信/加积分放 AFTER_COMMIT + @Async，既不误发又不拖慢主链路。

## 题 3：@PostConstruct、InitializingBean、initMethod 该选哪个？顺序如何？

- 触发顺序：@PostConstruct → afterPropertiesSet → initMethod。
- 首选 @PostConstruct：非侵入、是 JSR-250 标准，不绑 Spring 接口。
- 加分：三者都只保证"当前 bean 依赖注入完成"，不保证全容器就绪；需要全局就绪用 SmartInitializingSingleton 或 ApplicationReadyEvent。

## 题 4：想在启动完成后做缓存预热，放构造函数或 @PostConstruct 行不行？

- 不合适：构造函数太早（依赖未注入），@PostConstruct 只保证自身就绪、兄弟 bean 可能还没好。
- 正确落点是 ApplicationReadyEvent（Boot 完全就绪）或 SmartInitializingSingleton（所有单例就绪）。
- 加分：预热探测 DB/Redis 可用性，作为"能不能开始接流量"的自检信号。

## 题 5：事件机制能替代消息队列吗？

- 不能。Spring 事件在单 JVM 内存中、不持久化、重启即丢、不跨进程、无削峰/回溯/重试保证。
- 解耦单应用内部的"发生 vs 处理"很好；跨服务、可靠投递、削峰必须上真正的 MQ。
- 加分：真正可靠的事件驱动落地 = 落库 + 事务性发布（Outbox 模式）+ 补偿，而非只靠内存事件。

## 题 6：一个事件有多个监听器，怎么控制顺序？

- 用 `@Order` 指定监听方法顺序，数字越小越先执行。
- 顺序只对同步监听有意义；异步下并发执行不保证先后。
- 加分：更根本的是别让监听器彼此依赖，用事件语义划分职责，减少顺序耦合。
