# HTTPS、TLS 1.2/1.3 与证书体系

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：对称+非对称+摘要的混合设计、完整握手与密钥调度、证书链校验与 CA 信任、SNI、双向 mTLS、会话复用与 0-RTT 重放风险、前向安全、cert 轮换与常见握手失败定位。

> HTTPS = HTTP over TLS。它一次性解决三件事：**加密**（防窃听）、**完整性**（防篡改）、**身份认证**（防冒充）。本节把 TLS 握手"为什么这样设计"、证书链"信任怎么传递"、以及线上最常见的握手失败定位讲透。（重要度 5/5，核心精讲；承接 s3-1/s3-2，铺垫 s3-4/S4 全链路）

## 一、为什么是"混合加密"：三种密码学原语各司其职

单用一种都不够，TLS 的组合拳：

| 原语 | 代表 | 作用 | 为什么用它 |
|---|---|---|---|
| **非对称加密** | RSA / ECDH | 握手期安全地协商出对称密钥、身份签名 | 慢，但能在不安全信道建立信任 |
| **对称加密** | AES-GCM / ChaCha20-Poly1305 | 传输期加密真实数据 | 快，且**自带完整性(AEAD)** |
| **摘要/哈希** | SHA-256 | 完整性校验、签名前置 | 定长指纹、抗碰撞 |
| **数字签名** | ECDSA/RSA-PSS | 证书与握手消息认证 | 私钥签、公钥验，证明身份 |
| **密钥派生 KDF/HKDF** | TLS1.3 HKDF | 从共享秘密导出多把会话密钥 | 一把 master → 多把用途分离 |

**核心矛盾**：非对称加密太慢，不可能加密所有业务数据；对称加密快，但"怎么把密钥安全递给对方"是难题（密钥分发问题）。**解法**：用非对称/ECDH 在握手里安全协商出**一次性对称会话密钥**，之后全部用对称加密 —— 这就是"混合加密"。

## 二、TLS 1.2 握手（理解演进，面试仍考）

以 ECDHE 密钥交换为例（RSA 密钥交换是旧式，见第四节前向安全）：

```
Client                                          Server
 │ ClientHello: 版本、随机数C、密码套件列表、      │
 │   extensions[supported groups, session票,     │
 │   SNI=www.example.com, ALPN=h2]               │
 │──────────────────────────────────────────────▶│
 │ ServerHello: 选定套件、随机数S                 │◀ 选出双方都支持的套件
 │ Certificate: 服务器证书链                      │
 │ ServerKeyExchange: ECDHE 公钥参数(+签名)       │  ← 签名证明参数来自持私钥者
 │ ServerHelloDone                               │
 │◀──────────────────────────────────────────────│
 │ ClientKeyExchange: 客户端 ECDHE 公钥           │  双方各自算出相同的预主密钥
 │ ChangeCipherSpec / Finished                   │  切换加密，验证握手完整性
 │──────────────────────────────────────────────▶│
 │ ChangeCipherSpec / Finished                   │
 │◀──────────────────────────────────────────────│
 │============ 用会话密钥的对称加密通信 ===========│
```

- **三个随机数**（C、S、以及预主密钥）共同参与密钥导出 → 每次会话密钥不同（防重放、支撑前向安全）。
- **ECDHE**：双方各出一个临时 ECDH 公钥，交换后各自算出同一个共享秘密（离散对数难题保证中间人算不出）。
- **SNI（Server Name Indication）**：ClientHello 明文带上要访问的域名，让一台 IP/一个证书承载多域名的虚拟主机能选对证书（呼应 s3-4）。**SNI 明文**曾是隐私缺口，TLS1.3 有 ECH/ESNI 加密它。

## 三、TLS 1.3：更快更安全（必讲演进）

TLS 1.3（2018）是一次大重构，**面试区分度极高**：

| 维度 | TLS 1.2 | TLS 1.3 |
|---|---|---|
| 握手 RTT | **2-RTT** | **1-RTT**（恢复会话 **0-RTT**） |
| 密码套件 | 繁多（含许多不安全旧算法） | 精简到 5 个，**强制前向安全**（只留 ECDHE/DHE，删 RSA 密钥交换） |
| 密钥交换 | 可选 | **固定 ECDHE**（一上来就带 key_share） |
| 握手消息 | 部分明文 | ServerHello 之后证书等**全部加密** |
| 压缩/ renegotiation / 静态 RSA | 有（多个已知漏洞） | **删除** |

