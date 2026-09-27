# 反射、注解与动态代理

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：吃透 `Class`/`Method`/`Field` 这套**运行时元数据 API**，理解它为何是"框架之根"；掌握**注解**（元注解、保留策略、编译期 vs 运行期处理）如何与反射配对形成"声明式编程"；重点辨析 **JDK 动态代理（基于接口）与 CGLIB（基于子类）的本质区别**。Spring IoC/AOP、MyBatis、Jackson、Dubbo 的"魔法"全部建立在这三件套之上（机制落地详见 spring-core s2-1 AOP，本节专注语言底层原理）。

## 一、反射：把"类"当对象来操作（★★★★☆）

正常代码编译期就确定了调用谁；**反射（Reflection）让程序在运行时拿到任意类的"图纸"并操作它**——读字段、调方法、造实例、看注解。

```java
// 例子目的：反射四步——拿 Class → 造实例 → 拿方法 → 调用，全程运行时动态确定
Class<?> clz = Class.forName("com.big.OrderService");   // 三种拿 Class：.class / 实例.getClass() / Class.forName(字符串)
Object obj = clz.getDeclaredConstructor().newInstance(); // 调空参构造造对象
Method m = clz.getDeclaredMethod("query", String.class);  // 按名字+参数类型拿方法
m.setAccessible(true);                                  // 打破 private 封装（JDK9 模块化后受 opens 限制）
Object r = m.invoke(obj, "NO-1");                       // 运行时调用，r 就是 query 的返回值
// 正确用法结果：若 query("NO-1") 返回 "订单NO-1"，则 r.equals("订单NO-1") 为 true
// 错误用法 1：类名写错 Class.forName("com.big.NotExist") → 抛 ClassNotFoundException
// 错误用法 2：方法签名不匹配 getDeclaredMethod("query") 少传 String.class → 抛 NoSuchMethodException
// 错误用法 3：不调 setAccessible 直接 invoke private 方法 → 抛 IllegalAccessException
```

核心入口是 `Class` 对象（一个类在堆里只有一个 `Class` 实例，由类加载器产出，呼应 jvm 分区"类加载"）。`getMethods()` 只含 public（含继承），`getDeclaredMethods()` 含本类全部但不含继承——这是高频踩坑点。

**代价**：① 关闭了编译期检查与 IDE 优化；② `setAccessible` + `invoke` 比直接调用慢一到数个数量级（JIT 无法内联）；③ 破坏封装。所以**框架用它、业务代码少用它**——业务里到处 `Class.forName` 通常是设计坏味道。

## 二、注解：结构化的元数据 + 处理时机（★★★★☆）

注解本质是 `@interface`，是**贴在代码上的结构化标签**，自身不执行任何逻辑——**必须有"注解处理器"去读它才有意义**，而读取靠的正是反射。

```java
// 例子目的：定义一个 RUNTIME 可反射读取的 @Cacheable 注解（注解自身不执行逻辑，靠处理器读）
@Target(ElementType.METHOD)        // 能贴在哪：只能贴方法（贴到类上编译报错）
@Retention(RetentionPolicy.RUNTIME)// 保留到何时：SOURCE(编译丢)/CLASS(默认,进class)/RUNTIME(运行时反射可读)
public @interface Cacheable {
    String value() default "";     // 属性；单属性名为 value 可省略 key
    long ttl() default 3600L;      // 带默认值，不写 ttl 时用 3600
}
// 正确用法结果：@Cacheable("order") 贴方法后，运行时 method.getAnnotation(Cacheable.class).value() 返回 "order"
// 错误用法：把 @Retention 写成 SOURCE/CLASS → 运行时 getAnnotation(...) 返回 null，框架根本读不到这个注解（静默失效）
```

三种保留策略决定了注解的命运：`@Override` 是 SOURCE（只给编译器看）；`@FunctionalInterface` 是 CLASS；而 **Spring/Jackson 的几乎所有注解都是 RUNTIME**，因为要在运行时反射读取。按处理时机分两类：

- **运行期反射读**：`@Service`/`@Transactional`/`@Cacheable`/Jackson 的 `@JsonProperty`——框架启动或调用时 `method.getAnnotation(...)` 取出并织入行为。
- **编译期注解处理（APT，`javax.annotation.processing`）**：Lombok、MapStruct、AutoValue、ARouter——在 `.java→.class` 阶段生成额外源码或改 AST，**运行时零反射开销**（Lombok 的 `@Data` 生成 getter 就是编译期干的，不是反射）。

> **契约式设计的雏形**：注解 + 处理器 = "你声明意图，框架负责实现"。这也是 CDI `@Inject`、JAX-RS `@Path` 等 Jakarta 标准注解的同一套路（对照 jakarta-ee s1-2）。

## 三、动态代理：运行期凭空造出实现类（★★★★★）

代理 = 不改动目标类，在它前面加一层做额外事（日志、事务、鉴权、缓存）。**动态代理在运行时生成代理类字节码**，而非手写。两大流派：

