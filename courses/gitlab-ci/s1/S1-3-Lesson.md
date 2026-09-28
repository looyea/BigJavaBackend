# 与 GitHub Actions 的取舍（关联）

> 本节难度：★★☆☆☆
> 本节重要性：★★☆☆☆
> 学习产出：能从自建/托管、生态、成本、合规四个维度对比 GitLab CI 与 GitHub Actions，为团队迁移或双平台共存给出选型结论。

## 一、模型对照：先建立同构映射

```text
图目的：两套 YAML 的概念互译，迁移时按表逐项换。
GitLab：stages/Job/script/Runner/Docker executor/cache/artifacts/environment
GitHub ：jobs/steps(run:)/Runner hosted-self/actions-cache/artifact(upload-download)/environment+secrets
说明：GitHub 用"工作流文件=多条触发方式"，靠 on: 事件驱动；GitLab 天然以分支/MR 流水线为一等公民（结果：MR 双跑治理思路两边不同）。
```

## 二、决定性的四个差异点

```yaml
# GitHub Actions：事件驱动的表达更细（错误预期：把 GitLab 的 rules 思维直接照搬进 on: 会写出冗余触发）
on:
  pull_request: { branches: [main] }     # MR 等价物
  push: { branches: [main] }             # 同一提交可能同时命中两事件→重复流水线，需用条件去重
  workflow_dispatch: {}                  # 手动触发（对应 when: manual 的整条粒度）
```

- 自建 vs 托管：GitLab 自托管 Runner 是常规操作（内网/合规友好）；Actions 托管 Runner 开箱即用但出网访问内网资源要自建 self-hosted runner 并解决出站链路。
- 生态：Actions Marketplace 的"Step 级复用"生态极繁荣（checkout/cache/setup-java 拿来即用）；GitLab 强在 CI/CD 与代码评审、容器仓、环境管理同平台一体化（Auto DevOps、安全扫描内置）。
- 成本：Actions 对开源免费额度慷慨、私有仓库按分钟计费（含并发限制）；自建 GitLab 是"机器与人力成本"，Runner 并发不设限。
- 合规/私有化：代码不出内网的硬要求下，自建 GitLab(+Runner) 通常比"GitHub Enterprise Server + self-hosted runner"组合更容易过审。

## 三、迁移注意清单

1. 缓存：Actions 用 actions/cache + key 哈希（或 setup-java 自带缓存），没有"目录快照策略"概念，路径写法不能直译。
2. 产物：upload-artifact/download-artifact 是显式两步，不随依赖自动传递（反例：照搬 artifacts 思维，下游忘 download 报文件不存在）。
3. 凭证：secrets 作用域到 environment，OIDC 云厂商短期凭证支持比自建侧更顺滑（说明： Actions 的成熟第三方集成多）。
4. needs/DAG：两边都有 needs；但 GitHub 的 matrix（一 Job 展开 N 组合）是 GitLab parallel:matrix 的对位功能，语法要重写。

## 四、选型速答

- 已在 GitLab 且重私有化合规：留在 GitLab CI，Runner 上 K8s，补安全扫描即可。
- 开源项目/已全栈 GitHub：Actions 起步成本低、生态白嫖多。
- 双平台共存：把 CI 语义收敛成共享脚本（Makefile/构建脚本），YAML 只做薄胶水（结果：迁移成本被脚本层吸收，这是架构上最稳的答案）。

## 五、关联技术

- GitLab 侧细则见 s1-1/s1-2；Actions 侧语法与复用见 github-actions s1-1/s1-2。
- 镜像构建的 dind/kaniko 权衡在两平台同构（docker s1-2）；发布门禁与凭证模型见 kubernetes s3-2。
