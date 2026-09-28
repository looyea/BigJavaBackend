# 流水线模型：Stage/Job/Script 与 Runner

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：能用 .gitlab-ci.yml 表达 Stage/Job 分层与 needs DAG 依赖，会用 rules 控制自动/手动执行，理解 Runner 与 executor（shell/docker）的选型差异，能看懂一次流水线从入队到执行的完整链路。

## 一、骨架：Stage 定序，Job 是执行单元

```yaml
stages: [build, test, package, deploy]        # 自定义阶段名，Stage 之间严格串行

build-api:                                     # Job 名：同 Stage 内并行，各自独立容器
  stage: build
  image: maven:3.9-eclipse-temurin-17
  script:
    - mvn -B -pl order-api -am package -DskipTests   # script 是数组=依次执行的 shell，任一条非 0 即 Job 失败
  artifacts:
    paths: [order-api/target/*.jar]            # 传给下游 test/deploy 的产物（下一节对比 cache）

test-unit:
  stage: test
  needs: [build-api]                           # needs 让本 Job 不必等整个 build 阶段，拿到依赖即开跑
  script: [mvn -B test]
# 错误预期①：以为 Job 失败会立刻停掉整个流水线 —— 默认 allow_failure:false 只标记流水线失败，
#            已在跑的并行 Job 照样跑完（异常：浪费的构建资源与"红得很慢"的观感）
# 错误预期②：Stage 名写了个 YAML 里没声明的 —— invalid {job}: (build) stage unknown 直接解析失败
```

- `variables`（全局/Job 级）、`before_script/after_script`（模板拼接）、`include`（拆文件与复用模板）是控制复杂度的三板斧。

## 二、rules：什么时候建这个 Job、怎么触发

```yaml
deploy-prod:
  stage: deploy
  rules:
    - if: '$CI_PIPELINE_SOURCE == "schedule"'      # 定时流水线跳过发布
      when: never
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
      when: manual                                  # 自动建 Job 但需人点击，配 environment 出按钮
    - when: never                                   # 兜底：其他分支不创建该 Job
  environment: { name: production, url: https://shop.example.com }
# 说明：rules 决定"存在性与触发方式"（构建流水线时），when:manual 决定"执行时机"（人驱动）；
# 反例：只有 when:manual 没有 rules，MR 流水线里也会创建一堆永远没人点的灰按钮（噪音）
```

- `interruptible: true`：同分支新 push 自动取消旧流水线（结果：省 runner 配额）；interruption 组防误杀 release 分支。

## 三、Runner：执行器与 executor 选型

```text
图目的：一次 Job 从入队到落地的链路。
GitLab 创建 Job → 按 tag/未标签 匹配 Runner 拉取 → Runner 的 executor 起执行环境 → script 逐条跑 → 回收 artifacts/cache 上报状态
Shell executor：Runner 直接装在机器上跑命令（能碰宿主机 docker/systemctl；隔离差、环境漂移，反例：同事手装 jdk8 后全组 CI 行为不一致）
Docker executor：每个 Job 起一次性容器，image 即环境（主流：干净、可复现；跑 docker build 需 privileged 或挂 docker.sock）
```

- Runner 注册用 token + tags 路由：共享 Runner 给 tag `java-shared`，敏感构建用项目专属 Runner（自建 VM/K8s executor 上 Runner 本身跑在 K8s Pod 是大规模方案）。

## 四、Java 项目最小可用流水线

```yaml
default:                                       # 收口镜像与重试，别每个 Job 重复写
  image: maven:3.9-eclipse-temurin-17
  retry: { max: 1, when: runner_system_failure }

build:
  stage: build
  script: [mvn -B verify -DskipTests]
  artifacts: { paths: [target/], expire_in: 1 week }   # expire_in 防存储爆炸（错误预期：全量永久保留）
```

- Job 超时与流水线并发上限在 CI/CD 设置里；大仓建议 `only: changes`/`rules:changes` 让无关目录的提交不触发重构建。

## 五、排障速查

1. 流水线 pending：无匹配 tag 的在线 Runner / Runner 满了（`gitlab-runner list` 与管理页看并发数）。
2. Job 红但本地绿：image 版本漂移、maven 未缓存导致 settings.xml 缺失、`needs` 拼错导致没拿到 artifacts（异常：Could not find artifact——先查上游是否真产出该路径）。
3. manual 按钮灰掉点不动：rules 不满足时 Job 根本未创建，不是权限问题（结果：先看 Job 列表有没有它）。

## 六、关联技术

- cache/artifacts 细则与 K8s 部署集成见本节 s1-2；与 GitHub Actions 的模型对照取舍见 s1-3。
- 构建命令本身（-pl -am、settings、仓库）属于 maven s1/s2 知识；镜像构建的 Dockerfile 与 dind 见 docker s1-2。
