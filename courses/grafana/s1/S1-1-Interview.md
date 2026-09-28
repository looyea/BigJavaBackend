# 数据源与面板/查询编辑 · 面试题

## 题 1：Grafana 看板"Loading..."很久，如何定位瓶颈在哪一层？

```text
1. 浏览器 Network：看 /api/ds/query 总耗时与每个子查询耗时 → 区分渲染慢 vs 查询慢。
2. 查询慢：复制该 Query 到 Prom 浏览器单独跑，看 engine stats（扫描序列数、区间）。
3. Grafana 层慢：面板过多（200+ 并发查询）、Transform 大表 Join、变量 All 导致 fan-out。
结果：90% 的"看板慢"其实是高基数查询或 All 变量放大，不在 Grafana 本身。
```

## 题 2：Server 与 Browser 两种 Access 模式怎么选？

- Server（proxy）：Grafana 后端代请求——统一鉴权注入（basic/token）、规避 CORS/内网可达性，生产默认。
- Browser：浏览器直连数据源——数据源只允许前端网络可达（如某些云 API 带 STS 临时凭证）时用。
- 安全提醒：Server 模式下凭据存 Grafana 加密配置，切勿把 token 写进面板 URL 分享（错误示例：含 ?token= 的截图外传）。

## 题 3：为什么推荐 Legend 用 {{label}} 而不是写死序列名？

- 序列标签是事实源，写死会在服务改名/扩容后集体失效（结果：图例与数据对不上）。
- Multi-Query 面板里 `{{service}} {{instance}}` 组合可自动区分上百条线。
- 说明：配合 Group by（Transform）也能做后处理图例，但查询侧模板更省一次计算。

## 题 4：Repeat 面板好用吗？有什么坑？

- 优点：一个面板定义 × N 个变量值 = 自动 N 份（30 服务 30 图），维护一处。
- 坑 1：Repeat 变量选 All 且值多 → 一次开 100 个查询打爆数据源（用 maxPerRow 与默认单选缓解）。
- 坑 2：Repeat 出的面板 id 动态生成，告警不能直接绑（应在原始面板上配告警）。
- 坑 3：JSON 里只有 1 个面板定义，diff 友好（利于下一节的 Dashboard as Code）。

## 题 5：临时排障为什么用 Explore 而不是改看板？

- Explore 无保存压力、支持 Query inspect（查看原始响应/帧结构）、能直接做 Trace/Log 联动跳转。
- 改看板验证会污染共享视图，同事看到"半成品"（团队协作反例）。
- 结论：Explore 是"读侧沙箱"，验证成熟后再 Save to dashboard 固化。

## 题 6：面板 Unit 设置有什么实际价值？

- 正确 Unit（reqps、s、percent(0-1)）让 Y 轴自动换算：0.043s 显示 43ms（结果：不用心算）。
- 阈值/缩略轴、Legend 排序都依赖 Unit 语义；同 Panel 混 Unit 要用字段级覆盖。
- 反例：错误率 0~1 的比值不设 percent，值班把"0.5"读成 0.5%，误判严重度（真实误判场景）。
