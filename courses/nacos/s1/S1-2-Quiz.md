# 配置中心与灰度推送 · 小测

### 1. Nacos 配置三级模型是？（6分）

- A. Region / Zone / Cluster
- B. Namespace / Group / DataId
- C. Env / Service / Version
- D. Topic / Partition / Offset

> 答案：B
> 解析：Namespace 隔离环境，Group 隔离业务，DataId 唯一标识配置文件。

### 2. Nacos 1.x 配置推送机制是？（6分）

- A. WebSocket
- B. 长轮询（30s hold）
- C. 短轮询（每秒）
- D. gRPC Stream

> 答案：B
> 解析：1.x Client 发起 hold 30s 的长轮询，Server 有变更立即返回 MD5。

### 3. @RefreshScope 的原理是？（6分）

- A. 热替换字节码
- B. Bean 代理 + 配置变更时销毁重建目标 Bean
- C. 重新读取 yml 文件
- D. 反射设置字段值

> 答案：B
> 解析：ScopedProxy 在收到 RefreshEvent 时标记缓存失效，下次访问重建 Bean → @Value 重新注入。

### 4. Beta 灰度推送指定接收者的方式是？（6分）

- A. 标签选择器
- B. 指定 IP 列表
- C. 百分比随机
- D. 按权重

> 答案：B
> 解析：Nacos Beta 发布在控制台填写逗号分隔的 IP 列表，只有这些 IP 拉取新版本。

### 5. 配置加密后客户端获取到的值是？（6分）

- A. 密文，需手动解密
- B. 明文（SDK 自动解密）
- C. Base64
- D. Hash 值

> 答案：B
> 解析：Nacos 加密插件在客户端拉到配置后自动解密，@Value 注入的是明文。

### 6. Nacos 2.x 配置推送延迟约为？（6分）

- A. 30s
- B. 5s
- C. 100ms 以内
- D. 1ms

> 答案：C
> 解析：gRPC 双向 Stream 主动推送，实测通常 < 100ms。

### 7. 以下哪种 NOT 是 Nacos 配置隔离手段？（6分）

- A. Namespace
- B. Group
- C. DataId
- D. Partition

> 答案：D
> 解析：Partition 是 Kafka 概念；Nacos 用 Namespace/Group/DataId 三级隔离。

### 8. 配置中心容灾手段包括（多选）？（9分）

- A. 客户端本地快照缓存
- B. failover 文件强制覆盖
- C. 配置中心多集群主备
- D. 关闭配置推送

> 答案：A、B、C
> 解析：D 错——关闭推送失去配置中心意义。

### 9. @RefreshScope 的坑包括（多选）？（9分）

- A. Bean 重建后原有状态丢失（如内部计数器归零）
- B. 标注在 @Configuration 类可能导致无限重建
- C. 对 @Value 的 static 字段无效
- D. 与 @Transactional 代理冲突

> 答案：A、B、C、D
> 解析：全部是已知陷阱，需避免在有状态 Bean 或配置类上使用。

### 10. 简答题：设计一套配置中心灰度发布方案用于 100 台实例的电商系统。（40分）

- 要点1：Namespace 隔离 prod，Group 按业务线划分
- 要点2：先在 2 台实例 Beta 推送新配置 → 观察 10 分钟日志/指标
- 要点3：确认无误后全量发布 → Nacos 保留历史版本可一键回滚
- 要点4：敏感配置（DB 密码/API Key）使用加密插件存储
- 要点5：容灾：所有实例开启 local snapshot，Nacos 不可用时启动不阻塞

> 答案：见要点
> 解析：灰度核心是"小范围验证 → 观察 → 全量推送 → 可回滚"闭环。
