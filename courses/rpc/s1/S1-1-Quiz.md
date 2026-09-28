# RPC 原理与 Dubbo 架构 · 小测

### 1. RPC 调用中 Consumer 侧的动态代理作用是？（6分）

- A. 本地缓存
- B. 将接口方法调用转为序列化+网络请求
- C. 数据库连接
- D. HTTP 重定向

> 答案：B
> 解析：Proxy 拦截方法调用 → 封装为 RPC Request → 序列化 → Netty 发送。

### 2. Dubbo 默认使用的网络框架是？（6分）

- A. Tomcat
- B. Mina
- C. Netty
- D. Jetty

> 答案：C
> 解析：Dubbo 2.x+ 默认 Netty 4，长连接 NIO，高性能序列化传输。

### 3. Dubbo SPI 与 JDK SPI 的最大区别是？（6分）

- A. 无区别
- B. Dubbo 按需加载 + 支持 IoC/AOP + @Adaptive 动态选实现
- C. JDK SPI 性能更好
- D. Dubbo SPI 只加载 Provider

> 答案：B
> 解析：JDK SPI 全量加载；Dubbo ExtensionLoader 按 name 获取、支持自动注入和装饰器。

### 4. 以下哪种 NOT 是 Dubbo 的负载均衡策略？（6分）

- A. Random
- B. LeastActive
- C. ConsistentHash
- D. TokenBucket

> 答案：D
> 解析：TokenBucket 是限流算法，非负载均衡策略。

### 5. failfast 集群策略适用于？（6分）

- A. 幂等查询
- B. 非幂等写操作（如扣款）
- C. 日志上报
- D. 广播通知

> 答案：B
> 解析：failfast 只调一次不重试 → 避免重复执行非幂等操作。

### 6. Dubbo 的 Registry 组件作用是？（6分）

- A. 执行 RPC 调用
- B. 存储服务提供者列表供 Consumer 订阅
- C. 序列化
- D. 限流

> 答案：B
> 解析：Registry（Nacos/ZK）存 provider URL 列表 → Consumer 订阅获取 → 本地路由决策。

### 7. @DubboReference 中 retries=2 实际最多调用几次？（6分）

- A. 2
- B. 3（首次 + 2 次重试）
- C. 4
- D. 1

> 答案：B
> 解析：Dubbo retries = 额外重试次数，总调用 = 1 + retries = 3。

### 8. Dubbo Filter 链的作用包括（多选）？（9分）

- A. 链路追踪（注入 traceId）
- B. 全链路压测标记
- C. 编译时类型检查
- D. 监控指标上报

> 答案：A、B、D
> 解析：C 是编译器功能，Filter 在运行时拦截调用链。

### 9. Dubbo 3.x 的改进包括（多选）？（9分）

- A. 应用级服务发现（降低注册中心压力）
- B. Triple 协议兼容 gRPC
- C. 移除 Netty 改用 Servlet
- D. 支持 Kubernetes 原生

> 答案：A、B、D
> 解析：C 错——Dubbo 3 仍基于 Netty。

### 10. 简答题：描述 Dubbo 从 Provider 启动到 Consumer 完成一次调用的全流程。（40分）

- 要点1：Provider 暴露：@DubboService → Protocol.export → NettyServer 监听 + 注册 URL 到 Registry
- 要点2：Consumer 引用：@DubboReference → Directory 订阅 Registry → 拿到 Invoker 列表
- 要点3：负载均衡：LoadBalance 选一个 Invoker
- 要点4：集群容错：Cluster(如 failover) 包装调用 → ExchangeClient 长连接发送
- 要点5：序列化 → Netty → Provider 端 Handler 解码 → 反射调用 Impl → 返回 Response

> 答案：见要点
> 解析：掌握全流程是排查"No provider""Timeout""SerializeError"等问题的基础。
