# 扩展模型与条件执行

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：能画出 Jupiter 扩展回调的执行顺序，用 `ParameterResolver` 写一个注入测试参数的小扩展，掌握 `@EnabledOnOs`/`@EnabledIf` 等条件执行手段与 Tag 过滤的分工，并理解 `@RegisterExtension` 相比 `@ExtendWith` 的可配置优势。

## 一、扩展是什么：统一的生命周期钩子 API

JUnit 4 时代横切能力散在 Rule/Runner/RunListener 三套机制里；Jupiter 收敛为一个 `Extension` 标记接口 + 一组可选回调 SPI：

| 你实现的接口 | 时机 | 典型用途 |
|--------------|------|----------|
| BeforeAll/AfterAllCallback | 类级前后 | 起停容器、连接池 |
| BeforeEach/AfterEachCallback | 每用例前后 | 清数据、临时目录 |
| ParameterResolver | 注入方法参数 | 传 Mockito mock、TempDir |
| InvocationInterceptor | 包裹任意调用 | 计时、重试、事务包装 |
| TestExecutionListener | 引擎级事件 | 报告、埋点（platform 层） |

Mockito 的 `@ExtendWith(MockitoExtension.class)`、Spring 的 `SpringExtension`、Testcontainers 的 `@Testcontainers` 全是这套 API 的用户——看懂扩展就看懂了 JUnit 生态。

## 二、两种注册方式与执行顺序

```java
// 目的：@RegisterExtension 注册为字段，可构造器传参、可声明顺序、可条件启用
class DbIT {
    @RegisterExtension
    static final DatabaseExtension DB = DatabaseExtension.builder()
        .image("mysql:8.0")          // 说明：配置化能力是 @ExtendWith（只能传 Class）做不到的
        .reuse(true)
        .build();                    // 结果：static 字段级容器型扩展整类只启动一次，实例字段则每用例重建
}
```

执行顺序规则：类级 `@ExtendWith` 在上、`@RegisterExtension` 静态字段按声明序其次、实例字段最后；After 回调**逆序**执行（栈式收口）。顺序假设别写死在业务断言里——需要强序时用 `@Order`/`ExtensionAPI.after(...)` 显式声明。

## 三、写一个最小 ParameterResolver

```java
class RandomPortExtension implements ParameterResolver {
    @Override
    public boolean supportsParameter(ParameterContext pc, ExtensionContext ec) {
        return pc.getParameter().getType() == int.class                 // 目的：supports 判断要精确
            && pc.isAnnotationPresent(RandomPort.class);                // 说明：靠自定义注解圈定，防止劫持所有 int 参数（反例）
    }
    @Override
    public Object resolveParameter(ParameterContext pc, ExtensionContext ec) {
        return findFreePort();                                          // 结果：测试方法声明 @RandomPort int port 即自动注入
    }
}
```

`ExtensionContext` 有父子层级（ENGINE→CLASS→METHOD），`getStore(ExtensionStore.class)` 的 Namespace 机制就是扩展跨回调传状态的正确姿势——别用扩展实例的裸字段，并行执行时会串数据。

## 四、条件执行：跳过比失败更需要理由

- 平台类：`@EnabledOnOs(MAC)`、`@EnabledOnJre(17)`、`@EnabledForJreRange`；
- 配置/属性类：`@EnabledIfSystemProperty(named="it", matches="true")`、`@EnabledIfEnvironmentVariable`；
- 表达式类：`@EnabledIf("#env['CI'] == true")`（SpEL，5.13 后独立为 junit-jupiter-conditions 依赖）；
- 粗粒度选跑什么用 **Tag**：`@Tag("integration")` + surefire `<excludedGroups>` 或 `-Dgroups=`，条件注解管"这台机器/这个配置下能不能跑"，Tag 管"这一类测试归哪个阶段执行"。

```java
@Tag("integration")                            // 由构建阶段按组过滤，CI  nightly 才跑
@EnabledIfSystemProperty(named = "db.url", matches = ".+")   // 反例防护：本地没配连接池时跳过而不是报错
class PaymentIT { }
```

## 五、@Disabled、@TempDir 与排错

`@Disabled(reason 必填)` 是债务凭证，配 CI 统计禁用数防烂尾；`@TempDir` 本身就是官方 ParameterResolver 的示范（静态字段=类级作用域、参数=方法级自动清空）。扩展排错口诀：回调没跑查注册方式与 static/非 static、参数没注入查 supportsParameter 条件、顺序怪异查声明序与并行模式。

## 六、关联技术

生命周期基线在 [JUnit 5 架构、生命周期与断言](S1-1-Lesson.md)；参数工厂与动态用例见 [参数化、动态与重复测试](S1-2-Lesson.md)；实战中最常见的两个扩展用户是 [Mockito 的 MockitoExtension](../../mockito/s1/S1-2-Lesson.md) 与 [Testcontainers 的 @Testcontainers](../../test-containers/s1/S1-1-Lesson.md)。
