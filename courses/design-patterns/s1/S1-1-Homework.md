# 设计原则 SOLID 与组合优于继承 · 作业题

> 本节作业 3 题：一次原则审计、一场注册表化手术、一个脆弱基类复现实验。

## 作业 1：给真实仓库做 SOLID 体检（分析）

挑仓库里 3 个被 Git 提交记录标记为"热区"的类（近半年改动次数最多的）：

- 列出每类承担的变更原因（按"哪类角色提需求会动它"归类），判定是否违 SRP；
- 找出其中的 if-else/switch 分发型分支（渠道、类型、状态），对照过去一年的 commit 历史回答：这些分支**真的还在持续新增**吗——给 OCP 改造排优先级；
- 统计每个类 `extends` 的动机：是子类型多态还是纯复用？为"纯复用继承"各写一条组合替代方案。

**交付物**：一页体检表（类 × 违反原则 × 证据 commit × 建议动作），结论必须引用真实 commit 而非感觉。

## 作业 2：把一条 if-else 处理链重构成注册表（动手）

以下典型代码起步（可换成仓库真实版本）：

```java
BigDecimal fee(String type, BigDecimal amt) {
    if ("ELE".equals(type)) return amt.multiply(new BigDecimal("0.05"));
    else if ("WATER".equals(type)) return ...;
    else throw new IllegalArgumentException(type);
}
```

要求：

1. 抽 `FeeRule` 接口 + `Map<String, FeeRule>` 注册表（Spring 环境用 `List<FeeRule>` 注入转 map）；
2. 补三个防护：重复注册启动即失败、未知 type 报错信息列出已注册项、每条规则自带单测；
3. 用 git diff 统计：新增一条模拟规则时改动了几个文件——把"老代码零改动"做成可演示证据；
4. 反向论证：在作业说明里写一段"什么情况下这段 if-else 根本不值得重构"。

**验收标准**：第 3 步 diff 只含新增文件；第 4 步的判据具体到"分支数与年增频度"。

## 作业 3：复现一次"被父类炸到"的子类（动手）

1. 自定义 `CountingSet<E> extends HashSet<E>`，重写 `add()` 累加计数器，主流程改用 `addAll()` 后统计悄然失真——复现"this 逃逸 + 内部调用路径"问题；
2. 阅读 JDK 对 `Vector/HashSet` 内部调用的注释或用调试器跟踪 `addAll → add` 路径，截图证明调用链；
3. 用组合重写：`CountingSet` 持有 `Set<E>` 字段、实现 `Set<E>` 接口（装饰器），所有方法显式委托，再测同一场景确认计数正确；
4. 总结：装饰器版本的代码多了多少、换来了什么（哪些隐性行为不再受上游版本升级影响）。

**验收标准**：两种实现各附一个能稳定复现/防御的测试；输出一句"继承何时才配得上它的风险"的自用准则。
