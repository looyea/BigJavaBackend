# 与 GitLab CI 的取舍（关联）

> 本节难度：★★☆☆☆
> 重要程度：★★☆☆☆
> 学习产出：能从触发模型、复用机制、Runner 形态、成本与合规五个维度对比 Actions 与 GitLab CI，给出迁移方向判断与双平台共存的架构答案。

## 一、同一件事的两种语法

```yaml
# 左侧 Actions / 右侧 GitLab 的镜像写法（说明：对照记忆比背两套语法高效）
on: { workflow_dispatch: { inputs: { ver: { type: string } } } }   # 手动+参数
#   ↔ deploy: { when: manual, ... }（GitLab 手动是 Job 级属性，整条粒度靠 rules 组合）
strategy: { matrix: { jdk: [17, 21] } }
#   ↔ parallel: { matrix: { defs: [ {JDK:17}, {JDK:21} ] } }（展开语义相同，变量引用一个 ${{ }} 一个 $ 美元）
needs: [build]                       # job 级 DAG；GitLab 的 needs 同名但默认还有 stages 屏障兜底
# 反例：把 GitLab 的 stages 质量门思维直译成 Actions——忘写 needs 时所有 job 并行，门禁形同虚设（异常：未测代码进了发布 job）
```

## 二、结构性差异（比语法更重要）

- 平台一体化：GitLab 把评审、CI、容器仓、制品仓、环境、安全扫描做成一个数据模型（MR 门禁直接读流水线状态）；Actions 靠 GitHub 生态拼装——Marketplace 广度第一，但"顺手程度"依赖第三方成熟度（结果：All-in-one vs 乐高两种哲学）。
- Runner 经济学：Actions 托管默认、自建为补充；GitLab 自建默认、SaaS 共享池为补充（说明：两边"自建"的安全义务同构——打补丁、隔离、凭证驻留）。
- 表达式系统：Actions 的 `${{ }}`+函数（hashFiles/fromJSON）更编程语言化；GitLab 的 rules/if 更 shell 变量直白——复杂逻辑 Actions 顺，简单门禁 GitLab 快。

## 三、迁移方向判断

```text
图目的：往哪边迁的决策线索。
迁向 Actions：主力仓已在 GitHub / 重 OSS 协作 / 想吃 Marketplace 与 OIDC 云集成红利。
留在 GitLab：私有化合规硬要求 / 重度使用内置容器仓与安全扫描 / MR 门禁与审批一体化价值高。
共存：CI 语义收敛到脚本层（make ci），两侧 YAML 只做触发/凭证/产物胶水（结果：平台成为可替换决策）。
```

## 四、高频互坑清单

1. 产物：GitLab 自动传递 ↔ Actions 显式 upload/download——迁移忘改，下游"文件不存在"（错误用例）。
2. 缓存：GitLab 在项目目录内才抓得到（MAVEN_OPTS 改路径）↔ Actions 可直接 ~/.m2——照搬路径写法缓存全空。
3. 双跑：GitLab workflow:rules 一次配好 ↔ Actions push+PR 天然重叠需事件分工。
4. 超时：两边都有 job 级时限（Actions 默认 6h/GitLab 默认 1h），长任务都要显式拆解而非顶格配置（异常：卡默认值的流水线莫名被杀）。

## 五、关联技术

- Actions 侧细节见 s1-1/s1-2；GitLab 侧见 gitlab-ci s1-1/s1-2，其 s1-3 为本节的镜像视角。
- 发布门禁与凭证治理在两侧同构（kubernetes s3-2 RBAC、secrets 作用域）；镜像构建方案（dind/kaniko）平台无关（docker s1-2）。
