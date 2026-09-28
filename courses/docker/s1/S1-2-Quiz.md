# Dockerfile 与 Java 镜像优化 · 小测

### 1. Dockerfile 指令与镜像层的关系是？（6分）

- A. 每条指令都生成一个新层（包括注释）
- B. 大多数指令（RUN/COPY/ADD）生成一层，纯元数据指令不生成可见数据层
- C. 整个 Dockerfile 只有一个层
- D. 层数与指令无关，随机合并

> 答案：B
> 解析：RUN/COPY/ADD 产数据层；ENV/LABEL/EXPOSE 只改元数据；理解这点才能解释"层缓存"如何被失效。

### 2. 构建缓存失效的规则是？（6分）

- A. 永远从第一层重建
- B. 某层指令或其输入（如 COPY 的文件内容）变化，该层及其后所有层失效
- C. 只有最后一层会失效
- D. 缓存由镜像名决定

> 答案：B
> 解析：所以"先 COPY pom 解析依赖、再 COPY 源码"的排序本质是把高频变化层压到最底部。

### 3. 多阶段构建的核心收益是？（6分）

- A. 编译更快
- B. 最终镜像只含运行所需，不带编译工具链
- C. 可以不用写 Dockerfile
- D. 自动压缩镜像

> 答案：B
> 解析：build 阶段用 full JDK+Maven，runtime 阶段只 COPY 产物 jar（结果：体积与攻击面同时下降）。

### 4. Spring Boot 分层 jar 的目的是？（6分）

- A. 加速 JVM 启动
- B. 把低频变化的依赖层与高频变化的代码层拆成不同 Docker 层，复用缓存
- C. 减少 jar 数量
- D. 支持热部署

> 答案：B
> 解析：依赖层不变 → push/pull/构建全命中缓存，发版只传变化的 application 层；对 CI 带宽和节点拉取时间影响巨大。

### 5. `mvn dependency:go-offline` 在 Dockerfile 里的作用是？（6分）

- A. 编译代码
- B. 提前把依赖下到镜像层，后续构建可离线且缓存友好
- C. 打包 jar
- D. 清理本地仓库

> 答案：B
> 解析：单独一层缓存住整个依赖树，代码变化不重复拉 Maven 仓库（异常场景：私服抖动时构建不再随机失败）。

### 6. JLink 能裁 JRE 的依据来自？（6分）

- A. 手动猜模块
- B. jdeps 分析 jar 实际依赖的 java.* 模块
- C. Dockerfile 的 FROM 行
- D. 反射扫描 class

> 答案：B
> 解析：jdeps 输出模块清单，jlink 按清单组装精简运行时；漏模块的表现是运行时 ClassNotFoundException/NoClassDefFoundError。

### 7. `RUN apt-get update` 的正确姿势是？（6分）

- A. 单独一行，后续再 RUN install
- B. update/install/清理 lists 合并同一条 RUN
- C. 放在 CMD 里
- D. 放最底部

> 答案：B
> 解析：合并保证装完即删缓存，且不留下 update 的孤立层（错误用例：分两行则 update 的 lists 留在下层占体积）。

### 8. 关于镜像瘦身，正确的有（多选）（9分）

- A. 使用 -slim/-jre 基础镜像减少未用工具
- B. 多阶段构建让编译期依赖不进最终镜像
- C. .dockerignore 排除 target/、.git/ 防无关文件进层
- D. 在容器运行时 rm 大文件来减小镜像体积

> 答案：ABC
> 解析：A/B/C 都是构建期正确手段；D 是常见错误——运行期删除不改镜像本身，要瘦身必须在镜像层设计阶段动手（CoW 原理）。

### 9. 关于 Alpine 基础镜像，说法正确的有（多选）（9分）

- A. 体积极小是其最大卖点
- B. 使用 musl libc，可能与 glibc 编译的 native 库/DNS 行为不兼容
- C. 金融核心系统应不加验证地全面替换成 Alpine
- D. glibc 依赖强的场景可退到 Debian slim 镜像

> 答案：ABD
> 解析：A/B 是共识；C 是危险做法（异常案例：Netty/本地库 DNS 行为差异引发偶发故障）；D 是稳妥替代。

### 10. 简答题：把一个 1.2GB 的 Spring Boot 镜像优化到 300MB 以内，给出完整方案与每步验收方法。（40分）

- 要点1：先测量再动手——用 dive/hist 查看每层体积找大头（常见：完整 JDK、Maven 本地仓库、target 全量拷贝）；输出基线数据，否则无法证明收益。
- 要点2：基础镜像从 eclipse-temurin:17（完整 JDK）换 -jre 或 -jre-alpine，单步验收：docker images 对比体积，功能回归启动正常（异常场景：换 alpine 后需验证 DNS/native 依赖）。
- 要点3：多阶段构建隔离编译期——最终镜像只 COPY jar，Maven/源码不进运行时（验收：容器内 `which mvn` 找不到、体积断崖下降）。
- 要点4：Spring Boot 分层 jar——dependencies 层与 application 层拆开，验收：改一行业务代码重新 build，依赖层显示 CACHED 且 push diff 只有 KB 级。
- 要点5：清理与卫生：apt 缓存同层删除、.dockerignore 排除 .git/target/日志、不带调试工具（结果：镜像内容审计通过、trivy 扫描面缩小）。
- 要点6：可选极限手段按风险取舍：JLink 模块裁剪（验收：jdeps 全覆盖 + 全链路回归）、native-image（收益最大但反射/AOT 成本最高，说明：优化要停在"够用且风险可控"，不是无上限追小）。

> 答案：见要点
