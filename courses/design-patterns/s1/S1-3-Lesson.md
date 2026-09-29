# 行为型模式

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：能用责任链讲清 Spring 拦截器"前置正序、后置逆序"的洋葱结构并识别死链 bug；把订单状态迁移从散落的 if-else 收敛为带守卫的迁移表（状态模式工程版）；说对 Spring 事件监听器的默认事务时机与"回滚后仍发券"事故的修法；解释 `Iterator.remove()` 为什么合法而 `list.remove()` 会 fail-fast；并为命令/模板方法/访问者各给出一个"该用与不该用"的判断。

```flow
例子目的：行为型模式共同解决的问题是"协作的时序与归属"——谁先谁后、谁说了算、变化放哪
策略: 同一件事的多种算法, 调用时选一个(空间维度)
状态: 同一对象在不同阶段允许不同行为+迁移合法性(时间维度)
责任链: 一个请求依次穿过多个处理者, 每站可拦截可放行(流程维度)
观察者: 一件事发生后谁关心谁响应, 发布方不认识订阅方(扩散维度)
模板方法: 骨架固定, 挖几个钩子给子类(继承维度)
```

## 一、策略与注册表：行为型里唯一"人人都在用"的

S1-1 已用注册表落 OCP，策略的完整形态还包含**选择逻辑外置**：`Map<Type, Strategy> + 一个 Resolver`。lambda 时代策略常退化为函数字段（`Function<Order, BigDecimal> feeFn`），模式还在、类消失了。

## 二、状态模式：给"订单状态"一个说一不二的地方

状态模式的学术形态（每状态一个类）在 Java 业务里多半过重；工程形态是**迁移表 + 守卫**，价值全部集中在"非法迁移集中拒绝 + 幂等"：

```java
// 目的：订单状态机——把"哪里都能改 status"收敛为唯一迁移入口, 杜绝 double-refund
enum OS { PENDING, PAID, REFUNDING, REFUNDED, CLOSED }
private static final Map<OS, Set<OS>> TRANSITIONS = Map.of(              // 迁移表即文档: 产品评审时直接看这张表
    PENDING,   Set.of(PAID, CLOSED),                                     // 待支付只能去支付或超时关闭
    PAID,      Set.of(REFUNDING, CLOSED),
    REFUNDING, Set.of(REFUNDED, PAID));                                  // 反例路径 REFUNDED->PAID 不在表中, 永远进不来
synchronized void transition(OS from, OS to) {
    if (!TRANSITIONS.getOrDefault(from, Set.of()).contains(to))          // 结果: 非法迁移抛异常+告警, 不静默写库
        throw new IllegalStateTransition(from, to);
    int rows = dao.casStatus(orderId, from, to);                         // SQL: UPDATE ... SET status=? WHERE id=? AND status=?
    if (rows != 1) throw new ConcurrentTransition();                     // 反例兜底: CAS 失败=并发已迁移, 拒绝二次退款这类资损
}
// 错误用法: 每个 Service 里手写 if (status==PAID) update... —— 校验分散八处, 总有一处漏了 CAS
// 说明: 状态很多、迁移复杂再升级 Spring Statemachine; 先用迁移表, 大多数业务到此为止够用
```

## 三、模板方法：骨架进抽象类，钩子保持"无惊喜"

`JdbcTemplate`、`AbstractApplicationContext.refresh()` 是范本。两个纪律：钩子方法不做 I/O 重活（父类无法预估子类耗时）；父类内部调用钩子要走模板方法自己的 `final` 骨架，别在构造器里调可重写方法（半初始化对象逃逸，接 S1-2 的 this 逃逸）。

## 四、观察者：Spring 事件的三个默认陷阱

```java
// 目的：把"下单成功后发券"从主流程解耦——以及修正三个高频误用
@Service
class OrderService {
    @Transactional
    public void create(Order o) {
        orderRepo.save(o);
        publisher.publishEvent(new OrderCreatedEvent(o.id()));   // 反例: 此刻事件监听器若同步执行, 看到的是一个"还会回滚"的未来
    }                                                            // 事故形态: 事务回滚了, 券已发出
}
@Component
class CouponListener {
    @TransactionalEventListener(phase = AFTER_COMMIT)            // 结果: 提交后才发券; 回滚则根本不被调用
    @Async                                                       // 加异步避免发券耗时拖长下单 RT(注意线程池隔离)
    void on(OrderCreatedEvent e) { couponService.grant(e.orderId()); }
}
// 陷阱2: 默认同步同线程, 一个监听器抛异常会中断发布方——隔离策略要么 try-catch 全捕获要么改异步
// 陷阱3: 它是 JVM 内进程内广播, 不能当 MQ 用——跨服务消费重启即丢, 需要可靠投递请回到事务消息
```

