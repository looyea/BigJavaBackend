# Nacos + Sentinel + Seata 组件协同 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. SCA 集成多组件时装配第一步是（6分）

- A. 随便选版本
- B. 用 SCA BOM 对齐 Nacos/Sentinel/Seata starter 版本，并匹配 Boot/Cloud 兼容矩阵
- C. 只装 Nacos
- D. 全用最新

> 答案：B
> 解析：版本不对齐最易出现 starter 类冲突与自动配置打架，BOM + 兼容矩阵是前提。

### 2. 让 OpenFeign 走 Sentinel 做熔断降级，必须（6分）

- A. 引入 Feign 即可
- B. `feign.sentinel.enabled=true`
- C. 关掉 Nacos
- D. 加 Ribbon

> 答案：B
> 解析：不开该开关，Feign 调用不产生 Sentinel 资源、`fallback` 不生效，等于没接熔断。

### 3. Seata 在 SCA 里开启全局事务的关键是（6分）

- A. 加 `@Transactional`
- B. `@GlobalTransactional` + 代理 DataSource
- C. 手动 commit
- D. 关掉 Sentinel

> 答案：B
> 解析：`@GlobalTransactional` 生成 xid 拉起全局事务，DataSource 被 Seata 代理才能拦截分支。

### 4. Seata 的 TC（事务协调器）在 SCA 里通常注册到哪里？（6分）

- A. 本地内存
- B. Nacos（与业务服务同一注册中心，RM 通过它发现 TC）
- C. Redis
- D. 不需要发现

> 答案：B
> 解析：`seata.registry.type=nacos`，TC 集群注册到 Nacos、RM 经 Nacos 发现，`vgroupMapping` 也从 Nacos 取。

### 5. Sentinel 流控规则要"重启不丢、可程序化下发"，应（6分）

- A. 只在控制台手动配
- B. 用 NacosDataSource 持久化并动态推送
- C. 写死代码
- D. 存本地文件

> 答案：B
> 解析：控制台/内存态重启即丢、无法批量下发；接 Nacos 做规则持久化与动态推送是生产做法。

### 6. 跨服务调用里，Seata 的 xid 要怎样传播到下游？（6分）

- A. 不用传播
- B. 通过 Feign `RequestInterceptor` 放进请求头（如 `TX_XID`）
- C. 放 Cookie
- D. 放数据库

> 答案：B
> 解析：不传播 xid，下游分支就游离于全局事务，回滚管不到 → 分布式数据不一致。

### 7. 一次"既限流又开全局事务"的跨服务写，推荐接入顺序是（6分）

- A. 先开事务再限流
- B. 入口先 Sentinel 限流挡量 → 再 `@GlobalTransactional` → 再 Feign 调下游
- C. 顺序无所谓
- D. 只开事务

> 答案：B
> 解析：先限流保护后端、避免超量流量进入事务；通过后进入全局事务边界再调用下游，并传播 xid。

### 8.（多选）以下哪些是"组件没接对"的典型症状？（9分）

- A. 开了 fallback 但 Feign 调用从不降级（忘 `feign.sentinel.enabled`）
- B. 下游回滚不了（Seata xid 未传播）
- C. 重启后 Sentinel 规则全没了（没接 NacosDataSource）
- D. Nacos 控制台能登录

> 答案：A、B、C
> 解析：D 是正常现象不是症状；A/B/C 分别对应 Feign-Sentinel、Seata 传播、Sentinel 规则持久化没配好。

### 9.（多选）关于四者职责，正确的有（9分）

- A. Nacos：注册发现 + 外部配置
- B. Sentinel：限流/熔断降级
- C. Seata：分布式事务
- D. OpenFeign：声明式服务调用（跑在治理组件之上）

> 答案：A、B、C、D
> 解析：四项各司其职，Feign 是调用通道、需与 Sentinel/Seata 显式集成。

### 10. 电商下单要跨"订单/库存/积分"三个服务保证数据一致，同时入口要防刷。请说明 SCA 四组件如何协同。（40分）

> 参考答案：
- 要点1：底座——Nacos 做注册发现与配置；各服务与 Seata TC 都注册到 Nacos，版本用 SCA BOM 对齐（10分）
- 要点2：限流——下单入口用 Sentinel 流控（资源=接口），配 NacosDataSource 持久化规则、防刷保护后端（10分）
- 要点3：分布式事务——主服务 `@GlobalTransactional` 开全局事务，Feign `RequestInterceptor` 传播 xid，三服务各自 DataSource 被 Seata 代理成为分支（10分）
- 要点4：顺序与边界——先限流后开事务再调下游；Sentinel fallback 降级在事务边界外处置，不把半成品写提交进全局事务（10分）
