# 编解码器与粘包/拆包治理

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：LengthFieldBasedFrameDecoder 五个参数的推导、Delimiter/LineBased/FixedLength 选型、序列化（Protobuf/JSON）与 ObjectInputValidation、`ByteToMessageDecoder` 累积与半包丢弃、HTTP 编解码器复用。

> networks/s2-4 我们从**协议视角**讲过"TCP 是字节流、没有消息边界 → 应用层必须定界"。本节从**Netty 实现视角**落地：用哪些解码器把乱切的字节流重新切成一条条完整消息，`LengthFieldBasedFrameDecoder` 那五个参数到底怎么推、半包为什么不能丢、序列化器（Protobuf/JSON/Java）怎么接上、以及 HTTP 编解码器怎么复用。（重要度 4/5，重点标准）

## 一、问题回顾：粘包/拆包从哪来（30 秒）

TCP 只保证"字节按序到达"，不保证"你 write 一次 = 对端 read 一次"。发送端 Nagle 可能把两条消息拼一起（**粘包**），MSS/窗口切分可能把一条消息拆成两次到（**拆包/半包**）。所以接收端面对的是"一串字节，不知道一条消息到哪结束"。

**四种到达形态**（务必能在脑中画出来）：
```
理想：      [消息1][消息2]
粘包：      [消息1消息2]         一次读到两条
拆包(半包)： [消息1        |  消息2]  一条被分成两次到
混合：      [消息1  ][消息2 |
```
**定界四法**（networks/s2-4 已讲，这里对应到 Netty 解码器）：

| 定界策略 | Netty 解码器 | 适用 |
|---|---|---|
| 固定长度 | `FixedLengthFrameDecoder` | 每条消息等长（少见，简单协议） |
| 分隔符 | `DelimiterBasedFrameDecoder` / `LineBasedFrameDecoder` | 文本行（`\n`）、特殊分隔符（Redis 行协议、自定义 `#`） |
| 消息头带长度字段 | **`LengthFieldBasedFrameDecoder`** ★ | **二进制协议主流**，本节点主角 |
| 读到位图/状态机 | 自写 `ByteToMessageDecoder` | 极端定制 |

## 二、`LengthFieldBasedFrameDecoder`：五个参数的推导

构造器：
```java
new LengthFieldBasedFrameDecoder(
    int maxFrameLength,      // ① 单帧最大长度，超过抛 TooLongFrameException（防内存打爆）
    int lengthFieldOffset,   // ② 长度字段前面有多少字节
    int lengthFieldLength,   // ③ 长度字段本身占几字节（1/2/4/8）
    int lengthAdjustment,    // ④ 读到的长度值 还要 加多少 才等于"整帧剩余字节"
    int initialBytesToStrip) // ⑤ 解出整帧后，从头跳过几字节再往下传（通常剥掉帧头）
```
**核心心智**：`frameLength = 头部到长度字段的字节 + lengthFieldLength + (长度字段的值 + lengthAdjustment)`；解码器攒够 `frameLength` 才往下发一个完整帧，并按 `initialBytesToStrip` 剥头。

### 例 1：`[len(4B 不含自己)][body]`（最常见）
```
 0        4                      4+len
 ┌────────┬──────────────────────┐
 │ len=8  │       body(8B)       │   len 只描述 body
 └────────┴──────────────────────┘
new LengthFieldBasedFrameDecoder(1024*1024, 0, 4, 0, 4)
```
- offset=0（len 在最前）、lenFieldLength=4、**adjustment=0**（len 值已等于 body 长）、**strip=4**（把 4 字节长度头剥掉，下游只拿 body）。

### 例 2：`[len(4B 含len自身)][body]`（长度值把长度字段也算进去）
```
len 值 = 4 + bodyLen  → adjustment = -lengthFieldLength = -4
new LengthFieldBasedFrameDecoder(max, 0, 4, -4, 4)
```
### 例 3：`[magic(2B)][len(2B 只算body)][body]`
```
offset=2（跳过 magic）、lenFieldLength=2、adjustment=0、strip=4（magic+len 都不要）
new LengthFieldBasedFrameDecoder(max, 2, 2, 0, 4)
```
### 例 4：`[cmd(1B)][len(4B 从cmd之后算所有剩余)][body]`
```
若 len 值 = 除 (cmd+len) 外的剩余 = body → offset=1, lenLen=4, adjustment=0, strip=5(1+4)
若 len 值还包含别的小头 → 用 adjustment 补差
```

**推导口诀**：
- `lengthFieldOffset` = 长度字段前有几点。
- `lengthFieldLength` = 长度字段几点。
- `lengthAdjustment` = **长度字段的值** 与 **"从长度字段之后到帧尾的字节数"** 之差；简单说"值少算了多少就 + 多少，多算了就 − 多少"。
- `initialBytesToStrip` = 想让下游**跳过**的帧头字节数（常见 = offset+lenFieldLength，把整个头剥掉）。
- `maxFrameLength` **一定设**，否则恶意/异常的大 len 会让解码器无限攒内存 → OOM（安全红线，呼应 networks/s4-2 的防御式编程）。

## 三、`ByteToMessageDecoder`：累积、半包不丢、以及 `MERGE/CUMULATE` 机制

`LengthFieldBasedFrameDecoder` 继承自 `ByteToMessageDecoder`，理解它的**累积机制**才懂"半包为什么不会丢"：

