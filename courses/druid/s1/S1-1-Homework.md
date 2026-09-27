# Druid 监控与过滤器链 · 作业

## 作业 1：监控台部署与安全加固

**目标**：在本地 Spring Boot 项目集成 Druid 并正确保护监控台。

1. 引入 `druid-spring-boot-3-starter`，配置 `filters: stat,wall`。
2. 启动后访问 `/druid/`，确认未设密码时可无限制访问。
3. 添加 `loginUsername/loginPassword` + `allow=127.0.0.1` 后验证 403 响应。
4. 在 `application-prod.yml` 中彻底禁用监控台：`stat-view-servlet.enabled: false`。

## 作业 2：慢 SQL 发现与优化

**目标**：使用 StatFilter 定位并优化慢查询。

1. 编写一个含 `SELECT * FROM orders WHERE create_time > '2020-01-01'` 的查询（无索引，全表扫描 50 万行）。
2. 配置 `slow-sql-millis=1000`，执行后在 `/druid/sql.html` 中找到该 SQL。
3. 为 `create_time` 添加索引，重新执行，观察耗时下降。
4. 截图对比优化前后的平均耗时和执行次数。

## 作业 3：WallFilter 拦截测试

**目标**：构造三种危险 SQL 验证 WallFilter 拦截效果。

1. `DELETE FROM users`（无 WHERE）→ 应拦截。
2. `SELECT 1; DROP TABLE users` → 多语句注入应拦截。
3. `UPDATE users SET role='admin' WHERE 1=1` → 全表更新应拦截（需配置 `updateWhereNoneCheck`）。
4. 正常 SQL `DELETE FROM users WHERE id=1` 应放行。

**验收**：提交代码与 4 种场景的控制台输出截图。
