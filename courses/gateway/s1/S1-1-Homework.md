# 网关三大件与全局过滤器 · 作业

## 作业 1：路由配置实战

**目标**：为 3 个微服务配置路由并验证转发。

1. 网关监听 8080；order-service(9001)、user-service(9002)、product-service(9003)。
2. 配置路由：`/api/orders/**`→order、`/api/users/**`→user、`/api/products/**`→product。
3. StripPrefix=1 让后端收到的路径不含 `/api`。
4. 添加 `AddRequestHeader(X-Gateway, scg)` 标记来源。
5. curl 验证后端日志中 Header 正确。

## 作业 2：全局鉴权过滤器

**目标**：实现 JWT 鉴权并排除白名单。

1. 编写 AuthGlobalFilter（order=-100），校验 Authorization Header。
2. 白名单路径（/api/auth/login、/actuator/health）跳过鉴权。
3. 无 Token 或过期 → 返回 401 JSON。
4. 有效 Token → 解析 userId 追加到 X-User-Id Header 透传。
5. 用有效/无效 Token 分别测试。

## 作业 3：自定义 Weight 灰度路由

**目标**：同一服务两个版本按 80/20 分流。

1. 启动 order-service v1（8081）和 v2（8082），注册到 Nacos。
2. 配置两组 Route：Weight=80 → v1，Weight=20 → v2。
3. 发 100 个请求统计比例。
4. 调整 Weight 为 50/50 并验证动态生效。
