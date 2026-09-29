# OAuth2/JWT 集成与 CSRF、方法级安全落地（关联）

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：能把 Spring Security 从"能登录"推进到"资源服务正确校验令牌 + 权限点落到方法 + 无状态下想清楚 CSRF"。**OAuth2 资源服务器（resource server）** 用 `oauth2ResourceServer()` 校验访问令牌：要么**本地用 JWT 自包含校验**（配 `jwk-set-uri` 拿授权服务器公钥验签、校验 iss/aud/exp、把 claim 映射成权限），要么**走 Token Introspection** 调授权服务器内省（适合可吊销的不透明令牌）。**方法级安全**用 `@EnableMethodSecurity` + `@PreAuthorize("hasAuthority(...)"/hasRole/spel)` 把权限点收敛到方法，比只靠 URL 匹配更细。**CSRF** 只在"浏览器自动携带的 Cookie 会话"下才需要防护；纯 `Bearer Token`（前端存 localStorage/手动带 `Authorization` 头）的无状态 API，攻击者无法让浏览器自动附带该头，可安全关闭 CSRF——但一旦混用 Cookie 就必须开、且要正确配置 Token 仓库。要点：JWT 验签靠公钥不是密钥、别把对称密钥下发到资源服务；`hasRole('ADMIN')` 实际比对 `ROLE_ADMIN`，与 claim 里的权限命名要对齐；令牌放 Redis 黑名单可补 JWT"签发后难吊销"的短板。识破"资源服务器用对称密钥验签把密钥泄露到各服务""无状态 API 却硬开 CSRF 又没配 Token 仓库导致 POST 全 403""`@PreAuthorize` 用了却没 `@EnableMethodSecurity` 静默失效""JWT 过期就以为安全、却忘了服务端无法主动吊销"等坑。

## 一、资源服务器：JWT 本地自校验

```yaml
# 目的：资源服务用授权服务器公钥本地校验 JWT, 不内省也能验签与权限
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.example.com   # 说明：校验 iss 是否与令牌一致, 防串issuer
          jwk-set-uri: https://auth.example.com/.well-known/jwks.json # 结果：取公钥验签, 绝不下发对称密钥到资源服务
# 反例：用 HS256 对称密钥让每个资源服务都持密钥验签 ❌ 密钥一旦下发到多处即泄露面陡增 ❌ 应非对称 RS256+JWKS
```

## 二、把 claim 映射成权限 + 方法级鉴权

```java
// 目的：URL 匹配粒度太粗, 用 @PreAuthorize 把权限点收敛到具体方法
@Configuration
@EnableMethodSecurity           // 说明：不写这行 @PreAuthorize 静默失效(易踩), 方法级安全不会生效
public class MethodSecurity {
    @PreAuthorize("hasAuthority('SCOPE_order:write')") // 结果：scope claim 前缀 SCOPE_, 命名要对齐否则永远拒
    public Order create(OrderDto dto) { ... }
    // 反例：hasRole('ADMIN') 实际比对的是 ROLE_ADMIN ❌ 若 JWT 里存的是 "ADMIN" 不带前缀会一直鉴权失败 ❌ 统一命名
}
```

## 三、CSRF：无状态 Bearer 可关，混用 Cookie 必开

```text
图目的：CSRF 防护的必要性与"令牌存放方式"强相关
Cookie 会话(浏览器自动带) ──▶ 必须开 CSRF, 否则跨站伪造请求可借 Cookie 冒充用户
纯 Bearer Token(手动加 Authorization 头/前端存储) ──▶ 浏览器不会自动附带 → 可关 CSRF
混合模式(部分接口用 Cookie) ──▶ 必须开并配 CookieCsrfTokenRepository, 否则 POST 全 403
关键: 关 CSRF 的前提是"认证凭证不会被浏览器自动携带", 不是"因为是 REST 就随便关"
```

## 四、坑与底线

- **验签用非对称**：资源服务器只拿公钥（JWKS）验签，私钥留在授权服务器；把对称密钥散发到各资源服务等于到处放钥匙。
- **权限命名要对齐**：`hasRole` 会自动补 `ROLE_` 前缀、`hasAuthority` 补 `SCOPE_`（来自 JWT scope），claim 与表达式命名不一致会一直 403。
- **CSRF 判断看凭证形态**：无状态 Bearer 可关，但一旦有 Cookie 认证就必须开；同时正视 JWT"签发即有效、到期前难吊销"的短板，重要场景用黑名单/短 TTL + 刷新令牌兜底。

## 五、关联课程

安全过滤器链里 `BearerTokenAuthenticationFilter`、CSRF 过滤器等的执行次序见 [安全过滤器链执行顺序](../s1/S1-1-Lesson.md)；Authorities 如何从认证对象流到授权决策、权限模型设计承接 [认证授权模型与权限设计](../s1/S1-2-Lesson.md)；令牌传输必须走 HTTPS/TLS、字段级加密与合规落地见 [HTTPS/TLS、脱敏与合规落地（关联）](../../data-security/s1/S1-3-Lesson.md)；令牌防篡改与接口签名、防重放的取舍见 [接口签名、防重放与 KMS](../../data-security/s1/S1-2-Lesson.md)。
