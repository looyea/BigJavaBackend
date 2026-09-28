# 多模块构建、Profile 与 CI 集成 · 小测

> 本卷满分 100 分：单选 7×6=42，多选 2×9=18，简答 1×40=40。

### 1. reactor（反应堆）在多模块构建中的作用是（6分）

- A. 随机顺序编译模块
- B. 读取 <modules> 按依赖拓扑排序，保证被依赖模块先构建
- C. 只构建根模块
- D. 并行下载依赖

> 答案：B
> 解析：reactor 依据模块间依赖排出正确构建次序，公共/被依赖模块先行，避免下游找不到上游产物。

### 2. `mvn -pl <模块> -am` 的含义是（6分）

- A. 只构建该模块、忽略其依赖
- B. 构建指定模块并连带构建它依赖的上游模块
- C. 构建全部模块
- D. 删除该模块

> 答案：B
> 解析：-pl 指定项目列表、-am（--also-make）补齐其上游依赖，实现定向/增量构建；-amd 才是连带下游。

### 3. 想在改动公共库后把依赖它的下游也一起构建，应加（6分）

- A. -pl
- B. -amd（--also-make-dependents）
- C. -o
- D. -DskipTests

> 答案：B
> 解析：-amd 连带构建"依赖被选模块"的下游；-am 是向上补依赖，-amd 是向下补依赖者。

### 4. 关于 Profile 的环境差异管理，更优的做法是（6分）

- A. 为每个环境复制一份完整 pom.xml
- B. 差异收敛到同一 POM 的 Profile，按 -D 属性/JDK 等条件自动激活
- C. 手工每次记住加 -P
- D. 把密码写进 POM

> 答案：B
> 解析：多份 POM 会各自漂移、改一处忘三处；自动激活（如 CI 传 -Denv=prod）减少手工 -P 遗漏。

### 5. `${revision}` 统一版本必须配合的插件是（6分）

- A. maven-compiler-plugin
- B. flatten-maven-plugin
- C. maven-jar-plugin
- D. surefire

> 答案：B
> 解析：flatten 在 install/deploy 前把 ${revision} 展开成真实版本；否则下游解析到字面量占位符而失败。

### 6. CI 中加速 Maven 构建最有效的手段是（6分）

- A. 每次清空并重新下载所有依赖
- B. 缓存 ~/.m2/repository + 按变更模块裁剪构建范围 + -T 并行
- C. 串行全量构建
- D. 关掉编译检查

> 答案：B
> 解析：本地仓库缓存避免重下、裁剪避免全量、并行压缩时长，是 CI 提速三件套；每次从零全量最拖反馈。

### 7. 缓存 ~/.m2 时对 SNAPSHOT 依赖应（6分）

- A. 和 Release 一样长期缓存无妨
- B. 谨慎，长缓存易拿到过期脏快照，应设较短缓存或强制更新 -U
- C. 不能有任何缓存
- D. 只缓存 SNAPSHOT

> 答案：B
> 解析：SNAPSHOT 可变，长缓存会命中旧快照造成脏依赖；Release 不可变适合长缓存，SNAPSHOT 用 -U/短 TTL。

### 8.（多选）属于 CI 反模式、会拖慢或 destabilize 构建的有（9分）

- A. 每次全量构建所有模块
- B. 不缓存本地仓库、每次重下依赖
- C. 按变更模块用 -pl/-am 裁剪
- D. 把 SNAPSHOT 长期缓存导致脏依赖

> 答案：A、B、D
> 解析：A/B/D 拉长反馈或引入脏依赖；C 是正确的定向增量构建做法。

### 9.（多选）关于 Profile 激活方式，正确的有（9分）

- A. 命令行 -P 显式激活
- B. <activation> 按属性（如 -Denv=prod）自动激活
- C. activeByDefault 设默认档案
- D. 只有手动 -P 一种方式

> 答案：A、B、C
> 解析：Profile 可按 JDK、属性、文件、activeByDefault 等多种条件激活，D 说法错误。

### 10. 为一个十余模块的 Maven 单体仓库设计 CI 构建流水线，要求反馈快、环境配置不乱、版本好统一。请给出方案。（40分）

> 参考答案：
- 要点1：定向增量构建——按本次变更模块用 reactor + -pl/-am（改公共库再用 -amd 带上下游），避免每次全量，配合 -T 并行压时长（10分）
- 要点2：依赖缓存——缓存 ~/.m2/repository，Release 长缓存、SNAPSHOT 短 TTL 或 -U 强制更新防脏；离线 -o 复用缓存（10分）
- 要点3：环境差异用 Profile 收敛到同一 POM，按 -Denv 等条件自动激活，杜绝多份 pom.xml 漂移；敏感值走 CI 变量注入（10分）
- 要点4：版本单点管理用 ${revision} + flatten-maven-plugin 展开，Release/SNAPSHOT 分仓策略与失败快速反馈（10分）
