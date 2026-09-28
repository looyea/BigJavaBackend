# 索引生命周期 ILM 与冷热架构

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：能为日志索引设计一套 ILM 策略（滚动阈值、各阶段动作、冷热分层落点），算清存储成本账，并避开 force merge、shrink 与别名相关的经典事故。

## 一、为什么日志必须管"生命周期"

日志索引是纯增量负载：写入集中在最新索引，历史索引只读且访问频率随时间指数衰减。不设生命周期会出现两个结局：要么全量数据常驻 SSD，成本失控；要么靠人肉 cron 删索引，误删与磁盘打满轮番上演。ILM 把"滚动—降级—压缩—删除"变成索引上的状态机，Elasticsearch 自动执行。

## 二、阶段模型与关键动作

```text
图目的：ILM 策略状态机——索引从写入到删除经过的五个阶段与代表动作
New ──rollover(满足阈值)──→ Hot ──(到期)──→ Warm ──→ Cold ──→ Frozen ──→ Delete
      hot 阶段动作:         动作:                动作:      动作:       动作:
      · set_priority 100    · shrink 分片减半     searchable  仍可读      · delete
      · flush               · forcemerge 1..N段   snapshot    极慢(远程   保留期满
      · 调低 merge 因子      · 迁到 HDD 节点       (S3对象存储)  取数)
```

- **rollover 触发三选一（或）**：`max_size`（常用 30~50GB/主分片）、`max_age`（兜底，防低峰期索引过小）、`max_docs`；
- 写入别名（write alias）指向当前可写索引，rollover 后自动切换；搜索别名覆盖全部序号索引——应用端永远只写别名，这是 ILM 不事故的前提。

## 三、一份可落地的日志 ILM 策略

```json
// PUT _ilm/policy/applog-lifecycle —— 目的：30 天日志，热 7 天 SSD、温 20 天 HDD、冷 3 天对象存储
{
  "policy": {
    "phases": {
      "hot": {
        // 说明：hot 阶段只做写入友好动作——rollover 三阈值任一命中即滚，别在这里放 merge 类重操作
        "actions": {
          "rollover": {
            "max_primary_shard_size": "40gb",   // 结果：分片控制在 40GB 量级，避免超大/超碎
            "max_age": "1d"                      // 说明：低峰期一天一滚，防止碎索引
          },
          "set_priority": { "priority": 100 }    // 目的：恢复/分配时热索引优先
          // 结果：写入只进 applog-write 别名，rollover 后切换由 ILM 完成，应用零感知
        }
      },
      "warm": {
        "min_index_age": "7d",                   // 说明：7 天后索引已只读，shrink/forcemerge 才能安全执行
        // 反例：把 forcemerge 放进 hot 阶段——对仍在写入的索引合并出超大不可变段，磁盘暴涨任务卡死
        "actions": {
          "shrink": { "number_of_shards": 1 },   // 错误做法：rollover 前 shrink，写入中的索引会被拒绝
          "forcemerge": { "max_num_segments": 1 },
          "allocate": { "include": { "data": "warm" } },  // 迁移到 HDD 冷节点
          // 说明：温度层级靠节点属性路由实现——没有独立 warm 节点池时这条会永久 pending，策略卡死
          "set_priority": { "priority": 50 }
        }
      },
      "cold": {
        "min_index_age": "27d",                  // 说明：金融/电力监管留存的长尾数据都住在这一层
        "actions": { "searchable_snapshot": {
          "snapshot_repository": "s3-backup"     // 结果：数据本体在 S3，本地仅缓存，成本降一个量级
        } }
      },
      "delete": { "min_index_age": "30d", "actions": { "delete": {} } }
      // 结果：删除只走 delete phase，告别 cron 人肉删索引与误删事故；合规要求半年留存的拉长此期即可
    }
  }
}
```

配套 index template 里挂 `lifecycle.name: applog-lifecycle` + `aliases: { "applog": {}, "applog-write": { "is_write_index": true } }`。

## 四、冷热架构的账

200GB/天日志、保留 30 天 ≈ 6TB 原始量，算上 1 副本与倒排开销按 2.5 倍规划 ≈ 15TB。三种方案：

| 方案 | 承载 | 月成本量级 | 查询体验 |
|------|------|-----------|---------|
| 全热（SSD+副本） | 15TB NVMe ×2 | 最高 | 秒级 |
| 热 7d SSD + 温 23d HDD 无副本 | ~3.5TB + 6TB | 中 | 温层稍慢可接受 |
| 热 SSD + 冷 searchable_snapshot | 对象存储为主 | 最低 | 冷数据首查慢（远程取数） |

经验：**95% 的排障查询落在最近 72 小时**——为热层花钱、为合规保留买对象存储，是最常见的性价比结构。金融/电力行业监管要求日志留存 6 个月~1 年的，把 delete 期拉长即可，架构不变。

## 五、经典事故与规避

- force merge 时机错：对仍在写入的索引 `forcemerge` 产生超大不可变段（错误表现：merge 任务卡死、磁盘暴涨）——只在 warm 阶段（索引已只读）执行；
- shrink 前没 flush/只读检查失败：`shrink` 要求索引 `write_blocks` 且主分片健康，ILM 会自动处理，人肉脚本常漏；
- 滚动阈值太小：`max_age 1h` 造出海量碎索引，集群状态与 file cache 双爆——分片规划先于策略（1 shard/GB 堆）；
- 人肉 `DELETE index-*` 绕过 ILM：与策略删除竞态造成误删新索引；删除只交给 delete phase，紧急清理用 `_ilm/move` 显式推进；
- searchable snapshot 节点内存不设限：冷查询缓存挤占堆——给 frozen/cold 角色独立节点池。

## 六、关联技术

分片与副本机理在 [Elasticsearch s1-3 容量规划](../../elasticsearch/s1/S1-3-Lesson.md)；全文索引成本换来的检索能力如何对标 Loki，见 [ELK vs Loki](S1-3-Lesson.md)；Kibana 侧 Space 与保留合规可结合 Snapshot Lifecycle Management（SLM）做跨集群备份。
