# 分布式主键、读写分离与弹性迁移

> 本节难度：★★★★★
> 重要程度：★★★★☆
> 学习产出：掌握雪花/UUID 等分布式主键的取舍、ShardingSphere 读写分离与 Hint 强制路由、影子库压测及在线扩容迁移（双写+校验+切流）的完整方法。

## 一、分布式主键：分表后 AUTO_INCREMENT 失效

```java
// 目的：对比三种主键在"趋势递增/冲突概率/信息泄露"上的表现
// 1) SNOWFLAKE：64 位 = 1 符号 + 41 毫秒时间 + 10 机器 + 12 序列
//    结果：趋势递增对 InnoDB 页分裂友好；依赖时钟 —— 回拨会主键冲突或停发（必须处理）
// 2) UUID：随机分布 → InnoDB 页分裂+索引膨胀（错误用法：分库分表后直接用 UUID 主键，写入放大 2~3 倍）
// 3) 数据库号段（lease）：从发号器批量取 [max_id, max_id+1000)（说明：一次取一批，DB 压力千分之一）
```

```yaml
# 目的：ShardingSphere 内置 keyGenerator 配置
keyGenerators:
  snowflake:
    type: SNOWFLAKE
    props:
      worker-id: 12                 # 说明：多实例必须互异（K8s 用 StatefulSet 序号或下发）
# 错误用法：容器无状态随机取 worker-id → 两实例同 id 同毫秒 → 生产主键冲突
# 时钟回拨对策：小回拨等待追平；大回拨停发报错并告警 —— 绝不"借用未来时间"继续发
```

## 二、读写分离规则与强制路由

```yaml
# 目的：一主两从，默认轮询；事务内自动走主
rules:
  - !READWRITE_SPLITING
    readwriteDatasources:
      ds_group:
        writeDataSourceName: ds_master
        readDataSourceNames: [ds_replica1, ds_replica2]
        transactionReadQueryType: PRIMARY   # 结果：事务中的 SELECT 全走主库，避免读不到自己写的中间态
        loadBalancerName: round-robin
# 错误用法：交易查询走从库 + transactionReadQueryType 配成 ANY → 支付回调读不到刚写入的订单 → 状态机卡死
```

- **HintManager 强制读主**：对"写后立刻读"的关键路径（下单后查详情）代码级指定主库（说明：比全局改规则影响面小）。
- 与自研 AbstractRoutingDataSource 的差别：规则在中间件统一生效，应用无感；但排障也多了一层。

## 三、影子库压测：真实流量打生产不影响数据

```text
图目的：影子压测的流量复制与隔离路径。
线上流量（或回放流量）→ 打标 shadow=true → ShardingSphere 把 SQL 路由到影子表/影子库
  （t_order 自动改写为 t_order_shadow / ds_shadow）。
结果：用生产级数据规模验证分片热点与容量，测试数据与生产物理隔离。
错误示例：影子规则没配表名映射 → 压测流量写进真实表 → 生产数据污染事故（必查项）。
```

## 四、弹性扩容：从 4 库到 8 库的在线迁移

```text
图目的：双写迁移四阶段状态机（任何阶段都可回退）。
1 双写：新旧库同时写（旧库为准），存量异步搬运；
2 校验：全量+增量比对（checksum 分块对比），差异修复；
3 切读：新库读流量 1%→100%，双写继续；
4 停旧：写切新库，旧库降级为只读归档，观察期后下线。
结果：扩分片数最忌"直接改 MOD 算法"—— 全部路由瞬间错位，数据找不到 = 事故。
```

```java
// 目的：一致性哈希 + 段迁移的平滑扩容（4→8 时仅一半 key 迁移）
int shard = hash(orderId) % (4 * 2);           // 说明：翻倍扩容，旧 key 至多迁到 n 或 n+4
// 错误用法：一致性哈希不加虚拟节点 → 数据倾斜与新节点接管过多
```

## 五、模式与场景速查

| 能力 | 配置点 | 典型事故 |
|------|--------|----------|
| 主键 | SNOWFLAKE/UUID_KEY | worker-id 重复、时钟回拨 |
| 读写分离 | transactionReadQueryType | 事务内读从库不一致 |
| 影子库 | shadow 表名映射 | 压测数据污染生产 |
| 扩容 | 双写+校验+切读 | 直接改算法致路由错位 |

## 六、关联技术

- 主键理论与号段模式细节见 dist-data；Seata 事务与分片组合时"一事务一库"仍是铁律。
- 迁移工具生态：gh-ost/DataX/Binlog 回放做存量搬运，ShardingSphere Pipeline 做增量同步与校验。
