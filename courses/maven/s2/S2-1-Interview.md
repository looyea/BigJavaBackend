# 生命周期、插件与打包 · 面试题

## 题 1：`mvn clean package` 时到底执行了什么？

两条独立生命周期按命令行顺序展开：clean 链（pre-clean→clean→post-clean）删 target；default 链走到 package 为止（validate→compile→test→package）。不执行 verify/install——所以 CI 只 package 时覆盖率闸门不生效，这是"本地绿 CI 红"的常见成因之一。

## 题 2：插件的 goal 怎么知道在哪个阶段执行？

三层来源：① packaging 的默认生命周期映射（jar-plugin@package）；② 插件元数据里 goal 自带的默认 phase（@Mojo(defaultPhase)）；③ POM `<executions><phase>` 显式覆盖。诊断命令：`mvn -X` 看执行计划，或 lifecycle-mapping 文档。追问"同阶段两个 goal 谁先"：按 POM 声明顺序。

## 题 3：Spring Boot 嵌套 jar 和 shade fat-jar 的区别与选择？

嵌套 jar：依赖原样放 BOOT-INF/lib，自定义 Loader 组 classpath——保留各 jar 独立性与 SPI/资源边界，支持分层缓存（镜像构建复用）。shade：解包合并成扁平 classpath，同名资源必须 transformer 处理（services/manifest/自动配置 spring.factories 要合并），启动可用标准 Launcher。结论：**应用选 boot repackage；对外 SDK/agent 选 shade+relocation**——两者的坑都常考。

## 题 4：为什么 CI 禁止 -Dmaven.test.skip=true？

它连测试代码编译都跳过：测试代码里引用的 API 变更、编译错误全部被掩盖，合入主干后任何带测试的构建突然爆红；且给了"构建加速"的错觉——编译测试很便宜。合理提速用 `-DskipTests`（仍编译）或分模块/分阶段跑测试。一句话：**skip 编译是放弃校验，不是优化**。

## 题 5：install 与 deploy 的差别？多模块 CI 该跑到哪一步？

install 进本机 ~/.m2（本机构建可见）；deploy 经 distributionManagement 上传私服（全团队可见，release 库不可覆盖、snapshot 按时间戳版本累积）。多模块 monorepo CI 通常 `verify` 即可（产物不出单机），需要给下游流水线复用公共库时才 deploy——deploy 要串行防同版本互踩（结果：发布锁或专用发布流水线）。
