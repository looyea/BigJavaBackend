# Nacos + Sentinel + Seata 组件协同 · 面试题

## 题 1：Spring Cloud Alibaba 里 Nacos/Sentinel/Seata/Feign 分别管什么？

- Nacos：注册发现 + 外部配置中心；Sentinel：限流/熔断降级；Seata：分布式事务；OpenFeign/Dubbo：服务调用通道。
- Feign 是"跑在治理组件之上"的调用方式，需要与 Sentinel、Seata 显式集成。
- 加分：强调四者是协作而非替代，集成靠各自的开关与拦截器。

## 题 2：多个 starter 装配时最容易踩的坑是什么？

- 版本不对齐：Nacos/Sentinel/Seata starter 与 Spring Boot/Cloud 不兼容导致类冲突、自动配置打架。
- 用 SCA BOM 统一版本，并对照 Boot/Cloud 兼容矩阵。
- 加分：能举"某 starter 版本对不上导致启动报 NoSuchMethod/Bean 冲突"的例子。

## 题 3：怎么让 OpenFeign 的调用被 Sentinel 保护、能降级？

- 引入 `spring-cloud-alibaba-sentinel` 且设 `feign.sentinel.enabled=true`，Feign 调用才注册成 Sentinel 资源。
- 在 `@FeignClient` 上配 `fallback`/`fallbackFactory`，异常/超时即降级。
- 加分：忘记开该开关是高频坑——Feign 直连不产生资源，规则与 fallback 都不生效。

## 题 4：Seata 在 SCA 里怎么和 Nacos 联动？

- `seata.registry.type=nacos`：TC（事务协调器）集群注册到 Nacos，RM 通过 Nacos 发现 TC。
- `tx-service-group → cluster` 的 `vgroupMapping` 从 Nacos 配置读取。
- 加分：TC 没注册到对的 Nacos/namespace，会导致各环境连错协调器。

## 题 5：跨服务调用时 Seata 的 xid 怎么传播？不传播会怎样？

- 上游 `@GlobalTransactional` 生成 xid，经 Feign 的 `RequestInterceptor` 放进请求头（`TX_XID`），下游解析后挂到同一全局事务，且各服务 DataSource 要被 Seata 代理。
- 不传播：下游分支游离于全局事务，回滚管不到 → 分布式数据不一致。
- 加分：代理数据源负责生成 undo_log、注册分支，是 AT 模式回滚的前提。

## 题 6：一个既要防刷限流又要保证跨服务一致性的下单流程，接入顺序是？

- 入口先经 Sentinel 流控挡住超量流量（保护后端），通过后再由 `@GlobalTransactional` 拉起全局事务，然后 Feign 调各下游并传播 xid。
- Sentinel 的 fallback 降级要在事务边界之外处置，别把"降级产生的半成品写"提交进全局事务。
- 加分：Sentinel 规则用 NacosDataSource 持久化，重启不丢、可动态下发。
