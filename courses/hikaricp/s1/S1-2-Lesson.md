# 连接池参数调优与容量测算

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能用可解释的公式和一组关键参数把 HikariCP 调到"稳定、且不超过数据库承受力"，而不是拍脑袋把池开大。核心结论是**池不是越大越好**：并发吞吐受数据库与锁竞争上限约束，池开得过大只会增加上下文切换、数据库端连接开销与锁争用，反而拉低吞吐——经验公式 `maximumPoolSize ≈ 核心数×2 + 有效磁盘数`（HikariCP 官方 wiki）给出一个 CPU/IO 平衡的起点，电商/金融的 OLTP 服务通常 10~20 就够，压测确定拐点。**固定池**：把 `minimumIdle` 设成等于 `maximumPoolSize`，让连接数恒定、突发时不必临时建连（建连含 TCP+认证+可能的 SSL 握手，代价高），官方也推荐"直接用一个固定大小池"、少依赖 `minimumIdle` 的动态伸缩。三个超时必须**与数据库侧对齐**：`connectionTimeout`（从池借连接的最长等待，超时抛异常，默认 30s，别设太长把请求线程拖死）；`maxLifetime`（单连接最长存活，默认 30min，**必须显著小于数据库/中间件的 `wait_timeout`**，一般留 30~60s 余量，否则数据库已单方面关掉连接而池仍持有它，取出即 `Communications link failure`）；`idleTimeout`（仅当 `minimumIdle<max` 时回收空闲）与 `keepaliveTime`（对空闲连接定期探测，提前剔除被防火墙/NAT 静默断开的死连接）。识破"`maxLifetime` 比 `wait_timeout` 长""把池开到几百追求高并发""借不到连接就一味调大 `connectionTimeout` 掩盖池耗尽"等坑。

## 一、池大小：公式与拐点

```yaml
# 目的：用最小参数集把池调到"稳定且不超过数据库承受力"
maximumPoolSize: 20        # 说明：经验公式 (核数×2 + 有效磁盘数), CPU 密集场景别贪大, 过大反增上下文切换与 DB 压力
minimumIdle: 20            # 结果：等于 max 即"固定池", 避免流量突发时反复建连(TCP+认证+SSL 握手代价高)
```

## 二、超时三件套与 wait_timeout 对齐

```yaml
# 目的：让池侧生命周期严格短于数据库侧, 杜绝"取出已被服务端断开的死连接"
connectionTimeout: 3000    # 说明：借连接最长等待(毫秒), 超时抛 SQLException, 别设太长把请求线程拖到雪崩
maxLifetime: 1200000       # 结果：连接最长存活 20min, 必须显著小于 DB 的 wait_timeout 并留 30~60s 余量
# 反例：maxLifetime 设得比 wait_timeout 还长 ❌ 服务端已单方面断开, 池仍持有死连接 → 取出即 Communications link failure ❌
keepaliveTime: 300000      # 说明：空闲连接定期保活探测, 早暴露被防火墙/NAT 静默断开的连接
```

## 三、为什么"大池"不等于"高吞吐"

```text
图目的：池大小与吞吐的非单调关系, 找拐点而非一味加连接
请求 → 借连接 → 执行 SQL(受 DB CPU/锁/IO 上限约束) → 归还
连接数低于 DB 承受力: 加连接 → 吞吐上升
连接数超过 DB 承受力: 更多连接在 DB 端排队/锁竞争 → 吞吐下降、延迟飙升、上下文切换浪费
结论: 用压测找"吞吐-延迟拐点", 池大小定在拐点左侧; OLTP 常见 10~20 远小于直觉
```

## 四、坑与底线

- **`maxLifetime < wait_timeout` 是硬约束**：先查 DB/代理（如 MySQL `wait_timeout`、ProxySQL、云数据库默认值）再定，留足余量。
- **固定池优先**：`minimumIdle=maximumPoolSize`，避免伸缩抖动；确需弹性再压低 `minimumIdle` 并接受建连延迟。
- **借不到连接先查泄漏/池耗尽**：别用调大 `connectionTimeout` 掩盖根因，配合 `leakDetectionThreshold` 排查。

## 五、关联课程

这些参数在故障时的外在表现（等待、超时、耗尽）见 [连接池核心参数与故障表现](./S1-1-Lesson.md)；`connectionTimeout` 设多久都救不了的"未归还"问题见 [连接泄漏、超时与故障定位](./S1-3-Lesson.md)；池上限最终受数据库侧连接容量约束，PostgreSQL 侧的容量与膨胀治理见 [索引类型与查询优化](../../postgresql/s1/S1-3-Lesson.md)。
