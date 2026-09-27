# 分层、六边形与整洁架构 · 作业题

> 本节作业 3 题：一次依赖方向审计、一个端口去污染改造、一套 ArchUnit 门禁落地。

## 作业 1：给现有项目做一次"import 审计"（动手）

挑你手头任意一个业务模块（哪怕是练手项目）：

1. 打开被认为"最核心业务"的那个包，列出它所有 `import`——把 `org.springframework.*`、`org.apache.ibatis.*`、`redis.*`、`javax.persistence.*` 逐一标红；
2. 按"框架包出现个数"给这个模块的分层健康度打分（0 个=真分层，>5 个=挂名分层）；
3. 找出"形似分层神似事务脚本"的证据：Service 类是否只是把 Controller 参数转发给 DAO、真正的规则是否仍散落在 Service 的 if/else 里（对照本课"领域包薄于一页、用例包厚过规则"识别法）；
4. 写下三句话结论：这个模块的"圆心"到底是什么？依赖箭头现在指向哪？

**验收标准**：一张 import 标红清单 + 健康度分数 + 三句话结论（结论必须能指出至少一个具体类名作为病灶）。

## 作业 2：把被污染的端口"洗干净"（设计+动手）

给定一个签名已被 IO 渗透的仓储接口：

```java
// 例子目的：识别端口污染并按 DIP 重造
// 反例：接口在 domain 包，但签名全是 Spring/JPA 类型 —— 倒置只倒了一半
public interface OrderRepository {
    org.springframework.data.domain.Page<OrderPO> findAll(   // 错误用例: Pageable 是 Spring 分页语义, OrderPO 是 JPA 实体
            org.springframework.data.domain.Pageable p,       // 后果: 换 GraphQL 游标分页/换 jOOQ 都得先改领域层
            Example<OrderPO> probe);                           // 反例: Spring Data 的查询探针直接漏进核心
}
// 正解：端口世界只讲领域语言，PO↔Domain、分页语义转换全部关进 adapter/persistence
public interface OrderRepository {
    Page<Order> find(OrderQuery q);   // Page/OrderQuery 都是自定义领域类型; 结果: 换实现不动这个接口
    void save(Order order);
}
```

要求：

1. 把上面反例改造为正解：定义领域侧 `Page<T>`、`OrderQuery`（普通值对象，不挂任何框架注解）；
2. 在 `adapter/persistence` 写一个 `OrderRepositoryImpl`，用 MapStruct 或手写 mapper 完成 `OrderPO ↔ Order`、`Pageable ↔ OrderQuery` 的双向翻译；
3. 证明收益：给核心用例 `SubmitOrderUseCase` 写一个纯单测——`new SubmitOrderUseCase(new InMemoryOrderRepository(), fakeNotifier)`，不起 Spring、不连库，毫秒级跑通；
4. 反思：为什么"转换关在适配器里"而不是"让领域对象直接可持久化"？（用一句话写进答案，考点=外部契约与内部模型隔离）。

**验收标准**：正解接口代码 + 一个 `InMemory` 实现 + 一个不依赖容器的单测（贴运行输出 `Tests run: 1, Failures: 0 ... Time elapsed: 0.01s`）。

## 作业 3：把分层从 PPT 变成 CI 门禁（动手）

1. 引入 ArchUnit（`archunit-junit5`），为本模块写三条规则：① domain 不得依赖 springframework/ibatis/redis；② 分层 `layeredArchitecture()` 声明 Domain/Application/Adapter/Infra 四层，规定依赖只能由外向内；③ `Controller 不得直接访问 Repository 包`（`mayOnlyBeAccessedByLayers`）；
2. 故意提交一处违规（Controller 里 `@Autowired OrderRepository`），跑测试确认流水线变红，再按正解修回变绿；
3. 制造一次"豁免掏空"陷阱：用 `// NOLINT` 式无注释豁免绕过规则，然后给豁免补上"原因+负责人+到期日"，体会门禁纪律；
4. 把这三条规则接到 CI（GitHub Actions/gitlab-ci 均可），提交一次带违规的 PR 观察拦截效果。

**交付物**：ArchUnit 测试类代码 + 红/绿两次运行日志截图或文本 + 带到期日的豁免示例。

**提示**：这题真正的考点是"分层靠机器执法而非靠自觉"——能自动变红的规则才是架构，写在文档里的只是愿望。
