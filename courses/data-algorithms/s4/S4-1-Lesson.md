# 双指针与滑动窗口

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：对撞/快慢双指针靠单调性降维，滑动窗口“扩张→违规收缩→更新”模板把区间枚举降到 O(n)。

> 这两招是"把 O(n²) 打成 O(n)"的利器，专治**有序数组、连续区间、子串**。
> 共同内核：**利用单调性安全地丢掉一部分、避免重复扫描**。看懂"为什么可以丢弃"，就通了。
> （二分已独立成节，见 s3-3。）

## 一、对撞双指针：有序数组上从两端夹逼

数组有序时，左右两端向中间走，根据当前值与目标的关系移动一端——**单调性保证被丢的那侧不可能再是答案**。

```java
// 例子目的：在有序数组上用对撞指针找出所有两数之和等于 target 的下标对
int[] a = {1, 2, 4, 7, 11};                       // 前提：必须已升序
int target = 9;
int l = 0, r = a.length - 1;                      // 从两端夹差
while (l < r) {
    int s = a[l] + a[r];
    if (s < target) l++;          // 和太小：a[l] 配任何更小的 r' 都不够，安全丢 l
    else if (s > target) r--;     // 和太大：a[r] 配任何更大的 l' 都超，安全丢 r
    else { System.out.println(l + "," + r); l++; r--; }   // 命中→打印下标对，两端同时收缩继续找
}
// 正确使用结果：输出 1,3（即 2+7=9），全程只比较 4 次，O(n)
// 错误用法：把同一算法用在无序数组 a=[1,11,2,7,4] → 丢半的理由不再成立，会漏掉 2+7 甚至输出错误配对（不报错但结果错，最难查）
// 应用边界：本例只适用于"已排序"；无序场景要改用哈希表法（O(n) 时间、O(n) 空间），二者按内存预算选
```

典型题：两数之和(有序)、三数之和(排序后固定一个 + 对撞)、盛最多水的容器、验证回文串、反转数组。

## 二、快慢双指针：同向扫描，原地维护

两个指针同向、步速或时机不同，靠"间距/追及"省掉额外空间：

```java
// 例子目的：原地移除指定值，返回值是新长度（不额外分配数组）
int[] b = {3, 2, 3, 4};
int val = 3;
int slow = 0;
for (int fast = 0; fast < b.length; fast++)
    if (b[fast] != val) b[slow++] = b[fast];   // 只在不满足条件时写并前移，O(1) 空间压缩
System.out.println(slow);                        // 正确使用结果：输出 2，前两个元素变为 [2, 4]
// 错误用法：直接拿 b.length 当有效长度遍历 → 后两个格子是残留旧值，会重复处理已丢弃元素
// 错误用法：写成 if (b[fast] == val) b[slow++] = b[fast]; → 条反了，留下来的是要被删的值
```

- **链表判环 / 找环入口（Floyd 判圈）**：fast 走两步、slow 走一步，相遇即有环；再把一指针归头、同速走，重逢点即入口。核心优势：O(1) 空间（对比 HashSet 记访问要 O(n)）。
- **找链表中点 / 倒数第 k**：快慢步速差或间距差。

**判断用哪种**：数据有序求配对/夹逼 → 对撞；同向扫描 + 原地维护一段状态 / 链表追及 → 快慢。

## 三、滑动窗口：处理"连续子数组/子串"的模板

求"满足某条件的**最长/最短连续**子数组/子串"。窗口 `[left, right]` 随 right 扩张，违规时 left 收缩——**每个元素最多进出窗口各一次 → O(n)**，把暴力枚举所有区间的 O(n²) 降维。

```java
// 通用模板：扩张 → 违规就收缩 → 更新答案
// 例子目的：求"无重复字符的最长子串"长度，把模板里的抽象判定换成真实的 cnt 重复判断
String s = "abcabcbb";
int left = 0, ans = 0; Map<Character,Integer> cnt = new HashMap<>();
for (int right = 0; right < s.length(); right++) {
    cnt.merge(s.charAt(right), 1, Integer::sum);      // ① 右元素入窗，更新窗口状态
    while (cnt.get(s.charAt(right)) > 1) {            // ② 仅当新入元素重复才收缩（比全表扫描 isInvalid 快）
        cnt.merge(s.charAt(left), -1, Integer::sum); left++;   // 左元素出窗，直到重复被消除
    }
    ans = Math.max(ans, right - left + 1);             // ③ 此刻窗口合法，更新(求最长在这)
}
System.out.println(ans);                              // 正确使用结果：输出 3（"abc"）
// 错误用法：把更新答案放到 while 收缩之前 → 会用非法窗口长度污染 ans
// 错误用法：求"最短"还在收缩后才更新 → 漏掉收缩过程中的更优解，最短类题必须边收缩边更新
```

