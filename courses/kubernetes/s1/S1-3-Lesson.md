# 探针与优雅停机

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：分清 liveness/readiness/startup 三种探针各自的职责与误配后果，掌握 Pod 删除时序与 preStop 优雅停机链路，能落地"零停机发布"的完整配置。

## 一、三探针各司其职（配错比没配更糟）

```yaml
# Spring Boot 3  actuator 原生三端点：/actuator/health/liveness、/readiness、/startup
containers:
- name: app
  image: shop-order:1.0
  startupProbe: { httpGet: { path: /actuator/health/startup }, failureThreshold: 30, periodSeconds: 5 }
  livenessProbe: { httpGet: { path: /actuator/health/liveness }, periodSeconds: 10 }
  readinessProbe: { httpGet: { path: /actuator/health/readiness }, periodSeconds: 5 }
# startup：慢启动应用的"豁免期"，跑通前压制另两个探针（30×5=150s 预算）
# liveness：不健康→重启容器（管"死循环/卡死"）；readiness：没就绪→摘出 Service 流量（管"能不能接请求"）
# 错误配置①：liveness 打到 readiness 端点（依赖 DB 的聚合健康）→ DB 抖动时全量 Pod 被集体重启（雪崩放大器）
# 错误配置②：liveness 探测过重（含外部依赖）→ 超时误杀好端端的进程（异常：重启原因全是 liveness failed）
```

## 二、探针选择速查

| 问题 | 该用谁 | 为什么 |
|------|--------|--------|
| 进程死锁/OOM 后半死不活 | liveness | 重启是唯一恢复手段 |
| 启动要 60s（Spring 大应用） | startup + readiness | startup 兜启动预算，readiness 控接流时机 |
| 依赖（DB/MQ）短暂不可用 | readiness（不配 liveness！） | 等依赖恢复自动回流量，重启没用还扩大故障 |
| 发布时"预热完才接流" | readiness | 语义即"可服务"（预热/注册完成后再 ready） |

## 三、Pod 删除时序：优雅停机不是"杀进程"那么简单

```text
图目的：kubectl delete pod（或滚动发布换 Pod）时各方动作的并发时序。
1 API Server 标 deletionTimestamp → 2 该 Pod IP 从 EndpointSlice 摘除（readiness 不再代表接流资格）
3 kubelet 并行执行 preStop 钩子 → 4 发 SIGTERM 给容器主进程 → 5 宽限期(terminationGracePeriodSeconds,默认30s)到 → SIGKILL
结果：2 与 3~4 是并发传播的——kube-proxy/IPVS 规则更新有延迟，SIGTERM 到得快时会有"已摘流中的新请求仍在进入"的窗口（经典 502/连接重置根因）。
```

## 四、零停机发布的完整配置

```yaml
containers:
- name: app
  lifecycle:
    preStop:
      exec: { command: ["/bin/sh","-c","sleep 10; curl -s -X POST http://localhost:8080/actuator/shutdown || true"] }
      # 目的：先 sleep 10 让"摘流量"在集群各处生效，再触发应用优雅关闭（Spring graceful shutdown 排空在途请求）
  terminationGracePeriodSeconds: 45   # 必须 > preStop sleep + 应用排空时间（错误配置：宽限期 30 < 排空 40 → SIGKILL 硬切）
```

```properties
# application.properties 侧配套：
server.shutdown=graceful               # Spring 收到 SIGTERM 后停止接新请求、等在途完成
spring.lifecycle.timeout-per-shutdown-phase=30s
```

- 补充细节：PID 1 问题——ENTRYPOINT shell 形式会让 bash 当 1 号进程、SIGTERM 到不了 java（用 exec 形式或 tini/dumb-init，呼应 docker s1-2 规范第 5 条）。

## 五、探针引发的两类经典事故

1. liveness 过载误杀：高峰期 CPU 被 throttle（docker s1-3），探针响应超时 → 批量重启 → 容量骤降 → 更高负载级联（异常链：一次发布演成集群雪崩）。缓解：高峰冻结 liveness（运维开关）、periodSeconds/timeoutSeconds 放宽。
2. 滚动发布读到"半启动"实例：readiness 配得太早/太松（只探 / 返回 200 但连接池没建）——正确姿势是 readiness 用包含关键依赖就绪的组（Boot 的 readiness group 就是为此设计）（说明：探针端点本身值得写成代码评审项）。

## 六、关联技术

- 本节是 s1-2 滚动发布"稳"的另一半：readiness 管进、preStop 管出；HPA 扩缩同样触发删除流程（见 s3-1）。
- Istio/Linkerd sidecar 的退出顺序与本时序有交互（其增强方案见 istio s1-2）；探针失败属可观测事件，接入 prometheus 告警（关联）。
