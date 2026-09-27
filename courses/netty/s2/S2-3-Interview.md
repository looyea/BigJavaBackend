# 编解码器与粘包/拆包治理 · 面试题

> "Netty 怎么处理粘包拆包"是 Netty 面试几乎必问的第二题（第一是 Pipeline）。答好要能：说清成因、报出 LengthFieldBasedFrameDecoder 五参含义与推导、解释半包为何不丢（累积机制）、并主动提反序列化安全。

## 考点 1：成因与定界策略

**起手**：什么是粘包/拆包，Netty 怎么解决？

**期望**：
- 成因：TCP 是字节流、不保留消息边界（networks/s2-4）；Nagle 拼接、MSS/窗口切分。
- 定界四法 → Netty 解码器：固定长 `FixedLengthFrameDecoder`、分隔符 `DelimiterBased/LineBasedFrameDecoder`、**长度字段 `LengthFieldBasedFrameDecoder`（主流）**、自写状态机 `ByteToMessageDecoder`。

## 考点 2：LengthFieldBasedFrameDecoder 五参（现场推导题）

**起手**：`[len(4B 只算 body)][body]` 这个协议，五个参数怎么填？

**期望**：
- `maxFrameLength`（防 OOM，必设）、`lengthFieldOffset=0`、`lengthFieldLength=4`、`lengthAdjustment=0`、`initialBytesToStrip=4`（剥掉长度头，下游只拿 body）。
- 讲清 adjustment/strip 口诀：
  - **adjustment**：长度字段的值与"长度字段之后到帧尾字节数"之差 —— 值**含自身**则 `adjustment = -lengthFieldLength`；值**没算上尾部附加字段**（如 crc）则为正补上。
  - **strip**：想让下游跳过的帧头字节数（常 = offset + lengthFieldLength）。

**追问链**：
1. `[magic(2)][len(2 只算body)][body]`？→ offset=2、lenLen=2、adjustment=0、strip=4。
2. len 值把 magic+len 也含进去（总长含头）？→ adjustment = -(offset+lenLen) = -4。
3. maxFrameLength 不设会怎样？→ 畸形超大 len → 解码器无限攒内存 → OOM，是攻击面。

## 考点 3：半包为什么不丢（累积机制）

**起手**：数据只到半条消息，Netty 解码器怎么处理？

**期望**：
- `ByteToMessageDecoder` 每次 read 到的字节**累积**进内部 `cumulation`（默认 MERGE_CUMULATOR，用 CompositeByteBuf 拼接）。
- `decode` 里数据不够就**直接 return、不动 readerIndex** → 未读字节保留，下次 read 拼上继续；够了就 `out.add(一帧)` 并推进 readerIndex，循环可一次解多帧（治粘包）。
- 陷阱：判断不够必须"零消费 return"；半途消费又不回滚会丢字节 → `markReaderIndex/resetReaderIndex`。

**追问链**：
1. 定界和序列化是一回事吗？→ 不是。frame decoder 产出"一条完整消息的字节"，还要 `ProtobufDecoder`/JSON 再转对象，放其后。

## 考点 4：序列化选型与安全（资深加分）

**起手**：Netty 服务接收外部消息，序列化怎么选？有什么安全坑？

**期望**：
- 选型：**Protobuf**（跨语言、小、schema 演进，RPC 首选，`ProtobufVarint32FrameDecoder` 自带 varint 长度定界）；对外用 JSON；追求极致用 FlatBuffers。
- 安全坑：**Java 原生 `ObjectInputStream` 反序列化可被 Gadget 链打成 RCE**，对不可信来源禁用或类白名单（`ObjectDecoder` + 受限 ClassLoader / `ObjectInputFactory`）。
- HTTP 场景直接用 `HttpServerCodec` + **`HttpObjectAggregator`**（把分块聚合为 FullHttpRequest，maxContentLength 必设），别手撕报文。

## 考点 5：收尾

**期望**：
- 把 networks/s2-4（为什么要定界、定界四法的协议原理）↔ netty/s2-3（Netty 用哪个解码器、五参怎么推、累积怎么防丢）连成一条线；再点一句"畸形长度/CRC 失败要在 exceptionCaught 里关连接（字节流已不可信，呼应 s2-1 异常传播）"即完整。
