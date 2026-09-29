# 创建型与结构型模式

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能按"对象的创建时机与位置由谁决定"在五种创建型模式间做选择；用枚举单例替换手写双重检查锁并说清 volatile 到底挡什么；识破 Java `clone()` 的浅拷贝陷阱与正确替代；能一句话说清适配器/装饰器/代理/享元的结构差异——接口变形、行为叠加、访问控制、以共享代创建——并各指认一个 JDK 或 Spring 里的真实出处。

```flow
例子目的：创建型模式回答同一个问题——"new 的权力交给谁"——四个递进答案的适用场景
直接new: 类型唯一且构造简单 -> 过度设计退场, new 就放调用点
静态工厂/工厂方法: 返回类型要看参数(RegisterType->Admin/User) 或产品族要成套换实现
建造者: 构造参数≥4且多为可选, 或对象要求"构造完成即合法"
单例: 全JVM恰好一个有状态重对象(连接池/注册表), 且生命周期与容器同寿
```

## 一、创建型：先问"能不能不写模式"

**静态工厂方法是第一优先级**——`EnumSet.of()`、`Optional.of()` 用它命名语义（`valueOf/of/create` 各有约定）、复用缓存实例、允许返回子类型。它不是 GoF 独立模式，但成本最低收益最高。

**工厂方法/抽象工厂**解决"调用方不该知道具体类型"：

```java
// 目的：按类型编码产出解析器——客户端只依赖抽象, 新增类型不改调用方(接 S1-1 的 OCP)
public interface FileParser { ParserType type(); List<Record> parse(Path p); }
class ParserFactory {
    private final Map<ParserType, Supplier<FileParser>> registry;   // 注册的是"造法"而非成品: 解析器可持有每文件状态
    FileParser create(ParserType t) {
        return Optional.ofNullable(registry.get(t))                       // 结果: 调用方拿接口, 不 import 任何实现类
                .orElseThrow(() -> new UnsupportedTypeException(t))       // 反例兜底: 未知类型立即失败而非返回 null
                .get();
    }
}
// 错误用法: 工厂 switch 里 new 具体类且每次改工厂——那只是把 if-else 从业务挪进工厂, OCP 一点没挣到
// 说明: 在 Spring 里这个工厂常退化为 List<FileParser> 注入+分组, 模式还在但样板代码消失;
// 抽象工厂用于"产品族成套替换"(存储层 OssClient+OssConfig 一套 / MinioXxx 一套), 单产品别上
```

**建造者**服务两个场景：宽参数对象、"构造完成即合法"的不变式。record 时代的新共识：

```java
// 目的：HTTP 客户端配置的构造——可选参数多且不互相冲突时用 withXxx 函数式定制, 替代 200 行 Builder
HttpClientConfig base = HttpClientConfig.of(Duration.ofSeconds(3));   // 必填参数走 of, 保证"最小合法对象"永远存在
HttpClientConfig cfg  = base.withConnectTimeout(Duration.ofSeconds(5))  // 结果: 每步返回新不可变实例, 并发共享 base 安全
                        .withMaxIdles(16);
// 错误用法: 给 record 手写可变 Builder 还 setXxx 返回 this——record 的不可变优势被 Builder 复刻回"半成品对象"
// 说明: 参数需要跨方法层层传递累积时(分阶段装配)才值得经典 Builder, 否则 of+with 足够且更短
```

**单例**：Java 里唯一正确的三种写法——Spring  bean（默认 singleton，生命周期归容器）、枚举常量、持有者类（holder idiom）。

```java
// 目的：为什么枚举是"最安全单例"——对比手写双重检查锁的两个坑
public enum MetricsRegistry {                          // 结果: JVM 类加载保证唯一, 反射攻击无效, 序列化天然不破功
    INSTANCE;
    private final ConcurrentHashMap<String, LongAdder> counters = new ConcurrentHashMap<>();
}
// 反例1: 手写 DCL 忘写 volatile——new 的"分配内存/初始化/赋引用"三步可重排, 另一线程拿到未初始化完成的对象
// 反例2: 私有构造器可被反射 setAccessible 击穿; 实现 Serializable 后 readResolve 忘记处理, 反序列化出一个新实例
// 说明: 单例真正被滥用的标志是"它持有可变状态还被到处注入"——那是全局变量换了件衣服, 先质疑该不该存在
```

**原型模式在 Java 的实话**：`clone()` 是设计事故——不走构造器、`final` 字段无法赋值、默认浅拷贝。

