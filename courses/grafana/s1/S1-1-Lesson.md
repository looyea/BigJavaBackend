# 数据源与面板/查询编辑

> 本节难度：★★☆☆☆
> 本节重要性：★★★☆☆
> 学习产出：掌握 Grafana 数据源接入与混合查询、常用面板类型选择、Query 编辑器与模板变量的使用。

## 一、数据源：看板的供电系统

```text
Grafana 本体不存数据 —— 所有面板都是"数据源查询的可视化"。
常用：Prometheus(指标) / Loki(日志) / Tempo(链路) / Elasticsearch / MySQL / CloudWatch。
接入方式：Connections → Data source，填 URL（服务端代理访问，浏览器无需直连）。
错误示例：URL 填了 localhost 而 Grafana 跑在容器里 → 指向容器自己，测试连接"成功"却无数据。
```

- Access 两选项：Server（默认，Grafana 后端代发请求，受 CSP/CORS 影响小）/ Browser（浏览器直连，适合带前端鉴权的场景）。
- Health check 通过 ≠ 有数据，用 Explore 跑一条真实查询做最终验收（结果验证）。

## 二、混合数据源（Mixed）

```text
目的：一个面板同时画 Prom 的 QPS 曲线 + Loki 的错误日志过滤线 + 云厂商 API 的库存水位。
操作：数据源选 Mixed → 每个 Query 单独指定数据源与 A/B/C 标签。
应用：大促作战室面板 —— 业务水位(自建)与基础设施水位(云监控)不必二选一。
```

## 三、面板类型选择

| 面板 | 适用 | 反例 |
|------|------|------|
| Time series | 趋势（QPS/RT/错误率） | 单值指标画成线（无意义抖动） |
| Stat / Gauge | 当前值、健康红绿灯 | 历史趋势只留一个数 |
| Bar chart / Piechart | TopN、占比 | 高基数维度画饼（50 片没法看） |
| Table | 明细、多列聚合排序 | 趋势信息塞进表格 |
| Logs | Loki 日志流 | 用 Table 展示原始日志 |
| Node graph | 拓扑/依赖 | 手工连线维护（该用 SkyWalking） |

## 四、Query 编辑器与变换（Transforms）

```promql
# A 查询：每服务 QPS
sum by (service) (rate(http_requests_total[5m]))
# B 查询（Format 选 Table）：topk(5, sum by (path) (rate(http_requests_total[5m])))
# 反例：把 rate 窗口 [5m] 改成 [15s]（小于抓取间隔）→ 窗口内凑不齐两个点 → 曲线断流且剧烈抖动
```

- Query 旁边的 Legend 用 `{{service}}` 引用标签，输出可读图例。
- Transforms 做"查询后加工"：Organize fields（改名/排序）、Merge、Group by、Add field from calculation（如错误率=错误列/总量列）。
- 说明：能在 PromQL 里做的聚合优先放查询侧，Transform 只补 PromQL 表达不了的整形（保持数据源单一口径）。

## 五、模板变量实战

```text
Dashboard settings → Variables：
1. Query 型：label_values(http_requests_total, service) → 下拉多选 $service
2. 间隔型：Interval = 5m/15m/1h → 查询里 [$__interval]、rate 窗口随缩放自适应
3. 级联型：datasource 变量 → 一套看板切换 生产/预发 集群
面板 Repeat: Row 按 $service 复制 → 30 个服务自动生成 30 行同款面板。
错误用法：变量 Default 留空且 Multi 未开 → 分享链接打开面板 No data。
```

## 六、关联技术

- Explore 页：不建面板直接试查询，验证完"Save to dashboard"沉淀为面板。
- Annotations 功能可把部署事件画到曲线上（数据源支持时自动拉 Prom alert/ Loki 事件线）。
- 下一小节：Dashboard as Code —— 把今天手点出来的看板变成可评审的 JSON。
