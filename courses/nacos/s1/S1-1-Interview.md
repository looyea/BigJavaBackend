# 服务注册发现与心跳模型 · 面试题

## 题 1：Nacos 中临时实例与持久实例的核心区别？

| 维度 | 临时实例 | 持久实例 |
|------|----------|----------|
| 生命周期 | 心跳维持，超时自动摘除 | 注册后永久存在，需手动删除 |
| 健康检查 | 客户端心跳 | 服务端主动探测 |
| 一致性协议 | Distro（AP） | Raft（CP） |
| 适用 | 微服务应用实例 | DB/Redis/Nginx 等基础设施 |

## 题 2：Distro 协议下为什么选 AP 而不是 CP？

微服务注册场景核心诉求：**可用性优先**。
- 网络分区时若选 CP → 少数派无法注册/发现 → 整个调用链断裂。
- 选 AP → 多数派继续服务 → 分区恢复后数据最终一致 → 秒级延迟可接受。

## 题 3：Nacos 2.x gRPC 长连接解决了什么问题？

- 1.x HTTP 轮询：配置变更推送延迟高达 30s。
- 2.x gRPC：Server 主动推 → 毫秒级；减少大量短连接开销。
- 客户端连接断开 → 会话级 → 快速感知实例离线（无需等 30s 心跳超时）。

## 题 4：服务列表推送失败怎么办？

```java
// 目的：SDK 内置容灾——推送失败后回退到轮询
// 说明：NacosNamingService 订阅时注册 PushReceiver + 定时 Pull（6s）
ScheduledExecutorService pull = Executors.newSingleThreadScheduledExecutor();
pull.scheduleAtFixedRate(() -> {
    // 结果：即使推送丢失，最多 6s 延迟后轮询补回
    List<Instance> latest = selectInstances(serviceName, true);
    if (!latest.equals(cached)) updateCache(latest);
}, 0, 6, TimeUnit.SECONDS);
// 错误用法：关闭轮询只依赖推送 → UDP 包丢失则永远拿不到更新
```

## 题 5：如何避免"注册中心抖动导致服务列表清空"？

- 开启 failover 模式：`nacos.naming.failover=true`，本地文件缓存兜底。
- 客户端 `getInstances` 空列表保护：若返回空但缓存非空 → 使用缓存。
- 运维侧：Nacos 集群 ≥3 节点，避免单节点重启触发全量摘除。

## 题 6：Nacos 与 K8s Service 注册的对比？

| 维度 | Nacos | K8s Service + CoreDNS |
|------|-------|----------------------|
| 健康检查 | 心跳/主动探测 | Readiness/Liveness Probe |
| 元数据 | 丰富自定义 KV | Label/Annotation |
| 灰度 | metadata 版本 + 权重 | Istio VirtualService |
| 跨云 | 天然支持 | 需联邦集群 |
| 语言无关 | SDK 多语言 | DNS 解析即可 |
