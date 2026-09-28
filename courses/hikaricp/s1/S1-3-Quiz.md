# 连接泄漏、超时与故障定位 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. 连接泄漏指的是（6分）

- A. 数据库把连接断了
- B. 从池借出的连接没有被归还（未 close/异常漏还/存字段裸用）
- C. 密码泄露
- D. 内存溢出

> 答案：B
> 解析：借出没还是泄漏本质，可用连接被逐渐占光，最终 `getConnection` 超时。

### 2. HikariCP 用哪个参数打印"借出未还"的告警并附借出线程栈？（6分）

- A. `connectionTimeout`
- B. `leakDetectionThreshold`
- C. `maxLifetime`
- D. `idleTimeout`

> 答案：B
> 解析：连接借出超过该时长未归还即打 WARN + 借出点栈，直指哪段代码拿了没还。

### 3. 关于 `leakDetectionThreshold`，正确的说法是（6分）

- A. 到点会强制回收连接
- B. 只告警不回收，且阈值太短会把正常长事务误报成泄漏
- C. 设 0 最安全
- D. 与业务代码无关

> 答案：B
> 解析：它只提示不强制归还，必须自己修归还逻辑；阈值应按最长合理事务设，过短误报刷屏。

### 4. 报错 `Connection is not available, request timed out after 3000ms` 属于哪类超时？（6分）

- A. SQL 执行超时
- B. 借连接超时（`connectionTimeout`，指向池耗尽/泄漏）
- C. 事务超时
- D. 网络 socket 超时

> 答案：B
> 解析：这是从池借不到连接的超时，根因常是池被慢 SQL/泄漏占满，而非 DB 执行慢。

### 5. `Statement.setQueryTimeout` 与 `connectionTimeout` 的区别是（6分）

- A. 同一回事
- B. 前者是 SQL 执行超时（DB 慢），后者是借连接等待超时（池问题）
- C. 后者是前者子集
- D. 都只影响写操作

> 答案：B
> 解析：一个查 DB 执行慢，一个查池耗尽/泄漏；把二者混淆会导致朝错误方向调参。

### 6. 判断"池被占满"的典型指标组合是（6分）

- A. `active≈max` 且 `waiting>0`
- B. `idle=max`
- C. `active=0`
- D. `waiting=0`

> 答案：A
> 解析：活跃连接逼近上限且有人在排队等待，说明连接全被占住，多为泄漏或慢 SQL 长期占用。

### 7. 发现 `active≈max、waiting>0` 但无泄漏告警，最该做的下一步是（6分）

- A. 立刻把 `maximumPoolSize` 翻十倍
- B. 抓 jstack 线程栈，看持有连接的线程卡在哪个慢操作
- C. 重启数据库
- D. 关掉 `connectionTimeout`

> 答案：B
> 解析：连接被占住却不一定泄漏，可能是慢 SQL/外部调用长时间持有，线程栈能直接指出占用点。

### 8.（多选）下列做法会引发或掩盖连接泄漏问题的有（9分）

- A. 拿了 `Connection` 不用 try-with-resources、异常路径漏 close
- B. 把 `Connection` 存成实例字段跨方法使用
- C. 借不到连接就一味调大 `maximumPoolSize` 而不查占用者
- D. 合理设置 `leakDetectionThreshold` 并跟进告警

> 答案：A、B、C
> 解析：D 是正确治理不是坑；A/B 直接造成泄漏，C 用扩池掩盖根因会让占用继续恶化。

### 9.（多选）关于三类超时的定位方向，正确的有（9分）

- A. 借连接超时 → 看 `active/waiting` 与是否泄漏
- B. SQL 执行超时 → 查 DB 慢查询/锁等待
- C. 事务超时 → 关注 `@Transactional(timeout=)` 与事务内最慢操作
- D. 三种超时都靠加大池解决

> 答案：A、B、C
> 解析：D 错——把执行/事务超时当池问题去加池，方向完全错，应先定位慢在哪。

### 10. 大促期间服务频繁报 `Connection is not available, request timed out`，池 `active` 长期≈max、`waiting` 高，但泄漏告警很少。请给出定位与处置路线。（40分）

> 参考答案：
- 要点1：确认症状——`active≈max 且 waiting>0` 说明连接被占满而非"池太小"，先不要盲目加池（10分）
- 要点2：抓占用者——jstack 多次采样，看持有连接的线程卡在慢 SQL、远程调用还是死循环；结合 DB 侧锁等待/慢查询日志（10分）
- 要点3：缩短占用——为可疑语句设 `setQueryTimeout`、拆长事务、把外部调用移出事务、加索引/分页，降低单连接占用时长（10分）
- 要点4：治理与兜底——正确设 `leakDetectionThreshold`（按最长合理事务）跟进真实泄漏、按 `maxLifetime<wait_timeout` 排除死连接假象，并用容量公式复核池大小上限是否本就超 DB 承受力（10分）
