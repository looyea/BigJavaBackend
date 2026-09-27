# 课后作业 · B/B+树、Trie、跳表、并查集、布隆过滤器

> 2 题，一题手写并查集，一题结构选型论证，附验收标准与参考答案。

## 作业 1：并查集 + 账号合并（60分）

**要求**：给定多组"同一用户的多个账号"，用并查集求出最终有多少个独立用户，并输出每个用户下的账号集合。要求 `find` 带路径压缩。

**验收标准**：
- `parent[]` 初始化各指向自己；`union` 合并两组根；`find` 路径压缩。
- 统计独立根个数即用户数；均摊近 O(α(n))。

**参考答案要点**：
```java
Map<String,String> parent = new HashMap<>();
String find(String x){ parent.putIfAbsent(x,x);
    String r=x; while(!r.equals(parent.get(r))) r=parent.get(r);
    while(!parent.get(x).equals(r)){ String n=parent.get(x); parent.put(x,r); x=n; } // 压缩
    return r; }
void union(String a,String b){ parent.put(find(a), find(b)); }
// 最后按 find(acct) 分组，组数=独立用户数
```

## 作业 2：结构选型论证（40分）

**要求**：为下列需求各选一种本节结构并说明理由，指出其代价：
1. 搜索框输入前缀实时联想候选词。
2. 判断"某设备与某网关是否在同一片网络（连通）"，边会不断新增合并。
3. 风控要在毫秒内判断"这串手机号是否是已知黑名单"（10 亿级、内存紧张、可容忍极小漏判方向）。
4. 数据库主键索引支撑大量 `order by id limit` 分页。

**验收标准**：能各对应 Trie / 并查集 / 布隆过滤器 / B+ 树，并说出各自局限。

**参考答案要点**：
1. Trie（压缩 Trie/Radix）：按字符下探取前缀全部词；代价是指针内存，需压缩。
2. 并查集：动态合并集合、近 O(1) 判连通；代价是不支持"断开连接"（只合并）。
3. 布隆过滤器：极省内存判存；代价是假阳性——"说存在"要回源精确确认，且不支持删除，需 Counting Bloom 或定期重建。
4. B+ 树：叶子链表天然有序，范围/分页顺序扫；代价是写放大与页分裂。
