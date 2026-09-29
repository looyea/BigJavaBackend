# 继承、聚合与多模块、BOM

> 本节难度：★★★☆☆
> 重要程度：★★★★★
> 学习产出：能用 parent/modules 搭建多模块工程，分清 dependencyManagement 的继承与 import 语义，掌握 ${revision}+flatten 的版本单一事实源方案。

## 一、继承与聚合：两个正交机制

```text
图目的：一图分清两个易混机制。
继承（parent）：子 POM 拿到父 POM 的 dependencyManagement/pluginManagement/properties —— 是"配置的血缘"；
聚合（modules）：父工程构建时按依赖顺序带着子模块一起跑 —— 是"构建的清单"。
常见形态两者叠加（父 POM 既当 parent 又聚合），但本质独立：可以聚合而不继承。
结果：回答"为什么改了父 POM 子模块没感觉"——多数因为只聚合没继承，或子模块自己覆盖了配置。
```

```xml
<!-- 目的：聚合根 POM，packaging=pom 是硬要求 -->
<project>
    <groupId>com.shop</groupId>
    <artifactId>shop-parent</artifactId>
    <version>${revision}</version>          <!-- 说明：统一版本占位符，见第四节 flatten -->
    <packaging>pom</packaging>              <!-- 错误用法：根 POM 用 jar 且带 src → 版本管理职责与代码混在一起 -->
    <modules>
        <module>shop-common</module>        <!-- 结果：mvn 在根执行即按图构建全部子模块 -->
        <module>shop-order</module>
        <module>shop-web</module>
    </modules>
    <properties><revision>1.0.0</revision></properties>
</project>
```

## 二、模块间依赖与反应堆构建

```bash
mvn -pl shop-order -am test          # 目的：只测 order 及其依赖的模块（common），不陪跑全仓
mvn install -T 1C                    # 说明：按 CPU 核数并行，反应堆自动按依赖拓扑排序
# 错误用法：模块循环依赖 → 反应堆构建直接失败（Maven 不允许，需抽公共层解环——架构信号要重视）
```

- 模块依赖写 `dependency` 且版本用 `${revision}`/`${project.version}`（结果：reactor 内解析到本地模块而非仓库旧版）。
- 分层惯例：common(无依赖) → domain → infra → service → web；**上层可依赖下层，禁止反向**。

## 三、dependencyManagement 的两种用法别混

```xml
<!-- 目的（用法1）：本仓版本表（可被继承）——子模块声明依赖时免写 version -->
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.shop</groupId><artifactId>shop-common</artifactId>
      <version>${revision}</version>          <!-- 输出：内部模块版本也统一治理 -->
    </dependency>
  </dependencies>
</dependencyManagement>
<!-- 说明（用法2）：import 外部 BOM，多 BOM 并存时先 import 者优先，把公司 BOM 放最前 -->
<!-- 错误用法：把 import 的 BOM 当"依赖"期待它自动引包 → import 只导版本表，classes 一个不来 -->
```

- pluginManagement 同理管插件版本：不写则各模块用默认版本，CI 与本地 Maven 版本不同时构建漂移（典型"我这也行啊"事故源）。

## 四、版本单一事实源：${revision} + flatten

```xml
<!-- 目的：全仓一个版本号，发布只改一处 -->
<plugin>
    <groupId>org.codehaus.mojo</groupId>
    <artifactId>flatten-maven-plugin</artifactId>   <!-- 说明：install/deploy 前把 ${revision} 展开成真实版本 -->
    <version>1.6.0</version>                              <!-- 结果：发布产物中对下游可用的真实版本 -->
    <configuration><flattenMode>resolveCiFriendliesOnly</flattenMode></configuration>
</plugin>
<!-- 错误用法：不加 flatten 直接 deploy → 仓库里的 POM 带着字面 ${revision} → 下游解析失败（CI 友好的经典坑） -->
```

## 五、parent 与 BOM 的选型边界

| 需求 | 方案 |
|------|------|
| 单仓统一构建+配置 | parent + modules |
| 跨仓共享版本表 | BOM（可多份并存） |
| 只要聚合不要血缘 | 根 POM 只写 modules |
| 多仓同插件配置 | pluginManagement 进 parent 或专用"构建模板仓" |

## 六、关联技术

- 下一小节：生命周期与插件绑定；私服发布（release/snapshot 两库分流）在 s2-2。
- 与 Gradle 对照：多项目用 settings.gradle include，无"继承"概念靠约定与插件——见 gradle s1-4。
