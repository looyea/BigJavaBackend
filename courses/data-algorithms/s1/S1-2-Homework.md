# 课后作业 · 数组与链表

> 2 题，均为可直接动手的原语实现与选型分析，附验收标准与参考答案。

## 作业 1：用数组实现定长滚动记录（RingBuffer 雏形）（60分）

**要求**：实现一个容量固定为 `K` 的"最近 K 条记录"结构，支持 `add(e)` 追加、`getFromOldest(i)` 按从旧到新读取、超出容量自动淘汰最旧。禁止使用 `LinkedList`。

**提示**：用 `Object[]` + `head` 指针 + `size`，取模实现循环。

**验收标准**：
- 追加与淘汰均 O(1)，读取 O(1)，无元素搬移。
- 满后新元素覆盖最旧，读顺序正确。

**参考答案要点**：
```java
class Ring<T> {
    Object[] buf; int head=0, size;
    Ring(int k){ buf=new Object[k]; size=k; }
    void add(T e){ buf[(head+size)% ... ] }  // 尾=(head+size)%cap；满时 head=(head+1)%cap
    T get(int i){ return (T) buf[(head+i)%size]; }
}
```
- 核心：`head` 指向最旧、`tail=(head+size)%cap`；`size==cap` 时 `add` 先写 tail 再 `head=(head+1)%cap`。

## 作业 2：ArrayList vs LinkedList 实测与归因（40分）

**要求**：分别用 `ArrayList<Integer>` 与 `LinkedList<Integer>` 完成 (a) 尾部 add 100 万；(b) `get` 随机访问 100 万次；(c) 头部 add 10 万次。记录耗时并解释差异来源。

**验收标准**：
- 能指出 (b) 中 LinkedList 慢是 O(n) 遍历定位 + 缓存不友好，而非"常数大"这么简单。
- 能说明 (c) 中 LinkedList 头加 O(1) 确实快于 ArrayList 的 O(n) 搬移，但代价在 (b)。

**参考答案要点**：
- (a) 两者接近，ArrayList 略优（无节点对象分配）。
- (b) ArrayList 完胜（O(1) 连续访问）；LinkedList 每次从表头走，O(n)。
- (c) LinkedList 头插 O(1) 胜出，ArrayList 每次 `arraycopy` 全体后移 O(n)。
- 结论：混合负载默认 ArrayList；仅当"头/中间增删远多于随机访问"才考虑链表，且栈/队列应用 ArrayDeque。
