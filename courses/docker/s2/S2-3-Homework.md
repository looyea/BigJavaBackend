# 镜像安全与最佳实践 · 作业

## 作业 1：非 root 化改造

**目标**：把一个 root 运行的 Java 镜像改成最小权限。

1. 给现有 Dockerfile 加 `useradd` + `USER 10001`，处理文件属主（chown jar 给 appuser），重建后 `docker exec id` 确认 UID≠0（验收：输出 uid=10001）。
2. 故意不改属主直接跑 → 复现应用无权写工作目录的异常（错误用例：Permission denied），再正确修复（结果：理解 USER 不是加一行就完事）。
3. 用 `docker inspect` 记录改造前后 User 字段对比。

## 作业 2：运行时加固演练

**目标**：体验只读+能力裁剪对应用的真实影响。

1. 用 `--read-only` 起服务，观察它写 /tmp/日志的失败，改配 `--tmpfs /tmp` 与 stdout 日志后正常（输出：从报错到修复的路径）。
2. 加 `--cap-drop=ALL`，验证需要绑 80 端口时报错、`--cap-add=NET_BIND_SERVICE` 后成功（验收：能力白名单生效证据）。
3. 加 `--security-opt=no-new-privileges`，进容器尝试 `sudo -l`/setuid 程序失效（错误用例：提权路径被切断）。

## 作业 3：扫描与密钥卫生

**目标**：把 trivy 接入并修一个真实告警。

1. `trivy image --severity HIGH,CRITICAL` 扫自己的镜像（输出 CVE 清单），升级一个受影响基镜像版本后重扫确认下降（验收：HIGH/CRITICAL 归零或记录豁免）。
2. 演练"密钥进镜像"事故：COPY 一个假密钥文件、下一层 rm 删除，用 `docker history`/`dive` 证明它仍在历史层（结果：坐实后置删除无效）。
3. 改写为运行期 `--tmpfs`+环境变量注入，重扫确认镜像内无可提取密钥（说明：把"删不掉"变成"从来不进镜像"）。
