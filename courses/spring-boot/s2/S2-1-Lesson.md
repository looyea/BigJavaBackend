# 配置体系与 Profile 治理

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：说得清一份配置从哪些源来、谁覆盖谁；能把 `@ConfigurationProperties` 与散落的 `@Value` 做正确的工程取舍；能设计一套多环境 + 配置中心 + 密钥的治理方案。

## 一、配置的本质：一条有序的属性源链

Boot 把所有来源合并成一条 `PropertySource` 链，`Environment.getProperty` 从**高优先级往低**找，先命中者胜。优先级从高到低（记主干即可）：

```flow
命令行参数 > 操作系统环境变量 > 配置中心(spring.config.import) > profile 专属 application-{profile}.yml
> 默认 application.yml > jar 内默认 > @SpringBootTest 的 properties > 随机值 random.* > 默认值 DefaultProperties
```

- **为什么命令行能覆盖 yml**：它排在链首。`--server.port=9090`、`-Dserver.port=9090` 都走这里。
- **profile 何时定**：`spring.profiles.active` 本身可来自命令行/环境变量，且解析早于 profile 专属文件加载——所以你能用 `--spring.profiles.active=prod` 激活 `application-prod.yml`。

## 二、外部化配置的四种落地形态

| 形态 | 位置 | 用途 |
| --- | --- | --- |
| jar 内 `application.yml` | 打包进制品 | 默认值、与代码强相关的配置 |
| jar 外同名文件 | `./config/` 或 `./` | 不改 jar 即可覆盖（ConfigTree/卷挂载常用） |
| 环境变量 | `SERVER_PORT`、`SPRING_DATASOURCE_URL` | 容器/K8s 注入（**Relaxed Binding：大写蛇形自动映射到小写点分**） |
| 配置中心 | Nacos/Apollo/Consul，经 `spring.config.import` | 动态、多环境集中治理 |

> 特别注意：K8s 里用 ConfigMap 挂载成"一个 key 一个文件"时，用 `spring.config.import=optional:configtree:/etc/config/` 能整目录读入，省去逐个 env 映射。`optional:` 前缀让该源缺失也不报错，这对"本地能跑、线上才有配置中心"的过渡期很关键。

## 三、`@ConfigurationProperties` vs `@Value`

| 维度 | `@ConfigurationProperties` | `@Value` |
| --- | --- | --- |
| 绑定方式 | 松散绑定 + 批量绑定到 POJO | SpEL/占位符，逐个字段 |
| 校验 | 配 `@Validated` + JSR-380 | 需手动 |
| IDE 提示 | 有（生成 metadata） | 无 |
| 适用 | 一组结构化配置 | 单个零散值 |

**工程准则**：一个功能相关的配置**一律收敛成 `@ConfigurationProperties` POJO**，别在业务类里散落几十个 `@Value`。这也是写 starter 的标准姿势。

```java
// 例子目的：一组结构化配置收敛成 @ConfigurationProperties POJO，并配 JSR-380 校验（启动即暴露错配）
@ConfigurationProperties(prefix = "bigjava.order")   // 把 bigjava.order.* 批量绑定到本 record（松散绑定）
@Validated                                          // 开启校验：绑定后跑 Bean Validation
public record OrderProps(
    @NotNull Integer defaultTimeoutSec,             // 缺失→ 启动报 NotNull 违反
    @NotEmpty List<String> channels,                // 空列表→ 启动报 NotEmpty
    Risk risk) {                                    // 嵌套结构对应 bigjava.order.risk.*
    public record Risk(@Min(0) @Max(100) int threshold) {} // threshold 超范围会被拦
}
// 正确使用结果：配 bigjava.order.default-timeout-sec=30 等合法值时正常启动，getter 拿到绑定好的对象
// 错误用法：把 threshold 配成 200（>100）→ 启动即抛 BindValidationException（快速失败，优于运行期拿错值）
// 错误用法：忘记 @EnableConfigurationProperties(OrderProps.class) 又不加 @ConfigurationPropertiesScan→ Bean 未注册→ 注入处 NoSuchBeanDefinitionException
```

用 `@EnableConfigurationProperties(OrderProps.class)` 或在 `@ConfigurationPropertiesScan` 下自动注册。

## 四、多环境与 Profile 的治理红线

- **环境差异只进配置、不进代码**：严禁 `if (env == "prod")` 这种分支散落。
- **profile 分层**：`application.yml`（公共）+ `application-{dev,test,prod}.yml`（差异）；用 `spring.profiles.group` 把 `prod-cn`/`prod-sg` 归到 `prod` 之上做地域细分。
- **配置中心 + 本地兜底**：`spring.config.import=optional:nacos:...`，让网络/配置中心故障时仍能读到本地默认启动（`optional:` 的作用）。
- **动态刷新**：Nacos/Apollo 的值变更要能被 Bean 读到，需 `@RefreshScope`（重建 Bean）或改用 `@ConfigurationProperties`（Boot + spring-cloud-context 会重新绑定）。理解"刷新靠的是重新绑定/重建，不是热改字段"。

## 五、密钥怎么放

绝不明文进 Git。分层做法：本地用环境变量、线上用 K8s Secret / Vault / 云 KMS；`application.yml` 里写 `${DB_PASSWORD}` 占位，值由环境注入。Boot 也支持 `{cipher}` 加密配置（jasypt 或配置中心自带加解密）。

## 六、动手验证

1. 用 `--server.port` 与 `application.yml` 同时设端口，验证命令行胜出；再查 `Actuator /env` 看优先级顺序。
2. 写一个带 `@Validated` 的 `@ConfigurationProperties`，故意把 `@Max(100)` 的 threshold 配成 200，观察启动即失败（快速暴露错配，优于运行期 NPE）。
3. 用 `SPRING_DATASOURCE_URL` 环境变量验证 Relaxed Binding。

## 七、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 配置改了不生效 | 改的是配置中心但 Bean 无 `@RefreshScope`；或属性源优先级判断错（被更高温度的 env 覆盖） |
| 本地能跑线上崩 | 配置中心源没加 `optional:`，或密钥只在某环境注入 |
| `@Value` 拿不到值报占位符未解析 | 属性源里确实没有，且没写默认值 `:default` |
| profile 没激活 | `spring.profiles.active` 被更高优先级源覆盖成别的值 |

## 八、关联技术栈

- **框架层**：Spring Framework `Environment`/`PropertySource`、Spring Cloud Context（`@RefreshScope`）
- **中间件层**：Nacos/Apollo 配置中心、`spring.config.import`
- **云原生层**：K8s ConfigMap/Secret、configtree、Relaxed Binding
- **可观测层**：Actuator `/env`、`/configprops`
- **安全层**：Vault / 云 KMS / `{cipher}` 加密配置
