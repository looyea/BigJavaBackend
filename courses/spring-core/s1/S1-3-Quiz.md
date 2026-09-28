# 资源抽象、SpEL 与容器扩展点 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. Spring 用 Resource 抽象的主要价值是（6分）

- A. 让 Java 支持更多文件类型
- B. 以统一接口屏蔽 classpath/file/url 差异，打包成 jar 后仍能一致加载
- C. 自动压缩资源
- D. 替代 IO 流

> 答案：B
> 解析：面向 Resource 而非硬编码路径，才能在 classpath 与文件系统间切换、fat-jar 内也能定位资源。

### 2. `${}` 占位符与 `#{}` SpEL 的本质区别是（6分）

- A. 没有区别
- B. `${}` 只从属性源取字符串值，`#{}` 是运行时表达式求值，可运算/调用方法
- C. `${}` 更强大
- D. `#{}` 只能取数字

> 答案：B
> 解析：SpEL 支持索引、运算、三元、引用 bean 并调方法；占位符只是属性替换。

### 3. 关于 SpEL 的安全，下列做法正确的是（6分）

- A. 把用户输入直接拼进表达式字符串求值
- B. 表达式模板固定、外部输入只作为受控变量传入，绝不做拼接
- C. SpEL 会自动做沙箱无需关心
- D. 用 SpEL 执行任意反射最灵活

> 答案：B
> 解析：`"#{" + userInput + "}"` 是表达式注入，可遍历对象图执行方法；须固定模板、输入只当变量。

### 4. `BeanPostProcessor` 与 `BeanFactoryPostProcessor` 的关键差异是（6分）

- A. 前者每个 Bean 都回调且面向实例，后者全程一次且面向 BeanDefinition 元数据
- B. 两者完全等价
- C. 后者处理实例、前者处理定义
- D. 都只在关闭时执行

> 答案：A
> 解析：改定义放 BeanFactoryPostProcessor(一次)，包裹实例/织入代理放 BeanPostProcessor(每 bean)。

### 5. AOP 代理对象是在哪个扩展点被织入的（6分）

- A. BeanDefinitionRegistryPostProcessor
- B. BeanPostProcessor（postProcessAfterInitialization）
- C. 构造函数
- D. DispatcherServlet

> 答案：B
> 解析：AbstractAutoProxyCreator 作为 BeanPostProcessor，在初始化后把原始 bean 换成代理。

### 6. `@Autowired` 的属性填充由哪个扩展完成（6分）

- A. InstantiationAwareBeanPostProcessor（如 AutowiredAnnotationBeanPostProcessor）
- B. BeanFactoryPostProcessor
- C. ResourceLoader
- D. SpEL 引擎

> 答案：A
> 解析：注入发生在属性填充前/后，由 InstantiationAware 变体的后处理器完成。

### 7. 需要"所有单例都就绪后再执行收尾"，应选（6分）

- A. 普通 init-method
- B. SmartInitializingSingleton 或 ApplicationRunner
- C. static 代码块
- D. 构造函数里起线程

> 答案：B
> 解析：init 时机过早、依赖可能未齐；SmartInitializingSingleton/ApplicationRunner 保证容器就绪后触发。

### 8.（多选）属于 Spring 容器扩展点的有（9分）

- A. BeanFactoryPostProcessor
- B. BeanPostProcessor
- C. InstantiationAwareBeanPostProcessor
- D. ResourceLoader

> 答案：A、B、C
> 解析：前三者都是按介入时机划分的容器扩展点；ResourceLoader 是资源加载器，不属于 bean 生命周期扩展。

### 9.（多选）关于 SpEL 与占位符，下列说法正确的有（9分）

- A. `${}` 支持调用方法与运算
- B. `#{}` 可引用其他 bean 的属性
- C. SpEL 中用户可控输入必须作为变量而非拼进模板
- D. 占位符从 PropertySource 解析，可带默认值如 `${a:1}`

> 答案：B、C、D
> 解析：A 错，`${}` 只取值不运算；引用 bean/运算是 SpEL 的能力，占位符默认值写法如 `${server.port:8080}`。

### 10. 为框架封装一段"启动时读 classpath 配置 + 按表达式动态计算批次大小 + 在 bean 初始化后统一加监控代理"的需求，请说明分别用哪些 Spring 机制、介入时机与要注意的坑。（40分）

> 参考答案：
- 要点1：资源加载面向 Resource/ResourceLoader，用 `classpath:` 前缀，避免硬编码绝对路径，保证 fat-jar 内可用（10分）
- 要点2：动态计算批次用 SpEL（`#{...}`）而非 `${}`，模板固定、外部输入只作变量，防表达式注入（10分）
- 要点3：加监控代理用 BeanPostProcessor 的 postProcessAfterInitialization，与 AOP 织入同族；BeanPostProcessor 每个 bean 都回调，禁止在其中做重活拖慢启动（10分）
- 要点4：收尾/触发放在所有单例就绪后（SmartInitializingSingleton/ApplicationRunner），而非构造函数或过早 init，避免依赖未注入（10分）
