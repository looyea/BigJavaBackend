# Workflow 语法、触发器与 Runner · 作业

## 作业 1：从零写一条 Java CI

**目标**：跑通 checkout→setup-java(缓存)→mvn verify→上传产物完整链。

1. 建公开测试仓放一个双模块 Maven 项目，写 ci.yml：PR 跑测试、merge 到 main 后打 sha tag 构建 jar 并 upload-artifact（验收：两类事件各一条绿色运行）。
2. 记录首次与二次运行的 mvn 下载行数差异，证明缓存生效（输出：对照数据；错误用例：注释掉 cache 再跑一次看退化）。
3. 加 concurrency 组，连续快速 push 三次，观察旧运行被取消（结果：Runs 页截图）。

## 作业 2：触发器矩阵实验

**目标**：亲手复现"双跑"并按事件分工治理。

1. 故意同时配 on: push(main) 与 on: pull_request(main)，从分支提 PR 合并，统计一次变更触发的运行数（输出：双跑证据）。
2. 改造为"PR 只测试、push 才构建发布"，用 job 级 if 验证事件-Job 矩阵正确（验收：合并后仅一条新运行）。
3. 加一个 workflow_dispatch（inputs: 版本号）和一个 schedule（每天一次），手动触发并观察 cron 在托管环境的实际偏差（说明：记录延迟现象与兜底设计）。

## 作业 3：Self-hosted Runner 落地评估

**目标**：给"CI 需要访问内网 Nexus"的场景出方案。

1. 在一台可访问内网的机器注册 self-hosted runner（ephemeral 模式），用多标签 runs-on 把 Job 精确路由过去（验收：标签不匹配时 Job 排队等待的现象记录）。
2. 列出该机器要承担的安全责任清单（补丁、隔离、凭证驻留、并发控制），至少 5 条并各配一条措施（结果：一页 checklist）。
3. 对比同一 Job 在 hosted 与 self-hosted 的耗时与可访问资源差异，给出"哪些 Job 必须自建、哪些留托管"的划分建议。
