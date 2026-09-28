# 安全过滤器链执行顺序 · 作业

## 作业 1：画出你项目的真实过滤器链

- **目标**：把"链是有序的"从知识变成可见资产。
- **任务**：对一个 Spring Boot 3 / Security 6 工程：
  1. 开 `logging.level.org.springframework.security=TRACE` 请求一个受保护接口，记录依次经过的过滤器；
  2. 结合 `FilterChainProxy` 输出（或 actuator/filters）画出该路由命中的链与顺序，标注认证段、授权闸、异常翻译位置；
  3. 指出图中至少两处"顺序即语义"的依赖（如为什么 ExceptionTranslation 在 Authorization 外层）。
- **验收标准**：一张链序图 + 每个过滤器一句话职责；能回答"我的 JwtFilter 插在哪、为什么"。
- **参考解法要点**：对照课文 7 步骨架核对差异；注意多链场景 securityMatcher 的命中顺序。

## 作业 2：故意制造三类事故并修复

- **目标**：亲手踩一遍链序经典坑，形成排错肌肉记忆。
- **任务**：在演示工程依次复现并修复：
  1. 把 JwtFilter 移到链尾（或锚点不存在的过滤器上），观察"验签成功仍 401"，再修正；
  2. 给 JwtFilter 加 @Component 不处理容器注册，观察 token 被解析两次，用 FilterRegistrationBean 关闭重复注册；
  3. 把 permitAll 写成 "/api/**" 再收回为 "/api/public/**" + anyRequest().authenticated()，用 MockMvc securityDsl 写三条断言（public 200 / 私有 401 / 越权 403）。
- **验收标准**：三组"故障现象→根因→修复→断言防复发"记录齐全。
- **参考解法要点**：401/403 断言分别打 EntryPoint 与 DeniedHandler 路径；断言测试配合 [与 Mockito/Testcontainers/Spring Boot Test 协同（关联）](../../junit/s1/S1-4-Lesson.md) 的切片方式。

## 作业 3：异步上下文传递评审（文档题）

- **目标**：识别 ThreadLocal 上下文在并发改造下的失效面。
- **任务**：找出工程里所有"异步/池化后读 SecurityContext"的代码路径（@Async、CompletableFuture.supplyAsync、MQ 消费线程、定时任务），逐条判定：应传递上下文？应改为显式传参？应清除？写半页改造清单（含 DelegatingSecurityContextExecutor 示例一段）。
- **验收标准**：清单覆盖≥3类线程场景，每条给出"传递/下传/清除"三选一结论与理由。
- **参考解法要点**：消费线程"继承上下文"通常错（消息不属于某 HTTP 主体）；定时任务同理。越权防线在 [反序列化、越权与业务逻辑漏洞](../../web-defense/s1/S1-3-Lesson.md)。
