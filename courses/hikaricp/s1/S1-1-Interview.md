# 连接池核心参数与故障表现 · 面试题

## 题 1：为什么 HikariCP 比 Druid/C3P0 快？

1. **FastList** 替代 ArrayList：省掉 rangeCheck，借用/归还是 O(1) 头尾操作。
2. **无 Filter 链**：JDBC Proxy 只做一层，减少方法调用栈。
3. **ConcurrentBag**：线程本地 `SynchronousQueue` + 全局 `ConcurrentLinkedQueue`，借连接优先用本线程缓存减少锁争用。
4. **字节码优化**：`javassist` 生成的 ProxyFactory 避免反射。

## 题 2：maxPoolSize 设了 200 反而 TPS 下降，为什么？

- MySQL 单实例的 IOPS / buffer pool 有限，并发写同一行时 InnoDB 行锁导致大量线程等锁。
- 200 活跃连接 × 每个 ~10MB buffer → 内存压力 → swap → 延迟飙升。
- Tomcat 线程池默认 200，若全卡在获取 DB 连接 → 无剩余线程处理新请求 → 雪崩。

## 题 3：生产报 "Failed to allocate connection"，如何 3 分钟内定位？

```bash
# 目的：快速诊断流程
# 步骤 1：看 HikariCP 指标
curl localhost:8080/actuator/metrics/hikaricp.connections.active
curl localhost:8080/actuator/metrics/hikaricp.connections.pending
# 输出：active=max, pending>0 → 确认池满

# 步骤 2：看 MySQL 进程列表
mysql -e "SHOW PROCESSLIST" | grep -v Sleep | wc -l
# 结果：如果 Sleep 占多数 → 连接被占用但未执行 SQL → 代码泄漏或事务未提交

# 步骤 3：看慢查询
mysql -e "SELECT * FROM information_schema.processlist WHERE time > 5"
```

## 题 4：@Transactional 和连接占用的关系？

```java
// 目的：理解事务边界 = 连接占用窗口
@Transactional  // 进入方法 → 借连接 → 开始事务
public void biz() {
    repo.save(a);   // 连接在手中
    httpClient.call(...);  // 错误用法：RPC 10s → 连接被占用 10s！
    repo.save(b);   // 仍然用同一连接
}  // 方法返回 → commit → 归还连接
// 说明：事务传播 REQUIRED 不会多占连接；REQUIRES_NEW 会从池中再借一个
```

最佳实践：事务方法内不做 RPC/IO，缩短连接占用时间。

## 题 5：keepaliveTime（4.3.1+）解决什么问题？

场景：容器化部署 + 云 LB（AWS NLB idle timeout=350s）→ 连接空闲超过 LB 超时被中间设备静默丢弃 → 下次借用报错。

```yaml
spring:
  datasource:
    hikari:
      keepalive-time: 300000  # 结果：每 5min 对空闲连接执行 ping（4.3.1+）
```

与 `validationTimeout` + 借出前 `isValid()` 的区别：keepalive 在后台做，不影响借出延迟。

## 题 6：如何优雅实现连接池指标上报 Prometheus？

```java
// 目的：Micrometer 自动绑定 HikariPoolMXBean
// Spring Boot Actuator 已自带 hikaricp.connections.* 指标
// 输出：/actuator/prometheus 中可见：
// hikaricp_connections_active{pool="HikariPool1"} 8.0
// hikaricp_connections_pending{pool="HikariPool1"} 3.0
// 说明：若 pending 持续 > 0，Grafana 告警规则触发 PagerDuty
```

自定义 Dashboard 关注：active / idle / pending / creation / timeout 五条曲线。
