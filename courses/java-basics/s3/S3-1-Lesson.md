# 文件 IO、字符流与序列化

> 本节难度：★★☆☆☆
> 本节重要性：★★★☆☆
> 学习产出：理清 Java IO 的**字节流/字符流两条体系**与贯穿其中的**装饰器模式**，会用缓冲流与 try-with-resources 正确读写；看懂 `InputStreamReader` 这架"字节↔字符"的桥（呼应 s2-4 编码）；并认清 **JDK 原生序列化的坑**（serialVersionUID、transient、绕过构造器、反序列化漏洞、性能差）及其现代替代方案。

## 一、两条体系 + 一个装饰器骨架（★★★☆☆）

Java IO 按**数据单位**分两条平行体系，按**装饰器模式**叠加功能：

```flow
抽象基类            节点流(接数据源)          处理流/装饰器(加功能)
字节: InputStream   FileInputStream/ByteArrayInputStream   BufferedInputStream / DataInputStream / ObjectInputStream
字节: OutputStream  FileOutputStream/...                    BufferedOutputStream / DataOutputStream / ObjectOutputStream
字符: Reader        FileReader/StringReader                 BufferedReader / InputStreamReader(桥)
字符: Writer        FileWriter/StringWriter                 BufferedWriter / OutputStreamWriter(桥)
```

- **字节流**读的是原始 8 位，通用（图片/视频/网络都走字节）；**字符流** = 字节流 + **字符集解码**的便捷封装，专处理文本。
- **`InputStreamReader`/`OutputStreamWriter` 是桥梁**：把字节流按指定 charset 转成字符流——乱码常发生在这一步的 charset 没给对（见 s2-4）。
- **装饰器模式**：`FilterInputStream`/`BufferedReader(Reader)` 等包住别的流来"增强"，运行时层层包裹组合（`new BufferedReader(new InputStreamReader(new FileInputStream(f), UTF_8))`），而非为每种组合造一个类。

## 二、读写正确姿势（★★★☆☆）

```java
// 例子目的：逐行读文本——缓冲 + 显式 UTF-8 + try-with-resources 自动关（勿手写 finally close，见 s2-2）
try (var br = Files.newBufferedReader(Path.of("a.txt"), StandardCharsets.UTF_8)) {
    br.lines().forEach(System.out::println);   // 流式逐行消费，不把全文件载入内存
}                                                // 出作用域自动 close，即使抛异常也保证释放
// 正确用法结果：a.txt 内容为两行 "hi"/"yo" 时，控制台依次输出 hi、yo，且文件句柄已释放
// 错误用法：不指定 charset 而用系统默认编码→跨平台（Windows GBK / Linux UTF-8）会读出乱码，不报错但内容错
// 错误用法：对不存在的文件 Path.of("no.txt") → newBufferedReader 抛 NoSuchFileException（属 IOException 族，必须处理）
```

要点：① 套 `Buffered*` 缓冲流**大幅减少系统调用**；② 输出务必 `flush`/`close`（否则缓冲区数据丢）；③ 大文件别 `readAllBytes` 一把梭进内存，流式处理；④ 简单场景直接用 NIO 的 `Files.readAllLines`/`Files.copy` 更省心。**高并发/网络 IO 的性能玩法（Channel/Buffer/多路复用）属于 NIO/Netty 专题**，本节只需知道"阻塞流"与"非阻塞通道"的分界。

## 三、序列化 Serializable：能力与陷阱（★★★★☆）

`Serializable` 是**标记接口**，让对象能被 `ObjectOutputStream` 转成字节流（持久化 / RMI / 深拷贝）。它有一堆必须知道的规则：

```java
// 例子目的：定义一个安全可序列化的订单类，逐字段展示 serialVersionUID 与 transient 的作用
class Order implements Serializable {
    private static final long serialVersionUID = 1L;  // ① 显式声明：版本错配时给确定的 serialVersionUID
    private transient String idCard;                  // ② 敏感/可重算字段不序列化
    private String orderNo;                            // 此字段会随对象一起写入字节流
}
// 正确用法结果：一个 order(idCard="310...", orderNo="NO-1") 序列化后反序列化，orderNo 仍为 "NO-1"，idCard 变 null（transient 不参与）
// 错误用法 1：不写 serialVersionUID → 编译器自动生成，类结构一改 UID 就变 → 反序列化旧数据抛 InvalidClassException
// 错误用法 2：把密码/银行卡等敏感字段漏标 transient → 明文进磁盘/日志，造成数据泄漏事故
```

