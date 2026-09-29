# 数值精度、日期时间与字符编码

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：彻底告别三大会毁线上的基础坑——① 金额用 `double` 算错账、② 用旧的 `Date/Calendar/SimpleDateFormat`（线程不安全、时区/夏令时算错）、③ 编码不一致导致的乱码。掌握 `BigDecimal` 正确构造与舍入、`java.time` 的Instant/本地时间/带区时间三分法与 UTC 存储策略、UTF-8 与 UTF-16 `char` 的关系及 `String.length()` 陷阱。

## 一、金额与精度：BigDecimal（★★★★★）

**为什么不能用 double/float**：它们按 IEEE-754 **二进制**表示小数，很多十进制小数（如 0.1）是无限循环二进制，存的就是近似值：

```java
System.out.println(0.1 + 0.2);         // 0.30000000000000004 —— 经典翻车
System.out.println(0.1 + 0.2 == 0.3);  // false
```

**BigDecimal 三条铁律**：

```java
new BigDecimal(0.1);              // ❌ 用 double 构造，把 0.1 的二进制误差也带进来 → 0.1000000000000000055...
new BigDecimal("0.1");            // ✅ 字符串构造，精确
BigDecimal.valueOf(0.1);          // ✅ 内部走 Double.toString，也可
```

1. **只用 String 构造或 `valueOf`**，绝不用 `double` 构造。
2. **比较用 `compareTo` 不用 `equals`**：`equals` 连标度一起比，`new BigDecimal("1.0").equals(new BigDecimal("1.00"))` 为 false（呼应 s1-4 的 TreeSet 吞元素事故）。
3. **除法/需定精度的运算必须给 scale + RoundingMode**，否则除不尽直接抛 `ArithmeticException`：

```java
a.divide(b, 2, RoundingMode.HALF_UP);   // 保留 2 位、四舍五入
BigDecimal money = amt.setScale(2, RoundingMode.HALF_EVEN); // 银行家舍入（金融常用，减少系统性偏差）
```

`BigDecimal` **不可变**（运算返回新对象）。**存储与高性能**：数据库用 `DECIMAL(p,s)`；超高频账务（如计数、余额累加）常用**最小货币单位的 `long`（分）**规避对象开销，只在展示层转元。舍入模式要全团队统一，别一半 `HALF_UP` 一半 `HALF_EVEN`。

## 二、日期时间：java.time（JSR-310）（★★★★★）

**为什么弃用 `Date/Calendar/SimpleDateFormat`**：`Date` 可变、月份从 0 开始、`Calendar` 笨重，而 `SimpleDateFormat` **线程不安全**——把它放成静态/单例字段在并发下解析出错乱日期，是老牌线上事故。`java.time` 全部**不可变、线程安全**。

**核心类型三分法**：

| 类型 | 含义 | 用途 |
| --- | --- | --- |
| `Instant` | 时间线上的**绝对瞬间**（UTC 纳秒） | 存储、计时、跨时区比较 |
| `LocalDate`/`LocalTime`/`LocalDateTime` | **无时区**的"墙上时间" | 生日、营业时段、不含区的具体时刻 |
| `ZonedDateTime`/`OffsetDateTime` | 带**时区/偏移**的时间 | 需要"某地几点"且要正确换算/夏令时的场景 |

配套 `Duration`（时间量）、`Period`（日期量）、`ZoneId`、`DateTimeFormatter`（线程安全）。

**时区与夏令时两大坑**：

```java
ZoneId beijing = ZoneId.of("Asia/Shanghai");
// 1) 别假设一天 = 86400 秒：有夏令时的地区，切换当天是 23h 或 25h
//    跨"日"计算要用 ZoneId + ChronoUnit，别硬乘 24*3600
long days = ChronoUnit.DAYS.between(start.toInstant(), end.toInstant()); // 交给带区/时刻语义算
// 2) LocalDateTime 不含时区，无法表示"绝对时刻"，跨区比较/存库会错 → 用 Instant/ZonedDateTime
```

**存储策略（架构级）**：**数据库统一存 UTC（`Instant`/带时区 TIMESTAMP），展示时才按用户 `ZoneId` 转本地**。别存"服务器本地时间"又不带区，跨机房/多时区用户必乱。`DateTimeFormatter` 用常量（不可变、线程安全），彻底替换 `SimpleDateFormat`。

