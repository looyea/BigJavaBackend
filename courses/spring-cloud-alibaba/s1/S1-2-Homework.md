# Nacos + Sentinel + Seata 组件协同 · 作业

### 作业 1：跑通三件套装配并验证版本对齐

- 目标：体会 SCA BOM 对齐与四大件协同装配的最小闭环。
- 任务：用 SCA BOM 引入 `nacos-discovery`、`nacos-config`、`spring-cloud-alibaba-sentinel`、`seata-spring-boot-starter`，让一个服务注册到 Nacos、从 Nacos 拉配置、Seata TC 也注册到 Nacos；故意混用一个不兼容的 starter 版本，观察启动报错，再修正。
- 验收标准：服务成功注册、配置生效、`@GlobalTransactional` 方法能连到 TC；能复现版本不对齐的冲突并说明如何用 BOM 解决。
- 参考解法要点：Boot/Cloud/SCA 兼容矩阵；`seata.registry.type=nacos`、`vgroupMapping`。

### 作业 2：让 OpenFeign 走 Sentinel 并配 Nacos 规则持久化

- 目标：补齐两个"忘了就不生效"的开关。
- 任务：配置 `feign.sentinel.enabled=true`，给一个 Feign 接口加 `fallback`，注入下游超时/异常验证降级生效；再把一条流控规则改为通过 NacosDataSource 下发，重启服务后规则仍在。对比没开该开关、规则只存控制台时重启丢失的现象。
- 验收标准：Feign 调用异常能触发 fallback；规则经 Nacos 持久化后重启不丢、能动态推送生效。
- 参考解法要点：控制台内存态 vs NacosDataSource；fallback 与全局事务边界的隔离。

### 作业 3：跨服务下单的 xid 传播与回滚验证

- 目标：验证 Seata 全局事务确实覆盖下游分支。
- 任务：主服务 `@GlobalTransactional` 里用 OpenFeign 调两个下游写操作，加 `RequestInterceptor` 传播 `TX_XID`；在第二个下游制造异常，观察三个服务的数据一起回滚；再故意去掉 xid 传播，复现"部分提交、数据不一致"。
- 验收标准：传播到位时下游异常触发全局回滚、各分支数据一致；去掉传播后能复现不一致；说清 DataSource 被 Seata 代理的必要性。
- 参考解法要点：xid 随头传播；分支注册；代理数据源拦截 SQL 生成 undo_log。
