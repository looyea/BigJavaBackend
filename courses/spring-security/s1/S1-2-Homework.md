# 认证授权模型与权限设计 · 作业

## 作业 1：RBAC 五表建模与越权用例断言

- **目标**：把"角色-权限"从代码里的 if 收敛为数据模型，并用测试锁死越权行为。
- **任务**：建 `user / role / user_role / permission / role_permission` 五表，Spring Security 侧用 `UserDetailsService` 把权限串（如 `order:refund:apply`）装载为 `GrantedAuthority`；接口上以 `@PreAuthorize("hasAuthority('order:refund:apply')")` 守卫。写 MockMvc 测试：普通用户调用退款申请接口断言 403，授权用户断言 200。
- **验收标准**：权限变更只动数据不动代码；越权测试覆盖"未登录 401 / 登录无权限 403"两条路径且全绿。
- **参考解法要点**：登录时一次性把权限聚合成集合放入 `Authentication.getAuthorities()`，避免每次请求回查；注意 `hasRole('ADMIN')` 实际匹配 `ROLE_ADMIN`，权限串建模统一用 `hasAuthority` 可免前缀心智负担（见 [课文](S1-2-Lesson.md) 第一节）。

## 作业 2：动态授权——改权限不发版

- **目标**：体验 `AuthorizationFilter` 决策回调 + 缓存失效的完整闭环。
- **任务**：将 `.anyRequest().access(...)` 换成自定义 `AuthorizationManager`，按 `request URI + method` 查权限映射表；本地 Caffeine 缓存映射表，权限变更时通过 Redis pub/sub 广播事件各节点失效缓存。演示：运行中把某接口权限从 `audit:view` 改为 `admin:view`，不发版验证 403→200 切换。
- **验收标准**：改表后 1 秒内所有节点决策一致；缓存命中路径无 DB 查询（打点日志证明）；广播断连时缓存过期时间兜底生效。
- **参考解法要点**：两级结构——"接口→所需权限"映射与"用户→权限"集合分开缓存；失效走事件驱动 + TTL 兜底，防止消息丢失导致永久脏读。

## 作业 3：数据权限下推评审（书面）

- **目标**：识别"先查全量再内存过滤"的反模式并给出 SQL 层方案。
- **任务**：针对"区域经理只能看本区域订单"需求，评审这段代码：`List<Order> all = orderMapper.selectAll(); return all.stream().filter(o -> o.getRegion().equals(me.getRegion())).toList();`——指出泄漏点（全量数据已出 DB、count 与聚合仍暴露、拖库风险），给出 MyBatis 拦截器自动拼接 `region IN (...)` 条件的下推方案草稿。
- **验收标准**：评审意见能讲清"功能权限归 Spring Security、数据权限归 SQL 条件"的分层依据；下推方案覆盖多角色区域并集与忘记加条件的兜底（默认拒绝）。
- **参考解法要点**：拦截器从 SecurityContext 取当前用户数据范围注入租户/区域条件，与 [Web 安全防护](../../web-defense/s1/S1-3-Lesson.md) 的水平越权防线呼应；单测断言"越权 ID 直接查详情返回空而非他人数据"。
