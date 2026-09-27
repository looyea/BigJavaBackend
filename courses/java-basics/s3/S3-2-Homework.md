# S3-2 反射、注解与动态代理 · 作业

> 不判分，对照参考要点自查。

## 作业 1：反射字段遍历器（必做）

写一个 `dump(Object o)` 方法，用 `getDeclaredFields()` + `setAccessible(true)` 打印对象所有字段（含 private）的 `名字=值`，并递归处理父类字段（`getSuperclass()` 循环）。用一个含 3 层继承的类测试。

**参考要点**：`getDeclaredFields` 不含继承，需 `while(clz!=null){...; clz=clz.getSuperclass();}`；基本类型字段 `f.get(o)` 会自动装箱。

## 作业 2：自定义 @Retry + JDK 代理（必做）

定义 `@Retry(count=3, backoff=100)`（`RUNTIME`、`METHOD`），写一个 `InvocationHandler`：调用被代理接口方法时若抛异常则按 `count` 重试、每次睡 `backoff` ms，全失败则抛出。用 `Proxy.newProxyInstance` 包一个会间歇失败的下载服务跑通。

**参考要点**：`method.getAnnotation(Retry.class)` 读参数；`method.invoke(target,args)` 真实调用；捕获 `InvocationTargetException` 拆出真实异常再判断是否重试。

## 作业 3：复现并修复"自调用事务失效"（必做）

在一个 Spring（或纯手写代理）Service 里，`public void a(){ this.b(); }`、`@Transactional public void b(){...}`。通过外部调用 `a()`，说明为什么 `b()` 的事务不生效，并给出**至少两种**修复：① 注入自身代理 `@Lazy @Autowired Self self; self.b();`；② 拆分 `b()` 到另一个 Bean；③ `AopContext.currentProxy()`。

**参考要点**：`this` 是原始对象非代理对象，未经拦截器；修复核心是"让调用重新经过代理"。

## 作业 4：JDK vs CGLIB 转型实验（选做）

给一个实现了接口的类分别配置 JDK 代理与 CGLIB 代理（`proxyTargetClass` 开关），在调用处 `proxy instanceof Impl` 与 `(Impl) proxy` 观察结果，复现 `cannot be cast to Impl` 并解释。

**参考要点**：JDK 代理对象是 `$Proxy` 实现接口但不是 Impl 子类 → 强转 Impl 失败；CGLIB 代理是 Impl 子类 → 可转。

## 作业 5：注解处理器初体验（选做）

用 `javax.annotation.processing` 写一个最小 APT：扫描标了 `@AutoGetter` 的字段，编译期生成对应 getter 源码（或打印日志证明处理器被触发）。体会它和"运行期反射读注解"的本质区别。

**参考要点**：APT 在编译阶段运行、操作源码模型、生成 `.java`；运行期反射读的是已进字节码的 RUNTIME 注解——时机与产物完全不同。
