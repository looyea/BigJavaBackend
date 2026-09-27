# 作业题 · BeanFactory 与 ApplicationContext

## 作业 1：两种容器实例化时机对比（必做）

分别用 `DefaultListableBeanFactory`（XML/编程注册定义）与 `AnnotationConfigApplicationContext` 加载同一组带构造打印的 Bean：

- 在容器"注册完定义、但还没 getBean"这一刻打断点/日志，观察单例是否已创建
- 记录：BeanFactory 下 `getBean` 才造；ApplicationContext 下 `refresh()` 就造

**产出**：一张"实例化时机对比表"，并说明这对"配置错误何时暴露"的影响。

## 作业 2：制造启动期校验差异（必做，本节核心）

写一个依赖引用了不存在 Bean 的配置类：

1. 用裸 BeanFactory 加载，验证 `refresh`/注册阶段不报错，直到 `getBean` 才抛
2. 用 ApplicationContext 加载，验证启动即抛 `NoSuchBeanDefinitionException`
3. 给该 Bean 加 `@Lazy`，观察 ApplicationContext 下延迟到首次使用才报错

**验收标准**：能用自己的话解释"预实例化=把运行期隐患前移到启动期"的取舍。

## 作业 3：BFPP vs BPP 时机实验（必做）

实现并注册：

- 一个 `BeanFactoryPostProcessor`：修改某 BeanDefinition 的 scope 或属性值
- 一个 `BeanPostProcessor`：在 `postProcessAfterInitialization` 给所有 `OrderService` 类型 Bean 打日志

按启动顺序打印每条日志，验证：BFPP 早于任何业务 Bean 实例化、BPP 包裹每个 Bean 的初始化。

## 作业 4：refresh() 主干时序标注（选做，架构师向）

给 `AbstractApplicationContext.refresh()` 的 13 个方法逐个加注释，标出：哪几步处理"图纸"、哪几步注册"加工器"、哪一步"造单例"、哪一步"发布就绪事件"。再回答：Web 内部组件（如 MVC）在哪个钩子创建，为什么是那里。

## 作业 5：容器能力选型备忘（选做，架构师向）

为一个"内存极度受限的嵌入式网关"和"标准电商中台"分别选择 BeanFactory 还是 ApplicationContext、是否全局懒加载，写出理由（启动校验 vs 内存/冷启动的权衡），并给出对应的配置开关。
