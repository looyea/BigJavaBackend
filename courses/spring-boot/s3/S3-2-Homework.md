# 作业题 · GraalVM 原生镜像打包（Boot 工程实践视角）

## 作业 1：跑通一次原生构建并量化收益（必做）

给一个最小 Boot Web 工程配置 `native-maven-plugin`：

- `./mvnw native-build` 产出可执行文件
- 对比 `java -jar` 与原生二进制的：**冷启动时间、空载 RSS、首个请求延迟**

**产出**：一张收益表，并说明为什么"首请求延迟"在原生下几乎无 JIT 预热差距。

## 作业 2：亲手制造并修复一次 closed-world 失败（必做，本节核心）

1. 写一段仅运行期用到的 `Class.forName("com.bigjava.Dynamic")` + 实例化，并读取 `classpath:meta/*.json`。
2. 不打 hints 直接 `native-run`，复现 `ClassNotFoundException` 与资源 `null`。
3. 实现一个 `RuntimeHintsRegistrar`（注册 reflection + resource pattern），用 `@ImportRuntimeHints` 引入后修复。
4. 用 `-Dspring.aot.enabled=true` 在普通 JVM 上提前复现同样的缺失，说明"提前暴露"的价值。

**验收标准**：修复前后各贴一次运行结果；解释 closed-world 为什么让编译器"看不见"这段反射。

## 作业 3：AOP/事务在原生下的代理提示（必做）

一个带 `@Transactional` 与自定义 `@Aspect` 的服务打原生镜像：

- 观察是否需要 proxy/serialization hints
- 若失效，用 `@RegisterReflectionForBinding` 或 hints 修复
- 总结"面向接口 + 避免 final 类/方法"为何降低原生镜像改造成本

## 作业 4：Buildpacks 免本机 GraalVM 构建（选做，架构师向）

改用 `./mvnw spring-boot:build-image -Pnative`（builder 容器内含 GraalVM），验证：

- 本机不装 GraalVM 也能产出原生镜像容器
- 配置 native build cache 后二次构建耗时下降幅度
- 给出 CI 里把"原生构建"放到独立阶段/独立 runner 的理由（构建资源与耗时隔离）

## 作业 5：技术选型备忘录（选做，架构师向）

为一个"电力负荷聚合边缘网关"写一页原生镜像选型备忘录：启动/内存诉求、下游依赖里有多少反射/动态代理、峰值吞吐要求、灰度与回滚策略，并对比"原生镜像 vs CRaC vs 分层 JIT 预热"三条路线，给出明确结论与理由。
