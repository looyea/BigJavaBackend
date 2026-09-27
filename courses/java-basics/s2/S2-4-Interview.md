# 实际面试题 · 数值精度、日期时间与字符编码

## 题 1：为什么 `0.1 + 0.2 != 0.3`？金额怎么算才对？

**答题要点**：`double`/`float` 按 IEEE-754 **二进制**表示小数，0.1、0.2 都是无限循环二进制，只能存近似值，相加后误差暴露成 `0.30000000000000004`。金额必须用**十进制精确**手段：`BigDecimal`（且用**字符串构造** `new BigDecimal("0.1")` 或 `valueOf`，绝不用 `new BigDecimal(0.1)`），或用**最小货币单位的整数（分）** 存储运算。除法要显式给 `scale + RoundingMode`。

**追问链**：

1. `new BigDecimal(0.1)` 为什么不行？→ 它接收的是已有误差的 double，把误差原样带进来。
2. 比较相等为什么用 `compareTo` 不用 `equals`？→ `equals` 连标度一起比，`1.0` 与 `1.00` 会判不等；`compareTo==0` 才是数值相等。

## 题 2：`BigDecimal` 有哪些坑？

**答题要点**：① double 构造引入误差（用 String/valueOf）；② `equals` vs `compareTo`（标度陷阱，也影响放进 HashSet/TreeSet 去重）；③ 除法不指定舍入模式遇无限小数抛 `ArithmeticException`；④ **不可变**，运算返回新对象别忘接收；⑤ 全团队/全链路舍入模式要统一（`HALF_UP` 四舍五入 vs `HALF_EVEN` 银行家），否则对账差几分；⑥ 高频账务对象有 GC 压力，可退化用 long 分。

## 题 3：为什么 `SimpleDateFormat` 会出线上事故？`java.time` 好在哪？

**答题要点**：`SimpleDateFormat` **可变、线程不安全**，被放成静态/单例字段时多线程并发 `parse/format` 会互相踩内部 `Calendar`，产生错乱日期甚至异常。`java.time`（JSR-310）全部**不可变、线程安全**，`DateTimeFormatter` 可做静态常量；类型上明确区分 `Instant`（绝对时刻）、`LocalDate/Time/DateTime`（无区墙上时间）、`ZonedDateTime/OffsetDateTime`（带区），并正确处理闰年/夏令时。

**追问链**：`LocalDateTime` 能存库表示一个订单时间吗？→ 不建议，它不含时区，跨时区/夏令时会算错绝对时刻；表示"时刻"要用 `Instant` 或 `ZonedDateTime`，`LocalDateTime` 只适合"生日/营业时段"这类无区语义。

## 题 4：多时区系统的时间怎么存、怎么用？

**结构化回答**：

1. **统一存 UTC**：数据库用 UTC 时间戳（`Instant`/带时区 TIMESTAMP），避免存"服务器本地时间又不带区"。
2. **展示按用户时区**转本地（`ZonedDateTime.withZoneSameInstant(userZone)`）。
3. **计算别硬编码**：跨夏令时一天不是 86400 秒，用 `ZoneId`+`ChronoUnit`/`Duration` 让库处理跳变。
4. 定时任务、对账批处理要明确"按哪个区的一天"，否则跨时区错点。

## 题 5：中文/emoji 乱码的根因是什么？怎么排查？

**答题要点**：根因只有一个——**编码（写）与解码（读）用了不同字符集**，最常见是 `new String(bytes)`/`getBytes()` 不指定 charset 走了**平台默认编码**（开发机 GBK、服务器 UTF-8）。"锟斤拷"是 UTF-8 替换字符 U+FFFD 被按 GBK 再解码。排查沿着**字节↔字符的每个转换点**：文件流 `InputStreamReader` 的 charset、HTTP `Content-Type; charset`、JSON 序列化器、数据库连接 `characterEncoding`、页面 `<meta charset>`，端到端统一 UTF-8。

**追问链**：`"😀".length()` 等于几？→ 2，因为 String 内部 UTF-16，emoji 是代理对占两个 `char`；数字符要用 `codePointCount`，否则昵称长度校验会把 emoji 算成 2 或截半。

## 高频追问速答

1. float 精度更高还是 double？→ double 更高（double 64 位、float 32 位），但都不能表示精确十进制小数。
2. `BigDecimal` 一定是精确的吗？→ 加减乘精确；除不尽要设精度和舍入，是"可控近似"。
3. 为什么 `Date` 的月份从 0 开始？→ 历史设计缺陷（沿用 C `tm_mon`），正是弃用它的原因之一。
4. GBK 和 UTF-8 能互相无损转吗？→ 只要字节↔字符用同一 charset 就对；乱码发生在编码一方、用另一方解码。
5. 时间戳单位？→ `Instant.epochSecond` 秒、`System.currentTimeMillis()` 毫秒、`nanoTime` 用于测耗时（非墙上时间）。
