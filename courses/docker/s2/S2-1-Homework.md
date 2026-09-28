# 网络模型与容器互联 · 作业

## 作业 1：三种模式亲手对比

**目标**：观察 bridge/host/none 的网络差异。

1. 分别用 `--network=bridge`、`--network=host`、`--network=none` 起 alpine，进容器执行 `ip a`，对比网卡与 IP（输出：host 模式直接显示宿主 eth0、none 只有 lo 的证据）。
2. bridge 容器 `ping www.baidu.com` 通、none 容器不通（错误用例：none 里 curl 外网失败属正常，理解"最隔离"）。
3. 记录 host 模式两个容器同时监听 8080 的端口冲突报错原文（验收：能解释为什么 host 会撞、bridge 不会）。

## 作业 2：自定义网络 DNS 实验

**目标**：坐实"同网用服务名、跨网默认不通"。

1. 建 net-a/net-b，各起一个容器，从 net-a 容器 `ping` net-b 容器名 → 解析失败（结果：网络即隔离边界）。
2. 把容器 `docker network connect net-b <c>` 双挂后重试连通（验收：DNS 能解析、跨网打通）。
3. 容器重启/重建后观察 IP 变化但服务名解析始终正确（说明：连接串用名字而非 IP 的价值）。

## 作业 3：端口映射原理验证

**目标**：看见 -p 背后的 NAT。

1. `docker run -d -p 9090:8080 order`，执行 `iptables -t nat -L DOCKER -n` 找到对应 DNAT 规则（输出：宿主:9090→容器IP:8080）。
2. 从同网另一容器访问 order 用 `order:8080`（不是 9090），验证容器间直连不经映射端口（错误用例：误用 9090 反而通不了的场景）。
3. 画一张 mini 拓扑图标注：公网入口(宿主:9090)、内部直连(order:8080)、DNAT 发生点，附一句话说明每条流量路径。
