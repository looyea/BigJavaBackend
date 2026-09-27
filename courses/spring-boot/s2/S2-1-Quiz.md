# 小测验 · 配置体系与 Profile 治理

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. 下列配置来源中，默认优先级最高的是？（20分）

- A. jar 内 `application.yml`
- B. 操作系统环境变量
- C. 命令行参数 `--server.port`
- D. profile 专属 `application-prod.yml`

> 答案：C
> 解析：命令行排在属性源链首，能覆盖环境变量与所有 yml。

### 2.（多选）关于 `@ConfigurationProperties` 与 `@Value`，正确的有？（25分）

- A. `@ConfigurationProperties` 支持松散绑定与批量绑定到 POJO
- B. `@Value` 天生支持 IDE 配置提示与 JSR-380 校验
- C. 一组相关配置应收敛为 `@ConfigurationProperties`，而非散落一堆 `@Value`
- D. `@ConfigurationProperties` 配 `@Validated` 可在启动期快速暴露非法值

> 答案：ACD
> 解析：B 错，`@Value` 无 metadata 提示、校验需手动；ACD 均为工程最佳实践。

### 3. 判断题：`spring.config.import=optional:nacos:...` 中的 `optional:` 表示该配置源缺失时不阻断启动。（5分）

- A. 正确
- B. 错误

> 答案：A
> 解析：`optional:` 让源读不到也不报错，用于"本地可跑、线上才有配置中心"的过渡。

### 4. 填空题：Nacos 上的配置热更新要能被业务 Bean 读到，通常给 Bean 加 `@________`（重建作用域），或使用会重新绑定的 `@________`。（20分）

> 答案：RefreshScope / ConfigurationProperties
> 解析：刷新靠"重建 Bean/重新绑定"，而非直接改字段。

### 5. 简答题：设计一套电商服务多环境（dev/test/prod）+ 密钥安全 + 配置中心故障可降级的配置方案要点。（30分）

> 参考答案：
> - 公共配置进 application.yml，环境差异进 application-{profile}.yml，用 spring.profiles.active/环境变量切换
> - 配置中心用 spring.config.import=optional:nacos: 接入，本地保留兜底默认值实现降级可启动
> - 密钥不进 Git，用 ${占位符} 由 K8s Secret / Vault / 云 KMS 注入，可选 {cipher} 加密
> - 相关配置收敛为带 @Validated 的 @ConfigurationProperties，启动即校验非法值
