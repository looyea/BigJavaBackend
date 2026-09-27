# 作业题 · ChatClient、Prompt 模板与结构化输出

## 作业 1：跑通 ChatClient（必做）

用 Spring AI 接入一个模型（可用本地 Ollama 免密钥）：

- 通过 `ChatClient.Builder` 构建 client，设 `defaultSystem` 人设
- 分别用 `call().content()` 与 `stream()`（配 SSE 输出到浏览器）实现同一问题
- 记录 `SimpleLoggerAdvisor` 打印出的真实请求体

**产出**：call 与 stream 的使用差异小结 + 最终发往模型的 Prompt 内容。

## 作业 2：结构化输出健壮性（必做，本节核心）

定义 `record TicketSummary(int ticketId, String status, List<String> actions, double confidence)`：

1. 用 `.entity(TicketSummary.class)` 让模型从一段工单文本抽取该结构
2. 构造"模型返回缺字段/带解释文字"的场景，复现解析异常
3. 加入：明确"只输出 JSON"的提示 + 一次自动重试 + 最终降级（返回部分字段/人工兜底）

**验收标准**：非法 JSON 时不崩、有可观测的重试与降级路径；贴成功与降级两次结果。

## 作业 3：PromptTemplate 治理（必做）

把一个散落硬编码提示的助手改造成 `PromptTemplate`：

- system/user 分层，few-shot 示例独立可插拔
- 对注入的 `context` 做 token 预算裁剪（超长截断 + 记录）
- 设计两个模板版本做 A/B，比较答案质量与 token 消耗

## 作业 4：换模型可移植性实验（选做，架构师向）

同一套 `ChatClient` 业务代码，在两个不同模型（如 OpenAI 与本地模型）间仅改配置切换：

- 观察结构化输出遵循度、答案风格差异
- 记录"抽象是否真的减少了改动"，评估厂商锁定风险到底降了多少

## 作业 5：提示词与成本护栏（选做，架构师向）

为"电力客服助手"设计提示词规范 + token 预算：system 规则、上下文拼接上限、输出长度约束，并把每次调用的输入/输出 token 与耗时打到 Micrometer 指标（呼应 spring-boot s2-3），给出成本告警阈值思路。
