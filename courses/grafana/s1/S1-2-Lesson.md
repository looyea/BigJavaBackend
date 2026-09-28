# Dashboard as Code、告警与权限

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：掌握看板 JSON/Provisioning 版本化管理、Grafana 统一告警规则组织，以及组织/文件夹/RBAC 权限模型。

## 一、Dashboard as Code：看板是代码不是手工活

```text
问题：手点出来的看板 = 无版本、无评审、环境间靠"导出 JSON 再手改"搬运 →
      误删无法回滚（真实事故：值班改看板删了生产 Row，找不回原查询）。
方案：看板 JSON 进 Git，PR 评审后由 CI 同步 —— 与代码同等对待。
```

```yaml
# 目的：Provisioning 声明式加载（grafana/provisioning/dashboards/*.yaml）
apiVersion: 1
providers:
  dashboards:
    folder: trade                # 结果：JSON 落此目录即自动创建/更新看板
    type: file
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true   # 说明：目录结构 = 看板文件夹结构
```

- 工具链：`grafonnet`（Jsonnet 生成 JSON，复用函数避免复制粘贴）、`grafana-dashboard-fetch`、CI 里 `jq` diff 校验。
- 环境差异用 JSON 里的 `__inputs` / 变量 default（datasource 变量）解决，禁止两份 JSON 分叉维护。

## 二、统一告警（Unified Alerting）

```text
模型：Data source query（可 Mixed）→ 判定条件表达式 → 通知模板 → Contact point → Policy 路由。
与 Prom rules 分工：指标硬告警留在 Prom/AM；跨源（日志+指标）、云数据源告警用 Grafana UA。
```

```text
规则组织三件套（对应 Prom 的 for/labels/annotations）：
- Evaluate every / for        → 评估周期与持续判定
- Label selectors + Folder    → 路由与归属（policy tree 按 label 匹配 contact point）
- Annotations (summary/desc)  → 通知渲染模板，可嵌 {{ $values }} 表格
验收：规则本身也在 Git（provisioning/Alerting 的 yaml 或 terraform），改阈值走 PR。
```

## 三、组织与权限模型

```text
层级：Installation → Organization → Folder/Team → Dashboard。
角色（Org 内）：Viewer（看）< Editor（改看板）< Admin（管数据源与用户）。
细粒度：Folder 上绑 Team + 角色（如 SRE-Team 对 infra 文件夹 Editor，对 finance 只 Viewer）。
服务账号：API key / Service Account 挂到具体文件夹，给 CI 同步看板用（目的：机器人与人的权限分离）。
```

- 反例 1：全公司给 Admin"省事" → 数据源密码可被任意用户查看编辑（安全事故）。
- 反例 2：看板放 General 文件夹 → 无法做文件夹级授权，删除连带丢权限归属。
- 企业功能：SSO（LDAP/OAuth）、Team-sync 对接组织架构、Report 邮件定时快照。

## 四、匿名与嵌入场景

```ini
; 目的：大屏投放（车间/作战室）允许只读匿名访问
[auth.anonymous]
enabled = true
org_role = Viewer          # 结果：未登录只能看，不能改任何对象
; 错误配置：org_name 指到含生产数据源的 Admin org → 匿名变管理员
```

- 嵌入第三方系统用 share 链接（snapshot 注意脱敏）或 iframe + allow_embedding。

## 五、关联技术

- Terraform provider "grafana"：数据源、文件夹、告警联系人都可 IaC 化（比纯 provisioning 更适合多云管 Grafana Cloud）。
- 看板 JSON Schema（`dashboard.schema.json`）+ CI 校验，防手改 JSON 引入不兼容字段。
- 与 Prometheus 章节呼应：告警"判定在哪算"决定链路归属，通知端建议全司统一到一个 AM/UA。
