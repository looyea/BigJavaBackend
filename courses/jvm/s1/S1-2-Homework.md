# 作业题 · 类加载机制与双亲委派

> 作业不判分，做完对照参考答案自查。全部在 JDK 17 上验证。

## 作业 1：三类被动引用验证（必做）

抄写课程第二节 `Parent/Child/Hold` 代码，`main` 里分别执行 `System.out.println(Child.a)`、`System.out.println(Hold.CONST)`、`Parent[] arr = new Parent[10]`。

要求：观察打印结果里**没有** `Child <clinit>`、没有 `Hold <clinit>`（常量被内联）、数组创建不初始化 `Parent`，用注释逐条说明为什么。

## 作业 2：写一个"守住委派"与一个"破坏委派"的加载器（必做）

1. `MyLoader` 只重写 `findClass`（从磁盘读 `.class` 字节数组 + `defineClass`），加载一个业务类，打印它的 `getClassLoader()` 与父链，验证委派正常。
2. 写一个故意重写 `loadClass` 且**不先委派**的 `BreakLoader`，尝试加载一个你伪造的 `java/lang/String.class`，观察抛 `SecurityException: Prohibited package name: java.lang`。

**参考答案要点**：核心类受 Bootstrap 独占保护，破坏委派去加载 `java.*` 会被 JVM 拦截——这正是双亲委派的安全价值。

## 作业 3：复现"同名不同加载器"的 ClassCastException（必做）

用两个互不委派的独立 `ClassLoader` 各加载同一份 `Person.class`，各 `newInstance` 一个对象，尝试把 loader1 的实例强转成 loader2 视角的 `Person`，观察 `ClassCastException: Person cannot be cast to Person`。再让两个加载器都委派给同一父加载器，验证异常消失。

要求：注释写清"类 identity = 加载器 + 全限定名"。

## 作业 4：SPI 加载器排查（选做）

加载 JDBC 驱动，打印 `sun.misc.LegacyDriver`… 或 `Driver` 实现类的 `getClassLoader()`，以及当时 `Thread.currentThread().getContextClassLoader()`，验证实现类是由 TCCL（App 层）而非 Bootstrap 加载的，理解 SPI 的"反向委派"。
