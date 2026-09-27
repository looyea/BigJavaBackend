# Java 17 LTS：语言结构现代化 · 作业

> 不判分，对照参考要点自查。

## 作业 1：VO 改 record（必做）

把一个含 `userId/username/age/email` 四字段、手写 getter/setter/equals/hashCode/toString 的旧 VO 重写为 record，并用紧凑构造器校验：`age` 在 0~150、`email` 含 `@`、`username` 非空。

**参考要点**：`record User(long userId, String username, int age, String email){ User{ ...校验... } }`；访问器是 `username()` 而非 `getUsername()`；equals/hashCode 自动生成勿手写。

## 作业 2：sealed + 穷尽建模（必做）

用 `sealed interface OrderState permits Created, Paid, Shipped, Cancelled`，各状态用 record 承载所需数据（如 Paid 带 tradeNo、Cancelled 带 reason）。写一个 `String summary(OrderState s)` 用模式匹配处理全部状态；然后**新增一个 `Refunded` 但不加进 summary**，观察编译/预览报错，再补齐。

**参考要点**：switch 类型模式需 `--enable-preview`（17）或 JDK 21；sealed 穷尽让漏分支在编译期暴露；新增状态必须同步 permits 与所有穷尽 switch。

## 作业 3：文本块与 switch 表达式重构（必做）

把一段 SQL 的字符串 `+ "\n" +` 拼接改成文本块（注意缩进自动剥离规则）；把一段 `if(month==1||month==3||...) {days=31}` 的 if-else 链改成 switch 表达式赋值。

**参考要点**：文本块用 `"""` 起止、最小公共缩进被去除、行尾 `\` 可续行；switch 表达式箭头不穿透、有返回值、多 case 合并 `case A,B ->`。

## 作业 4：record 浅不可变陷阱（选做）

定义 `record Cart(long uid, List<Item> items)`，构造时传入一个可变 `ArrayList`，外部继续 `add` 后发现 Cart 内容也变了。用两种方式修复（构造内 `List.copyOf` 或紧凑构造器归一化），说明"浅不可变"含义。

**参考要点**：record 只保证引用不可变、不深拷贝组件；防御性拷贝放紧凑构造器 `items = List.copyOf(items)`；呼应 s1-1 安全发布、s3-3 不可变返回集合。

## 作业 5：record vs Lombok 决策（选做）

在旧项目里同时存在 Lombok `@Value` 类与新写的 record。用 150 字给出团队规范：什么时候用 record、什么时候仍需 Lombok/普通类（如需继承、需 builder 的复杂对象、需字段级可变）。

**参考要点**：纯不可变数据载体优先 record；需要继承体系、复杂构建、可变状态或框架强约束 getter 命名时保留类/Lombok；record 无注解处理器依赖更清晰。
