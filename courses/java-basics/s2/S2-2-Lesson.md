# 异常体系与最佳实践

> 本节难度：★★☆☆☆
> 本节重要性：★★★★☆
> 学习产出：画出 `Throwable→Error/Exception→RuntimeException` 的体系，讲清**受检 vs 非受检**的取舍依据；掌握 try-with-resources 的资源契约与"抑制异常"、异常链保 cause、"别用异常做流程控制""别吞异常/别在 finally 里 return"等一线铁律。异常处理直接决定故障能不能被定位——是稳定性的地基。

## 一、体系：一棵树，两类分叉（★★☆☆☆）

```flow
Throwable
 ├─ Error               JVM 级严重问题：OutOfMemoryError、StackOverflowError —— 应用不应 catch
 └─ Exception
     ├─ RuntimeException（非受检 unchecked）：NPE、IllegalArgumentException、IllegalStateException...
     └─ 其他 Exception（受检 checked）：IOException、SQLException、ClassNotFoundException...
```

- **受检（checked）**：编译器**强制**你 `catch` 或 `throws` 声明。设计意图是"**调用方有能力、也应该处理**的可恢复状况"（文件没找到、网络断了）。
- **非受检（unchecked = RuntimeException）**：编译器不管。多代表**编程错误或不可恢复**（传参非法、状态不对、空指针）。

## 二、受检 vs 非受检：到底选哪个（★★★☆☆）

| 视角 | 受检 | 非受检 |
| --- | --- | --- |
| 语义 | 可预期的、调用方能恢复 | 程序 bug / 无法就地恢复 |
| 成本 | `throws` 沿调用链**传染**，污染签名 | 签名干净，靠上层统一兜底 |
| 滥用后果 | 层层 try-catch 只为编译通过，最后 `catch(Exception)→printStackTrace` 吞掉 | 该处理的没处理，故障逃逸到顶层 |

**工程趋势**：现代框架几乎一边倒地**把受检包装成非受检再抛**——Spring 的 `DataAccessException`、`JdbcOperationException` 把 `SQLException` 转成非受检，`Hibernate`/`MyBatis` 同理。原因有二：① 受检 `throws` 严重污染函数式/lambda 与模板回调签名；② **`@Transactional` 默认只对 RuntimeException 回滚**，若业务抛受检异常，事务不回滚（见 spring-core s2-2）——这是个真实的生产陷阱。

> 经验法则：**库/框架边界内抛非受检（让切面/全局兜底），确需调用方感知的可恢复协议错误才用受检**，且范围要小。

## 三、try-with-resources：别再手写 finally 关流（★★★★☆）

JDK7 的 `try(资源声明)` 自动调用 `AutoCloseable.close()`，且**正确处理"业务异常 + 关闭异常"并存**：

```java
try (var in = new FileInputStream("a");
     var out = new FileOutputStream("b")) {   // 声明顺序 a、b
    // 用 in / out；即使这里抛异常，也保证关闭
} catch (IOException e) {
    // 处理
}
// 关闭顺序：声明的逆序 → 先关 out 再关 in
// 若 close 也抛异常，它作为「被抑制异常」挂在主异常上：e.getSuppressed()
```

对比手写 `finally { in.close(); }`：老写法里若业务异常先抛、close 又抛，**后抛的会"吃掉"先抛的真异常**，排查时只看到关闭报错看不到根因。try-with-resources 用 suppressed 机制把两者都留下。资源变量可来自外部（`try (r)`，须 effectively final）。

## 四、一线铁律（★★★☆☆）

1. **异常链别断**：包装底层异常为业务异常时**必须带上 cause**：`throw new OrderException("下单失败", e)`，否则丢掉原始堆栈无法定位根因。
2. **不要吞异常**：空 `catch {}` 或 `catch(Exception e){}` 是事故温床；至少记日志。**日志要带栈**：`log.error("msg", e)` 而非 `log.error("msg:" + e.getMessage())`（丢了堆栈）。
3. **别用异常做流程控制**：异常构造要抓栈（`fillInStackTrace`）代价高，且严重损害可读性；用条件判断代替。
4. **finally 里禁止 return / throw**：会吞掉 try 中的异常或返回值。
5. **早抛晚捕（fail-fast）**：进方法先校验参数抛 `IllegalArgumentException`/`Objects.requireNonNull`；在**能处理它的层次**再 catch，别在每层都 catch-print。
6. **别 catch `Throwable`/`Error`**：Error 你处理不了，吞掉会掩盖 JVM 严重问题。
7. **优先具体异常、别抛裸 `Exception`/`RuntimeException`**：给调用方可编程区分的类型；自定义异常要选好父类、提供 message+cause 构造、想清是否可恢复。

## 五、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 事务没回滚，数据写脏 | 业务方法抛的是**受检异常**，`@Transactional` 默认不回滚（应回滚非受检，或用 `rollbackFor` 显式指定） |
| 报"关流出错"却查不到真因 | 手写 finally，close 异常吞掉了业务异常；应改 try-with-resources 看 getSuppressed |
| 偶发故障完全没日志线索 | `catch(Exception e){}` 空吞 / 只 `e.getMessage()` 丢了栈 |
| 接口耗时莫名变高、栈很浅 | 用异常当 if 做流程控制，频繁 `fillInStackTrace` |
| 一处 NPE 冒到 500 | 入参未做 fail-fast 校验，null 一路漂到深处才炸 |

## 六、动手题

1. 写一个"业务异常吞主异常"的复现：`try{ throw new RuntimeException("业务"); } finally{ in.close(); }`（close 里再抛），观察最终抛出的是哪个；改成 try-with-resources，用 `getSuppressed()` 验证两个异常都在。
2. 给一段 `catch(Exception e){ e.printStackTrace(); }` 的代码做 CR，列出所有问题并改正（日志带栈、缩小捕获范围、不吞）。
3. 定义 `OrderException extends RuntimeException`，带 `(String, Throwable)` 构造，把某 `IOException` 包装抛出并保留 cause。

## 七、关联技术栈

- **框架回响**：`@Transactional` 回滚规则 ↔ spring-core s2-2；全局异常 `@RestControllerAdvice`/`ProblemDetail` ↔ spring-mvc s2-1；Boot 错误页 ↔ spring-boot s2-2
- **资源管理**：try-with-resources 与连接池归还 ↔ 持久层连接池包（HikariCP）
- **可靠性延伸**：异常分类与重试/降级/熔断 ↔ 高可用/微服务治理分区
- **并发**：线程内未捕获异常 → `UncaughtExceptionHandler`（juc 相关）

## 八、本节小结

异常设计的两个核心判断：**"调用方能否恢复"决定受检与否**，**"根因能不能被追到"决定是否保链、是否吞异常、是否用对 try-with-resources**。现代后端倾向非受检 + 全局兜底 + 保留 cause，务必记住它对事务回滚规则的连带影响。

下一节进入 Lambda 与 Stream API，看函数式接口如何撑起惰性流式处理，以及并行流的那些坑。
