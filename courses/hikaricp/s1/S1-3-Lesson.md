# 连接泄漏、超时与故障定位

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：能把"连不上数据库"这一大类线上故障，拆成**泄漏、超时、池耗尽**三条可定位的线索，而不是无脑加大池。连接泄漏 = 借出的连接没被归还（未 `close`、未走 try-with-resources、异常路径漏还、把 `Connection` 存成字段跨方法裸用），池里的可用连接被逐渐占光，最终 `getConnection` 超时抛 `Connection is not available, request timed out after ...`。HikariCP 用 **`leakDetectionThreshold`** 抓现行：某连接借出超过该时长仍未归还，就打一条**带借出线程栈**的 WARN，直接指向"哪段代码拿了没还"——注意它**只告警不强制回收**，必须自己修归还逻辑，且阈值太短会把正常长事务误报成泄漏刷屏，需按最长合理事务设。要**严格区分三类超时**：①**借连接超时**（`connectionTimeout`，池耗尽/泄漏的症状，报 `request timed out`）；②**SQL 执行超时**（`Statement.setQueryTimeout` / JDBC `socketTimeout`，是数据库执行慢，不是拿不到连接）；③**事务超时**（Spring `@Transactional(timeout=)`，超过则回滚）。**池耗尽的假象**是"看起来池太小"，真因常是慢 SQL 或泄漏把连接占住：读池指标 `active/idle/waiting`（`HikariPoolMXBean` 或 Micrometer `hikaricp_connections_active`/`_pending`），`active≈max` 且 `waiting>0` 说明全被占；再抓 **jstack 线程栈**看持有连接的线程卡在哪（慢查询/外部调用/死循环）。识破"泄漏 WARN 只当噪音忽略""借不到连接就一味调大 `maximumPoolSize` 掩盖泄漏""把 SQL 超时误当连接超时去改池参数"等坑——电商大促、金融批量任务里的长事务未还是池耗尽的头号常客。

## 一、用 leakDetectionThreshold 抓未归还

```java
// 目的：让"借出没还"的连接自己现形——超时未归还即打印借出线程栈
@Configuration
public class DataSourceConfig {
    @Bean
    public HikariDataSource ds() {
        HikariConfig c = new HikariConfig();               // 说明：显式构建池配置, 便于逐项讲清超时语义
        c.setLeakDetectionThreshold(60_000);               // 结果：借出超 60s 未还 → 打 WARN 并附借出点线程栈, 定位谁拿了没 close
        c.setConnectionTimeout(3_000);                     // 说明：借不到连接 3s 快速失败, 报 "request timed out" 指向池耗尽/泄漏
        c.setValidationTimeout(1_000);                     // 说明：借出前校验连接存活的最大耗时, 避免把死连接交给业务
        return new HikariDataSource(c);                    // 反例：业务拿 Connection 不用 try-with-resources/不 finally close ❌ 池被占满
    }
}
```

## 二、三类超时不是一回事

```text
图目的：把"超时"拆成借连接/执行/事务三条独立线索, 定位方向完全不同
① 借连接超时: connectionTimeout → 报 "Connection is not available, request timed out" → 指向池耗尽/泄漏(查 active/waiting)
② SQL 执行超时: Statement.setQueryTimeout / JDBC socketTimeout → DB 端慢(慢SQL/锁等待), 与池大小无关
③ 事务超时: @Transactional(timeout=) → 超点回滚, 卡点仍在事务内的某次慢操作
误区: 把②当成①去加池、或把①当成②去调 queryTimeout, 都会南辕北辙
```

## 三、正确归还 + 池耗尽定位

```java
// 目的：正确的"借还"姿势——try-with-resources 保证异常路径也归还, 从源头防泄漏
public List<Order> query(long uid) throws SQLException {
    try (Connection c = ds.getConnection();                 // 说明：出 try 块(含异常)自动 close→归还池, 不会泄漏
         PreparedStatement ps = c.prepareStatement(SQL)) {   // 反例：把 Connection 存字段/跨方法裸用, 忘还 ❌ 池逐渐耗尽
        ps.setQueryTimeout(5);                               // 结果：这是"SQL 执行超时", 与借连接的 connectionTimeout 是两回事
        try (ResultSet rs = ps.executeQuery()) {             // 说明：慢 SQL 会长时间占住连接, 配合池指标与 jstack 定位占用者
            return map(rs);
        }
    }
}
```

## 四、坑与底线

- **泄漏 WARN 必须当 error 追**：`leakDetectionThreshold` 只告警不回收，忽略它=等着池耗尽雪崩。
- **先看指标再动手**：`active≈max && waiting>0` 是被占满（多为泄漏/慢 SQL），别反射性加大 `maximumPoolSize`。
- **jstack 定位持有者**：抓线程栈看占着连接的线程卡在慢查询/外部调用/死循环，从根上缩短占用时长。

## 五、关联课程

三类超时对应的核心参数与典型故障表现见 [连接池核心参数与故障表现](./S1-1-Lesson.md)；池大小/`connectionTimeout` 的合理基线承接 [连接池参数调优与容量测算](./S1-2-Lesson.md)；借不到连接时"加大池还是查 DB 承受力"的取舍见 [连接池参数调优与容量测算](./S1-2-Lesson.md)。
