# 作业题 · 集合框架全景

> 不判分，做完自查。JDK 17+ 手写运行。

## 作业 1：选型填空（必做）

给出下列场景应选的最合适的集合并说明理由：

1. 统计单词出现次数。
2. 需要对用户 ID 去重且保持注册先后顺序遍历。
3. 维护一个始终按分数降序的排行榜（允许并列）。
4. 实现一个"后进先出"的任务撤销栈。

**参考答案要点**：1 `HashMap`/`merge`；2 `LinkedHashSet`；3 `TreeMap` 配反向比较器或 `PriorityQueue`；4 `ArrayDeque`（不要用遗留 `Stack`）。

## 作业 2：复现并修复 CME（必做）

写一个 `List<Integer>`，在增强 for 循环里删除所有偶数，观察 `ConcurrentModificationException`；再分别用两种方式修复：

- `Iterator` 的 `remove()`
- `list.removeIf(x -> x % 2 == 0)`

## 作业 3：扩容代价实测（选做）

预分配 `new ArrayList<>(1_000_000)` 与默认构造逐个 `add` 一百万次，各计时 5 轮取均值，写一句话解释差异来源（`Arrays.copyOf`）。

## 作业 4：asList 三连坑（选做）

```java
List<Integer> a = Arrays.asList(1, 2, 3);
a.set(0, 9);            // 能吗？
a.add(4);               // 能吗？
List<String> b = Arrays.asList(new String[0]);  // 元素类型是什么？
```

逐一写出结果并用"固定大小视图 / 数组协变"解释。
