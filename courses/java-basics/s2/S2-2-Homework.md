# 作业题 · 异常体系与最佳实践

> 不判分，对照参考要点自查。

## 作业 1：主异常被吞复现（必做，本节核心）

写一个实现 `AutoCloseable` 的类，其 `close()` 故意抛异常；在 `try` 里先抛"业务异常"，分别用两种写法对比：

1. 手写 `finally { resource.close(); }` —— 观察抛出的是 close 的异常，业务异常消失
2. try-with-resources —— 观察抛出的是业务异常，`getSuppressed()` 里能拿到 close 异常

**产出**：两段代码 + 各自最终抛出的异常，一句话总结为什么必须用后者。

## 作业 2：异常链修复（必做）

给定把底层 `IOException` 直接 `throw new RuntimeException("失败")` 丢掉 cause 的代码，改成保留 cause 的自定义 `DataReadException extends RuntimeException`（提供 `(String, Throwable)` 构造），打印堆栈验证出现 `Caused by: java.io.IOException`。

## 作业 3：fail-fast 校验（必做）

为一个"转账"方法 `transfer(Account from, Account to, BigDecimal amt)` 补前置校验：参数非空（`Objects.requireNonNull`）、金额 > 0、余额充足，非法分别抛 `IllegalArgumentException`/`IllegalStateException`，做到"坏输入第一时间就地失败"，并说明这为何比"深处 NPE"更好排查。

## 作业 4：CR 挑刺（选做）

对下面代码列出所有异常处理问题并改正：

```java
try {
    doBusiness();
} catch (Exception e) {
    log.error("失败:" + e.getMessage());   // ①
} finally {
    conn.close();                            // ②
    return Result.ok();                      // ③
}
```

**参考要点**：① 丢栈，应 `log.error("失败", e)`；② close 是受检且可能吞主异常，应用 try-with-resources；③ finally 里 return 吞异常，删除。

## 作业 5：受检 vs 非受检设计（选做，架构师向）

为一个"调用第三方支付网关"的方法设计异常体系：哪些情况（超时、验签失败、额度不足、渠道维护）该抛可区分的业务异常？该用受检还是非受检？如何保证 `@Transactional` 场景下异常能触发回滚（抛非受检或 `rollbackFor`）？产出一张"异常类型 → 是否可恢复 → 受检/非受检 → 上层处理策略"的表。
