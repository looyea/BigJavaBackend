# 分层、六边形与整洁架构

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：能用"依赖箭头方向"一根标尺评审三种分层流派；说清六边形架构的端口/适配器模型里"驱动侧与被动侧"的端口差异；解释整洁架构"业务规则不依赖 IO"的收益如何量化（测试金字塔底部、换库换框架成本）；给出一套包结构 + ArchUnit 规则让分层从 PPT 变成 CI 门禁，并识别"依赖倒置执行歪了"的两种常见形态。

```flow
例子目的：三种流派的同一根标尺——依赖只能指向内层(业务), 箭头反了整套架构就塌
传统三层:   UI -> Service -> DAO -> DB          病灶: Service import MyBatis注解/Redis模板, 业务与IO肩并肩
六边形:     Web适配器 → [端口] ← 应用服务 → [端口] → 持久化适配器   业务居中, 两侧皆插件
整洁架构:   Entities(企业规则) ← UseCases(用例规则) ← InterfaceAdapters ← Frameworks&Drivers
评审一句话: 打开领域层的 import 列表——出现 redis/ibatis/http, 分层即失效
```

## 一、演进逻辑：每一代都在修上一代的漏

- **经典三层**的问题不是"层"而是**依赖方向**：上层 import 下层具体实现，Service 与 MyBatis/Redis 焊死，业务逻辑要跑起来得起容器连数据库——测试成本决定重构勇气（接 design-patterns S2-2 的 characterization 困境）；
- **六边形（Ports & Adapters）**：应用核心声明"我需要什么"（驱动端口：`OrderUseCase`；被动端口：`OrderRepository`），Web/DB/MQ 都是可拔插的适配器——左边驱动（输入适配器实现 UseCase 接口），右边被驱动（适配器实现端口接口），**接口在消费者包里**（DIP 的架构级执行）；
- **整洁架构**再加一层同心圆判据：企业级规则（不变式、聚合）> 用例级规则（编排步骤）> 接口适配器 > 框架驱动——"越靠圆心越稳定，外部变化不该惊动内部"。

## 二、落地包结构与依赖规则

```java
// 目的：一个可被 CI 执行的分层——包名即架构, ArchUnit 规则即法律
// order/
//   domain/        StockItem, Money, OrderRepository(接口!), StockDeducted   ← 零框架依赖
//   application/   SubmitOrderUseCase(编排: 调聚合+调端口)                    ← 只依赖 domain
//   adapter/
//     web/         OrderController          ← 实现 application 的 UseCase 接口(驱动侧)
//     persistence/ OrderRepositoryImpl(JPA) ← 实现 domain 的端口接口(被驱动侧)
//     mq/          PaymentEventListener     ← 入站适配器, 翻译成命令交 application
@AnalyzeClasses(packages = "com.x.order")
class LayerTest {
    @ArchTest static final ArchRule domain_pure = noClasses().that().resideInAPackage("..domain..")
        .should().dependOnClassesThat().resideInAnyPackage("..springframework..", "..ibatis..", "..redis..");
    @ArchTest static final ArchRule arrow_in = layers().layer("Domain").layer("Application")
        .layer("Adapter").layer("Infra").layerAreDependenciesTransitiveAndCycleFree()   // 结果: 反向 import 在 PR 流水线直接红
        .whereLayer("Domain").mayNotBeAccessedByAnyLayer();                              // 反例预演: Controller 直调 Repository 在这条前活不过 30 秒
}
// 错误用法: 只建包不配规则——三个月后"临时"跨层调用靠记忆执法, 记忆比注释先失效
```

## 三、两种"依赖倒置执行歪了"

1. **端口被实现方污染**：`OrderRepository` 接口签名里出现 `OrderPO`（JPA 实体）或 `Pageable`（Spring 类型）——倒置只倒了一半，IO 概念顺着接口漏回核心；正解：端口世界只用领域类型，PO↔Domain 转换关在适配器内（MapStruct 的活）；
2. **领域层反向指挥应用层**：聚合里注入 `OrderRepository` 自己存自己（"充血变自救"）——聚合不该知道持久化存在，保存是用例（application）的职责；把 `repo.save(item)` 写进 UseCase 而不是 StockItem。

```java
// 目的：端口签名的"纯洁度"测试
public interface OrderRepository {          // 好: 领域语言, 换 jOOQ/内存 Map 实现它都不用改这个接口
    Order findById(OrderId id);
    void save(Order order);
    List<Order> findUnpaidBefore(LocalDate day);
}
// 反例: Page<Order> findAll(Pageable p) —— Spring 分页语义渗透核心, 将来 Web 层换 GraphQL 游标分页要先过领域层的关
// 错误用法: 端口里塞 OrderPO/ResultSet —— 那等于没倒置, 只是把 import 换了个方向写
// 结果: 跑核心用例单测 = new SubmitOrderUseCase(new InMemoryRepo(), fakeSms), 毫秒级、无容器
```

## 四、收益怎么量化（说服团队的三本账）

- **测试账**：领域+用例单测秒级跑完、无外部依赖——可测试比例与 CI 时长直接可见（改造前后各截一张覆盖率×耗时图）；
- **替换账**：换 ORM/缓存/MQ 只动 adapter 包——真换过一次的项目才有资格讲，没换过就诚实说这是保险费；
- **部署账**：六边形的"适配器可远程化"是微服务演进路径——单体里端口本地调用，拆分时同一接口改 Feign 实现，核心零改动（模块化单体→服务的平滑梯子，接 S1-1 作业 3）。

## 五、常见线上问题

- 事务脚本借尸分层：Controller→Service→DAO 各一千行"转发"，规则仍全在 Service——形似分层神似脚本（识别：领域包薄于一页，用例包厚过规则）；
- 贫血 DTO 贯穿三层：接口收到的 Request 直接被 `@Transactional` 持久化——外部契约即内部模型，上游改字段等于改数据库；
- 适配器层长出业务：Controller 里 if (用户等级>3) 算折扣——入口逻辑该下沉 UseCase，用"折扣规则改在哪个文件能生效"做审计；
- ArchUnit 规则被 `// NOPMD` 式豁免掏空：豁免要注释+到期日，否则门禁变建议。

## 六、小结与过关要点

分层架构的争议（三层/四层/洋葱/六边形/整洁）其实都是**一句话的N种写法：让易变的依赖稳定者，而不是相反**。选哪种不重要，能回答三个问题才重要：你的圆心是什么（企业规则还是用例）？箭头方向由什么强制（评审还是 ArchUnit）？端口里混进对方的类型了吗？过关自测：打开你最核心业务的包，数 import——框架包出现几个，你的架构就"悬"了几层。
