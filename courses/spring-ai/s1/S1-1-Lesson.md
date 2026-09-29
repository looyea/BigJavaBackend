# ChatClient、Prompt 模板与结构化输出

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：理解 Spring AI 用 `ChatClient` 统一多家大模型 API 的抽象价值；会用 `Prompt`/`PromptTemplate` 组织系统/用户/上下文消息；掌握把模型自由文本输出**稳定映射为 Java POJO**（结构化输出）的机制与坑。

## 一、Spring AI 的定位：AI 应用的 Spring 化抽象

大模型厂商 API 各家不同（OpenAI/Anthropic/通义/本地 Ollama…），直接对接会被锁定。Spring AI 提供**可移植的门面**——像 Spring 抽象 JDBC/缓存那样抽象 AI 能力：换模型/向量库主要改依赖和配置，业务代码少动。核心构件：

- `ChatModel` / `ChatClient`：对话模型与流式/链式调用入口
- `Prompt` / `Message`（`SystemMessage`/`UserMessage`/`AssistantMessage`）：一次请求的消息编排
- `EmbeddingModel`、`VectorStore`：向量化与检索（RAG，见 s2-1）
- `Advisor`：调用链拦截（记忆、RAG 注入、日志——类似 MVC 拦截器 / AOP）
- `OutputParser`：把文本转成结构化对象

## 二、ChatClient：链式、可组合的调用入口

```java
// 例子目的：用 ChatClient 链式入口统一调用大模型，展示 defaultSystem 人设 + call() 同步取答的正确写法
@Autowired ChatClient.Builder builder;   // Boot 自动配置提供 Builder（错误用法：自己 new ChatClient → 绕过自动配置、拿不到默认 Advisors）

ChatClient client = builder
    .defaultSystem("你是电力客服助手，回答要简洁、引用工单编号。") // 设定 system 人设，稳定影响每一轮回答风格
    .defaultAdvisors(new SimpleLoggerAdvisor())   // 横切：日志/记忆/RAG；此处打印最终 Prompt 便于排查
    .build();                                     // build() 得到可复用的无状态客户端，注册为单例共享

String answer = client.prompt()
    .user("查询工单 #40482 的处理进度")  // 拼一条 UserMessage
    .call()                       // 同步，拿完整回答（错误用法：在 WebFlux 线程里阻塞 call() → 占满事件循环）
    .content();                   // 正确使用结果：返回模型完整文本 answer，可直接展示
// 错误用法：不配 defaultSystem 又未在此 .system() → 模型无人设约束，回答风格漂移、不引用工单号
```

- **`call()`**：一次性拿全部结果（阻塞语义，WebFlux 下仍是响应式封装）。
- **`stream()`**：返回 `Flux<String>`，做打字机式流式响应（SSE 场景常用，呼应 spring-mvc s2-2）。
- 配置模型、温度等在 `spring.ai.openai.*`（或对应厂商）与运行时 `ChatOptions` 两层，运行时优先。

## 三、Prompt 模板：把提示词从代码里剥离

硬编码提示词难以维护与 A/B。`PromptTemplate`（基于 StringTemplate）支持占位符与变量渲染：

```java
// 例子目的：用 PromptTemplate 把提示词从代码剥离，占位符渲染后再组 Prompt
PromptTemplate tpl = new PromptTemplate("""
    你是{role}。根据以下上下文回答问题，不确定就说不知道。
    上下文：{context}
    问题：{question}
    """);                                   // {var} 为 StringTemplate 占位符（错误用法：模板里写了未提供的 {x} → render 时抛 NoSuchVariableException）
String rendered = tpl.render(Map.of(
    "role", "电商售后助手",
    "context", retrievedDocs,
    "question", userQuestion));              // 渲染成最终提示文本，再包成 UserMessage/SystemMessage 组 Prompt
// 正确使用结果：rendered 为已替换变量的纯文本；错误用法：把不可信 retrievedDocs 直接拼进 {context} 且无分隔→提示注入风险（见 s2-2）
```

