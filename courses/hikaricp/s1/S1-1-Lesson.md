# 连接池核心参数与故障表现

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：能根据业务 QPS 推算 optimal pool size，快速定位连接泄漏与超时链路故障。

## 一、为什么连接池重要

数据库连接是稀缺资源：MySQL 默认 `max_connections=151`；每次 TCP + 认证 + SSL 握手耗时 ~20ms。连接池复用物理连接，降低建连开销并限制并发访问 DB 的线程数。

HikariCP 是 Spring Boot 2.x+ 默认连接池，以**字节码级精简**（无 Filter 链、直接操作 FastList）实现微秒级借还。

## 二、核心参数

### 2.1 maximumPoolSize

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10  # 结果：池内最多 10 个连接（含活跃+空闲）
```

**容量公式**（来源 HikariCP 官方 wiki）：

\[ \text{optimal threads} = \text{core\_count} \times 2 + \text{effective\_spindle\_count} \]

例：4 核 SSD → 4×2+1=9 ≈ 10。大池不等于高性能——超过 CPU 核心数后线程上下文切换反降吞吐。

### 2.2 minimumIdle

```yaml
      minimum-idle: 10  # 说明：与 max 相同则固定大小（推荐），不同则为弹性池
```

### 2.3 connectionTimeout

```yaml
      connection-timeout: 30000  # 结果：获取连接最多等 30s，超时抛 SQLTransientConnectionException
```

**故障表现**：线程 dump 中看到大量 `WAITING on HikariPool.getConnection()` → 池耗尽。

### 2.4 idleTimeout / maxLifetime

```yaml
      idle-timeout: 600000      # 空闲连接 10min 后回收
      max-lifetime: 1800000     # 连接最大存活 30min（必须 < MySQL wait_timeout）
```

### 2.5 leakDetectionThreshold

```yaml
      leak-detection-threshold: 60000  # 结果：借出超 60s 未归还 → 日志打印借出堆栈
```

```java
// 目的：模拟连接泄漏——借出后忘记 close
Connection conn = dataSource.getConnection();  // 借出
// ... 执行业务但异常路径未归还
// 输出：60s 后日志 WARN "Connection leak detection triggered" + 堆栈定位泄漏行
```

## 三、超时链路全景

```text
客户端超时(3s) → 网关超时(5s) → Tomcat 线程(10s) → HikariCP connectionTimeout(30s) → MySQL(默认无限)
```

**原则**：下游超时 < 上游超时，否则上游已释放连接，下游拿到后做无用功。

```java
// 目的：设置合理的超时梯度
// HikariCP 获取连接超时 3s（而非默认 30s）
props.setMaximumPoolSize(10);
props.setConnectionTimeout(3000);  // 结果：3s 拿不到连接快速失败
// 错误用法：connectionTimeout=30000 > Tomcat asyncTimeout=10000 → 线程先被 kill → 连接归还时找不到上下文
```

## 四、常见故障排查

### 4.1 池耗尽（Pool Exhaustion）

**症状**：`Connection is not available, request timed out after 30000ms`。

```java
// 目的：通过 MBean 实时监控活跃连接数
HikariPoolMXBean poolBean = hikariDS.getHikariPoolMXBean();
log.info("Active={}, Idle={}, Waiting={}, Total={}",
    poolBean.getActiveConnections(),    // 输出：正在使用的连接数
    poolBean.getIdleConnections(),      // 结果：空闲可借
    poolBean.getThreadsAwaitingConnection(), // 等待线程数（>0 说明池满）
    poolBean.getTotalConnections());
// 说明：若 Waiting 持续增长 + Active=max → 确认池耗尽
```

**根因分类**：
1. 慢 SQL 长时间占用连接 → 优化 SQL。
2. 并发过高 → 加池/限流。
3. 连接泄漏 → 调低 leakDetectionThreshold。

### 4.2 连接失效（Stale Connection）

MySQL 端 `wait_timeout=8h` 或网络闪断 → 池中连接半开 → 第一次 execute 抛异常。

```yaml
# 目的：maxLifetime 确保连接在 MySQL 超时前主动销毁
max-lifetime: 1200000   # 20min < MySQL wait_timeout=8h
# 说明：HikariCP 在借出时不做 SELECT 1 探活（太慢），靠 maxLifetime 保证新鲜
```

## 五、HikariCP vs Druid 参数映射

| 概念 | HikariCP | Druid |
|------|----------|-------|
| 最大连接 | maximumPoolSize | maxActive |
| 最小空闲 | minimumIdle | minIdle |
| 借出超时 | connectionTimeout | maxWait |
| 存活上限 | maxLifetime | phyMaxUseCount |
| 泄漏检测 | leakDetectionThreshold | removeAbandoned |

## 六、关联技术

- MySQL `wait_timeout` / `interactive_timeout`
- Spring `@Transactional` 与事务传播对连接占用的影响
- 云原生环境下的 `keepaliveTime`（防 LB idle timeout）
- 连接池指标暴露给 Micrometer → Grafana 告警
