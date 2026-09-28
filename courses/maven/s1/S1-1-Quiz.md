# POM 坐标、依赖范围与冲突调解 · 小测

### 1. Maven 依赖的唯一坐标是？（6分）

- A. artifactId + version
- B. groupId:artifactId:version（GAV）
- C. groupId + version
- D. POM 文件路径

> 答案：B
> 解析：GAV 三段定位仓库中唯一构件；classifier 是附加维度非坐标主体。

### 2. servlet-api 应使用的 scope 是？（6分）

- A. compile
- B. runtime
- C. provided
- D. test

> 答案：C
> 解析：容器已提供，编译可见但不能打包，否则与容器类冲突抛 LinkageError。

### 3. mysql 驱动设 scope=runtime 的效果是？（6分）

- A. 运行期才下载
- B. 编译 classpath 不含它，防止代码直接依赖驱动实现类
- C. 不打包进产物
- D. 仅测试可见

> 答案：B
> 解析：面向 java.sql 编程 + runtime 隔离，把"不许直接 new 驱动"变成构建期强制。

### 4. 两条路径深度相同的版本冲突，Maven 的裁决规则是？（6分）

- A. 取较新版本
- B. POM 中先声明的路径胜出
- C. 取较旧版本
- D. 构建报错

> 答案：B
> 解析：最短路径优先之后平级，按声明顺序先者胜——依赖书写顺序影响构建结果。

### 5. NoSuchMethodError 在依赖语境最常见的成因是？（6分）

- A. JDK 版本过低
- B. 冲突调解选中的版本没有该方法（编译期与运行期版本不一致）
- C. 类名拼错
- D. 接口未实现

> 答案：B
> 解析：调解只选一个版本；A 库按新版编译、运行时配了旧版即抛此错。

### 6. <scope>import</scope> 的合法使用位置是？（6分）

- A. dependencies 任意依赖
- B. 仅 dependencyManagement 中且 type=pom
- C. plugins 中
- D. parent 声明里

> 答案：B
> 解析：import 是 BOM 专用机制，只把版本表导进来，不引入依赖本体。

### 7. 查看被调解掉的冲突版本应使用？（6分）

- A. mvn dependency:tree -Dverbose
- B. mvn clean install -X
- C. mvn site
- D. mvn versions:set

> 答案：A
> 解析：verbose 模式标注 omitted for conflict，是冲突定位第一命令。

### 8. 关于 SNAPSHOT 版本，正确的说法包括（多选）？（9分）

- A. 每次构建会检查远端更新时间戳
- B. 可用于对外发布的正式产物
- C. 内容可变，构建不可复现
- D. 依赖它做上游联调是常见用法

> 答案：A、C、D
> 解析：B 相反——release 流程必须收敛到固定版本，SNAPSHOT 随时可能变。

### 9. 以下哪些是治理依赖冲突的正确手段？（多选）（9分）

- A. dependencyManagement 统一钉版本
- B. 把所有依赖设为 compile
- C. exclusion 踢掉多余日志绑定
- D. enforcer 的 dependencyConvergence 规则在 CI 拦截

> 答案：A、C、D
> 解析：B 与冲突治理无关且会破坏 provided/runtime 语义。

### 10. 简答题：线上报 NoClassDefFoundError: org.slf4j.impl.StaticLoggerBinder，排查与根治的完整步骤是什么？（40分）

- 要点1：读栈确认是 SLF4J 绑定缺失/多绑定问题（说明：2.x 移除 StaticLoggerBinder，1.x/2.x 混装是新版高发根因）
- 要点2：mvn dependency:tree -Dverbose | grep slf4j 找出 slf4j-api 与绑定的实际选中版本（输出：发现 api 2.0.9 但传递带入 logback 1.2.x 旧绑定）
- 要点3：判定调解路径：谁把旧绑定带上来的（最短路径胜出者）
- 要点4：根治：dependencyManagement 锁定 logback/slf4j 同代版本，或对旧 starter 加 exclusion（结果：绑定与 api 同代）
- 要点5：验证：重新打包后 unzip -l 检查 BOOT-INF/lib 内只有一份 slf4j-api 与一份绑定（验收：多绑定警告消失）
- 要点6：防回潮：CI 加 enforcer bannedDuplicates/banDuplicatePomDependencyVersions，并把 dependency:analyze 纳入流水线（错误用例：只 exclusion 不补版本管理，下次升级再犯）

> 答案：见要点
> 解析：考的是"tree 定位 → 版本表治理 → 产物验收 → CI 防回潮"闭环，缺一环都算没根治。
