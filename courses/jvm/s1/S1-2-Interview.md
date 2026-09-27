# 实际面试题 · 类加载机制与双亲委派

> 收录 2024—2026 国内中大厂 Java 后端真实面试，含追问链。答题要展示"你知道机制的边界"，而不是背名词。

## 题 1：一个类从 `.class` 到能用，经历了哪些阶段？

**期望时长**：90 秒

**答题要点**：

- 加载 → 验证 → 准备 → 解析 → 初始化 → 使用 →（卸载）；中间三步合称"链接"。
- 准备：给静态变量分配内存并置**零值**；`static final` 常量在准备阶段直接赋终值。
- 初始化：执行 `<clinit>`（静态赋值 + 静态块）。

**追问链**：

1. 什么才触发初始化？→ 主动引用：`new`、读写静态字段（非常量）、调静态方法、反射、main 类；被动引用（子类引父字段、编译期常量、建数组）不触发。
2. 解析一定在初始化前吗？→ 不一定，符号引用解析可延后到初始化后（Java 动态绑定需要）。

## 题 2：什么是双亲委派？为什么要它？

**答题要点**：

- 加载器收到请求先委派父加载器，父在其搜索范围找不到才回退自己 `findClass`。
- 两大理由：**安全**（核心类只由 Bootstrap 载，防冒充）+ **唯一性/复用**（同类只载一次，防类型混乱）。

**追问链**：

1. 写自定义加载器该重写哪个方法？→ `findClass`（保住 `loadClass` 的委派逻辑）；直接重写 `loadClass` 不委派 = 破坏模型。
2. 破坏它加载 `java.lang.String` 会怎样？→ `SecurityException: Prohibited package name: java.lang`。

## 题 3：哪些场景"必须"破坏双亲委派？怎么破的？

**答题要点**：

- **SPI**：`DriverManager`(Bootstrap) 要载 classpath 上的第三方 Driver，父看不到子 → 用**线程上下文类加载器 TCCL** 反向加载。
- **Tomcat**：`WebappClassLoader` **优先自载** `/WEB-INF`，加载不到才交父，为**应用隔离 + 热部署**。
- **OSGi**：网状委派、动态装卸 bundle。

**追问链**：SPI 为什么是"倒置"？→ 高层（JDK）定义接口、低层（实现 jar）提供实现，接口在 Bootstrap、实现在 App，委派方向天然反，只能借 TCCL 把"向下取加载器"的口子打开。

## 题 4：`ClassCastException: A cannot be cast to A`（两个 A 同名）怎么回事？

**答题要点**：

- 类 identity = 类加载器 + 全限定名；两个独立加载器各载一份同名类 = 不同的类。
- 常见于 Tomcat 多应用、热部署、自写不委派加载器。
- 修复：委派给同一加载器，或用两加载器都可见的公共接口交互。

**追问链**：热部署后为什么可能元空间涨？→ 旧 WebappClassLoader 被强引用（线程/静态 Map/缓存）拽住无法卸载，其加载的类元数据留在元空间，反复部署堆积（呼应 s1-1、s3-2）。

## 题 5：`ClassNotFoundException` 和 `NoClassDefFoundError` 区别？

**答题要点**：

- `ClassNotFoundException`：编译/加载期主动查找（`Class.forName`/`loadClass`）找不到，受检异常。
- `NoClassDefFoundError`：编译时有、运行期定义缺失或**该类 `<clinit>` 早前已抛过异常**，之后引用直接 Error。

**追问链**：为什么同一个类第二次报错变成 `NoClassDefFoundError`？→ 首次初始化失败后 JVM 把该类标记为 erroneous，后续再引用不再重试、直接抛 `NoClassDefFoundError`，根因要在**第一次**的异常栈里找。
