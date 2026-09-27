# 实际面试题 · 异常体系与最佳实践

## 题 1：Java 异常体系讲一下，Error 和 Exception 有什么区别？

**答题要点**：根是 `Throwable`，分 `Error` 和 `Exception`。`Error` 是 JVM 级严重问题（`OutOfMemoryError`、`StackOverflowError`），应用不该也无法恢复，不要 catch。`Exception` 再分**受检**（编译期强制处理，如 `IOException`/`SQLException`）和**非受检**（`RuntimeException` 及其子类，如 NPE、`IllegalArgumentException`）。受检表示"调用方应能处理的可恢复状况"，非受检多表示"编程错误或不可就地恢复"。

**追问链**：为什么 `NullPointerException` 是非受检？→ 它代表程序 bug（没判空），不该靠编译器强制每处 try，而应在设计期消除。

## 题 2：受检和非受检异常你怎么选？

**答题要点**：看"调用方能否恢复且需要被强制感知"。可预期、可恢复、属于正常业务分支（如"库存不足"要上层提示用户）→ 可用受检或至少是可区分的业务异常；程序 bug、无法就地恢复 → 非受检。工程现实：**现代框架普遍把受检包装成非受检再抛**——因为受检 `throws` 沿调用链传染、污染 lambda/回调签名，且 **Spring `@Transactional` 默认只对非受检回滚**。

## 题 3：`finally` 里有 `return` 会怎样？try-with-resources 比手写 finally 好在哪？

**答题要点**：

1. `finally` 里 `return`/`throw` 会**吞掉** try 中的异常或返回值——所以禁止。
2. try-with-resources：自动 `close()`、按声明**逆序**关闭；关键是当"业务异常"和"close 异常"同时出现时，它把 close 异常作为**被抑制异常**（`getSuppressed()`）挂在主异常上，**不丢根因**。手写 finally 若 close 又抛，会覆盖掉真正的业务异常，排查时只见关闭报错。

## 题 4：什么是异常链？为什么包装异常必须带 cause？

**答题要点**：把底层异常转成上层业务异常时，用带 `Throwable cause` 的构造把它传进去（`new OrderException("下单失败", ioEx)`），堆栈里就会打印 `Caused by: ...`。丢掉 cause（只 `new RuntimeException("失败")`）会**丢失原始堆栈**，线上根本定位不到是哪一行、哪个底层抛的。原则：**转译类型可以，但根因链不能断**。

## 题 5：`@Transactional` 方法里抛了异常，事务到底回不回滚？

**结构化回答**：

1. 默认规则：只对 **`RuntimeException` 和 `Error`（非受检）** 回滚；抛**受检异常默认不回滚**。
2. 坑：业务方法声明并抛出 `IOException` 等受检异常时，数据照常提交 → 脏数据事故。
3. 解法：① 业务层统一抛非受检；② 需要受检也回滚就用 `@Transactional(rollbackFor = Exception.class)`；③ 注意异常别在方法内被自己 catch 吞掉（吞了就不回滚，见 spring-core s2-2 失效场景）。

## 高频追问速答

1. 能用异常做流程控制吗？→ 不该，异常构造要 `fillInStackTrace` 代价高、可读性差。
2. `catch(Exception e){ e.printStackTrace(); }` 有什么问题？→ 打到标准Err非受控日志、吞了处理；应 `log.error("msg", e)` 带栈并在合适层真正处理或再抛。
3. 空 catch 块危害？→ 静默吞异常，故障无线索，是最危险的反模式之一。
4. 自定义异常要注意什么？→ 选好父类（是否可恢复决定受检/非受检）、提供 message+cause 构造、别滥用、考虑携带业务码。
5. try 里 return、finally 里改变量，返回哪个值？→ return 前先算好返回值入栈，finally 对基本类型的修改不影响已定返回值（引用类型内容变更则可见）。
