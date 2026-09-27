# 作业题 · 文件 IO、字符流与序列化

> 不判分，对照参考要点自查。

## 作业 1：缓冲的收益（必做）

用①`FileInputStream` 一次 `read()` 一字节、②`BufferedInputStream`、③`FileChannel`+`ByteBuffer` 三种方式读同一 50MB 文件并计时。写出缓冲/通道为什么快（系统调用次数）。

## 作业 2：字符流与编码（必做）

写一个 UTF-8 文本文件（含中文与 emoji），分别用"显式 `StandardCharsets.UTF_8` 的 `Files.newBufferedReader`"和"`new InputStreamReader(in)`（不给 charset，走平台默认）"在模拟非 UTF-8 默认环境下读取，对比是否乱码。结论呼应 s2-4。

## 作业 3：serialVersionUID 复现（必做，本节核心）

1. 一个未显式声明 serialVersionUID 的 `Person` 序列化到文件
2. 给类新增一个字段后反序列化，复现 `InvalidClassException`
3. 补上 `private static final long serialVersionUID = 1L` 重做，观察兼容性
4. 再加一个 `transient` 字段，验证它不被写出（反序列化后为默认值）

## 作业 4：自定义序列化（选做）

给含"明文密码"字段的类实现 `writeObject/readObject`（或把密码字段标 `transient`），确保密码不落盘；再实现 `readResolve` 保证单例经序列化后仍只有一个实例（防止反序列化破坏单例，呼应设计模式分区）。

## 作业 5：深拷贝与替代方案对比（选做）

用"序列化再反序列化"实现一个对象图的深拷贝，再分别测：JDK 原生序列化、Jackson JSON、（若可引入）Kryo/Protobuf 的**体积与耗时**。产出一张对比表 + 一段"生产 RPC 为什么选 Protobuf/Hessian2 而非 JDK 序列化"的结论（含安全维度）。
