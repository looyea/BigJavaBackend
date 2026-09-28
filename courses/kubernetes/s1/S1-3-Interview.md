# 探针与优雅停机 · 面试题

## 题 1：liveness、readiness、startup 三探针各解决什么？

- liveness：进程是否"活着"，失败→重启容器（治死锁/假死）；readiness：是否"可服务"，失败→摘流量不重启（控接流时机）；startup：慢启动一次性豁免，成功后才放行前两者（示例：90s 冷启动的 Spring 靠它避免被 liveness 误杀）。
- 一句话记忆：liveness 管"该不该重启"，readiness 管"该不该给流量"，startup 管"启动预算"。
- 加分：三者探测端点应不同——liveness 用无依赖的轻检查，readiness 用含关键依赖的组。

## 题 2：为什么 liveness 不该探测数据库连接？

- DB 抖动时含依赖的 liveness 端点会失败 → 全部 Pod 被重启（结果：本可等 DB 恢复的临时故障，被放大成全实例雪崩、重启风暴抢资源）。
- 正确：依赖可用性交给 readiness（摘流等恢复），liveness 只判进程自身是否卡死（异常链：一次 DB 慢查询演变成集群反复重启）。
- 追问：那 OOM 后假死靠什么？答：liveness 探一个纯进程级端点，或结合 ExitOnOutOfMemoryError 让它干净退出（关联 docker s1-3）。

## 题 3：滚动发布总有零星 502，从停机时序解释并给方案。

```text
图目的：根因是"摘流"与"关进程"并发、摘流传播慢。
删除开始 → EndpointSlice 移除该 Pod（要经 kube-proxy 各节点同步，有延迟）‖ 同时 preStop→SIGTERM→应用排空→退出
在途窗口：别的节点流量规则还没更新，请求仍打到正在关闭的 Pod → 502/reset
方案：preStop sleep 5~10 等摘流传播 + server.shutdown=graceful 排在途 + 宽限期>两者之和 + exec 入口保证 SIGTERM 可达
```

## 题 4：terminationGracePeriodSeconds 从哪一刻开始计时？

- 从 Pod 被标删除、进入终止流程开始（preStop 执行时间也算在内），不是从 SIGTERM 起算（结果：preStop sleep 8 + 排空 20 就需要宽限期至少 28+，默认 30 可能不够）。
- 超期未退出发 SIGKILL 强杀（异常：大流量长任务服务被硬切，优雅配置全废）——宽限期要与 preStop/排空做算术匹配。

## 题 5：preStop 里那个 `sleep` 是不是浪费时间？能不能去掉？

- 不是浪费，是补偿"摘流传播延迟"的最低成本手段（目的：给 kube-proxy/IPVS/Ingress 后端更新留出收敛时间）。
- 去掉的后果：回到题 3 的 502 窗口（错误做法：嫌慢删掉 sleep，用更激进的 SIGTERM）。
- 更优解方向：确保摘流先于关闭的更强保证——如外部通过 readiness 主动置未就绪再关、或用 mesh 的连接排空（istio s1-2），但 sleep 仍是通用性价比首选。

## 题 6：Java 作为 PID 1 收不到 SIGTERM，怎么排查和修？

- 排查：容器里 `ps` 看 1 号进程是不是 sh（ENTRYPOINT shell 形式会包一层 sh -c）；配了 graceful 却从不见 "Shutting down" 日志是信号没到的信号（异常：K8s 发了 TERM，java 只收到最后的 KILL）。
- 修法：ENTRYPOINT 用 exec 数组形式让 java 直接成主进程，或引入 tini/dumb-init 转发信号（关联 docker s1-2/s2-3 规范）。
- 说明：这与探针独立——即便宽限期足够，信号到不了应用也谈不上优雅排空。
