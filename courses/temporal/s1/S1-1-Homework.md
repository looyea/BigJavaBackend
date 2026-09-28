# Workflow/Activity 与重放 · 作业

## 作业 1：把一个"下单履约"流程改写成 Temporal Workflow

- 目标：实践 Workflow/Activity 的职责边界。
- 任务：将"创建订单→扣库存→支付→通知发货→超时未支付则取消"实现为一个 Workflow：所有外部调用（库存/支付/通知）定义为 Activity，等待用 `workflow.newTimer`，分支编排留在 Workflow；用 `workflow.now()` 记录时间戳。
- 验收标准：Workflow 代码中不出现 `System.currentTimeMillis()`、`new Random()`、直接 HTTP/DB 调用；进程重启后同一工作流能从事件历史恢复并继续；每个 Activity 有幂等键。
- 参考解法要点：副作用下沉 Activity、时间/随机走框架 API、Timer 保证可重放；扣款类 Activity 必须可安全重入。

## 作业 2：设计 Activity 的重试与错误分类

- 目标：让"该重试的自动退避、不该重试的立即失败"。
- 任务：给支付 Activity 配 `RetryOptions`（initial 1s、backoff 2.0、maxInterval 30s、maxAttempts 5）；把"网络超时/5xx"设为可重试、"余额不足/风控拒绝"用 `ApplicationInfo.setRetry(false)` 标为不可重试；不可重试时进入补偿（回滚库存、订单置失败）。
- 验收标准：注入瞬时故障触发退避重试且总次数受限；注入业务错误不重试、直接走补偿分支；说明 MaximumAttempts 过大 + Activity 不幂等会造成的重复扣减风险。
- 参考解法要点：重试次数与 scheduleToClose 超时联合兜底；错误类型驱动重试策略而非一刀切。

## 作业 3：给一个运行中的工作流做无损版本升级

- 目标：在存在老实例的前提下安全上线新逻辑。
- 任务：在一个已部署、有跨天实例在跑的工作流中，于支付后**新增**一步风控校验；用 `Workflow.getVersion("add_risk_check", DEFAULT_VERSION, 1)` 守卫新步骤，使老实例重放老历史不报错、新实例执行风控；写清"何时可以移除该版本标记"的判断依据。
- 验收标准：老实例（旧历史）重放通过、新实例走新分支；不删改任何曾产生事件的旧步骤；给出清理版本守卫的前置条件（确认无老实例在跑 + 超过 retention）。
- 参考解法要点：只增不改；版本标记是"给重放用的分叉开关"；过早删除会让仍在重放老历史的实例崩溃。
