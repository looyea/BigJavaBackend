# Nacos + Sentinel + Seata 组件协同

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能把 Spring Cloud Alibaba（SCA）四大件——**Nacos（注册+配置）、Sentinel（限流熔断）、Seata（分布式事务）、OpenFeign/Dubbo（调用）**——的装配关系、彼此联动和"同一个服务里既限流又开全局事务"的接入顺序讲清楚。装配第一步是**版本对齐**：用 SCA 的 BOM（`spring-cloud-alibaba-dependencies`）统一 Nacos/Sentinel/Seata 各 starter 版本，并与 Spring Boot/Cloud 版本兼容矩阵对齐，否则极易出现 starter 之间类冲突、自动配置打架。分工与集成：`nacos-discovery` 负责服务注册与发现，`nacos-config` 负责外部化配置（`spring.config.import` 或 bootstrap）；Sentinel 靠 `spring-cloud-alibaba-sentinel` 接入，**要让 OpenFeign 走 Sentinel 做熔断降级，必须 `feign.sentinel.enabled=true`**，否则 Feign 调用不产生 Sentinel 资源、`fallback` 不生效；Seata 靠 `seata-spring-boot-starter`，通过**代理 DataSource** 拦截分支事务、`@GlobalTransactional` 开启全局事务。三者与 Nacos 的**联动**是重点：Seata 的 **TC（事务协调器）集群也注册到 Nacos**，RM/TC 通过 Nacos 互相发现，`tx-service-group→cluster` 的 `vgroupMapping` 从 Nacos 取；Sentinel 的流控/降级规则推荐用 **Nacos DataSource 持久化动态推送**（只存内存/控制台则重启即丢、无法程序化下发）；配置变更经 Nacos 推给各组件。在一个跨服务写操作的**接入顺序**上：请求先经**入口 Sentinel 限流**（挡住超量流量、保护后端），通过后进入业务、由 **`@GlobalTransactional` 拉起 Seata 全局事务**，再经 **OpenFeign 调下游**——此时 **Seata 的 xid 必须随 Feign 请求头传播**（`TxApplicationContext` / Feign `RequestInterceptor` 携带 `TX_XID`），下游分支才能挂到同一全局事务；而 Sentinel 的 `fallback` 降级返回要**落在事务边界之外妥善处置**，别把"降级产生的半成品写"提交进全局事务。识破"版本不对齐→starter 冲突""忘开 `feign.sentinel.enabled` → Feign 无熔断""Seata xid 不传播→下游分支游离于全局事务导致数据不一致""TC 没注册到 Nacos→各环境连错协调器""Sentinel 规则不接 Nacos→重启丢规则"等坑——电商下单跨库存/订单/积分多服务、金融转账正是这套组合的典型战场。

## 一、装配关系与版本对齐

```yaml
# 目的：把 Nacos/Sentinel/Seata 装配关系配齐——版本用 BOM 对齐, 三者互相拿注册与配置
spring:
  cloud:
    nacos:
      discovery:
        server-addr: nacos:8848   # 说明：服务注册与本服务发现都走 Nacos
      config:
        file-extension: yaml      # 结果：配置也来自 Nacos, Sentinel/Seata 规则可放这里动态下发
    sentinel:
      transport:
        dashboard: sentinel-dash:8080  # 说明：控制台; 规则持久化应接 Nacos DataSource 而非只存内存
feign:
  sentinel:
    enabled: true                 # 反例：不开这个 ❌ OpenFeign 不走 Sentinel, 调用无熔断降级 fallback ❌
seata:
  registry:
    type: nacos                   # 结果：Seata 的 TC 也注册/发现走 Nacos, 与业务服务同一注册中心
  tx-service-group: my_tx_group   # 说明：vgroupMapping 把事务组映射到 TC cluster, 映射关系从 Nacos 取
```

## 二、组件联动的三条主线

```text
图目的：都围着 Nacos 转——注册、配置、规则/映射的动态化
Seata ↔ Nacos: TC 集群注册到 Nacos, RM 通过 Nacos 发现 TC; vgroupMapping 事务组→集群 从 Nacos 读
Sentinel ↔ Nacos: 流控/降级规则用 NacosDataSource 持久化并动态推送(控制台内存态重启即丢)
Config ↔ 全组件: 各服务与组件的运行参数统一放 Nacos 配置, 灰度推送生效
调用侧: OpenFeign(或 Dubbo) 是"跑在这些治理组件之上"的通道, 需与 Sentinel/Seata 显式集成
```

## 三、同一服务"限流 + 全局事务"的接入顺序

```java
// 目的：理清一次跨服务写操作里 Sentinel/Seata/Feign 的先后与传播要点
@GlobalTransactional            // 结果：拉起 Seata 全局事务, 生成 xid; 必须在真正调下游前进入此边界
public void createOrder(OrderDto d) {
    orderApi.deduct(d);         // 说明：OpenFeign 调下游; 需 RequestInterceptor 把 TX_XID 放进请求头, 下游分支才挂到同一全局事务
    // 反例：忘了传播 xid ❌ 下游各分支游离于全局事务, 回滚时管不到 → 分布式数据不一致 ❌
}
// 入口另配 Sentinel 流控(资源=该接口); 顺序=先限流挡量→再开全局事务→再 Feign 调下游
// Sentinel fallback 的降级返回要在事务边界外妥善处置, 别把半成品写提交进全局事务
```

## 四、坑与底线

- **先对齐版本再集成**：SCA BOM + Boot/Cloud 兼容矩阵，避免三个 starter 互相打架。
- **显式开关**：`feign.sentinel.enabled=true`、Seata DataSource 代理、Sentinel 规则 NacosDataSource，缺一不可。
- **上下文要传播**：Seata xid 随 Feign 头透传，是"全局事务覆盖下游分支"的生命线。

## 五、关联课程

组件全景与选型地图承接 [微服务组件选型地图](./S1-1-Lesson.md)；Sentinel 限流资源与降级见 [滑动窗口与流控效果](../../sentinel/s1/S1-1-Lesson.md)；Seata 全局事务与分支见 [AT 模式与全局锁](../../seata/s1/S1-1-Lesson.md)；注册/配置底座见 [服务注册发现与心跳模型](../../nacos/s1/S1-1-Lesson.md)。
