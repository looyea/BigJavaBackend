# Deployment、ReplicaSet 与滚动发布回滚 · 作业

## 作业 1：观察版本链

**目标**：看清 Deployment→ReplicaSet→Pod 的换代。

1. 起 deploy(replicas=3, image:1.0)，`kubectl get rs,pod -w`；改 image:1.1 触发发布，观察新 RS 出现、旧 RS 缩到 0（输出：两个 RS 的 DESIRED/READY 变化时间线）。
2. `kubectl rollout history deploy/x` 看 revision，`describe` 一个 revision 看它记录的镜像（验收：能把 revision 与镜像版本对应上）。
3. 回滚 `--to-revision=1`，观察又是一次滚动（结果：回滚非瞬移，旧 RS 副本重新拉起）。

## 作业 2：两个旋钮的实操

**目标**：用可观测现象理解 surge/unavailable。

1. 配 maxUnavailable=0/maxSurge=1 发布，全程 `kubectl get pods -w` 观察总 Pod 数会短暂变 4（surge）再回 3（输出：超编证据）。
2. 反例：把 replicas 设 2、maxUnavailable=50% 发布，模拟观察某时刻只剩 1 个 Available（错误用例：容量骤降，配合压测看 QPS 是否扛不住）。
3. 不配 readinessProbe 直接发布复现"新 Pod 未就绪就被计入并推进"，再加 readiness 对比发布节奏差异（验收：加探针后 rollout 明显更稳）。

## 作业 3：粗粒度金丝雀

**目标**：用两个 Deployment 做一次 90/10 分流。

1. 建 stable(replicas=9) 与 canary(replicas=1)，二者 label 被同一 Service selector 命中（验收：`kubectl get endpoints` 含全部 10 个 Pod IP）。
2. 压测统计约 10% 请求落到 canary（看 canary Pod 日志计数），逐步把 canary 提到 3 再回收到 0（说明：比例靠副本数近似，非精确）。
3. 记录局限：无法按用户/请求头分流（错误预期：以为原生能做精细灰度），写出"要精细化该上什么"（提示：mesh TrafficSplit）。
