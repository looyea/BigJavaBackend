# HPA/VPA 与资源 request/limit、QoS · 作业

## 作业 1：QoS 档位观察实验

**目标**：亲手验证三档 QoS 与驱逐排序。

1. 部署三个 demo Pod（Guaranteed/Burstable/BestEffort 各一），`kubectl get pod -o jsonpath='{.status.qosClass}'` 逐个确认档位（输出：三档判定结果）。
2. kind/minikube 环境把节点内存压满（dd 或 stress Pod），观察 `kubectl get events` 中驱逐顺序（验收：BestEffort 首个 Evicted 的事件截图）。
3. 给 BestEffort Pod 补上 request 复跑，对比不再被首选（错误用例修复体验）。

## 作业 2：HPA 全链路调参

**目标**：搭一套"压测驱动扩容"的可复现链路。

1. 部署 order-service 模拟服务 + metrics-server + CPU 型 HPA（min 2/max 10，目标 60%），用 jmeter 阶梯加压（说明：每档保持 3 分钟让 HPA 有反应窗口）。
2. 记录三个时点的 replicas、CPU 利用率、request 值于同一张表，手工复算利用率分母验证"分母是 request"（验收：一张扩容时间线图）。
3. 把 request 从 500m 改成 1 再压一次，对比扩容灵敏度差异；再加 behavior.scaleDown.stabilizationWindowSeconds=300 观察缩容冷静期（输出：两组对比曲线）。

## 作业 3：容量事故复盘报告

**目标**：写一页 runbook 覆盖两类高频异常。

1. 场景 A：OOMKilled exit 137 反复重启——按 memory limit、MaxRAMPercentage、堆外内存的顺序列出定位步骤（至少 3 条命令级动作）。
2. 场景 B：HPA 显示 `<unknown>` 不扩容——从 metrics-server 存活、APIService Available、时间同步三点排查（结果：每点给出判定命令与期望输出）。
3. 两个场景各配一条"预防性配置"改进项并说明理由。
