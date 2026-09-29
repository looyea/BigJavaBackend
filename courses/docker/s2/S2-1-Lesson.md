# 网络模型与容器互联

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：理解 Docker 三种网络模式（bridge/host/overlay）与端口映射原理，掌握容器间通过服务名 DNS 互访的机制，能排查"容器 ping 不通宿主/互相连不上"的常见问题。

## 一、三种网络模式：给容器 NET Namespace 的不同接法

```bash
docker network ls
# bridge（默认）：容器挂到宿主 docker0 网桥，各自独立 IP，通过 NAT 出网——隔离且可互联
# host：容器直接用宿主网络栈（无独立 NET Namespace）——省一层 NAT，性能高但端口冲突、丧失隔离
# none：完全不接网络，最隔离（批处理/纯计算才用）
# 反例：为图方便把 web/DB 都塞 host 网络 → 端口撞车 + 防火墙策略失效 + 迁到 K8s 时网络假设全崩
```

- overlay（下一节多机）：跨宿主机容器组成同一 L2 逻辑网络，是 Swarm/K8s 跨节点通信的思路源头。

## 二、bridge 网络与自定义网络：为什么别用默认 docker0

```bash
docker network create shop-net                # 目的：自定义 bridge 网络才有内置 DNS 按名解析
docker run -d --network shop-net --name mysql mysql:8
docker run -d --network shop-net --name order shop-order:1.0
# 同一自定义网络内：order 可直接 jdbc:mysql://mysql:3306 —— docker 内置 DNS 用容器名解析成容器 IP
# 反例：全用默认 bridge → 只能靠 --link（已废弃）或记 IP，容器重建 IP 变、连接串失效（异常：重启后连不上 DB）
```

- 关键区分：自定义网络=有 DNS + 有隔离（不同网络默认不通）；默认 bridge=大家挤一起、无按名 DNS（这是最常踩的差异）。

## 三、端口映射：-p 背后是 iptables NAT

```bash
docker run -d -p 8080:8080 --name order shop-order:1.0
# 8080:8080 = 宿主端口:容器端口。原理：iptables DNAT 把到宿主:8080 的流量转到 <容器IP>:8080
iptables -t nat -L DOCKER -n          # 输出：能看到一条 dpts:8080 → DNAT to 172.17.0.x:8080 的规则
# 说明：容器间通信走内部网桥直连，不经过 -p 的映射端口（错误预期：order 连 mysql 要用 mysql:3306，不是宿主的映射端口）
```

## 四、容器互联的四条路径与选择

| 场景 | 方式 | 注意点 |
|------|------|--------|
| 同宿主同自定义网络 | 直接容器名/服务别名 | 推荐，最简（DNS 自动解析） |
| 同宿主不同网络 | `docker network connect` 双挂 或 经宿主端口 | 双挂更常见 |
| 容器访问宿主服务 | `host.docker.internal`（Desktop）/ 宿主 docker0 IP（Linux） | Linux 需 `--add-host` 或走宿主局域网 IP |
| 跨宿主 | overlay 网络（Swarm）/ 由 K8s Service 接管 | 单靠 Docker 不够，交给编排层 |

## 五、隔离与安全：网络是第一道闸

```bash
docker network disconnect shop-net mysql     # 目的：不让 order 直连 DB 时可从网络摘除
# 最佳实践：前端网络与数据网络分离（frontend-net / backend-net），DB 只进 backend-net 不出公网
docker run -d --network backend-net mysql    # 结果：公网入口即便被攻破也无法直达 DB（纵深防御）
# 反例：所有服务塞进一个 bridge 且都 -p 暴露 → 内网横移成本为零，等于没有隔离
```

- DNS 与网络策略是 K8s 里 CoreDNS/NetworkPolicy 的前身，理解本节再看 kubernetes s2-1 会顺（关联预告）。

## 六、关联技术

- NET Namespace 是本节一切隔离的底层（见 s1-1）；卷与 Compose 组网见 s2-2。
- 跨节点网络与 DNS 服务发现在 K8s 用 CNI/Service 重新实现，见 kubernetes s2-1；host 网络的性能取舍在压测中常见（回看 s1-3 CPU 感知）。
