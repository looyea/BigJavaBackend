# MyBatis 与 JPA/Spring 整合及选型（关联）

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：能把 MyBatis 融入 Spring 生态，并对"MyBatis 还是 JPA"给出有依据的选型。整合要点：用 `mybatis-spring-boot-starter` 自动配置 `SqlSessionFactory`；`@MapperScan` 批量生成 Mapper 代理并注册为 Bean，或 `@Mapper` 标注单接口；`Mapper` 由 **`SqlSessionTemplate`**（线程安全、Spring 管理的单例，内部按当前事务绑定的 `SqlSession` 执行）驱动，从而**复用 Spring 事务**——`@Transactional` 与 MyBatis 操作共处同一事务、异常触发回滚，无需手工 commit/close。动态数据源靠 `AbstractRoutingDataSource` + 注解/AOP 路由 key 切换（读写分离、多租户库）。**选型对比**：JPA/Hibernate 面向**领域模型与状态管理**——实体托管、脏检查、自动 DDL、派生查询，适合**领域复杂、以对象为中心、CRUD 规整**的场景，代价是黑盒 SQL 不可控、N+1 与抓取策略要调、复杂报表 SQL 难表达；MyBatis 面向 **SQL 与映射**——你手写每一句 SQL，适合**DBA 主导、复杂查询/报表/批量、需要精细调优与方言控制**的场景，代价是样板映射与手工维护 SQL。**混用策略**：一个工程里可 JPA 管领域写模型、MyBatis 管复杂读/报表（CQRS 倾向），但要统一事务管理器与数据源，避免两套 Session 割裂。识破"两套 ORM 各自开事务导致不回滚""动态数据源在事务开启后切换失效（连接已绑定）""@Transactional 加在 private/自调用不生效""把 JPA 黑盒 SQL 的性能问题硬扛不用 MyBatis 兜底"等坑。

## 一、与 Spring 事务/SqlSessionTemplate 集成

```java
// 目的：让 MyBatis 复用 Spring 事务——异常即回滚, 无需手工 commit/close
@MapperScan("com.x.repo")                       // 说明：批量把 Mapper 接口生成代理并注册为 Bean
@Configuration
class DbConfig {
    @Bean SqlSessionTemplate tpl(SqlSessionFactory f) {
        return new SqlSessionTemplate(f);       // 结果：线程安全单例, 内部取"当前事务绑定的 SqlSession"执行
    }
}
@Transactional                                    // 反例：数据源在事务已开启后才想切换 ❌ 连接已绑定, 路由失效
public void transfer(long a, long b, BigDecimal amt) {
    accountMapper.debit(a, amt);                  // 说明：与下面一句同处一个 Spring 事务
    accountMapper.credit(b, amt);                 // 结果：任一句抛异常, 两句一起回滚(前提: RuntimeException 传播)
}
// 反例：@Transactional 标在 private 方法或类内自调用 ❌ 代理不拦截, 事务静默失效 ❌
```

## 二、动态数据源与读写分离

```text
图目的：多数据源路由的正确姿势与失效边界
AbstractRoutingDataSource: determineCurrentLookupKey() 从 ThreadLocal 取 key → 路由到目标 DataSource
切换时机: 必须在事务开启前确定数据源; 事务一旦开始, Connection 已绑定, 中途切库无效
读写分离: 写走主库、读走从库; @Transactional(readOnly=true) 可作为路由线索
坑: 嵌套/异步线程丢失 ThreadLocal 上下文 → 数据源路由错乱
```

## 三、MyBatis vs JPA 的选型矩阵

```text
图目的：按"以对象为中心还是以 SQL 为中心"决策
JPA/Hibernate: 领域复杂、CRUD 规整、以实体模型为中心、要自动建表/脏检查 —— 但 SQL 黑盒、N+1 与复杂报表弱
MyBatis:      DBA 主导、复杂查询/报表/批量、要精细控制 SQL 与方言 —— 但映射样板与 SQL 手工维护
混用(CQRS 倾向): JPA 管写模型 + MyBatis 管复杂读/报表; 必须统一事务管理器与数据源, 防两套 Session 割裂
```

## 四、坑与底线

- **一个事务、一个数据源**：两套 ORM 各自管理连接/事务会造成"看起来一起提交实则各管各"的回滚漏洞，混用时务必共享同一 Spring 事务管理器。
- **黑盒扛不住就换工具**：JPA 表达不了的复杂 SQL 别硬凑，用原生查询或干脆交给 MyBatis，性能与可维护性优先。

## 五、关联课程

JPA 侧的实体状态与脏检查见 [持久化上下文与实体状态](../../spring-data-jpa/s1/S1-1-Lesson.md)；其最著名的 N+1 与抓取调优见 [N+1 与抓取策略](../../spring-data-jpa/s1/S1-2-Lesson.md)；JPA 的查询与事务边界承接 [派生查询、自定义仓储与事务边界](../../spring-data-jpa/s1/S1-3-Lesson.md)；容器与代理（`@Transactional` 依赖的 AOP 基座）见 [资源抽象、SpEL 与容器扩展点](../../spring-core/s1/S1-3-Lesson.md)。
