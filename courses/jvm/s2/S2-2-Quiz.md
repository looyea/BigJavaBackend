# 小测验 · G1 / ZGC / Shenandoah

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. G1 收集器实现"可预测低停顿"的核心手段是？（15分）

- A. 完全取消 STW，全部并发
- B. 把堆切成 Region，按停顿预算（`MaxGCPauseMillis`）挑选垃圾价值最高的部分 Region 回收
- C. 只用复制算法，永不整理
- D. 强制每次回收整个老年代

> 答案：B
> 解析：G1 的"Garbage-First"即在有限停顿预算内优先回收垃圾最多的 Region；`MaxGCPauseMillis` 是软目标，指导本轮挑多少 Region。A 是 ZGC/Shenandoah 的方向，C/D 均与 G1 机制不符。

### 2. CMS 被 JDK 移除（JDK 14）的主要原因是？（15分）

- A. CMS 完全不支持并发标记
- B. 标记-清除留下碎片，大对象分配易触发 concurrent mode failure 退化为串行 Full GC
- C. CMS 只能管小堆
- D. CMS 无法使用卡表

> 答案：B
> 解析：CMS 已是并发标记，但用标记-清除不整理，长期碎片化会让一次晋升/大对象分配触发 concurrent mode failure，退化成很长的串行 Full GC，停顿反而失控，加上维护负担被移除，G1 是其继任者。

### 3. 【多选】关于 ZGC 的说法，正确的有哪些？（20分）

- A. 用着色指针把 GC 状态编码进对象指针的高位
- B. 用读屏障在应用读引用时顺手修正/转发，实现标记与搬移几乎全并发
- C. 停顿会随堆大小线性增长
- D. JDK 21 引入分代 ZGC 补强新生代回收效率

> 答案：ABD
> 解析：C 错——ZGC 的卖点恰是"停顿与堆大小近乎无关"（亚毫秒级，TB 堆亦然）。A/B 是其两大核心机制，D 是 JDK 21 的关键演进（`-XX:+ZGenerational`）。

### 4. 判断：把 `-XX:MaxGCPauseMillis` 设得越小，G1 停顿就越短、整体性能越好。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：这是软目标，设得过小（如 5ms）会让 G1 只敢回收极少 Region，回收速度跟不上分配速度，GC 更频繁，甚至触发 to-space exhausted 退化为 Full GC，整体反而更慢。

### 5. 填空题：G1 记录跨 Region 引用靠 ______（配合写屏障维护）；并发标记用 ______ 快照法保证正确性；G1 线上最需警惕的退化信号是没有空 Region 承接存活对象的 ______（进而触发 Full GC）。（20分）

> 答案：RSet / SATB（Snapshot-At-The-Beginning） / to-space exhausted（晋升失败）

### 6. 按"吞吐 / 停顿 / 堆规模 / JDK 版本"四轴，说明 Parallel、G1、ZGC 各自的适用场景。（20分）

> 参考答案：
> - Parallel：吞吐优先、STW 秒级，适合小堆或离线批处理，JDK 8 时代非客户端默认
> - G1：可预测停顿、均衡通用，适合 6G+ 堆的在线服务，JDK 9+ 默认，最怕 to-space exhausted
> - ZGC：亚毫秒且与堆大小无关，适合大堆 + 延迟敏感（撮合/风控/RT 缓存），代价是吞吐略降、更吃 CPU 与内存
> - 口诀：追吞吐小堆→Parallel；通用微服务要可预测停顿→G1；大堆低延迟→ZGC（OpenJDK 要并发整理亦可 Shenandoah，Oracle 不含）
