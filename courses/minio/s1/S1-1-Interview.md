# 面试题：MinIO 架构与上传下载模式

## 高频面试题

### Q1：MinIO 和传统文件系统/数据库存大文件有什么优势？

**答题要点**：
- 水平扩展：加节点即扩容，无单点瓶颈
- HTTP 原生访问：S3 API 跨语言/跨平台，无需挂载
- 纠删码：比三副本省 50%+ 存储空间，比 RAID 灵活（软件定义）
- 元数据内嵌：无外部 DB 依赖，部署极简
- 适合场景：图片/视频/日志/备份等非结构化海量数据

**追问方向**：为什么不直接把文件存 MySQL BLOB？（答：DB 行存不适合大二进制；备份膨胀；无法水平扩；无法用 CDN）

### Q2：纠删码 EC 与三副本复制怎么选？

**答题要点**：
- 三副本：存储利用率 33%，读性能好（任意副本可读），修复带宽大
- EC(K=8,M=4)：利用率 67%，4 盘故障容限，修复需读 K 块重建
- 容量型冷数据 → EC；高频读小文件 → 三副本
- MinIO 用 EC；HDFS 默认三副本（可选 EC 策略）；Ceph 兼具

**追问方向**：EC 小文件怎么处理？（答：MinIO 小于 64KB 的文件用 "standard" 模式即全拷贝到每个盘；或上层合并打包）

### Q3：预签名 URL 的安全设计要点？

**答题要点**：
- 有效期尽量短（上传 15min，下载 1h），防泄露后被滥用
- 后端生成 Key（UUID），不接受前端传入路径 → 防路径遍历
- Bucket Policy 限制该临时凭证只能操作指定 Key
- 可附加 Conditions：Content-Type/Content-Length-Range 限制
- HTTPS 传输 + 不落日志（URL 含签名）

**追问方向**：预签名 URL 泄露了怎么紧急失效？（答：MinIO 无法单独 revoke 一个 presigned URL，只能等过期；或用 IAM Policy 禁止该前缀访问）

### Q4：分片上传的优势与失败处理？

**答题要点**：
- 优势：大文件并发上传提速；网络中断只重传失败的 Part 而非整个文件
- 失败处理：AbortMultipartUpload 清理未完成的 Part 释放空间
- 生命周期规则可自动清理超过 N 天未完成的 Multipart Upload
- MinIO Part 范围：5MB ~ 5GB，最多 10000 Part → 最大单对象 50TB

**追问方向**：前端如何实现断点续传？（答：上传前查询已存在的 Part 列表（ListParts），跳过已完成的 Part 只传缺失部分）

### Q5：MinIO 的元数据存在哪里？与 Ceph RADOS 有何不同？

**答题要点**：
- MinIO：每个对象目录下 xl.meta 文件记录版本、纠删码布局、ETag、用户自定义元数据
- 无中心 MDS（Metadata Server）：任何节点可应答读写请求
- Ceph RADOS：集中 OSD Map 由 MON 管理；元数据在 MDS（文件系统场景）
- MinIO 设计更简洁但桶内对象数有上限建议（亿级 OK，百亿需调优）

**追问方向**：桶内上亿对象时 List 变慢怎么办？（答：用前缀分区模拟目录；避免 List 全桶；用 Select 查询代替）

### Q6：如何实现 MinIO 异地容灾？

**答题要点**：
- 服务端主动复制（Server-Side Replication）：配置 Replication Rule，异步复制新对象到远端集群
- `mc mirror`：离线批量同步（适合初始迁移或定时备份）
- 版本复制：开启 Versioning + Replication 可同时复制所有版本（含 Delete Marker）
- RPO/RTO：异步复制 RPO 秒级~分钟级；站点故障切 DNS 到远端

**追问方向**：两地 MinIO 集群的对象 Key 相同但内容冲突怎么办？（答：Versioning 保留双方版本；Replication 以写入时间 newest-wins）

### Q7：S3 API 的常用操作有哪些？

**答题要点**：
- 桶：CreateBucket / ListBuckets / DeleteBucket
- 对象：PutObject / GetObject / DeleteObject / HeadObject / CopyObject
- 列表：ListObjectsV2（Prefix + Delimiter + ContinuationToken 分页）
- 分片：CreateMultipartUpload / UploadPart / CompleteMultipartUpload / AbortMultipartUpload
- 预签名：GeneratePresignedUrl（GET/PUT）
- 高级：SelectObjectContent（SQL 查 Parquet/CSV/JSON）

**追问方向**：ListObjects 如何模拟"目录"浏览？（答：设 Delimiter='/' + Prefix='parent/' → 返回 CommonPrefixes 即子目录）
