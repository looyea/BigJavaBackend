# Deployment、ReplicaSet 与滚动发布回滚

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：掌握 Deployment→ReplicaSet→Pod 的版本链模型，能配出安全的滚动发布参数（maxSurge/maxUnavailable），会用 revision 历史回滚，并理解金丝雀/蓝绿在原生 K8s 的实现方式与局限。

## 一、版本链：Deployment 管"发布"，ReplicaSet 管"副本"

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: shop-order }
spec:
  replicas: 4
  strategy:
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }   # 目的：先多发 1 个新的，确认就绪才杀 1 个旧的
  selector: { matchLabels: { app: order } }
  template:
    metadata: { labels: { app: order } }
    spec:
      containers: [ { name: app, image: shop-order:1.0 } ]
# 机制：改 template（如镜像 1.0→1.1）→ 生成新 ReplicaSet（revision+1）→ 新旧 RS 副本数此消彼长
# 反例：改 labels/selector 让新旧 RS 都匹配不上 → 发布卡死或 Pod 被误删（异常：selector 一旦定死不要改）
```

- 直接手建 ReplicaSet 不管理版本升级——所以约定：**永远操作 Deployment，RS 是它的实现细节**。

## 二、两个旋钮决定发布风险

```text
图目的：以 replicas=4、maxSurge=1、maxUnavailable=0 为例推演一次发布。
t0: 旧 RS 4 / 新 RS 0，总 4        t1: 新 RS 先起 1 → 总 5（surge 超编 1）
t2: 新 Pod ready 后 旧杀 1 → 旧3/新2，总 4    循环直至 旧0/新4
maxSurge=1：峰值多占 1 个 Pod 的资源（容量要预留）；maxUnavailable=0：全程可用副本不低于 4 —— 零缺口发布。
错误配置：maxUnavailable=50% 且 replicas=2 → 高峰期只剩 1 个副本扛全量（异常：容量腰斩引发连锁超时）。
```

- 低延迟/大促场景常用 `maxSurge: 25%, maxUnavailable: 0`：宁可多花资源也要保住服务容量；资源紧张集群反过来调。

## 三、发布观测与回滚：revision 历史

```bash
kubectl rollout status deploy/shop-order            # 阻塞观察直到完成（CI/CD 脚本用它判定发布结果）
kubectl rollout history deploy/shop-order           # 输出：REVISION 列表（CHANGE-CAUSE 记录镜像版本）
kubectl rollout undo deploy/shop-order              # 回到上一版
kubectl rollout undo deploy/shop-order --to-revision=3   # 精确回滚（生产建议显式版本号）
# 说明：undo 本质是把旧 RS 的 template 再当一次"期望"，仍走滚动流程——回滚也是发布，不是瞬移
```

- `revisionHistoryLimit` 控制保留几个旧 RS（默认 10）：留太少没得回、留太多 etcd 里垃圾对象多。

## 四、发布"稳不稳"的守门员是探针

- 滚动推进的前提是新 Pod 通过 readinessProbe 才算"ready"（未配 readiness → 容器一起来就计 ready，滚动照常杀旧——异常：半启动实例接流量雪崩，详见 s1-3）。
- 配合 `minReadySeconds: 10`：新 Pod ready 后再观察 10s 不出事才继续推进（给慢热应用/缓存预热兜底）。
- 完整公式 = 合理 surge/unavailable + 正确探针 + 观察窗口，三者缺一，滚动参数只是心理安慰。

## 五、金丝雀与蓝绿：原生手段与其局限

```yaml
# 原生金丝雀（粗粒度）：手工调两个 Deployment 的副本比例，Service selector 同 label 分流
# 例：stable 9 个 + canary 1 个 → 约 10% 流量进新版；验证 OK 再逐步换
# 局限：按 Pod 数近似流量，无法按请求百分比/头匹配（istio/linkerd 的 TrafficSplit 才是精细金丝雀）
# 蓝绿：两套全量环境 + 切换 Service selector：瞬时全量切换、回滚=切回；代价=双倍资源
```

- 选型口径：发布频率低、要求瞬时切换→蓝绿；要灰度验证且上了 mesh→金丝雀（关联 istio s1-2、linkerd s1-2 的流量切分）。

## 六、关联技术

- readiness/liveness 探针细节与优雅停机见 s1-3；HPA 与滚动发布同时触发的资源博弈见 s3-1。
- GitOps 平台（argocd）把"apply + rollout status 判定"自动化；精细流量发布交给 mesh——原生 K8s 负责"有没有、几个"，mesh 负责"给谁"。
