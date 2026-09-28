# App of Apps、镜像升级与自动回滚 · 小测

### 1. App of Apps 模式的本质是（6分）

- A. 一个应用拆成多个 Argo 实例
- B. 用根 Application 调和创建/更新目录下所有子 Application，应用清单本身也 GitOps 化
- C. 多个 Git 仓合并
- D. 应用间依赖编排语言

> 答案：B
> 解析：递归管理——apps/prod 目录里每个 yml 是一个应用定义，根应用负责让它们收敛（A/C/D 均非其语义）。

### 2. 根模式 + prune 的最大风险是（6分）

- A. 渲染变慢
- B. 误删目录中一个子应用 yml 会被级联删除整个应用
- C. RBAC 失效
- D. 镜像拉取失败

> 答案：B
> 解析：删声明=删实体的递归放大；分根、finalizer 与子应用独立 project 是标准缓释（错误做法：全公司一个大根）。

### 3. Argo CD Image Updater 的工作方式是（6分）

- A. 重新构建镜像
- B. 发现 registry 新镜像后写回 manifests（改 tag/开 MR），由同步机制落地
- C. 直接 kubectl set image
- D. 轮询 Pod 状态

> 答案：B
> 解析：它只改 Git 期望态不碰集群——"事实源仍是 Git"的纪律保持；C 会造成漂移（Image Updater 绝不会这么做）。

### 4. allow-tags/ignore-tags 的作用是（6分）

- A. 加速扫描
- B. 限定哪些镜像 tag 有资格被提升，防止 dev 构建直入生产
- C. 控制并发同步
- D. 镜像漏洞过滤

> 答案：B
> 解析：晋级门禁的镜像侧表达（如只允许 ^v\d+\.\d+$ 与 stable）；漏洞过滤是扫描器职责，D 是概念混淆。

### 5. 合规要求高的行业，镜像写回推荐姿势是（6分）

- A. 直接 push main + automated
- B. 写回开 MR，人/流水线批准后合并生效
- C. 关闭自动同步，纯手工
- D. 让开发本地改生产 values

> 答案：B
> 解析：保留"每次生产变更都有审批记录"的 Git 形态（A 把门禁降为 tag 正则；C 放弃自动化收益；D 直接违反 GitOps）。

### 6. UI 上直接点 Rollback 后必须补的动作是（6分）

- A. 重启 Argo
- B. 把 manifests 仓 revert 到对应旧 commit，恢复 Git=集群一致
- C. 删除应用重建
- D. 通知镜像仓删新镜像

> 答案：B
> 解析：不补 Git 侧回退，下一次 selfHeal/同步会按新期望态又滚回坏版本——二次事故的经典机关（异常场景高频考点）。

### 7. 真正"敢自动"的发布门禁组合是（6分）

- A. 同步重试次数调高
- B. 真实 readiness 健康评估 + 金丝雀放量 + 指标阈值自动 abort/回滚 + 冷却窗
- C. 只要 CI 测试绿
- D. 只靠人工盯盘

> 答案：B
> 解析：四件套缺一不可；A 重试的是坏版本（越重试越糟），C/D 不构成生产级自动止损。

### 8. 关于 digest 与 tag 晋级，说法正确的有哪些（多选）（9分）

- A. 同一 digest 跨环境复制比"每环境重新 build"更可追溯
- B. promote 机器人复制 digest 到 prod overlay 是推荐的晋级形态
- C. 用浮动的 latest tag 晋级风险最大
- D. tag 与 digest 完全等价

> 答案：ABC
> 解析：D 错——tag 可被覆盖重指向，digest 内容寻址不可变；staging 验证过的 digest 原样进 prod 才证明"测的就是发的"。

### 9. 哪些现象指向"Helm 渲染非幂等导致的 diff 抖动"（多选）（9分）

- A. 应用周期性 OutOfSync 且 diff 只在注释/时间戳字段
- B. 每次渲染结果包含当前时间或随机数
- C. Pod 全部 CrashLoopBackOff
- D. 无人为改动时 Argo 仍持续 apply

> 答案：ABD
> 解析：C 是运行时故障与渲染抖动无关；A/B/D 是"期望态自己会动"的典型证据（异常处置：固定化取值或改 Kustomize）。

### 10. 为电商大促设计"生产镜像晋级+自动回滚"链路，写出至少 4 个关键环节。（40分）

- 要点1：CI 出 sha 不可变 tag+漏洞扫描门禁，写回 staging 走 MR 自动合并（说明：staging 与 prod 权限分 project）。
- 要点2：晋级以 digest 为单位：staging 冒烟+压测通过才由机器人提 prod MR，值班审批（结果：可追溯链）。
- 要点3：prod 发布用 Rollouts 金丝雀 5/25/50/100，Analysis 接 Prometheus 错误率与 P99 阈值，超标自动 abort。
- 要点4：回滚主路径=git revert 同步回旧态；UI rollback 仅应急且 24h 内强制补 Git；冷却窗防抖动期连环回滚。
- 要点5：大促冻结窗口策略（protected branch+变更审批），事后全链路演练复盘一次回滚真实性。

> 答案：见要点
