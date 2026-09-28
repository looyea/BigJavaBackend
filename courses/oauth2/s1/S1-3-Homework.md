# OIDC、SSO 与令牌关系（关联 JWT） · 作业

## 作业 1：接一个 OIDC 登录并校验 id_token

- **目标**：把"验 id_token 而非 access_token"落到代码。
- **任务**：用 OIDC 调试客户端（或 Keycloak / Auth0 沙箱）走授权码 + PKCE 拿到 id_token、access_token；解析 id_token 打印 `iss/aud/sub/exp/nonce/auth_time`，写校验函数逐项断言 `aud == client_id`、`iss == 可信 IdP`、`nonce == 本次授权下发值`。
- **验收标准**：正常登录校验通过；把 nonce 改成别的值或换另一 client 的 id_token 时校验失败并抛异常。
- **参考解法要点**：验签公钥来自 IdP 的 JWKS（见 [JWT 结构与签名验证](../../jwt/s1/S1-1-Lesson.md)）；audience 校验缺失即 audience 混淆攻击面（见 [课文](S1-3-Lesson.md) 第二节）。

## 作业 2：跨系统 SSO 免登演示

- **目标**：验证"一次登录、多系统免登"的中心会话机制。
- **任务**：本地起两个 OIDC Client（app-a:8081、app-b:8082）指向同一 IdP；在 app-a 登录后，直接访问 app-b 观察是否免密完成授权并建立本地会话，抓包确认第二次未再要求输入口令（IdP 会话命中）。
- **验收标准**：app-b 登录全程无口令输入、跳转链路中出现 IdP 静默签发；两应用各自持有独立本地会话 cookie。
- **参考解法要点**：关键是 IdP 侧全局会话 cookie；应用侧应只认 id_token 建立会话，用完即弃不外传。

## 作业 3：单点登出与"立即失效"设计（书面）

- **目标**：解决无状态令牌"登出后仍可用"的窗口。
- **任务**：设计 Back-Channel Logout 流程——IdP 登出时向已登录各应用 `/logout` 回调发 `logout_token`（含 `sid`/`sub`），应用清本地会话；再补一层：把该用户未过期 access_token 加入短期黑名单或删除对应 refresh。画出时序并说明 logout_token 的校验点。
- **验收标准**：方案覆盖"前端通道登出不彻底"的替代；明确 access 短 TTL 与黑名单/introspection 的取舍；logout_token 校验 aud/iss/backchannel_logout_uri 绑定。
- **参考解法要点**：撤销能力是"无状态便利"的对价，金融类对即时性要求高应偏向 introspection/黑名单，与 [无状态登出、吊销与与 OAuth2 协同（关联）](../../jwt/s1/S1-3-Lesson.md) 呼应。
