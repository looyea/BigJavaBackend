# 作业题 · 配置体系与 Profile 治理

## 作业 1：属性源优先级实验（必做）

同一工程分别在 `application.yml`、`application-prod.yml`、环境变量 `SERVER_PORT`、命令行 `--server.port` 四处设不同端口，激活 prod，记录最终生效端口并解释链式优先级。用 `curl /actuator/env` 打印属性源顺序佐证。

## 作业 2：配置收敛与校验（必做）

把一段业务里散落的 8 个 `@Value` 重构为一个带 `@Validated` 的 `@ConfigurationProperties` record，补充 `@NotNull/@Min/@Max`；故意配一个越界值，确认启动即失败并给出可读的错误。

## 作业 3：可降级 + 安全的配置架构（必做，架构师向）

为一个电商服务设计配置方案：本地 dev 直接跑、prod 从 Nacos 拉取且 Nacos 不可用时能用本地兜底启动、数据库口令由 K8s Secret 注入。写出 `application.yml` 关键片段（含 `spring.config.import=optional:nacos:`、`${DB_PASSWORD}` 占位、profile 分组），并说明每条如何验证生效。
