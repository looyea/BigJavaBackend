# 认证授权模型与权限设计 · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. ProviderManager 认证表单用户名密码的默认组件是？（6分）

- A. JwtAuthenticationFilter
- B. DaoAuthenticationProvider（委托 UserDetailsService + PasswordEncoder）
- C. RoleHierarchy
- D. CsrfFilter
> 答案：B
> 解析：ProviderManager 按凭证类型路由到匹配的 Provider，表单即 Dao 这条；A 是过滤器不是认证 Provider。

### 2. 认证成功后的 Authentication 对象默认会？（6分）

- A. 保留 credentials 以便后续调用
- B. 擦除 credentials（eraseCredentialsAfterAuthentication=true）
- C. 删除 authorities
- D. 序列化进 URL
> 答案：B
> 解析：密码等凭证在认证成功后立即擦除，防止残留在会话存储/日志——安全默认值不要改。

### 3. hasRole('ADMIN') 实际比较的权限字符串是？（6分）

- A. ADMIN
- B. ROLE_ADMIN
- C. ROLE.HIERARCHY.ADMIN
- D. AUTHORITY_ADMIN
> 答案：B
> 解析：hasRole 自动补 ROLE_ 前缀；库里存 "ADMIN" 再配 hasRole('ADMIN') 永远 403，前缀约定要全局统一。

### 4. "能不能访问这条订单数据"属于哪类权限问题，该在哪解决？（6分）

- A. 垂直越权；URL 授权规则
- B. 水平越权（数据权限）；SQL/应用层条件（如租户注入、归属校验）
- C. 角色继承；RoleHierarchy
- D. scope；OAuth2 授权服务器
> 答案：B
> 解析：RBAC/URL 规则管功能入口，数据行归属必须由查询条件兜底——只靠 @PreAuthorize 路径规则答不了这题。

### 5. @PostFilter 做大列表行过滤的主要问题是？（6分）

- A. 语法不支持 SpEL
- B. 全量加载后内存筛选：性能事故 + 通过耗时差泄漏他人数据存在性
- C. 只能过滤 String
- D. 与 @PreAuthorize 冲突
> 答案：B
> 解析：数据权限应下推到 SQL（拦截器注入条件），后置过滤是"先泄后筛"的反模式。

### 6. 动态授权（改权限不发版）的正确工程形态是？（6分）

- A. 每次请求实时联表查权限库保证一致
- B. 自定义 AuthorizationManager/decide 回调 + 两级缓存 + 变更事件驱动失效
- C. 把权限写死在配置文件重启生效
- D. 前端控制按钮即可
> 答案：B
> 解析：A 会让权限表成为全站热点单点；D 根本不是服务端授权；B 在实时性与性能间用失效事件取得平衡。

### 7. 表达"AUDITOR 自动拥有 VIEWER 全部权限"的机制是？（6分）

- A. RoleHierarchy
- B. AuthenticationEntryPoint
- C. GrantedAuthority[] 手工重复列举
- D. permitAll
> 答案：A
> 解析：层级 Bean 声明蕴含关系，授权评估时自动展开，避免每个规则双写两个角色。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于 RBAC 权限粒度设计，合理的有？（9分）

- A. 权限字符串用 域:资源:动作（如 order:refund:exec），到操作级
- B. 角色只做权限聚合，接口/权限直接绑角色不绑用户
- C. 菜单显隐规则即服务端授权规则，二者可以互相当证据
- D. 改接口不动角色、加用户不动权限表结构
> 答案：ABD
> 解析：C 危险——前端显隐是体验层；服务端必须有独立权威的决策点，两者只是消费同一份事实源。

### 9. （多选）"藏起来的入口，直接调 API 会怎样"答不上来，说明存在哪些风险？（9分）

- A. 水平越权（改个订单号读他人数据）
- B. 垂直越权（普通用户调管理接口）
- C. CSRF 令牌失效
- D. 审计与合规缺口（权限变更无留痕）
> 答案：ABD
> 解析：这三项都是"入口未授权"的直接后果；C 与令牌机制相关，不是授权决策缺失的表现。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 为多租户 SaaS 设计一套"功能权限 + 数据权限"方案（Spring Security 6 语境），说明模型、决策点与防漂移机制。（40分）

> 参考答案：
- 要点1：模型——RBAC 五表（用户/角色/权限/资源 + 关联），权限到操作级（域:资源:动作），租户作为数据域维度而非角色维度；
- 要点2：认证产出——登录把角色展开为 authorities（含 ROLE_ 前缀规范）写进 Authentication/Token claims，Provider 链按凭证类型选择；
- 要点3：垂直决策点——AuthorizationFilter 的 URL 规则 + @PreAuthorize 方法注解双层，规则源统一从权限服务拉取（动态授权 + 缓存 + 变更失效），不发版生效；
- 要点4：水平决策点——MyBatis 拦截器注入 tenant_id/组织范围条件，行级"本人/本部门/全部"翻译为查询条件；敏感操作服务层再校验资源归属（#me.id == #id 类断言兜底）；
- 要点5：角色层级与最小授权——RoleHierarchy 表达继承，默认拒绝 anyRequest().authenticated()，ABAC 类规则（大额双人复核）放策略引擎不塞 URL；
- 要点6：防漂移——权限元数据单一事实源，前端消费 /me/permissions；服务端集成测试锁 200/401/403 断言 + 越权用例进 CI；审计表记录权限变更，定期跑"藏起来的入口直接调用"的攻防回归。
