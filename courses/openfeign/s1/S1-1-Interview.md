# Feign 调用链与超时重试陷阱 · 面试题

## 题 1：Feign 的调用原理是什么？

```text
@FeignClient 接口 → JDK 动态代理（FeignInvocationHandler）
→ 解析注解构建 RequestTemplate → LoadBalancer 替换服务名为实际 IP:Port
→ HTTP Client 发送 → Decoder 反序列化响应为 Java 对象
```

## 题 2：如何避免重试导致的重复扣款？

- 非幂等接口**关闭所有层重试**（Feign Retryer + LB Retry 设为 1 次）。
- 若必须重试：接口设计幂等（唯一业务流水号 + DB 唯一键）。
- 或拆分：重试只对 GET/查询类操作开启，POST/写操作禁用。

## 题 3：Feign 的 connectTimeout 和 readTimeout 分别在哪个阶段生效？

- connectTimeout：TCP 三次握手阶段——从发起连接到收到 SYN-ACK。
- readTimeout：等数据阶段——连接建立后，等待服务端返回第一个字节/响应体。
- 如果 connect 超时：通常是网络不通或目标端口未监听。
- 如果 read 超时：目标服务处理慢（GC/慢查询/死锁）。

## 题 4：如何在 Feign 中实现请求签名？

```java
// 目的：对敏感操作（转账/退款）加签名防篡改
@Component
public class SignInterceptor implements RequestInterceptor {   // 说明：对所有 Feign 接口出栈前统一执行
    public void apply(RequestTemplate template) {
        String body = new String(template.body(), StandardCharsets.UTF_8);   // 目的：取请求体原文参与签名
        String sign = HmacUtils.hmacSha256(secret, body + template.request().timestamp());  // 结果：签名覆盖 body+时间戳，防偷换与重放
        template.header("X-Sign", sign);  // 结果：下游验签确保未被中间篡改
    }
}
// 错误用法：GET 无 body 只签 URL → 攻击者改 query 参数 → 签名无效
```

## 题 5：Spring Cloud 4.x Feign 有什么变化？

- 移除 Netflix Ribbon → 完全使用 Spring Cloud LoadBalancer。
- 移除 Hystrix → 使用 Resilience4j 或 Sentinel 做熔断。
- `spring.cloud.openfeign.client.config.*` 路径不变但配置类有调整。
- 支持 Java 17 record 作为 DTO（需 Jackson 17+）。

## 题 6：Feign 与 Dubbo 调用的核心区别？

| 维度 | Feign | Dubbo |
|------|-------|-------|
| 协议 | HTTP/1.1 + JSON | 私有 TCP + Hessian2 |
| 性能 | 中（文本序列化开销） | 高（二进制） |
| 跨语言 | 天然支持 | Triple/gRPC 扩展 |
| 服务治理 | 需外挂 | 内置路由/权重/Mock |
| 侵入 | 零（接口注解） | SDK 依赖 |
