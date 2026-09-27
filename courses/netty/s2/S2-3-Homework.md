# 编解码器与粘包/拆包治理 · 课后作业

> 两题各 50 分：一题用 LengthFieldBasedFrameDecoder 实现私有协议并做半包/粘包回归，一题对比序列化方案并处理反序列化安全。

## 作业 1：实现并压测一个"长度字段"私有协议（50 分）

**协议**：`[cmd(1B)][seq(4B)][bodyLen(4B，仅描述 body)][body(bodyLen 字节)][crc(2B)]`，要求下游拿到"去掉 cmd+seq+bodyLen 头、保留 body+crc"的帧。

**要求**：
1. 推导并写出 `LengthFieldBasedFrameDecoder` 五个参数（offset / lengthFieldLength / adjustment / strip / maxFrameLength），并说明每个值的理由。
2. 在其后接一个自写 `ByteToMessageDecoder`，从帧尾 2 字节做 CRC 校验，失败则 `fireExceptionCaught`。
3. **回归测试**：写客户端把一条消息**故意拆成 3 段、间隔 50 ms 发**（模拟半包），把两条消息**一次性连发**（模拟粘包），验证服务端始终解出正确完整的帧、不多不错。
4. 用一个畸形 `bodyLen=0x7FFFFFFF` 的包验证 `maxFrameLength` 生效（抛 `TooLongFrameException` 而非 OOM）。

**验收标准**：
- 参数推导正确：offset=5(1+4)、lengthFieldLength=4、adjustment=2（长度值只算 body，但后面还有 2 字节 crc 没算进去 → +2）、strip=9(1+4+4，剥掉 cmd+seq+bodyLen)、maxFrameLength=按业务上限。
- 半包/粘包回归全部通过；畸形长度被 maxFrameLength 拦下。

**参考答案要点**：
- adjustment 处理"长度字段没覆盖到的尾部字节（crc）"；strip 处理"不想给下游的头部"。
- 用 `markReaderIndex/resetReaderIndex` 保证 CRC 校验失败/数据不足时不破坏累积。

## 作业 2：序列化选型与反序列化安全（50 分）

**要求**：
1. 同一业务对象，分别用 Java 原生序列化、JSON(Jackson)、Protobuf 编码，测**字节数、编解码耗时**（10 万次）三项并列表。
2. 用 Netty `ObjectDecoder` 收一个"恶意构造的序列化流"（可用经典 ysoserial 思路的无害 PoC，如触发一段打印的 gadget），复现**反序列化 RCE 风险**；再演示开启类白名单（`ObjectDecoder` 配 `ClassLoader`/`ObjectInputFactory` 限制）后拦截。
3. 给 Protobuf 方案加 `ProtobufVarint32FrameDecoder + ProtobufDecoder`，说明它为什么自带定界、不需要 LengthFieldBasedFrameDecoder。
4. 结论：对"外部不可信输入"你会选哪种，为什么。

**验收标准**：
- 数据对比体现 Protobuf 体积/CPU 优势、Java 序列化体积最大且跨语言差。
- 复现并正确解释 Java 原生反序列化漏洞成因，给出白名单/替换方案。
- 说清 `ProtobufVarint32FrameDecoder` 用 varint 长度前缀完成定界。

**参考答案要点**：
- 生产二进制协议默认 Protobuf/FlatBuffers；对外 HTTP API 用 JSON；几乎不在不可信链路用 Java 原生序列化（金融/电商合规红线）。
- 定界（frame decoder）与反序列化（serialization codec）是两层，职责分开。
