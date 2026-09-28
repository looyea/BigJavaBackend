# gRPC、Protobuf 与序列化兼容

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：掌握 gRPC 四种调用模式、Protobuf IDL 契约设计及序列化字段兼容演进策略。

## 一、gRPC 核心模型

```text
.proto IDL → protoc 生成 Stub/Service → HTTP/2 传输 → Protobuf 序列化
Client Stub → 远程方法调用 → Server ServiceImpl → Response
```

```proto
// 目的：定义 OrderService 的 IDL 契约
syntax = "proto3";
package order;
service OrderService {
  rpc GetOrder(GetOrderReq) returns (OrderDTO);           // 结果：一元调用
  rpc StreamOrders(StreamReq) returns (stream OrderDTO);   // 输出：服务端流
  rpc BatchSync(stream OrderDTO) returns (SyncResult);     // 说明：客户端流
  rpc Chat(stream ChatMsg) returns (stream ChatMsg);       // 双向流
}
message GetOrderReq { int64 id = 1; }  // 字段编号 1 不可改
message OrderDTO { int64 id = 1; string status = 2; }
```

## 二、四种调用模式

| 模式 | 签名 | 场景 |
|------|------|------|
| Unary | Req → Resp | 普通 RPC |
| Server Streaming | Req → stream Resp | 大结果集分块/实时推送 |
| Client Streaming | stream Req → Resp | 文件上传/批量写入 |
| Bidirectional | stream Req → stream Resp | 即时通讯/协商 |

## 三、Protobuf 序列化兼容性

```proto
// 目的：字段兼容规则——增删字段不破坏老版本
message OrderDTO {
  int64 id = 1;              // 说明：已上线字段编号永远不可复用
  string status = 2;
  // 新增字段：用新编号 3 → 老客户端忽略未知字段 → 向后兼容
  string coupon_code = 3;    // 结果：老代码不报错
  // 删除字段：保留编号用 reserved 标记（防止将来误用）
  reserved 4;
}
// 错误用法：把 id=1 改为 string → wire type 变 → 全量反序列化失败
```

**三大原则**：字段编号不可复用；字段类型不可改（wire format 兼容除外）；新增用 optional。

## 四、gRPC 拦截器（Interceptor）

```java
// 目的：Server 端统一鉴权
public class AuthInterceptor implements ServerInterceptor {
    public <ReqT, RespT> ServerCallListener<ReqT> intercept(
            ServerCall<ReqT, RespT> call, Metadata headers, ServerCallHandler<ReqT, RespT> next) {
        String token = headers.get(Metadata.Key.of("authorization", ASCII_STRING_MARSHALLER));
        if (token == null) {
            call.close(Status.UNAUTHENTICATED.withDescription("missing token"), new Metadata());
            // 结果：直接关闭调用不进入 Service
            return new ServerCallListener<>() {};
        }
        return next.startCall(call, headers);  // 输出：继续
    }
}
// 错误用法：Interceptor 中做耗时 RPC → 阻塞 Netty EventLoop → 全部请求排队
```

## 五、gRPC 与 HTTP/JSON 互转

```text
gRPC-Gateway：.proto 中加 google.api.http 注解 → 自动生成 REST 反向代理
// 说明：外部客户端用 HTTP JSON → Gateway 转 gRPC → 内部调用
option (google.api.http) = { get: "/v1/orders/{id}" };
```

## 六、性能对比

| 维度 | Protobuf | JSON | Hessian2 |
|------|----------|------|----------|
| 序列化速度 | 极快 | 慢 | 中 |
| 体积 | 小（二进制） | 大（文本） | 中 |
| 跨语言 | 官方 10+ 语言 | 全语言 | Java 为主 |
| Schema | 强制 .proto | 可选 | 依赖类结构 |

## 七、关联技术

- Connect（gRPC-Web 替代）：浏览器直连 gRPC。
- Dubbo Triple：基于 HTTP/2 + Protobuf，兼容 gRPC。
- OpenAPI/Swagger：REST 侧的契约描述；gRPC 用 reflection。
