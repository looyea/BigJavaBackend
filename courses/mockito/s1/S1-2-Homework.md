# 注解注入、ArgumentCaptor 与深度 Stub · 作业

## 作业 1：@InjectMocks 静默失败实验（动手题）

**目标**：亲眼见一次"依赖没注上、NPE 在运行期炸"的完整链路。

**任务**：
1. 被测类有三个构造器依赖，故意只声明两个 @Mock 跑 @InjectMocks，记录现象（对象仍被创建、缺失字段为 null、首个调用 NPE）；
2. 换成同类型两个 mock（如两个 RedisTemplate 语义的客户端）但字段名与被测类参数名不一致，演示按名匹配失败；
3. 最终改造为"显式 new + @Mock 字段"风格，写 100 字结论：何时值得用 @InjectMocks。

**验收标准**：两种失败都有栈证据；结论明确"依赖 >3 或同类型多依赖时显式构造更稳"。

## 作业 2：Captor 断言出站消息（工程题）

**目标**：为一个"退款成功发两条通知（站内信+短信）"的需求写内容级断言。

**任务**：
1. Stub `refundGateway` 返回成功，被测 service 调用 `notifier.send(msg)` 两次，msg 含 channel/orderNo/amount/templateId 四字段；
2. 用 ArgumentCaptor.getAllValues() + assertAll 对两条消息逐字段断言（金额用 compareTo）；
3. 再分别用"两个 argThat 的 verify"实现一遍，故意改坏 templateId 比较两种写法的失败报告可读性；
4. 反例体验：被测代码发送后把消息对象复用清空，观察捕获引用"被原地修改"的坑，并用 thenAnswer/新建对象修复。

**验收标准**：提交第 3 步两种失败报告对比；能说出 captor 捕获的是引用而非快照。

## 作业 3：深度 Stub 评审清单（文档题）

**目标**：给仓库里（或自选一段链式调用代码）的 RETURNS_DEEP_STUBS 使用做取舍评审。

**任务**：找/造三处链式打桩——①第三方 SDK 只读响应对象图；②自己域内 `ctx.getTenant().getLimits().getQps()`；③需要验证"tenant 为 null 时降级"的路径。分别判定：保留深度 stub / 重构拍平 / 必须显式打 null 桩，并各写一条理由与改造代码草案。

**验收标准**：③的判定必须是"显式桩返回 null 再断言降级"，说明深度 stub 为何永远测不到该分支。
