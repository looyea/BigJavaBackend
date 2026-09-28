# 流水线模型：Stage/Job/Script 与 Runner · 作业

## 作业 1：从串行到 DAG

**目标**：亲手量化 needs 带来的墙钟收益。

1. 写一条四 Stage 流水线：build-api / build-web（各 sleep 60 模拟）→ test（依赖两个 build）→ deploy，记录总耗时（输出：时间线截图）。
2. 给 test 加 `needs: [build-api]`，再加一个只依赖 build-web 的 smoke 任务，重跑对比（验收：耗时下降且依赖图在流水线页呈 DAG）。
3. 故意把 needs 写成不存在的 Job 名，记录 lint 报错原文（错误用例体验）。

## 作业 2：自建 Docker executor Runner

**目标**：跑通"注册 → tag 路由 → 环境即 image"完整链路。

1. 用 docker 起 gitlab-runner 容器注册到测试项目，配 tags: [java]，concurrent=2（说明：并发与资源限制的关系）。
2. 建两个 Job 分别声明 image maven 与 gradle，用 `java -version` 输出证明"同一 Runner 不同环境"（验收：两个 Job 日志的版本行）。
3. 删除 Job 的 tag 让其落到共享 Runner 或 pending，观察并解释现象（结果：tag 路由的排错直觉）。

## 作业 3：rules 触发矩阵设计

**目标**：为 feature 分支/MR/默认分支/定时四类场景设计一套 rules。

1. 需求：MR 只跑 build+test；默认分支追加 package；定时流水线（夜间）额外跑全量集成测试；其他情况 deploy 永不创建（把规则写成 YAML 并注释每条意图）。
2. 用 CI Lint 与流水线页验证四类触发各创建了什么 Job，输出对照表（验收：矩阵无多余灰按钮）。
3. 给 deploy 加 when: manual + environment，验证只有默认分支流水线出现可点击按钮（异常排查：若按钮出现在 MR 流水线，找出规则漏洞）。
