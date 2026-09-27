# 实际面试题 · 配置体系与 Profile 治理

## 题 1：Spring Boot 的配置有很多来源，它们的优先级是怎样的？

**参考答法**：合并为一条有序 `PropertySource` 链，取值从高到低：命令行 > 环境变量 > 配置中心（`spring.config.import`）> profile 专属 yml > 默认 yml > jar 内默认 > 默认值。记主干即可，重点是"为什么命令行能覆盖 yml"（链首）。

**追问**：`SPRING_DATASOURCE_URL` 这种大写蛇形环境变量凭什么映射到 `spring.datasource.url`？→ Relaxed Binding（松散绑定）。

## 题 2：`@ConfigurationProperties` 比 `@Value` 好在哪？团队里怎么定规范？

**答题要点**：松散绑定、批量绑 POJO、`@Validated` 校验、IDE metadata 提示、可复用可组合。规范：一组相关配置必须收敛成 `@ConfigurationProperties`，禁止业务类散落大量 `@Value`；`@Value` 只用于个别零散值。

**加分**：提到 record + 构造绑定天然不可变、易测。

## 题 3：Nacos 改了配置，线上 Bean 里读到的是旧值，怎么排查？

**结构化回答**：

1. 确认刷新机制：普通单例 Bean 不会因配置中心变更而重新注入，需 `@RefreshScope`（下次访问重建）或用会重新绑定的 `@ConfigurationProperties`。
2. 确认订阅生效：客户端是否与正确的 namespace/group/dataId 建立监听。
3. 确认取值时机：有些值在启动期被读进 `final` 字段或被缓存，刷新不会回灌。
4. 用 `/actuator/env`、`/configprops` 核对当前实际值。

## 题 4：线上如何保证数据库密码不泄露，同时本地开发又能顺畅跑？

**答题要点**：口令绝不进 Git；`application.yml` 用 `${DB_PASSWORD}` 占位；prod 由 K8s Secret / Vault / 云 KMS 注入环境变量；配置中心项加 `{cipher}` 加密；本地用低权限独立库或 `.env`（gitignore）。体现"分环境最小权限 + 密钥与配置分离"的治理思路。

## 高频追问速答

1. profile 能继承/分组吗？→ 能，`spring.profiles.group` 把多个细 profile 归并（如 prod-cn → prod）。
2. 配置中心挂了应用还能启动吗？→ 若用 `optional:` 且有本地兜底默认值则可；否则启动失败。
3. `bootstrap.yml` 还能用吗？→ Boot 2.4+ 不推荐，改用 `spring.config.import`，需兼容时显式开启 `use-legacy-cloud-bootstrap`。
