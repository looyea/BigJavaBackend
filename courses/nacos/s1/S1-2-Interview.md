# 配置中心与灰度推送 · 面试题

## 题 1：长轮询和 gRPC 推送各有什么优缺点？

| 维度 | 长轮询(1.x) | gRPC Stream(2.x) |
|------|------------|-----------------|
| 实时性 | 最高 30s 延迟 | < 100ms |
| 连接开销 | 每 DataId 一个 hold 连接 | 复用一条长连接 |
| 穿透防火墙 | HTTP 天然支持 | 需 HTTP/2 兼容 |
| 实现复杂度 | 简单 | 需维护连接池+心跳 |

## 题 2：@RefreshScope 导致 Bean 状态丢失，如何解决？

- 将无状态配置类（仅 @Value）标 @RefreshScope。
- 有状态组件（计数器/缓存）拆成两个 Bean：ConfigBean(RefreshScope) + StateBean(单例)读 ConfigBean。
- 或使用 `@NacosValue(autoRefreshed = true)` + `EnvironmentChangeEvent` 监听手动更新字段。

## 题 3：Nacos 配置推送后应用未生效，排查思路？

1. 检查 Nacos 控制台是否有该客户端订阅记录。
2. 确认 @RefreshScope 或 @NacosValue 是否标注。
3. 查看应用日志有无 `Refresh keys changed: [...]` 输出。
4. 若日志有但未生效 → Bean 被其他单例直接引用绕过代理 → 检查注入方式。
5. 若日志无 → 推送未到达：gRPC 连接是否断开/防火墙是否拦截 9848 端口。

## 题 4：Beta 灰度与百分比灰度的区别？Nacos 支持哪种？

```text
Nacos：Beta 指定 IP 列表（精确控制机器）。
Apollo：支持应用/集群/Namespace + 百分比灰度。
K8s：Istio VirtualService weight 分流（请求级灰度）。
错误用法：配置灰度 ≠ 流量灰度——配置灰度是"哪些实例用新值"，流量灰度是"哪些请求走新版本"。
```

## 题 5：配置中心全挂对业务的影响与兜底？

- 运行中应用：已有配置在内存中 → 不受影响。
- 新启动应用：读不到配置 → 需 failover 本地文件或环境变量兜底。
- 配置变更期间：推送不可达 → 变更延迟直到恢复。
- 兜底：`nacos.config.failover.path=/opt/config/failover/` + CI 流水线先注入 base 配置。

## 题 6：如何实现配置版本审计？

- Nacos 自带历史版本（保留最近 30 个版本），可对比 diff。
- 生产级方案：配置变更接入审批流（如自建 Pipeline：编辑 → Review → 灰度 → 全量）。
- 关键操作（加密配置修改）对接操作审计日志 → 不可篡改存储 → 满足金融合规。
