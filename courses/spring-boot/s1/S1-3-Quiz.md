# 小测验 · IoC 容器与 Bean 生命周期

> 共 6 题，合计 100 分，≥ 60 分过关。客观题全对得分，主观题按要点命中给分。

### 1. 单个 Bean 同时写了 `@PostConstruct`、`InitializingBean`、`initMethod`，它们的执行顺序是？（20分）

- A. initMethod → afterPropertiesSet → @PostConstruct
- B. @PostConstruct → afterPropertiesSet → initMethod
- C. afterPropertiesSet → @PostConstruct → initMethod
- D. 顺序不确定，取决于字典序

> 答案：B
> 解析：`@PostConstruct`（BP-before 回调）→ `InitializingBean.afterPropertiesSet()` → 自定义 `initMethod`。

### 2. AOP 代理对象是在生命周期的哪一步生成的？（15分）

- A. 实例化（构造器调用）之后立刻
- B. 属性填充阶段
- C. `BeanPostProcessor.postProcessAfterInitialization`
- D. `@PostConstruct` 之前

> 答案：C
> 解析：代理由 `AnnotationAwareAspectJAutoProxyCreator` 在 post-after 生成；这也是 `@PostConstruct` 里 `this` 自调用绕过代理的根因。

### 3.（多选）下列哪些现象与"Bean 生命周期理解不到位"直接相关？（20分）

- A. `@Autowired` 字段运行时为 null
- B. prototype Bean 被单例字段注入后表现出单例语义
- C. 发布时在途请求丢失
- D. `@PostConstruct` 里 `this.txMethod()` 事务不生效

> 答案：ABCD
> 解析：A 是对象脱离容器管理；B 是 prototype 注入时机；C 是销毁回调/graceful 未配好；D 是自调用绕过 post-after 生成的代理。

### 4. 判断题：`BeanFactoryPostProcessor` 能修改的实例是"已经创建好的对象"。（5分）

- A. 正确
- B. 错误

> 答案：B
> 解析：它操作的是 `BeanDefinition`（图纸），发生在实例化之前；改成品是 `BeanPostProcessor`。

### 5. 填空题：要让 Spring Boot 在关闭时先把在途请求处理完，需设置 `server.shutdown=____`，并配合 `spring.lifecycle.timeout-per-____`。（15分）

> 答案：graceful / shutdown-phase
> 解析：`server.shutdown=graceful` 启用优雅停机，`timeout-per-shutdown-phase` 控制每阶段最长等待；还需 K8s 宽限期大于该超时。

### 6. 简答题：说出 Bean 生命周期主干各阶段，并指出 AOP 代理与循环依赖分别在哪一步暴露/处理。（25分）

> 参考答案：
> - 定义注册 → BeanFactoryPostProcessor → 实例化 → 属性填充 → Aware 回调
> - BeanPostProcessor-before → 初始化（@PostConstruct/afterPropertiesSet/initMethod）→ BeanPostProcessor-after（AOP 代理在此生成）
> - 就绪进单例池 → 使用 → 销毁（@PreDestroy/destroy）
> - 循环依赖在实例化与属性填充之间靠三级缓存化解，仅解决单例 setter 注入
