# 复杂度分析与大 O 思维

> 本节难度：★★☆☆☆
> 重要程度：★★★★★
> 学习产出：时间/空间复杂度、均摊分析、为什么后端热路径只接受 O(1)/O(log n)/O(n)，以及它如何对应索引/缓存/批量等架构决策。

> 这不是一节"刷题前置课"。复杂度思维是架构师做技术选型、容量评估、Code Review 时每天都在用的底层判断力：
> 一行 `for` 嵌套、一次 `list.contains`、一个没建索引的查询，都可能在电商大促、金融日终、电力海量采集上报时被放大成线上事故。

## 一、大 O 到底在度量什么

大 O 描述的是**当输入规模 n 增长时，资源消耗（时间或空间）的增长趋势**，忽略常数项与低阶项。它回答的不是"这段代码跑多少毫秒"，而是"数据量翻 1000 倍时它会变糟多少"。

三条铁律：

1. **只留最高阶项**：`3n² + 5n + 100 → O(n²)`。当 n 足够大，低阶项和常数都不重要。
2. **关注最坏情况与均摊**：工程上既要盯最坏（防止被恶意输入打崩），也要算均摊（HashMap 扩容、ArrayList 增长的摊还成本）。
3. **时间和空间可以互换**：用空间换时间（哈希表、缓存、前缀和）是后端性能优化的第一板斧。

### 常见量级增速对照

| 量级 | 名称 | n=1万时大致操作数 | 后端体感 |
|---|---|---|---|
| O(1) | 常数 | 1 | 数组下标、HashMap.get |
| O(log n) | 对数 | ~14 | 二分、平衡树查找、ZSet |
| O(n) | 线性 | 1万 | 遍历、单列索引扫描 |
| O(n log n) | 线性对数 | ~14万 | 优秀排序、归并聚合 |
| O(n²) | 平方 | 1亿 | 双重循环——**危险区** |
| O(2ⁿ)/O(n!) | 指数/阶乘 | 天文数字 | 暴力子集/全排列——**不可用于大规模** |

**结论**：后端热路径上，能接受的是 O(1)/O(log n)/O(n)。一旦出现 O(n²) 且 n 由外部可控（用户、订单、设备数量），必须警惕。

## 二、为什么后端只关心这三种量级

一次请求在网关、应用、DB 每一层都要限时。假设单机每秒能处理约 10⁸ 次基础操作，SLA 要求接口 100ms 内返回，那么**一次请求的预算约 10⁷ 次操作**。据此反推：

- n = 10⁵（十万条）：O(n) 约 10⁵ 次，轻松；O(n²) 约 10¹⁰ 次，**直接超时 10 秒以上**。
- 把 O(n²) 降到 O(n log n) 或 O(n)（排序 + 双指针 / 哈希），是数据量上来后唯一活路。

> 场景：电力集控要对 300 万智能电表的日冻结数据做同比对齐。若对每条都全表扫一遍历史（O(n²)）根本跑不完；正确做法是按 `meterId` 建哈希/排序后双指针线性合并（O(n)）。

## 三、均摊分析：ArrayList 与 HashMap 的隐藏成本

单看某一次 `add` 可能是 O(n)（触发扩容拷贝），但 n 次 `add` 总代价是 O(n)，**均摊 O(1)**。这就是"扩容是 2 倍而不是 +1"的原因——2 倍扩容让总拷贝次数收敛到等比数列 `1+2+4+…+n < 2n`。

```java
// 例子目的：对比"未预分配容量"与"预分配容量"两种写法，看均摊扩容成本差在哪里
int n = 100_000;

List<Integer> bad = new ArrayList<>();          // 不知道规模 → 默认容量 10，边加边扩容
for (int i = 0; i < n; i++) bad.add(i);          // 扩容链 10→15→22→…，共约 20 次数组拷贝

List<Integer> good = new ArrayList<>(n);         // 已知规模 → 一次性分配 n 个槽位
for (int i = 0; i < n; i++) good.add(i);         // 全程零扩容；bad/good 最终内容完全相同
System.out.println(good.size());                 // 输出 100000：结果一致，差别只在耗时与内存抖动
```

同理 `HashMap` 树化/退化、`StringBuilder` 扩容、批量接口都用均摊思想。**能预知规模就预分配容量**是后端基本功。

## 四、读代码时的心算套路

1. **单层循环依赖 n** → O(n)。
2. **循环嵌套且内层依赖外层规模** → 相乘，O(n²)。
3. **每次规模减半/加倍（二分、分治）** → O(log n) 或 O(n log n)。
4. **循环里出现"在集合中查找"** → 检查这个查找是不是 O(n)！`list.contains` 在循环里 = O(n²)。换成 `HashSet` 变 O(1) → 整体降为 O(n)。**这是线上最常见的隐性降智点。**

