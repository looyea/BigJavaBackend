# 类加载机制与双亲委派

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：完整走一遍类的**生命周期七阶段**（加载→验证→准备→解析→初始化→使用→卸载），分清"链接"三步各干什么、哪些引用会触发**主动初始化**哪些不会；讲清**类加载器分层**（Bootstrap/Platform/App）与**双亲委派模型**的工作机制和它存在的两大理由（**安全**与**类的唯一性**）；并能解释三大经典"**破坏**双亲委派"的场景——**SPI（Thread Context ClassLoader 反向委派）**、**Tomcat（WebApp ClassLoader 优先自载做隔离与热部署）**、**OSGi/模块化**——以及为什么"一个类 = 加载器 + 全限定名"会引发 `instanceof` 陷阱。

## 一、类生命周期七阶段

```flow
加载 → [验证 → 准备 → 解析]（这三步合称"链接 Linking"）→ 初始化 → 使用 → （卸载）
```

| 阶段 | 干什么 | 关键细节 |
| --- | --- | --- |
| 加载 | 按全限定名取字节码、生成类方法区内部表示、建 `Class` 对象 | 数组的"加载"由 JVM 直接创建，非加载器 |
| 验证 | 文件格式/元数据/字节码/符号引用校验 | 防恶意/损坏字节码危害 JVM |
| 准备 | 为**静态变量**分配内存、设**零值**（`int→0`） | `static final` 常量在此直接赋终值 |
| 解析 | 常量池**符号引用→直接引用** | 可延后，初始化后 |
| 初始化 | 执行 `<clinit>`（静态赋值 + 静态块） | 见下"主动/被动引用" |

## 二、初始化时机：主动 vs 被动引用（高频考点）

只有**主动引用**才触发 `<clinit>`；被动引用**不**初始化父类/自身：

```java
// 例子目的：演示三种"被动引用不触发类初始化"的经典情形，理解 <clinit> 的精确触发边界
class Parent { static int a = 1; static { System.out.println("Parent <clinit>"); } }
class Child extends Parent { static int b = 2; }              // 子类无自己的静态初始化需求
class Hold { static final int CONST = 123; static { System.out.println("Hold <clinit>"); } } // CONST 是编译期常量，被内联
public class InitDemo {
    public static void main(String[] args) {
        System.out.println(Child.a);      // 情形1：通过子类引用"父类"静态字段 → 只初始化 Parent，不触发 Child（正确：Child 不被初始化）
        System.out.println(Hold.CONST);   // 情形2：引用编译期 static final 常量 → 不初始化 Hold（值已内联进调用方常量池，故不打 "Hold <clinit>"）
        Parent[] arr = new Parent[10];    // 情形3：new 数组 → 不初始化 Parent（数组类由 JVM 直接创建，只是引用类型未实例化）
        // 错误认知：以为"碰到类名就初始化"→ 上三种都不初始化；真正的主动引用是 new/读写静态字段(非常量)/调静态方法/反射/main 类本身
    }
}
// 正确使用结果：三行分别验证"子类引用父字段、常量、数组"都不触发对应类初始化。
// 补充：父类 <clinit> 一定先于子类执行；一个类的 <clinit> 多线程下只执行一次（JVM 加锁保证），这也是静态单例线程安全的根因（但双重检查锁仍需 volatile，见 java-basics s1-3）。
```

## 三、类加载器分层

HotSpot 内置三层（JDK 9+ 命名有变，理解委派链更重要）：

```flow
Bootstrap（启动，C++，加载 <JAVA_HOME>/modules 核心类如 java.lang.*）
   ↑ 委派
Platform（JDK9+，前身 Extension，加载 java.* 平台扩展）
   ↑ 委派
Application（AppClassLoader，加载 classpath / 模块路径 上的应用类）
   ↑
自定义 ClassLoader（可插入链上任一位置）
```

## 四、双亲委派：怎么工作、为什么

**工作**：一个加载器收到加载请求，**先自己不加载，而是委派给父加载器**，父层无法完成（在其搜索范围找不到）才回退到自己 `findClass`。

```java
// 例子目的：写一个遵循双亲委派的自定义加载器——重写 findClass 而非 loadClass，保住委派链
class MyLoader extends ClassLoader {
    protected Class<?> findClass(String name) throws ClassNotFoundException { // 正确：只重写 findClass，loadClass 里的委派逻辑保持不变
        byte[] bytes = readClassBytesFromSomewhere(name);                      // 自定义来源(网络/加密盘/DB)读字节码
        return defineClass(name, bytes, 0, bytes.length);                      // 把字节数组转成 Class 对象
    }
    // 错误用法：直接重写 loadClass 且不先调 super/父委派 → 破坏双亲委派（见下节"何时该这么做"），
    //   极端情况：自己加载一个 "java.lang.String" → JVM 检测到非 Bootstrap 加载核心类抛 java.lang.SecurityException: Prohibited package name
}
```

**为什么要有双亲委派（两条硬理由）**：

1. **安全**：核心类（`java.lang.*`）只允许 Bootstrap 加载，防止有人放一个恶意的 `java.lang.String` 到 classpath 冒充、被 AppClassLoader 抢先加载而篡改行为。
2. **唯一性 & 复用**：同一类只被"链上最合适的那个加载器"加载一次，避免多个加载器各载一份导致类型混乱、内存浪费。

## 五、破坏双亲委派：三大经典场景

