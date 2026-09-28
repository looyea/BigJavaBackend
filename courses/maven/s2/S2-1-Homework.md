# 生命周期、插件与打包 · 作业

## 作业 1：生命周期观察器

**目标**：眼见为实地看到阶段顺序。

1. 用 exec-maven-plugin 在 initialize/process-test-classes/verify 三阶段各绑一句 echo。
2. `mvn verify` 运行，记录输出顺序与阶段交错（输出：一条完整时间线）。
3. 解释为什么 process-test-classes 在 test 之前（说明：测试资源处理先于测试执行）。

## 作业 2：两种可执行 jar 对比

**目标**：同一工程产出 repackage 与 shade 两种包并实测。

1. 同一 Spring Boot 工程分别用 repackage（带 layers）与 shade（不配 transformer）打包。
2. shade 版运行观察 SPI 丢失报错（错误用例复现）→ 加 ServicesResourceTransformer 修复重测。
3. `unzip -l` 对比两版结构差异，写一页"嵌套 vs 扁平"说明（验收：能画出 BOOT-INF 结构图）。

## 作业 3：CI 的 skip 语义审计

**目标**：杜绝流水线里的隐性风险。

1. 在 CI 配置里找 `-Dmaven.test.skip`，改成 `-Pquick` profile 明确语义（只跳 IT 不跳 UT）。
2. 让测试代码引用一个不存在的方法，用 maven.test.skip 构建"成功"（复现掩盖编译错误的危害）→ 恢复后构建失败即审计生效（结果：风险可视化）。
