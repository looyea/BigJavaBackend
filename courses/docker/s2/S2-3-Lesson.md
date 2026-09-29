# 镜像安全与最佳实践

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：建立"最小权限镜像"的清单化思维——非 root 运行、只读根文件系统、能力裁剪、基镜像选型与 trivy 扫描门禁，能堵住容器最常见的逃逸与供应链风险。

## 一、头号反模式：root 运行

```dockerfile
# 反例：镜像不设 USER，容器内进程=宿主 root（同内核！），一旦 RCE 可直接摸宿主/挂载卷（异常：逃逸事故起点）
FROM eclipse-temurin:17-jre
RUN useradd -r -u 10001 appuser        # 目的：创建无家目录系统用户
USER 10001                               # 之后进程以非 root 运行
ENTRYPOINT ["java","-jar","/app.jar"]
# 说明：K8s 侧对应 runAsNonRoot: true 强制校验——镜像与编排两层都要设防
```

- 配套检查：`docker inspect` 看 User 字段；`id` 进容器验证 UID≠0；基础镜像自带 root 安装步骤要放在切 USER 之前。

## 二、运行时收紧：只读文件系统 + 能力裁剪 + 禁提权

```bash
docker run -d --read-only \                    # 根文件系统只读，篡改无法落盘
  --tmpfs /tmp:size=64m \                      # 确实要写的地方开显式可写点
  --cap-drop=ALL --cap-add=NET_BIND_SERVICE \  # 能力白名单：只留绑 80 端口这一项
  --security-opt=no-new-privileges \           # 禁止 execve 提权（setuid 失效）
  --pids-limit=200 \                           # 防进程炸弹（fork 风暴）
  shop-order:1.0
# 错误用例预期：--read-only 后应用往 /var/log 写日志直接异常——日志本就该输出 stdout（12-factor），顺带修好采集
```

## 三、供应链：基镜像与扫描门禁

```bash
# 1) 锁版本 + 定期重建：基镜像 tag 到具体版本（17.0.11_9-jre），CVE 修复靠重建而非改 tag
# 2) trivy 扫描进 CI，形成质量闸门
trivy image --severity HIGH,CRITICAL --exit-code 1 nexus.shop.internal/docker/shop-order:1.4.2
# 输出：CVE 清单 + 修复版本建议；--exit-code 1 让存在高危时 CI 直接失败（结果：带毒镜像出不了门）
# 反例：只扫生产不扫基镜像来源 / 用 docker commit 在容器里"攒"镜像 —— 不可审计、不可重现（异常：谁装的包无人知）
```

- 加分项：镜像签名/校验（cosign verify + 按 digest 部署）；Dockerfile 不进敏感信息（COPY 秘钥、ENV 密码——历史层里删不掉，呼应 s1-1 CoW）。

## 四、Host 挂载与端口暴露的安全红线

```bash
# 红线一：绝不挂宿主敏感路径
docker run -v /:/host ...            # 错误用法：等于把宿主根目录交出去，root 容器直接改宿主（逃逸实锤）
docker run -v /var/run/docker.sock:/var/run/docker.sock  # 挂 docker.sock=交出宿主 Docker API=root 级控制，仅限 CI 构建器短信用
# 红线二：只暴露必要端口（s2-1 网络隔离的延伸）：DB/管理端口不对公网 -p
# 合规参考：CIS Docker Benchmark 逐条自检，金融场景通常强制
```

## 五、最小镜像权限清单（可直接贴进 Code Review）

1. 非 root USER + 固定高 UID；2. `--read-only` + 显式 tmpfs；3. `--cap-drop=ALL` 白名单加回；4. no-new-privileges；5. 禁挂 / 与 docker.sock；6. 基镜像锁版本、trivy 门禁 HIGH/CRITICAL 不过不发；7. 多阶段构建保证运行镜像无编译器/包管理器（装了 apk 也进不了生产——s1-2）；8. 资源 limit 必设（防失控耗尽宿主——回看 s1-3 JVM 感知）。

## 六、关联技术

- 本节各项在 K8s 里由 SecurityPodContext/PSP→Pod Security Admission 强制（见 kubernetes s2-2、s3-2）；构建期扫描接入流水线的写法见 gitlab-ci s1-2。
- 强隔离场景（不可信多租户）需要沙箱运行时，原理见 s1-1 的 gVisor/Kata 路线。
