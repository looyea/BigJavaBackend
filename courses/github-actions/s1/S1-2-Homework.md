# Action 复用、Marketplace 与密钥 · 作业

## 作业 1：抽一个 Composite Action

**目标**：把重复的"setup-java+mvn verify+传报告"三件套封装成一步。

1. 在测试仓建 .github/actions/maven-build/action.yml（inputs: module/jdk，steps 含 shell: bash），两条 workflow 改用 `uses: ./.github/actions/maven-build`（验收：YAML 行数下降且行为一致）。
2. 故意漏掉 module 参数调用一次，记录 fail-fast 报错；再删 shell: bash 观察 actionlint/运行期报错原文（输出：两类错误用例与修复）。
3. 给 composite 加 outputs（jar 路径），下游 step 引用验证传递有效（说明：outputs 是 step 级 id+环境变量机制）。

## 作业 2：组织模板仓演练

**目标**：体验 reusable workflow 的契约与版本治理。

1. 建 ci-templates 仓写 java-ci.yml（workflow_call，inputs: module；runs-on 用自有标签），业务仓用 `uses: owner/ci-templates/.github/workflows/java-ci.yml@v1` 调用（验收：跨仓复用跑通）。
2. 模板仓引入一个坏改动，对比 @main 引用（全仓即刻爆红）与 @v1 引用（不受影响）两种策略的爆炸半径（结果：一次演练截图说明为何钉版本）。
3. 给模板调用传 secrets: inherit 与显式映射各一次，说明差异与适用场景。

## 作业 3：secrets 安全审计

**目标**：给现有 workflow 做一次凭证体检。

1. 盘点仓内全部 secrets/org secrets/environment 归属，画出"谁在哪个 job 能读到什么"矩阵（输出：审计表）。
2. 演练一次"日志打码被绕过"：把假 token 写进制品再下载，确认内容可见，据此写外传管控规则（错误用例实证：打码≠防泄漏）。
3. 把一个云 AK/SK 场景改为 OIDC 短期凭证配置（给出角色信任策略要点），对比轮换成本与泄漏面（验收：长期密钥清零计划）。