## 五、责任链：Servlet 过滤器与 SpringMVC 拦截器

结构三要素：处理者共同接口、持有 next、`proceed()` 决定是否放行。**洋葱模型**：前置正序执行、后置逆序出栈——所以鉴权过滤器写的 traceId，日志过滤器在最后能读到。

```java
// 目的：链的两大死法——漏 proceed 与异常吞链
class AuthFilter implements Filter {
    public void doFilter(Request req, Response res, FilterChain chain) throws IOException, ServletException {
        if (!tokenValid(req)) { res.setStatus(401); return; }    // 拦截分支: 不调 chain.doFilter 是"故意截断", 合法
        chain.doFilter(req, res);                                 // 错误用法: 放行分支也忘了这行 = 静默死链, 请求无声 200 空响应
    }
}
// 反例2: catch(Exception e){ log.warn(...) } 后既不抛也不 set 状态码——后续链路带着半初始化上下文继续跑
// 说明: 拦截器 preHandle 返回 false 时, 已执行过的拦截器的 afterCompletion 仍会被逆序调用(Spring 做了记账), 自己写链要复刻这个语义
```

## 六、迭代器：fail-fast 不是 bug 是契约

```java
// 目的：删除列表中满足条件的元素——三种写法两种有雷
for (String s : list) { if (bad(s)) list.remove(s); }     // 反例: 结构性修改使 modCount 变化, 下次 next() 抛 ConcurrentModificationException
for (int i = 0; i < list.size(); i++) { if (bad(list.get(i))) list.remove(i--); }  // 可行但靠 i-- 修补索引, 极易写错, 不推荐
list.removeIf(s -> bad(s));                                // 结果: 内部单次遍历+批量收缩, 首选
Iterator<String> it = list.iterator(); while (it.hasNext()) { if (bad(it.next())) it.remove(); }  // 迭代器自己的 remove 更新游标预期, 合法
// 说明: CME 是"尽力检测"非保证(catch 它做并发控制是错误用法); 并发场景用 CopyOnWriteArrayList 或分片加锁
```

## 七、命令、中介者、访问者、备忘录的实话

- **命令模式**：价值在"请求对象化"后的可回放/可撤销/可排队——MQ 的 Message、线程池的 Runnable、工作流的 JobInstance 都是它。业务 CRUD 别硬套"XxxCommand 类+Executor"三层纸；
- **中介者**：Spring MVC 本身就是（DispatcherServlet 协调 handler/adapter/viewResolver）。多对多聊天变一对一星型是它唯一的识别信号；
- **访问者**：双分派在 Java 里最尴尬——新增元素类型要改所有访问者（开闭反了）。 sealed interface + 模式匹配（Java 21 `switch (shape) { case Circle c -> ... }`）拿下的就是访问者的活；仍在的场合：编译器 AST/表单字段校验器这类"元素稳定、操作频繁新增"的结构；
- **备忘录**：快照/撤销——工程里常退化为"序列化 + 版本号"，别包一层 Memorizer 再叫模式。

## 八、常见线上问题

- `@EventListener` 当 MQ 用：进程重启事件丢失、上下游同生共死（一个监听器 OOM 拖垮发布方）；
- 拦截器顺序错配：字符集过滤器排在 XSS 过滤器后面，拿到的是乱码参数；
- 状态机裸写 `update status`：无 from 条件，并发下 A 的 PAID→CLOSED 覆盖 B 的 PAID→REFUNDING；
- 模板方法钩子抛受检异常被父类 `catch(Exception)` 统一转"系统繁忙"：真实原因永久沉入日志海底。

## 九、小结与过关要点

行为型模式的共同货币是**时间与控制权**：策略买"算法可换"、状态买"迁移可控"、责任链买"流程可插"、观察者买"扩散可解耦"、模板方法买"骨架不可破坏"。过关自测：你系统里最近一次"顺序/并发引起的 bug"，是哪个模式的缺失或误用在兜底？