## 三、字符编码：UTF-8 与乱码根因（★★★★★）

先分清概念：**字符集**（Unicode：给每个字符一个码点）vs **编码**（怎么把码点存成字节：UTF-8/UTF-16/GBK）。UTF-8 是**变长 1~4 字节**、兼容 ASCII 的编码。

**Java `String` 内部是 UTF-16**，`char` 是一个 UTF-16 码元。**坑**：emoji、部分生僻字属"增补字符"，占**两个 `char`（代理对 surrogate pair）**，于是：

```java
"😀".length();                 // 2！不是 1（一个 emoji = 两个 char 码元）
"😀".codePointCount(0, 2);     // 1 —— 数"字符"要用 codePoint
```

**乱码根因只有一条**：**编码（写）与解码（读）用了不同 charset**。经典现场：

- `new String(bytes)` / `str.getBytes()` **不指定字符集**，走**平台默认编码**——开发机 GBK、服务器 UTF-8，一换环境就乱。
- "锟斤拷"：UTF-8 的非法字节被替换成 U+FFFD（EF BF BD），再被当 GBK 解码的产物。
- 方块问号/乱字符：GBK 编码的中文字节流被当成 UTF-8 解码（GBK 双字节序列在 UTF-8 里多为非法组合）。
- 用 `ISO-8859-1` 做中转丢字节（它单字节、容错地把高位当 latin）。

**对策**：

1. **任何 `byte[]↔String` 转换都显式传 `StandardCharsets.UTF_8`**：`new String(b, UTF_8)`、`s.getBytes(UTF_8)`、`new InputStreamReader(in, UTF_8)`。
2. **端到端统一 UTF-8**：HTTP（`Content-Type; charset=UTF-8`、响应头）、数据库连接（`characterEncoding=utf8`/`useUnicode`）、文件、消息体，缺一处乱一处。
3. 网络/存储用 UTF-8；注意某些平台的 **BOM**（`EF BB BF`）会污染首字段。

## 四、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 对账差几分钱 | 用 double 算金额 / BigDecimal 用了 double 构造 / 舍入模式不统一 |
| 并发下解析出错误日期 | 静态 `SimpleDateFormat` 被多线程共享（线程不安全） |
| 跨时区订单时间全错、定时任务错点 | 存了无区 LocalDateTime / 假设一天 86400 秒忽略夏令时 |
| 中文/emoji 入库或接口返回乱码 | byte↔String 未指定 UTF-8，走平台默认编码 |
| 字段长度校验 emoji 被截半 | 用 `String.length()` 数 char 而非 codePoint，代理对被拆开 |

## 五、动手题

1. 写一段用 `double` 循环累加 0.1 一万次的代码，对比 `BigDecimal`/`long`(分) 的结果与耗时，体会误差与性能。
2. 把一个静态 `SimpleDateFormat` 放 8 线程并发解析同一字符串，复现错乱；换成 `DateTimeFormatter` 验证线程安全。
3. 取一个含 emoji 的字符串，分别打印 `length()`、`codePointCount(...)`，并故意 `new String(s.getBytes("GBK"), "ISO-8859-1")` 观察乱码，再全链路统一 UTF-8 修复。

## 六、关联技术栈

- **向前**：`equals` vs `compareTo`（BigDecimal 标度）↔ s1-4；装箱 `long`(分) 性能 ↔ s1-4
- **持久层**：`DECIMAL(p,s)`/时区 TIMESTAMP 落库 ↔ 数据库与缓存分区；连接字符集参数 ↔ persistence
- **Web**：HTTP `charset=UTF-8`、`@RequestParam`/`MessageConverter` 编码 ↔ spring-mvc s2-1
- **分布式**：跨机房时间统一 UTC、雪花 ID 时钟回拨 ↔ 分布式系统分区

## 七、本节小结

这三块没有"高深原理"，却有最高频的线上事故，共性是**"近似/默认值"在关键处致命**：金额别碰 double、时间别用无区类型和共享 SimpleDateFormat、编码别依赖平台默认。**统一 UTF-8、统一 UTC 存储、金额用 BigDecimal(String)/long 分**——把这三条刻进团队规范。

至此阶段二收官。下一节进入阶段三，先看 IO 流分层与序列化的坑。
