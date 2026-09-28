# gRPC、Protobuf 与序列化兼容 · 面试题

## 题 1：gRPC 的 Deadline/超时机制怎么用？

```java
// 目的：Client 设置整个调用最大等待时间
OrderServiceGrpc.OrderServiceBlockingStub stubWithDeadline =
    stub.withDeadlineAfter(2, TimeUnit.SECONDS);  // 结果：2s 未完成抛 DEADLINE_EXCEEDED
// 说明：Deadline 通过 HTTP/2 Header "grpc-timeout" 传递给 Server → Server 可据此取消
// 错误用法：不设 Deadline → 下游 hang → 永远等待 → 调用方线程池耗尽
```

## 题 2：gRPC Status Code vs HTTP 状态码？

| gRPC Status | 含义 | 类比 HTTP |
|-------------|------|-----------|
| OK(0) | 成功 | 200 |
| INVALID_ARGUMENT(3) | 参数错 | 400 |
| NOT_FOUND(5) | 不存在 | 404 |
| DEADLINE_EXCEEDED(4) | 超时 | 504 |
| UNAVAILABLE(14) | 服务不可达 | 503 |
| INTERNAL(13) | 服务端 Bug | 500 |

## 题 3：Protobuf oneof 是什么？

```proto
message Notification {
  oneof method {           // 说明：同组字段互斥——只能有一个被设置
    string email = 1;
    string sms = 2;
    string push = 3;
  }
}
// 结果：序列化时只有一个字段占空间 → 节省体积
// 错误用法：同时 set email + sms → 最后一个覆盖前面的 → 数据丢失
```

## 题 4：gRPC 在浏览器中如何使用？

- 原生 gRPC 不直接支持浏览器（HTTP/2 Trailer 兼容性问题）。
- gRPC-Web：Envoy 代理转换 HTTP/1.1 ↔ gRPC。
- Connect Protocol：Buf 推出，纯 HTTP/1.1 + Protobuf → 浏览器直接 fetch。

## 题 5：gRPC 服务版本升级如何保证不中断？

```text
1. 新增 rpc 方法 → 老 Client 不会调用 → 兼容
2. 字段增（新编号）→ 老 Client 忽略 → 兼容
3. 删除字段 → reserved 编号 → 老 Client 读到 0/空 → 降级可处理
4. 破坏性变更 → 新 service 版本号（order.v2.OrderService）→ 老 v1 共存过渡期
```

## 题 6：Dubbo Triple vs 原生 gRPC？

| 维度 | Triple | gRPC |
|------|--------|------|
| 协议 | HTTP/2 + Protobuf 或 JSON | HTTP/2 + Protobuf |
| 兼容 | 可被 gRPC Client 直连 | 标准 gRPC |
| 生态 | Dubbo 治理（Filter/Router/LoadBalance） | grpc-middleware/Interceptor |
| 跨语言 | 是 | 是 |