- 求**最长**：收缩到合法后更新答案。
- 求**最短**（如最小覆盖子串）：扩张到"有解"后，一边尝试收缩一边更新答案。
- **定长窗口**：维护 `right-left+1==k`，超出就移 left（如"和为 target 的定长子数组"）。

典型题：无重复字符的最长子串、长度最小的子数组(和≥target)、至多 K 个不同字符的最长子串、找到字符串中所有字母异位词、最小覆盖子串。

## 四、为什么滑动窗口是 O(n)（务必讲清）

right 单向前进 n 步；left 也只会前进、从不回退，最多走 n 步。**总移动次数 ≤ 2n**，故均摊 O(n)。关键前提：**窗口具有"扩张只会让条件更易破坏/收缩只会让条件更易满足"的单调性**，否则 left 需要回退，模板失效。

## 五、工程钩子

- **限流滑动窗口计数器**：时间轴分桶滚动、维护窗口内请求数超阈值即限流（Sentinel/Nginx 原理同源）——就是"把每个请求当 right 入窗、过期请求当 left 出窗"。
- **监控**：滑动平均、错误率窗口、连续 N 分钟超标告警。
- **文本/日志**：最长满足条件的连续片段匹配。

## 六、两招的适用信号

| 问题特征 | 用哪招 |
|---|---|
| 有序数组，找配对/夹逼出目标 | 对撞双指针 |
| 原地去重/移动、链表判环/找中/倒数 k | 快慢双指针 |
| 连续子数组/子串，最长/最短/定长满足条件 | 滑动窗口 |

## 七、例子：正确用法与错误用法

```java
// 例子目的：把快慢指针判环与"单调性不成立时窗口失效"两个真实后果写成可运行代码
import java.util.*;

public class TwoPointerDemo {
    static class Node { int v; Node next; Node(int v) { this.v = v; } }

    static boolean hasCycle(Node head) {           // Floyd 判圈：O(1) 空间
        Node fast = head, slow = head;
        while (fast != null && fast.next != null) {   // 错误写法：只判 fast != null → fast.next 招 NullPointerException
            fast = fast.next.next;                     // 快指针走两步
            slow = slow.next;                          // 慢指针走一步
            if (fast == slow) return true;              // 追上 → 有环
        }
        return false;                                  // fast 走到末尾 → 无环
    }

    public static void main(String[] args) {
        Node h = new Node(1); h.next = new Node(2); Node two = h.next;
        two.next = h;                                  // 人工造环 1→2→1
        System.out.println(hasCycle(h));               // 正确用例输出：true
        // 错误用法：拿 HashSet 记访问来判环同样正确，但空间 O(n)；内存受限的链式结构里应选快慢指针

        // 知识点：单调性不成立时，滑动窗口模板直接失效
        int[] neg = {2, -1, 3}; int target = 4;         // 含负数→"和≥target 就收缩"不再单调
        int left = 0, sum = 0, best = Integer.MAX_VALUE;
        for (int right = 0; right < neg.length; right++) {
            sum += neg[right];
            while (sum >= target) {                     // 收缩后 sum 可能反而变大（因为弹出的是负数），无法保证最优
                best = Math.min(best, right - left + 1); sum += -neg[left]; left++;
            }
        }
        System.out.println(best);                       // 输出 2，但正确答案是 3（[2,-1,3]）——窗口法在这里不可用
        // 正确做法：含负数的区间和问题改用前缀和 + 哈希（见 s4-3），而不是硬套窗口

        // 知识点：定长窗口才是滑窗的正确主场（全为正数的长度限定）
        int[] pos = {2, 3, 1, 2, 4}; int k = 2, win = 0;
        for (int i = 0; i < pos.length; i++) { win += pos[i]; if (i >= k) win -= pos[i - k]; if (i >= k - 1) System.out.print(win + " "); }
        // 正确用例输出：5 4 3 6 —— 每步只加一个减一个，严格 O(n)
    }
}
```

## 八、本节要点回顾

1. 双指针靠单调性"安全丢弃"一半，把 O(n²) 降到 O(n)：对撞看有序配对、快慢看原地压缩/链表追及。
2. 滑动窗口是双指针处理连续区间的模板：扩张→违规收缩→更新，left 永不回退故 O(n)。
3. 用之前先确认单调性成立，否则窗口无法只朝一个方向走。
4. 工程里限流/监控的滑动窗口本质是同一思想的时间版。

下一节：递归与分治——从"遍历技巧"上升到"把问题交给更小的自己"。
