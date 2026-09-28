# Dashboard as Code、告警与权限 · 小测

### 1. Dashboard as Code 的核心价值是？（6分）

- A. 看板更好看
- B. 版本化、可评审、可回滚、跨环境可复制
- C. 查询更快
- D. 不需要 UI 了

> 答案：B
> 解析：看板沦为"手工艺"后的三大痛点——误删无回滚、口径无评审、环境靠人肉搬运。

### 2. Provisioning 方式加载看板的特点是？（6分）

- A. 每次重启丢失
- B. 声明文件放入目录即自动创建/更新对应看板，UI 侧改动可被设回
- C. 只能加载 JSON 不能加载告警
- D. 必须企业版

> 答案：B
> 解析：file provider 监听目录同步；`updateIntervalSeconds` 决定收敛节奏（结果：Git 是唯一事实源）。

### 3. 生产 Grafana 中，"UI 里改好了但 Git 里没有"的问题根因是？（6分）

- A. Grafana bug
- B. 允许对 provisioned 看板做 UI 手改且无定期导出对账（双写漂移）
- C. 缓存问题
- D. 权限不足

> 答案：B
> 解析：解法 = provisioned 看板设固定 UID + CI 定期 fetch 与 Git diff 对账（说明防漂移闭环）。

### 4. Grafana Unified Alerting 与 Prom rules + Alertmanager 的合理分工？（6分）

- A. 二选一，不能共存
- B. 指标硬告警走 Prom/AM；跨数据源（日志+指标）与云监控类走 UA
- C. UA 只能发邮件
- D. Prom 告警必须经 UA 转发

> 答案：B
> 解析：共存关键是"同一判定只在一处配"，且通知端尽量汇聚防双发。

### 5. Grafana 组织内角色权限从低到高排列正确的是？（6分）

- A. Admin < Editor < Viewer
- B. Viewer < Editor < Admin
- C. Editor < Viewer < Admin
- D. 三者平级

> 答案：B
> 解析：Viewer 只读；Editor 可改看板；Admin 管数据源/用户——数据源凭据只有 Admin 可见可改。

### 6. 团队协作授权推荐的最小粒度单元是？（6分）

- A. 给所有人 Org Admin
- B. Folder 绑定 Team + 角色，看板归属文件夹
- C. 每张看板单独设用户列表
- D. 匿名访问

> 答案：B
> 解析：Folder-per-team/domain 是官方主推模型；General 文件夹无法承载授权语义。

### 7. CI 同步看板应使用什么身份？（6分）

- A. 团队 Leader 的个人账号密码
- B. 限定文件夹权限的 Service Account token
- C. admin:admin 默认密码
- D. 不需要身份

> 答案：B
> 解析：人账号进脚本=离职即断+权限过大；SA 可吊销、可限范围（目的：人机权限分离）。

### 8. 以下哪些内容适合纳入 Git 版本管理（多选）？（9分）

- A. 看板 JSON / Jsonnet 源文件
- B. 数据源与告警 Contact point 配置（provisioning yaml/terraform）
- C. 用户个人偏好主题
- D. 告警规则（含阈值与路由 policy）

> 答案：A、B、D
> 解析：C 属个人设置；A/B/D 全部是"环境即代码"的组成部分，改监控必须可追溯。

### 9. 匿名大屏（[auth.anonymous]）的安全要点包括（多选）？（9分）

- A. org_role 固定 Viewer
- B. 匿名 org 的数据源单独隔离，不接生产敏感库
- C. 开启 org_name 指向 Admin org 方便维护
- D. 看板只放聚合指标，隐藏可下钻明细的链接

> 答案：A、B、D
> 解析：C 是重大错误配置——匿名直接获得管理 org 的读权限，等于数据源对外裸奔。

### 10. 简答题：公司 200+ 看板散落在 UI 手工维护，请给出 Dashboard as Code 改造方案与迁移步骤。（40分）

- 要点1：建 dashboards-as-code 仓库，目录=文件夹结构（foldersFromFilesStructure），目的：权限归属与代码结构一致
- 要点2：公共布局抽成 grafonnet（Jsonnet）函数（RED 行、变量声明），结果：新看板 30 行生成，改口径一处生效
- 要点3：现有看板批量导出 API（/api/dashboards/uid/）入仓，看板设固定 UID、链接全部改用 UID 引用
- 要点4：CI 双闸：JSON Schema 校验 + Grafana API 回读 diff 对账，漂移即告警（说明：防"UI 偷偷改"）
- 要点5：权限收敛：回收 Org Admin 到 SRE 少数人，业务团队按 Folder+Team 授 Editor；同步 provisioned 化数据源与告警
- 要点6：迁移灰度：先非核心域试点一个迭代，验收"改阈值走 PR 从提交到生效 <10 分钟"再全量推开

> 答案：见要点
> 解析：考察把工程化流程（版本、CI、评审、权限）完整套到监控资产上的架构能力。