1. **`serialVersionUID` 要显式写**：不写则编译器按类结构自动生成，一旦加/删字段 UID 变化，旧数据反序列化直接抛 `InvalidClassException`。
2. **`transient`** 跳过字段（密码、token、可派生数据），既省空间又避免泄露。
3. **反序列化不走构造器**：对象由 native 机制直接重建，`final` 字段的构造期赋值、构造器里的校验都不执行（呼应 s1-1 构造器陷阱、s1-4 不可变安全发布）——所以敏感校验不能只放构造器。
4. 可重写 `writeObject/readObject`（或 `writeReplace/readResolve`）自定义过程；`Externalizable` 则完全自己控制读写。

## 四、为什么生产上少用 JDK 原生序列化（★★★★☆）

| 问题 | 说明 |
| --- | --- |
| **安全** | 反序列化不受信任字节流可触发 **gadget chain 远程代码执行**（历史级漏洞重灾区），绝不可反序列化外部输入 |
| **性能** | 体积大、编解码慢、反射重、产生大量临时对象给 GC 加压 |
| **耦合** | 与具体类的字段/UID 强绑定，跨版本、跨语言极脆弱 |
| **替代** | 网络/存储用 **JSON（Jackson）/ Protobuf / Hessian / Kryo**——跨语言、可控、有 schema、更安全 |

> **框架回响**：Dubbo 的默认序列化是 Hessian2/可切 Protobuf，Spring HTTP 用 Jackson，Redis/MQ 存的多是 JSON/二进制——**几乎没有生产 RPC 走 JDK 原生序列化**（详见分布式/RPC/安全分区）。JDK 序列化今天主要用于本地临时对象缓存/深拷贝 hack，且要评估安全。

## 五、动手题

1. 分别用"未加缓冲的 `FileInputStream` 单字节读"和"`BufferedInputStream`"读一个几十 MB 文件计时，体会缓冲的差距。
2. 把一个 `Order` 序列化到文件，给类加一个字段后（不写 serialVersionUID）再反序列化，复现 `InvalidClassException`；补上显式 UID 观察行为差异。
3. 给含密码字段的类加 `transient`，序列化再反序列化，验证密码字段变 null 未被写出。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 改了个字段旧数据全反序列化失败 | 未显式声明 serialVersionUID |
| 敏感信息被写进缓存/日志 | 该 `transient` 的字段没标 / 序列化了整个对象 |
| 某接口被上传的恶意字节流 RCE | 反序列化了不可信来源数据（gadget chain） |
| 大文件 OOM | 用 `readAllBytes` 一次性读进内存，未流式处理 |
| 文本读出来乱码 | InputStreamReader 未指定 UTF-8（见 s2-4） |

## 七、关联技术栈

- **向前**：字符流桥接 charset ↔ s2-4；try-with-resources 关流 ↔ s2-2；反序列化绕过构造器 ↔ s1-1/s1-4
- **向后**：NIO/Channel/多路复用 ↔ 计算机网络"Netty 与 NIO"分区
- **RPC/中间件**：序列化选型（Protobuf/Hessian/Kryo）↔ 分布式 RPC、MQ 分区
- **安全**：反序列化漏洞防护 ↔ 安全分区（web-defense/data-security）

## 八、本节小结

IO 用"**两条体系（字节/字符）× 装饰器叠加 × 缓冲 + 正确关闭**"三句话记；序列化要记 serialVersionUID/transient/绕过构造器三条规则，并牢记**JDK 原生序列化在安全与性能上都不适合当生产传输格式**，改用 JSON/Protobuf。

下一节讲反射、注解与动态代理——所有"框架魔法"的真正根基。
