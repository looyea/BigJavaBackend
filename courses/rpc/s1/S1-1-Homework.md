# RPC 原理与 Dubbo 架构 · 作业

## 作业 1：Dubbo 服务暴露与引用

**目标**：搭建 Provider + Consumer 完成一次 RPC 调用。

1. 定义公共接口模块 `dubbo-api`（OrderService + DTO）。
2. Provider：@DubboService 暴露 → 注册到 Nacos。
3. Consumer：@DubboReference 引用 → 控制台调用 → 观察注册中心 URL。
4. 故意不启 Provider → 验证 "No provider available" 异常。

## 作业 2：负载均衡观察

**目标**：启动 3 个 Provider 实例，观察流量分配。

1. 同一接口在 3 个端口启动（权重分别 100/200/300）。
2. Consumer 发 600 次调用 → 统计各实例命中数（应约 100/200/300）。
3. 切换 loadbalance=leastactive → 模拟某实例变慢 → 流量自动偏移到活跃低的节点。

## 作业 3：集群容错策略对比

**目标**：验证 failover vs failfast 行为差异。

1. 启动 2 个 Provider 实例。
2. failover(retries=1)：kill 第一个 → 自动重试第二个 → 调用成功。
3. failfast：kill 唯一 Provider → 立即抛异常不重试。
4. 统计日志中的实际调用次数。
