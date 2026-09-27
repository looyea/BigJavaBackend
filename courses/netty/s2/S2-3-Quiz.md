# 编解码器与粘包/拆包治理 · 小测验

### 1. 粘包/拆包的根本原因是（15分）

- A. Netty 解码器有 bug
- B. TCP 是面向字节流、不保证消息边界，一次 write 不等于一次 read
- C. UDP 丢包
- D. 网卡 MTU 太大

> 答案：B
> 解析：TCP 只保证字节按序到达，不保留应用层消息边界；Nagle/MSS 切分会让多条消息拼或一条消息拆。定界是应用层（帧解码器）的责任。

### 2. `LengthFieldBasedFrameDecoder` 中 `lengthAdjustment` 的含义是（15分）

- A. 长度字段前有几点
- B. 长度字段的值与"从长度字段之后到帧尾的字节数"之差，用于补偿长度字段是否含自身/含其它头
- C. 剥掉的帧头字节数
- D. 最大帧长

> 答案：B
> 解析：若长度字段的值少算了尾部字节就 adjustment 为正、多算了（如含了自身长度）就为负（例：值含自身 4 字节 → adjustment=-4）。offset 是②、strip 是⑤、maxFrameLength 是①。

### 3.【多选】关于 `ByteToMessageDecoder` 处理半包，正确的有（20分）

- A. 它会把每次 read 到的字节累积到内部缓冲，下次 read 继续拼接
- B. 数据不够时 decode 直接 return、不往 out 加元素，未读字节被保留，故半包不丢
- C. decode 里可以先 readBytes 消费一部分、发现不够再随意 return，不影响正确性
- D. 一次 read 若攒够多帧，decode 会被循环调用、可一次输出多个完整帧

> 答案：ABD
> 解析：C 错。一旦消费了 readerIndex 又不回滚就破坏累积、丢字节；必须"要么整帧消费、要么零消费 return"（可 mark/reset readerIndex）。A/B/D 正确描述累积与循环解码。

### 4. 接收不可信外部输入时，最应避免的序列化方式是（10分）

- A. Protobuf
- B. JSON
- C. Java 原生序列化（ObjectInputStream）
- D. 自定义二进制

> 答案：C
> 解析：Java 原生反序列化存在 Gadget 链 RCE 风险，对不可信来源须禁用或开白名单/ObjectInputValidation。Protobuf/JSON/自定义更安全且跨语言。

### 5. 处理 HTTP 报文时，把分块的 HttpRequest 攒成完整 FullHttpRequest 的处理器是（10分）

- A. `HttpServerCodec`
- B. `HttpObjectAggregator`
- C. `LengthFieldBasedFrameDecoder`
- D. `DelimiterBasedFrameDecoder`

> 答案：B
> 解析：HTTP 请求以多对象（头 + 若干 HttpContent + Last）入站，Aggregator 聚合成 FullHttpRequest 再交给业务；其 maxContentLength 必须按业务设防大包攻击。HttpServerCodec 只负责编解码不聚合。

### 6. 简答：协议为 `[魔数 0xABCD(2B)][总长(2B，含前面所有头与体)][body...]`，写出 LengthFieldBasedFrameDecoder 的五个参数并逐个说明推导。（30分）

> 参考答案：
> - `maxFrameLength`：按协议上限设（如 64KB），防异常总长撑爆内存。
> - `lengthFieldOffset = 2`：长度字段前有 2 字节魔数。
> - `lengthFieldLength = 2`：总长字段占 2 字节。
> - `lengthAdjustment = -4`：因为"总长"字段的值 L **已含**魔数(2)+长度字段(2)+body = 整帧长度。解码器按 `frameLength = (offset+lenFieldLength) + (L + adjustment) = 4 + L + adjustment` 计算，要它等于 L，故 adjustment = **-4**（即扣掉已被 L 算进去的 4 字节头，呼应讲义例 2"含自身则 adjustment = -lengthFieldLength"）。
> - `initialBytesToStrip = 0`：若希望下游仍看到完整帧（含魔数与长度头）就不剥；若只要 body 则设 4（2+2）。答出两种取舍并说明理由即可得分。
> - 加分：强调"总长含不含自身/含不含头"决定 adjustment 与 strip，务必用半包/粘包序列回归验证不错位。
