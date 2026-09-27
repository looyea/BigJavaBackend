# 作业题 · IoC 容器与 Bean 生命周期

## 作业 1：生命周期时间线打点（必做）

写一个测试 Bean，同时挂上：构造器、`@Autowired` setter、`BeanNameAware`、`ApplicationContextAware`、`@PostConstruct`、`InitializingBean`、`initMethod`、`BeanPostProcessor`（before/after）、`@PreDestroy`。

**产出**：一张按实际打印顺序排列的时间线，标出"代理在哪一步之后才存在"。

## 作业 2：代理失效复现与修复（必做）

造一个 `@Service`，其 `@PostConstruct` 方法里 `this.updateTx()` 调用一个带 `@Transactional` 的方法，观察事务未生效；再改为注入自身代理 `@Lazy` 自注入或拆到另一个 Bean 调用，验证生效。写清根因（自调用绕过 post-after 的代理）。

## 作业 3：优雅停机实验（必做，架构师向）

1. 起一个 2 QPS 的接口，压测中 `kill -TERM <pid>`，对比 `server.shutdown=graceful` 开与关时的 5xx/丢请求数。
2. 给出配套 K8s 片段：`preStop: sleep` + `terminationGracePeriodSeconds`，并说明为什么要大于 `timeout-per-shutdown-phase`。
3. 结合电商下单/金融扣款场景，说明"在途请求丢失"的业务代价。

## 作业 4：prototype 注入陷阱（选做）

一个 prototype 的 `Cart` 被单例 `UserService` 字段注入，写并发测试证明它退化为单例；再用 `ObjectProvider<Cart>` 或 `@Lookup` 修正。
