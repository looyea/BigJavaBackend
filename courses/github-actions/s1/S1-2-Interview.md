# Action 复用、Marketplace 与密钥 · 面试题

## 题 1：Action 有哪几种形态？分别什么时候用？

- 使用方视角：`uses: 第三方/官方 Action`（Marketplace，step 级）、`uses: ./.github/actions/x`（本地 composite）、`uses: org/repo/.github/workflows/x.yml`（reusable workflow，job 级）。
- 实现方视角：composite（纯 YAML 打包 steps）、JS/Node Action（带逻辑跑在托管 Runner）、Docker Action（自带环境，多平台一致但冷启动慢）。
- 选型答法：工具类拿 Marketplace，团队标准动作抽 composite，流程门禁上 reusable workflow（结果：粒度与治理意图匹配）。

## 题 2：组织里 20 个仓库的 CI 怎么统一治理？

- 模板仓 + reusable workflow：流程、Runner 池、缓存策略、安全扫描集中定义；业务仓只传参数（inputs 契约显式化）。
- 版本纪律：引用钉 tag 不发 @main，模板升级走 PR+金丝雀仓（错误做法：全组织引用浮动分支——一次坏提交全员爆红）。
- 配套：org secrets 分层到 environment、Action allowlist、workflow lint（actionlint）进 pre-commit 与门禁（说明：治理是"复用+约束+自动化校验"三件套）。

## 题 3：secrets 的作用域与最佳实践？

- 三级：repo（仅本仓）、org（多仓共享，可配可见仓库清单）、environment（绑定部署目标，可加审批与分支限制）。
- 实践：能用 OIDC 短期凭证就不存长期 token；secrets 不进可 fork 执行的上下文（fork PR 默认读不到是平台保护，别用 pull_request_target 亲手拆门——经典高危反例）；生产 secrets 只注入生产 environment 的 job（结果：feature 分支流水线物理上拿不到生产凭证）。
- 加分：轮换策略与"泄漏即吊销+审计 API 调用"的应急预案。

## 题 4：日志里 secrets 显示成 ***，是不是就安全了？

- 打码只是日志展示层掩码，不是加密也不是防泄漏：`echo $TOKEN | tee out.txt` 上传制品即明文外带（异常演练：制品里翻出密钥是红队常用突破口）。
- 绕过形态还包括：写入 GitHub 变量/评论、发往外部 webhook、构建产物内嵌（错误预期：以为 masked 能防"主动作恶"）。
- 所以纵深是：最小注入（按 environment 作用域）、外传管控（制品内容扫描、出网白名单）、短期凭证（泄漏窗口小）、审计告警。

## 题 5：actions/cache 的 key/restore-keys 怎么设计？Maven 场景举例。

- key=不可变语义的指纹：`maven-${{ hashFiles('**/pom.xml') }}`；restore-keys 给前缀回退 `maven-`——pom 变了也能拿旧缓存增量补齐（结果：命中率从悬崖式变坡道式）。
- paths 要指真实缓存目录：托管 Runner 用 ~/.m2/repository 可行；setup-java 的 cache: maven 就是这套的封装（优先用封装，少造轮子）。
- 坑：只读 Job（如纯测试）设 cache 只 pull 不 push 防污染；SNAPSHOT 依赖不要进长缓存（异常：快照永远不更新，构建结果与依赖仓库脱节——加 -U 或按日期入 key）。

## 题 6：第三方 Action 的供应链风险与防护？

- 风险：tag 可被重指向（v1 今天≠昨天）、维护者账号被盗发恶意版、冷门 Action 无人审计（历史投毒事件真实存在，异常影响面=所有引用仓的 secrets）。
- 防护：钉 commit SHA + Dependabot/renovate 管理升级评审；org 级 allowlist 限制可用 Action（fork PR 场景尤其）；高权限步骤（带 secrets 的发布）优先自研 composite/脚本，把第三方圈禁在低权限区。
- 加分：模板仓集中引用点——升级一处生效 20 仓，审计面同步收敛（说明：复用层同时也是安全层）。
