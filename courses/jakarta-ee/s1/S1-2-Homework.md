# 作业题 · CDI 依赖注入标准

## 作业 1：默认作用域陷阱复现（必做，本节核心）

写一个带 `Map` 缓存的 `CacheBean`：

1. 先不加任何作用域注解，注入两处并分别 put，观察两处的数据是否共享（验证 `@Dependent` 多例）
2. 加上 `@ApplicationScoped` 再验一次（应共享）
3. 用日志打印两次注入对象的 `System.identityHashCode` 佐证
- **产出**：一段能证明"默认多例 vs 单例"差异的最小工程 + 结论截图

## 作业 2：限定符选实现（必做）

定义 `PaymentGateway` 接口与 `AliPay`/`WxPay`/`UnionPay` 三个实现：

1. 直接 `@Inject PaymentGateway` 复现 `Ambiguous resolution`
2. 用自定义限定符 `@Ali/@Wx/@Union` 让不同服务注入到指定实现
3. 用 `@Any` + `Instance<PaymentGateway>` 遍历所有实现做健康检查
- **验收标准**：一个"按渠道动态选实现"的支付分发 Demo

## 作业 3：拦截器与事件解耦（必做）

1. 写一个 `@Logged` 绑定注解 + 拦截器，统计被标注方法的调用耗时
2. 用 `@Observes` 事件把"下单成功"解耦为"发通知/加积分/风控"三个观察者
3. 说明若用 Spring 会怎么写（AOP + `@EventListener`）
- **产出**：拦截器 + 事件流代码，附 CDI↔Spring 写法对照注释

## 作业 4：CDI ↔ Spring 迁移清单（选做，架构师向）

给定一个 Spring 模块，输出一份"迁到纯 CDI"的改造清单：注解替换（`@Autowired→@Inject`、`@Component→@ApplicationScoped/@Named`、`@Bean→@Produces`、`@Primary→@Default`、`@Configuration→beans.xml`）、行为差异（默认作用域、`@Value` 无对应需 `@ConfigProperty`(MicroProfile)）、以及迁移风险点排序。

## 作业 5：三种装配第三方类的方式对比（选做）

针对一个无法加注解的第三方类（如 `DataSource`），分别用 `@Produces` 方法、`beans.xml` + 扩展、以及（若在 Spring 里）`@Bean` 装配。对比可测试性、可读性、可否条件化装配，写 200 字结论。
