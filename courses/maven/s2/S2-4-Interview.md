# 多模块构建、Profile 与 CI 集成 · 面试题

## 题 1：多模块 Maven 构建顺序谁决定？

- reactor 读 <modules>，按模块间依赖拓扑排序，被依赖的先构建。
- 不是声明顺序，Maven 会重排。
- 加分：知道 `-pl`/`-am`/`-amd` 在此之上做定向裁剪。

## 题 2：CI 里只想构建改动的模块怎么办？

- `mvn -pl <模块> -am` 连带其上游依赖；改公共库用 `-amd` 带下游。
- 配合 `-T` 并行、缓存 `~/.m2`、`-o` 离线，大幅缩短反馈。
- 加分：强调"全量每次构建"是最常见 CI 反模式。

## 题 3：环境配置差异怎么管最稳？

- 用 Profile 收敛到同一 POM，按 `-Denv=prod` 等条件自动激活，敏感值从 CI 变量注入。
- 反对"每环境复制一份 pom.xml"——差异各自漂移。
- 加分：提到 `activeByDefault` 与多种 activation 触发方式。

## 题 4：`${revision}` 统一版本有什么坑？

- 直接 install/deploy 会让 POM 里残留 `${revision}`，下游解析版本失败。
- 必须配 flatten-maven-plugin 在打包前展开成真实版本。
- 加分：这是"多模块版本单点管理"的标准解法。

## 题 5：Maven 缓存在 CI 里要注意什么？

- Release 不可变可长缓存；SNAPSHOT 可变，长缓存会拿到脏快照。
- 对 SNAPSHOT 用 `-U` 强制更新或缩短缓存 TTL。
- 加分：缓存 key 关联 pom/settings，避免结构变化后命中旧缓存。

## 题 6：Maven 多模块和 Gradle 复合构建怎么比？

- Maven reactor 声明式、聚合直观、生态成熟、CI 集成稳定；配置偏 XML 冗长。
- Gradle 增量与缓存更细、DSL 灵活，但学习曲线与配置正确性更考验人。
- 加分：选型看团队规模、构建性能诉求与既有生态，而非"谁更现代"。
