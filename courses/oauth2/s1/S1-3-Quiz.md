# OIDC、SSO 与令牌关系（关联 JWT） · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. OIDC 在 OAuth2 之上补齐的能力是？（6分）

- A. 授权（能不能访问资源）
- B. 认证（这个用户是谁）
- C. 传输加密
- D. 接口限流

> 答案：B
> 解析：OAuth2 管授权，OIDC 通过 id_token 管身份认证；二者叠加才完整。

### 2. 判断"用户登录成功"应当依据哪个令牌？（6分）

- A. Access Token
- B. Refresh Token
- C. id_token
- D. Cookie 里的 JSESSIONID

> 答案：C
> 解析：id_token 是身份断言，含 sub/iss/aud/nonce；拿 access_token 判登录是范畴错误。

### 3. 触发 OIDC 返回 id_token 的关键是？（6分）

- A. 加 header `X-OIDC: 1`
- B. scope 中包含 openid
- C. 使用隐式模式
- D. client 关掉 PKCE

> 答案：B
> 解析：`scope=openid` 是 OIDC 的开关，AS 才额外签发并返回 id_token。

### 4. 校验 id_token 时，aud 必须等于？（6分）

- A. Resource Server 的地址
- B. 本 Client 的 client_id
- C. 用户 sub
- D. 固定值 openid

> 答案：B
> 解析：aud 是受众，必须含自己的 client_id，否则就是别的 client 的令牌被拿来冒充（audience 混淆）。

### 5. nonce 在 OIDC 中的作用是？（6分）

- A. 提高签名强度
- B. 防 id_token 重放，须等于发起授权时下发值
- C. 承载用户权限
- D. 替代 state

> 答案：B
> 解析：nonce 把 id_token 绑定到本次授权请求，Client 校验其一致，挡住旧 token 重放注入。

### 6. "一处登出、处处失效"最可靠的机制是？（6分）

- A. 前端通道登出（各自跳 IdP）
- B. Back-Channel Logout（IdP 服务端回调各应用）
- C. 等 token 自然过期
- D. 清除浏览器缓存

> 答案：B
> 解析：后端通道不依赖浏览器是否在线，直接通知各应用清会话，登出更彻底。

### 7. 关于 id_token 的生命周期，正确做法是？（6分）

- A. 长期存 localStorage 反复携带
- B. 每次资源请求都带上 id_token
- C. 只用于建立应用本地会话，用完即弃
- D. 当作 Access Token 调 API

> 答案：C
> 解析：id_token 只在登录那一刻有意义，之后应用用自己的会话 cookie；资源访问用 access_token。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. 为什么不能拿 Access Token 当登录凭证？（多选）（9分）

- A. Access Token 格式不保证是 JWT（可能是不透明串）
- B. 它的 aud 面向 RS，本 Client 无权解析其身份语义
- C. 它在语义上不是"由谁、何时认证了哪个用户"的断言
- D. Access Token 有效期一定比 id_token 长

> 答案：A、B、C
> 解析：D 不成立——有效期长短不是判据，范畴错误才是核心：access 表"能做什么"，id 表"你是谁"。

### 9. 单点登出要考虑的破口与兜底，正确的有？（多选）（9分）

- A. 应用持有的长命 access_token 在到期前仍可访问 RS
- B. 登出须触发 refresh token 吊销
- C. 前端通道登出在用户关闭页面后可能失效不彻底
- D. 只要清了 IdP 会话，各应用 access_token 立即全部失效

> 答案：A、B、C
> 解析：D 是幻觉——无状态 JWT 不因中心会话清除而立刻作废，需黑名单或短 TTL 收敛。

## 三、简答题（40 分）

### 10. 集团有 5 个内部系统要统一登录且支持"HR 停用账号后立刻全下线"，给出 OIDC 方案要点。（40分）

> 参考答案：
- 统一 IdP：一套 OIDC，5 系统各为一个 confidential client，走授权码 + PKCE。
- 全局会话：IdP 维护中心 session cookie，跨系统静默免登，SSO 一次认证。
- 登录判定：各系统只验 id_token（签名 + iss + aud + nonce），不解析 access_token。
- 令牌：access 短 TTL（分钟级），refresh 轮换、绑 client。
- 即时下线：Back-Channel Logout 回调各系统清会话 + 吊销 refresh。
- 兜底撤销：离职/停用把未过期 access 加黑名单或用 introspection，杜绝"到期前仍可用"窗口。

> 解析：能区分"认证靠 id_token、登出靠后端通道 + 吊销/黑名单"两条主线即达生产水准。
