# 小测验 · 请求处理链路与映射机制

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. Spring 5.3+ / Boot 默认的路径匹配器是？（20分）

- A. AntPathMatcher
- B. PathPatternParser（预编译成段树，更快更省内存）
- C. 正则全表扫描
- D. Trie 字典树（自研）

> 答案：B
> 解析：`matching-strategy` 默认 path-pattern-parser，把模式预编译为 PathSegment 树。

### 2. 同时存在 `/orders/{id}` 与 `/orders/latest`，访问 `/orders/latest` 命中哪个？（20分）

- A. `/orders/{id}`
- B. `/orders/latest`（字面量比路径变量更"具体"，优先）
- C. 随机
- D. 报 ambiguous

> 答案：B
> 解析：越具体的模式优先级越高，字面路径胜过带变量的路径。

### 3.（多选）`RequestMappingInfo` 的匹配排序会考虑哪些维度？（25分）

- A. 路径模式
- B. HTTP method、params、headers
- C. consumes、produces
- D. Controller 类的字母顺序

> 答案：ABC
> 解析：路径/方法/参数/头/消费/产出都参与 specificity 比较；D 无关。

### 4. 关于拦截器 `preHandle` 返回 false，正确的是？（15分）

- A. 后续拦截器仍全部执行
- B. 中断后续，Handler 不执行，但已执行过的拦截器的 afterCompletion 会回调
- C. postHandle 会执行
- D. 什么都不发生

> 答案：B
> 解析：preHandle 正序、任一 false 即断，Handler 跳过，已过的拦截器 afterCompletion 逆序执行。

### 5. 判断题：完全等价的两个 `@RequestMapping` 映射会导致启动抛出 ambiguous mapping 异常。（20分）

- A. 正确
- B. 错误

> 答案：A
> 解析：无任何 specificity 可区分时，`RequestMappingHandlerMapping` 启动即失败。
