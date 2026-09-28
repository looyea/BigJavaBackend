# Dockerfile 与 Java 镜像优化 · 作业

## 作业 1：缓存排序实验

**目标**：用数据证明"层的顺序"值多少时间。

1. 写两版 Dockerfile：A 版先 `COPY .` 再 `mvn dependency:go-offline`，B 版按最优排序。
2. 修改一行业务代码后分别重复构建 3 次，记录耗时表（输出：A 每次都重下依赖、B 显示 CACHED 的对比）。
3. 写一句团队规约：什么时候 go-offline 会失效（pom 变动）以及多模块项目要 COPY 哪些文件才能保住这层缓存（说明：漏 COPY 子模块 pom 会让依赖层"假缓存"）。

## 作业 2：分层 jar + 多阶段落地

**目标**：把真实 Spring Boot 服务改造成生产级 Dockerfile。

1. pom 开启 `<layers>`，用 layertools extract 拆层，多阶段构建组装最终镜像（验收：镜像内无 javac/mvn，`java -version` 正常）。
2. 连续发版两次（只改代码不改依赖），用 `docker push` 输出观察只推 application 层（结果：记录两次 push 传输字节数对比）。
3. 错误用例：故意把 COPY 层写成整 jar 单层，重复实验对比 push 体积，坐实分层收益。

## 作业 3：瘦身挑战

**目标**：对同一个 1.2GB 镜像完成三步优化并量化。

1. 依次执行：换 jre 基础镜像 → 多阶段 → （可选）jlink/distroless，每步 `docker images` 记录体积（输出：阶梯下降曲线）。
2. 每步后跑冒烟测试（启动+一个接口），任何一步功能异常就回滚并写明原因（异常处理：jlink 漏模块报 NoClassDefFoundError 时如何用 jdeps 补全）。
3. 结论写进 README：最终体积、优化手段清单、遗留风险（如 alpine 的 musl 兼容性检查项）。
