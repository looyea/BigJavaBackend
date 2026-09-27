# 配置中心与灰度推送 · 作业

## 作业 1：多环境配置隔离

**目标**：使用 Namespace 实现 dev/prod 配置隔离。

1. 在 Nacos 控制台创建 namespace：`dev`（ID 自动分配 UUID）。
2. 应用启动时 `-Dspring.cloud.nacos.config.namespace=<dev-uuid>` 指向 dev。
3. 同一个 DataId 在不同 Namespace 写不同的 DB 连接串。
4. 切换 namespace 验证应用读到正确配置。

## 作业 2：灰度发布全流程

**目标**：模拟 Beta 灰度→验证→全量→回滚。

1. 20 台实例注册（用 Docker 模拟 2 台即可）。
2. 修改 `order.timeout.ms=5000`，选择 Beta 发布 → 只填 1 台 IP。
3. 验证只有目标实例刷新了 timeout，另一台仍为 3000。
4. 确认无误后全量发布 → 两台都变为 5000。
5. 发现 Bug → 历史版本一键回滚 → 恢复 3000。

## 作业 3：加密配置

**目标**：将 DB 密码加密存储。

1. 启用 `nacos-encryption-plugin`，配置 AES 密钥。
2. 在 DataId 中写入 `db.password={cipher-aes}<encrypted>`。
3. 应用 `@Value("${db.password}")` 拿到明文。
4. Nacos 控制台查看只显示密文，不泄露明文。