```java
// 目的：演示 clone() 浅拷贝陷阱与正解
class OrderDraft { List<String> items = new ArrayList<>(); }
OrderDraft a = new OrderDraft(); a.items.add("A");
OrderDraft b = (OrderDraft) a.clone();          // 反例: b 与 a 的 items 是同一个 List 引用!
b.items.add("B");                                // 结果: a.items 也变成 [A, B]——"独立副本"是幻觉
// 正解1: 拷贝构造器 OrderDraft(OrderDraft o){ items = new ArrayList<>(o.items); } —— 意图显式、可控深度
// 正解2: 字段本身不可变(List.copyOf), 共享即安全, 根本不需要 clone
```

## 二、结构型：一张图分清四兄弟

| 模式 | 接口变化 | 动机 | JDK/Spring 出处 |
|---|---|---|---|
| 适配器 | 被适配接口 → 客户端期望接口（**变形**） | 复用不兼容组件 | `InputStreamReader`、SpringMVC `HandlerAdapter` |
| 装饰器 | 接口不变，行为叠加（**增强**） | 横切能力可组合 | `BufferedInputStream(new FileInputStream())` |
| 代理 | 接口不变，访问控制（**管控**） | 调用被拦截以做懒加载/远程/事务 | Feign 动态代理、`@Transactional` CGLIB |
| 享元 | 用共享替代创建（**省内存**） | 大量细粒度相似对象 | `Integer.valueOf` 缓存、`String.intern` |

```java
// 目的：装饰器与代理的分界——结构一样、意图不同, 读代码时靠命名与注释判断
InputStream in = new BufferedInputStream(            // 装饰器: 调用方主动选择"加缓冲"这项能力, 可层层叠加
        new GZIPInputStream(                          // 结果: 每层只加一件事, 组合出 2^n 种能力而类只有 n 个
                new FileInputStream("data.gz")));     // 错误用法预告: 装饰 4 层后忘了从外往内关, 内层流泄漏(见 S1-3 责任链的作业)
// 代理: 调用方通常不知道自己拿到的是代理(Feign 接口/@Transactional 类)——拦截是为了"看不见的管控"
// 说明: 面试标准句——适配器"变接口", 装饰器"加行为", 代理"管访问", 享元"省对象"
```

**桥接**处理"两个独立变化维度"的乘法爆炸：

```java
// 目的：通知渠道(短信/邮件/App) × 供应商(阿里/腾讯) 若继承组合需 6 个类, 桥接后 3+2
interface SmsProvider { void send(String phone, String text); }        // 实现维度: 可独立新增供应商
class SmsChannel implements NotifyChannel {                            // 抽象维度: 渠道持有供应商引用(桥)
    private final SmsProvider provider;
    SmsChannel(SmsProvider provider) { this.provider = provider; }     // 结果: 新增供应商不碰渠道类, 两维度解耦
    @Override public void notify(User u, String msg) { provider.send(u.phone(), msg); }
}
// 错误用法: AliyunSmsChannel/TencentSmsChannel/AliyunMailChannel... 维度一乘类就爆炸, 且爆炸发生在"最不想改的那一维"
// 说明: 桥接与策略在代码上常常同形——桥接是"类型级"的结构决策(建模时定), 策略是"对象级"的可换算法(运行时换)
```

**外观**的诚实版本：给子系统一个"默认用法"入口，而不是把包所有类封进一个 God Service——外观方法应保持薄（编排+翻译参数），一旦长出业务规则就该下沉。

## 三、常见线上问题

- 手写单例在 Spring 环境二次注册：容器一份、`INSTANCE` 一份，计数器各写各的——凡"单例"必须全项目唯一来源；
- 浅拷贝共享 `Date/List` 字段：DTO→Entity 用 `BeanUtils.copyProperties` 复制了 List 引用，两个订单一改全乱——copy 语义要么显式深拷贝要么字段不可变；
- 装饰器链关错顺序：自定义 `Closeable` 装饰没把 `close()` 委托给被装饰者，资源泄漏查不到源头；
- 享元越界：把 `Integer` 缓存（-128~127）当"对象相等"依据，`==` 比较金额在越过缓存边界后随机 false——缓存是实现细节不是语义承诺。

## 四、小结与过关要点

创建型模式管"new 的权力"，结构型模式管"对象怎么拼"；但 Java 生态里一半模式会被语言特性或框架吸收（DI 吸收工厂、lambda 吸收策略/命令、record 吸收 Builder）。过关自测：拿出你项目里最近一个 `XxxFactory` 或 `XxxWrapper`，说出它属于四兄弟里的哪一个、接口变了没有、能不能被一个 `Function` 字段替代。
