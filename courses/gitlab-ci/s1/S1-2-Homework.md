# 缓存、制品与 K8s 部署集成 · 作业

## 作业 1：缓存命中率实测

**目标**：把"缓存像抽奖"变成可度量数据。

1. 给 Maven 项目配 MAVEN_OPTS + cache（key 含分支与 pom 校验和），连续跑三次流水线，记录每次 downloads 行数与耗时（输出：命中/未命中对照表）。
2. 故意改 pom 加一个依赖再跑，验证 key 变化触发重建（验收：新缓存生成、构建后恢复变快）。
3. 删除 MAVEN_OPTS 那行重跑一次，观察缓存"命中却仍全量下载"的现象并写原理解释（错误用例：缓存在项目目录外抓不到）。

## 作业 2：镜像构建流水线

**目标**：跑通 build → push → 可回滚的镜像链路。

1. 用 docker:dind（自建 Runner）或 kaniko 写 build-image Job，tag 取 CI_COMMIT_SHORT_SHA，推 GitLab 内置容器仓（说明：先本地 docker pull 验证凭证与路径）。
2. 制造一次推送失败（改错 CI_REGISTRY_IMAGE），记录报错并修复（输出：异常原文与修复对照）。
3. 给镜像加一层 Trivy 扫描 Job，高危漏洞 allow_failure:false（验收：一条流水线同时出镜像与安全报告）。

## 作业 3：helm 发布与就绪门禁

**目标**：让"流水线绿"等价于"服务真可用"。

1. 写 deploy-staging Job：kubeconfig 走 Protected+Masked 变量，helm upgrade --install --set image.tag=$SHA --wait（验收：values 里无硬编码 tag）。
2. 把 readiness 探针故意指错端口重发一次，观察 --wait 超时行为与 Job 失败的表现（异常场景体验：就绪门禁拦下了坏发布）。
3. 演练回滚：helm rollback 到上一 revision，再用旧 sha 重跑发布 Job，记录两种路径的差异与适用场合。