```java
// 找出两个集合的交集——坏味道：contains 落在循环内
List<Long> badIntersect(List<Long> a, List<Long> b) {
    List<Long> r = new ArrayList<>();
    for (Long x : a) if (b.contains(x)) r.add(x);   // O(|a|·|b|)
    return r;
}
// 优化：把内层查找降为 O(1)
List<Long> fastIntersect(List<Long> a, List<Long> b) {
    Set<Long> set = new HashSet<>(b);               // O(|b|)
    List<Long> r = new ArrayList<>();
    for (Long x : a) if (set.contains(x)) r.add(x);  // O(|a|)
    return r;                                       // 合计 O(|a|+|b|)
}

// 定义必须配应用：上面的两个函数真正被调用时的结果
List<Long> users   = List.of(1L, 2L, 3L, 4L);      // 待匹配用户
List<Long> blocked = List.of(3L, 9L);              // 黑名单
System.out.println(badIntersect(users, blocked));   // 输出 [3]：结果正确，但走了 O(4×2) 次比较
System.out.println(fastIntersect(users, blocked));  // 输出 [3]：同样结果，只走 O(4+2) 次——这就是选型意义
```

> 场景：营销系统给一批 5 万用户批量匹配"是否在黑名单"。若黑名单是 `List`，`contains` 变成 5 万 × 黑名单规模，接口卡死；预先把黑名单装进 `HashSet` 或用 Redis `SISMEMBER`，才是架构级正确姿势。

## 五、空间复杂度与"换与不换"的权衡

空间复杂度同样要算。递归深度、临时集合、哈希表、结果集都占空间。

- 递归 DFS 的空间 = 调用栈深度（最坏 O(n)），大 n 有栈溢出风险 → 用迭代 + 显式栈。
- "用 HashSet 去重/加速查找"是 O(n) 空间换 O(n) 时间；数据量巨大时，改用**排序 + 双指针**把空间降到 O(1)。

**没有免费的午餐**：时间换空间还是空间换时间，取决于瓶颈是 CPU 还是内存。金融对账百万级明细，内存吃紧就宁可排序后线性扫。

## 六、把复杂度思维用到真实系统

| 工程决策 | 背后的复杂度判断 |
|---|---|
| 数据库必须建合适的索引 | 全表扫 O(n) → B+ 树索引 O(log n) |
| 热点数据上 Redis | 关系查询/磁盘 IO → 内存哈希 O(1) |
| 禁止在循环里 RPC/查库 | 把 O(n) 次网络往返合并为批量 1 次 |
| 分页用游标不用深 offset | `LIMIT 1000000,10` 要扫过百万行 O(n) |
| 布隆过滤器挡穿透 | 用概率型 O(1) 判存在换掉大量回源 |

> 一句话：**Code Review 时看到嵌套循环 + 集合查找 + 外部 IO 三者叠加，几乎必是性能地雷。**

## 七、例子：正确用法与错误用法

```java
// 例子目的：把本节复杂度结论落成可运行的对账代码，并同时看清三类典型错法的后果
import java.util.*;

public class ComplexityDemo {

    // 知识点 1：循环内的集合查找决定整体量级
    // 正确用法结果：百万对百万明细，只走 O(n+m) 次比较，秒级完成
    static int matchedBySet(List<Long> bills, Set<Long> settled) {
        int hit = 0;
        for (Long id : bills) if (settled.contains(id)) hit++;   // HashSet 查找 O(1) → 总体 O(n)
        return hit;                                               // 返回命中条数，例：1000000
    }

    // 错误用法：同一个 contains 落在 List 上 → O(n·m)，百万级直接跑到分钟级
    static int matchedByList(List<Long> bills, List<Long> settled) {
        int hit = 0;
        for (Long id : bills) if (settled.contains(id)) hit++;    // 结果相同、耗时千倍；热路径上等同线上事故
        return hit;
    }

    public static void main(String[] args) {
        List<Long> bills = new ArrayList<>(Collections.nCopies(200_000, 7L));  // 20 万条明细，故意同值
        System.out.println(matchedBySet(bills, new HashSet<>(List.of(7L))));    // 正确用例输出 200000

        // 错误用例 1：集合里混进 null，自动拆箱比较时抛 NullPointerException
        Set<Long> settled = new HashSet<>();
        settled.add(null);                                       // 哈希集合允许 null，隐患在此埋下
        try {
            long v = 0;
            for (Long id : settled) v += id;                      // id 为 null → null 自动拆箱立刻抛异常
            System.out.println(v);
        } catch (NullPointerException e) {
            System.out.println("拆空指针：集合元素为 null 时被自动拆箱");   // 输出该行，循环中断
        }

        // 错误用例 2：递归深度当复杂度用，大 n 直接栈溢出
        try {
            sum(1_000_000);                                      // 递归 100 万层 → 超出栈深度
        } catch (StackOverflowError e) {
            System.out.println("递归过深：栈空间 O(n) 不收敛");   // 输出该行；O(n) 空间复杂度的真实代价
        }
    }

    static long sum(int n) { return n == 0 ? 0 : n + sum(n - 1); }   // 本例子只演示深度风险，生产应用迭代
}
```

## 八、本节要点回顾

1. 大 O 度量增长趋势而非绝对耗时；后端只接受 O(1)/O(log n)/O(n) 出现在热路径。
2. 扩容/均摊成本：能预知规模就预分配容量。
3. 循环里的集合 `contains` 是 O(n²) 重灾区，换哈希结构降到 O(n)。
4. 时间空间可互换，瓶颈决定换法。
5. 复杂度思维直接对应索引、缓存、批量、游标分页等架构决策。

下一节我们把这套思维落到四种最基础的结构——数组、链表、栈、队列——看清它们的访问特征与性能边界。
