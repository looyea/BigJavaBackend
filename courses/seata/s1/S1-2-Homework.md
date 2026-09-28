# TCC / Saga / XA 与模式选型 · 作业

## 作业 1：TCC 账户冻结

**目标**：实现余额冻结 TCC 接口。

1. 建 t_account(id, balance, frozen) 表。
2. 实现 tryFreeze/confirm/cancel 三方法。
3. 幂等表：`tcc_action_log(xid, branch_id, status)` 防重复执行。
4. 模拟空回滚：跳过 Try 直接调 Cancel → 应判空返回 true。
5. 模拟悬挂：Cancel 先到 Try 后到 → Try 检查有 Cancel 记录则不执行。

## 作业 2：Saga 订单履约

**目标**：3 步 Saga 编排（创建订单→扣库存→发货）。

1. 定义状态机 JSON（Step1→Step2→Step3，各配 compensationMethod）。
2. Step2 故意抛异常 → 观察 Step1 被补偿（删订单）。
3. 验证补偿幂等：手动重复调 cancelStock → 第二次 no-op。

## 作业 3：模式选型报告

**目标**：为 3 个业务场景选择 Seata 模式。

1. 电商下单（库存+订单+余额）。
2. 银行跨行转账（双方核心系统）。
3. SaaS 用户注册（创建账号+初始化配置+发欢迎邮件）。
