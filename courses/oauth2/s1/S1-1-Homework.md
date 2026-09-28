# 核心角色与四种授权模式 · 作业

## 作业 1：用 Spring Authorization Server 跑通授权码全流程

- **目标**：亲手观察 code→token 的两段交换，理解"secret 不过前端"。
- **任务**：起一个 Spring Authorization Server，注册一个机密 client（`authorization_code` + `refresh_token`），用浏览器走完授权获取 code，再用 `curl` 拿 code + client_secret 换 access/refresh，打印两种令牌 TTL。
- **验收标准**：能贴出 authorize 重定向 URL（含 state）、token 端点请求体、返回的 JSON；code 二次使用被拒（一次性）。
- **参考解法要点**：`ClientAuthenticationMethod.CLIENT_SECRET_BASIC`、`TokenSettings.tokenSettings().accessTokenTimeToLive(Duration.ofMinutes(5))`；code 换完立即过期是设计而非 bug（见 [课文](S1-1-Lesson.md) 第二节）。

## 作业 2：客户端凭证模式的服务间令牌获取

- **目标**：体会"无用户"场景下令牌代表应用身份。
- **任务**：注册一个 `client_credentials` client，写一段代码换取 access token 并用它访问一个受保护 API；对比它与授权码换得的令牌在 claims 上的差异（无 `sub`= 无终端用户）。
- **验收标准**：请求体仅 `grant_type=client_credentials&scope=...`，无 code、无用户登录；返回令牌 payload 里 `client_id` 存在而用户标识缺省。
- **参考解法要点**：机器令牌通常不下发 refresh（可自行重取）；把 token 缓存到临近过期再刷新，别每次调用都换。

## 作业 3：接入需求模式判定（书面）

- **目标**：把"三句话决策树"用成肌肉记忆。
- **任务**：给下面四个场景各判一种 grant 并说明理由——① 小程序第三方登录；② 夜间对账批处理拉银行数据；③ SPA 前端直连开放 API；④ 合作方后端代表用户读其资料。
- **验收标准**：① 走授权码（小程序为公共客户端，加 PKCE）、② 客户端凭证、③ 授权码 + PKCE（而非已废弃的隐式）、④ 授权码；每条附"有无用户 / 客户端是否机密"两轴判断。
- **参考解法要点**：先问"有没有用户参与"，再问"客户端能不能藏 secret"——两轴定四格。