- **1-RTT**：ClientHello 就带上 `key_share`（我的 ECDHE 公钥），ServerHello 直接回自己的 + 加密证书，一个来回就能算出会话密钥并发 Finished。
- **0-RTT（Early Data / PSK 恢复）**：老客户端有会话票据时，可在第一个 flight 里就带上应用数据。**代价：重放攻击** —— 攻击者把这段"早数据"原样再发一次，服务器可能重复执行。因此 **0-RTT 只允许放幂等、无副作用的请求**（呼应 s3-2 QUIC 0-RTT、s3-1 幂等）。工程上要么只对 GET 开，要么服务端做 single-use ticket / freshness 检测。
- **完美前向安全（PFS）默认**：因为临时 ECDHE 密钥用完即弃，**即使服务器长期私钥日后泄露，也解不开之前抓的密文**。

## 四、前向安全（PFS）—— 为什么删掉 RSA 密钥交换

- **旧 RSA 密钥交换**（TLS1.2 的 `TLS_RSA_*`）：客户端用服务器**公钥**加密预主密钥。一旦服务器**私钥未来泄露**，攻击者可解密**历史上所有**录下的密文 —— 没有前向性。
- **ECDHE**：会话密钥来自**临时**（ephemeral）密钥对，握手完就销毁。私钥只用于**签名**认证、不参与密钥加密 → 长期私钥泄露也推不出历史会话密钥 = **前向安全**。
- 这就是 TLS 1.3 **只保留 (EC)DHE** 的根本原因，也是今天扫描器给"无 PFS 套件"打红的依据。

## 五、证书体系：信任是怎么传递的

公钥裸发会被中间人替换（我给你我的公钥、冒充服务器）。**证书 = CA 用它的私钥对"服务器公钥 + 域名 + 有效期 + 扩展"签的名**，把信任锚定到内置的根 CA。

**验证链（客户端视角）**：
```
服务器证书  ←签名 by→  中间 CA(Issuing)  ←签名 by→  根 CA(Root，内置于 OS/浏览器信任库)
   │ 逐级用上一级公钥验签，直到抵达本地信任的根
   ├─ 校验域名与证书 CN/SAN 匹配（现在是 SAN，不再看 CN）
   ├─ 校验有效期 notBefore/notAfter
   ├─ 校验吊销状态：CRL / OCSP / OCSP Stapling / CRLSets
   └─ 任一失败 → 浏览器告警/阻断
```

- **不要给服务器单独部署"根证书"**：服务器只需发**叶子 + 中间证书**，根在客户端信任库里。少了中间证书 → 部分客户端验链失败（高频线上事故，"手机 App 能连、某些安卓连不上"就是缺中间证书，需配 full chain）。
- **SAN vs CN**：现代浏览器**只认 Subject Alternative Name**，Common Name 已废弃。多域名用 SAN 列全（一证多域）。
- **OCSP Stapling**：否则每次握手要问 CA"这证书吊销没"（慢、泄露访问隐私）。**由服务器替客户端预先取好签名时效凭证（staple）随握手带上**，省一次往返、护隐私。**TLS1.3 用 CRL 或 OCSP v2/delegated 凭证**。
- **证书透明度 CT**：公网证书须记入公开日志（防 CA 滥签不被发现），Google 要求含 SCT。
- **证书类型**：DV（域名验证）/ OV（组织）/ EV（扩展验证，浏览器绿名，如今淡化）。自动化靠 **ACME（Let's Encrypt）** 90 天短证书 + 自动续期 —— **短生命周期 + 自动轮换** 已取代"长证书 + 手动换"。

## 六、mTLS 双向认证

普通 TLS 只认证服务器。mTLS（mutual TLS）额外让**客户端也出示证书**，服务器验之 —— 零信任服务间/开放银行 API 常用（身份绑到证书而非 token）。代价：客户端证书的分发与吊销体系庞大，常与 SPIFFE/短证结合。

