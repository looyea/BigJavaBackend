# 堆转储分析与内存泄漏定位

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：拿到一个 `.hprof` 堆转储，能用 **Eclipse MAT** 走通"Histogram → 支配树 Dominator Tree → Leak Suspects → 到 GC Roots 的路径（Path to GC Roots, exclude weak/soft）"这条主线，把"内存被谁占着"落到**具体对象 + 具体引用链 + 具体代码行**；理解 **Shallow Heap vs Retained Heap**、为什么支配树比直方图更快锁定真凶；并背熟 Java 五大泄漏现场——**无界缓存、静态集合、未 `remove()` 的 ThreadLocal、监听器/回调注册不注销、未关闭的资源**，每一种都对应前几节埋下的伏笔。这是整个 JVM 包的"收口实战"：s2-1 告诉你什么算垃圾、s3-1 告诉你何时该 dump、这节告诉你 dump 出来后怎么定罪。

## 一、先取到一个能分析的 dump

```bash
# 例子目的：三种拿到堆转储的方式，按"是否有现场/是否可停机"选
jcmd <pid> GC.heap_dump /data/dump.hprof   # JDK 9+ 首选（正确：轻量、路径可控；会 STW，大堆先摘流量）
jmap -dump:live,format=b,file=dump.hprof <pid>  # 经典方式（正确：加 live 先 Full GC 只导存活对象、文件小；错误：live 会触发 Full GC 扰动现场——想分析"包括临时的泄漏"就别加）
# 事前埋雷（最推荐）：-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/data/  # OOM 瞬间自动留证，见 s3-1
# 正确使用结果：得到 .hprof 文件；MAT 首次打开会建 index（索引），大文件耐心等或改用 jhsdb jmap 快速看直方图
# 错误用法：拿生产 8G 堆直接 jmap -dump 不摘流量 → STW 数十秒、监控全线飘红，等于制造二次事故
```

## 二、两个必须分清的量：Shallow vs Retained

- **Shallow Heap**：对象**自身**占的字节（不含它引用的对象）。一个空 `HashMap` 的 Shallow 很小。
- **Retained Heap**：**回收这个对象后能一并释放的总字节**——即"它独占了、别人引用不到的那一大片"。`HashMap` 装着 100 万个 Entry，Retained 巨大。

> **定位泄漏看 Retained，不看 Shallow。** 一个 Shallow 只有几十字节的静态 `Map`，Retained 可能有几 G——它就是真凶。MAT 支配树（Dominator Tree）正是按 Retained Heap 排序，直接告诉你"谁 holds 住了最多内存"。

```flow
Dominator Tree：对象 A 支配 B ⟺ 从 GC Roots 到 B 的所有路径都必经 A
   → 删掉 A，B 及其子树就都成了垃圾 → A 的 Retained Heap = 这整片的大小
   → 泄漏时"顶最宽的那条根"通常就是无界集合 / 静态字段 / 线程本地
```

## 三、MAT 分析主线：四步定罪

1. **Leak Suspects 报告**（打开 dump 自动弹）：MAT 启发式直接给"Top 可疑占内存对象 + 占比"，八成一线就够。
2. **Dominator Tree**：按 Retained 降序，找那个"Shallow 小、Retained 巨大"的持有者。
3. **Histogram**：按**类**聚合实例数与大小——`byte[]`/`char[]`/某业务对象异常多即线索（适合"不知道具体哪个对象"时先看类型分布）。
4. **Path to GC Roots（exclude weak/soft/phantom references）**：对可疑对象右键追踪它到 GC Root 的引用链——**这条链就是"为什么它不该活着却活着"的答案**，一路点到你们自己的代码行。

> 为什么要 **exclude weak/soft**：弱/软引用不是让对象"必须存活"的原因（呼应 s2-1 引用类型、s3-1 ThreadLocal），把它们排除后剩下的强引用链才是真凶路径。

## 四、五大泄漏现场（每一处都和前几节闭环）

```java
// 例子目的：一份"泄漏样本集"，每条都是真实项目里最高频的 Retained 大户，对照 MAT 里会长什么样
static final Map<String, Order> CACHE = new HashMap<>();  // 现场①：静态无界缓存——只 put 不 evict，Retained 一路涨到 OOM（对应 MAT：CACHE 支配树最宽）
void onData(String key, Order o) {
    CACHE.put(key, o);            // 错误用法：key 是订单号，量级百万且从不过期 → 内存只增不减 → 数日后 Java heap space OOM
}                                  // 修复：换有上限 + 过期的缓存（Caffeine maximumSize/expireAfter），见 java-basics 集合与缓存章节

void handle(HttpServletRequest req) {
    TRACE.set(req.getTraceId());   // 现场②：ThreadLocal 用完不 remove（见 juc s3-1）
    // ... 处理 ...                 // 错误用法：线程池核心线程不死 → Entry(null,value) 僵尸 value 堆积，老年代缓慢爬升且串数据
    // 修复：try { ... } finally { TRACE.remove(); }   // 正确：切断 entry→value 强引用，Retained 归零
}
static final List<Listener> LISTENERS = new CopyOnWriteArrayList<>();  // 现场③：监听器/回调注册不注销
void register(Listener l){ LISTENERS.add(l); }                          // 错误用法：匿名 Listener 拽着 Activity/Service/大对象不放，Retained 巨大
void close(Listener l){ LISTENERS.remove(l); }                          // 正确：成对注销，对象才回到"不可达"

void read() {                                                          // 现场④：未关闭的资源（流/连接/ResultSet）
    var in = Files.newInputStream(Paths.get("/big"));                 // 错误用法：不 close，缓冲与 native 句柄泄漏（堆内 buffer 也 Retained）
    // 正确：try (var in = Files.newInputStream(...)) { ... }  // 结构化关闭，出作用域即释放
}
```

