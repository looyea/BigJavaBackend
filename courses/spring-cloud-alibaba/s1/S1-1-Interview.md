# 微服务组件选型地图 · 面试题

## 题 1：为什么 Eureka 不再推荐？它缺什么？

- Netflix 2018 宣布 Eureka 2.0 开源计划取消，1.x 只修 Bug。
- 缺少配置中心能力 → 需额外引入 Spring Cloud Config。
- 只支持 AP → 强一致场景无法保证。
- 无健康检查扩展（只有心跳）。

## 题 2：Nacos 同时做注册中心和配置中心，单点风险怎么解决？

Nacos 集群部署（3 节点起）：
- 注册中心：临时实例 Distro 协议（AP），持久实例 Raft（CP）。
- 配置中心：Derby（单机）/ MySQL（集群共享），Nacos Server 无状态水平扩展。
- 客户端本地缓存快照：Nacos 全挂时读取 `config-cache/` 目录兜底。

## 题 3：什么场景该选 Dubbo 而不是 OpenFeign？

| 维度 | Dubbo | OpenFeign |
|------|-------|-----------|
| 性能 | 二进制 Hessian2 + 长连接 → 高吞吐 | HTTP/1.1 + JSON → 一般 |
| 服务治理 | 内置路由/权重/Mock | 需外挂 Sentinel/LoadBalancer |
| 跨语言 | Triple 协议支持（类 gRPC） | 天然 HTTP 跨语言 |
| 团队栈 | 重度 Java 微服务 + 阿里系 | 多语言/已有 REST 网关 |

选择 Dubbo 场景：内部服务调用量 > 10w QPS、需要细粒度流量控制。

## 题 4：Seata AT vs TCC 如何选？

```java
// 目的：AT——对业务无感，适合内部 CRUD 服务
@GlobalTransactional
public void createOrder() {
    storageClient.deduct(...);  // 结果：Seata 自动记 undo_log
    orderClient.create(...);
    accountClient.debit(...);   // 错误用法：跨异构数据库（如 Oracle + MongoDB）→ AT 不支持
}

// 目的：TCC——金融资金操作，需手动控制 Try/Confirm/Cancel
@TwoPhaseBusinessAction(name = "freezeAccount", commitMethod = "confirm", rollbackMethod = "cancel")
public boolean tryFreeze(@BusinessActionContextParameter(paramName = "amt") BigDecimal amount) {
    // 说明：Try 只冻结不扣减 → Confirm 真实扣 → Cancel 解冻
    account.setFrozen(account.getFrozen().add(amount));  // 输出：余额不变，冻结增加
    return true;
}
```

## 题 5：网关层鉴权方案对比？

- SCG + Spring Security OAuth2 Resource Server：嵌入应用，Java 友好。
- APISIX + openidconnect 插件：独立部署，多服务复用。
- 自建 Auth 服务 + 网关 Token 校验 Filter：最灵活但开发量最大。
- 选型依据：团队规模小→SCG 一体化；多语言/超大流量→APISIX。

## 题 6：微服务拆分粒度和组件选型的关系？

- 粗粒度（3-5 服务）：注册中心可选轻量（Consul KV 即可），事务本地解决。
- 细粒度（30+ 服务）：必须有完整全家桶（Nacos + Sentinel + Seata + 可观测）。
- 核心：组件选型跟着服务数量和流量规模走，不要过度设计。
