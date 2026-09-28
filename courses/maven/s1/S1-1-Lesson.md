# POM 坐标、依赖范围与冲突调解

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：熟练运用 GAV 坐标与 scope 语义，掌握最近优先/最短路径调解规则，能用 dependency:tree 定位并根治依赖冲突。

## 一、GAV 坐标与仓库布局

```xml
<!-- 目的：一个依赖的唯一坐标是 groupId:artifactId:version（GAV），GAV 定位本地仓库路径 -->
<dependency>
    <groupId>com.zaxxer</groupId>            <!-- 说明：组织名，决定仓库目录第一层 -->
    <artifactId>HikariCP</artifactId>        <!-- 结果：~/.m2/repository/com/zaxxer/HikariCP/4.0.3/HikariCP-4.0.3.jar -->
    <version>4.0.3</version>                 <!-- 输出：版本缺失且父 POM 未管理时构建直接报错 -->
    <scope>compile</scope>                   <!-- 缺省值；显式写出利于评审 -->
</dependency>
<!-- 错误用法：同一 GAV 在不同模块声明不同版本且无 dependencyManagement → 调解结果取决于引入顺序，构建不可复现 -->
```

- 仓库三层次：本地 `~/.m2` → 镜像/私服 → central；解析顺序即此序（说明：缓存命中就不出网）。
- `-SNAPSHOT` 版本每次构建检查远端更新时间戳（结果：SNAPSHOT 不可用于发布产物，随时可能变）。

## 二、scope 决定"编译/运行/测试"三个 classpath

| scope | 编译可见 | 运行时可见 | 传递性 | 典型 |
|-------|---------|-----------|--------|------|
| compile | ✓ | ✓ | ✓ | spring-core |
| provided | ✓ | ✗ | ✗ | servlet-api（容器给了） |
| runtime | ✗ | ✓ | ✓ | mysql-connector-j |
| test | ✗(主源码) | ✗ | ✗ | junit |
| system | ✓ | ✓ | ✗ | 本地路径 jar（已废弃，禁用） |

```xml
<!-- 目的：JDBC 驱动只需运行期加载（代码面向 java.sql 接口编程） -->
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <version>8.3.0</version>
    <scope>runtime</scope>          <!-- 结果：编译期不可见防止代码直接 new 驱动类，解耦生效 -->
</dependency>
<!-- 错误用法：容器类库（servlet-api）用 compile 打进 war → 与 Tomcat 自带类冲突 → LinkageError -->
```

## 三、冲突调解：最短路径优先，同深度先声明优先

```text
图目的：一次典型冲突的调解树。
A(项目) → B(深度1) → C → slf4j 1.7
A(项目) → D(深度1) → slf4j 2.0        # 两条路径深度相同，先声明的 D 路线胜出（顺序敏感！）
规则：1) 最短路径优先（depth 小者胜）；2) 同深度"声明顺序"先者胜 —— 所以 pom 里依赖顺序会影响构建结果（反直觉但有规可查）。
结果：调解是"选一个版本"，不是共存；落选版本的类从 classpath 消失 → NoSuchMethodError 的根源。
治理：mvn dependency:tree -Dverbose 看被 omitted 的版本，dependencyManagement 钉死版本让结果可复现。
```

## 四、dependencyManagement 与 BOM import

```xml
<!-- 目的：父 POM 统一定版本，子模块声明依赖不写 version -->
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>  <!-- 说明：官方 BOM，管理上千个坐标 -->
            <version>3.3.0</version>
            <type>pom</type>
            <scope>import</scope>                              <!-- 结果：只导版本表，不引入任何依赖 -->
        </dependency>
    </dependencies>
</dependencyManagement>
<!-- 错误用法：import 的 BOM 放最后，前面已手工声明同组版本 → 就近原则使 BOM 失效，版本漂移无人发现 -->
```

## 五、exclusion 的正确姿势

```xml
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>druid-spring-boot-starter</artifactId>
    <version>1.2.20</version>
    <exclusions>
        <exclusion>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-log4j12</artifactId>   <!-- 目的：踢掉 log4j 绑定，保住 logback 唯一绑定 -->
        </exclusion>                                 <!-- 结果：SLF4J 多绑定警告消失，日志格式统一 -->
    </exclusions>
</dependency>
<!-- 错误用法：只 exclusion 不打补丁 → 若踢的是"真需要的类" → NoClassDefFoundError；踢完要跑集成测试验证 -->
```

## 六、关联技术

- 下一小节：继承/聚合与多模块工程结构；私服与 settings.xml 在 s2-2。
- `mvn versions:display-dependency-updates` 升级巡检；`maven-enforcer-plugin` 的 dependencyConvergence 规则可在 CI 强制收敛。
