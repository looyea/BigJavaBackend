# 资源抽象、SpEL 与容器扩展点 · 作业

### 作业 1：用 Resource 抽象加载多来源配置

- 目标：同一套代码能从 classpath 与文件系统读取配置，打成 jar 后不失效。
- 任务：注入 `ResourceLoader`，用 `getResource("classpath:config/app.yml")` 与 `getResource("file:/etc/app.yml")` 分别加载，判断 `exists()`/`isReadable()` 后再取流；把读到的属性放入自定义 `PropertySource`。
- 验收标准：无前缀时按 classpath 解析；jar 内 `file:` 缺失时优雅降级不抛空指针；不出现 `new FileInputStream` 硬编码路径。
- 参考解法要点：面向 Resource 而非路径；区分 `getURL()` 只读定位与 `getInputStream()` 流式读取，后者才是跨打包安全的方式。

### 作业 2：占位符 vs SpEL 的注入实验

- 目标：亲手验证 `${}` 与 `#{}` 能力差异并规避注入。
- 任务：用 `@Value("${server.port:8080}")` 注入带默认值的属性，用 `@Value("#{orderConfig.batchSize * 2}")` 注入 SpEL 计算值；再写一个 `ExpressionParser` 解析 `T(Math).max(a,b)`，把外部变量通过 `StandardEvaluationContext.setVariable` 传入。
- 验收标准：默认值生效；SpEL 能引用 bean 属性并运算；任何用户输入都只作为变量、不拼进表达式字符串。
- 参考解法要点：演示 `${}` 做 `a*b` 会失败（只取值），而 `#{}` 可以；强调注入防线=固定模板+受控变量。

### 作业 3：写一个计时用的 BeanPostProcessor

- 目标：理解 BeanPostProcessor 的"每 bean 回调"代价与正确用法。
- 任务：实现 `BeanPostProcessor.postProcessAfterInitialization`，为实现了某标记接口的 bean 生成 JDK 代理，方法调用打印耗时；对比把它"对所有 bean 都代理"与"只对标记 bean 代理"的启动耗时差异。
- 验收标准：只对目标 bean 生效；启动日志能体现扫描/代理放大的开销；不在回调里做远程调用或全量反射扫描。
- 参考解法要点：这正是 AOP 织入的缩影；把重活挪到 BeanFactoryPostProcessor 或延迟代理，避免拖慢容器启动。
