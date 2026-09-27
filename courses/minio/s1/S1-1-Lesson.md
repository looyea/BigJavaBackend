# MinIO 架构与上传下载模式

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：掌握 MinIO 纠删码存储模型、分布式部署架构、分片上传与预签名 URL 直传模式，能在 Java 项目中落地对象存储方案。

## 一、MinIO 架构概览

### 1.1 设计定位

MinIO 是兼容 Amazon S3 API 的开源对象存储，专为私有云/混合云大规模非结构化数据设计。

```text
目的：展示 MinIO 在系统中的位置
应用 → S3 SDK → [MinIO Cluster] → 纠删码分片写入各磁盘
                                    ↓
                         元数据(桶/对象/版本) 存本地
```

### 1.2 纠删码（Erasure Code）

- 对象被切分为 K 个数据块 + M 个校验块（如 K=8, M=4 → 12 块分布在 12 块盘）。
- 任意 M 块丢失可恢复，存储利用率 = K/(K+M)，冗余度远低于三副本。
- 相比 RAID：软件级 EC 粒度是"对象"而非"条带"，无需专用硬件。

```flow
目的：展示纠删码的写入与恢复原理
对象(24MB) → 切分 8 数据块(各 3MB) + 计算 4 校验块 → 分布写入 12 块磁盘
任意 4 块盘故障 → 通过剩余 8 块 Reed-Solomon 解码恢复完整数据
```

### 1.3 分布式部署模式

| 模式 | 最低节点/盘数 | 适用 |
|------|-------------|------|
| 单机单盘 | 1 节点 × 1 盘 | 开发测试 |
| 单机多盘 | 1 节点 × 4+ 盘 | 小规模生产 |
| 多节点多盘（Erasure Set） | 4 节点 × 4 盘 = 16 盘 | 标准生产 |

MinIO Server 无状态：元数据内嵌（xl.meta 随对象存放），不需要外部数据库。

## 二、上传模式

### 2.1 简单上传 vs 分片上传

- **简单上传**（PutObject）：≤ 5GB，单次 HTTP PUT。
- **分片上传**（Multipart Upload）：适合大文件 / 网络不稳定。
  - InitiateMultipartUpload → 拿到 UploadId
  - 按 PartSize（5MB~5GB）逐片 UploadPart
  - CompleteMultipartUpload 合并

```java
// 目的：Java SDK 分片上传示例——大文件拆分为 10MB 的 Part 并发上传
// 错误用法: PartSize 设为 1MB → Part 数超 10000 限制报错
// 反例: 未设 ContentType → 下载时浏览器不识别文件类型
MinioClient client = MinioClient.builder()
    .endpoint("https://minio.internal:9000")
    .credentials("accessKey", "secretKey").build();  // 结果：连接到 MinIO 集群

// 分片上传
Iterable<Result<UploadPartResponse>> results = client.uploadObject(
    UploadPartObjectArgs.builder()
        .bucket("media")
        .object("videos/big.mp4")
        .filename(Paths.get("/tmp/big.mp4"))
        .partSize(10 * 1024 * 1024)  // 结果：10MB 每片，自动管理分片并发
        .build());
// 说明：SDK 内部自动 InitiateMultipart + 并发 UploadPart + Complete
```

### 2.2 预签名 URL 直传

```java
// 目的：后端生成预签名 PUT URL → 客户端直传 MinIO，减轻应用带宽压力
// 错误用法: URL 有效期设 7 天 → 安全风险大
// 反例: 不校验 Content-Type → 攻击者上传恶意文件
String presignedUrl = client.getPresignedObjectUrl(
    GetPresignedObjectUrlArgs.builder()
        .method(Method.PUT)
        .bucket("user-uploads")
        .object(UUID.randomUUID() + ".jpg")  // 结果：服务端生成安全路径
        .expiry(15, TimeUnit.MINUTES)         // 结果：15 分钟内有效
        .build());
// 说明：前端拿到 URL 后直接 PUT 上传文件，不经过后端
```

## 三、下载模式

### 3.1 预签名 GET URL

```java
// 目的：生成有时效的下载链接给前端或第三方
String getUrl = client.getPresignedObjectUrl(
    GetPresignedObjectUrlArgs.builder()
        .method(Method.GET)
        .bucket("media")
        .object("images/avatar.png")
        .expiry(1, TimeUnit.HOURS)  // 结果：1 小时后链接失效
        .build());
// 错误用法: 暴露永久链接 → 资源被盗链/爬虫批量抓取
```

### 3.2 下载加速与 CDN

- MinIO 支持 HTTP Range 请求：断点续传、视频拖拽定位。
- 生产环境前置 CDN：热数据缓存到边缘节点，MinIO 只做回源。

## 四、版本控制与生命周期

- 开启 Versioning 后每次覆盖生成新 VersionID，防误删。
- Object Lifecycle 规则：过期自动删除 / 转储到低成本存储层（Tiering）。
- 配合 Replication：跨站点异步复制实现异地容灾。
