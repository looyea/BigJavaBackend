# gRPC、Protobuf 与序列化兼容 · 作业

## 作业 1：Unary + Server Streaming 实现

**目标**：用 Go Server + Java Client 验证跨语言 gRPC。

1. 定义 order.proto（GetOrder unary + StreamOrders server-streaming）。
2. Go 实现 Server → protoc 生成 Go 代码 → 启动 :50051。
3. Java grpc-netty-shaded 生成 Stub → 调用 GetOrder → 拿到响应。
4. 调用 StreamOrders → 分批接收 10 条结果 → 验证流式传输。

## 作业 2：字段兼容性演进

**目标**：模拟字段增删不破坏老版本。

1. v1.proto：OrderDTO(id=1, status=2)。
2. 部署 v1 Server → v1 Client 正常调用。
3. v2.proto：加 coupon_code=3, reserved 4（删除旧字段 remark）。
4. v2 Client 调 v1 Server → 成功（忽略未知字段/缺失字段取默认值）。
5. 错误实验：v2 把 id 改为 string → v1 Client 收到 → 报错。

## 作业 3：gRPC 拦截器鉴权

**目标**：Java gRPC Server 加 Auth Interceptor。

1. 实现 ServerInterceptor 检查 Metadata "authorization"。
2. 有效 Token → next.startCall；无 Token → call.close(UNAUTHENTICATED)。
3. Client 带 Token 调用成功；不带 → 收到 StatusRuntimeException。
4. 加日志 Interceptor 记录方法名+耗时。
