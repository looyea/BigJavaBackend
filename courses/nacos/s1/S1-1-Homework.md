# 服务注册发现与心跳模型 · 作业

## 作业 1：心跳与摘除实验

**目标**：观察实例从注册到被摘除的完整过程。

1. 启动 Nacos standalone + 一个 Spring Boot 应用注册到 Nacos。
2. Nacos 控制台确认实例出现。
3. `kill -9` 应用进程（不发 deregister）。
4. 每 5s 刷新控制台观察 healthy 状态变化：正常→不健康→移除。
5. 记录精确时间戳，验证 15s/30s 阈值。

## 作业 2：Distro 集群写入路由

**目标**：验证数据分片与同步。

1. 启动 3 节点 Nacos 集群。
2. 向 Node1 注册一个服务，查看 Node2/Node3 是否也能查到。
3. 停掉 Node1，尝试向 Node2 注册同服务的新实例。
4. 恢复 Node1，观察数据是否自动同步一致。

## 作业 3：自定义健康检查

**目标**：将 Spring Boot 应用的 actuator/health 接入 Nacos 服务端 HTTP 探测。

1. 注册持久实例（ephemeral=false），checkType=http，checkPort=8080，checkPath=/actuator/health。
2. 人为让 /actuator/health 返回 DOWN（关闭 DB 连接池）。
3. 观察 Nacos 控制台标记 unhealthy 但实例仍在列表。
4. 消费者用 `getInstances(name, true)` 过滤掉该实例。
