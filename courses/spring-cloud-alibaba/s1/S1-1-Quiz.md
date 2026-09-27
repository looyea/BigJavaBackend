# 微服务组件选型地图 · 小测

### 1. Nacos 区别于 Eureka 的最大特点是？（6分）

- A. 只支持 CP
- B. 同时支持 AP 和 CP 模式切换
- C. 不支持健康检查
- D. 无配置中心功能

> 答案：B
> 解析：Nacos 临时实例走 AP（Distro），持久实例走 CP（Raft）；Eureka 只有 AP。

### 2. 以下哪个已停止维护，不建议新项目使用？（6分）

- A. Sentinel
- B. Resilience4j
- C. Hystrix
- D. Spring Cloud CircuitBreaker

> 答案：C
> 解析：Hystrix 2018 年 Netflix 宣布停更；官方推荐 Resilience4j 或 Sentinel 替代。

### 3. Seata AT 模式的核心优势是？（6分）

- A. 强一致性
- B. 对业务零侵入——自动生成补偿日志
- C. 支持跨异构数据库
- D. 性能最优

> 答案：B
> 解析：AT 只需 `@GlobalTransactional` 注解，框架自动记录 undo/redo log 实现回滚。

### 4. 网关选型时 APISIX 相比 SCG 的优势是？（6分）

- A. Java 原生集成
- B. 插件热加载 + 更高吞吐
- C. 与 Spring Security 无缝
- D. 无需独立部署

> 答案：B
> 解析：APISIX 基于 Nginx+Lua/Go，独立于业务语言，性能 10w+ QPS；SCG 优势在 Java 生态集成。

### 5. 配置中心选型：Apollo 相比 Nacos Config 的独特能力是？（6分）

- A. 服务注册
- B. 灰度发布 + 版本回滚 + 审计日志更完善
- C. 支持 YAML
- D. 长轮询推送

> 答案：B
> 解析：Apollo 面向企业级配置管理，灰度/回滚/权限审批链更成熟。

### 6. 微服务间通信：gRPC 相比 REST 的核心优势是？（6分）

- A. 浏览器原生支持
- B. 二进制序列化 + HTTP/2 多路复用 → 高性能
- C. 无需 IDL 定义
- D. 天然支持服务发现

> 答案：B
> 解析：gRPC 用 Protobuf 序列化（比 JSON 快 5-10 倍）+ HTTP/2 Stream 多路复用。

### 7. 可观测性三支柱是？（6分）

- A. 日志、监控、链路追踪
- B. 告警、看板、SLO
- C. Trace、Metric、Event
- D. 注册、配置、熔断

> 答案：A
> 解析：Logging / Metrics / Tracing 是可观测性三根支柱。

### 8. Spring Cloud Alibaba 全家桶包含哪些组件？（多选）（9分）

- A. Nacos
- B. Sentinel
- C. Seata
- D. Eureka

> 答案：A、B、C
> 解析：D 是 Netflix 旧方案，不属于 SC Alibaba 体系。

### 9. 金融场景选型应优先考虑？（多选）（9分）

- A. Seata TCC（资金强一致语义）
- B. Nacos CP 模式
- C. APISIX 网关
- D. 完善审计日志链路

> 答案：A、B、D
> 解析：C 可选但非金融特有需求；核心是一致性 + 强监管审计。

### 10. 简答题：一个 50 人电商团队从零建微服务，给出你的选型方案及理由。（40分）

- 要点1：注册+配置=Nacos——AP/CP 灵活、团队已有 Spring Cloud 经验
- 要点2：网关=SCG——与 Spring Security/OAuth2 集成方便，流量可控（< 5w QPS）
- 要点3：流控熔断=Sentinel——阿里生态、Dashboard 开箱即用
- 要点4：事务=Seata AT 为主 + 支付核心用 TCC——平衡开发效率与资金安全
- 要点5：通信=OpenFeign（内部）+ gRPC（高性能服务间）
- 要点6：可观测=SkyWalking + Prometheus + Grafana + ELK 全链路

> 答案：见要点
> 解析：中等规模电商追求"快速迭代+可控复杂度"，SC Alibaba 全家桶满足大部分需求。
