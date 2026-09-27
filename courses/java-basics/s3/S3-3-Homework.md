# S3-3 Optional 与语言级设计取向 · 作业

> 不判分，对照参考要点自查。

## 作业 1：链式重构（必做）

把下面这段"层层判空取值"的老代码用 `Optional` 链式重写，使空值统一走默认：

```java
if (order != null) {
    User u = order.getBuyer();
    if (u != null) {
        Address a = u.getAddress();
        if (a != null) { return a.getCity(); }
    }
}
return "未知";
```

**参考要点**：`Optional.ofNullable(order).map(Order::getBuyer).map(User::getAddress).map(Address::getCity).orElse("未知")`；任一环为 null 自动变空 Optional。

## 作业 2：orElse vs orElseGet 副作用实验（必做）

写一个 `String buildDefault(){ System.out.println("构造默认值"); return "N/A"; }`。分别用 `.orElse(buildDefault())` 和 `.orElseGet(() -> buildDefault())` 作用于一个**有值**的 Optional，观察控制台：前者打印"构造默认值"、后者不打印。用一句话总结差异与选型准则。

**参考要点**：`orElse` 参数总被求值，`orElseGet` 惰性；带方法调用/开销/副作用一律用 `orElseGet`。

## 作业 3：接口反模式纠正（必做）

有一个 `Optional<List<User>> findUsers(String dept)` 的方法。把它重构成合理的空值表达，并写清"为什么原来的设计不好"。同时把一个被误用作字段类型的 `Optional<String> name;` 改正。

**参考要点**：返回 `List<User>`，空时 `List.of()`/"没有集合"与"空集合"应统一；字段改 `String name` + `@Nullable` 或构造校验；Optional 作字段还会破坏 Serializable。

## 作业 4：orElseThrow 快速失败（选做）

在一个 Service 方法里，用 `repository.findById(id).orElseThrow(() -> new NotFoundException(id))` 替代"返回 null 再让上层 NPE"。说明这样把"空"变成"明确的业务异常"对可维护性与排障的价值。

**参考要点**：错误信息含 id、异常类型明确、失败点前移到源头；呼应 s2-2 快速失败与受检/非受检异常取舍。

## 作业 5：设计取向对比小论文（选做）

用 200 字对比 Java `Optional`（库方案）、Kotlin `T?`（类型系统方案）、注解 `@Nullable`+静态分析（工具方案）三种空值治理路线各自的取舍与适用团队场景，并给出"存量 Java 大项目"你的推荐组合。

**参考要点**：库方案兼容存量但靠约定；类型系统方案最彻底但需换语言/迁移；注解方案轻量覆盖参数/字段；推荐 Optional(返回值)+@Nullable(参数/字段)+IDE/ArchUnit 校验 组合。
