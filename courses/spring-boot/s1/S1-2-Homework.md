# 作业题 · 自动配置与启动流程

## 作业 1：断点走查启动流程（必做）

在 `SpringApplication.run` 内部这几行依次打断点，记录调用栈与当时的对象状态：

1. `SpringApplicationRunListeners listeners = getRunListeners(args)`
2. `prepareEnvironment(...)`
3. `createApplicationContext(...)`
4. `refreshContext(context)`
5. `callRunners(context, applicationArguments)`

**产出**：手写一张六阶段表，标注每阶段结束时"哪些东西已经存在"（Environment / BeanDefinition / 单例 Bean / 端口监听）。

## 作业 2：条件报告逆向分析（必做）

用 `--debug` 启动带 Redis、MyBatis、Security 的工程，从 `ConditionEvaluationReport` 中：

1. 找出 3 条 **matched** 的自动配置，写出它们各自依赖的 classpath 类。
2. 找出 3 条 **not matched** 的配置，写出失败条件表达式。
3. 手工删除某个 starter 依赖，重复实验，确认对应条目从 matched 变为消失，说明原因。

## 作业 3：写一个自己的 starter（必做，本节核心）

实现 `log-mask-spring-boot-starter`，要求：

- 提供 `@ConfigurationProperties(prefix = "bigjava.log-mask")` 配置：`enabled`（默认 true）、`fields`（需脱敏的字段名列表）
- 通过 `AutoConfiguration.imports` 注册自动配置类
- 使用 `@ConditionalOnProperty(prefix = "bigjava.log-mask", name = "enabled", matchIfMissing = true)`
- 暴露一个 `@RestControllerAdvice` 或 `Jackson` 序列化拦截，把配置中的字段值替换为 `***`
- 定义一个 `@ConditionalOnMissingBean` 的默认实现，允许使用方替换

**验收标准**：另一个工程只加依赖 + 配置 `bigjava.log-mask.fields[0]=phone`，无需任何代码即生效。

## 作业 4：制造并修复一次顺序问题（必做）

在作业 3 的基础上，故意让自动配置类 A 使用 `@ConditionalOnBean(MaskProperties.class)`，而 `MaskProperties` 由另一个配置类注册，观察 Bean 未按预期创建；然后用 `@AutoConfigureAfter` 修复，并解释为什么条件判断与实例化时机不同。

## 作业 5：启动耗时归因（选做，架构师向）

用 Async-Profiler 或 `-Ddebug` + 自定义 `BeanPostProcessor` 打印各 Bean 初始化耗时 Top10，给出：

1. 优化前 / 后的启动时间对比
2. 哪些初始化可以改懒加载或异步预热
3. 对应的 K8s 就绪探针参数应如何设定（给出实测数值）
