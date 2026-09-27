# 小测验 · 数值精度、日期时间与字符编码

> 本卷共 6 题（单选 / 多选 / 判断 / 填空 / 简答），满分 100 分，≥ 60 分过关。

### 1. 处理金额，下列做法正确的是？（15分）

- A. 用 `double` 存并直接加减
- B. 用 `BigDecimal`，且用 `new BigDecimal("0.1")` 字符串构造
- C. 用 `new BigDecimal(0.1)` double 构造
- D. 用 `float` 省内存

> 答案：B
> 解析：double/float 二进制无法精确表示 0.1；`new BigDecimal(double)` 会把误差带入，必须用字符串构造（或 valueOf）。

### 2. 比较两个 `BigDecimal` 数值是否相等，应用？（15分）

- A. `equals`
- B. `==`
- C. `compareTo(...) == 0`
- D. `hashCode` 相同

> 答案：C
> 解析：`equals` 连标度一起比，`1.0` 与 `1.00` 不等；`compareTo` 只比数值，返回 0 才是"值相等"。

### 3. 【多选】关于 `java.time`，下列说法正确的有？（20分）

- A. 核心类不可变、线程安全，可替代 `SimpleDateFormat`
- B. `Instant` 表示 UTC 绝对时刻，适合存储与跨时区比较
- C. `LocalDateTime` 自带时区信息，跨时区不会算错
- D. `DateTimeFormatter` 线程安全，可定义为静态常量

> 答案：ABD
> 解析：C 错——`LocalDateTime` 不含时区/偏移，跨区比较或存库会错，要用 `Instant`/`ZonedDateTime`。

### 4. 判断：为简化计算，可以直接按"一天 = 86400 秒"做跨夏令时时区的日期天数运算。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：有夏令时的地区切换当天是 23 或 25 小时，硬乘 86400 会错；应通过 `ZoneId`+`ChronoUnit`/`Instant` 计算。

### 5. 填空题：`new String(bytes)` 不传字符集会使用 ______ 默认编码导致跨环境乱码，应显式传 ______；Java `String` 内部以 ______ 存储，一个 emoji 通常占 2 个 `char`。（15分）

> 答案：平台（平台默认 charset） / StandardCharsets.UTF_8 / UTF-16
> 解析：乱码根因是编解码字符集不一致 + 依赖平台默认；String 是 UTF-16，增补字符为代理对。

### 6. 简答题：写出 BigDecimal 使用三条铁律，并说明"日期时间端到端"的推荐存储/展示策略。（25分）

> 参考答案：
> - BigDecimal 三铁律：① 只用 String 构造或 valueOf，禁 double 构造；② 比较用 compareTo 非 equals；③ 除法/定精度必须给 scale+RoundingMode（团队统一舍入模式）
> - 日期策略：内部与数据库统一存 UTC（Instant / 带区 TIMESTAMP），展示时按用户 ZoneId 转本地；用不可变线程安全的 java.time 与 DateTimeFormatter 替换 Date/Calendar/SimpleDateFormat；涉及绝对时刻不用无时区的 LocalDateTime
