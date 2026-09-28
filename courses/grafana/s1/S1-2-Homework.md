# Dashboard as Code、告警与权限 · 作业

## 作业 1：看板 JSON 工程化

**目标**：把一个手工 RED 看板变成 Git 管理的资产。

1. 通过 API 导出上一节做的看板：`GET /api/dashboards/uid/xxx`，只保留 `dashboard` 字段入仓。
2. 删除环境相关字段（id/version/title 前缀），固定 `uid` 与 `title`，datasource 改用 `${DS_PROMETHEUS}` 变量。
3. 配置 file provider 的 provisioning yaml，重启容器验证看板自动出现；UI 改标题后等待 updateInterval 观察被"设回"（结果：证明 Git 是事实源）。
4. 提交 PR 模拟：改一个 rate 窗口 → CI 校验脚本（jq 断言 uid 存在 + schema 合法）→ 合并生效，记录全流程耗时。

## 作业 2：告警规则 provisioned 化

**结果目标**：告警阈值变更只能经 Git。

1. 用 provisioning 的 alerting yaml（或 Terraform grafana provider）定义：错误率 UA 规则 + Slack/Webhook Contact point + 按 team 标签路由 policy。
2. 触发一次越阈流量，验证通知按 policy 到达指定渠道（输出消息截图级描述）。
3. Git 里把阈值 1% 改 2%，验证 5 分钟内线上规则自动更新（说明收敛机制）。
4. 反例检查：同一判定在 Prom rules 也配一份 → 双通知，写出治理约定（指标告警只归 Prom/AM）。

## 作业 3：权限模型演练

**目标**：搭一个"业务团队自治、SRE 兜底"的权限结构。

1. 建 Team：trade-devs、sre；建 Folder：trade、infra，分别绑定 Editor 权限。
2. 创建 Service Account（只授 trade 文件夹 Editor）供 CI 使用；用该 token 同步看板成功、改 infra 失败（验证最小权限）。
3. 用普通账号尝试查看数据源密码，确认仅 Admin 可见（结果记录）。
4. 开启匿名 Viewer 于独立 org，验收：大屏页可看、任何编辑入口不可见、无法访问其他 org 数据源。
