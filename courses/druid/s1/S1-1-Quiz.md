# Druid 监控与过滤器链 · 小测

### 1. Druid 相比 HikariCP 的核心差异化优势是？（6分）

- A. 连接获取速度更快
- B. 内置监控台与 SQL 防火墙
- C. 内存占用更低
- D. 支持更多数据库方言

> 答案：B
> 解析：Druid 卖点是 Filter 链带来的 StatFilter（监控）和 WallFilter（防护），HikariCP 胜在性能。

### 2. Druid Filter 链的执行模型类似于？（6分）

- A. Java IO 装饰器模式
- B. Servlet Filter 责任链
- C. 观察者模式
- D. 策略模式

> 答案：B
> 解析：请求依次经过 Filter1→Filter2→...→目标对象，每个 Filter 可前后处理，典型责任链。

### 3. StatFilter 的 slow-sql-millis 配置含义是？（6分）

- A. SQL 执行超时后自动 kill
- B. 执行耗时超过该值则记录为慢 SQL
- C. 连接等待超时时间
- D. 统计窗口大小

> 答案：B
> 解析：超过阈值的 SQL 写入 slow-sql 日志，供监控台查看排序。

### 4. WallFilter 的 setMultiStatementAllow(false) 可防止哪种攻击？（6分）

- A. LIKE 模糊查询导致全表扫描
- B. "'; DROP TABLE users; --" 多语句注入
- C. SELECT * FROM 慢查询
- D. 连接池耗尽

> 答案：B
> 解析：禁止一条 JDBC 执行分号分隔的多条 SQL，经典注入方式被拦截。

### 5. Druid 监控台 /druid/* 暴露到公网的最大风险是？（6分）

- A. 响应变慢
- B. 泄露所有执行过的 SQL 明文和连接池状态
- C. 无法使用 WallFilter
- D. 连接池自动关闭

> 答案：B
> 解析：监控台展示完整 SQL（含参数）、IP、表结构信息，公网暴露等于数据库信息全泄露。

### 6. 以下哪项不是 Druid 内置 Filter？（6分）

- A. StatFilter
- B. WallFilter
- C. MetricsFilter
- D. Slf4jLogFilter

> 答案：C
> 解析：Druid 没有 MetricsFilter；对接 Prometheus 需外部 druid-spring-boot-starter + micrometer 桥接。

### 7. ConfigFilter 的主要用途是？（6分）

- A. 自动配置数据库连接参数
- B. 支持配置文件合并与数据库密码加密
- C. 动态修改 WallFilter 规则
- D. 加载多个数据源

> 答案：B
> 解析：ConfigFilter 可从指定路径合并配置，并配合 ConfigTool 加密 connectionPassword。

### 8. 正确保护 Druid 监控台的措施包括（多选）？（9分）

- A. 设置 loginUsername 和 loginPassword
- B. 配置 allow 白名单限制 IP
- C. 将 resetEnable 设为 true 方便调试
- D. 生产环境用 Nginx 反向代理加鉴权
- E. 配置 deny 黑名单排除恶意 IP

> 答案：A、B、D、E
> 解析：C 错——resetEnable=true 允许远程 resetAll 清空统计，生产必须关闭。

### 9. 关于 Druid 连接池参数说法正确的是（多选）？（9分）

- A. initialSize 是启动时创建的连接数
- B. maxActive 等于 maximumPoolSize（HikariCP）
- C. minIdle 为 0 时连接池不会保留空闲连接
- D. maxWait 是获取连接的最大等待时间，超时抛 SQLException

> 答案：A、B、D
> 解析：C 错——minIdle=0 理论上回收全部空闲连接但实际仍有 keepAlive 机制；A/B/D 正确。

### 10. 简答题：描述 Druid Filter 链的工作原理，并举例说明 StatFilter 和 WallFilter 分别在链中做什么？（40分）

- 要点1：Filter 链类似责任链模式，JDBC 方法调用被逐层代理
- 要点2：StatFilter 在语句执行前后计时，记录执行次数、耗时分布、错误计数到内存快照
- 要点3：WallFilter 在语句执行前解析 SQL AST，检查是否违反规则（无 WHERE 删除/多语句/UNION 注入）
- 要点4：若 WallFilter 判定违规直接抛异常中断链，后续 Filter 和目标对象不执行

> 答案：见要点
> 解析：Filter 顺序影响行为——Wall 在 Stat 前面则被拦截的 SQL 不计入统计。
