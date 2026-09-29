# Dockerfile 与 Java 镜像优化

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：能写出分层友好的 Java Dockerfile——依赖缓存排序、多阶段构建、Spring Boot 分层 jar 与 JLink 定制运行时，把镜像从 GB 级压到 200MB 级并保住缓存命中率。

## 一、第一原则：按"变化频率"排层，保住构建缓存

```dockerfile
# 目的：依赖层在最上，业务代码层在最下——改一行业务代码不触发重新下载依赖
COPY pom.xml /build/pom.xml
COPY shop-common/pom.xml /build/shop-common/pom.xml
RUN cd /build && mvn -B dependency:go-offline   # 缓存整棵依赖树（最慢最变少的一层）
COPY . /build/                                   # 源码变化只让这一层及以下失效
RUN cd /build && mvn -B -DskipTests package
# 错误用法：先 COPY . 再解析依赖 —— 每次改一行代码 go-offline 全重跑，CI 构建从 40s 变 6min（结果：缓存全废）
```

## 二、多阶段构建：编译环境和运行环境分离

```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS build      # 阶段1：完整 JDK+Maven，只参与构建
WORKDIR /build
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-alpine               # 阶段2：只要 JRE，最终镜像只含这层链
WORKDIR /app
COPY --from=build /build/target/app.jar app.jar  # 目的：只搬运产物，编译工具链不进最终镜像
ENTRYPOINT ["java","-jar","/app.jar"]
# 反例：直接拿 maven 镜像跑生产 —— 镜像 1.5GB+，且携带编译器/调试工具，攻击面与体积双高（异常场景：安全扫描一票否决）
```

## 三、Spring Boot 分层 jar：把"依赖"和"代码"拆进不同镜像层

```bash
# Boot 3 的 jar 天然按 spring-boot-jarmode-layertools 分 4 层：dependencies/spring-boot-loader/application/internal
java -Djarmode=layertools -jar app.jar extract --destination layers/
```

```dockerfile
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /build/layers/dependencies/ ./
COPY --from=build /build/layers/spring-boot-loader/ ./
COPY --from=build /build/layers/application/ ./   # 只有这层随业务代码变化
# 目的：日常发版 diff 只推 KB 级的 application 层，300MB 依赖层全部缓存命中（结果：push/pull 秒级）
# 反例：整 jar 单层 COPY —— 每次发版全量重传几百 MB，仓库带宽与节点拉取时间随发版次数线性涨
```

## 四、JLink/distro 定制运行时：极限瘦身

```bash
# 目的：按模块裁 JRE，jdeps 找出应用真正依赖的 java.* 模块
jdeps --multi-release 17 --print-module-deps --ignore-missing-classes target/app.jar
# 输出示例：java.base,java.logging,java.naming,jdk.unsupported —— 据此 jlink 出 40MB 级定制运行时
jlink --add-modules java.base,java.logging,java.naming,jdk.unsupported \
      --output runtime --strip-debug --no-man-pages --compress=zip-6
```

- 现实取舍：JLink 省的是百 MB 级，运维成本（每次改依赖要重算模块集）不小；先用 `-jre-alpine` 拿到八成收益，边缘/大规模节点池再上 JLink（说明：GraalVM native-image 是另一条路线，冷启动毫秒级但牺牲调试与部分反射生态）。

## 五、Java 镜像的常见体积/速度陷阱清单

1. `RUN apt-get update && apt-get install -y ... && rm -rf /var/lib/apt/lists/*` 不同行 = 缓存文件留在下层（必须在同一 RUN 内清理）。
2. 时区/CA 证书用 `TZ=Asia/Shanghai` + `ca-certificates` 装进最终层，别把整个 tzdata 源码包带上。
3. Alpine 的 musl 与 glibc 兼容性坑（DNS 解析、某些 native 库）：金融核心链路验证不充分就用 Debian 系 slim 镜像（异常案例：musl 下 Netty DNS 解析行为差异导致偶发超时）。
4. .dockerignore 排除 target/、.git/——否则 COPY 层把构建缓存与历史全烤进镜像。

## 六、关联技术

- 分层与 CoW 原理见 s1-1；镜像进仓库与 Compose 使用见 s2-2；安全维度（非 root/扫描）见 s2-3。
- 镜像里 JVM 怎么感知 cgroup limit 见 s1-3——JVM 参数与本节镜像同等重要。
