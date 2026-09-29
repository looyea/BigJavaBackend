# 热点参数限流、集群限流与规则持久化（关联）

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能把 Sentinel 从"给接口配个 QPS 阈值"升级到"参数粒度限流 + 全集群统一限流 + 规则可靠持久化"三块生产级能力。**热点参数限流**（`ParamFlowRule`）针对某个**参数值**单独统计限流：如对 `itemId` 维度整体每 1s 限 100 QPS，再用 `paramFlowItemList` 给爆款商品（如 `8888L`）设**例外项**单独放宽或收紧——秒杀场景里，只有按参数值限流才能挡住"一个 SKU 打爆整条链路"，纯接口级总限流会把正常商品一起误限。**集群限流**解决"多实例各限各的"总量失真问题：N 台各配 100，全局实际放到 N×100；集群模式引入统一的 **Token Server** 发放令牌、各实例作为 Token Client 申请令牌，得到全局视角的限流；部署有**嵌入模式**（某业务节点兼任 TC）与**独立模式**（专门 TC 进程），并配 **退化（degrade）** 策略——当 Token Server 挂掉或通信失败时**自动退化为本地限流**，宁可牺牲全局精度也要保证"限流本身不成为单点、不阻断业务"。**规则持久化**是生产底线：默认规则存内存、控制台改完一重启就丢、也无法程序化批量下发；应接 **`NacosDataSource`（或 Zookeeper/Apollo）** 作为动态规则源（监听配置变更→解析→热更新规则管理器），做到"改规则实时生效、重启不丢"，并配**生产兜底**——本地内置规则快照/镜像，启动时拉取失败回退到最后一次已知规则，绝不允许"无规则裸奔"。识破"多实例只配单机限流导致总量=N×阈值""Token Server 单点且没配退化→TC 一挂全站不限流或全限死""规则只存控制台内存重启即丢""爆款没设热点例外项仍按大盘阈值放"等坑——电商爆款秒杀（热点参数）、金融按渠道全局限流（集群）都直接依赖这套。

## 一、热点参数限流

```java
// 目的：对"商品ID"这个参数值做热点限流——爆款单独设阈值, 不拖垮大盘
@SentinelResource(value = "queryStock", blockHandler = "degrade")
public Stock query(long itemId) { return stockService.get(itemId); }
public Stock degrade(long itemId, BlockException ex) {   // 说明：被限流/降级时兜底, 返回缓存或"稍后再试", 不把异常抛给前端 ❌
    return Stock.cached();
}
// 结果：ParamFlowRule 每 1s 对 itemId 限 100 QPS; paramFlowItemList 给爆款 8888L 例外单独放到 500
ParamFlowRule rule = new ParamFlowRule("queryStock").setParamIdx(0).setCount(100);
rule.setParamFlowItemList(Collections.singletonList(new ParamFlowItem(8888L, "long", 500)));
// 反例：只配接口级总限流 ❌ 所有 SKU 共用大盘阈值, 秒杀爆款一来把正常查询一起限死 ❌
```

## 二、集群限流与 Token Server

```text
图目的：单机限流在多实例下总量失真, 集群限流统一发放令牌
问题: N 台各限 100 → 全局实际放到 N×100(各限各的)
集群模式: Token Server 统一发令牌, 各实例=Token Client 申请 → 得到全局阈值效果
部署: 嵌入模式(某业务节点兼任 TC) / 独立模式(专门 TC 进程)
退化(degrade): TC 不可用/通信失败 → 自动退化为本地限流(牺牲全局精度, 保证限流不阻断、TC 不作单点)
```

## 三、规则持久化与生产兜底

```java
// 目的：把流控规则源接到 Nacos——改规则实时生效、重启不丢, 而非只存控制台内存
ReadableRuleDataSource<List<FlowRule>> ds = new NacosDataSource<>(props, GROUP, DATA_ID,
        s -> JSON.parseArray(s, FlowRule.class));   // 结果：监听 Nacos 配置变更, 解析后热更新到 Sentinel 规则管理器
FlowRuleManager.register2Property(ds.getProperty()); // 说明：数据源不可用应回退本地最后快照, 别"无规则裸奔" ❌
```

## 四、坑与底线

- **总量必须集群限**：多实例只配单机限流，全局吞吐会翻 N 倍；要么集群模式、要么按实例数折算阈值。
- **Token Server 要配退化**：否则 TC 成为限流单点，挂掉即"全不限"或"全限死"。
- **规则外置 + 兜底**：NacosDataSource 做动态源，内置快照防拉取失败，杜绝重启丢规则、无规则裸奔。

## 五、关联课程

热点/集群限流都建立在单机统计之上，机制承接 [滑动窗口与流控效果](./S1-1-Lesson.md)；`blockHandler` 降级与熔断的协同见 [熔断降级与系统自适应保护](./S1-2-Lesson.md)；规则持久化依赖的配置中心动态推送见 [配置中心与灰度推送](../../nacos/s1/S1-2-Lesson.md)。
