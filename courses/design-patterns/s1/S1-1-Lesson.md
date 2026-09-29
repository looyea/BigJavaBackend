# 设计原则 SOLID 与组合优于继承

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能用"变更原因"而非"功能分类"判断类是否该拆（SRP 的正确度量是改它时要动几类代码）；用注册表/策略把 OCP 落到"新增渠道不改老代码"的可验证标准；识别 LSP 违约的三种工程表现（抛 Unsupported、加强前置条件、破坏不变式）；说清 ISP 在 Java 里如何用接口拆分与默认方法止血；解释"依赖倒置"里到底倒的是什么，并能用组合替换继承体系里 80% 的场景。

```flow
例子目的：同一个需求"新增一个支付渠道"在两种设计下的改动半径对比——OCP 的价值就是把修改点收敛为新增文件
违约设计: 新增微信渠道 -> 改PayService的if-else -> 改PayServiceTest -> 回归支付宝/银联逻辑(全量测试)
合规设计: 新增WechatChannel implements PayChannel -> 注册到工厂 -> 只新增两个文件(实现+其单测), 老代码零改动
```

## 一、S 单一职责：按"变更原因"切，不按功能切

SRP 的经典定义"一个类只有一个变更的原因"常被误读成"一个类只干一件事"。可用的判据是：**让产品经理、DBA、合规审计分别提需求，是否都会改到同一个类**——都会，这个类就承担了多个角色。

```java
// 目的：用"谁提需求会改它"给一个订单类做职责体检
class OrderService {
    void createOrder(CreateOrderCmd cmd) { ... }        // 产品改下单规则 → 动这里
    void exportCsv(DateRange range) { ... }             // 财务改报表 → 也要动这个类 = 第二个变更原因, 该拆
}
// 结果: 拆出 OrderReportService 后, 财务需求与交易需求提交互不冲突, 合并冲突与回归面同时下降
// 错误用法: 把"拆分"理解成"每个方法一个类", 拆出几十个一屏能读完的类——职责数没降, 调用链先炸
// 说明: SRP 的反噬是类数量上升, 收益在"变更隔离"; 小团队阈值放宽, 高频变更域优先拆
```

## 二、O 开闭：对扩展开放的手段是"抽象挂点"

开闭不是"少写 if"的口号，而是把**易变维度**抽成接口的注册点：新增业务分支=新增实现类，存量代码不动。

```java
// 目的：支付渠道按"扩展点"组织——易变的是渠道, 不变的是编排流程
public interface PayChannel {
    String code();                                     // 渠道唯一标识, 注册表的 key
    PayResult pay(PayOrder order);                     // 每个渠道自己实现, 互相无感知
}
@Component
class PayChannelRegistry {
    private final Map<String, PayChannel> channels;    // Spring 注入 List<PayChannel> 转 map
    PayChannelRegistry(List<PayChannel> list) {
        channels = list.stream().collect(toMap(PayChannel::code, Function.identity()));
    }
    PayChannel get(String code) {                      // 结果: 新渠道只要 @Component 即自动可用, PayService 零改动
        var ch = channels.get(code);
        return Objects.requireNonNull(ch, "未知渠道 " + code);   // 反例兜底: 拼错 code 立刻失败, 不静默走默认渠道
    }
}
// 错误用法: 用 switch(code) 分发——第 N+1 个渠道来了要改生产代码, 每次改都触发全渠道回归测试
// 说明: 抽象有成本, 只给"确认还会变"的维度建挂点; 只出现一次的变化直接写死更诚实(见 S2-2 过度设计)
```

## 三、L 里氏替换：子类型必须守"行为契约"而非只过编译

LSP 的违约在 Java 里有三种高频形态，都能在运行时炸掉调用方的通用逻辑：

1. **抛不支持**：`Collections.unmodifiableList(...)` 返回的 List 调 `add` 抛 `UnsupportedOperationException`——所有"拿到 List 就能改"的通用代码失效，这就是 JDK 自己承认的 LSP 折衷；
2. **加强前置条件**：子类把父类的 `@NonNull` 参数改成还要非空集合，调用方按父类契约传参直接挂；
3. **破坏不变式**：`HashMap` 子类重写了 `put` 却不维护 `size()`，依赖"put 后 size+1"的代码静默出错。

```java
// 目的：识别一个真实的 LSP 违约——"正方形继承矩形"经典反例的 Java 版
class Rectangle { int w, h; void setW(int v){ w=v; } void setH(int v){ h=v; } int area(){ return w*h; } }
class Square extends Rectangle {
    @Override void setW(int v){ w = h = v; }            // 维持"宽高相等"不变式
    @Override void setH(int v){ w = h = v; }
}
// 反例: 测试 client(r){ r.setW(4); r.setH(5); assert r.area()==20; } 对 Rectangle 通过, 传 Square 得 25——替换即违约
// 结果: 正解不是修断言, 是取消继承: Square 与 Rectangle 共同实现 Shape{area()}, 各留各的构造器
// 说明: 判据——凡是"子类偷偷加了不变式"的继承, 都在 LSP 边缘; 组合+接口才是安全表达
```

