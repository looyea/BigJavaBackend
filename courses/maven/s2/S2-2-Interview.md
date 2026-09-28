# 私服 Nexus、mirror 与 settings.xml · 面试题

## 题 1：为什么要私服？只讲三点最硬的。

① **出网收敛与加速**：central 代理缓存，全公司一个构件只下一次，构建速度与安全审计双赢；② **私有制品域**：内部库发布/消费有认证和权限（没有它内部代码 jar 无处安放）；③ **供应链治理**：可配"仅允许代理库+白名单"，阻断开发者随手引用来路不明依赖（结果：依赖合规有了执行点）。

## 题 2：deploy 401 的排查路径？

server id 与仓库/mirror id 是否一致（第一嫌疑人）→ 环境变量注入是否生效（CI secret 配置）→ 该账号对目标库是否有部署权限（Nexus ACL）→ 是否 401 变 400（不可覆盖，同版本重发）。顺带讲出"401 看认证、403 看权限、400 看库策略"的分诊口诀。

## 题 3：release 与 snapshot 库为什么要物理分开？

语义不同：release 不可变（覆盖=下游构建不可复现的核弹），需要严格拒绝重发；snapshot 天生是多版本时间戳流，需要保留策略与 latest 指针。混在一库导致清理策略两难、不可变性无法强制、消费方按 metadata 解析歧义。另加一条治理线：**生产制品禁止依赖 SNAPSHOT**——混库让这条红线没法在仓库层自动检查。

## 题 4：updatePolicy 有哪些值？各场景怎么配？

never/always/daily(默认)/interval:X。团队基线：CI 用 daily+发布任务显式 -U；联调开发机可 always（拉新积极）；**生产发布构建建议 never 或锁定**（不再查更新=版本表已钉死的自证，配合 release 库无 SNAPSHOT，达成完全可复现）。追问"为什么 release 还要 updatePolicy"：元数据（maven-metadata.xml）也有缓存时延，新发的 release 下游可能 daily 内不可见。

## 题 5：settings.xml 该进 Git 吗？

不该进**代码仓**（机器级环境配置、且含认证引用）。替代：仓内放 `settings-template.xml` + README；CI 用 `-s` 指向流水线生成的配置；口令只走环境变量/主密码方案（`mvn --master-password` 加密 server 密码）。加分点：项目级可复现性靠 pom 的仓库声明+私服治理，而不是"每台机器手配 settings"——配置进仓是团队环境失控的信号。
