# 服务注册发现与心跳模型

> 本节难度：★★★★☆
> 重要程度：★★★★☆
> 学习产出：掌握 Nacos 服务注册/发现/健康检查机制，理解临时实例 AP（Distro）与持久实例 CP（Raft）的区别。

## 一、服务注册模型

```text
微服务启动 → 注册自身(IP:Port+Metadata) → Nacos Server
消费者 → 订阅服务名 → Nacos 返回健康实例列表 → 本地缓存 → 负载均衡调用
Nacos → 推送变更(gRPC/UDP) → 消费者更新本地列表
```

```java
// 目的：Spring Cloud 应用注册到 Nacos（application.yml 即可，无代码侵入）
spring:
  cloud:
    nacos:
      discovery:
        server-addr: 127.0.0.1:8848
        namespace: prod            # 说明：命名空间隔离环境
        group: DEFAULT_GROUP       # 结果：服务分组
        metadata:
          version: v2.1            # 输出：自定义元数据（用于灰度路由）

// 错误用法：server-addr 配错 → 启动报 "failed to req API:/nacos/v1/ns/instance"
```

## 二、心跳与健康检查

### 2.1 临时实例（Ephemeral=true，默认）

```text
客户端每 5s 发一次心跳 → Server 15s 未收到标记不健康 → 30s 未收到摘除实例
心跳协议：HTTP GET /nacos/v1/ns/instance/beat
```

```java
// 目的：手动发送 beat（自定义 SDK 场景）
// PUT /nacos/v1/ns/instance/beat?serviceName=order-service&ip=10.0.0.1&port=8080
// Body: {"ip":"10.0.0.1","port":8080,"serviceName":"order-service","healthy":true}
// 输出：{"clientBeatInterval":5000}  ← 结果：Server 告诉客户端心跳间隔
// 错误用法：网络抖动丢 6 个心跳 → 30s 后被摘除 → 正在调用的消费者报 404
```

### 2.2 持久实例（Ephemeral=false）

- Server 主动探测（TCP/HTTP/mYSQL）。
- 不健康只标记不下线（需手动 `DELETE` 摘除）。
- 适用：数据库、Redis 等基础设施服务。

## 三、Distro 协议（AP）

```text
Nacos 集群 3 节点：
Node1 ← 注册 → Node1 负责该实例（Hash 分片）→ 异步同步给 Node2/Node3
Client 查任意节点 → 都能返回（可能有秒级延迟 → AP 最终一致）
```

- **数据分片**：`Hash(serviceName+namespace) % 节点数` 确定负责节点。
- **同步**：负责节点收到写请求后异步复制到其它节点。
- **容灾**：节点故障 → 健康检查摘除 → 客户端感知。

## 四、Raft 协议（CP，持久实例）

持久实例元数据走 JRaft：Leader 写入 → 多数确认才返回成功。

```text
Node1(Leader) → 写入实例 → 复制到 Node2/Node3 → 2/3 ACK → Commit
Client 读任何节点都能拿到已提交数据（强一致）
```

## 五、服务发现与订阅

```java
// 目的：消费端通过服务名获取健康实例
@Service
public class OrderService {
    @Autowired
    private NacosDiscoveryProperties props;
    @Autowired
    private NacosServiceManager manager;

    public List<Instance> getHealthyInstances(String serviceName) {
        NamingService naming = manager.getNamingService(props.getNacosProperties());
        // 结果：只返回 healthy=true 的实例
        return naming.getInstances(serviceName, true);  // 输出：[{ip:10.0.0.1, port:8080}]
    }
}
// 错误用法：直接用 DNS 解析服务名 → 无法感知 Nacos 的健康摘除 → 调到故障实例
```

## 六、关联技术

- 负载均衡：Spring Cloud LoadBalancer 集成 Nacos → 自动选健康实例。
- 灰度路由：metadata.version → 自定义 ReactorLoadBalancer 过滤版本。
- 多集群容灾：应用本地缓存服务列表 + 备用注册中心。
- K8s Service 对比：K8s 用 CoreDNS + EndpointSlice，Nacos 更灵活（metadata/权重/健康策略自定义）。
