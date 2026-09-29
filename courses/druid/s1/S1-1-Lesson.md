# Druid 监控与过滤器链

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：理解 Druid Filter 链架构，掌握 StatFilter 慢 SQL 定位与 WallFilter 防注入配置，会保护监控台安全。

## 一、Druid 定位

Druid 是阿里开源的 JDBC 连接池，**核心卖点不是性能（HikariCP 更快），而是监控与防护能力**：
- SQL 执行统计（QPS、慢查询、错误率）
- SQL 防火墙（防注入、防全表删除）
- Web-Stat 页面（内置可视化面板）

## 二、Filter 链架构

```text
JDBC 请求 → FilterChain（Filter1 → Filter2 → ... → 真实 Connection/Statement）
```

| Filter | 职责 |
|--------|------|
| StatFilter | 采集 SQL 执行次数、耗时、错误 → 供监控台展示 |
| WallFilter | SQL 解析 → 黑白名单规则拦截危险语句 |
| Slf4jLogFilter | 把 JDBC 操作输出到日志框架 |
| ConfigFilter | 支持配置文件合并与加密 |

```java
// 目的：Spring Boot 配置 Druid 并注册 Stat + Wall 两个 Filter
@Bean
public FilterRegistrationBean<StatViewServlet> druidStatView() {
    FilterRegistrationBean<StatViewServlet> reg = new FilterRegistrationBean<>();
    reg.setFilter(new com.alibaba.druid.support.http.StatViewServlet());
    reg.addUrlPatterns("/druid/*");
    reg.setInitParameter("loginUsername", "admin");    // 说明：监控台账号
    reg.setInitParameter("loginPassword", "S3cr3t!");  // 结果：访问需登录
    reg.setInitParameter("allow", "127.0.0.1");         // 输出：仅允许本机访问
    return reg;
}
// 错误用法：不设 allow/loginPassword → 公网暴露监控台 → SQL 明文泄露
```

## 三、StatFilter 慢 SQL 定位

### 3.1 配置

```yaml
spring:
  datasource:
    type: com.alibaba.druid.pool.DruidDataSource
    druid:
      filters: stat,wall                      # 结果：启用统计和防火墙
      stat:
        log-slow-sql: true                    # 开启慢 SQL 日志
        slow-sql-millis: 2000                 # 阈值：超过 2s 记为慢 SQL
      web-stat-filter:
        enabled: true                         # 说明：URL 级统计（URI 维度）
```

### 3.2 监控台关键面板

访问 `http://localhost:8080/druid/sql.html`：
- **SQL 查询列表**：按执行次数、耗时排序。
- **URI 监控**：接口 → SQL 调用链路。
- **数据源统计**：活跃连接、等待线程、销毁重建次数。

```java
// 目的：代码中获取慢 SQL 统计（非监控台，而是埋点上报）
DruidDataSource ds = (DruidDataSource) dataSource;
DruidStatManagerFacade facade = DruidStatManagerFacade.getInstance();
List<DruidDataSourceStatValue> stats = facade.getDataSourceStatList();
// 输出：每个连接池的 ExecSqlMillisMax、ExecutingSqlCount 等
for (var s : stats) {
    if (s.getExecSqlMillisMax() > 5000) {
        // 错误用法：不告警 → 慢 SQL 堆积拖垮线程池
        log.warn("发现超过 5s 的慢 SQL，数据源={}", s.getName());
    }
}
```

## 四、WallFilter 防 SQL 注入

### 4.1 规则配置

```java
// 目的：禁止 DELETE 不带 WHERE、禁止多语句执行
@Bean
public WallConfig wallConfig() {
    WallConfig config = new WallConfig();
    config.setDeleteWhereNoneCheck(true);    // 结果：DELETE 无 WHERE → 拦截抛异常
    config.setMultiStatementAllow(false);    // 说明：禁止 "SELECT 1; DROP TABLE x"
    config.setNoneBaseStatementAllow(false); // 禁止非基础语句
    return config;
}

@Bean
public Filter wallFilter() {
    WallFilter wf = new WallFilter();
    wf.setConfig(wallConfig());  // 输出：注入到连接池的 Filter 链
    return wf;
}
```

### 4.2 触发效果

```java
// 目的：模拟恶意 SQL 被 WallFilter 拦截
String sql = "DELETE FROM users";  // 无 WHERE 条件
// 错误用法：直接执行 → WallFilter 抛 WallCommonException: "sql injection violation"
stmt.execute(sql);  // 结果：语句被拦截，业务层捕获异常记录安全日志
```

## 五、与 HikariCP 选型对比

| 维度 | Druid | HikariCP |
|------|-------|----------|
| 性能 | 中等（Filter 链开销） | 极致（无多余抽象） |
| 监控 | 内置完善 | 需 Micrometer 外接 |
| 防护 | WallFilter 独有 | 无 |
| 适用 | 内部系统 / 金融合规 | 互联网高并发 |

## 六、关联技术

- Spring Boot Actuator + Micrometer（指标暴露）
- Grafana + Prometheus（可视化告警）
- p6spy（SQL 分析替代方案）
- Mybatis-Plus 集成 Druid 多数据源
