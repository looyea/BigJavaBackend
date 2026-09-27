# 小测验 · GraalVM 原生镜像打包（Boot 工程实践视角）

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. 原生镜像相对普通 JVM 应用最典型的收益是？（20分）

- A. 峰值吞吐一定更高
- B. 启动更快、内存驻留更低
- C. 构建更快
- D. 完全不需要配置

> 答案：B
> 解析：AOT 编译产物启动毫秒级、内存更省；峰值吞吐通常反而低于预热后的 JIT。

### 2. Spring 要在原生镜像里引入 AOT 处理，根本原因是？（20分）

- A. JIT 太慢
- B. IoC/自动配置/条件注解本是运行期动态，而原生镜像要求构建期确定可达代码
- C. 为了删除反射
- D. 为了不用 JVM 语法

> 答案：B
> 解析：AOT 把配置解析、BeanDefinition 固化成生成代码与 RuntimeHints，满足 closed-world。

### 3.（多选）下列哪些"运行期动态特性"在原生镜像里通常需要额外 RuntimeHints 才能正常工作？（25分）

- A. `Class.forName` 反射
- B. JDK/CGLIB 动态代理
- C. `getResource` 读取任意资源文件
- D. 编译期就确定的普通方法调用

> 答案：ABC
> 解析：D 是静态可达，编译器能看到；ABC 属运行期才确定，需 reflection/proxy/resource hints。

### 4. 一个长运行、追求峰值吞吐的核心交易服务，对该不该上原生镜像，合理判断是？（15分）

- A. 一定要上，原生永远更快
- B. 谨慎——AOT 缺 JIT 自适应优化，峰值吞吐可能更差，可评估 CRaC/预热等折中
- C. 上不了
- D. 与是否长运行无关

> 答案：B
> 解析：原生镜像甜点在冷启动/内存敏感场景；长运行高吞吐核心服务常不划算，需权衡。

### 5. 填空题：原生镜像基于 ____-world 假设，运行期才确定的类/资源需通过 `Runtime____` 提前登记，否则会出现 `ClassNotFound`。（20分）

> 答案：closed / hints
> 解析：closed-world + reachability metadata（RuntimeHints）是原生镜像两大核心概念。
