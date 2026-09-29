# Workflow/Activity 与重放

> 本节难度：★★★★★
> 重要程度：★★★☆☆
> 学习产出：能讲清 Temporal 用"持久化工作流 + 事件历史重放"把长事务状态外置的机制，理解 Workflow 代码必须**确定性**（禁止直接随机/系统时间/裸 IO，副作用一律下沉到 Activity）；掌握 Activity 的重试策略（初值/上限/指数退避/最大次数/非重试错误）、Workflow 与 Activity 的职责边界；能用 versioning/patching 处理**正在运行的老版本工作流**与新代码共存的升级难题，并识破"在 Workflow 里直接调用 HTTP""重放时读取当前时间导致不确定"等典型反模式。

## 一、为什么需要持久化工作流

跨服务、跨小时甚至跨天的业务流程（下单→扣库存→支付→发货），用 if/else + 本地变量写会因进程重启而丢状态。Temporal 把"执行到哪一步"变成可重放的事件流。

```text
图目的：把内存里的调用栈换成数据库里的事件历史
普通代码：状态在进程内存，宕机即丢，重试靠人肉/补偿脚本
Temporal：Workflow 的每一步(执行了哪个 Activity、返回什么)记为 Event History
恢复=从空状态重放 Event History，代码重新执行同样的分支 → "看起来从没断过"
代价：既然是重放，同样的输入必须产生同样的执行路径——确定性是生命线
```

## 二、确定性：Workflow 代码的第一戒律

重放时不能真的再执行副作用，只能"喂"历史记录里缓存的结果，所以 Workflow 侧被禁止做不确定操作。

```java
// 目的：区分哪些能写在 Workflow、哪些必须下沉 Activity
workflow.newActivityStub(ChargeActivity.class, opts).charge(req); // 结果：副作用在 Activity，重放读缓存结果
Duration backoff = workflow.newTimer(Duration.ofSeconds(30));     // 说明：计时器由引擎托管，可安全重放
// 反例：在 Workflow 里 new Random()/System.currentTimeMillis()/Instant.now() ❌ 重放产生不同分支，历史对不上→非确定性错误
// 反例：在 Workflow 里直接 HTTP/DB/RPC 调用 ❌ 重放会二次触发副作用（重复扣款），必须包成 Activity
// 反例：Workflow 里读环境变量/全局可变状态来决定流程 ❌ 重放时值可能已变
```

```java
// 目的：正确取"可重放的时间与随机"
Instant now = workflow.now();                       // 结果：来自事件历史的时间戳，重放稳定
int n = Workflow.threadLocalRandom().nextInt(10);   // 说明：由框架种子化，重放可复现
```

## 三、Activity 与重试策略

副作用被隔离在 Activity，失败由框架按策略自动重试，业务代码不写重试循环。

```java
// 目的：给一个网络型 Activity 配置退避重试
RetryOptions ro = RetryOptions.newBuilder()
    .setInitialInterval(Duration.ofSeconds(1))       // 首次退避
    .setBackoffCoefficient(2.0)                       // 指数退避系数
    .setMaximumInterval(Duration.ofSeconds(30))       // 退避上限
    .setMaximumAttempts(5)                            // 最多 5 次，防雪崩式无限重试
    .build();
// 反例：对"余额不足/参数非法"这类业务错误也无限重试 ❌ 应标为 NonRetryable，立即失败走补偿
// 反例：Activity 不幂等又设 MaximumAttempts 很大 ❌ 重试叠加造成重复扣减，Activity 必须可安全重入
```

- 可重试 vs 非重试错误要显式分类：`ApplicationInfo.setRetry(false)` / `NonRetryableErrorTypes`。
- Activity 超时（scheduleToClose / startToClose）与重试次数共同兜住"卡死的工作流"。

## 四、版本升级：让老流程和新代码共存

已启动、跑了几天的工作流，其 Event History 是用**旧代码**产生的；部署新代码后重放旧历史不能报错——这就是 workflow 版本化要解决的。

```java
// 目的：给变更过的流程段做版本标记，老历史走老路径、新实例走新路径
int v = Workflow.getVersion("add_fraud_check", Workflow.DEFAULT_VERSION, 2); // 结果：引擎据标记决定分支
if (v >= 2) { fraudCheck(); }                                                  // 说明：新实例执行新增步骤
// 反例：直接修改已有 Workflow 方法的分支逻辑不加版本 ❌ 重放老历史时路径分叉，non-deterministic error
// 反例：删掉一个曾经产生过事件的步骤 ❌ 老历史里还有它的事件，重放对不上，需 patching 保留兼容
```

- 原则：**只增不改**、加版本守卫；确认没有老实例在跑后再清理版本标记。
- 配合 `patching`/`canary` 与合理的 Workflow Execution retention，才能安全灰度。

## 五、关联课程

Activity 的幂等重试与补偿式一致性，正是 [分布式事务模型全景](../../dist-theory/s2/S2-1-Lesson.md) 中 2PC/TCC/Saga 梯度里 Saga 的工程化落地；强一致补偿可对照 [AT 模式与全局锁](../../seata/s1/S1-1-Lesson.md)；幂等设计的通用手法见 [重复请求的四类解法](../../idempotent/s1/S1-1-Lesson.md)。
