# 配置中心与灰度推送

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：掌握 Nacos Config 长轮询/gRPC 推送机制、多环境隔离、灰度发布与加密配置。

## 一、配置数据模型

```text
Namespace(环境) → Group(业务分组) → DataId(配置文件名)
例：prod / ORDER_GROUP / order-service.yml
```

```yaml
# 目的：application.yml 引入 Nacos Config
spring:
  cloud:
    nacos:
      config:
        server-addr: 127.0.0.1:8848
        namespace: ${ENV_NAMESPACE}  # 说明：通过环境变量注入命名空间 ID
        group: ORDER_GROUP
        file-extension: yml          # 结果：DataId = order-service.yml
        shared-configs:
          - data-id: common-mq.yml   # 输出：共享配置（MQ 地址等）
```

## 二、推送机制

### 2.1 长轮询（1.x）

```text
Client → 发起 GET /configs/listener (hold 30s)
Server → 挂起请求 → 若 30s 内配置变更 → 立即返回 200 + 变更 MD5
Client → 收到变化 → 再发 GET /configs 拉取全量内容
```

### 2.2 gRPC 长连接（2.x）

```text
Client ← 建立双向 Stream → Server
配置变更 → Server 主动 push → Client 收到后拉取 → 刷新 Spring 上下文
推送延迟：< 100ms（对比 1.x 最高 30s）
```

## 三、@RefreshScope 动态刷新

```java
// 目的：配置变更后无需重启即生效
@Component
@RefreshScope  // 结果：配置推送时此 Bean 销毁重建
public class OrderConfig {
    @Value("${order.timeout.ms:3000}")
    private int timeout;           // 说明：默认值 3000ms

    public int getTimeout() { return timeout; }  // 输出：动态值
}
// 错误用法：不用 @RefreshScope → 配置推了但 Bean 值不更新 → 需重启
```

## 四、灰度推送（Beta 发布）

```text
Nacos 控制台 → 发布配置 → 选"灰度" → 指定 IP 列表(如 10.0.1.1,10.0.1.2)
只有这些 IP 的客户端拉到新版本，其他实例仍用旧版本。
```

```java
// 目的：编程方式指定灰度目标
ConfigService configService = NacosFactory.createConfigService(props);
// 说明：beta 接收者 IP 列表
configService.publishConfig("order-service.yml", "ORDER_GROUP", newContent, "beta", "10.0.1.1;10.0.1.2");
// 结果：只有 10.0.1.1/10.0.1.2 两台实例收到变更
// 错误用法：Beta 未全量发布就停止维护 → 其他实例永远停在旧版本
```

## 五、加密配置

```yaml
# 目的：敏感配置加密存储（AES/KMS）
# DataId: order-service.yml 内容中：
order:
  db:
    password: {cipher-aes}U2FsdGVk...  # 输出：密文
```

- Nacos 2.2+ 内置加密插件：`nacos-encryption-plugin`。
- 客户端解密透明化：`@Value` 拿到的已是明文。

## 六、多环境隔离

| 层级 | 方式 | 示例 |
|------|------|------|
| 物理隔离 | 不同 Nacos 集群 | dev-cluster / prod-cluster |
| 逻辑隔离 | Namespace | public / dev / staging / prod |
| 业务隔离 | Group | ORDER_GROUP / PAY_GROUP |
| 文件隔离 | DataId | order-service-dev.yml / order-service-prod.yml |

## 七、关联技术

- Apollo：灰度更灵活（支持百分比灰度）、审计链完善。
- Spring Cloud Config：Git 后端 + Bus 推送，运维重。
- K8s ConfigMap + Sidecar Watch：云原生方案。
- 配置回滚：Nacos 保留历史版本，一键回滚。