## 七、Java 侧要点与常见失败定位

```bash
# 例子目的：一条命令看清协商的协议版本/套件/证书链/是否 PFS/是否 OCSP stapling
openssl s_client -connect host:443 -servername www.example.com -tls1_3 </dev/null   # 强制 TLS1.3，-servername 带 SNI
openssl s_client -connect host:443 </dev/null | sed -n '/Certificate chain/,/---/p'  # 只截证书链段落
curl -vI https://host --tlsv1.2                     # 看握手与协商结果（HTTP/1.1 HEAD）
# 正确用法结果：输出含 "Protocol : TLSv1.3"、"Cipher : TLS_AES_256_GCM_SHA384"、证书链层级，即可确认是否 PFS（TLS1.3 默认全 PFS）
# 错误用法：忘写 -servername（SNI）→ 多域名主机上拿到默认证书，误判成"证书不对"（实际是没带 SNI）
# 错误用法：服务端只开 TLS1.2 却用 -tls1_3 强连 → 握手中断，回显 handshake failure / alert protocol version，不是证书问题而是版本不兼容
```
- **JDK 信任库 `cacerts`**：Java 不读系统根库，读 `$JAVA_HOME/lib/security/cacerts`。**内部 CA / 自签证书必须 `keytool -importcert` 导入 truststore**，否则 `PKIX path building failed`（`unable to find valid certification path`）。
- **证书过期 / 域名不匹配 / 缺中间证书** → 浏览器/客户端报 `NET::ERR_CERT_*`、Java 报 `No subject alternative DNS name matching`。
- **`javax.net.ssl.trustStore` / `SSLContext`** 指定自定义信任库；**生产禁用"信任所有证书"的 TrustManager（防 MITM，安全红线）**。
- **`HostnameVerifier`** 别返回 true（等于关掉域名校验）。
- 握手失败定位顺序：**① 时间对不对（证书有效期）② 域名对不对（SAN）③ 链全不全（中间证书）④ 协议/套件是否双方都支持（老旧 JDK 只有 TLS1.0 被服务端拒）⑤ 客户端信不信任根（truststore）**。

## 八、三大行业场景钩子

- **电商**：全站 HTTPS + HSTS（`Strict-Transport-Security` 强制后续只走 https、防降级/sslstrip）；证书用 ACME 自动续期，配 OCSP Stapling 降握手延迟；对外只放 TLS1.2/1.3 强套件。
- **金融**：银企/机构对接普遍 **mTLS 双向认证**，身份绑证书、配合证书吊销名单实时校验；密钥存 HSM，严禁私钥落盘明文；监管要求可审计，故 TLS 版本与套件要白名单固化。
- **电力**：海量终端接主站，若每终端一张长期证书，**轮换与吊销是噩梦** → 走轻量 PKI + 短证 + 批量续期，或用国密 TLS（GM/T 0024 SM2/SM3/SM4）满足合规；嵌入式要评估加解密算力（优先选硬件 SE/协处理器）。

## 九、要点回顾

1. HTTPS 解决**加密 + 完整性 + 认证**；用**混合加密**：非对称/ECDH 协商密钥、对称 AEAD 传数据、摘要/签名做认证、KDF 导密钥。
2. **TLS1.2 = 2-RTT**；**TLS1.3 = 1-RTT + 恢复会话 0-RTT**，删不安全套件、握手大部分加密、**默认前向安全**。
3. **前向安全**：用临时 **ECDHE**，私钥只做签名；即使私钥泄露也解不开历史密文（这是 RSA 密钥交换被淘汰的原因）。
4. **0-RTT = 快但有重放风险**，只放幂等数据。
5. **证书链**：叶子 + 中间，根在客户端信任库；验证=验签+域名(SAN)+有效期+吊销(OCSP Stapling)；缺中间证书/域名不符/过期是三大常见故障。
6. Java 读 **cacerts**，自签/内部 CA 要导 truststore；**禁止信任所有证书**、禁关 HostnameVerifier。
7. 定位顺序：**有效期 → SAN 域名 → 链完整性 → 协议/套件 → 信任根**。
