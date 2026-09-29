# 私服 Nexus、mirror 与 settings.xml

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：会配 settings.xml 的镜像/认证/profile，理解 Nexus 代理-宿主-分组三库模型与 release/snapshot 分流，能定私服故障的应急降级预案。

## 一、settings.xml：机器级配置的家

```xml
<!-- 目的：~/.m2/settings.xml（用户级）覆盖 $MAVEN_HOME/conf/settings.xml（全局级） -->
<settings>
  <localRepository>/data/m2repo</localRepository>   <!-- 说明：CI 缓存盘固定路径，容器重建不丢缓存 -->
  <mirrors>
    <mirror>
      <id>nexus</id>
      <mirrorOf>*</mirrorOf>                        <!-- 结果：所有仓库请求统一改道私服（central 也不直连）-->
      <url>http://nexus.shop.com/repository/maven-public/</url>
    </mirror>
    <!-- 错误用法：mirrorOf 写 central 而团队依赖声明了自定义 repo → 自定义库不走镜像出公网被墙 -->
  </mirrors>
  <servers>
    <server>
      <id>nexus</id>                                <!-- 说明：id 必须与 mirror/repository 的 id 一致才挂上认证 -->
      <username>${env.NEXUS_USER}</username>        <!-- 结果：口令进环境变量，禁止明文进 Git -->
      <password>${env.NEXUS_PASS}</password>
    </server>
  </servers>
</settings>
```

## 二、Nexus 三库模型：proxy / hosted / group

```text
图目的：一次依赖下载在私服内部的流向。
maven-public(group) ← 团队唯一对外 URL（聚合视图）
  ├─ maven-central(proxy)：代理公网 central，首次下载后缓存（结果：出网一次，全公司复用）
  ├─ maven-releases(hosted)：deploy 的正式版，不可覆盖（redeploy 同版本 400 拒绝）
  └─ maven-snapshots(hosted)：按时间戳保留多份（说明：策略配"保留最近 N 个"防盘爆）
group 的仓库顺序决定同名构件优先来源 —— 把自建 proxy 放前可覆写社区旧包（内源化的机制）。
```

## 三、deploy 去向：distributionManagement

```xml
<!-- 目的：POM 声明发布地址，server 的 id 在此复用做认证 -->
<distributionManagement>
  <repository>
    <id>nexus</id>                                  <!-- 必须与 settings.xml server id 对应，否则 401 -->
    <url>http://nexus.shop.com/repository/maven-releases/</url>
  </repository>
  <snapshotRepository>
    <id>nexus</id>
    <url>http://nexus.shop.com/repository/maven-snapshots/</url>  <!-- 结果：-SNAPSHOT 版本自动走这条 -->
  </snapshotRepository>
</distributionManagement>
<!-- 错误用法：把 -SNAPSHOT deploy 进 releases 库（url 写错）→ 版本号带时间戳的怪产物 → 下游解析失败 -->
```

## 四、缓存与更新策略

```bash
mvn -U clean verify          # 目的：强制检查 SNAPSHOT 与元数据更新（上游发了新版立刻拉到）
mvn dependency:purge-local-repository -DreResolve=false   # 说明：本地缓存坏了先清再重解
# 结果对照：默认 updatePolicy=daily —— SNAPSHOT 一天只查一次，联调"他发了我没拉到"多半栽在这
# 错误用法：仓库目录整层 rm -rf 了事 —— 误删别的在构建任务，用 purge 或按 GAV 目录精准清理
```

## 五、私服故障应急：没有私服也能构建

```xml
<!-- 目的：profile 一键切回直连（settings.xml 的应急开关，配进运维手册） -->
<profiles>
  <profile>
    <id>direct-central</id>
    <activation><activeByDefault>false</activeByDefault></activation>
    <repositories><repository><id>central-direct</id>
      <url>https://repo1.maven.org/maven2</url>     <!-- 说明：mirrorOf 临时改 !central-direct 或删镜像 -->
      <releases><enabled>true</enabled></releases>  <!-- 结果：临时可构建，事后必回正规道 -->
    </repository></repositories>
  </profile>
</profiles>
<!-- 反例：把应急直连永久化 → 私有构件拉不到 + 合规审计红线（内网出公网下私有包是事故源）-->
```

## 六、关联技术

- 制品晋级（snapshot→release 由 CI 用 `-Drevision` 触发）配合 Git tag 才是完整发版链。
- Gradle 侧对应 `repositories { maven { url ... credentials } }`，同一 Nexus 复用；见 gradle s1-2。
- 下一小节：Maven vs Gradle 选型与迁移。
