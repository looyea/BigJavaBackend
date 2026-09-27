# RAG：切分、Embedding 与召回

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：能设计一条完整的 RAG 离线索引 + 在线检索流水线；理解文档切分（chunking）、Embedding、向量库选型、混合检索与重排（rerank）每一步的取舍；用 Spring AI 的 `ETL Pipeline` 与 `VectorStore` 落地，并知道"召回质量"才是 RAG 成败关键。

## 一、RAG 解决什么：给模型外挂"私有、最新、可溯源"的知识

模型参数里的知识有三大局限：**不知道你的私有数据、知识有截止日期、容易幻觉且无法溯源**。RAG（检索增强生成）在回答前先从你的知识库**检索**相关片段，拼进上下文再让模型**生成**——把"开卷考试"变成可能，且答案可附引用来源。

```flow
离线：文档 → 解析(Reader) → 切分(Splitter) → 向化(Embedder) → 存入 VectorStore
在线：用户问题 → 向量化 → VectorStore 相似度召回 TopK → (重排) → 拼进 Prompt → LLM 生成带引用的回答
```

## 二、切分（Chunking）：最被低估、却最影响效果的一步

没有完美切分，只有权衡：

| 策略 | 说明 | 适用 |
| --- | --- | --- |
| 固定大小 + overlap | 按 token 定长切，段间留重叠防切断语义 | 通用起点 |
| 递归/结构感知 | 按标题、段落、Markdown/HTML 层级切，保持语义完整 | 文档、手册、规章 |
| 语义切分 | 按句子embedding相似度断开，段落主题一致 | 长而杂的叙述 |
| 父子/小块检索大块返回 | 用小块精准召回、返回其所属大块给模型足够上下文 | 需要上下文又要求召回精度 |

**经验**：chunk 太小→召回片段缺上下文、模型看不懂；太大→一个 chunk 混多主题、相似度被稀释且塞爆预算。电力规程、金融产品说明书这类**结构清晰文档优先结构感知切分**，并保留元数据（来源、章节、生效日期）用于过滤与溯源。

## 三、Embedding 与向量库选型

- **Embedding 模型**把文本映射成向量，语义相近→向量距离近。选型看：维度、支持语言（中文务必选中/多语强的）、最大输入长度、成本。**同一套系统必须用同一个 embedding 模型**——换模型要全量重建索引（向量空间不通用）。
- **VectorStore** 存向量 + 元数据 + 做相似检索（ANN）。Spring AI 把主流都做成可插拔实现：

| 选型 | 定位 |
| --- | --- |
| pgvector | 已用 PostgreSQL 的团队首选，事务/元数据过滤/和现有库一体 |
| Milvus / Qdrant / Weaviate | 专业向量库，大规模（亿级）、性能/过滤强 |
| Redis（Vector Search）/ Elasticsearch | 已有该中间件、想复用运维与混合检索 |
| 内存 SimpleVectorStore | 仅 demo/测试 |

## 四、召回质量：混合检索 + 重排（进阶关键）

纯向量召回有短板：对**精确关键词**（型号、错误码、法条编号）不敏感，对**否定/术语**可能跑偏。生产级 RAG 通常两步增强：

1. **混合检索（Hybrid）**：向量（语义）+ BM25/关键词（精确）并行召回再融合（如 RRF）。电力设备型号、金融代码这类场景几乎必上。
2. **重排（Rerank）**：召回 TopN（如 50）后用 **cross-encoder** 对 query-文档对精排，取 TopK（如 5）给模型。粗召回快、重排准，显著提升"最相关的那条真的在最前"。

Spring AI 通过 `VectorStore` 相似度搜索 + 自定义 `DocumentRetriever`/ Advisor（`QuestionAnswerAdvisor`/`RetrievalAugmentationAdvisor`）编排这些步骤。

## 五、ETL Pipeline 与在线流水线（Spring AI 落地）

```java
// 例子目的：串联 RAG 离线 ETL 与在线检索，展示 Spring AI 把知识库拼进上下文的标准流水线
// 离线 ETL：读→切→（增强元数据）→向量化入库
documentParser.parse(resource)
  -> textSplitter.split(doc)            // TokenTextSplitter 等；错误用法：chunk 过大→一个片段混多主题、相似度被稀释
  -> metadataEnrich(doc)                // 补来源/章节/日期；错误用法：不存来源→答案无法溯源被业务拒
  -> embeddingModel.doc(doc) -> vectorStore.add(chunks);  // 向量化后入库（错误用法：换 embedding 模型却不重建索引→新旧向量空间不通用，召回全乱）

// 在线：一个 Advisor 把检索注入到 ChatClient 调用链
ChatClient.create(...)
  .prompt(userQuestion)
  .advisors(new QuestionAnswerAdvisor(vectorStore, Search.builder().topK(5).similarityThreshold(0.75).build())) // 阈值卡掉低相关（宁缺毋滥）
  .call().content();   // 正确使用结果：自动检索并拼接上下文，可要求带引用
// 错误用法：不设 similarityThreshold→ 低相关片段也塞进 Prompt→ 模型被噪声带偏、答非所问
```

`similarityThreshold` 用来卡掉低相关（宁缺毋滥），但阈值要按 embedding 分布实测调，别拍脑袋。

## 六、动手验证

1. 同一文档用"固定大小"和"结构感知"两种切分，各跑 20 个问答，人工评答案质量，体会 chunking 影响。
2. 造一个含精确型号（如 "SG-110/10"）的查询，对比纯向量 vs 混合检索的召回命中差异。
3. 加 rerank（先召回 50 再精排取 5），观察最终塞进 Prompt 的片段相关性提升，同时记录多出的延迟成本。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 答非所问/没依据就编 | 召回没命中相关知识，又没设阈值/引用约束 |
| 换 embedding 模型后全乱 | 新旧向量空间不同，未重建索引 |
| 精确术语/编号检索不到 | 纯向量对关键词不敏感，需混合检索 |
| 上下文超 token 预算 | TopK×chunk 太大未做重排/裁剪 |
| 答案无法溯源被业务拒 | 元数据没存来源，未要求模型给引用 |

## 八、关联技术栈

- **Spring AI**：ETL（`DocumentReader/TextSplitter/EmbeddingModel`）、`VectorStore`、`QuestionAnswerAdvisor`
- **中间件**：pgvector/Milvus/Qdrant/ES/Redis、BM25/ESRAG 混合
- **模型**：Embedding 模型、cross-encoder rerank、LLM 生成
- **安全**：检索到的文档内容属"不可信输入"，防 Prompt 注入（s2-2）
- **评估**：召回率/准确率、答案相关性、忠实度（faithfulness）评估（s2-2）
