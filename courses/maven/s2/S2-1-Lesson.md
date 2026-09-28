# 生命周期、插件与打包

> 本节难度：★★★☆☆
> 本节重要性：★★★★☆
> 学习产出：记住三生命周期与阶段顺序，能解释插件 goal 绑定机制与 packaging 默认绑定，正确产出 fat-jar/分层 jar 并避开 shade 冲突坑。

## 一、三生命周期与阶段链

```text
图目的：clean / default / site 三条独立生命周期，default 的阶段顺序必须默写。
clean:   pre-clean → clean → post-clean
default: validate → compile → test → package → verify → install → deploy
site:    pre-site → site → post-site → site-deploy
规则：执行某阶段 = 顺序执行它之前的全部阶段（mvn test 必然先 compile）；
     阶段与插件 goal 的绑定由 packaging 默认 + 显式 <executions> 叠加。
结果："mvn install 突然变慢"多半是有人在 initialize 绑了重任务——plugin 的 execution phase 要审。
```

## 二、插件 goal 绑定：一个覆盖率例子

```xml
<!-- 目的：verify 阶段自动跑 jacoco 检查，测试覆盖率不达标构建失败 -->
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.12</version>                               <!-- 说明：插件版本也要钉死，防本地/CI 默认版本漂移 -->
    <executions>
        <execution>
            <goals><goal>prepare-agent</goal></goals>     <!-- 绑定 initialize：注入探针 JVM 参数 -->
        </execution>
        <execution>
            <id>check</id>                                  <!-- 目的：给 execution 命名，便于子模块覆盖或禁用 -->
            <phase>verify</phase>                          <!-- 说明：显式绑到 verify（gate 在 install 前）-->
            <goals><goal>check</goal></goals>              <!-- 结果：mvn install 前必过覆盖率闸门 -->
        </execution>
    </executions>
</plugin>
<!-- 错误用法：skipTests 与 maven.test.skip 混不清——前者编译测试不运行，后者连编译都跳（CI 语义完全不同）-->
```

- packaging 默认绑定：jar→maven-jar-plugin@package；war→maven-war-plugin@package；pom→install 仅装 POM（说明：这就是聚合根不产 jar 的机制）。

## 三、可执行 jar 的三条路

```xml
<!-- 目的：Spring Boot 应用重打包（依赖进 BOOT-INF/lib，Main-Class 换成启动器） -->
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <executions><execution><goals><goal>repackage</goal></goals></execution></executions>   <!-- 结果：产出 java -jar 可直接运行的可执行 jar -->
    <configuration>
        <layers><enabled>true</enabled></layers>          <!-- 结果：按 CHANGE/依赖分层，配合镜像分层缓存 -->
    </configuration>
</plugin>
<!-- 示例：路2 shade 做 Uber jar + relocation（多库同名类冲突时用，见下）；路3 assembly 单 lib 目录粗放式 -->
<!-- 错误用法：spring-boot 项目用 shade 重打包 → 嵌套资源与自动配置合并错乱 → 运行时类加载诡异失败 -->
```

## 四、shade 的依赖冲突解药：relocation

```xml
<!-- 目的：把内置的 guava 改名，避免与宿主环境的 guava 版本互杀（SDK/插件场景标配） -->
<relocation>
    <pattern>com.google.common</pattern>
    <shadedPattern>shaded.shop.guava</shadedPattern>      <!-- 结果：字节码引用同步重写，两边版本共存 -->
</relocation>
<!-- 错误用法：对外业务应用滥用 relocation → 同一库两份实例 → 单例/连接池翻倍，类相等判断全失效 -->
```

## 五、常见绑定问题速查

| 症状 | 根因 | 处置 |
|------|------|------|
| mvn package 不跑我的检查 | goal 没绑到 package 前阶段 | executions 显式 phase |
| CI 比本地快很多 | 测试被 -Dmaven.test.skip 连编译都跳 | 分清两种 skip 语义 |
| fat-jar 启动 ClassNotFound | 依赖 scope=provided 或 shade 排除过 | tree + unzip -l 对账 |
| 两插件同阶段抢跑 | 同 phase 按声明顺序执行 | 调整顺序或改绑相邻阶段 |

## 六、关联技术

- 私服与 settings.xml（deploy 去向）在 s2-2；与 Gradle 任务图的机制对比在 s2-3。
- Maven 4 的 lifecycle 增强（可定义自定义生命周期）关注但不赌生产版本。
