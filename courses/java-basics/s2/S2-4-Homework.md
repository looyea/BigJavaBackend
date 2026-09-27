# 作业题 · 数值精度、日期时间与字符编码

> 不判分，对照参考要点自查。

## 作业 1：误差可视化（必做）

循环累加 0.1 共 10 万次，分别用 `double`、`BigDecimal(double构造)`、`BigDecimal(String构造)`、`long`(以分/毫为单位) 四种方式，打印最终值与耗时。

**结论**：说明前两种为何偏离 10000.0、BigDecimal 的性能代价、以及"高频账务用最小货币单位 long"的取舍。

## 作业 2：BigDecimal 规范落地（必做，本节核心）

实现 `money` 工具类：`add/subtract/multiply`（乘法后 `setScale(2, HALF_UP)`）、`divide(a,b)`（强制 scale+RoundingMode）、`eq(a,b)` 用 `compareTo`。写单测覆盖：`0.1+0.2`、除不尽（1/3）、`1.0 vs 1.00` 比较。

## 作业 3：SimpleDateFormat 并发翻车（必做）

把一个静态 `SimpleDateFormat` 放到 8 线程并发 `parse("2026-01-01 12:00:00")`，复现 `NumberFormatException`/错误日期；改用静态 `DateTimeFormatter` 常量验证线程安全。再演示：数据库存 UTC `Instant`、按 `Asia/Shanghai` 与 `America/New_York` 分别展示同一时刻。

## 作业 4：时区与夏令时（选做）

选一个有夏令时的时区（如 `America/New_York`），用 `ZonedDateTime` 计算跨越"春季拨快"那天的 `+24h` 与 `+1 天` 的差别，观察本地时间跳变。说明"存 UTC + 展示转本地"如何规避定时任务错点。

## 作业 5：全链路统一 UTF-8 排查（选做，架构师向）

造一个"接口返回中文/emoji 到前端乱码"的复现工程，逐环节检查并修复：文件读取流 charset、`new String(bytes)`、HTTP `Content-Type; charset`、`MappingJackson2HttpMessageConverter`、数据库连接参数、HTML `<meta charset>`。产出一张"字节↔字符 转换点清单"，标注每处必须显式 UTF-8 的位置；并用 `codePointCount` 修正"昵称长度校验对 emoji 算错"的 bug。