```flow
              JDK 动态代理                       CGLIB（Spring 默认之一）
原理     Proxy.newProxyInstance + 实现          生成目标类的子类，覆写非 final 方法
         InvocationHandler.invoke 分发          （ByteBASM/ASM 造字节码）
前提     目标必须实现接口                        目标类/方法不能是 final，需可被继承
入口     java.lang.reflect.Proxy                org.springframework.cglib（Spring 内嵌）
回调     InvocationHandler.invoke(proxy,m,args)  MethodInterceptor.intercept(...)
典型     MyBatis Mapper、RPC 服务桩、            类无接口时的 AOP、@Configuration 增强
         所有基于接口的声明式能力
```

```java
// 例子目的：JDK 动态代理最小骨架——Mapper 接口"没有实现类"却能调用，靠的就是运行期生成代理
Object proxy = Proxy.newProxyInstance(
    clz.getClassLoader(), new Class[]{OrderMapper.class},   // 被代理的必须是接口
    (p, method, args) -> { /* 反射拿到 method，去执行对应 SQL 并返回 */ return sqlSession.invoke(method, args); });
OrderMapper mapper = (OrderMapper) proxy;                    // 应用：把代理强转回接口类型直接使用
mapper.query("NO-1");                                        // 调用被拦到 InvocationHandler，输出对应 SQL 执行结果
// 正确用法结果：任何对 mapper 的方法调用都会进入 lambda，统一执行 SQL——这就是 MyBatis Mapper 无实现类可用的原理
// 错误用法：目标类没有接口而用 JDK Proxy → 抛 IllegalArgumentException: ... is not an interface（此场景需改 CGLIB）
```

**Spring AOP 的选择规则**（面试高频）：目标**有接口默认用 JDK 代理**，**无接口用 CGLIB**；Spring Boot 2.x 起默认整体 `proxyTargetClass=true` 即优先 CGLIB。JDK 代理只能转型到接口，CGLIB 能转型到类——这解释了"`ClassCastException: cannot be cast to XxxImpl`"的经典事故。

**它的天花板**：Spring AOP 是**代理模式**，只对"通过代理进来的外部调用"生效——**同类内部 `this.method()` 自调用绕过代理，`@Transactional`/`@Async` 会失效**（根治办法见 s2-2：注入自身代理或拆分类；AspectJ 编织是另一条路，织入字节码而非运行期代理）。

## 四、三者如何合体成"框架"（★★★★★）

一个 `@Cacheable` 从声明到生效的完整链路，把三件套串起来：

1. **扫描**：启动时反射遍历包，`getAnnotation(Cacheable.class)` 找出带注解的方法（注解 + 反射）。
2. **代理**：为该 Bean 生成 JDK/CGLIB 代理，把方法调用拦截到 `InvocationHandler`（动态代理）。
3. **织入**：拦截器里查缓存，未命中才反射 `invoke` 真实方法（反射 + 注解语义）。

IoC 容器注入、`@Autowired` 装配、MyBatis Mapper 生成、Jackson 序列化字段映射、Dubbo 服务存根——**全是这三板斧的不同排列组合**。理解了它们，框架不再是"黑魔法"。

## 五、动手题

1. 写一个 `find` 工具：给定对象，用反射递归打印其所有字段（含 `getDeclaredFields` + `setAccessible`）的名字与值，体会 `getMethods` 与 `getDeclaredMethods` 的差异。
2. 自定义 `@Retry(count=3)` 注解 + 一个 JDK 动态代理 `InvocationHandler`，被代理方法抛异常时自动重试，跑通"注解→反射读取→代理织入"闭环。
3. 复现"自调用事务失效"：Service 里 `a()` 内部 `this.b()`，`b` 标 `@Transactional`，通过调用 `a` 观察 `b` 的回滚不生效，并写出两种修复。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 内部 `this.xxx()` 调用，`@Transactional`/`@Async`/`@Cacheable` 失效 | 自调用绕过代理对象（代理模式固有局限） |
| `cannot be cast to XxxImpl` | 目标是 JDK 接口代理，却强转成实现类；改面向接口或强制 CGLIB |
| final 类/方法上的注解增强没生效 | CGLIB 无法继承/覆写 final；JDK 代理需接口 |
| `@Override`/Lombok 生成的代码"运行期读不到" | 保留策略是 SOURCE/CLASS，RUNTIME 才能反射读 |
| 反射调用性能骤降、GC 压力大 | 热点路径滥用反射，未缓存 Method/未开方法句柄 |

## 七、关联技术栈

- **向前**：`Class` 实例唯一性 / 类加载 ↔ jvm 分区"类加载双亲委派"；`setAccessible` 与 JDK9 模块系统 ↔ java-modern
- **向后（机制落地）**：Spring AOP 代理选型与事务失效根治 ↔ spring-core s2-1；`@Inject`/拦截器 ↔ jakarta-ee s1-2 CDI
- **生态**：MyBatis Mapper、Dubbo 存根、Jackson 字段映射、Lombok/MapStruct(APT) 全靠这三件套
- **安全**：反射被用于绕过访问控制、反序列化 gadget chain 常借反射调用 ↔ 安全分区

## 八、本节小结

一句话记牢：**反射给"运行时操作类"的能力，注解给"声明意图"的语法，动态代理给"运行期改行为"的手段——三者合体即所有声明式框架的地基**。用它的三条戒律：业务代码少反射、注意 RUNTIME 保留策略、警惕自调用绕过代理。

下一节聊 `Optional` 与语言级设计取向——如何优雅治空指针，又不过度抽象。
