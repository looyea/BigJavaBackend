# 滑动窗口与流控效果 · 作业

## 作业 1：QPS 限流 + Dashboard 观察

**目标**：配置 50 QPS 限流并用 JMeter 验证。

1. 启动 Sentinel Dashboard + 应用，注册一个资源 `/api/search`。
2. 配置 FlowRule：QPS=50，快速失败。
3. JMeter 以 100 QPS 打 30s → Dashboard 实时曲线：pass≈50, block≈50。
4. 修改阈值 80 → 观察变化。

## 作业 2：Warm Up 冷启动模拟

**目标**：模拟服务重启后流量预热。

1. 配置 QPS=100, controlBehavior=WARM_UP, warmUpPeriodSec=10, coldFactor=3。
2. 重启应用 → 立即以 100 QPS 打流量。
3. 观察前 10s 的 pass 数（应从 ~33 线性增到 100）。
4. 10s 后稳定 pass=100, block=0。

## 作业 3：关联限流

**目标**：写接口超载时限制读接口。

1. 资源 writeOrder QPS 阈值=20。
2. 资源 readOrder 设关联策略，参照 writeOrder，count=20。
3. 同时压 writeOrder=30 QPS + readOrder=100 QPS。
4. 观察：writeOrder 被限到 20；readOrder 因参照资源超标被限。
