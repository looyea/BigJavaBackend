# 倒排索引与分词器链路

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：能讲清正排/倒排索引的区别与倒排索引的 dictionary + posting list 结构，画出一条 analysis 链路（character filter → tokenizer → token filter）并说明索引期与搜索期为何要对称；会用 mapping 区分 `text`（分词检索）与 `keyword`（精确/聚合/排序），理解 BM25 相关度打分的关键因子，并识破"用 keyword 做全文搜索""分词器索引/搜索不对称导致搜不到"这类高频配置错误。

## 一、为什么是倒排索引

关系库 LIKE '%词%' 无法走索引、全表扫描；搜索引擎换了一个数据方向。

```text
图目的：正排 vs 倒排，方向决定检索能力
正排：docId → 该文档的所有词      （适合"给文档查它含哪些词"）
倒排：词(term) → 含该词的 docId 列表(posting list) + 词频/位置
      "搜索" 本质= 由词反查文档，倒排让 O(命中数) 而非 O(全库)
结构：dictionary(有序 term 字典，FST 压缩前缀) + postings(位图/delta 编码 docId)
```

## 二、analysis 链路：一段文本如何变成可检索的 term

```text
图目的：分词三阶段，索引期与搜索期必须对称
character filter：清洗字符（去 HTML、全角转半角）
tokenizer：切成 token（standard 按 Unicode 词边界；中文要 ik_smart/ik_max_word）
token filter：加工 token（lowercase 小写、stop 去停用词、synonym 同义词、ngram 补全）
对称性铁律：索引用什么 analyzer，搜索也要用同一 analyzer，否则词对不上永远搜不到
```

```json
// 目的：为一个中文商品名配置 text+keyword 双字段与自定义分析器
{
  // 说明：title 建为 text 供全文检索，raw 子字段建为 keyword 供精确匹配/聚合/排序
  "mappings": {
    "properties": {
      "title": {
        // 结果：索引期 ik_max_word 细切提召回，搜索期 ik_smart 粗切提精度（显式非对称设计）
        "type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart",
        "fields": { "raw": { "type": "keyword" } }
      }
    }
  }
}
```

- `text` 会被分词进倒排索引，供全文检索；`keyword` 不分词整串入索引，用于精确匹配、排序、聚合。
- 索引期 `ik_max_word` 细切提高召回，搜索期 `ik_smart` 粗切提高精度——这是一种有意为之的"非对称"，但必须是显式设计而非误配。

## 三、mapping：字段类型选错，全盘皆输

```java
// 目的：说明 text 与 keyword 的行为差异（伪查询语义）
// title 为 text：  match(title,"华为手机")  → 分词后命中"华为""手机"相关文档（全文检索）
//                   term(title,"华为手机")   ❌ 整串当作一个词去查，几乎必然查不到
// status 为 keyword：term(status,"ON_SALE") ✅ 精确；可直接用于 aggregation 与 sort
// 反例：把需要全文搜索的 title 建成 keyword ❌ 只能整串精确匹配，分词检索完全失效
// 反例：把用于聚合的 status 建成 text ❌ 聚合/排序基于分词后的碎片且默认 fielddata 关闭，报错或结果错误
// 反例：mapping 定型后改字段类型 ❌ 倒排索引已生成，必须 reindex 重建，不能原地改
```

## 四、BM25：相关度不是布尔命中

```text
图目的：影响 _score 的三个因子（tf-idf 的现代演进）
TF 词频：词在文档中出现越多越相关（有饱和上限，非线性）
IDF 逆文档频率：越稀有的词区分度越高，"的""是"几乎不加分
字段长度归一：同样命中，短文档比长文档更相关
调分：function_score / boost 对字段、时间衰减、业务权重做加权，是搜索排序的日常战场
```

## 五、关联课程

倒排索引是段（segment）不可变结构的基础，写入与近实时可见见 [写入流程与近实时可见](S1-2-Lesson.md)；聚合与深分页取舍见 [聚合、深分页与集群容量规划](S1-3-Lesson.md)；分词链路里的字符串处理与注入面可对照 [注入原理与预处理防御](../../web-defense/s1/S1-1-Lesson.md) 中的 NoSQL 注入一节。
