# 规则集与门禁策略

> 本节难度：★★☆☆☆
> 本节重要性：★★★☆☆
> 学习产出：理解 SonarQube 的规则集/质量配置/质量阈三层模型，能配置一条"新代码不能引入新问题"的 Quality Gate，把它接进 CI 做增量门禁，并避开"存量债一把清""全量红线卡死"两个落地反模式。

## 一、三层模型别混淆

SonarQube 治理靠三个概念层层生效：

| 概念 | 是什么 | 典型配置 |
|------|--------|---------|
| 规则集（Rule / Profile） | 检查哪些规则、什么语言 | 继承"Sonar way"，关掉团队公认噪音项 |
| 质量配置（Quality Profile） | 一个项目用哪套规则集 | 每语言一份，团队统一 |
| 质量阈（Quality Gate） | 达到什么指标算"通过" | 关键：**只卡新代码（Clean as You Code）** |

扫描 = 拉代码 → 按 Quality Profile 跑规则 → 算出 issues/覆盖/重复/漏洞 → 对照 Quality Gate 判 pass/fail。

## 二、Clean as You Code：最重要的理念

**不要拿全量红线卡整个仓库**——存量几十万问题永远修不完，门禁形同虚设。正确姿势是让指标只看**新增/变更代码**：

```groovy
// 目的：Quality Gate 只约束"这次改动引入的东西"，存量债单独立项还
// 条件示例（新代码维度）：
//   new_coverage < 80%            → 失败（新增代码测试覆盖太低）
//   new_violations > 0            → 失败（新增 Blocking/Critical 规则违反）
//   new_security_hotspots_reviewed < 100%  → 失败（新增安全热点没复核）
//   duplication < 3%（新代码）     → 失败
// 反例：把 coverage<80% 作用到全量 → 结果：老项目首扫即红，团队直接放弃 Sonar
```

存量债务用技术债雷达 / issue 看板单独跟踪、分模块限期清理，而不是压在每次 PR 门禁上。

## 三、接进 CI 做增量门禁

```yaml
# .gitlab-ci.yml：目的——MR 触发扫描，Quality Gate 不过则阻断合并
sonarqube-check:
  stage: test
  script:
    # 说明：mvn sonar:sonar 会读取 pom 里 sonar.host.url 与项目坐标
    - mvn verify                    # 结果：先跑测试并产出 jacoco 覆盖报告，Sonar 才能算 new_coverage
      sonar:sonar
      -Dsonar.projectKey=order-service
      -Dsonar.host.url=$SONAR_URL
      -Dsonar.token=$SONAR_TOKEN    # 反例：token 明文写进仓库 → 必须走 CI 变量/密钥管理
      -Dsonar.qualitygate.wait=true # 关键：阻塞等待 Quality Gate 结果，不达标让流水线失败
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"   # 目的：只在 MR 上卡门禁，省算力
```

`sonar.qualitygate.wait=true` 是把"代码质量"变成"合并闸门"的开关——不加它流水线不等结果，门禁就只是事后看板。

## 四、指标读法与常见误用

- **可靠性 Bug / 安全漏洞 Vulnerability / 安全热点 Hotspot**：Hotspot 不自动判违规（如"这里用了随机数当 token"），需人工复核——门禁常要求"新热点 100% 复核"；
- **覆盖率**：Sonar 的行覆盖来自 jacoco 报告，别在没跑测试的情况下扫描会得到 0；
- **重复率、认知复杂度**：适度用，别把 `函数圈复杂度 < X` 设成 Blocking 一刀切，逼出"把大函数偷偷拆成一堆无意义小函数"的应试代码；
- **可信度**：Sonar 是静态推断，有假阳性（规则误报）——允许标记 False Positive / Won't Fix，但要有 review 记录，不能滥标绕过门禁。

## 五、落地节奏建议

1. 先只开"新代码"门禁、指标宽松跑通链路，让团队习惯 PR 上被拦；
2. 逐步收紧 `new_coverage`、把 Security Hotspot 复核纳入；
3. 每语言统一 Quality Profile，改规则走评审（否则各项目漂移）；
4. 存量债：按模块建"清理冲刺"，用 baseline 期限制，而非全局红线；
5. 与 [JUnit/Mockito/Testcontainers](../../test-containers/s1/S1-1-Lesson.md) 联动：覆盖率数字要真，靠的是有意义的断言不是刷测试。

## 六、关联技术

覆盖率的真实性取决于测试质量，见 [JUnit 5 断言](../../junit/s1/S1-1-Lesson.md)；CI 触发与 MR 门禁机制在 [GitLab CI](../../gitlab-ci/s1/S1-1-Lesson.md)；静态扫描发现的坏味道常在 [Sonar 之外用 Arthas/火焰图](../../arthas/s1/S1-1-Lesson.md) 验证运行时真相——静态说"可能慢"不等于真慢。
