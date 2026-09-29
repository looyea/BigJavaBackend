# G1 / ZGC / Shenandoah

> 本节难度：★★★★★
> 重要程度：★★★★★
> 学习产出：建立**停顿模型**视角看现代收集器——G1 用 **Region + 停顿预测 + 优先回收**把"可预测的低停顿"做到通用最优；ZGC / Shenandoah 用**并发整理**（着色指针 / Brooks 转发指针 + 屏障）把停顿压到**亚毫秒、且与堆大小近乎无关**。讲清 G1 的 **RSet/SATB**、Mixed GC 与"to-space exhausted"，ZGC 的**读屏障**与三重代价，Shenandoah 的**并发 evacuation**；并能按"延迟 / 吞吐 / 堆规模 / JDK 版本"四轴选型。CMS 为何被淘汰、G1 何时退化成 Full GC，是这节的实战落点。

## 一、先看约束：GC 的不可能三角

GC 设计在 **吞吐量（应用跑业务的时间占比）· 停顿时间（STW 长度）· 内存占用（footprint）** 三者间权衡，很难同时拉满。早期追求吞吐（Serial/Parallel），后来追求低停顿催生出并发回收思路：把"标记/整理"尽量挪到与应用线程**并发**执行，只在必须的时刻短暂 STW。

```flow
追求吞吐 ──▶ Parallel(吞吐优先) / Serial(单核、小应用)
追求低停顿 ─▶ CMS(并发标记清除,已淘汰) ─▶ G1(分Region可预测停顿, JDK9+默认) ─▶ ZGC/Shenandoah(并发整理,亚毫秒停顿)
```

## 二、CMS 为什么被移除（理解 G1 的前提）

CMS（Concurrent Mark-Sweep）首次把"标记"大部分做成并发，但：

- **标记-清除 → 碎片**：不做整理，长期跑下来碎片化，一次大对象分配触发**并发模式失败（concurrent mode failure）→ 退化串行 Full GC**，停顿反而爆炸。
- **CPU 敏感**：并发标记抢业务线程；**浮动垃圾（remark 期间新产生的垃圾）**只能下轮清。
- 因维护负担与上述硬伤，**JDK 9 标记废弃、JDK 14 移除**。G1 是它的官方继任者。

## 三、G1：Region 化 + 停顿预测 + 优先回收（JDK 9+ 默认）

G1 把堆切成大小相等的 **Region**（1~32MB），不再有物理连续的 Young/Old；每个 Region 动态扮演 Eden/Survivor/Old，超大对象单独进 **Humongous** Region。

**名字由来**：收集时**优先回收"垃圾价值最高"的 Region**（Garbage-First），在有限停顿预算内收回最多空间。

```flow
Young GC → [并发标记周期(初始标记 STW→并发标记→重新标记 STW→清理)] → Mixed GC(Young+部分价值高的 Old) → 兜底 Full GC(JDK10+ 并行)
```

关键机制（高频）：

- **停顿预测模型**：`-XX:MaxGCPauseMillis`（默认 200ms）是**软目标**，G1 据此挑选本轮回收的 Region 数量；设过小→只回收少量 Region→回收跟不上分配→反而更频繁 GC。
- **RSet（记忆集）+ 写屏障**：每个 Region 记录"谁指向我的对象"，避免跨 Region 引用全堆扫描；代价是 RSet 占内存（约几个百分点）、写屏障维护成本。
- **SATB（Snapshot-At-The-Beginning）快照法**：并发标记开始时拍个快照，标记期间"删除"的引用靠快照仍被当作存活（宁可漏标残留、不错标），保证并发标记正确性——对比"增量更新"处理的是"新增引用"。
- **to-space exhausted（晋升失败）**：Mixed GC 回收不及时、没有空 Region 承接存活对象 → G1 被迫** Full GC**（长 STW），这是 G1 线上最需要警惕的退化信号。

