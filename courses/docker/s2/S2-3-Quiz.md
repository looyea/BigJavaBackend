# 镜像安全与最佳实践 · 小测

### 1. 容器默认以 root 运行的主要风险是？（6分）

- A. 启动变慢
- B. 进程 UID=0 与宿主 root 同权（共享内核），一旦被入侵易触及宿主/挂载资源
- C. 内存占用更大
- D. 无法访问网络

> 答案：B
> 解析：容器 root ≠ 完全隔离的 root——共享内核下 RCE+内核漏洞即逃逸（结果：非 root 是第一道最小权限防线）。

### 2. Dockerfile 里非 root 化的正确写法是？（6分）

- A. ENTRYPOINT 前加 su
- B. 建专用用户并用 USER 指令切换
- C. 删掉 root 用户
- D. 无法实现

> 答案：B
> 解析：`useradd` + `USER <uid>`，安装/属主变更在切 USER 前完成（加分：固定高 UID 避免与宿主用户撞号）。

### 3. `--read-only` 的效果与配套是？（6分）

- A. 容器不能启动
- B. 根文件系统只读，需写的目录用 --tmpfs/卷显式开放
- C. 网络只读
- D. 只能拉取不能运行

> 答案：B
> 解析：只读根阻断篡改落盘（错误用例：应用往 /var/log 写会失败——应输出 stdout，需要写的地方单独挂 tmpfs）。

### 4. `--cap-drop=ALL --cap-add=NET_BIND_SERVICE` 的意义是？（6分）

- A. 关掉网络
- B. 去掉全部 Linux 能力、只白名单加回绑定低位端口这一项
- C. 提升性能
- D. 禁止写文件

> 答案：B
> 解析：最小能力原则——默认 root 容器带一堆用不上的特权（mount/raw 等），全 drop 再按需加回（异常：MOUNT_MODULE 留着等于留后门）。

### 5. trivy 在 CI 中的作用通常是？（6分）

- A. 构建镜像
- B. 扫描镜像 CVE/密钥，配合 --exit-code 做发布门禁
- C. 推送仓库
- D. 压缩镜像

> 答案：B
> 解析：`--severity HIGH,CRITICAL --exit-code 1` 让高危存在时流水线失败（结果：带毒镜像出不了门）。

### 6. 为什么不能把密钥 COPY 进镜像或写进 ENV？（6分）

- A. 镜像变大
- B. 会留在镜像层/元数据，删除后历史层仍可提取、随 pull 扩散
- C. 启动更慢
- D. 会被自动加密

> 答案：B
> 解析：分层+CoW 使"后置删除"无效（呼应 s1-1）；运行期注入（Secret/tmpfs）才是正解（错误用法：rm 掉密钥文件以为安全）。

### 7. 关于挂载 docker.sock 到业务容器，评价正确的是？（6分）

- A. 常规安全做法
- B. 高危——等于授予宿主 Docker API（root 级）控制权，仅 CI 构建器短期受控使用
- C. 提升性能
- D. 与挂 / 没区别但更安全

> 答案：B
> 解析：能调 Docker API 就能起特权容器挂载宿主任意路径→逃逸（异常：业务容器永远不该有此权限）。

### 8. 下列属于"最小镜像权限"实践的是（多选）（9分）

- A. 非 root USER
- B. no-new-privileges 禁提权
- C. 必设资源 limit 防耗尽宿主
- D. 挂宿主 / 目录方便排查

> 答案：ABC
> 解析：A/B/C 是清单核心；D 是绝对红线——挂宿主根目录等于交出宿主（错误用法，常用于反面教材）。

### 9. 关于基镜像 CVE 处理，正确的有（多选）（9分）

- A. 基镜像 tag 锁到具体版本（如 17.0.11_9-jre）
- B. 发现新 CVE 靠重建镜像更新，而非移动原 tag 内容
- C. 定期重建 + 重扫形成节奏
- D. 用 docker commit 在运行容器里改即可

> 答案：ABC
> 解析：锁版本+重建+重扫保证可审计可重现；D 破坏可重现与扫描（异常：谁装的包、装了什么无从追溯）。

### 10. 简答题：给金融核心 Java 服务做一次"容器安全加固"，输出可落地的分层加固方案与验收。（40分）

- 要点1：镜像层——多阶段构建去编译器、非 root USER(高 UID)、基镜像锁版本、禁 COPY 密钥/ENV 明文；验收：镜像内无 javac、容器内 `id` 显示 UID≠0（目的：缩小攻击面与供应链风险）。
- 要点2：运行层——--read-only+必要 tmpfs、--cap-drop=ALL 白名单加回、no-new-privileges、--pids-limit；验收：篡改无法落盘、setuid 提权失效（错误用例：日志写盘失败改 stdout 采集）。
- 要点3：资源与隔离层——内存/CPU limit 必设并配合 s1-3 JVM 感知，网络走自定义网络最小暴露、DB 不出后端网（关联 s2-1，结果：爆炸半径可控）。
- 要点4：供应链门禁——CI 集成 trivy HIGH/CRITICAL --exit-code 1 不过不发；镜像签名(cosign)+按 digest 部署保证不可篡改（输出：扫描/签名报告）。
- 要点5：编排强制——K8s 侧用 SecurityPodContext(runAsNonRoot/readOnlyRootFilesystem/drop ALL)+Pod Security Admission 兜底，防有人绕过镜像规范（说明：镜像与编排双层设防，缺一不可）。
- 要点6：持续治理——CIS Docker/K8s Benchmark 定期自检、CVE 到期重建计划、事故复盘进 checklist；验收标准：高危 CVE 存量=0、生产容器 root 运行数=0、敏感挂载数=0。

> 答案：见要点
