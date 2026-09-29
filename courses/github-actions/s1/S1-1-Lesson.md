# Workflow 语法、触发器与 Runner

> 本节难度：★★★☆☆
> 重要程度：★★★☆☆
> 学习产出：能写出结构正确的 workflow（jobs/steps/needs/matrix），用 on 的各触发器与条件控制执行时机，区分 hosted 与 self-hosted Runner 的选型边界，并处理"双跑、缓存、权限"三个高频实战问题。

## 一、骨架：一个 workflow 文件的最小完整形态

```yaml
name: ci                                   # 显示名；文件放 .github/workflows/*.yml 即被识别
on:
  pull_request: { branches: [main] }
  push: { branches: [main] }
concurrency:                               # 关键治理项：同 PR 新 push 取消旧跑（错误预期：不设→排队烧分钟数）
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest                 # Runner 标签：托管机型或自托管组名
    steps:
      - uses: actions/checkout@v4          # uses=复用 Action；run=直接执行 shell（两种 step 形态）
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: '17', cache: maven }   # with 传参；setup-java 自带依赖缓存
      - run: mvn -B verify                 # 任一步非 0 退出该 job 失败（默认 shell 为 bash）
      - run: echo "只在该步失败时才看" 
        if: failure()                      # step 级 if：failure()/success()/always() 是常用判定
  deploy:
    needs: build                           # jobs 默认并行，needs 建 DAG（无 stages 概念，全靠 needs）
    if: github.ref == 'refs/heads/main'    # job 级条件：push 事件才发布（与 on 联合去重双跑）
    runs-on: ubuntu-latest
    steps: [ { uses: actions/checkout@v4 } ]
```

- 层级记法：workflow（文件）→ jobs（并行/needs 依赖）→ steps（串行）→ run/uses；env 与 secrets 在 job/step 级可用 `${{ }}` 引用。

## 二、触发器家族

```text
图目的：on 可选的事件类型与典型用途。
push / pull_request：代码事件主力（注意 branches/tags/paths 过滤，paths 让文档改动不触发重建）。
workflow_dispatch：网页手动按钮（发布类流水线标配，对应 GitLab 的 when: manual）。
schedule: cron UTC：夜间全量测试（结果：托管 Runner 上 cron 偶有延迟，重要任务加 workflow_dispatch 兜底）。
workflow_call：被别的仓库当"可复用工作流"调用（组织级模板仓的底座）。
release / issues / repository_dispatch：事件驱动扩展（发布二进制、外部系统触发 CI 等）。
```

## 三、matrix：一次定义多组合

```yaml
strategy:
  matrix:
    java: [ 17, 21 ]
    os: [ ubuntu-latest ]
  fail-fast: false                 # 错误预期：默认 true——一个组合失败即杀其他还在跑的，排障期建议关掉
runs-on: ${{ matrix.os }}
# 展开 2 个并行 job；exclude/include 可裁剪组合；max-parallel 限并发防托管分钟数爆账
```

## 四、Runner：hosted 与 self-hosted

- hosted：微软维护的 VM/容器，秒级起、环境新、按分钟计费（Linux 最便宜，Windows/macOS 计价系数高）；访问内网资源不行。
- self-hosted：自己机器注册进 repo/org——内网私服、GPU、特殊合规环境的答案；代价是补丁、隔离、弹性都要自己管（反例：用公司开发机兼职 runner，凭证与代码同机混居）。
- 组与标签路由：`runs-on: [self-hosted, java, dmz]` 多标签精确派活；ephemeral 模式一次一毁防环境漂移（关联 s1-2 与 gitlab-ci s1-1 的同款概念）。

## 五、权限与治理默认值

- `permissions:` 收口内置 GITHUB_TOKEN 范围（示例：contents: read；不给写权——错误预期：默认宽权限被恶意 PR 脚本利用改仓库）。
- Actions 设置里限制"fork PR 可用哪些第三方 Action"（allowlist）；组织级用 reusable workflow 统一模板（结果：治理面从每个仓收敛到模板仓）。

## 六、关联技术

- Action 复用与 secrets 细则见 s1-2；与 GitLab CI 的对照取舍见 s1-3 与 gitlab-ci s1-3。
- 构建命令与缓存键设计承接 maven s1/s2；发布目标集群的准备见 kubernetes s3-2 RBAC。
