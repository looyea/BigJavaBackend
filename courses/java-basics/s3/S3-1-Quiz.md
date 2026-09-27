# 小测验 · 文件 IO、字符流与序列化

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. 把字节流按字符集解码成字符流的"桥梁"类是？（15分）

- A. `BufferedInputStream`
- B. `InputStreamReader`
- C. `DataInputStream`
- D. `FileReader`

> 答案：B
> 解析：`InputStreamReader`（及对称的 `OutputStreamWriter`）是字节流↔字符流的桥，charset 就是在这一步指定的。

### 2. 关于 `serialVersionUID`，下列说法正确的是？（15分）

- A. 不写就完全不能序列化
- B. 不写时编译器按类结构自动生成，改字段会导致旧数据反序列化抛 `InvalidClassException`，故应显式声明
- C. 它是实例字段
- D. 写了就没有任何作用

> 答案：B
> 解析：应显式写 `private static final long serialVersionUID`，保证类结构演进时旧字节流仍能兼容反序列化。

### 3. 【多选】下列哪些是 JDK 原生序列化被生产环境嫌弃的原因？（20分）

- A. 反序列化不可信数据可能触发 gadget chain 远程代码执行
- B. 体积大、编解码慢、反射重、GC 压力大
- C. 与类字段/UID 强耦合，跨语言跨版本脆弱
- D. 完全无法序列化含集合的对象

> 答案：ABC
> 解析：D 错（它支持对象图含集合）。生产传输改用 JSON/Protobuf/Hessian/Kryo。

### 4. 判断：`transient` 修饰的字段在序列化时会被跳过，反序列化后取默认值（如 null）。（10分）

- A. 正确
- B. 错误

> 答案：A
> 解析：`transient`（及 static 字段）不参与序列化，用于密码、token、可派生数据。

### 5. 填空题：IO 流大量使用 ______ 设计模式（如 `new BufferedReader(new InputStreamReader(...))` 层层包裹增强）；反序列化重建对象时 ______（走/不走）构造器。

> 答案：装饰器（Decorator） / 不走
> 解析：装饰器运行时组合功能；反序列化由 native 机制直接重建，绕过构造器与 final 初始化。

### 6. 简答题：说清字节流与字符流的区别与各自适用场景，并解释"为什么生产 RPC/网络传输几乎都不用 JDK 原生序列化"。（25分）

> 参考答案：
> - 字节流按 8 位读写、通用，处理任何二进制（图片/视频/socket 原始字节）；字符流=字节流+字符集解码，专处理文本，避免手动处理编码。文本用字符流并显式 UTF-8，二进制用字节流
> - 不用原生序列化原因：① 安全（不可信输入反序列化 → RCE 漏洞）；② 性能（体积大、慢、反射重）；③ 强耦合类结构与 serialVersionUID，跨语言跨版本脆弱
> - 替代：JSON（Jackson）/Protobuf/Hessian/Kryo，跨语言、有 schema、更快更安全
