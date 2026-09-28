# 依赖声明与冲突解决 · 作业

## 作业 1：制造并解决一次真实冲突

**目标**：亲手体验"最高版本优先"与调解可视化。

1. 工程 A 直接依赖 guava 32.1.3-jre，再引入一个传递依赖 guava 28.x 的老 SDK；`gradle :app:dependencies` 记录解析树中箭头标注（输出：`28.x -> 32.1.3-jre` 证据）。
2. 用 constraints 把下限提到 33.x，再加 `resolutionStrategy.force 'com.google.guava:guava:31.1-jre'` 各跑一次，对比三棵树的最终版本（结果：说清三种手段的优先级关系）。
3. 开启 failOnVersionConflict 复现报错，保留报错原文到笔记（错误用例体验）。

## 作业 2：api/implementation 暴露面实验

**目标**：验证"编译期隔离"不是玄学。

1. 库模块把 commons-lang3 声明为 implementation，依赖它的服务模块直接 `import StringUtils` → 编译报错，记录报错原文；改成 api 后通过（验收：两类报错/通过证据截图或文本）。
2. 检查你负责的一个真实二方库：列出其全部 api 依赖，判断每个是否真的外泄到 public 签名，产出降级为 implementation 的候选清单（说明：这是升级冲击面治理的第一步）。

## 作业 3：可重现构建落地

**目标**：把解析结果固化。

1. `gradle build --write-locks` 后修改一个传递依赖版本，再 build 一次，观察是否仍按锁解析（输出：锁生效证据）。
2. CI 上配 `--offline` 构建成功一次（验收：断网可出包；异常场景：锁后新增依赖未更新锁会解析失败，体验并写明团队规约——锁文件必须与脚本同 MR 提交）。
