# 资源抽象、SpEL 与容器扩展点 · 面试题

## 题 1：Spring 为什么要有 Resource 抽象，直接用 File 不行吗？

- File 只认文件系统；应用打包成 jar/war 后资源在包内，`new FileInputStream` 会失败或依赖不确定的工作目录。
- Resource 用统一接口抹平 classpath/file/url/字节数组，配合 ResourceLoader 按前缀自动选实现。
- 加分：点出 `getInputStream()` 才是跨打包安全的读取方式，`getFile()` 在 jar 内不可用。

## 题 2：`${}` 和 `#{}` 有什么区别？

- `${}` 是属性占位符，只从 PropertySource 取值、可带默认值，不做运算。
- `#{}` 是 SpEL，运行时对对象图求值，支持运算、三元、索引、引用 bean 并调方法。
- 加分：`@Value("${port:8080}")` 取配置，`@Value("#{cfg.size*2}")` 算表达式，二者别混用。

## 题 3：SpEL 有什么安全风险？怎么防？

- 把外部输入拼进表达式模板，等于给了攻击者遍历对象图、反射调用方法的能力（表达式注入）。
- 防线是模板固定、外部值只通过 `setVariable` 作为变量传入；必要时用 `SimpleEvaluationContext` 收窄可访问范围。
- 加分：类比 SQL 注入——都是"数据被当成代码执行"，本质是解释器信任了不该信任的输入。

## 题 4：BeanPostProcessor 和 BeanFactoryPostProcessor 分别在什么时候、做什么？

- BeanFactoryPostProcessor 在 BeanDefinition 解析后、实例化前，全程一次，改"定义"（属性值、scope）。
- BeanPostProcessor 对每个 bean 在初始化前后回调，面向"实例"，AOP 代理就在这里织入。
- 加分：放反的后果——改定义放到每 bean 回调里重复低效；包实例放到 BFPP 里根本碰不到实例。

## 题 5：@Autowired、@PostConstruct、AOP 代理分别靠哪个扩展点？

- @Autowired 靠 InstantiationAwareBeanPostProcessor（AutowiredAnnotationBeanPostProcessor）在属性填充阶段完成。
- @PostConstruct 靠 CommonAnnotationBeanPostProcessor。
- AOP 代理靠 AbstractAutoProxyCreator（BeanPostProcessor 的 postProcessAfterInitialization）。
- 加分：串起 bean 生命周期——实例化→属性填充(BPP 前置)→Aware 回调→init(@PostConstruct)→BPP 后置(代理织入)。

## 题 6：想在"容器完全就绪后"做缓存预热，直接放构造函数行吗？

- 不行，构造函数时机太早，依赖可能未注入、其他 bean 未就绪。
- 用 SmartInitializingSingleton（所有单例就绪）或 ApplicationRunner/EventListener(ApplicationReadyEvent)（Boot）。
- 加分：把"启动后一次性任务"与"每 bean 回调"分开，别把预热塞进 BeanPostProcessor 里被放大 N 次。
