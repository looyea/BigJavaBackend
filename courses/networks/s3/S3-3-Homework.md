# HTTPS、TLS 1.2/1.3 与证书体系 · 课后作业

> 两题各 50 分：一题亲手签发一份自签证书链并让 Java 客户端信任它，一题分析一次真实握手抓包。

## 作业 1：搭一条最小 PKI（根 → 中间 → 叶子）并让 Java 信任（50 分）

**要求**：
1. 用 `openssl` 生成：**根 CA**（自签）→ **中间 CA**（根签）→ **服务器叶子证书**（中间签，SAN 含 `DNS:localhost`）。
2. 起一个 HTTPS 服务（Nginx/`openssl s_server`/Spring Boot），只部署**叶子 + 中间证书**（不部署根），私钥配好。
3. 用浏览器访问 `https://localhost`，观察"不受信任"告警（因为根不在系统信任库），理解"信任锚"。
4. 把**根 CA** 用 `keytool -importcert -keystore $JAVA_HOME/lib/security/cacerts`（或独立 truststore + `-javax.net.ssl.trustStore`）导入，写个最简 Java `HttpClient` 访问，验证握手成功。
5. 反向实验：**不部署中间证书**只发叶子，看客户端是否报建链失败，理解"full chain"。

**验收标准**：
- 提交三级证书关系截图/命令，`openssl verify -CAfile root.pem -untrusted intermediate.pem leaf.pem` 通过。
- Java 导入根前后，一次 `PKIX path building failed`、一次成功，对比说明。
- 说明为什么服务器不该把根证书发给客户端。

**参考答案要点**：
- 叶子由中间签、中间由根签；客户端从叶子逐级验签到自己信任的根即建链成功。
- 服务器发"叶子 + 中间"即可，根在客户端信任库里；发根无意义且可能被误当额外锚。
- 缺中间 → 无法把叶子连到根 → 建链失败（部分客户端不自动补链）。

## 作业 2：用 openssl 区分 TLS 1.2 与 1.3 握手（50 分）

**要求**：
1. 对公网站点分别强制版本握手并记录：`openssl s_client -connect host:443 -tls1_2` 与 `-tls1_3`，比较：
   - 协商出的 `Cipher is ...`（1.3 应为 `TLS_AES_..._GCM`/`CHACHA20` 这类 AEAD）。
   - `New, TLSv1.3` 与握手消息条数差异（1.3 更少往返、证书加密）。
2. 验证**前向安全**：确认 1.2 下协商的套件是否含 `ECDHE`（若无 PFS 会打红）。
3. 用浏览器/`testssl.sh` 观察目标站是否支持 **OCSP stapling**、证书到期时间、SAN 列表。
4. 结论：给一份"对外 HTTPS 加固清单"（≥5 条，如只放 TLS1.2/1.3 + 强套件、开 HSTS、开 stapling、ACME 自动续期、禁用弱曲线/压缩）。

**验收标准**：
- 能指出 1.3 相比 1.2 握手更短、套件更精简且默认 PFS。
- 加固清单可操作、含 HSTS 与 OCSP stapling 与自动续期。
- 说清"为什么关 TLS 压缩"（CRIME/BREACH 类侧信道）。

**参考答案要点**：
- 1.3：`key_share` 前置 → 1-RTT；ServerHello 后证书/Finished 全加密；只留 AEAD + (EC)DHE。
- HSTS 防 sslstrip 降级；stapling 降低吊销查询延迟与隐私泄露；ACME 短证自动轮换减少"过期事故"。
