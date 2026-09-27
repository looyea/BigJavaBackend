# 实际面试题 · 文件 IO、字符流与序列化

## 题 1：字节流和字符流有什么区别？什么时候用哪个？

**答题要点**：字节流（`InputStream/OutputStream`）按 8 位读写原始字节，**通用**，任何数据（图片、视频、网络、对象）都能处理；字符流（`Reader/Writer`）= 字节流 + **字符集编解码**的封装，只处理文本，省去手动处理编码。处理文本用字符流并**显式指定 UTF-8**，处理二进制用字节流。两者通过 `InputStreamReader`/`OutputStreamWriter` 这座桥互转。

**追问链**：为什么字符流能防乱码？→ 它把"字节→字符"的解码 charset 显式化，而手动 `new String(bytes)` 容易走平台默认编码。

## 题 2：Java IO 里用了哪些设计模式？

**答题要点**：① **装饰器模式**是主线——`FilterInputStream`/`BufferedReader` 等包住别的流叠加功能（缓冲、按类型读写、对象序列化），运行时组合，避免为每种组合造类；② **适配器**——`InputStreamReader` 把字节流"适配"成字符流；③ **外观**——`Files`/`PrintStream` 简化操作。典型链：`new BufferedReader(new InputStreamReader(new FileInputStream(f), UTF_8))`。

## 题 3：serialVersionUID 是干嘛的？不写会怎样？

**答题要点**：它是序列化版本的标识，反序列化时校验类版本一致。**不显式写**的话编译器按类结构（字段、方法签名等）自动算一个，你只要**加/删字段或改结构**，生成的 UID 就变，导致拿旧字节流反序列化抛 `InvalidClassException`。所以要 `private static final long serialVersionUID = 1L` 固定住，配合字段演进保持兼容。

## 题 4：transient 和自定义序列化（writeObject/readObject）怎么用？

**答题要点**：`transient` 字段不参与序列化（密码、token、可派生字段、单例里的锁），反序列化后为默认值。要更细控制就实现 `private void writeObject(ObjectOutputStream)`/`readObject(ObjectInputStream)`（先 `defaultWriteObject` 再处理特殊字段，可对密码加密后写出）。单例类必须实现 **`readResolve`** 返回 INSTANCE，否则反序列化会**造出第二个实例破坏单例**。

## 题 5：为什么说反序列化是安全大坑？生产怎么选型？

**结构化回答**：

1. **漏洞原理**：`ObjectInputStream.readObject` 会按字节流里的类名**自动实例化对象并调用其方法链**，攻击者构造特定字节流，借助 classpath 上某些类的 getter/setter/finalize 组成 **gadget chain（如 CommonsCollections）** 执行任意代码（RCE）。
2. **原则**：**永远不要反序列化不可信来源的字节流**；必要时用白名单 `ObjectInputFilter`（JEP 290）。
3. **选型**：网络/RPC/存储用 **JSON（Jackson）、Protobuf、Hessian2、Kryo**——跨语言、有 schema、体积小、快、无此攻击面。Dubbo 默认 Hessian2 可切 Protobuf，HTTP 用 Jackson，Redis/MQ 存 JSON/二进制。

## 高频追问速答

1. 反序列化会走构造器吗？→ 不会，native 直接重建对象，构造器的校验/final 赋值被跳过。
2. 深拷贝怎么做最省事？→ 序列化再反序列化，但前提是实现了 Serializable 且有性能/安全代价，优先手动 clone/拷贝构造/JSON 往返。
3. `readAllBytes` 有什么风险？→ 大文件一次性进内存易 OOM，应流式（BufferedReader.lines / Channel）。
4. BufferedOutputStream 什么时候真正写盘？→ 缓冲区满或 flush/close 时；程序异常退出未 flush 会丢数据。
5. File 和 FileReader 的编码问题？→ `FileReader` 用平台默认字符集不可靠，建议 `new InputStreamReader(new FileInputStream(f), UTF_8)` 或 `Files.newBufferedReader(path, UTF_8)`。