**消息角色**要理解：`system`（人设与规则，最稳）→ 少量 `few-shot` 示例 → `user`（本轮输入）。上下文/检索结果通常拼进 user 或独立 messages，注意 token 预算与"把不可信内容当指令"的注入风险（见 s2-2）。

## 四、结构化输出：从自由文本到 POJO（本节硬核）

业务要的是能直接用的对象，不是散文。Spring AI 用 **`BeanOutputConverter<T>`**：它根据目标 Java 类型**自动生成 JSON Schema 并追加到提示词**，再把模型返回的 JSON 反序列化成对象。

```java
// 例子目的：用 record 作目标类型，.entity() 让模型把自由文本稳定映射为强类型 POJO
record BookRecommendation(String title, String author, int year, List<String> tags) {} // record 不可变、字段语义清晰，BeanOutputConverter 据此生成 JSON Schema

record Recommendations(List<BookRecommendation> books) {}

Recommendations result = client.prompt()
    .user("推荐 3 本分布式系统经典书，只输出 JSON") // 正确用法：明确"只输出 JSON"，避免模型附带解释导致解析失败
    .call()
    .entity(Recommendations.class);    // 直接拿到强类型对象：底层生成 schema→要模型按 JSON 输出→反序列化
// 正确使用结果：result.books() 是可遍历的 List<BookRecommendation>
// 错误用法：提示词既要"自然解释"又要 JSON → 输出带解释的坏 JSON → entity() 解析抛 IllegalStateException
// 错误用法：record 字段用 int 但模型漏填 year → 反序列化异常；工程上可置 Integer 并配降级重试兜底
```

`.entity(Class)` 底层就是 `BeanOutputConverter` 生成 schema→要求模型按 JSON 输出→解析回 POJO。也可用 `ListOutputConverter`（元素列表）、`MapOutputConverter`。

**关键坑（工程必查）**：

1. **模型不保证严格守约**：可能返回非法 JSON、字段缺失、类型错——要有解析失败的降级（重试、`@Nullable` 兜底、`fallback`）。
2. 用 **Java record / 带 Jackson 注解的不可变类**最稳，字段语义清楚有助于模型填对。
3. 复杂/嵌套 schema 对弱模型失败率高——**能拆简单就拆简单**，别一次要一大坨深层结构。
4. 别在提示词里既让它"自然解释"又要"严格 JSON"，自相矛盾会让它输出带解释的坏 JSON——**要结构化就明确"只输出 JSON"**。

## 五、动手验证

1. 用 `ChatClient` 分别调 `call()` 与 `stream()`，观察同步返回与 Flux 流式差异。
2. 定义一个 `record OrderSummary(...)`，用 `.entity()` 让模型抽取订单要点为对象；故意用会超范围的问题触发解析失败，验证你加的降级/重试。
3. 打印最终发给模型的 Prompt（`SimpleLoggerAdvisor`），确认 `PromptTemplate` 渲染 + schema 追加的实际内容——理解"结构化输出"到底往提示词里塞了什么。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| `.entity()` 偶发抛解析异常 | 模型没严格守 JSON schema，缺重试/降级 |
| 输出总带一段解释导致 JSON 解析失败 | 提示词目标冲突（既要自然语言又要 JSON） |
| 换厂商模型后行为大变 | 提示词/schema 遵循度依赖具体模型能力 |
| token 超限/费用飙升 | 模板里 context 无限拼接，未做截断与预算 |

## 七、关联技术栈

- **抽象层**：Spring AI `ChatClient`/`ChatModel`、`Prompt`、`Advisor`、`OutputConverter`
- **模型层**：OpenAI/通义/本地 Ollama 等，通过 starter 依赖 + `spring.ai.*` 配置接入
- **响应式**：`stream()`→`Flux`，SSE（spring-mvc s2-2）
- **下游**：结构化结果落库/驱动工具调用（s1-2）、RAG 注入（s2-1）
- **安全/治理**：成本、超时、注入防护（s2-2）
