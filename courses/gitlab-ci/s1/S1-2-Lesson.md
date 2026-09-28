# 缓存、制品与 K8s 部署集成

> 本节难度：★★★☆☆
> 本节重要性：★★★☆☆
> 学习产出：分清 cache 与 artifacts 的生命周期与用途，能为 Maven/npm 配出可靠的缓存键，能在流水线里构建并推送 Docker 镜像，用 helm/kubectl 把应用发布到 K8s 并拿到回滚手段。

## 一、cache vs artifacts：一个是加速，一个是交接

```text
图目的：两种"存东西"的机制对比。
artifacts：Job 产出的"文件交付物"（jar/报告/镜像 tar），随流水线保留与下载，下游 Job 用 needs/依赖自动带入工作区（结果：发布用的 jar 走这条）。
cache：工作目录快照（.m2/repository、node_modules），跨流水线复用加速，键命中才恢复，内容随时可丢可重建（异常：把 artifacts 当 cache——下次没命中缓存直接"产物消失"）。
说明：两者可都落本地 MinIO/S3 对象存储，Runner 规模大时必须外置。
```

## 二、Maven 与前端缓存的正确姿势

```yaml
variables:
  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"   # 关键：把本地仓指进项目目录才能被 cache 抓到
  MAVEN_CLI_OPTS: "-B -q"

.cache-maven: &maven-cache
  cache:
    key: "$CI_COMMIT_REF_SLUG-maven-$CI_TEMPLATE_SHA"    # 按分支隔离（反例：全局一个 key，feature 分支的 SNAPSHOT 污染主干）
    paths: [.m2/repository]                             # 说明：只缓存依赖目录，不连 target 一起备份
    policy: pull-push
build:
  <<: *maven-cache
  script: [mvn $MAVEN_CLI_OPTS package]
snapshot-refresh:
  <<: *maven-cache
  cache: { key: "$CI_COMMIT_REF_SLUG-maven-$CI_TEMPLATE_SHA", policy: pull }   # 只读不写，防一次性 Job 回写脏缓存（错误用例防御）
  script: [mvn $MAVEN_CLI_OPTS -U verify]               # -U 强更 SNAPSHOT，配合缓存才语义清晰
```

- 缓存失效策略：key 里带入 pom 文件校验和（`$CI_TEMPLATE_SHA` 由前置 Job 计算或直接用 `cache:key:files: [pom.xml]`）——依赖不变即命中（结果：命中率从"玄学"变成可度量）。

## 三、构建并推送镜像

```yaml
build-image:
  stage: package
  image: docker:27
  services: [docker:27-dind]                   # dind：Job 容器里再跑一个 docker daemon（自建 Runner 需 privileged=true）
  variables: { DOCKER_TLS_CERTDIR: "/certs" }          # 目的：dind 的 TLS 证书目录，配合挂载才能通信
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY   # 用内置 GitLab 容器仓最省事
  script:
    - TAG=$CI_COMMIT_SHORT_SHA
    - docker build -t $CI_REGISTRY_IMAGE:$TAG .          # 以 short sha 作 tag：可追溯（反例：只打 latest，回滚无从谈起）
    - docker push $CI_REGISTRY_IMAGE:$TAG
  # 异常：privileged dind 有逃逸面，托管 SaaS 上优先用 kaniko/buildah 这类无 daemon 构建器
```

## 四、发布到 K8s：kubectl 直推与 helm 模板化

```yaml
deploy-staging:
  stage: deploy
  image: alpine/k8s:1.29.9                       # 自带 kubectl+helm 的工具镜像
  environment: { name: staging }
  variables:
    KUBE_CONFIG: "$STAGING_KUBECONFIG_B64"   # 值来自项目 CI 变量（base64 kubeconfig，务必 Protected+Masked，绝不写死在 YAML）
  before_script:
    - echo "$KUBE_CONFIG" | base64 -d > kubeconfig && export KUBECONFIG=kubeconfig
  script:
    - helm upgrade --install order .helm/order
        --namespace shop-staging --create-namespace
        --set image.tag=$CI_COMMIT_SHORT_SHA              # 只动 tag：发布参数化（说明：GitOps 更进阶——CI 只提 MR 改 values）
        --wait --timeout 5m                                # 不等就绪就"绿着发布中"是假阳性（错误预期）
    - kubectl rollout status deploy/order -n shop-staging  # 双保险确认
  # 回滚：helm rollback order -n shop-staging；或重跑上一条流水线用旧 sha tag
```

- 生产发布四件套：manual 触发 + 受保护变量 + `--wait`/rollout status 就绪门禁 + environment 记录（关联 kubernetes s1-2 滚动发布与 s3-2 RBAC）。

## 五、典型故障对照

1. 缓存命中却构建失败：cache key 覆盖了损坏的 .m2（异常：last_updated 策略下写一半被杀）→ 清 key 或 policy 拆分读写。
2. Job 间拿不到 jar：下游没声明依赖/needs，或 paths 用了绝对路径（结果：artifacts 解压目录以 paths 相对项目根为准）。
3. helm 发布成功 Pod 却没新镜像：tag 变量没传进 values、或 deployment 用了固定 imagePullPolicy 撞上同名旧镜像（说明：latest 复用是部署"没生效"的头号假象）。

## 六、关联技术

- 镜像构建的 Dockerfile 分层与缓存利用见 docker s1-2；仓库与 compose 视角见 docker s2-2。
- kubeconfig/SA 权限最小化见 kubernetes s3-2；探针就绪语义决定 `--wait` 何时才该判成功（kubernetes s1-3）。