### 5.1 SPI —— 需要"反向委派"

`DriverManager`（在 rt/核心模块，由 Bootstrap 加载）要加载第三方 `com.mysql.cj.jdbc.Driver`（在 classpath，Bootstrap 看不到）。父加载器**无法**加载子加载器才能看到的类 → 双亲委派方向反了。解法：**线程上下文类加载器（TCCL）**——用 `Thread.currentThread().getContextClassLoader()`（默认是 AppClassLoader）去加载 SPI 实现，绕过委派方向。

```java
// 例子目的：SPI 用 Thread Context ClassLoader 让"高层核心类"反向拿到"底层实现类"
ServiceLoader<Driver> drivers = ServiceLoader.load(Driver.class); // 内部用 TCCL 读取 META-INF/services 下的实现（错误用法：直接用 Class.forName 且无 TCCL→Bootstrap 看不到 classpath 的第三方实现，加载失败）
ClassLoader tccl = Thread.currentThread().getContextClassLoader(); // 这是"向下"拿到应用层加载器的口子——正是对双亲委派的"破坏"
```

### 5.2 Tomcat —— 需要"优先自载 + 隔离"

每个 WebApp 一个 `WebappClassLoader`，**先尝试自己加载 `/WEB-INF/classes` 与 `/WEB-INF/lib`，加载不到才交给父级**（与双亲委派相反）。目的：① **隔离**——两个应用可以用不同版本的同名库互不干扰；② **热部署**——重新加载应用只需丢弃旧的 WebappClassLoader、新建一个。代价：一个类由不同 WebApp 的加载器各载一份，可能引发 `instanceof`/强转失败。

### 5.3 OSGi / 模块化

按需的网状（非树状）委派、支持动态安装/卸载 bundle，也是把双亲委派的强层级打开。JDK 9 模块系统则提供了官方隔离替代。

## 六、类的唯一性 = 加载器 + 全限定名

**JVM 判定"两个类是否相同"，看的是「加载它的类加载器 + 类全限定名」都相同。** 由此：

```java
// 例子目的：演示不同加载器加载同名类导致"看起来一样却 instanceof 失败"的陷阱
// 两个互相独立、都不委派的 ClassLoader 各加载 com.acme.Foo：
// obj.getClass() 的 ClassLoader ≠ Foo.class 的 ClassLoader → 即使字节码一模一样，
//   (Foo) obj 抛 ClassCastException；obj instanceof Foo 返回 false。
// 正确使用结果：跨加载器传对象要么统一委派给同一加载器，要么用反射/接口(ClassLoader 可见的公共接口)交互，不直接强转。
```

这正是 Tomcat 多应用、热部署、以及类加载器泄漏（旧加载器被强引用拽着无法卸载 → 元空间涨，呼应 s1-1）的底层机理。

## 七、动手题

1. 自定义一个不委派的 ClassLoader，尝试加载一个自己写的 `java/lang/String.class`，观察 `SecurityException: Prohibited package name: java.lang`，体会双亲委派的安全意义。
2. 用两个独立 ClassLoader 各加载同一份 `Person.class`，做 `(Person) obj`，复现 `ClassCastException`，再用"委派给同一父加载器"修复。
3. 打印 `DriverManager` 加载 MySQL Driver 时用的类加载器，验证它是 TCCL 而非 Bootstrap，理解 SPI 为何要"反向"。

## 八、常见线上问题

| 现象 | 根因 |
| --- | --- |
| `ClassCastException: X cannot be cast to X`（同名） | 两个加载器各载一份，类 identity 不同 |
| `ClassNotFoundException`（SPI 实现） | 未用 TCCL / `META-INF/services` 缺失 |
| `NoClassDefFoundError`（初始化曾失败） | 类 `<clinit>` 早前抛过异常，之后引用直接报错 |
| 热部署后 `LinkageError`/元空间涨 | 旧 ClassLoader 被强引用无法卸载、新加载器堆积 |
| 加了 jar 却不生效 | 同名类被父加载器先加载，App 里那份被忽略（委派方向） |

## 九、关联技术栈

- **向前**：类加载器泄漏 → 元空间 OOM ↔ jvm s1-1、s3-2
- **框架**：Spring 的 `ClassLoader` 抽象、`@Configuration` 代理类由 CGLIB 动态生成（大量类 → 元空间压力）↔ spring-core
- **容器**：Tomcat WebappClassLoader、模块化 ↔ 构建运维分区
- **规范**：SPI 遍布 JDK/JDBC/SLF4J/JAX-RS ↔ jakarta-ee s1-1（ServiceLoader 正是 SPI）

## 十、本节小结

类加载走"**加载—验证—准备—解析—初始化**"，只有**主动引用**才触发 `<clinit>`（子类引用父字段、编译期常量、new 数组都不算）。**双亲委派 = 先交父、父搞不定才自己来**，为的是**核心类安全**与**类唯一性**。但它在三处必须被"破坏"：**SPI 用 TCCL 反向加载实现、Tomcat 优先自载做隔离与热部署、OSGi 动态模块**。贯穿一切的心法：**一个类由「加载器 + 全限定名」共同确定**——同名却不同加载器 = 不同的类，这是 `instanceof` 陷阱、类加载器泄漏、热部署问题的总根源。

下一节进入 GC：垃圾判定与回收算法——可达性分析、卡表、分代与 Region。
