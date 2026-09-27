# 作业题 · Spring Boot 定位与起步

> 全部为动手题，完成后把关键代码与运行截图/日志贴进你的学习笔记。预计总耗时 3 小时。

## 作业 1：裸 Spring 与 Boot 的体感对比（必做）

分别用两种方式实现同一个 `/hello` 接口：

1. 传统方式：`web.xml` + `applicationContext.xml` + 外置 Tomcat 9 部署 war
2. Boot 方式：`start.spring.io` 生成工程

要求输出一张对比表，至少包含：文件数量、需要显式声明的依赖个数、从空目录到接口可访问的耗时、部署产物形态。

**验收标准**：能用自己的话说清 Boot 到底"省掉了哪几件事"。

## 作业 2：证明包位置会杀死你的扫描（必做）

在同一个工程里做两次实验：

- 实验 A：启动类放在 `com.demo.app`，Controller 放在 `com.demo.web`，访问接口，记录现象与报错。
- 实验 B：把 Controller 移到 `com.demo.app.web`，再次运行，记录现象。

然后给出第三种解法：不移动类的位置，仅通过注解让实验 A 的配置正常工作。

**思考题**：第三种解法在大型多模块项目里有什么隐患？

## 作业 3：亲手验证 `@ConditionalOnMissingBean` 的让位规则（必做）

工程引入 `spring-boot-starter-data-redis`，然后：

1. 不写任何配置，注入 `StringRedisTemplate`，打印它的实现类名。
2. 自己定义一个 `@Bean RedisTemplate<String, String>`，返回一个自定义的 `nameSerializer` 实例。
3. 再次打印，确认容器里生效的是哪一个，并解释原因。

**验收标准**：能说出 Boot 的自动配置为什么"永远排在用户配置之后"。

## 作业 4：配置优先级五连覆盖（必做）

在 `application.yml` 中设置 `server.port: 8081`，然后依次叠加：

| 序号 | 手段 | 期望结果 |
| --- | --- | --- |
| 1 | 仅 `application.yml` | 8081 |
| 2 | 追加 `application-dev.yml` 并激活 dev | ？ |
| 3 | 追加 JVM 参数 `-Dserver.port=8083` | ？ |
| 4 | 追加环境变量 `SERVER_PORT=8084` | ？ |
| 5 | 追加命令行参数 `--server.port=8085` | ？ |

每步实际运行并记录最终端口，最后给出你自己的优先级结论，并与官方文档比对。

**注意**：第 2 步如果 profile 文件与主文件都存在同名 key，行为可能与你直觉不同，请以实测为准。

## 作业 5：打开自动装配的黑盒（必做）

用以下任一方式导出"哪些自动配置生效了、哪些没生效、没生效的原因"：

- 启动参数 `--debug`（等价于打开 `ConditionEvaluationReportLoggingListener` 的 DEBUG 日志）
- 暴露 Actuator 的 `/actuator/conditions` 端点（需 Boot 3.x 以上，注意安全暴露策略）

要求：从报告中找出 3 条 **未生效** 的自动配置，并说明分别缺少哪个类或哪个配置项。

## 作业 6：交付一个自包含产物（必做）

把作业 3 的工程打包为可执行 jar，并在 **没有安装 Tomcat** 的机器（或纯净 Docker 容器）上运行起来。要求：

1. 提供 `Dockerfile`（提示：基础镜像 `eclipse-temurin:21-jre`）
2. 说明可执行 jar 内部 `BOOT-INF/classes` 与 `BOOT-INF/lib` 的作用
3. 解释 `java -jar` 为什么能启动一个 web 服务——入口是谁？

## 作业 7：架构师视角的选型论述（选做）

假设你负责一个新建的电商中台，团队里有人主张"不用 Boot，回到手写 XML 以获得完全可控的装配过程"。请写 300 字以内的技术决策意见，包含：

- Boot 带来的具体收益与具体风险各 2 条
- 你如何在项目中约束"约定失效"的风险（给出可执行的团队规范）
