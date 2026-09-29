# 分布式事务模型全景

> 本节难度：★★★★★
> 重要程度：★★★★★
> 学习产出：能按"锁持有时间/隔离性/一致性到达方式"三个坐标给 2PC、3PC、TCC、Saga、本地消息表、事务消息定位；说清每种模型的失败窗口（Coordinator 单点、悬挂/空回滚、补偿不可逆）；为电商下单、金融转账、电力缴费三类场景各选出一个可辩护的方案并写清兜底对账。

```flow
例子目的：一张图看懂两大家族——强一致家族（同步阻塞等决议）与柔性家族（先把本地做完，再异步收敛）
2PC家族: 准备(锁资源) -> 提交/回滚(全体表决) -> 立即全局可见
TCC: Try(预留冻结) -> Confirm(扣冻结) / Cancel(释放冻结) -> 业务级两阶段
Saga: T1成功 -> T2成功 -> T2失败? -> 补偿C2 -> 补偿C1 -> 最终一致
消息家族: 本地事务+消息落库 -> 投递 -> 消费方幂等执行 -> 失败重投+对账兜底
```

## 一、先给"分布式事务"定义清楚要什么

单机 ACID 的 D（durability）与 I（isolation）由存储引擎与锁兜底；跨服务后问题变成：

- **原子性**：A 服务成功、B 服务失败时，如何"当作都没发生"——要么回滚 A（可逆），要么补偿 A（语义抵消），要么阻止 B 被看见（隔离）；
- **隔离性**：中间态（已扣款未发货）允不允许被第三方读到？允许 → 柔性事务；不允许 → 必须同步阻塞；
- **收敛性**：网络分区、进程崩溃后，系统能否**自动**到达终态——这是模型选型的真正分水岭。

## 二、2PC / 3PC：数据库时代的强一致

**2PC（XA 协议母本）**：Coordinator 发 `prepare`（各参与者写 redo/undo、锁住资源回 yes/no）→ 全 yes 则 `commit`，任一 no 则 `rollback`。

致命窗口：**prepare 已回复 yes 之后 Coordinator 崩溃**——参与者锁着资源无法自主决定（阻塞式协议）；3PC 引入 `canCommit/preCommit/commit` 三态与超时自决，但那是拿"网络分区时可能两侧都做不同决定"换阻塞缓解——在真实 WAN 里 3PC 反而更易不一致，工程上几乎没人部署 3PC。

```java
// 例子目的：展示 2PC 最容易被忽略的坑——prepare 成功但 commit 丢失后，靠"恢复日志"而不是靠协调者重试来兜底
class XaParticipantStub {
    void prepare(TxLog log) throws Exception {
        db.execute("UPDATE account SET balance=balance-100 WHERE id=1");   // 例子：本地执行但不提交
        log.append("PREPARED xid=TX9");   // 目的：先写 XA 恢复日志（redo），崩溃后重启据此找回这个"悬空事务"
        // 错误用法：只依赖内存状态等待 commit——结果：进程重启后无人知道 TX9 曾 PREPARED，资源永久锁死或悄悄回滚
    }
    void recoverFromLog(TxLog log) {       // 说明：真正的 2PC 参与者必须有此恢复线程
        for (String xid : log.listPrepared()) {          // 输出：重启后扫描出 TX9
            if (coordinator.query(xid) == COMMIT) db.commit(xid);   // 目的：问协调者要终态决议
            else db.rollback(xid);                     // 结果：查不到决议且超时则回滚——这正是"阻塞式"代价的体现
        }
    }
}
```

工程定位：Seata AT / XA 数据源本质仍是 2PC 家族，适合**同库多服务或强合规场景**（金融账务），代价是吞吐（锁到提交）与协调者高可用设计。

## 三、TCC：业务层的柔性 2PC

Try 预留（冻结额度）、Confirm 用掉预留、Cancel 释放预留。与 2PC 的区别：**资源锁定从数据库行升到业务语义**，锁粒度小、可超时长。三个必防的异常：

- **空回滚**：Try 没执行 Cancel 先到 → Cancel 要识别"无 Try 记录"直接返回成功；
- **悬挂**：Try 迟到于 Cancel → Try 前查"是否已 Cancel"，有则拒绝执行；
- **幂等**：Confirm/Cancel 会重试 → 事务状态表 + 状态机更新。

```java
// 例子目的：一份防"空回滚+悬挂"的 TCC 冻结账户 Try/Cancel 实现骨架
class FreezeTccService {
    String txId;                              // 分支事务ID：全链路唯一，幂等与悬挂判定的钥匙
    public boolean tryFreeze(long acct, long amt) {
        if (tccLog.existsCancel(txId)) return false;      // 目的：Cancel 已先行（悬挂场景）——拒绝这次迟到的 Try
        int n = tccLog.insertTry(txId, acct, amt);        // 例子：try 记录带 UNIQUE(txId)，重试撞键即幂等跳过
        if (n == 0) return true;                           // 输出：重复 Try，前次已冻结，直接视为成功
        return accountDao.freeze(acct, amt) == 1;          // 结果：真冻结——业务表与日志表须同库同事务，否则冻结与记录本身又分布式
    }
    public boolean cancelFreeze(long acct) {
        if (!tccLog.existsTry(txId)) {                     // 目的：空回滚判定——Try 从未到达
            tccLog.insertCancelOnly(txId); return true;    // 输出：只写 cancel 标记并返回成功；后续迟到 Try 会被上面第一行拦截
        }
        accountDao.unfreeze(acct);                         // 例子：真释放冻结
        return tccLog.markCancelled(txId) == 1;            // 结果：状态机 CAS 更新，重复 Cancel 影响 0 行自然幂等
    }
}
```