```bash
# 例子目的：给一个 8G 堆、目标停顿 100ms 的服务配 G1（JDK 11+）
java -XX:+UseG1GC \
     -Xms8g -Xmx8g \                       # 堆固定大小，避免运行时扩缩抖动（正确：G1 也建议 Xms=Xmx）
     -XX:MaxGCPauseMillis=100 \            # 软停顿目标（错误用法：设成 5ms 这种不现实值→G1 只敢收极少 Region→回收不足→GC 更密、更易 Full GC）
     -XX:G1HeapRegionSize=8m \             # Region 大小（默认按堆自动 1~32m；过小则 Humongous 阈值低、大对象易碎）
     -XX:InitiatingHeapOccupancyPercent=45 \ # IHOP：堆占用达 45% 启动并发标记，太晚可能赶不上晋升（to-space exhausted）
     -Xlog:gc*,gc+heap=debug,safepoint:file=gc.log:time,uptime,level,tags \ # JDK9+ 统一日志（正确：别用旧的 -XX:+PrintGCDetails）
     -jar app.jar
```

> 选型：**堆 6G+、要求可预测停顿、通用后端**默认就选 G1；它是绝大多数 Spring Boot 微服务的正确默认值，别轻易回到 Parallel/CMS。

## 四、ZGC：着色指针 + 读屏障，停顿与堆大小解耦

ZGC 的目标是 **停顿 < 1ms（新版常 <0.1ms）且不随堆增长**——TB 级堆也能亚毫秒。它做到"**标记、搬移、重映射几乎全部并发**"，STW 只剩极短的根扫描点。

**核心黑科技**：

- **着色指针（Colored Pointers）**：把 GC 信息（标记位、remapped 位）编码进**对象指针本身**的 spare 高位，而非对象头——读指针就能知道它处于哪一轮 GC 状态。
- **读屏障（load barrier）**：应用**每次从堆里读引用**时插一小段检查，若指针颜色"过期"就**顺手把对象修正/转发**（self-healing），从而让"搬移对象"能与业务并发进行。
- **三重代价**：读屏障降低吞吐（比 G1 略低）、着色指针 + 多重映射增加**内存/CPU**、更吃核数（并发回收要抢 CPU）。
- JDK 21 引入**分代 ZGC（`-XX:+ZGenerational`）**补上"新生代高回收率"的效率短板（JDK 23 起分代成为默认、非分代路径移除）。

```bash
# 例子目的：为超大堆、超低延迟要求的场景配 ZGC
java -XX:+UseZGC -XX:+ZGenerational \   # JDK21+ 启用分代 ZGC（错误用法：老 JDK 无 ZGenerational 却照抄→ unrecognized VM option 启动失败）
     -Xms32g -Xmx32g \                  # ZGC 建议固定堆；它能扛很大堆而停顿不涨
     -XX:+EnableDynamicAgentLoading \    # 抑制某些 agent 告警（视版本）
     -Xlog:gc*:file=gc.log:time,uptime:filecount=5,filesize=20m \
     -jar app.jar
# 正确用法：ZGC 适合大堆 + 延迟敏感（支付撮合、实时风控、内存密集型缓存）。
# 错误用法：4G 小堆、成本敏感、要极致吞吐的批处理硬上 ZGC→ 读屏障损耗吞吐 + 吃 CPU，反而不如 Parallel/G1。
```

## 五、Shenandoah：Brooks 转发指针的并发整理

与 ZGC 同属"**并发 evacuation（边搬边服务）**"低延迟流派，Red Hat 主导：

- 用 **Brooks Pointer（转发指针）**——每个对象头多一个指向"自己新地址"的指针，搬移时旧对象仍能被正确路由，实现**并发压缩**（无需大块停顿）。
- 也靠**引用屏障**（读/写组合）维持并发一致性；目标是"停顿与堆大小无关"。
- **可得性差异**：Shenandoah 在 **OpenJDK 构建**里；**Oracle JDK 不含**它（Oracle 侧对标是 ZGC）。选型要看你的 JDK 发行版。

## 六、横向选型（面试与决策双高频）

