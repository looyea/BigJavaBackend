# 文件上传、SSRF 与命令注入

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：能守住三类常被忽视却高危的攻击面——文件上传、SSRF、命令注入。文件上传的失守点在于"只信扩展名/只信前端"，正确姿势是**多重校验 + 存储隔离 + 执行隔离**：白名单校验真实 MIME/魔数（而非仅文件名后缀）、限制大小、用随机文件名重命名（防路径穿越与覆盖）、存到**与 Web 根隔离的目录或对象存储**、关闭该目录脚本执行权限、图片可二次转码去除嵌入的恶意载荷、下载时 `Content-Disposition` 与正确 `Content-Type` 防解析成 HTML。SSRF（服务端请求伪造）指 attacker 诱导服务端去访问其内网地址（`127.0.0.1`、`169.254.169.254` 云元数据、内网服务），防御核心是**出网管控**：URL 解析后对目标做**白名单域名/网段**校验（解析 IP 后挡私网/回环/链路本地，防 DNS 重绑定与 302 跳转绕过）、禁用不需要的协议（`file://`、`gopher://`）、超时与响应体大小限制。命令注入发生在把用户输入拼进 `Runtime.exec`/shell，防御是**能不拼就不拼**——用参数化 API、白名单枚举命令与参数、绝不 `sh -c "..." + 用户输入`。识破"扩展名校验被 `.jsp.png`/双扩展绕过""把上传目录放在可执行 Web 根""SSRF 只黑名单 `localhost` 却漏 `127.0.0.1`/十进制 IP/IPv6""exec 拼 `|`/`;` 被当 shell 元字符""用 Base64/编码绕过过滤"等坑。

## 一、文件上传：校验 + 隔离

```java
// 目的：上传不做"只信后缀"的表面校验, 而是真内容 + 隔离双管
String realType = probeMagicNumber(bytes);             // 说明：读魔数/真实 MIME, 而非信任 fileName 后缀
if (!ALLOWED.contains(realType)) throw new BizException("非法类型");  // 反例：endsWith(".jpg") ❌ .jpg.jsp/双扩展被绕过 ❌
Path dir = UPLOAD_ROOT.resolve(userId);                 // 结果：存到与 Web 根隔离的目录, 该目录关脚本执行
Files.createDirectories(dir);
Files.write(dir.resolve(UUID.randomUUID() + ext), bytes); // 说明：随机重命名, 防路径穿越(../)与同名覆盖
// 反例：把文件原样存进 src/main/webapp 且保留原名 ❌ 可被当作 JSP 执行 → 直接 getshell ❌
```

## 二、SSRF：出网目标必须白名单

```text
图目的：SSRF 防御的关键是"解析后再判、按 IP 段拦"
① 解析 URL → host 解析成 IP → 拦截私网/回环/链路本地(10/172.16/192.168/127/169.254/::1)
② 只允许白名单协议(http/https)与目标域名, 禁 file://gopher://dict://
③ 防绕过：DNS 重绑定(解析后再校验连接目标)、302 跳转(每一跳都复检)、十进制/IPv6 混淆 IP
④ 兜底：短超时 + 限制响应体大小 + 服务账号最小权限, 云环境默认屏蔽 169.254.169.254 元数据
```

## 三、命令注入：能参数化就别碰 shell

```java
// 目的：调用外部命令时杜绝把用户输入拼进 shell 字符串
String file = sanitizeName(req.name);                   // 说明：白名单字符过滤 + 枚举校验, 拒绝 ../|;& 等
new ProcessBuilder("convert", file, "out.png")          // 结果：参数数组分别传递, 不经 shell 解析元字符
        .directory(WORK_DIR).start();
// 反例：Runtime.exec("convert " + userInput + " out.png") ❌ 输入含 "; rm -rf /" 或管道即被 shell 执行 ❌
// 反例：黑名单删 " " "&" ❌ 编码/大小写/IFS 绕过百出 ❌ 应白名单或干脆用库 API 替代 exec
```

## 四、坑与底线

- **纵深防御，不靠单点过滤**：上传、SSRF、命令执行都要"校验 + 隔离 + 最小权限"叠加，任何一层被绕过仍有下一层兜底。
- **白名单优于黑名单**：类型、域名、命令与参数一律用允许集合，黑名单永远列不全绕过姿势。

## 五、关联课程

注入类漏洞的预处理根因见 [注入原理与预处理防御](../s1/S1-1-Lesson.md)；越权与业务分支被薅的防线承接 [反序列化、越权与业务逻辑漏洞](../s1/S1-3-Lesson.md)；认证会话与 CSRF 协同见 [认证会话安全与 JWT/CSRF 协同](./S2-2-Lesson.md)；把此类检查固化进研发流程见 [安全开发生命周期与依赖漏洞治理](./S2-3-Lesson.md)。
