# 倒排索引与分词器链路 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. 搜索引擎用倒排索引替代正排，核心收益是？（6分）

- A. 节省磁盘空间
- B. 由词反查文档，检索代价从 O(全库) 降到 O(命中数)
- C. 支持事务
- D. 数据强一致
> 答案：B
> 解析：倒排把"词→文档列表"预组织好，全文搜索无需像 LIKE 那样全表扫描。

### 2. 一条 analysis（分词）链路的三个阶段正确顺序是？（6分）

- A. tokenizer → character filter → token filter
- B. character filter → tokenizer → token filter
- C. token filter → character filter → tokenizer
- D. character filter → token filter → tokenizer
> 答案：B
> 解析：先字符清洗，再切词成 token，最后对 token 加工（小写、停用词、同义词）。

### 3. 需要对字段做全文搜索，mapping 应选？（6分）

- A. keyword
- B. text
- C. long
- D. object
> 答案：B
> 解析：text 会被分词进倒排索引供 match 检索；keyword 整串不分词，只适合精确/聚合/排序。

### 4. 索引期与搜索期 analyzer 不对称（误配）最典型的后果是？（6分）

- A. 索引变大
- B. 写入变慢
- C. 搜不到本该命中的文档
- D. 聚合报错
> 答案：C
> 解析：两端切出的 term 对不上，倒排字典里没有查询词，召回直接为 0（除非是有意为之的显式设计）。

### 5. 关于 BM25 打分，下列说法正确的是？（6分）

- A. 只判断是否命中，不打分
- B. 词频越高越相关但有饱和上限，稀有词区分度更高
- C. 长文档天然更相关
- D. 停用词加分最多
> 答案：B
> 解析：BM25 = TF(饱和) + IDF(稀有词权重高) + 字段长度归一（短文档更相关）；A 是布尔检索非 BM25。

### 6. 已建好索引后发现某字段类型选错，正确做法是？（6分）

- A. 直接 PUT 修改 mapping 类型即可
- B. 重建索引（reindex）并重新灌数据
- C. 重启集群自动纠正
- D. 删掉该字段
> 答案：B
> 解析：倒排结构已按旧类型生成，字段类型不可原地改，只能新建正确 mapping 再 reindex。

### 7. 想把商品名既能全文搜索、又能精确聚合，推荐做法是？（6分）

- A. 只建 text
- B. 只建 keyword
- C. text 主字段 + 内嵌 keyword 子字段（multi-field）
- D. 存两份到不同索引
> 答案：C
> 解析：`title`(text) 供检索、`title.raw`(keyword) 供聚合/排序，是标准 multi-field 用法。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. 以下哪些属于 token filter 的职责？（多选）（9分）

- A. 转小写 lowercase
- B. 去停用词 stop
- C. 同义词 synonym
- D. 按 Unicode 词边界切词
> 答案：A、B、C
> 解析：切词（D）是 tokenizer 的工作；lowercase/stop/synonym 都在 token 层加工，属 token filter。

### 9. 关于 text 与 keyword，下列描述正确的有？（多选）（9分）

- A. text 分词后进倒排索引，适合 match 全文查询
- B. keyword 不分词，适合 term 精确、聚合与排序
- C. 对 text 字段直接 term 整串，几乎查不到
- D. keyword 适合做中文全文检索
> 答案：A、B、C
> 解析：keyword 整串不分词，用它做全文检索（D）会退化成精确匹配，达不到分词检索效果。

## 三、简答题（共 40 分）

### 10. 简答题：为电商商品搜索设计 title 字段的 mapping 与分词方案，说明倒排索引为何适合该场景、analysis 链路如何配置、以及为什么需要 text+keyword 双字段。（40分）

> 参考答案：
- 要点1：搜索=由词反查文档，倒排索引 dictionary+posting list 让代价降为 O(命中数)，远优于关系库 LIKE 全表扫描。（10分）
- 要点2：中文 title 用 ik tokenizer，链路 character filter→tokenizer→token filter，可按业务加同义词/停用词；索引与搜索 analyzer 有意配成 ik_max_word / ik_smart。（14分）
- 要点3：title 建 text 供 match 检索，同时内嵌 raw(keyword) 子字段供精确匹配、聚合、排序。（10分）
- 要点4：类型一旦定错不能原地改，需 reindex；排序/聚合禁用 text 分词碎片。（6分）
