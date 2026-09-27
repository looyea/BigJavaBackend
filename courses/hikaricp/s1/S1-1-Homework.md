# 连接池核心参数与故障表现 · 作业

## 作业 1：参数推算与压测

**目标**：根据给定机器配置计算最优池大小并压测验证。

1. 机器：8 核 CPU / 1 NVMe SSD / MySQL 同机部署。
2. 用公式 `cores×2 + spindles` 计算 maxPoolSize。
3. 分别设 maxPoolSize = 计算值、计算值×5、计算值×10，用 JMeter 500 并发 GET `/api/users` 持续 30s。
4. 记录 TPS、P99 延迟、`threadsAwaitingConnection` 峰值。

**验收**：提交表格对比，解释为何大池 TPS 不升反降。

## 作业 2：连接泄漏复现与修复

**目标**：编写一个故意泄漏连接的工具类，通过 leakDetectionThreshold 定位。

```java
// 目的：模拟泄漏
public class BrokenDao {
    public void query() throws SQLException {
        Connection conn = ds.getConnection();  // 借出
        conn.createStatement().execute("SELECT 1");
        // 错误用法：缺少 try-with-resources → conn 未归还
    }
}
```

1. 配置 `leak-detection-threshold=5000`。
2. 调用 10 次 `query()`，观察日志中的泄漏堆栈。
3. 用 try-with-resources 修复，验证不再报警。

## 作业 3：超时链路配置

**目标**：设计一套从客户端到 MySQL 的超时梯度。

场景：Spring Boot 应用 + Nginx + MySQL，接口正常响应 < 200ms。
1. 客户端请求超时 = 3s。
2. Nginx `proxy_read_timeout` = 5s。
3. Tomcat `asyncTimeout` = 8s。
4. HikariCP `connectionTimeout` = 10s。
5. MySQL `wait_timeout` = 28800s。

写出每层的作用和"为什么这样递减"的理由。
