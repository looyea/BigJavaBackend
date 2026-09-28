# 资源抽象、SpEL 与容器扩展点

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：能把 Spring 三类"看不见的底层能力"讲清楚并落地——**Resource 抽象**用统一接口屏蔽 classpath/file/url 的差异，让配置、模板、静态资源以同一种方式加载；**SpEL** 是在运行时对对象图求值的表达式语言，用于 `@Value("#{...}")`、条件装配、动态规则，但要认清它与 `${}` 占位符的本质区别（占位符只取属性值、SpEL 能运算与调用方法）；**容器扩展点**是理解 Spring "可插拔"的钥匙——按介入时机区分 `BeanFactoryPostProcessor`（改 BeanDefinition，早于实例化）、`BeanPostProcessor`（包裹每个 Bean 的初始化前后，AOP 代理就在这里织入）、`InstantiationAwareBeanPostProcessor`（注入前干预实例化与属性填充）。识破"用 SpEL 拼用户输入造成表达式注入""BeanPostProcessor 里做重活拖慢启动""把该在 BeanFactoryPostProcessor 改的元数据放到 BeanPostProcessor 做"等坑。

## 一、Resource 抽象：统一加载异构资源

```text
图目的：一套接口抹平 classpath/file/url/字节数组 的差异
Resource：getInputStream/getURL/getFilename/exists
实现族：ClassPathResource、FileSystemResource、UrlResource、ByteArrayResource
典型用途：读配置/模板/证书文件时面向 Resource 而非硬编码路径，便于打包成 jar 后仍可定位
```

```java
// 目的：用 ResourceLoader 按前缀自动选实现，classpath: 与 file: 一套代码通吃
Resource res = resourceLoader.getResource("classpath:config/app.yml"); // 说明：无前缀默认按当前 classpath 解析
try (InputStream in = res.getInputStream()) {                          // 结果：打成 fat-jar 后仍是流式读取，不会因 file:// 失效
    props.load(new InputStreamReader(in, StandardCharsets.UTF_8));
}
// 反例：new FileInputStream("config/app.yml") ❌ 应用打进 jar 后工作目录不确定，线上必炸
```

## 二、SpEL 与 `${}` 占位符：别混为一谈

```text
图目的：${} 只是"取值", #{} 是"表达式求值", 能力天差地别
${db.url}    → PropertySource 里直接取字符串, 不做运算
#{systemProperties['user.home']} / #{config.maxSize * 2} / #{bean.name ?: 'anon'} → 支持索引/运算/三元/调用方法
```

```java
// 目的：注入时区分占位符与 SpEL, SpEL 能引用其他 bean 与做条件计算
@Value("${server.port:8080}")                 // 说明：属性占位符, 带默认值
private int port;
@Value("#{orderConfig.batchSize * 2}")        // 结果：表达式, 运行时对 bean 属性求值并运算
private int doubleBatch;
// 反例：@Value("#{" + userInput + "}") 把外部输入拼进表达式 ❌ 表达式注入, 可读任意对象图执行方法
```

## 三、容器扩展点：按介入时机排布

```text
图目的：扩展点选错阶段, 轻则无效重则死循环
BeanDefinitionRegistryPostProcessor → 动态注册/改写 BeanDefinition(最早, 如 MyBatis MapperScanner)
BeanFactoryPostProcessor           → postProcessBeanFactory 修改已解析的元数据(属性值、scope)
BeanPostProcessor                  → 每个 bean 初始化前后回调(AOP 代理由 AnnotationAwareAspectJAutoProxyCreator 在此织入)
InstantiationAwareBeanPostProcessor → 实例化前 & 属性填充前(Autowired 注入由 AutowiredAnnotationBeanPostProcessor 完成)
```

- **一次性 vs 每 Bean**：`BeanFactoryPostProcessor` 全程只跑一次、面向"定义"；`BeanPostProcessor` 每个 Bean 都回调、面向"实例"。改元数据放前者，做代理/包装放后者，放反了要么重复执行要么根本改不到。

## 四、坑与底线

- **BeanPostProcessor 里别做重活**：它对每个 Bean 都执行，任何扫描/远程调用都会被放大 N 倍拖慢启动。
- **SmartInitializingSingleton / ApplicationRunner 时机**：需要"所有单例就绪后"再触发的收尾逻辑，别用普通 init，用对应回调，避免依赖还没注入完。

## 五、关联课程

Resource 与属性来源服务于容器启动，容器层次见 [BeanFactory 与 ApplicationContext](./S1-1-Lesson.md)；扩展点中的注入回调与 [依赖注入与循环依赖](./S1-2-Lesson.md) 同属 `*BeanPostProcessor` 家族；`BeanPostProcessor` 织入代理正是 [AOP 与动态代理](../s2/S2-1-Lesson.md) 的落地入口。
