# 私服 Nexus、mirror 与 settings.xml · 作业

## 作业 1：私服最小可用链路

**目标**：docker 起 Nexus3，跑通代理下载与 deploy。

1. 配 settings.xml mirrorOf=* 指向 Nexus → 删本地仓库缓存后构建，观察 Nexus 浏览页出现代理缓存的 central 构件（输出：缓存命中证据）。
2. distributionManagement 指向 releases/snapshots，`mvn deploy` 一个 demo 库（验收：两库各见其主）。
3. 用错误 server id 再 deploy 一次 → 复现 401 → 修复（错误用例体验）。

## 作业 2：不可变性验证

**目标**：坐实 release 覆盖拒绝与 snapshot 多版本。

1. 同版本 1.0.0 连续 deploy 两次 → 记录第二次 400/409 响应（结果：不可变语义）。
2. 1.1.0-SNAPSHOT deploy 三次 → 列出时间戳版本与 maven-metadata.xml 变化（说明：latest/lastUpdated 语义）。

## 作业 3：应急预案演练

**目标**：私服"宕机"20 分钟也能出包。

1. 停掉 Nexus 容器 → 启用 direct-central profile 构建公共模块成功、私有模块失败（输出：影响面清单）。
2. 用 `-pl '!shop-internal-sdk'` 跳过私有依赖模块出关键服务包（演练记录耗时）。
3. 写 1 页 runbook：开关、范围、恢复后回收动作。
