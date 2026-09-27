# Java 17 LTS：语言结构现代化 · 小测

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. 关于 `record`，下列说法错误的是？（15分）

- A. 组件字段默认是 `final`，天生浅不可变
- B. 访问器方法名与组件同名（如 `amountCents()`）
- C. record 可以 `extends` 一个普通类以实现复用
- D. 编译器自动生成 equals/hashCode/toString

> 答案：C
> 解析：record 隐式 final、**不能继承任何类**，只能 implements 接口。A/B/D 均正确。

### 2. `sealed interface` 配合 switch 模式匹配的最大价值是？（15分）

- A. 提升运行时性能
- B. 让编译器做穷尽性检查，新增子类型漏处理直接编译报错
- C. 自动生成 getter
- D. 支持多继承

> 答案：B
> 解析：sealed 封闭了类型层级（`permits` 列出全部实现），switch 据此判断是否覆盖所有分支，把"记得处理所有情况"从人肉纪律变编译器保证。

### 3. 【多选】下列特性与转正版本对应正确的有哪些？（20分）

- A. `var` 局部变量类型推断 —— Java 10
- B. record —— Java 16 正式转正
- C. 文本块（Text Blocks）—— Java 15
- D. 虚拟线程（Virtual Threads）—— Java 17

> 答案：ABC
> 解析：D 错——虚拟线程在 **Java 21** 转正（JEP 444），17 时尚为预览。A/B/C 对应正确。

### 4. 判断：`if (o instanceof String s)` 中的 `s` 需要在分支内再写 `(String) o` 才能用。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：这是 instanceof 模式匹配（Java 16 转正），匹配成功即绑定到一个新声明的模式变量 `s`，无需手动强转。

### 5. 填空题：record 中用于做参数校验/归一化、且不写参数列表的特殊构造器叫 ______ 构造器；限定某接口只有指定类型能实现的关键词是 ______。（10分）

> 答案：紧凑（compact） / sealed（permits）

### 6. 说明 record、sealed、模式匹配三者如何组合成"代数数据类型（ADT）+ 穷尽处理"的现代 Java 建模方式，并各点出一个使用注意。（30分）

> 参考答案：
> - 组合：sealed interface 定义封闭的结果/状态类型集合，其各分支用 record 承载数据，消费端用 switch/instanceof 模式匹配对全部子类型穷尽处理，编译器兜底完整性
> - record 注意：浅不可变——内含可变对象（List/Date）需防御性拷贝；作 DTO 反序列化需支持 record 的 Jackson 版本
> - sealed 注意：新增实现必须显式加入 permits 且满足同包/同模块约束，否则编译不过
> - 模式匹配注意：不要滥用 default 分支，否则会吞掉 sealed 带来的穷尽性保护
> - 价值：把不可变、封闭层级、分支完整性都交给编译器，减少人肉纪律与漏分支事故
