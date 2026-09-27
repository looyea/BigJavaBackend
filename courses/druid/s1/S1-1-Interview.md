# Druid 监控与过滤器链 · 面试题

## 题 1：为什么选了 Druid 而不是 HikariCP？什么时候该切回 HikariCP？

**选 Druid 的场景**：
- 需要内置 SQL 监控与慢查询面板（不想接外部 APM）。
- 金融/政企有 SQL 审计合规要求 → WallFilter 天然提供。
- 已有阿里系技术栈（如 MyBatis-Plus 官方推荐）。

**切回 HikariCP 的场景**：
- 追求极致吞吐（Filter 链每次 JDBC 调用多 2-3 层代理开销）。
- 微服务网关层只需连接池不需监控，用 Actuator 更轻量。

## 题 2：Druid Filter 链与 JDBC 规范的关系？

JDBC 规范定义了 `javax.sql.DataSource` → `Connection` → `Statement` 的调用链。Druid 在每一层包装了 `Proxy`，Filter 链在代理的前后逻辑中执行：
- `eventBeforeExecute(sql)` → WallFilter 在此解析并决定是否放行。
- `eventAfterConnectionConnected()` → StatFilter 计时记录。

每个 Filter 实现 `FilterEventAdapter`，可选择性覆心感兴趣的事件点。

## 题 3：StatFilter 的统计维度有哪些？如何导出？

```java
// 目的：通过 JMX 或 HTTP API 导出统计
// 维度1：数据源级——连接数/等待/错误
DruidDataSourceStatValue dsVal = DruidStatManagerFacade.getInstance()
    .getDataSourceStatList().get(0);
// 输出：PoolingCount、ActiveCount、ConnectCount、ErrorCount

// 维度2：SQL 级——执行次数/耗时分布/最大最小
SQLStatValue sqlVal = ...; // 从 /druid/datasource.json 获取
// 结果：ExecuteCount、TotalTime、MaxTimespan、LastError

// 维度3：URI 级——接口调用频次/响应时间
// 说明：由 WebStatFilter 采集，/druid/weburi.json 获取
```

导出方式：`/druid/json.json`（全量）→ 定时抓取写入 Prometheus + Grafana。

## 题 4：WallFilter 能完全替代 PreparedStatement 防注入吗？

**不能**。二者互补：
- `PreparedStatement` 的参数化查询（`#{}`）在驱动层防值注入。
- `WallFilter` 在 SQL 文本层拦截结构性攻击（如拼接 OR 1=1、UNION SELECT、DROP）。

```java
// 目的：即使 PreparedStatement 正确，仍可能被拼接绕过
String safeSql = "SELECT * FROM users WHERE name = ?";  // 说明：参数化
// 错误用法：拼接 IN 子句
String sql = "SELECT * FROM users WHERE id IN (" + userIds + ")";
// WallFilter 可在运行时解析最终拼接出的 sql，发现异常结构则拦截
```

最佳实践：MyBatis `#{}` + Druid WallFilter 双层防护。

## 题 5：生产环境如何优雅关闭 Druid 监控台？

```yaml
# 目的：彻底移除监控台 HTTP 端点
spring:
  datasource:
    druid:
      stat-view-servlet:
        enabled: false          # 结果：不注册 StatViewServlet，/druid/* 404
      web-stat-filter:
        enabled: false          # 说明：关闭 URI 统计采集
```

或通过 `@Profile("!prod")` 条件注册 StatViewServlet Bean，生产环境不加载。

## 题 6：连接泄漏如何用 Druid 检测？

```yaml
spring:
  datasource:
    druid:
      remove-abandoned: true                    # 开启泄漏检测
      remove-abandoned-timeout-millis: 180000   # 超过 3min 未归还视为泄漏
      log-abandoned: true                       # 抛异常并打印获取连接的堆栈
```

```java
// 目的：模拟泄漏——借出连接不 close
Connection conn = dataSource.getConnection();
// 执行 SQL 但忘记 conn.close()
// 结果：180s 后 Druid 强制回收 + 日志打印借出时的调用栈，定位泄漏代码行
// 错误用法：生产设 remove-abandoned=true 但 timeout 太短 → 慢事务被误杀
```

注意：remove-abandoned 有性能开销（定时线程遍历），仅建议测试/预发环境开启。
