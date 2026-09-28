# 增量构建、构建缓存与 Daemon 提速 · 作业

## 作业 1：增量失效现场还原

**目标**：现场还原两类增量异常——该重算没重算，与本应跳过却被跳过。

1. 写一个读 `System.getProperty('env')` 却未声明 inputs 的任务，切换 -Denv 重跑 → 观察到仍 UP-TO-DATE（错误用例：过期产物），补 `inputs.property` 后复跑验证重算（验收：两次输出矩阵对比）。
2. 故意在任务输出里写入当前时间戳，连续两次 build 观察缓存永远不命中，`--info` 记录 "is not up-to-date because its output has changed" 原文（输出：指纹被动态内容污染的直接证据）。

## 作业 2：本机 + 远程缓存

**目标**：搭一个最小 HTTP 构建缓存并量化收益。

1. 本机开 local cache，记录 `gradle clean build` 前后耗时与 `BUILD FAILED/success` 下的缓存条目数（结果：clean 重建提速百分比）。
2. 用 nginx 或 gradle 官方 generic http cache 起远程节点，两台机器（或两个用户目录）共享：A 机 push、B 机只拉，B 首次全量对比二次命中（验收：B 机日志出现 "Loaded cache entry for task ..."）。
3. 把 push 条件改为仅 CI 环境变量存在时开启，说明为什么个人机 push 是反例（一句话写进注释）。

## 作业 3：配置缓存迁移演练

**目标**：在一个含老脚本的工程上开启配置缓存。

1. `-Dorg.gradle.configuration-cache=true` 跑一次，收集全部 "configuration cache problems" 报告条目（输出：问题清单）。
2. 逐类修复：Project 引用泄漏改 providers、create 改 register、顶层 getenv 改 -P 属性（每类至少体验一种报错与修法）。
3. 记录开关前后配置期耗时（--profile 的 CONFIGURING 行），形成一页组内推广收益数据。
