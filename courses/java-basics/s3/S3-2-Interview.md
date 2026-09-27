# S3-2 反射、注解与动态代理 · 面试追问

> 这组题是"框架原理"面试的必经关。答好的关键：不止背 API，而是把"反射给能力、注解给声明、代理给改道"三者串成一条链，并能说清 Spring AOP 的选型与失效边界。

## 题 1：说说反射的原理和它的性能代价，什么场景该用、什么场景不该用？

**期望时长**：2 分钟

**答题要点**：

- 原理：运行时通过 `Class` 对象拿到类的元数据（字段/方法/构造器/注解），`invoke`/`get`/`newInstance` 操作，绕过编译期绑定。
- 代价：关闭编译检查、JIT 难内联、`setAccessible` 破坏封装、反复查方法表慢。
- 该用：框架通用能力（IoC/AOP/ORM 映射/序列化）、插件化、SPI。
- 不该用：业务热点路径手写反射——是设计坏味道，应改面向接口。

**追问链**：怎么缓解反射性能？→ 缓存 `Method`/`Constructor`、用 `MethodHandle`/`LambdaMetafactory`、或 `MethodReader` 生成访问器（Jackson afterburner、CGLIB BeanCopier 思路）。

## 题 2：JDK 动态代理和 CGLIB 有什么区别？Spring 怎么选？

**答题要点**：

- JDK：`Proxy` + `InvocationHandler`，基于**接口**，代理类是 `$ProxyN implements 接口`；无接口用不了，不能强转实现类。
- CGLIB：生成目标类**子类**覆写方法，基于继承；final 类/方法代理不了。
- Spring AOP：有接口默认 JDK、无接口 CGLIB；Boot 2.x 默认 `proxyTargetClass=true` 优先 CGLIB。

**追问链**：`(OrderServiceImpl) proxy` 报 ClassCastException 为什么？→ 当时是 JDK 接口代理，不是 Impl 子类；改注入接口类型或强制 CGLIB。

## 题 3：`@Transactional` 在哪些情况下会失效？

**答题要点**（层层经典）：

- 同类内部 `this` 自调用绕过代理。
- 方法非 `public`。
- 异常被 catch 吞掉 / 抛的是非 `RuntimeException`（默认只回滚 unchecked，需 `rollbackFor`）。
- 类没被 Spring 管理、或多线程下事务上下文不随线程传播。
- 数据库/引擎不支持事务（如 MyISAM）。

**追问链**：自调用怎么根治？→ 注入自身代理、拆到别的 Bean、`AopContext.currentProxy()`；AspectJ 编织是另一路线。

## 题 4：注解的三种保留策略分别用在哪？为什么 `@Override` 用 SOURCE？

**答题要点**：SOURCE 仅编译期（`@Override` 给编译器校验，无需进字节码）；CLASS 进 class 但反射读不到，是默认，给字节码工具/APT 用；RUNTIME 保留到运行期可反射读，Spring/Jackson 全靠它。

**追问链**：Lombok 是哪种？→ 它其实靠 APT/AST 改写编译期生成代码，不依赖运行期反射读注解。

## 题 5：反射、注解、动态代理是怎么"合体"成一个框架的？

**答题要点**：以 `@Cacheable` 为例——① 启动反射扫描 `getAnnotation` 找目标方法；② 为其 Bean 建 JDK/CGLIB 代理拦截调用；③ 拦截器里按注解语义织入缓存逻辑，未命中再反射调真实方法。IoC 装配、MyBatis Mapper、RPC 存根同属此模式。

**追问链**：这条链上最容易被业务误用的一环？→ 代理"外部才生效"，导致自调用失效——也是面试与线上事故的高频交汇点。

## 高频速答

- `Class` 实例唯一吗？→ 同一类加载器下一个类仅一个。
- `getMethods` vs `getDeclaredMethods`？→ 前者 public 含继承，后者本类全部不含继承。
- 反射能破 private 吗？→ `setAccessible(true)`，但 JDK9 模块未 `opens` 会受限。
- 代理一定基于接口吗？→ JDK 是，CGLIB 基于继承，AspectJ 基于字节码织入。
- APT 和反射读注解的区别？→ APT 在编译期生成代码，反射在运行期读取，性能与时机都不同。
