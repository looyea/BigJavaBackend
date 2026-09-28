# 服务发现、Exporter 与长期存储 · 作业

## 作业 1：K8s 服务发现全流程

**目标**：不写死任何 IP，让 Prom 自动抓到业务 Pod。

1. 部署带 `prometheus.io/scrape: "true"`、`prometheus.io/port: "9090"` 注解的 Spring Boot 应用。
2. 配 `kubernetes_sd_configs(role: pod)` + keep/replace relabel，TARGETS 页确认只出现业务端点（说明：无关系统 Pod 应被过滤）。
3. 扩到 5 副本，观察 targets 30s 内自动更新；缩回 1 副本确认无残留 404 target。
4. 反例实验：删掉 keep 规则 → 统计报错 target 数量与序列增量，输出 relabel 白名单的价值报告。

## 作业 2：Exporter 布点与基数审计

**目标**：为主机、MySQL、HTTP 入口三类对象选对 exporter 并量化成本。

1. 部署 node_exporter（只开默认 collector）、mysqld_exporter（只读账号）、blackbox（http_2xx 模块）。
2. 用 `count({job=~".+"}) by (job)` 输出各 job 序列数，找出 TOP3 指标并解释标签来源。
3. blackbox 拨测本机网关，配 `probe_success == 0` 5 分钟告警；拔掉网线/停容器验证触发（结果）。
4. 给 node_exporter 加 `--collector.hwmon=false` 等裁剪，对比序列数变化，输出治理清单。

## 作业 3：VictoriaMetrics 长期存储接入

**目标**：5 分钟数据留 Prom、1 年历史进远端。

1. docker-compose 起 vm（:8428），Prom 配 remote_write 指向 `/api/v1/write`。
2. Grafana 加两个数据源：Prom（近 6h 面板）与 VM（长期趋势面板），同一查询对比数值一致（验收标准：误差 <0.1%）。
3. 停掉 VM 30 分钟再恢复，观察 Prom `prometheus_remote_storage_samples_pending` 堆积与追赶过程，说明背压表现。
4. 思考题：为什么 remote_write 是 at-least-once？重复样本靠什么去重？写 3 行答案。