> 现场⑤：**`equals/hashCode` 错误的键**放进 `HashMap`/`HashSet`——对象"逻辑上该被淘汰"但因哈希算错永远查不到、删不掉，堆里越积越多（呼应 java-basics 泛型/集合）。MAT 里表现为同一类实例数异常，却找不到显式持有链。

## 五、两份 dump 差异对比：抓"只增不减"的钉子户

单张 dump 有时难判断"这堆对象到底是不是泄漏"。更狠的招：**间隔一段时间抓两张 dump，对比同一类的实例数/Retained 增长**。

```bash
# 例子目的：用差分定位持续增长的泄漏源（比单张 dump 更能排除"正常波动"）
# 先跑一段时间后抓 dump1.hprof，再等一段负载相似的时间抓 dump2.hprof
# MAT: 打开 dump2 → Compare_Basket 与 dump1 的 Histogram → 按 "Number of Objects Δ" 排序
# 正确用法：Δ 持续为正的自定义业务类（如 Order/Session）就是泄漏嫌疑；再对它 Path to GC Roots 定位代码行
# 错误用法：只抓一张、把"正常在途请求对象"当泄漏误杀 → 必须两张差分 + 相同负载条件才能下结论
```

## 六、定位之后的修复范式

- **缓存**：一律**有上限 + 过期策略**（`Caffeine`），并监控 evict 命中率。
- **ThreadLocal**：`try/finally` 强制 `remove()`（juc s3-1 铁律）。
- **监听器/回调**：注册与注销**成对出现**，生命周期结束即摘除。
- **资源**：try-with-resources / 连接池归还。
- **静态字段**：警惕 `static Map/List`——它就是 GC Root，Retained 直接算到你头上。

## 七、动手题

1. 写一个 `static Map` 只 put 不 evict 的程序，`-Xmx128m` 跑出 OOM，MAT 打开看 Dominator Tree 顶部是不是你的 Map，对它 Path to GC Roots 看链尾。
2. 用 ThreadLocal 不 remove 造泄漏，dump 后先看 Histogram 里 value 类型实例数，再 exclude weak/soft 追强引用链。
3. 抓间隔 5 分钟的两张 dump 做 Histogram 差分，找出 Δ 最大的业务类。

## 八、常见线上问题

| 现象 | MAT 里的特征 | 根因 |
| --- | --- | --- |
| Retained 集中在某 `static Map` | Dominator Tree 顶部、Shallow 小 Retained 巨大 | 无界缓存不 evict |
| 某业务对象实例数随时间线性涨 | Histogram 差分 Δ 持续为正 | 生命周期结束没解绑/没 remove |
| 大 `byte[]`/`DirectByteBuffer` 堆内多但 OOM 在堆外 | dump 里看不到堆外字节 | 直接内存泄漏（转 s3-1，非本节 MAT 主场） |
| 找不到显式持有者但对象不回收 | keys 在 HashMap 里异常多 | `equals/hashCode` 写错、删不掉 |
| ThreadLocal 僵尸 value 堆积 | exclude 弱引用后仍见 value 链 | 线程池 + 未 `remove()`（juc s3-1） |

## 九、关联技术栈

- **向前**：可达性/GC Roots/四种引用 ↔ s2-1；OOM 分类与取证 ↔ s3-1；ThreadLocal 泄漏 ↔ juc s3-1；静态字段是 GC Root ↔ s1-1
- **工具**：Arthas `heapdump`/`vmtool --getInstances` 线上直接取实例看字段 ↔ arthas 包
- **框架**：Spring 单例 bean 持有的集合字段、请求作用域对象未清理 ↔ spring-core/spring-mvc
- **运维**：容器里 dump 落持久卷、OOM 后 `ExitOnOutOfMemoryError` 交编排重启 ↔ 构建运维

## 十、本节小结

堆转储分析的方法论就一句：**别盯着谁"占得多"，要盯着谁"holds 得住"**——用 **Retained Heap / 支配树**找那个"自身小、却拽着一大片不放"的持有者，再用 **Path to GC Roots（排除弱/软引用）**把引用链点到你们自己的代码行。五大泄漏现场（**无界缓存、静态集合、不 remove 的 ThreadLocal、不注销的监听器、不关的资源**）本质都是"对象仍挂在通往 GC Root 的强引用链上"。单张 dump 拿不准就**两张差分**看只增不减的钉子户。至此 JVM 包闭环：判垃圾（s2-1）→ 选收集器（s2-2）→ 调优（s2-3）→ 排查取证（s3-1）→ dump 定罪（本节）。
