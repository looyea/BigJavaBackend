# 哈希表原理与冲突处理

> 哈希表是后端性能的隐形支柱：缓存 Key、去重、计数、分片路由、`HashMap` 本身。
> 一句话本质——**用"对哈希函数的信任 + 一点空间"，把查找从 O(n) 压到接近 O(1)**，代价是彻底放弃有序性。
> 本节讲结构与选型的通用原理；JDK `HashMap` 的逐行源码解剖见 java-basics 专节。

## 一、核心机制：key → hash → 桶下标

```flow
key --hashCode--> 扰动(高16位^低16位) --&(len-1)--> 桶下标 --> 桶内(链/树) --equals--> 命中
```

三步：① 由 key 算哈希值；② 把哈希值映射到数组下标（定桶）；③ 桶内可能多个 key，用 `equals` 精确定位。数组是"桶"，桶里装冲突的元素。

## 二、哈希函数：好坏决定一切

好的哈希要**均匀分布 + 计算快 + 抗碰撞**。工程要点：

- 为什么用**位与 `&(len-1)` 而非取模**：容量取 2 的幂时二者等价，但位与是一条指令；且配合扰动让高位也参与定桶，减少规律性冲突。
- **扰动函数**（JDK：`h ^ (h >>> 16)`）：把高 16 位混进低 16 位，因为定桶只用低位，避免"哈希值只在高位不同"的 key 全挤一桶。
- key 参与哈希的字段若可变，放进 map 后再修改会导致"再也找不到"——**作键的对象应不可变或哈希字段不变**（`String` 不可变正因如此）。

## 三、冲突处理：链地址 vs 开放寻址

不同 key 撞同一桶，是哈希表第一命题：

| 方法 | 做法 | 优点 | 缺点 | 代表 |
|---|---|---|---|---|
| 链地址法 | 每桶挂一条链/树 | 删除简单、可超载、聚类少 | 指针多、缓存不友好 | HashMap |
| 开放寻址 | 冲突就按探测序列找下一个空位 | 无额外指针、缓存友好 | 删除要墓碑、易聚集 | ThreadLocalMap（线性探测） |

## 四、负载因子、扩容与 rehash

装太满 → 冲突飙升 → O(1) 退化。于是设**负载因子**（默认 0.75）：元素数 > 容量 × 负载因子就**扩容为 2 倍并 rehash**（所有元素重新定桶）。

- 0.75 是"空间 vs 冲突概率"的经验折中（泊松分布下平均链长达 8 的概率约千万分之一）。
- 2 的幂扩容让 rehash 只需看"新增的那一位是 0 还是 1"，元素要么留原位、要么移到"原位 + 旧容量"，不必重算哈希。
- 已知规模**预分配容量**（`new HashMap<>(expected/0.75+1)`）可省掉多次 rehash。

## 五、退化防护：从链表到红黑树

链地址法下，若大量 key 因哈希质量差或**恶意构造哈希碰撞**撞一桶，链退化成 O(n)——这是 **HashDoS 攻击**的原理。JDK8 的防护：当**某链长度 ≥ 8 且表容量 ≥ 64** 时把链**树化**为红黑树，查询降到 O(log n)；缩到 6 时还原为链。根本防线是扰动 +  Comparable/随机化哈希种子。

## 六、放弃有序，得到什么、失去什么

| | 哈希表 | 平衡树（下节） |
|---|---|---|
| 精确点查 | **O(1)** | O(log n) |
| 范围/前后最近/有序遍历 | ❌ 做不到 | ✅ 天然支持 |
| 依赖 | 哈希函数质量 | 可比较（Comparable） |

**选型分界线**：只做"给 key 拿 value / 判断是否存在 / 计数去重" → 哈希；一旦要"范围、排序、floorKey/ceilingKey、前缀" → 换树。

## 七、JDK 哈希家族定位

| 类 | 结构 | 并发 | 允许 null | 用途 |
|---|---|---|---|---|
| `HashMap` | 数组+链+红黑树 | 不安全 | 键值都可 | 单线程主力 |
| `LinkedHashMap` | + 双向链表保序 | 不安全 | 可 | 按插入/访问序、LRU |
| `Hashtable` | 链地址 | 全表同步(过时) | 否 | 遗留 |
| `ConcurrentHashMap` | 数组+链/树+CAS+synchronized 桶 | 安全高并发 | 键值否 | 并发主力 |

`ConcurrentHashMap` 用"分桶加锁 + CAS"替代全表锁，是并发计数的默认选择（其源码在 java-basics 与并发专章深挖）。

## 八、工程场景钩子

- **电商**：SKU 属性、购物车 `Map<skuId, item>`；防刷用 `Set<ip>` 去重。
- **金融**：幂等表 `Map<requestId, result>` 快速判重；分库分表用一致性哈希路由（本质也是哈希定桶）。
- **电力**：设备实时状态表 `ConcurrentHashMap<deviceId, status>` 高并发读写。

