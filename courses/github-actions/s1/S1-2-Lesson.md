# Action 复用、Marketplace 与密钥

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：能辨别三种 Action 形态（action@vN、composite、reusable workflow）并设计组织级复用层，会用 secrets/environment 做凭证治理，能为 Java 流水线配上可靠的缓存与制品链。

## 一、三种复用形态分层

```text
图目的：复用粒度从"一步"到"整条流水线"的三级火箭。
平台/第三方 Action（uses: actions/checkout@v4）：Marketplace 生态，Step 级复用（最快上手，风险=供应链）。
Composite Action（用 action.yml 把多个 step 打包成一步）：仓库/组织内自定义"超级步骤"，可带 inputs/outputs。
Reusable Workflow（on: workflow_call + uses: org/repo/.github/workflows/x.yml@v1）：Job 级整条复用，组织模板仓的载体。
说明：治理递进——step 复用管工具，workflow 复用管流程与门禁（结果：新仓库接入即继承安全基线）。
```

## 二、Composite Action 实例

```yaml
# .github/actions/maven-build/action.yml —— 本地 composite：封装"构建+缓存+报告"三件套
name: maven-build
inputs:
  module:  { description: 模块名, required: true }        # required 缺失直接 fail-fast（错误预期：靠默认值蒙）
  jdk:     { default: '17' }
runs:
  using: composite
  steps:
    - uses: actions/setup-java@v4
      with: { distribution: temurin, java-version: ${{ inputs.jdk }}, cache: maven }
    - run: mvn -B -pl ${{ inputs.module }} verify          # shell: bash 声明否则 Windows runner 语法翻车（反例）
      shell: bash
    - run: |
        echo "::notice::构建完成 ${{ inputs.module }}"       # ::notice::/::error:: workflow 命令输出可见标记
      shell: bash
# 使用方：- uses: ./.github/actions/maven-build   （本地路径引用不需要发版，改动即生效）
```

## 三、reusable workflow：组织级模板

```yaml
# 模板仓 java-ci.yml（可加 PR 审核、固定 Runner 池、统一 secrets 映射）
on:
  workflow_call:
    inputs: { module: { type: string, required: true } }    # 调用契约显式化（说明：类型错了 lint 期即报）
jobs:
  ci:
    runs-on: [self-hosted, java]
    steps: [ { uses: actions/checkout@v4 }, { run: mvn -B -pl ${{ inputs.module }} verify } ]
# 业务仓调用：jobs: { ci: { uses: myorg/ci-templates/.github/workflows/java-ci.yml@main, with: { module: order-api } } }
# 反例：uses 指向 @main 而不是版本 tag——模板仓一次坏提交引爆全部业务仓（异常：组织级雪崩，历史真实事故模式）
```

## 四、secrets 与 environment 治理

```yaml
steps:
  - name: deploy
    environment:
      name: production                 # 绑定环境：可配 required reviewers 审批 + 可见分支限制
    run: |
      curl -H "Auth: Bearer ${{ secrets.PROD_TOKEN }}" https://api.example.com/deploy
      # secrets 在日志自动打码，但"主动外传"（echo 进 curl body/写进产物）防不住——打码不是加密
    # 错误预期：fork PR 能读到 secrets —— 默认不能，但 pull_request_target+签出 PR 代码的写法会把门拆开（高危反例）
```

- 三级作用域：repo（私有）/org（共享）/environment（按部署目标分组+审批）；云侧优先 OIDC 短期凭证替代长期 token。

## 五、缓存与制品的 Actions 姿势

- 缓存：`actions/cache@v4` 以 `hashFiles('**/pom.xml')` 作 key、restore-keys 前缀回退（结果：依赖小改版也能部分命中）；setup-java/setup-node 已内置同款逻辑，优先用封装。
- 制品：upload-artifact（job 结束自动传）+ download-artifact（下游显式拉，`merge-multiple` 可控路径冲突）；大文件/长期保留走对象存储或 Release 资产（异常：artifacts 默认 90 天保留策略把审计报告挤爆磁盘，要配 retention-days）。

## 六、关联技术

- 触发器与 Runner 基础见 s1-1；与 GitLab include/模板机制的对照见 s1-3。
- 第三方 Action 钉 SHA、依赖扫描等供应链主题与 docker s2-3 镜像安全同构；发布审批语义衔接 kubernetes s3-2 的最小权限。