代价：每个资源都要写三套业务接口，侵入重；Confirm/Cancel 必须可达成——最终都要配"事务状态表 + 后台补执行"。

## 四、Saga：长流程的补偿链

把大事务拆成 T1..Tn 顺序执行，失败则逆序执行补偿 C(n-1)..C1。两模式：**编排式**（状态机驱动，如 Temporal/自研流程引擎）与**协同式**（事件驱动，每个服务监听上一事件）。

关键语义差异：**没有隔离**——中间态对外可见（已扣款未订货的窗口），读补偿后的值还是脏值要业务定义；补偿必须**语义可逆**（退款可行、已发出的短信不可逆→设计时把不可逆动作放链条末端或先预判）。正/补偿动作全部幂等（at-least-once 驱动）。

金融常用"前向恢复"变体：中间步骤失败不整体回滚而是重试到成功（如清算入账），配人工工单兜底。

## 五、本地消息表 / 事务消息：最常用的"最终一致"

**本地消息表**：业务数据与消息记录同库同事务落盘 → 后台任务轮询未投递消息 → 下游消费幂等 → 回执/状态更新。崩溃一致性由"同库事务"保证——这是它比"直接发 MQ 再异步落库"强的根本点。

**事务消息（RocketMQ 半消息）**：发半消息（对消费者不可见）→ 执行本地事务 → 提交/回滚半消息；Broker 回查本地事务状态补决议——把"本地消息表"外包给 MQ，回查即对账。

```yaml
# 例子目的：RocketMQ 事务消息在 Spring Boot 中的关键配置与回查语义（错误配置会静默丢"回查"能力）
rocketmq:
  producer:
    group: order-tx-producer          # 说明：事务回查按 group 找回查者——同 group 必须部署了实现 check 回调的实例
  name-server: 10.0.0.5:9876
# 代码侧要点（伪配置注释）：
# checkLocalTransaction(msg) 返回 COMMIT/ROLLBACK/UNKNOW —— 目的：Broker 定时回查未决议半消息
# 错误用法：回查里查不到订单就返回 UNKNOW —— 结果：半消息永久挂起反复回查，应区分"不存在(回滚)"与"还在提交中(未知)"
```

Kafka 不提供事务消息语义（其"事务"是 exactly-once 流内EOS，不是跨服务协调）——选型时最易踩混。

## 六、全景对比与选型矩阵

| 模型 | 隔离性 | 一致性到达 | 侵入度 | 典型场景 |
| --- | --- | --- | --- | --- |
| 2PC/XA | 强（锁资源） | 同步立即 | 低（数据源级） | 单库多表、同业清算强合规 |
| 3PC | 强 | 理论非阻塞 | — | 工程界基本弃用 |
| TCC | 业务级预留 | 同步确认+异步补 | 高（三接口） | 账务扣冻结、优惠券核销 |
| Saga | 无（中间态可见） | 异步补偿收敛 | 中 | 长流程：下单-出库-物流 |
| 本地消息表/事务消息 | 无 | 异步最终一致 | 低 | 通知类、积分、库存扣减解耦 |

选型口诀：**能单库不分布式；能消息表不 TCC；能 TCC 不上 XA 长锁；Saga 只在"步骤多+周期长+接受中间态"时用**。Seata 把 AT（自动化 2PC 近似）作为默认，代价是全局锁对热点行（秒杀库存）性能塌方——热点账户场景仍归 TCC/消息异步化。

## 七、动手题

1. 用 Seata AT 跑通"下单扣库存+扣余额"双服务 Demo，然后人为在 commit 前 kill TC server，观察锁表 `undo_log` 与全局锁超时后的回滚路径。
2. 实现一个带悬挂防护的 TCC 冻结/解冻（骨架见本节例），用混沌脚本随机乱序投递 Try/Cancel，断言不出现"负余额/双冻结"。

## 八、常见线上问题

- **事务消息回查实现返回永远 UNKNOW**：半消息堆积，Broker 压力上涨——回查必须给出终态判定依据（本地事务表）。
- **TCC Confirm 失败无补偿线程**：Try 成功网络抖动后 Confirm 重试次数用尽，资源永久冻结——状态表 + 定时补任务是 TCC 的"下半身"。
- **Saga 补偿不幂等**：补偿重试两次退了两笔款。
- **本地消息表与业务不同库**：消息落库失败业务成功——"本地"二字就是方案的全部前提。

## 九、关联技术栈

Seata（AT/TCC/Saga 框架化）、RocketMQ 事务消息、Canal+MQ（binlog 派消息，消息表的托管版）、Temporal（Saga 编排）、下一节分布式锁与本节 TCC 预留常配合使用。

## 十、本节小结

分布式事务家族按"是否阻塞、是否隔离、靠谁收敛"排开：2PC 拿锁买隔离、TCC 用业务预留换吞吐、Saga 用补偿接受中间态、消息家族把原子性收缩到"单库事务+幂等消费+对账"。真实系统几乎都是混合体：主链路消息最终一致、资金链路 TCC/AT、每日对账兜底——选型的答案不是选一个，而是给每段链路配一种。
