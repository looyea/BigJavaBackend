# 分片、幂等与失败补偿

> 本节难度：★★★★☆
> 本节重要性：★★★★☆
> 学习产出：设计分片并行任务、实现幂等防护、配置失败重试与告警补偿流程。

## 一、分片模型

### 1.1 核心概念

```text
sharding-total-count=10（总分片数）
实例 A → items: 0, 1, 2, 3, 4
实例 B → items: 5, 6, 7, 8, 9
每个 item 对应一"片"数据（如一张分表、一批用户 ID 段）
```

```java
// 目的：分片任务处理——每个实例只处理属于自己的分片数据
@XxlJob("reconcileShardHandler")
public void reconcile() {
    int shardIndex = XxlJobHelper.getShardIndex();   // 输出：当前分片号
    int shardTotal = XxlJobHelper.getShardTotal();    // 结果：总分片数
    // 说明：shardIndex=2, shardTotal=10 → 处理 id % 10 == 2 的记录
    List<Record> records = recordRepo.findByMod(shardTotal, shardIndex);
    records.forEach(this::process);                   // 结果：只处理本片数据
}
// 错误用法：分片算法不一致——Producer 按 %10 分片，Consumer 按 /10 取整 → 数据遗漏
```

### 1.2 ElasticJob 分片策略

| 策略 | 分配算法 | 适用 |
|------|----------|------|
| AVG_ALLOCATION | 轮询均匀 | 各分片等重 |
| RANDOM | 随机 | 避免热点 |
| ROUND_ROBIN | 按实例轮转 | 多 Job 共享实例 |

## 二、幂等设计

### 2.1 为什么调度会重复触发

- Admin 认为超时 → 重试触发。
- 网络抖动 → 同一调度请求到达 Executor 两次。
- 人工手动重跑。

### 2.2 幂等方案

```java
// 目的：日期+分片号 作为唯一键，重复触发时 INSERT 冲突 → 跳过
public void processShard(int shardIndex, LocalDate date) {
    String idempotentKey = date + "-" + shardIndex;  // 说明：全局唯一
    try {
        jdbc.update("INSERT INTO job_exec_log(key,status) VALUES(?,?)",
            idempotentKey, "RUNNING");  // 结果：首次成功插入
        doBusinessLogic(shardIndex, date);            // 输出：执行业务
        jdbc.update("UPDATE job_exec_log SET status='DONE' WHERE key=?",
            idempotentKey);                           // 标记完成
    } catch (DuplicateKeyException e) {
        log.info("重复触发，跳过 key={}", idempotentKey);  // 错误用法防护：直接跳过
    }
}
```

## 三、失败重试与补偿

### 3.1 XXL-Job 失败重试配置

```yaml
# Admin 任务配置
executorFailRetryCount: 3   # 结果：失败后自动重试 3 次
executorTimeout: 600         # 说明：单次执行超时 600s
```

```java
// 目的：任务体内部自行处理可恢复异常
@XxlJob("payNotifyHandler")
public void payNotify() {
    try {
        notifyService.batchSend();  // 可能因下游超时抛异常
    } catch (TimeoutException e) {
        XxlJobHelper.handleFail("下游超时，等待下次调度重试");  // 结果：Admin 记录失败
        // 说明：不 throw → Admin 视为本次失败但不影响下次触发
    }
}
// 错误用法：throw RuntimeException → 同样标记失败；但如果 Admin 重试策略配 0 → 不重试
```

### 3.2 补偿任务模式

```java
// 目的：主任务失败后由独立补偿 Job 兜底
@XxlJob("reconcileCompensateHandler")
public void compensate() {
    // 说明：扫描未完成分片（status != DONE 且 创建时间 < 1h）
    List<JobExecLog> failed = logRepo.findIncomplete(Duration.ofHours(1));
    for (JobExecLog log : failed) {
        processShard(log.getShardIndex(), log.getDate());  // 输出：重新执行该分片
        log.setStatus("DONE");
        logRepo.save(log);                                  // 结果：标记完成
    }
}
// Cron: 0 */10 * * * ?  每 10 分钟扫描一次
```

## 四、告警设计

| 告警项 | 阈值 | 通道 |
|--------|------|------|
| 执行失败 | 连续 2 次 | 钉钉/企微 Webhook |
| 超时未完成 | > 预期时间×2 | PagerDuty |
| 分片遗漏 | 完成数 < 总数 | 补偿 Job 自动补 |
| 调度停止 | Admin 心跳丢失 | 运维值班 |

## 五、关联技术

- 幂等令牌（前端防重复提交 + 调度防重复触发）
- Saga 补偿：主流程失败后逆向回滚
- 分布式锁保护：Redis RedLock / ZK Curator
- 日志链路：每次执行记录 traceId → ELK 查历史
