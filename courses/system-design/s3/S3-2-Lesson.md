# API 网关 / Web 爬虫 / 支付对账系统

> 本节难度：★★★★★
> 重要程度：★★★★★
> 学习产出：能设计高可用 API 网关（路由/鉴权/限流）、大规模 Web 爬虫（调度/去重/反反爬）、以及金融级支付对账系统（差错处理/资损防控）。

## 一、API 网关设计

### 1.1 网关定位与核心职责

```flow
目的：展示 API 网关在微服务架构中的流量入口位置
Client → CDN/DNS → L4 LB → [API Gateway] → Service Mesh / 微服务集群
                              ├─ 路由匹配
                              ├─ 认证鉴权(JWT/OAuth2)
                              ├─ 限流熔断
                              ├─ 协议转换(REST→gRPC)
                              └─ 日志/监控/链路追踪
```

### 1.2 路由与过滤器链

```java
// 目的：Spring Cloud Gateway 声明式路由——按路径转发 + 添加鉴权过滤器
// 错误用法: predicate 顺序放到 filter 后面 → 路由未命中就执行了鉴权逻辑
// 反例: StripPrefix 未配置 → 后端收到带 /api 前缀的路径 404
@Bean
public RouteLocator routes(RouteLocatorBuilder builder) {
    return builder.routes()
        .route("order-service", r -> r.path("/api/order/**")  // 结果：匹配 /api/order 开头所有请求
            .filters(f -> f.stripPrefix(1)                     // 结果：去掉 /api 前缀转发
                .addRequestHeader("X-Gateway", "prod")         // 说明：透传网关标识
                .filter(authFilter()))                          // 结果：JWT 校验不通过直接 401
            .uri("lb://order-service"))
        .build();
}
```

### 1.3 限流与鉴权设计

- **限流算法**：令牌桶（允许突发）、滑动窗口（精确计数）。
- **维度**：IP / 用户 / API / 全局。
- **实现**：Redis + Lua 原子扣减；网关集群共享计数器。
- **鉴权**：JWT 网关统一校验；OAuth2 对接外部 IdP；RBAC 在网关层做粗粒度权限拦截。

## 二、Web 爬虫系统设计

### 2.1 整体架构

```text
目的：展示爬虫系统的 URL 调度→抓取→解析→存储全链路
种子队列 → URL 管理器(去重 BloomFilter) → 调度器(优先级/频率控制)
    → 下载集群(Rotating Proxy + UA Pool) → HTML 解析器 → 内容存储
    → 新 URL 回注 URL 管理器
```

### 2.2 去重与调度策略

```java
// 目的：布隆过滤器做 URL 去重——O(1) 判重、可容忍 1% 误判
// 错误用法: 用 HashSet 存 10 亿 URL → 内存爆炸
// 反例: BloomFilter 不支持删除 → 页面改版后旧 URL 永远判"已存在"
BloomFilter<String> urlFilter = BloomFilter.create(
    Funnels.stringFunnel(StandardCharsets.UTF_8),
    1_000_000_000L,   // 预期元素数
    0.01               // 误判率 1%
);
// 结果：约 1.2 GB 内存即可承载 10 亿 URL 去重
if (!urlFilter.mightContain(url)) {
    urlFilter.put(url);           // 说明：新 URL 加入队列
    downloadQueue.add(url);
}
```

**robots.txt 合规**：解析 robots.txt，按 Crawl-delay 控制频率；设置 User-Agent 标识。

**反反爬对抗**：代理 IP 池轮换 + 请求指纹随机化（TLS 指纹、Header 顺序）+ 无头浏览器兜底。

### 2.3 分布式爬虫扩展

- Master-Slave：Master 分发任务；Worker 无状态水平扩。
- 断点续爬：记录 crawl_state（URL + offset），重启后恢复。
- 增量抓取：对比页面 hash / ETag / Last-Modified，只下载变化内容。

## 三、支付对账系统设计

### 3.1 对账模型

```flow
目的：展示支付对账"我方流水 vs 渠道账单"的双向核对流程
T+1 定时任务 → 拉取渠道账单(微信/支付宝/银行) → 解析标准化
    → 双向比对：
        我方有渠道无 → 渠道单边账（可能掉单）
        渠道有我方无 → 我方单边账（可能漏单）
        金额不一致 → 差错账
    → 差错处理工单 → 资损防控
```

### 3.2 对账核心逻辑

```sql
-- 目的：双向核对 SQL——找出金额不一致或单边的记录
-- 错误用法: 只做正向核对（我方→渠道），漏掉渠道单边账
-- 反例: 不处理时区差异 → 跨日交易被误判为"我方有渠道无"
SELECT a.order_no, a.amount AS our_amount, b.amount AS channel_amount
FROM our_payments a
FULL OUTER JOIN channel_bill b ON a.channel_txn_id = b.txn_id
WHERE a.amount IS NULL                    -- 结果：渠道有我方无 = 漏单
   OR b.amount IS NULL                    -- 结果：我方有渠道无 = 掉单
   OR ABS(a.amount - b.amount) > 0.01;   -- 结果：金额不一致 = 差错
```

### 3.3 资损防控与差错处理

- **实时核对**：支付成功回调时即与渠道查单接口比对，发现差异立即告警。
- **差错自动修复**：掉单 → 主动查单补单；重复扣款 → 自动退款。
- **大额人工复核**：超阈值差错生成工单，财务二次确认。
- **幂等保证**：对账任务可重跑，用 (date, channel, order_no) 联合唯一键防重复入账。

## 四、三个系统的共通设计原则

| 原则 | 网关 | 爬虫 | 对账 |
|------|------|------|------|
| 水平扩展 | 无状态多实例 | Worker 集群 | 按渠道分片并行 |
| 幂等 | 请求去重 ID | URL 去重 | 联合唯一键 |
| 可观测 | 访问日志 + Metrics | 抓取成功率 | 差错率报表 |
| 降级 | 熔断返回兜底 | 跳过失败源 | 人工审核兜底 |
