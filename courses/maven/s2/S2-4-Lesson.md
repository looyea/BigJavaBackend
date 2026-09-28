# 多模块构建、Profile 与 CI 集成

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：能把一个多模块 Maven 工程在 CI 里"又快又稳"地构建出来。核心概念：**reactor（反应堆）**按依赖拓扑排序聚合模块的构建顺序，`mvn -pl <模块> -am`（--also-make）只构建指定模块及其**上游依赖**、`-amd`（--also-make-dependents）连带下游，实现**增量/定向构建**，避免每次全量。用 **Profile** 按环境（dev/test/prod）注入不同属性、仓库、插件配置，激活方式有 `-P`、`activeByDefault`、按属性/JDK/文件自动触发——但配置尽量留在 POM、把环境差异交给 CI 变量而非散落多份 POM。版本管理用 **`${revision}` 占位 + flatten-maven-plugin** 做全工程版本统一、单点修改。CI 集成的关键工程实践：**本地仓库缓存**（`~/.m2` 用 actions/cache 等缓存）避免每次重下依赖、**并行构建** `-T`、**按变更模块裁剪**构建范围、SNAPSHOT vs Release 仓库策略、失败快速反馈。识破"CI 每次全量构建拖慢反馈""Profile 靠手工 -P 易漏""`${revision}` 未 flatten 导致下游拿到字面量版本""缓存了 SNAPSHOT 造成脏依赖"等坑。

## 一、reactor 与定向构建

```text
图目的：聚合构建不等于每次全量——用 reactor 顺序 + 裁剪提速
reactor: Maven 读 <modules> 按依赖拓扑排序, 保证被依赖模块先构建
-pl (projects list):   只构建指定模块
-am (also-make):       连带构建它依赖的上游模块
-amd (also-make-dependents): 连带下游, 改动公共库时用
-T 1C:                 按 CPU 核数并行, 进一步压缩时长
```

## 二、Profile：环境差异集中且可自动激活

```xml
<!-- 目的：把环境差异(属性/仓库/插件)收敛到 Profile, 由构建条件选择 -->
<profiles>                                             <!-- 说明：声明多个构建档案 -->
  <profile>                                            <!-- 说明：prod 档案主体 -->
    <id>prod</id>                                      <!-- 结果：-Pprod 时的匹配标识 -->
    <properties>                                       <!-- 说明：环境专属属性, 供资源过滤 -->
      <db.url>jdbc:...prod</db.url>                    <!-- 结果：prod 库地址, 与 dev/test 隔离 -->
    </properties>
    <activation>                                       <!-- 说明：自动激活, 免手工 -P 遗漏 -->
      <property><name>env</name><value>prod</value></property> <!-- 说明：CI 传 -Denv=prod 即命中 -->
    </activation>
  </profile>
</profiles>
<!-- 反例：为每个环境复制一份完整 pom.xml ❌ 差异各自漂移、改一处忘三处 -->
```

## 三、版本统一与 CI 缓存

```text
图目的：多模块版本单点管理 + CI 构建提速两件套
${revision}: 所有模块 parent version 用占位符, 只在根改一处
flatten-maven-plugin: install/deploy 前把 ${revision} 展开成真实版本, 否则下游解析拿到字面量而失败
CI 提速: 缓存 ~/.m2/repository(release 可长缓存, SNAPSHOT 慎用易脏) + -o 离线 + 按变更模块裁剪构建范围
```

## 四、坑与底线

- **别让 CI 每次从零全量**：无缓存 + 全模块构建会把反馈周期拉到十几分钟，违背持续集成本意。
- **`${revision}` 必须配 flatten**：跳过 flatten 直接 install，本地/私服里的 POM 仍是占位符，下游模块解析版本报错。

## 五、关联课程

聚合与继承的 POM 结构见 [继承、聚合与多模块、BOM](../s1/S1-2-Lesson.md)；生命周期与插件绑定（含 flatten 绑定阶段）见 [生命周期、插件与打包](./S2-1-Lesson.md)；SNAPSHOT/Release 与私服仓库策略见 [私服 Nexus、mirror 与 settings.xml](./S2-2-Lesson.md)。
