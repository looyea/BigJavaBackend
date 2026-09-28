# 火焰图、JVM 仪表盘与诊断联动（关联） · 作业

### 作业 1：用 dashboard + thread 定位一个 CPU 飙高线程

- 目标：练"先定域再下钻"的排查习惯，而不是盲目 dump。
- 任务：写一个忙循环或密集正则的方法压高某线程 CPU，用 arthas `dashboard` 观察整体、`thread -n 3` 找到最忙线程并贴出其栈，定位到具体方法。记录"CPU 使用率—线程—栈帧"的对应关系。
- 验收标准：能从 dashboard 判断问题域，用 thread 精确定位到制造热点的方法栈，全程未使用 heapdump。
- 参考解法要点：`thread --state`/`-b` 看阻塞；解释为何 CPU 高先看线程栈而非堆。

### 作业 2：用 profiler 在线产出火焰图并识别采样偏差

- 目标：掌握 arthas profiler 的成对使用与火焰图判读。
- 任务：对作业 1 的接口执行 `profiler start --event cpu`，跑 20s 后 `profiler stop --file`，打开火焰图找出最宽的业务帧；再用 `--event alloc` 产一张分配火焰图对比。观察图中是否含 JIT/编译帧并说明应如何剔除。最后用 `profiler status` 确认已停止采样。
- 验收标准：能产出 cpu 与 alloc 两张图并指出各自热点；能解释安全点偏差导致的编译帧非业务热点；start/stop 成对、无常驻开销。
- 参考解法要点：profiler 封装 async-profiler；宽帧=占比高；短窗口低占空比。

### 作业 3：vmtool 定位对象堆积并评估是否需要 heapdump

- 目标：区分"轻量查实例"与"重 dump 找引用链"的使用边界。
- 任务：制造一个只增不减的本地缓存/集合导致某类实例暴涨，用 `vmtool getInstances --className ... `查看实例数量级定位可疑对象；说明在什么信息下才升级为 `heapdump` 并用 MAT 看引用链，以及 dump 前需要评估的 STW 风险。
- 验收标准：能用 vmtool 给出"哪类对象堆积"的初步结论；能讲清 heapdump 的代价与"导到隔离机分析"的流程。
- 参考解法要点：vmtool 直取实例、比重操作轻；heapdump 触发 STW，择机+隔离分析。