| 维度 | Parallel | G1 | ZGC | Shenandoah |
| --- | --- | --- | --- | --- |
| 优化目标 | 吞吐 | 均衡、可预测停顿 | 超低停顿 | 超低停顿 |
| 典型停顿 | 秒级 STW | 数十~百 ms（可调） | 亚 ms、与堆无关 | 亚 ms、与堆无关 |
| 堆规模 | 小 | 6G+ 通用 | 8G~TB 大堆 | 大堆 |
| 是否并发整理 | 否 | 部分（Mixed） | 是（着色指针+读屏障） | 是（Brooks 指针+屏障） |
| 吞吐损失 | 最小 | 略降（写屏障/RSet） | 较明显（读屏障） | 较明显 |
| 默认/版本 | 客户端外老默认 | **JDK 9+ 默认** | 生产可用（11+，21 分代） | OpenJDK 有，Oracle 无 |

**决策口诀**：**小堆/离线批处理重吞吐→Parallel；通用微服务、要可预测停顿→G1（默认）；大堆 + 延迟敏感（撮合/风控/RT 缓存）→ZGC；坚持 OpenJDK 又要并发整理→Shenandoah。**

## 七、动手题

1. 同一大内存模拟程序，分别用 `-XX:+UseG1GC` 与 `-XX:+UseZGC -XX:+ZGenerational` 跑，从 `-Xlog:gc*` 对比"最大单次停顿"与"吞吐（GC 时间占比）"，观察 ZGC 停顿更平但 GC 时间占比更高。
2. 把 `MaxGCPauseMillis` 设成 5ms 跑 G1，观察 GC 次数暴涨、甚至 `to-space exhausted → Full GC`，体会"软目标设太小"的反效果。
3. 查你用的 JDK 发行版是否含 Shenandoah（`java -XX:+UseShenandoahGC -version` 是否报 unrecognized option），理解"Oracle vs OpenJDK"的可得性差异。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| G1 偶发超长 Full GC | to-space exhausted：Mixed 回收赶不上晋升，IHOP 太高或堆偏小 |
| 调小 MaxGCPauseMillis 反而更慢 | G1 只收更少 Region、回收不足，GC 频率与 Full 风险上升 |
| ZGC 吞吐不如 G1、CPU 偏高 | 读屏障 + 并发回收抢核；小堆/吞吐型场景不该上 ZGC |
| `-XX:+UseShenandoahGC` 启动即失败 | 用的是 Oracle JDK，不含 Shenandoah |
| 升级 JDK 后 GC 行为大变 | 默认器/CMS 移除/分代 ZGC 引入等版本演进，需重压测 |

## 九、关联技术栈

- **向前**：卡表/写屏障、SATB 与增量更新 ↔ jvm s2-1；安全点 ↔ s2-1
- **调优**：GC 日志字段、停顿/吞吐指标、Full GC 排查路径 ↔ jvm s2-3、s3-1
- **框架/部署**：容器里给 JVM 多少堆、选型 ↔ 构建运维 JVM 容器感知；虚拟线程与 GC（STW 影响所有虚拟线程）↔ java-modern s2-1
- **硬件**：着色指针复用指针 spare 位 ↔ 与内存寻址、多重映射相关

## 十、本节小结

看 GC 先问"**要吞吐还是要停顿**"：CMS 因**碎片 + concurrent mode failure** 被移除；**G1** 用 **Region + RSet/写屏障 + SATB + 停顿预测**给出"可预测低停顿"的通用最优，最怕 **to-space exhausted 退化成 Full GC**；**ZGC** 用**着色指针 + 读屏障**把标记/搬移/重映射几乎全并发，实现"**亚毫秒、与堆大小无关**"的停顿，代价是吞吐、内存与 CPU；**Shenandoah** 用 **Brooks 转发指针**做并发整理、但只在 OpenJDK。**默认微服务用 G1；大堆 + 延迟敏感上 ZGC；追吞吐的小堆/批处理留 Parallel。** 分代 ZGC 正在补上"新生代效率"这块最后一块拼图。

下一节线上调优方法论——参数、日志、Full GC 排查路径与容量规划。
