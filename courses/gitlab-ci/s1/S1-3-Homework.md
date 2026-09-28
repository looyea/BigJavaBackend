# 与 GitHub Actions 的取舍（关联） · 作业

## 作业 1：同义互译练习

**目标**：把一条 GitLab 流水线逐 Job 翻译成 Actions 等价物。

1. 取 s1-2 的 build→image→deploy 三 Job，改写成 .github/workflows/ci.yml：cache 换成 actions/cache（key 用 hashFiles('**/pom.xml')），artifacts 换成 upload/download（验收：三 Job 语义一一对应表）。
2. 记录两处"无法直译"的细节并解释机制差异（输出：差异清单，至少 2 条，如自动传递 vs 显式下载）。
3. 两边都故意配错缓存 key 一次，对比失败表现的可见性差异（异常体验：哪个更早暴露）。

## 作业 2：双跑去重实验

**目标**：复现并治理 push+pull_request 双流水线。

1. 测试仓库 on 同时配 push 与 pull_request 到 main，从 fork 提 MR，观察流水线数量（输出：双跑截图）。
2. 用 if 条件或拆分触发分支治理成"MR 跑测试、合并后 main 跑构建+发布"，验证每个事件只建一条（验收：事件-Job 矩阵）。
3. 对照 GitLab 的 workflow:rules 写法，写一段小结说明两个平台在去重实现上的差异。

## 作业 3：选型备忘录

**目标**：产出一份给技术委员会的一页决策文档。

1. 以"电商公司、代码不出内网、已在自建 GitLab、想引入开源协作"为背景，给出双平台共存方案（哪些仓在哪、CI 语义如何收敛到 Makefile/脚本层）。
2. 列出成本项：自建 Runner 机器、Actions 分钟费、迁移人日（说明：给出估算方法而非绝对数）。
3. 给出 90 天落地路线与回退条件（结果：决策文档含"何时重新评估"条款）。