## 四、I 接口隔离：别让实现者背无关方法

胖接口的代价：实现类被迫写一堆 `throw new UnsupportedOperationException()`（这正是 LSP 违约的温床）。拆法按"调用方实际用到的最小面"：

```java
// 目的：按调用方视角拆一个胖持久化接口(JPA 真实做过同样的事)
interface ReadRepo<T,ID>   { Optional<T> findById(ID id); List<T> findAll(); }      // 只读报表页依赖它
interface WriteRepo<T>     { void save(T entity); }                                  // 录入端依赖它
interface CrudRepo<T,ID> extends ReadRepo<T,ID>, WriteRepo<T> {}                     // 需要全家桶的管理后台用它
// 结果: mock 测试只 stub 用到的两三个方法; 接口演进时不牵连无关实现者
// 错误用法: 给拆出的每个接口预置 10 个"以后可能用"的方法——胖接口是喂出来的, 不是生出来的
// 说明: 默认方法可作止血带(给无关方法 default 实现), 但别拿它替代正确的拆分
```

## 五、D 依赖倒置：倒的是"抽象的所有权"

高层模块定义它需要的接口，低层实现它——依赖箭头从"高层→低层"倒转为"双方→抽象"。JDBC 是教科书：`java.sql.Driver` 由 Sun 定义（高层：应用服务器），各家数据库实现（低层），没有倒置就没有换驱动不改代码。Spring IoC 只是把这个模式工程化成容器注入。

识别口诀：**看接口在谁的包里。接口在消费者包里=倒置了；接口在提供者包里=你还是直接依赖。**

## 六、组合优于继承：换掉"is-a"的幻觉

继承的三个隐性契约让它成为强耦合手段：父类实现细节成为子类源码依赖（脆弱基类）、重写了方法却无法阻止父类内部调用旧行为（this 逃逸）、单继承锁死了复用组合。

```java
// 目的：把"模板方法继承"改写为"策略组合"——Spring 体系里的实际演进方向
class PriceCalculator {
    private final List<DiscountRule> rules;             // 组合: 满减/会员券/渠道折扣是可插拔规则
    PriceCalculator(List<DiscountRule> rules) { this.rules = List.copyOf(rules); }
    BigDecimal calc(Order o) {
        BigDecimal p = o.originalAmount();
        for (DiscountRule r : rules) { p = r.apply(p, o); }   // 结果: 新增折扣=新加一个 rule, 无继承树要爬
        return p;
    }
}
// 错误用法: AbstractPriceCalculator 定钩子再派生 20 个子类——规则要"叠加"时继承表达不了(单继承), 只好多继承式接口大杂烩
// 说明: 策略+注册表本质就是"用组合实现 OCP"; 何时仍该继承——真正的子类型多态(契约相同且需要 is-a 语义, 如 List 实现)
```

## 七、常见线上问题

- 上帝类伴随大事务：500 行的 `OrderService` 往往也是一个巨型 `@Transactional`，锁持有时间=全类逻辑之和；
- if-else 链腐化：每加渠道改同一个方法，git 冲突热区 + 回归成本线性上升——注册表化是止血也是手术；
- 滥用继承导致的"改父类全线崩"：一次 `BaseController` 加参数校验触发 30 个服务发布，这是脆弱基类的真实账单；
- 接口随意扩张：为省事往公共接口加方法，下游所有实现类被迫跟随发版——ISP 失守的组织级放大。

## 八、选型对比

| 手段 | 解决什么 | 滥用症状 |
|---|---|---|
| 继承 | is-a + 多态契约 | 为复用代码而继承（should be 组合） |
| 组合+策略 | 易变维度可插拔 | 给不变的逻辑也建扩展点（过度设计） |
| 接口抽象 | 解耦变更、可测试 | 单实现接口满天飞且非边界（仪式代码） |
| 依赖注入 | 装配与生命周期外置 | 构造器注入 15 个依赖=类本身就该拆 |

## 九、小结与过关要点

五条原则其实是一句话：**把"会变的"隔离到可替换的位置**——SRP 找出变更源，OCP 给变更建挂点，LSP 保证挂点可换，ISP 控制挂点大小，DIP 决定挂点归谁。过关自测：拿你仓库里最大的那个 Service 类，说出它服务几种变更原因、哪一种最该先抽走。
