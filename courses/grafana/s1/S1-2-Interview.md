# Dashboard as Code、告警与权限 · 面试题

## 题 1：你们看板怎么管理？（考工程化意识）

```text
低分答：UI 里建，导来导去。
高分答：Jsonnet/JSON 进 Git + PR 评审 + provisioning/CI 同步 + UID 固定 +
        定期 API 回读对账防漂移（结果：任何一块面板都能回答"谁、何时、为何改的"）。
加分：谈"看板模板库"—— RED 行/中间件行抽公共函数，新服务 5 分钟出标准看板。
```

## 题 2：Grafana 数据源凭据存在哪里？泄露风险点？

- 存 Grafana 后端数据库（API keys 字段静态加密依赖 `secret_key`/encryption 配置）。
- 风险点：Org Admin 可在 UI 直接查看/编辑（所以 Admin 席位要少）；provisioning 文件明文（应走 K8s Secret/Vault 注入环境变量）。
- 补救：数据源侧本身用最小权限账号（Prom 只读、MySQL 只读），即使 Grafana 库被拖也无法写（目的：纵深防御）。

## 题 3：多环境（dev/staging/prod）看板如何只维护一份？

1. datasource 变量（type: datasource）：同一看板运行时选环境数据源。
2. 或 Terraform/grafonnet 参数化生成三份部署，源只有一份。
3. 反例：手工复制三份 JSON 各自演化 → 半年后同名字段口径漂移，事故复盘时"看板 A 与告警 B 数值对不上"（结果：监控可信度崩塌）。

## 题 4：UA（Unified Alerting）的告警为什么要求规则必须有 Folder 归属？

- 权限与路由都挂在 Folder/label 上：无归属 = 无法授权、无法按团队路由。
- 迁移旧看板内嵌告警时，Grafana 强制迁移到 rule folder（说明：告警从"看板附件"升级为"一等资源"）。
- 追问：rule folder 权限给谁？答：通常归 SRE/域 Owner，业务团队 Viewer 可见不可改，防私改阈值。

## 题 5：如何防止"看板越堆越多没人维护"？

- 资产盘点：API 拉全量看板 + 近 30 天访问计数，零访问看板进删除评审（结果数据驱动）。
- 归属强制：每看板 JSON 必须含 `labels: {owner: team-x}`，缺 owner 的 CI 拒绝合并。
- 预算制：新增看板需关联至少一条告警或一个使用场景说明（目的：为"有用"背书）。
- 反例：不做治理 → 3 年后 2000 张图、一半查询引用已下线指标，打开全是 No data，团队转而自建 Excel 监控（劣化循环）。

## 题 6：SSO 接入后为什么还要配 Team-sync？两者关系？

- SSO 解决"谁登录"（身份来源可信），Team-sync 解决"登录后进哪个 Team/拿到什么角色"（授权自动化）。
- 无 Team-sync：新员工每来一人手动加 Team（结果：权限腐化，离职不回收成安全隐患）。
- 落地：IdP 组（ldap/okta group）→ Grafana Team 映射规则，权限跟人随组织走，说明：授权成为流程而非操作。
