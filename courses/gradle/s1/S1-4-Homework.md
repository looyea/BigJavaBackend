# 与 Maven 互操作及选型（关联） · 作业

## 作业 1：双工具互通验证

**目标**：证明"仓库只有一个，工具各有两个"。

1. Gradle 库工程 `publishToMavenLocal`，纯 Maven 工程依赖它并编译运行（验收：Maven 侧无报错，`mvn dependency:tree` 中 scope 与 api/implementation 翻译一致）。
2. 反向：Maven install 的 1.0.0-SNAPSHOT 被 Gradle 工程消费，体验 `--refresh-dependencies` 前后差异（输出：SNAPSHOT 时间戳 metadata 在两工具下的读取证据）。
3. 错误用例：故意在 Gradle 依赖里写 `latest.release` 直接发布，检查生成 POM 中的版本字段（观察泄漏后果，再用 versionMapping 修复对比）。

## 作业 2：迁移对拍脚本

**目标**：把"产物一致性"做成可自动验收。

1. 对同一源码分别用 mvn package 与 gradle build 出 fat-jar，写脚本 diff 两者的类清单与 META-INF/maven/POM 内容（结果：差异需逐项解释，如 MANIFEST 顺序可容忍、依赖版本不一致不可容忍）。
2. 依赖树对拍：导出两边解析后的 GAV 集合（maven dependency:list vs gradle dependencies 清洗），集合差必须为空或白名单化（验收：脚本进 CI）。

## 作业 3：选型备忘录（个人版）

**目标**：输出一份可复用的团队决策模板。

1. 按 s1-1~s1-4 所学填四维评分表（构建模型/性能/生态/团队），每个分值附证据来源（一次实测输出或一条官方文档链接）。
2. 写"不迁移先优化"清单并实测其中一项（如给现有 Maven 工程加 CI 缓存前后计时），反例自检：结论里是否出现没有机制支撑的"听说更快"。