- 每次 `channelRead` 到的新 ByteBuf，Netty 不会直接给你，而是先**累积**到一个内部缓冲（`ByteBufExtractor`/`cumulation`，`Cumulator` 默认 `MERGE_CUMULATOR` = CompositeByteBuf 拼接，s2-2）。
- 然后循环调你的 `decode(ctx, in, out)`：
  - **数据不够（半包）** → 你 `return`（不往 `out` 加东西）→ 解码器**保留未读字节**，等下次 read 再拼上继续 → **半包不丢**。
  - **够了** → 你把**一个完整帧** `out.add(frame)`，并推进 `in.readerIndex` → 循环再解下一帧（一次 read 可能解出多帧，解决粘包）。
- **关键陷阱**：`decode` 里判断"不够"必须**在动 readerIndex 之前** `return`；若你半路 `readBytes` 消费了又发现不够且不回滚 → 破坏累积、丢字节。要"要么整帧消费、要么一点不消费地 return"（可 `markReaderIndex()/resetReaderIndex()`）。
- 自写解码器一般 extends `ByteToMessageDecoder`（面向字节流定界）或 `MessageToMessageDecoder`（已解出的对象再转换）。

## 四、接上序列化：把 body 变成对象

帧定界只保证"给你一条完整消息的字节"，**字节→对象**还要一层解码器（都放在 frame decoder **之后**）：

| 方案 | Netty 支持 | 工程评价 |
|---|---|---|
| **Protobuf** | `ProtobufVarint32FrameDecoder`（自带长度）+ `ProtobufDecoder` | 跨语言、体积小、schema 演进好；RPC（Dubbo/gRPC）首选 |
| **JSON** | 自定义（Jackson）或 `JsonObjectDecoder` | 可读、调试友好；体积/CPU 大，适合外部 API |
| **Java 原生序列化** | `ObjectDecoder` / `ObjectEncoder` | **不推荐**（见下） |
| 自定义 POJO | 手写 `ByteToMessageCodec` | 极致性能/私有协议 |

**Java 原生序列化的坑（安全必讲）**：
- `ObjectInputStream.readObject` 可被**反序列化 Gadget 攻击**（构造恶意字节流触发任意代码执行）→ 用 `ObjectDecoder` 时开 `ObjectInputValidation`/`ioObjectDecoders` 白名单，或干脆**别对不可信来源用 Java 序列化**。
- 跨语言差、字段变更兼容性差、体积大。生产二进制协议几乎都用 Protobuf/FlatBuffers/Cap'n Proto。

## 五、HTTP 编解码器：直接复用，别自己造

Netty 内置了 HTTP 全栈编解码器，写 HTTP 服务/网关**不需要自己解析报文**（呼应 networks/s3-1）：

```java
pipeline.addLast(new HttpRequestDecoder());      // 或直接用 HttpServerCodec
pipeline.addLast(new HttpResponseEncoder());
pipeline.addLast(new HttpObjectAggregator(10MB)); // 把多分块的 HttpRequest 聚合成完整请求
pipeline.addLast(new HttpServerCodec());          // = 上两个的合一
```
- **`HttpObjectAggregator`** 是关键：HTTP 报文是"请求行 + headers + 若干 HttpContent 分块 + LastContent"多个入站对象，Aggregator 攒成一个完整 `FullHttpRequest` 再给你，省得自己拼。`maxContentLength` 必须按业务设，防大包攻击。
- 分块/keep-alive/100-continue 等 HTTP 语义 Netty 已处理 —— 但**聚合上限、超时、空闲连接回收要你自己配**（`IdleStateHandler`，s3-2）。

## 六、三大行业场景钩子

- **电商**：支付回调对接多家渠道，报文格式各异（XML/JSON/定长）→ 用不同 frame decoder + 聚合器组装多套 pipeline；对外的 `maxFrameLength`/`maxContentLength` 严格按渠道协议设上限，挡畸形包。
- **金融**：FIX/私有二进制行情协议多用"魔数+长度+体"，正是 `LengthFieldBasedFrameDecoder` 例 3 的形态；**禁用 Java 原生序列化**接收外部消息（反序列化 RCE 是金融合规红线），统一 Protobuf + 白名单。
- **电力**：终端上报帧常是"帧头 + 长度 + 数据域 + CRC"，长度字段往往**含自身或不含**，务必按协议文档逐个推导 adjustment/strip 并**用真机半包序列回归**（一次拆成 2~3 段发，验证不丢不错位）；CRC 校验放在定界之后的业务 handler。

## 七、要点回顾

1. 粘包/拆包源于 TCP 字节流无边界；**定界四法**：固定长 / 分隔符 / **长度字段** / 状态机，对应不同 Netty 解码器。
2. `LengthFieldBasedFrameDecoder` 五参：`maxFrameLength`(必设防 OOM) / `offset` / `lengthFieldLength` / `adjustment`(值与"长度字段后到帧尾"之差) / `strip`(剥头)；用"**含不含自身、含不含别的小头**"来推 adjustment/strip。
3. `ByteToMessageDecoder` **累积机制**保证半包不丢：不够就 return 保留、够了 add 一帧并推 readerIndex；**要么整帧消费要么零消费 return**，别破坏 readerIndex。
4. 定界≠序列化：帧 body 还要 `ProtobufDecoder`/JSON 等转对象；**Java 原生序列化对不可信源 = 反序列化 RCE 风险**，用白名单或改 Protobuf。
5. HTTP 用内置 `HttpServerCodec` + **`HttpObjectAggregator`**（聚合分块 + 设 maxContentLength），别手撕报文。
