# POM 坐标、依赖范围与冲突调解 · 面试题

## 题 1：Maven 依赖冲突的调解规则完整说一遍？

先构建依赖树（深度=传递层级），对同一 GAV 的多个版本：**最短路径优先**（深度小者胜）；路径同深度时**声明顺序优先**（POM 中先写者胜）；同一路径重复出现取先声明。胜出者进 classpath，其余标记 omitted。要点：Maven 不做"取最新"的价值判断，所以结果依赖你写 pom 的顺序——治理靠 dependencyManagement 显式钉版本，把"顺序决定"变成"声明决定"。

## 题 2：provided 和 runtime 的区别与各自用途？

provided：编译可见、打包不含、不传递——"环境会给我"（servlet-api、容器注入的 SDK）；runtime：编译不可见、打包含、会传递——"运行才需要"（JDBC 驱动、日志实现）。用途本质都是**用构建期约束表达架构规则**：禁止业务代码直接 import 驱动类，比 code review 靠得住。

## 题 3：NoSuchMethodError 与 ClassNotFoundException 分别怎么排查？

NoSuchMethodError：编译版本≠运行版本，`dependency:tree -Dverbose` 找被 omitted 的候选，确认胜出版本是否含该方法（常是 starter 升级带大版本）；ClassNotFoundException：缺 jar（scope 误设 provided/test）或类加载器隔离（fat-jar 嵌套、SPI 反射加载），先 `unzip -l` 看产物里有没有再谈加载器。追问必答：两个都先看打包产物，产物是最硬的事实。

## 题 4：exclusion 是万能药吗？

不是。三点边界：① 踢掉的类若真被使用 → NoClassDefFoundError，要跑集成测试；② 排包只解决"这一处"，别的传递路径还会带回来，根源治理是 dependencyManagement/平台 BOM；③ 大版本排包（如踢 slf4j 2.0 保 1.7）可能让新库按 2.0 API 编译而运行在 1.7 —— 排包必须与版本表联动，禁止"报错就排"的肌肉记忆式修 pom。

## 题 5：为什么要 BOM？和父 POM 继承差在哪？

继承要求单一 parent（Java/Maven 只允许一个），跨团队无法共用；BOM 是 `scope=import + type=pom` 的**依赖注入式版本表**，可多份并存（spring-boot-dependencies + 公司内部 BOM + 中间件 BOM）。冲突规则：先 import 者优先（就近），所以公司 BOM 放前面统一口径。结论：BOM 解决"多仓协同的版本单一事实源"，parent 解决"工程结构复用"，职责不同要并用。
