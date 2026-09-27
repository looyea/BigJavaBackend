# 小测验 · 异常体系与最佳实践

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. 下列哪一个是**受检异常（checked）**？（15分）

- A. `NullPointerException`
- B. `IllegalArgumentException`
- C. `IOException`
- D. `IllegalStateException`

> 答案：C
> 解析：`IOException` 直接继承 `Exception`、编译器强制处理，是受检；其余都是 `RuntimeException` 子类（非受检）。

### 2. `try` 块抛异常、`finally` 块里又 `return`，最终调用方拿到的是？（15分）

- A. try 抛出的异常
- B. finally 的返回值，try 的异常被吞掉
- C. 编译失败
- D. 两个都返回

> 答案：B
> 解析：`finally` 里 `return`/`throw` 会吞掉 try 中的异常或返回值——这正是"禁止在 finally 里 return"铁律的由来。

### 3. 【多选】下列关于异常处理的正确做法有？（20分）

- A. 包装底层异常时保留 cause：`new BizException(msg, e)`
- B. 用 `log.error("处理失败", e)` 打印完整堆栈
- C. 用抛异常/捕获异常代替正常的 `if` 分支做流程控制
- D. 资源用 try-with-resources 管理，而非手写 finally 关闭

> 答案：ABD
> 解析：C 错——异常构造要抓栈、代价高且损害可读性，不应做流程控制。ABD 均为最佳实践。

### 4. 判断：try-with-resources 中若业务代码和 `close()` 都抛异常，`close()` 的异常可通过 `getSuppressed()` 取到，不会覆盖主异常。（10分）

- A. 正确
- B. 错误

> 答案：A
> 解析：主异常（业务）向上抛，close 异常作为"被抑制异常"挂在其上，根因不丢。

### 5. 填空题：Spring `@Transactional` 默认只在抛出 ______ 异常（如 RuntimeException/Error）时回滚，抛受检异常默认 ______ 滚。（15分）

> 答案：非受检（unchecked） / 不回
> 解析：这也是为何业务层倾向抛非受检异常，或用 `rollbackFor=Exception.class` 显式扩大回滚范围。

### 6. 简答题：受检与非受检异常如何取舍？为什么现代框架偏好把受检包装成非受检再抛？（25分）

> 参考答案：
> - 判断依据：调用方"可预期且能恢复"→ 受检；"程序 bug 或无法就地恢复"→ 非受检
> - 受检缺点：`throws` 沿调用链传染、污染签名，尤其在 lambda/模板回调中难以处理，易被凑数 catch 吞掉
> - 框架偏好非受检原因：① 保持函数式/回调签名干净；② `@Transactional` 默认只对非受检回滚，包装成非受检才能保证回滚一致；③ 交由全局异常处理/AOP 统一兜底
> - 补充：无论哪种，包装都必须保留 cause（异常链），别吞异常
