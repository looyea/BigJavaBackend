# gRPC、Protobuf 与序列化兼容 · 小测

### 1. gRPC 底层使用的传输协议是？（6分）

- A. HTTP/1.1
- B. HTTP/2
- C. TCP 私有协议
- D. WebSocket

> 答案：B
> 解析：HTTP/2 多路复用、头部压缩、Server Push——天然适合微服务高频小请求。

### 2. Protobuf 字段编号的作用是？（6分）

- A. 排列顺序
- B. 二进制编码标识（wire key），决定序列化/反序列化兼容
- C. 数据库列号
- D. 随机 ID

> 答案：B
> 解析：编码时 tag = field_number << 3 | wire_type，编号变即不兼容。

### 3. 以下哪种操作会破坏 Protobuf 向后兼容？（6分）

- A. 新增字段用新编号
- B. 修改已有字段的编号
- C. 删除字段并 reserved 其编号
- D. 新增 optional 字段

> 答案：B
> 解析：修改编号 → 老数据反序列化到新 schema 时 tag 不匹配 → 字段丢失/报错。

### 4. Server Streaming 典型场景是？（6分）

- A. 文件上传
- B. 服务端分批推送大结果集
- C. 即时通讯
- D. 简单 CRUD

> 答案：B
> 解析：一元返回百万条 → 内存爆；流式分批推送 → 客户端增量消费。

### 5. gRPC 拦截器（Interceptor）类比 Spring 的什么？（6分）

- A. Controller
- B. Filter/HandlerInterceptor
- C. Service
- D. Repository

> 答案：B
> 解析：拦截器在调用前后统一处理鉴权/日志/超时——类似 Servlet Filter。

### 6. reserved 关键字的用途是？（6分）

- A. 保留给未来使用
- B. 标记已删除字段的编号，防止误复用导致不兼容
- C. 定义枚举
- D. 指定编码方式

> 答案：B
> 解析：删除字段后 reserved 4 → protoc 编译时若有人用编号 4 会报错。

### 7. gRPC 跨语言的前提是？（6分）

- A. 所有服务用同一框架
- B. 共同 .proto 契约 + 各语言 protoc 插件生成代码
- C. 统一数据库
- D. 同一 JVM

> 答案：B
> 解析：IDL 定义接口 → Go/Java/Python 各跑 protoc → 生成对应 Stub → 互调。

### 8. Protobuf 相比 JSON 的优势包括（多选）？（9分）

- A. 体积更小
- B. 序列化更快
- C. 天然人类可读
- D. 强制 Schema 校验

> 答案：A、B、D
> 解析：C 错——二进制不可读；需用 protoc decode 或 grpcurl 查看。

### 9. gRPC 四种调用模式包括（多选）？（9分）

- A. Unary
- B. Server Streaming
- C. Client Streaming
- D. Bidirectional

> 答案：A、B、C、D
> 解析：全部正确——覆盖所有流式组合。

### 10. 简答题：Protobuf 字段兼容的三大原则是什么？为什么不能改字段类型？（40分）

- 要点1：原则一：字段编号只增不改不复用（reserved 保护已删编号）
- 要点2：原则二：字段类型上线后不可变更（wire type 变即反序列化崩溃）
- 要点3：原则三：新增字段必须 optional 或有默认值（老代码忽略未知字段）
- 要点4：改类型导致不兼容的原因：wire format tag = number << 3 | wire_type，类型变 → wire_type 变 → 解析偏移
- 要点5：实践：用 protoc --descriptor_set_out 做 CI 兼容性检查

> 答案：见要点
> 解析：序列化兼容是微服务独立部署/灰度发布的基础。
