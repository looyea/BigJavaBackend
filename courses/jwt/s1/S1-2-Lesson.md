# Claims、刷新与算法攻击防护

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：记牢注册 claims（iss/sub/aud/exp/nbf/iat/jti）与私有 claims 的边界，设计合理的 access/refresh 双令牌刷新与轮换；能逐一识破并防御 `alg=none`、RS/HS 算法混淆、密钥误用、`kid` 注入等经典 JWT 攻击。

## 一、Claims：三类字段各司其职

```text
图目的：把该校验的字段和可自由扩展的字段分开
注册 claims（RFC 7519 定义，语义标准）
  iss 签发者   sub 主体(用户)   aud 受众   exp 过期   nbf 生效前   iat 签发时间   jti 唯一ID(防重放)
公开 claims：命名空间化（如 email 需域名所有权），少用
私有 claims：自定义业务字段，如 role / tenant_id，命名别撞注册的
```

强约束：`exp` 必设、`aud`/`iss` 服务端 `require`、`jti` 若要配黑名单则必须唯一。

## 二、双令牌与刷新：无感续期的正确姿势

```text
图目的：refresh 轮换（rotation）时序，重点是旧 refresh 作废
access(5~15min) 到期 → 客户端拿 refresh 调 /token(grant_type=refresh_token)
→ AS 验证 refresh 有效 → 发【新 access + 新 refresh】，同时把【旧 refresh 立即作废】
→ 若检测到"已作废的旧 refresh 被再次使用" = 疑似泄露 → 吊销整条令牌家族并告警
关键：refresh 一次性轮换 + 复用检测，比固定 refresh 安全得多。
```

```java
// 目的：refresh 轮换的复用检测骨架
if (storedRefresh == null) {                       // 服务端已标记该 jti 的旧 refresh 用过
    revokeFamily(token.get("jti"));                // 结果：撤销整族令牌，强制重登
    throw new TokenReuseDetectedException();       // 说明：疑似被窃，宁可误伤
}
markUsedAndRotate(oldRefreshJti, newRefreshJti);   // 旧的作废、新的入库
```

## 三、攻击一：`alg: none` —— 把签名段清空当合法

攻击者把 Header 改成 `{"alg":"none"}`、篡改 Payload、去掉签名，赌服务端"信任 header 自报算法且 none 即跳过验签"。

```text
图目的：alg=none 攻击链与断链点
攻击：改 payload(role=admin) → header.alg=none → 签名置空 → 提交
断链：服务端不接受 none；验签入口白名单只放 RS256/ES256，其余一律拒
库坑：老版本某些 JWT 库默认接受 none（CVE 频出）——升级 + 显式锁算法双保险
```

## 四、攻击二：RS256 → HS256 算法混淆

最阴的一招：服务端用 RS256，公钥可经 JWKS 公开获取。攻击者把 `alg` 改成 `HS256`，并**拿公钥当 HMAC 的 secret** 去签名。若服务端"按 header.alg 选验证方式"，就会用这把"公钥字符串"当密钥做 HMAC 校验——恰好验过。

```java
// 目的：根治算法混淆——验证方式由服务端配置钉死，与 token 的 alg 无关
// 反例（危险）❌：
Algorithm alg = Algorithm.fromId(header.get("alg"));   // 信 token 自报 alg
MACVerifier.build().withSecretKey(publicKeyAsSecret)... // HS 分支拿公钥当 secret → 被绕过
// 正解 ✅：无论 token 写什么，只按预配置算法验证
JWT.require(Algorithm.RSA256(publicKey))                  // 锁定 RS256，token 若声称 HS256 直接拒
   .withIssuer("as").withAudience("api").build().verify(token);
```

## 五、攻击三：密钥与 kid 的工程坑

- 别把密钥硬编码进前端可反编译处；HS 密钥要足够长（≥256bit），短 secret 可被暴力枚举。
- `kid` 若拼接进文件路径/查询去取密钥，未校验即注入（路径穿越、JWKS URL 指向攻击者服务器）——`kid` 只作查表键，绝不进 SQL/路径/远程拉取白名单外地址。
- 密钥轮转：JWKS 同时挂新旧公钥，`kid` 平滑过渡，避免轮转瞬间全站 401。

## 六、关联课程

三段结构与基础验签在 [JWT 结构与签名验证](S1-1-Lesson.md)；吊销与登出在 [无状态登出、吊销与与 OAuth2 协同（关联）](S1-3-Lesson.md)；授权码换令牌与 refresh 下发在 [授权码 + PKCE、scope 与令牌存储](../../oauth2/s1/S1-2-Lesson.md)；签名串与防重放通用于 [接口签名、防重放与 KMS](../../data-security/s1/S1-2-Lesson.md)。
