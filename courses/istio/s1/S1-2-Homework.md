# VirtualService/DestinationRule 流量切分 · 作业

## 作业 1：bookinfo 金丝雀全流程

**目标**：手动跑完 header→权重→全量→回滚。

1. DR 定义 reviews v1/v2 subsets；VS 先配 `end-user: tester → v2`，curl 带/不带该头验证版本（输出 x-review-version 对比）。
2. 改 90/10 权重，脚本发 200 请求统计 v2 实际命中比例，与 10% 偏差多少？说明按请求随机与连接复用的影响。
3. 权重推到 100 后再一键归零回滚，记录从"决定回滚"到"最后一条 v2 流量"的时间（结果应 <5s）。
4. 反例体验：VS 引用未定义的 subset v3 → 观察 503 与 `istioctl analyze` 的输出（说明静默失败形态）。

## 作业 2：镜像与韧性验证

**目标**：影子流量 + 熔断/驱逐的真实行为观测。

1. reviews v2 部署一个"启动即睡 3s"的缺陷版；配 mirror 100% 到 v2，用户侧 P99 应无变化（指标验证：route 仍 v1）。
2. DR 配 outlierDetection（consecutive5xxErrors:3, baseEjectionTime:30s），给 v1 的一个 Pod 注入持续 500（故障注入 VS）：30s 内验证该 endpoint 被驱逐（`istioctl pc endpoint` 看 status）。
3. 驱逐窗口结束后自动回流，曲线记录完整"驱逐-恢复"过程。
4. 思考验收：为什么 maxEjectionPercent=50 时 4 副本只可能同时摘 2 个？写 2 行推导。

## 作业 3：重试风暴实验

**目标**：亲手制造并修复一次放大事故。

1. 链路 gateway→A→B，两层各配 retries:3；让 B 全量 504（sleep 超 perTryTimeout）。
2. 压测记录 B 实际收到的 QPS 与客户端发起 QPS 的比值（结果：接近 9 倍，输出计算）。
3. 修复：仅保留最内层重试 + 外层 timeout 预算（perTryTimeout×attempts < 外层 timeout），复测比值回到 ≈1。
4. 输出团队规范一页：哪一层允许重试（选 ingress 或 sidecar 之一）、retryOn 白名单（幂等 GET 才 5xx 重试）、重试预算公式。
