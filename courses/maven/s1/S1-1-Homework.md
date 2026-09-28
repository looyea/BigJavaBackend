# POM 坐标、依赖范围与冲突调解 · 作业

## 作业 1：冲突现场还原与根治

**目标**：亲手制造并修复一次 NoSuchMethodError。

1. 引入同时依赖 slf4j 1.7 与 2.0 的两个 starter，构建后 `mvn dependency:tree -Dverbose` 记录被 omitted 的版本（输出：调解结果与胜出路径）。
2. 运行观察绑定缺失异常 → 用 dependencyManagement 钉版本根治 → 复测通过。
3. 总结：写出"最短路径优先/先声明优先"两条规则各自在你树上生效的位置。

## 作业 2：scope 语义验证

**目标**：证明 provided 编译可见、运行不可见。

1. 把 junit 的 scope 从 test 改为 compile 跑 `mvn package`，检查 fat-jar 是否混入测试框架（结果：产物膨胀且不该有）。
2. 用 `mvn dependency:copy-dependencies -DoutputDirectory=target/libs` 对比三种 scope 的落盘集合（验收：runtime 依赖在、provided 不在）。

## 作业 3：BOM 与版本治理

**目标**：把多模块版本收敛到一处。

1. 建 parent POM import spring-boot-dependencies，子模块全部去掉 version 标签。
2. 故意在子模块写一个低于 BOM 的 version → 观察就近原则覆盖（错误用例体验）→ 用 enforcer requireUpperBoundDeps 拦截该写法（输出：CI 构建失败即治理生效）。
