# 小测验 · AOP 与动态代理

> 共 5 题，合计 100 分，≥ 60 分过关。

### 1. Spring AOP 的实现本质是？（20分）

- A. 修改目标类字节码
- B. 代理模式——容器返回的是包了增强逻辑的代理对象
- C. 编译期插入 if 判断
- D. 反射调用私有字段

> 答案：B
> 解析：Spring AOP 是运行期织入，靠代理对象拦截方法调用，而非改字节码（那是 AspectJ 编译期织入）。

### 2. Spring Boot 默认采用哪种代理？触发条件是？（20分）

- A. 总是 JDK 动态代理
- B. 默认 CGLIB（proxy-target-class=true），生成目标类子类
- C. 默认 AspectJ
- D. 不生成代理

> 答案：B
> 解析：Boot 默认 CGLIB，便于按实现类注入；设 proxyTargetClass=false 才回到 JDK 代理（需有接口）。

### 3.（多选）类内部 `this.method()` 自调用导致切面失效，下列哪些是有效解法？（25分）

- A. 把被增强方法拆到另一个 Bean 注入调用
- B. 注入自身代理 `@Lazy Self self` 后经 self 调用
- C. `AopContext.currentProxy()`（需 exposeProxy=true）
- D. 给方法加 final 修饰

> 答案：ABC
> 解析：D 无效甚至相反——final 方法 CGLIB 无法覆盖，反而更糟；ABC 都是让调用重新经过代理。

### 4. 目标类是 `final` 时，最可能的后果是？（15分）

- A. JDK 代理仍可用
- B. CGLIB 无法生成子类代理，增强失败
- C. 自动切换为 AspectJ
- D. 无影响

> 答案：B
> 解析：CGLIB 靠继承目标类生成代理，final 类/方法无法被继承/覆盖。

### 5. 判断题：`@Around` 通知里如果忘记调用 `proceed()`，目标方法仍会正常执行。（20分）

- A. 正确
- B. 错误

> 答案：B
> 解析：`proceed()` 才真正调用目标方法；不调用则目标逻辑被跳过，且吞异常会破坏事务回滚。
