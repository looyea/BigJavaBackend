# 镜像安全与最佳实践 · 面试题

## 题 1：容器安全你做过哪些加固？（开放题，答出体系）

分四层答，每层给一个证据：

1. 镜像层：非 root USER、多阶段去编译器、基镜像锁版本、无密钥进层（验收：`id` UID≠0、镜像无 javac）。
2. 运行层：--read-only + tmpfs、--cap-drop=ALL 白名单、no-new-privileges、pids-limit（结果：篡改不落盘、提权失效）。
3. 供应链层：trivy 门禁 + cosign 签名 + 按 digest 部署（输出：高危不过不发）。
4. 编排/内核层：K8s SecurityPodContext + PSA、必要时 gVisor/Kata 强隔离（说明：越不可信越往上一层隔离）。

## 题 2：为什么"容器里 root"和"宿主机 root"风险不同但都不能放任？

- 不同：容器 root 被 Namespace/CGroup 围住，日常看不到宿主全部进程与文件（隔离确实存在）。
- 但不能放任：共享内核 + 容器 root 拥有大量 capability，一旦有内核漏洞或危险挂载（/、docker.sock），root 直接变宿主 root（异常：逃逸事故链）。
- 结论：非 root 让"逃逸需要额外一个漏洞"，把单点 RCE 降级为难以落地（纵深防御思想）。

## 题 3：怎么把密钥安全地交给容器里的应用？

```bash
# 错误：COPY secrets / ENV PASSWORD —— 进镜像层/元数据，删不掉还随 pull 扩散（CoW 历史层留存）
# 正确路径按强度递增：
# 1) 运行期注入：docker -e / --env-file（不进镜像，但仍会出现在 inspect/ps，弱保护）
# 2) tmpfs 挂载秘密文件：只在内存、重启即清（呼应 s2-2）
# 3) 外部密钥服务 + 动态拉取（Vault/KMS）+ 短时效 token —— 金融首选，可审计可轮换
```

- 加分：无论哪种，都要配套日志脱敏与最小读取权限（异常场景：应用 stdout 打了 env 等于白做）。

## 题 4：trivy 扫出一堆 HIGH，业务急着发版，你怎么办？

1. 先看可达性：该 CVE 组件在本服务是否真被使用/暴露（很多是传递依赖里的冷路径，风险实际低）——不要盲从数量。
2. 分类处置：可升级的升级基镜像/依赖重建；短期不可修的走豁免登记（写原因+到期日+补偿控制，如网络隔离该端口）。
3. 门禁策略：CRITICAL 原则阻断、HIGH 走豁免审批，避免"要么全放行要么全卡死"两个极端（结果：安全与交付可持续共存）。
4. 红线：不能为了赶版直接关扫描或 --exit-code 0（错误做法：把门禁形同虚设）。

## 题 5：只读根文件系统会不会让 Java 应用跑不起来？

- 多数不会，但需要处理几处写点：`-Djava.io.tmpdir` 指到挂了的 tmpfs、日志改 stdout（本就该如此，呼应 s2-3 运行层）、任何写文件需求显式开卷/tmpfs（异常：不设 tmpdir 时应用报 read-only file system）。
- 加分：只读根还能防"运行时被植入 webshell/恶意二进制落盘"，取证时容器内容可信（说明：不可变基础设施的安全红利）。

## 题 6：Docker 侧的这些安全实践，K8s 里如何强制？

- 非 root：runAsNonRoot + runAsUser（镜像没设也不会意外用 root）；能力/只读：capabilities.drop、readOnlyRootFilesystem。
- 集群级：Pod Security Standards(restricted) + 准入控制，不让不合规 Pod 起（结果：把"个人自觉"变成"平台强制"）。
- 供应链：准入镜像签名校验(仅信任自家 registry/digest)、准入扫描（见 kubernetes s2-2/s3-2，与 s1-2 多阶段镜像一脉相承）。
