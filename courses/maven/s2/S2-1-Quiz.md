# 生命周期、插件与打包 · 小测

### 1. `mvn verify` 一定会依次执行的正确阶段链是？（6分）

- A. verify → test → package
- B. validate → compile → test → package → verify
- C. compile → verify → test
- D. 只执行 verify 单阶段，无前序

> 答案：B
> 解析：执行某阶段=顺序执行其前所有阶段，这是 default 生命周期必默写题。

### 2. clean 与 default 两条生命周期的关系是？（6分）

- A. clean 是 default 的第一阶段
- B. 相互独立，`mvn clean package` 是各跑一条链
- C. clean 会自动触发 install
- D. 只能二选一执行

> 答案：B
> 解析：两条独立链按命令行顺序各自展开，所以顺序写反（package clean）语义就变。

### 3. 插件某 goal 想"在 install 前把关"，绑定的常见阶段是？（6分）

- A. initialize
- B. verify
- C. site
- D. post-clean

> 答案：B
> 解析：verify 是 default 链的验收位（jacoco check/it 测试报告都放这），install 在其后。

### 4. -DskipTests 与 -Dmaven.test.skip=true 的区别是？（6分）

- A. 完全相同
- B. 前者跳过运行仍编译测试代码，后者连测试编译都跳过
- C. 前者只跳集成测试
- D. 后者会保留覆盖率报告

> 答案：B
> 解析：测试代码有编译期依赖（如新 API），全跳会掩盖编译错误——CI 滥用是事故温床。

### 5. spring-boot 应用打可执行 jar 应使用？（6分）

- A. maven-assembly 手工拼 classpath
- B. spring-boot-maven-plugin 的 repackage
- C. maven-shade 直接合并
- D. war 打包

> 答案：B
> 解析：repackage 生成 BOOT-INF 结构与启动器 Main-Class；shade 直接合并会破坏嵌套 jar 语义（常见误答 C）。

### 6. packaging=pom 的模块在 package 阶段做什么？（6分）

- A. 产出空 jar
- B. 不产 jar，install 只安装 POM 文件
- C. 报错
- D. 产出 war

> 答案：B
> 解析：聚合根/父 POM 无代码产物，这是"根模块必须 pom 打包"的机制层原因。

### 7. relocation 的典型适用场景是？（6分）

- A. 对外分发的 SDK/插件，需内置依赖且避免与宿主版本冲突
- B. 内部微服务减小 jar 体积
- C. 加速编译
- D. 替代依赖调解

> 答案：A
> 解析：改名共存是目的；业务应用滥用会造成同库双实例（单例翻倍）反例。

### 8. 关于插件 executions 的说法，正确的包括（多选）？（9分）

- A. 不写 phase 时 goal 用插件元数据里的默认绑定阶段
- B. 同一阶段多个 goal 按声明顺序执行
- C. 一个插件可以声明多个 execution 绑不同阶段
- D. 插件版本可以省略且永远一致

> 答案：A、B、C
> 解析：D 错——省略版本会随 Maven 版本/默认元数据漂移，pluginManagement 钉版本是规范。

### 9. 哪些属于 fat-jar / shaded jar 的正确实践？（多选）（9分）

- A. 用 shade 的 ServicesResourceTransformer 合并 META-INF/services
- B. 直接 zip 合并同名文件取其一
- C. 业务应用优先 spring-boot 嵌套 jar 而非 flatten 合并
- D. relocation 后验证 SPI/反射加载仍正常

> 答案：A、C、D
> 解析：B 会丢 SPI 注册（典型"合并后驱动加载失败"事故）；合并需 transformer 语义。

### 10. 简答题：`mvn deploy` 的完整执行链及每一步产物是什么？（40分）

- 要点1：先展开 clean 链（若在命令中），再 default 链：validate→compile→test→package→verify→install→deploy
- 要点2：compile 产物 target/classes（说明：主源码字节码）；test 产物 test-classes+测试报告
- 要点3：package 按 packaging 产 jar/war（boot 项目经 repackage 得可执行嵌套 jar）
- 要点4：verify 执行验收插件（jacoco check/enforcer 规则），失败即终止不进 install（结果：闸门语义）
- 要点5：install 装 ~/.m2 本机仓库；deploy 按 distributionManagement 上传私服 release 或 snapshot 库（版本含 -SNAPSHOT 自动选后者）
- 要点6：常见错误用例：deploy 版本仍是 SNAPSHOT → 下游每次拉新构建不可复现；或 distributionManagement 缺 repository 配置直接抛 MissingRepositoryException

> 答案：见要点
> 解析：能把阶段-产物-闸门-去向四层说全，才是真懂生命周期而不是背命令。
