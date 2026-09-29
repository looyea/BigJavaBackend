# JWT 结构与签名验证

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：能徒手拆出 JWT 的 Header/Payload/Signature 三段并说明 Base64URL 编码，讲清 HS256（对称）与 RS256（非对称）的适用边界；会写正确的验签 + 过期校验，并识破"Base64 解开了就当真、只解码不验签"的入门级事故。

## 一、三段式：xxxxx.yyyyy.zzzzz

JWT（RFC 7519）是 `Header.Payload.Signature` 三段 **Base64URL** 编码后以 `.` 连接。它是**签名防篡改**、不是**加密**——Payload 任何人可解码看见，别把敏感数据塞进去。

```text
图目的：看清三段的构成与签名覆盖范围
Header    {"alg":"RS256","typ":"JWT","kid":"2026-05"}      → 用什么算法、哪把密钥
Payload   {"sub":"u1001","iss":"as","aud":"api","exp":...}  → 声明（claims），明文可读
Signature = Sign( base64url(header) + "." + base64url(payload), key )
签名覆盖前两段：改任何一个字符（含把 alg 换掉）都会导致验签失败 → 这就是防篡改的根。
```

Base64URL 与标准 Base64 差在字符集：`-`/`_` 替代 `+`/`/` 且去掉 `=` 填充，为了直接放进 URL 不转义。

## 二、签名 vs 加密：最常见的认知错位

```java
// 目的：把"JWT = 编码不是加密"钉死
String payload = new String(Base64.getUrlDecoder().decode(jwt.split("\\.")[1]));
// 说明：上面这行任何人不用密钥都能执行 → Payload 是"可见"的
// 反例：把手机号/身份证/密码哈希塞进 JWT claims ❌ 结果：令牌一旦泄露即敏感信息裸奔
// 反例：以为"看不懂 Base64 就是安全" ❌ 它只是编码，不是保密；保密要靠不放或另外加密
```

JWT 保证的是**完整性与真实性**（签名验证通过 → 内容未被篡改且由持密钥方签发），不保证**机密性**。

## 三、HS256 与 RS256：对称与非对称的分水岭

```text
图目的：两种签名族的选择轴
HS256 HMAC+共享密钥   签发与验证用同一把 secret，快、简单
       适合：单体自签自验；不适合多方（每个验签方都持 secret=都能伪造）
RS256 RSA/ECDSA 私钥签、公钥验   私钥只在 AS，公钥经 JWKS 分发给任意 RS
       适合：多服务/多方验签、OAuth2/OIDC 标准；开销略高
结论：谁签发、多少人验，决定算法——验签方越多越该用非对称。
```

## 四、验签的最低正确集合

```java
// 目的：写一个不会出事的验签入口
Jws<Claims> jws = Jwts.parserBuilder()
    .setSigningKey(resolver)                    // RS256 用 JWKS provider；HS256 用 SecretKey
    .requireIssuer("https://as.example.com")    // 校验 iss
    .requireAudience("orders-api")              // 校验 aud，防令牌跨服务误用
    .build()
    .parseClaimsJws(token);                     // 内部已校验签名 + exp/nbf
// 反例：setAllowedClockSkewSeconds(3600) 放宽过期容差到一小时 ❌ 过期控制形同虚设
// 反例：只 parse 不 require 算法，信任 token header 里的 alg ❌ 给算法混淆攻击开门（下节详解）
```

要点：**永远以服务端配置为准指定可信算法**，绝不信 token header 自报的 `alg`；`exp`/`nbf` 校验默认开启别关；验签失败要抛异常而非返回 null 继续走。

## 五、关联课程

标准 claims 与 alg=none/密钥混淆攻击在 [Claims、刷新与算法攻击防护](S1-2-Lesson.md)；吊销与登出在 [无状态登出、吊销与与 OAuth2 协同（关联）](S1-3-Lesson.md)；id_token 为何必须是 JWT 在 [OIDC、SSO 与令牌关系（关联 JWT）](../../oauth2/s1/S1-3-Lesson.md)；密钥轮转与 KMS 在 [接口签名、防重放与 KMS](../../data-security/s1/S1-2-Lesson.md)。
