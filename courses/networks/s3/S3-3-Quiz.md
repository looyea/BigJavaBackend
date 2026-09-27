# HTTPS、TLS 1.2/1.3 与证书体系 · 小测验

### 1. TLS 握手中用非对称加密的主要目的是（15分）

- A. 加密全部业务数据
- B. 安全地协商出后续对称通信的会话密钥并认证身份
- C. 压缩头部
- D. 生成随机数

> 答案：B
> 解析：非对称加密慢，只用在握手期——安全交换/认证，最终目的是让双方得出一把对称会话密钥，之后真实数据用对称加密（混合加密）。

### 2. 关于 TLS 1.3，下列错误的是（15分）

- A. 常规握手只需 1-RTT
- B. 恢复了会话时可用 0-RTT 发送早期数据
- C. 仍保留 RSA 密钥交换以兼容旧系统
- D. 默认提供前向安全

> 答案：C
> 解析：TLS 1.3 恰恰**删除了静态 RSA 密钥交换**，只保留 (EC)DHE 以强制前向安全。A/B/D 均为 1.3 特征。

### 3.【多选】"前向安全（PFS）"的正确理解包括（20分）

- A. 依赖临时（ephemeral）密钥交换如 ECDHE
- B. 服务器长期私钥泄露后，仍无法解密之前录下的历史密文
- C. 会话密钥由服务器公钥直接加密传输
- D. TLS 1.3 默认所有握手都具备前向安全

> 答案：ABD
> 解析：C 描述的是**旧 RSA 密钥交换**（无前向安全，私钥泄露即能解历史），正是被淘汰的对象。A/B/D 正确：临时密钥用完即弃，长期私钥只用于签名。

### 4. 填空题：现代浏览器校验 HTTPS 证书时，域名匹配看的是证书的 ____（Common Name 已废弃）。（10分）

> 答案：SAN / Subject Alternative Name
> 解析：证书域名匹配只看 Subject Alternative Name(SAN)，Common Name(CN) 已废弃；一证多域名要把全部域名列进 SAN。

### 5. 客户端报 `PKIX path building failed / unable to find valid certification path`，Java 侧最可能的原因是（10分）

- A. 服务器 CPU 太慢
- B. 服务端证书对应的根/内部 CA 不在 JVM 的 truststore（cacerts）里
- C. HTTP 头写错了
- D. 端口没开

> 答案：B
> 解析：Java 用 `$JAVA_HOME/lib/security/cacerts`（或指定 truststore），不读系统根库。自签/内部 CA 未 `keytool -importcert` 导入就会 PKIX 建链失败。

### 6. 简答：上线新站点后，"部分安卓 App 直连报证书不受信任，iPhone 与浏览器正常；同时握手在多国偶发变慢"。请给出至少三条排查方向，并说明如何降低 TLS 握手延迟。（30分）

> 参考答案：
> - 要点（链不全）：服务器只发了叶子证书、**缺中间 CA 证书**——iOS/浏览器能靠 AIA 补链、部分安卓不能，导致安卓 PKIX 建链失败。修复：部署 full chain（叶子+中间），用 `openssl s_client` 验证链完整。
> - 要点（信任根/时间）：确认是**自签/内部 CA 未进安卓 truststore**、还是设备**系统时间错误**导致"证书未生效/已过期"；SAN 是否覆盖该访问域名。
> - 要点（吊销查询）：未配 **OCSP Stapling**，客户端各自去问 CA 查吊销 → 跨境慢。开启 stapling 由服务器预取凭证随握手带上，省一次往返。
> - 降延迟要点：**升级 TLS 1.3（1-RTT、会话恢复 0-RTT 但注意重放）**、启用 **session resumption/ticket**、**OCSP stapling**、在边缘/LB **卸载 TLS**（就近握手、复用连接）、选近用户的节点。
> - 安全红线：绝不为"能连上"而让 App 信任所有证书 / 关域名校验。
