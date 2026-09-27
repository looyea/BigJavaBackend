# 小测验 · 类加载机制与双亲委派

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分折算百分制，≥ 60 分过关。

### 1. 下列哪种操作**不会**触发对应类的初始化 `<clinit>`？（15分）

- A. `new Parent()` 创建实例
- B. 调用类的静态方法
- C. 通过子类引用父类的静态字段 `Child.a`
- D. 反射 `Class.forName("X")`（默认 initialize=true）

> 答案：C
> 解析：通过子类引用父类静态字段只初始化**父类**、不触发子类初始化。同理引用编译期 `static final` 常量、`new Parent[10]` 建数组也不初始化。A/B/D 都是主动引用会触发初始化。

### 2. 关于双亲委派模型的工作方式，正确的是？（15分）

- A. 加载器先自己加载，加载不到再交给父加载器
- B. 收到请求先委派父加载器，父层在其搜索范围找不到才回退自己加载
- C. 所有类都由 AppClassLoader 加载
- D. 子加载器与父加载器并行加载、谁快用谁

> 答案：B
> 解析：双亲委派 = 先向上委派，父层无法完成才自己 `findClass`。它保证核心类由 Bootstrap 独占（安全）和类的唯一性。

### 3. 【多选】以下哪些是"破坏双亲委派"的正当场景？（20分）

- A. SPI（JDBC Driver 等）用线程上下文类加载器反向加载实现
- B. Tomcat WebAppClassLoader 优先自载 `/WEB-INF` 做应用隔离与热部署
- C. OSGi 支持动态安装/卸载 bundle 的网状委派
- D. 让 Bootstrap 加载器去加载 classpath 上的第三方业务类

> 答案：ABC
> 解析：SPI、Tomcat、OSGi 都是有明确动机的破坏。D 不成立——Bootstrap 只加载核心类，其搜索范围不含 classpath，让它载第三方类既做不到也违背隔离设计。

### 4. 判断：JVM 认定"两个类是否为同一个类"，只比较类的全限定名。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：类 identity = **类加载器 + 全限定名** 都相同才算同一个。两个独立加载器各加载同名字节码会得到"不同的类"，导致同名 `ClassCastException` / `instanceof` 为 false。

### 5. 填空题：写自定义加载器时，为保住双亲委派应只重写 ______ 方法而非 `loadClass`；SPI 靠 ______（TCCL）反向加载实现类。（10分）

> 答案：findClass / 线程上下文类加载器

### 6. 简述双亲委派存在的两大理由，并说明为什么 SPI 加载必须"破坏"它。（30分）

> 参考答案：
> - 理由一 安全：核心类只允许 Bootstrap 加载，防止 classpath 放恶意 java.lang.String 冒充被 App 抢先加载
> - 理由二 唯一性/复用：同一类由链上最合适加载器只载一次，避免各载一份类型混乱
> - SPI 矛盾：DriverManager(Bootstrap) 要加载 classpath 上第三方 Driver，父看不到子的类，委派方向反了
> - 解法：用 Thread Context ClassLoader(默认 AppClassLoader) 向下取应用层加载器加载实现
> - 本质：这是"高层定义接口、低层提供实现"倒置依赖在类加载层的体现
