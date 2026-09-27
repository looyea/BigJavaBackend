# S3-2 反射、注解与动态代理 · 小测

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. Spring AOP 中，目标类**实现了接口**时默认采用的代理方式是？（15分）

- A. CGLIB 生成子类
- B. JDK 动态代理（基于接口）
- C. AspectJ 编译期编织
- D. 静态手写代理类

> 答案：B
> 解析：有接口默认用 JDK 动态代理（`Proxy.newProxyInstance`），无接口才退到 CGLIB 生成子类；Spring Boot 2.x 起可整体强制 `proxyTargetClass=true` 优先 CGLIB。

### 2. 要在运行时用反射读取一个注解，该注解的 `@Retention` 必须是？（15分）

- A. RetentionPolicy.SOURCE
- B. RetentionPolicy.CLASS
- C. RetentionPolicy.RUNTIME
- D. 任意一种都可以

> 答案：C
> 解析：SOURCE 编译即丢（如 `@Override`），CLASS 进字节码但反射读不到（默认），只有 RUNTIME 保留到运行期才能被 `getAnnotation` 读取。

### 3. 【多选】关于反射与动态代理，下列说法正确的有哪些？（20分）

- A. CGLIB 无法代理 `final` 类或 `final` 方法
- B. 同类内部 `this.method()` 自调用会绕过代理，导致 `@Transactional` 失效
- C. 一个类在堆中可以有多个不同的 `Class` 实例，随调用者变化
- D. `getDeclaredMethods()` 返回本类所有方法但不含从父类继承的方法

> 答案：ABD
> 解析：C 错——同一类加载器下一个类只有一个 `Class` 实例。A（CGLIB 靠继承无法覆写 final）、B（自调用绕过代理）、D（Declared 不含继承）均正确。

### 4. 判断：Lombok 的 `@Data` 生成 getter/setter 是在运行时靠反射实现的。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：Lombok 是编译期注解处理器（APT），在 `.java→.class` 阶段直接改 AST 生成方法，运行时零反射开销。

### 5. 填空题：MyBatis 的 Mapper 接口没有编写实现类却能被调用，其本质是靠 ______ 动态代理生成代理对象，在 `InvocationHandler` 的 ______ 方法里执行对应 SQL。（10分）

> 答案：JDK / invoke

### 6. 简述 JDK 动态代理与 CGLIB 的实现原理、前提限制与典型差异，并说明 Spring AOP 如何在两者间做选择。（30分）

> 参考答案：
> - JDK 动态代理：`Proxy.newProxyInstance` 运行期生成实现了同名接口的代理类，回调 `InvocationHandler.invoke`；前提是目标必须实现接口，只能转成接口类型
> - CGLIB：通过生成目标类的**子类**并覆写非 final 方法实现拦截（`MethodInterceptor.intercept`）；目标是 final 类/方法或无 final 修饰限制时无法代理
> - 差异：JDK 面向接口、代理对象不能强转实现类；CGLIB 面向类、可转成父类类型，典型事故 `cannot be cast to XxxImpl`
> - Spring AOP 选择：有接口默认 JDK、无接口用 CGLIB；Boot 2.x 默认 `proxyTargetClass=true` 优先 CGLIB
> - 二者都是运行期代理，均存在自调用绕过代理的局限，AspectJ 编织是字节码级另一路线