## 八、例子：正确用法与错误用法

```java
// 例子目的：把"定桶、扰动、扩容预分配、可变 key、LRU"五个知识点各给出可运行的正确用例与错误用例
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;   // 并发哈希表，知识点 4 要用

public class HashDemo {

    // 知识点 1：扰动 + 位与定桶（这就是 JDK HashMap 的算法）
    static int bucket(Object key, int cap) {
        int h = key.hashCode();                 // 第一步：取 hashCode
        h = h ^ (h >>> 16);                     // 扰动：高 16 位异或进低 16 位，让高位也参与定桶
        return h & (cap - 1);                   // 容量为 2 的幂时，位与等价取模且只花一条指令
    }

    public static void main(String[] args) {
        System.out.println(bucket("A", 16) + "," + bucket(17, 16));   // 正确用例输出：1,1 —— 两个 key 同桶形冲突

        // 知识点 2：已知规模预分配容量
        Map<String, String> good = new HashMap<>((int) (100 / 0.75f) + 1);  // 打算放 100 条 → 算得 134，向上取 2 的幂为 256
        for (int i = 0; i < 100; i++) good.put("k" + i, "v" + i);            // 全程只一次初始化分配，无 rehash
        System.out.println(good.get("k42"));                                  // 正确使用结果：输出 v42，查找 O(1)

        Map<String, String> small = new HashMap<>(4);                          // 错误取向：容量给得比规模小很多
        for (int i = 0; i < 100; i++) small.put("k" + i, "v" + i);             // 结果仍正确，但反复扩容 rehash 搬约 96 次桶

        // 知识点 3 错误用法：拿可变对象当 key，放进入后改哈希字段
        Key k = new Key(1);
        Map<Key, String> m = new HashMap<>();
        m.put(k, "hit");                     // 按当时 hashCode 定桶存入
        k.id = 999;                          // 错误：放入后修改参与哈希的字段 → hashCode 变了
        System.out.println(m.get(k));         // 输出 null：到另一个桶里找，对象"泄漏"在表里取不到
        System.out.println(m.size());         // 输出 1：还在表内，但再也访问不到

        // 正确做法：key 用不可变类型
        Map<Record, String> safe = new HashMap<>();
        safe.put(new Record(1), "hit");      // record 字段不可变 → hashCode 稳定
        System.out.println(safe.get(new Record(1)));   // 正确使用结果：输出 hit（依赖 equals/hashCode 一致）

        // 知识点 4：HashMap 并发读写是错误用法（丢数据 / size 不准）
        Map<Integer, Integer> shared = new HashMap<>();     // 错误：多线程共用普通 HashMap
        Map<Integer, Integer> conc = new ConcurrentHashMap<>();   // 正确：分桶 CAS+synchronized，允许并发读写
        conc.put(1, 1);                                     // 合法写入
        System.out.println(conc.get(1));                     // 输出 1；注意 ConcurrentHashMap 禁止 null 键值
        try {
            conc.put(null, 1);                  // 错误：ConcurrentHashMap 不允许 null → 抛 NullPointerException
        } catch (NullPointerException e) {
            System.out.println("并发表禁止 null：无法区分「没有该键」与「值是 null」");   // 输出该行
        }

        // 知识点 5：LinkedHashMap 做 LRU（访问序 + 淘汰最旧）
        int cap = 2;
        Map<String, String> lru = new LinkedHashMap<>(16, 0.75f, true) {   // accessOrder=true：访问即重排
            @Override protected boolean removeEldestEntry(Map.Entry<String, String> e) {
                return size() > cap;                                       // 超限则自动淘汰头部最旧项
            }
        };
        lru.put("a", "1"); lru.put("b", "2");   // 现有 [a, b]
        lru.get("a");                             // 访问 a → a 移到尾部，变为 [b, a]
        lru.put("c", "3");                        // 超容量 → 淘汰 b
        System.out.println(lru.keySet());         // 正确用例输出：[a, c]
    }

    static class Key {                                // 可变且 hashCode 依赖可变字段 → 本例中的反面教材
        int id; Key(int id) { this.id = id; }
        @Override public int hashCode() { return id; }
        @Override public boolean equals(Object o) { return o instanceof Key x && x.id == id; }
    }
    record Record(int id) {}                          // 不可变 key：hashCode/equals 由编译器生成且稳定
}
```

## 九、本节要点回顾

1. 哈希=用哈希函数把 key 定到数组桶，O(1) 点查，代价是完全不保序。
2. 三命题：冲突（链地址/开放寻址）、负载因子与 2 倍扩容 rehash、退化（树化 + 抗 HashDoS）。
3. 容量取 2 的幂 + 扰动 + 位与定桶是 JDK 的配套设计；已知规模预分配容量。
4. 只做点查/去重/计数选哈希；要范围/有序/前缀交给树；并发用 ConcurrentHashMap。

下一节进入"有序的世界"——二叉树与二叉搜索树，那里能回答哈希回答不了的范围与排序问题。
