# Dockerfile 与 Java 镜像优化 · 面试题

## 题 1：为什么"先 COPY pom 再 COPY 源码"？

- 层缓存按顺序失效：pom 很少变，先 COPY 并 `go-offline` 把依赖钉成一层；源码天天变，放最后（结果：改代码只让底部层重建，依赖层 CACHED）。
- 反例：`COPY . .` 放最前 → 任意文件变动都作废依赖层，CI 每次重下 Maven 仓库（示例量级：40s 变 6min）。
- 追问：多模块怎么 COPY？答：所有模块 pom 都要进依赖层之前，否则子模块 pom 变化仍会击穿缓存。

## 题 2：多阶段构建解决了什么两难？

- 两难：编译 Java 需要完整 JDK+构建工具（大），运行只需要 JRE+jar（小）；单阶段只能二选一。
- 解法：build 阶段用重镜像编译，`COPY --from` 只把 jar 搬进轻镜像（结果：体积与攻击面同降，编译器/源码不进生产）。
- 加分：CI 里 build 阶段可复用 runner 缓存挂载 `-v ~/.m2`，进一步加速。

## 题 3：Spring Boot 分层 jar 具体分哪几层，收益在哪？

```bash
# 目的：把"变化频率不同的内容"拆到不同 Docker 层
java -Djarmode=layertools -jar app.jar list
# 输出典型四层：dependencies(第三方库) / spring-boot-loader / application(本项目类) / internal(子模块)
# 收益：日常发版只有 application 层变（KB 级），依赖层（数百 MB）缓存全命中，push/pull 从分钟级降到秒级
# 错误预期：以为分层让"启动更快" —— 它优化的是镜像传输与构建缓存，不是运行期
```

## 题 4：镜像太大，除瘦身外还有什么连带问题？

- 分发：节点扩容/滚动发布时 pull 拖慢上线，K8s 大镜像导致 Pod 启动 Pending（异常：突发扩容时全在等镜像）。
- 安全：体积大常意味着工具/依赖多，CVE 面与扫描时长上升（结果：修复→重建→重推的循环更贵）。
- 存储：仓库带宽与磁盘成本随版本数线性膨胀；好实践：分层复用 + 定期 GC 策略（说明：瘦身是运维成本问题不只是好看）。

## 题 5：JLink 和 GraalVM native-image 都能"变小"，怎么区分？

- JLink：仍跑 HotSpot JVM，只是按 jdeps 裁剪 JRE 模块集，省的是运行时体积（风险低，兼容性接近原 JRE，需重算模块）。
- native-image：AOT 编译成原生可执行文件，冷启动毫秒+内存低，但要处理反射/动态代理（Spring 需 AOT 适配），调试与部分库受限（异常：反射未注册运行期报错）。
- 取舍：常规微服务 jre-alpine/分层 jar 够用；Serverless/边缘追求极限冷启动才上 native（示例：GraalVM 让 Boot 启动从 2s→0.1s 但构建复杂度陡增）。

## 题 6：给团队定一条 Java 镜像 Dockerfile 规范，你会写哪几条？

1. 基础镜像锁 tag 到具体版本（不用 `latest`——不可重现，异常难回溯）。
2. 高频变化层置底、依赖层置顶，`go-offline` 独立成层。
3. 一律多阶段，最终 stage 用 jre/slim；apt 操作 update+install+clean 同 RUN。
4. 必带 `.dockerignore`（target/.git/日志/IDE），Spring Boot 开 layers。
5. 非 root + 只读文件系统运行（详见 s2-3 安全），ENTRYPOINT 用 exec 形式让 java 成为 PID 1（承接 s1-3 信号处理）。
- 每条都要能说出"不犯会怎样"，规范才是可执行的而非口号。
