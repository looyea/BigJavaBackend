# 战术设计：聚合、实体、值对象与领域事件

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：能按"事务不变式闭包"划聚合并用四大铁律复核；用三条信号（成对出现/无身份/替换而非修改）决定何时该上值对象；写出带幂等键与版本号的领域事件并配 outbox 解决"落库成功事件丢失"；说清聚合间为什么只准 ID 引用、最终一致边界的事件链路怎么设计，并识别"聚合根=表、属性=外键实体"的经典错切法。

```flow
例子目的：一次"扣库存"命令在战术模型里的完整旅程——边界内强一致, 边界外事件最终一致
命令: DeductStock(skuId=8, qty=5) -> 库存聚合(根=StockItem by skuId): 不变式"可售=总量-锁定-已扣 ≥ 0"在聚合内闭合
聚合内: 校验 + 修改自身状态 + version+1(乐观锁) -> 单事务落库(聚合是事务边界)
同事务: 事件 StockDeducted(occurredAt, version, idempotencyKey) 写入 outbox 表
提交后: 投递器搬运 outbox → MQ -> 订阅方(订单上下文)最终一致消费
反例对照: 若"仓库"是聚合根(全仓 SKU 一个根) -> 所有扣减抢同一行 version, 吞吐塌回单线程
```

## 一、聚合：一致性边界，不是"相关表的家族"

划聚合的唯一问题是：**哪些不变式必须在同一个事务瞬间同时成立？**（"账户余额与流水合计相等"要，"订单与支付单状态一致"往往不要——那是最终一致事件链的活）。四大铁律（Vaughn Vernon 口径）复核：

1. **在不变式边界处建模**——把"必须同时真"的规则关进一个聚合，别按实体关系图切；
2. **设计小聚合**——"大聚合更安全"是幻觉：锁争用、内存加载、并发冲突三高，一致性由边界内保证、边界外靠事件；
3. **通过 ID 引用其他聚合**——引用是邮递地址不是房子本身；
4. **只通过一致性边界交互**——一个事务只改一个聚合实例，跨聚合协作 = 事件驱动最终一致。

```java
// 目的：两条最易违的铁律示范——ID 引用与"一个事务一个聚合"
@Entity @Table(name="stock_item")
class StockItem {                                 // 聚合根: 一个 SKU 一条, 不变式只涉及自身三列
    @Version private long version;                // 结果: 乐观锁粒度=单 SKU, 并发扣减互不干扰
    private SkuId skuId;                          // 值对象包装的 ID, 而非 @ManyToOne Sku ——
    // 反例: @ManyToOne 商品实体 → 加载库存拖起整棵商品树, 商品上下文对象入侵库存不变式(它还根本不该可写)
    void deduct(Quantity q) {
        if (available().lt(q)) throw new InsufficientStock(skuId);   // 不变式在根上闭合, 外部无从"绕过校验直接 set"
        this.locked = this.locked.add(q);                             // 状态变更只暴露"业务动词", 无 public setter
        raisedEvent(new StockDeducted(skuId, q, version + 1));        // 事件暂存, 随聚合提交同事务落 outbox
    }
}
// 错误用法: 一个"扣库存+记订单流水"大事务横跨库存/订单两聚合(改 A 锁 B 等 C) → 死锁与吞吐双杀
// 说明: 扣库存后订单侧靠消费 StockDeducted 推进, 两聚合各自单事务, 不一致窗口由对账闭环兜底
```

## 二、值对象：成对出现、无身份、替换而非修改

三条引入信号：① 两三个字段永远同进同退（金额+币种、省市区+详址）；② 没有生命周期身份（变更即替换，不追问"还是不是同一个"）；③ 需要行为语义（加钱、比够不够）。

```java
// 目的：record 值对象的正确姿势——构造即合法 + 自带业务动词
public record Money(BigDecimal amount, Currency currency) {        // 结果: 不可变并发安全; "5000元"裸 BigDecimal 的时代结束
    public Money {                                                  // 紧凑构造器=不变式门卫: 非法值根本不存在
        Objects.requireNonNull(amount);
        if (amount.scale() > 2) throw new IllegalArgumentException("币种标度超限");
    }
    public Money add(Money other) {                                 // 跨币种相加在类型层被挡: 新 Money 只能同币合并
        if (!currency.equals(other.currency)) throw new MismatchCurrency(currency, other.currency);
        return new Money(amount.add(other.amount), currency);
    }
}
// 反例: 为"看起来像实体"的 Address 发 id 并建 address 表——同址改一处要同步 N 行, 无身份的东西硬给身份
// 错误用法: Money 留 public 全参构造器让外部绕过标度校验——值对象的门卫必须是唯一入口
```

实体（Entity）的保留判据只有一条：**业务需要追踪它的身份连续性**（订单号 8801 改了地址仍是同一单）。"实体太多"几乎总是失败信号——属性再拆值对象、集合收进聚合、独立生命周期再谈拆聚合。

## 三、领域事件：名词化的过去式事实

事件命名 = 过去式 + 业务名词（`StockDeducted` 而非 `DeductStock`）；载荷 = 事实的最小充分集（发生了什么，不是"请下游做什么"）；必带三件：**eventId/幂等键、occurredAt、聚合 version**。

```java
// 目的：outbox 模式——把"改状态"和"发事件"缝进同一个本地事务, 消灭双写不一致
@Transactional
void handle(DeductStock cmd) {
    StockItem item = repo.find(cmd.skuId());
    item.deduct(cmd.qty());                                   // 聚合内不变式+版本号+1
    repo.save(item);
    outboxDao.insert(StockDeducted.of(item, UUIDs.timeOrdered()));  // 反例对照: 此处直接 mq.send() =
}                                                             // 本地事务回滚但消息已出=幻影事件; 提交后进程崩=事件永久丢失
// 投递器: 轮询/CDC 消费 outbox → MQ, 至少一次; 消费端按 eventId 去重(接 dist-theory 幂等三范式)
// 结果: 事件可靠性从"赌网络"降级为"赌本地事务"——后者是已有依赖
```

## 四、常见线上问题

- 聚合根被当 DTO：`order.getItems().get(0).setStatus(...)` 一路 setter 到落库——不变式早已无人看守（解药：无 public setter + 业务动词方法）；
- 事件携带可变对象引用：下游反序列化时聚合又被改了——事件发布前深拷贝/事件本身 record 化；
- 无幂等键的事件重放：消费者二次扣款——eventId 唯一索引去重表是底线（正反例见 dist-theory S1-3）；
- 命令与事件混用：`DeductStock` 既当命令名又当表意"已扣完"——命令是祈使（要做）、事件是陈述（已发生），两套注册表别互相抄名。

## 五、小结与过关要点

战术设计是一组守恒律：**不变式收进聚合、语义塞进值对象、耦合换成事件、写路径锁到根**。模型质量的可测标准：并发压测下锁冲突率（聚合是否过大）、新人找一条业务规则的平均跳图层数（是否贫血）、事件重放后系统是否能收敛到当前态（事件是否真"事实"）。过关自测：画出你核心域的聚合清单，标出每个聚合守护的不变式——标不出不变式的"聚合"，通常是表穿了件 OO 的马甲。
