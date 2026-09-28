# 规则集与门禁策略 · 作业

## 作业 1：搭一条"新代码"质量阈（动手题）

**目标**：理解 Profile / Gate 两层，并配出只卡增量的门禁。

**任务**：
1. 本地 `docker run sonarqube:community` + `sonar-scanner`/`mvn sonar:sonar` 扫一个 Java 项目；
2. 复制一份 "Sonar way" Quality Profile，关掉 2 条你认为噪音大的规则，切给项目；
3. 建一个自定义 Quality Gate，条件只用新代码维度：`new_coverage<80%`、`new_violations>0`、`security_hotspots_reviewed<100%`；
4. 故意提交一段"新代码无测试 + 一个 SQL 拼接"的改动，观察 Gate 失败在哪些指标。

**验收标准**：能截图 Gate 的失败条件；能说清"为什么这些指标只看新代码就能通过而全量口径会一直红"。

**参考解法要点**：先跑测试产 jacoco 报告再扫，否则 new_coverage=0 直接失败；Hotspot 需在 UI 点"Safe/Fix me"复核才算 reviewed。

## 作业 2：把 Sonar 接进 GitLab MR 门禁（工程题）

**任务**：
1. 写 `.gitlab-ci.yml` 的 `sonarqube-check` job，仅在 MR 事件触发，命令含 `-Dsonar.qualitygate.wait=true`；
2. 用 GitLab CI 变量/密钥存放 `SONAR_TOKEN`，解释为什么绝不能把 token 写进仓库文件；
3. 让 job 依赖前置 `mvn verify`（产覆盖率），设计 stage 顺序；
4. 演示一次"Gate 不过 → MR 被 block"的效果，并写一条团队约定：什么情况下允许标记 False Positive。

**验收标准**：流水线日志显示"Waiting for Quality Gate"并据结果成败；token 不出现在任何提交内容里；给出"绕过门禁"的审批流程（谁批、留什么记录）。

## 作业 3：存量债治理方案（分析题）

老项目首扫 20 万问题，领导要求"本月清零"。请写一页反驳+替代方案。**验收标准**：必须包含——为什么"全量红线 + 限期清零"会失败（团队弃用/乱标记/拆函数应试）、Clean as You Code 的正解、存量债按模块分优先级（用技术债雷达 + 调用频率/风险加权）的清理冲刺计划、以及一个可量化的收敛指标（每月新引入问题数为 0 + 存量下降曲线）。
