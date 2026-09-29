# 微服务组件选型地图

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：掌握微服务注册/配置/网关/熔断/事务/可观测性六层选型全景，能根据团队规模和技术栈做出合理决策。

## 一、六层架构模型

```text
┌─────────────────────────────────────────────────┐
│  可观测层  SkyWalking / OpenTelemetry / Prometheus │
├─────────────────────────────────────────────────┤
│  事务层    Seata AT/TCC/Saga                      │
├─────────────────────────────────────────────────┤
│  流量治理  Sentinel / Hystrix / Resilience4j      │
├─────────────────────────────────────────────────┤
│  网关层    SCG / Kong / APISIX                   │
├─────────────────────────────────────────────────┤
│  注册+配置  Nacos / Consul / Eureka / Apollo      │
├─────────────────────────────────────────────────┤
│  通信层    OpenFeign / Dubbo / gRPC              │
└─────────────────────────────────────────────────┘
```

## 二、各层选型对比

### 2.1 注册与配置中心

| 方案 | CAP | 配置管理 | 国内生态 |
|------|-----|----------|----------|
| Nacos | AP+CP 可切换 | 内置灰度/加密 | Spring Cloud Alibaba 首选 |
| Consul | CP | KV + Watch | HashiCorp 全家桶 |
| Eureka | AP | 无 | 停更，不再推荐新项目 |
| ZooKeeper | CP | 需外挂 | Dubbo 传统方案 |
| Apollo | - | 专业配置中心 | 携程开源，功能最全 |

### 2.2 网关

```java
// 目的：选型判断——需要灵活路由规则+响应式 → SCG；需要插件生态+高性能 → APISIX
// SCG：Java 技术栈、与 Spring Security/OAuth2 无缝集成
// Kong/APISIX：独立部署、多语言后端、插件热加载、吞吐 10w+ QPS
// 错误用法：小团队用 APISIX 但无运维能力 → 反而增加故障面
```

### 2.3 流量治理

| 方案 | 特点 | 现状 |
|------|------|------|
| Sentinel | 阿里开源，规则丰富（流控/熔断/热点/系统） | SC Alibaba 标配 |
| Resilience4j | 轻量、函数式 | Spring Cloud 官方推荐替代 Hystrix |
| Hystrix | Netflix 出品 | 已停更 |

### 2.4 分布式事务

| 模式 | 一致性 | 侵入度 | 场景 |
|------|--------|--------|------|
| Seata AT | 最终一致（自动补偿） | 低（仅加注解） | 内部服务 CRUD |
| Seata TCC | 最终一致（手动 Try/Confirm/Cancel） | 高 | 金融资金操作 |
| Seata Saga | 最终一致（长流程编排） | 中 | 跨多服务长事务 |
| XA | 强一致（2PC） | 低 | DB 原生支持，性能差 |

### 2.5 可观测性

- **链路追踪**：SkyWalking（国内主流）/ OpenTelemetry（厂商中立）。
- **指标**：Micrometer → Prometheus → Grafana。
- **日志**：ELK / Loki。

## 三、Spring Cloud Alibaba 全家桶

```yaml
# 目的：典型 Spring Cloud Alibaba 项目依赖组合
spring:
  cloud:
    nacos:
      discovery:
        server-addr: nacos:8848   # 结果：服务注册发现
      config:
        server-addr: nacos:8848   # 说明：配置中心统一入口
    gateway:                      # 网关层（独立部署）
      routes:
        - id: order-service
          uri: lb://order-service # 输出：负载均衡到 Nacos 注册实例
    sentinel:
      transport:
        dashboard: sentinel:8080  # 结果：流控熔断规则管理
```

## 四、选型决策树

1. **已有 Dubbo RPC + ZK** → 保留 Dubbo + 补 Nacos 做配置。
2. **全新 Spring Cloud 项目** → Nacos + SCG + Sentinel + Seata + OpenFeign。
3. **超大流量（> 50w QPS）入口** → APISIX/Kong + 后端 Spring Cloud。
4. **金融合规** → Nacos + Seata TCC + 自建可观测。

## 五、关联技术

- Spring Cloud CircuitBreaker（抽象层，底层可选 Resilience4j/Sentinel）
- Apache ShenYu（国产响应式网关）
- Dapr Sidecar 微服务运行时（云原生新范式）
