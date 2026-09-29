# Alertmanager 告警与 Grafana 看板（关联）

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：掌握 PromQL 告警规则四要素与 Alertmanager 分组/抑制/静默机制，会用 Grafana 构建黄金指标看板。

## 一、告警规则：从表达式到事件

```yaml
# 目的：定义"何事、何时、何等级"——规则文件与 prometheus.yml 分离管理
groups:
  - name: order-svc
    rules:
      - alert: OrderErrorRateHigh
        expr: service:http_error_ratio:5m > 0.01      # 引用 recording rule（避免重查询）
        for: 2m                                        # 说明：持续 2 分钟才 firing，防抖
        labels: { severity: critical, team: trade }
        annotations:
          summary: "下单错误率 {{ $labels.service }} 超 1%"
          current: "{{ printf \"%.2f\" $value }}"      # 输出：通知里带实时值
          runbook: https://wiki/.../order-error        # 目的：一键直达处置手册
```

- 状态机：inactive → pending（表达式已满足、for 未满）→ firing（通知发出）。
- `absent(up{job="x"} == 0)` 类"无数据即告警"规则必须有——数据断流比错误更危险。

## 二、Alertmanager：通知链治理

```yaml
route:
  receiver: default-dingtalk
  group_by: [alertname, cluster]     # 目的：同集群同名告警 5 分钟内合并成一条
  group_wait: 30s                    # 首条等待窗口
  group_interval: 5m                 # 同组新增告警的追加通知间隔
  repeat_interval: 4h                # 结果：未解决的 firing 每 4 小时提醒一次
  routes:
    - matchers: [ severity="critical" ]
      receiver: phone-oncall          # 说明：critical 走电话，warning 走群机器人
      continue: false
receivers:
  - name: phone-oncall
    webhook_configs: [ { url: "http://oncall-gw/call" } ]
inhibit_rules:
  - source_matchers: [ alertname="ClusterDown" ]
    target_matchers: [ severity="warning" ]
    equal: [ cluster ]                # 目的：集群级故障时压制上百条实例级噪音
```

- 三大降噪件：分组（合并同类）、抑制（大故障压小告警）、静默（维护窗口 `amtool silence add`）。
- 高可用：3 节点集群 gossip 同步，防单点漏报；通知重试由 AM 负责，Prom 只管发。

## 三、Grafana 黄金指标看板

```text
RED 法（服务）：Rate 每秒请求 / Errors 失败率 / Duration P50-P95-P99 同屏。
USE 法（资源）：Utilization 使用率 / Saturation 排队饱和度 / Errors。
面板组织：顶部 Repeat by service 变量行 → 一个 YAML 生成 N 个服务副本。
数据源混查：指标 Prom + 日志 Loki（点击面板 → Explore 带 label 跳转）。
```

- `{{service}}` 模板变量（Query 类型：`label_values(http_requests_total, service)`）→ 看板全局联动过滤。
- 结果：告警链接携带 `var-service=order&from=now-1h`，值班点开即锁定现场。

## 四、告警与看板的协同闭环

```text
看板发现异常 → 曲线加 annotation 发布标记 → 告警规则由同一 PromQL 派生
→ 通知带面板深链（Grafana panel "Edit panel URL"）→ 处置完写静默复盘
反例：告警表达式与看板查询各写各的 → 数值对不上，值班怀疑监控可信度。
```

## 五、关联技术

- Grafana 自带 Unified Alerting 可直接基于多数据源告警，与 AM 二选一做通知端（混用要防双发）。
- Alertmanager `webhook_configs` 对接企业 IM/电话网关；`amcheck`/`promtool check rules` 上线前校验。
- SLO 告警（error budget burn rate，多窗口多速率策略）见《SRE 实践》延伸。
