# Spring 事件机制与初始化回调

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能区分并使用 Spring 的两类"时机钩子"——**事件机制**（`ApplicationEvent` + `@EventListener`，配合 `ApplicationEventPublisher` 解耦"发生了某事"与"谁关心"，支持 `@Async` 异步、`@Order` 排序、`@TransactionalEventListener` 绑定事务阶段）与**初始化回调**（`@PostConstruct`、`InitializingBean.afterPropertiesSet`、`@Bean(initMethod)` 三种，语义与优先级要分清），并理解容器生命周期事件（`ContextRefreshedEvent`/`ApplicationReadyEvent`）适合做预热、注册、启动自检。关键取舍：事件默认**同步**且在发布者同一线程、同一事务上下文执行，滥用 `@TransactionalEventListener(phase=AFTER_COMMIT)` 才做提交后异步；初始化回调里不要依赖尚未注入完成的兄弟 bean。识破"用事件做同步阻塞把主链路拖慢""在 @PostConstruct 里访问未就绪的 bean""事件监听器抛异常把业务回滚"等坑。

## 一、事件机制：发布/订阅解耦

```text
图目的：把"发生了什么"与"谁要处理"解耦, 发布者不认识监听者
发布: publisher.publishEvent(new OrderPaidEvent(order))
监听: @EventListener 处理; @Async 需开 @EnableAsync; @Order 控顺序
事务绑定: @TransactionalEventListener(phase=AFTER_COMMIT) 只在事务真正提交后触发, 避免回滚了还发通知
```

```java
// 目的：订单支付成功后异步发通知, 且只在事务提交后才触发, 回滚不发
@EventListener
public void onPaid(OrderPaidEvent e) { audit.log(e.getOrder()); }          // 说明：同步监听, 与发布者同线程

@TransactionalEventListener(phase = AFTER_COMMIT)                          // 结果：事务回滚时此监听不执行, 杜绝"没成功却发了短信"
@Async
public void notify(OrderPaidEvent e) { sms.send(e.getOrder().getPhone()); } // 反例：直接用 @EventListener 同步发短信 ❌ 拖慢主链路且回滚也照发

// 反例：@EventListener 里抛运行时异常 ❌ 默认同步会把异常抛回发布者, 可能触发业务回滚
```

## 二、初始化回调三选一：语义与顺序

```text
图目的：三种 init 写法触发顺序固定, 别混着用导致逻辑重复
1) @PostConstruct(JSR-250, 依赖注入完成后立刻执行, 推荐)
2) InitializingBean.afterPropertiesSet(Spring 接口)
3) @Bean(initMethod="...") 或 xml init-method(容器定义级)
顺序: @PostConstruct → afterPropertiesSet → initMethod
```

- **首选 @PostConstruct**：非侵入、不绑 Spring 接口；需要"所有单例就绪后"的收尾，则用 `SmartInitializingSingleton` 或监听 `ApplicationReadyEvent`，而不是 @PostConstruct（后者只看自身，兄弟 bean 可能还没好）。

## 三、容器生命周期事件：预热与自检的落点

```text
图目的：分清"我这个 bean 好了"和"整个容器好了"两个层级
ContextRefreshedEvent   → 容器刷新完成(可能在刷新中被多次触发, 慎用一次性逻辑)
ApplicationReadyEvent   → Boot 启动完全就绪, 做缓存预热/注册/健康自校验的最佳落点
```

```java
// 目的：应用真正就绪后再预热热点缓存, 而不是在 bean 自己的 init 里
@EventListener(ApplicationReadyEvent.class)
public void warmUp() { cache.preload(topKeys()); }  // 结果：此时 DataSource/Redis 等依赖均已就绪, 预热不会 NPE
// 反例：在 @PostConstruct 里调用另一个 bean 的加载方法 ❌ 那个 bean 未必已初始化完, 时序不可控
```

## 四、坑与底线

- **事件不是 MQ**：进程内、默认同步、不持久化、重启即丢；要跨进程/可靠投递请上真正的消息中间件。
- **异步事件要防丢**：`@Async` 走线程池，队列满会拒绝；关键通知仍应落库 + 补偿，别指望内存事件万无一失。

## 五、关联课程

事件与初始化的触发都发生在 bean 生命周期内，生命周期与容器就绪时机见 [BeanFactory 与 ApplicationContext](../s1/S1-1-Lesson.md)；`@TransactionalEventListener` 的事务阶段依赖对传播与提交时机的理解，见 [事务传播与失效场景](./S2-2-Lesson.md)；监听器代理织入机制承接 [AOP 与动态代理](./S2-1-Lesson.md)。
