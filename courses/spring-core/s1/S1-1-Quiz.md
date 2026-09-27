# 小测验 · BeanFactory 与 ApplicationContext

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. 关于 BeanDefinition 与 Bean 实例，正确的说法是？（20分）

- A. 两者是同一个东西
- B. BeanDefinition 是"图纸"（元数据），Bean 实例是按图纸造出的"成品"
- C. 实例是图纸，定义是成品
- D. BeanDefinition 只在运行期才存在

> 答案：B
> 解析：容器启动早期处理定义，之后按定义实例化出成品对象。

### 2. 与裸 `BeanFactory` 相比，`ApplicationContext` 对单例默认采用什么策略？（20分）

- A. 全部懒加载
- B. 启动时预实例化所有非懒加载单例
- C. 每次 getBean 都新建
- D. 不管理单例

> 答案：B
> 解析：`refresh()` 的 `preInstantiateSingletons` 会预造单例，好处是启动期即暴露装配错误。

### 3.（多选）`ApplicationContext` 在 `BeanFactory` 之上额外提供了哪些能力？（25分）

- A. `MessageSource` 国际化
- B. `ApplicationEventPublisher` 事件
- C. `ResourceLoader` 与 `Environment`
- D. 内置 SQL 解析引擎

> 答案：ABC
> 解析：D 与容器无关；ABC 是 ApplicationContext 相对 BeanFactory 的企业级增强。

### 4. 在 `refresh()` 主干中，`BeanFactoryPostProcessor` 与"预实例化单例"的先后关系是？（15分）

- A. 先预实例化，再跑 BFPP
- B. 先由 BFPP 加工 BeanDefinition（图纸成形），最后才批量造单例
- C. 二者同时
- D. BFPP 在销毁阶段运行

> 答案：B
> 解析：`invokeBeanFactoryPostProcessors` 早于 `finishBeanFactoryInitialization`，所以 BFPP 改的是尚未实例化的定义。

### 5. 判断题：几乎所有企业应用都应优先使用 `ApplicationContext` 而非裸 `BeanFactory`。（20分）

- A. 正确
- B. 错误

> 答案：A
> 解析：ApplicationContext 提供注解驱动、事件、i18n、启动校验等，除极端省内存场景外都应使用。
