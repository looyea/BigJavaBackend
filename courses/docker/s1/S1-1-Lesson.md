# 容器 vs 虚拟机与底层隔离

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：能从 Namespace、CGroup、UnionFS 三大内核机制讲清"容器不是轻量虚拟机"，理解镜像分层与写时复制，并据此解释启动速度、隔离强度与安全边界的差异。

## 一、一句话定位：容器共享内核，虚拟机自带内核

```text
图目的：两种隔离的边界画在哪。
虚拟机：Hypervisor 之上，每个 Guest 跑自己的完整内核+用户态 —— 隔离到硬件模拟层，启动分钟级，GB 级内存底价。
容器：共用宿主机内核，只隔离"进程看到的资源视图" —— 启动毫秒级，MB 级开销。
结果：容器轻在内核共享，也危在内核共享（内核漏洞=逃逸）；这不是实现好坏，是模型本质。
```

## 二、Namespace：隔离"看得见的世界"

```bash
# 目的：每个容器是一组 Namespace 的交集，决定它能"看见"什么
docker run --rm alpine sh -c 'hostname; echo $$'      # 容器内独立 hostname 与 PID 视图
ls /proc/self/ns/                                     # 输出：mnt/pid/net/uts/ipc/user/... 各命名空间 inode
# 六类核心：PID(进程号)、NET(网卡/端口栈)、MNT(文件系统挂载点)、UTS(主机名)、IPC(信号/共享内存)、USER(uid 映射)
# 反例/风险：默认不给容器单独 USER namespace → 容器内 root 就是宿主机 root（权限风险），需 --userns-remap 或 user namespace 才真正降级
```

## 三、CGroup：限制"能用多少"

```bash
# Namespace 管"看不见别人"，CGroup 管"用不了太多"——两者正交，缺一不可
docker run -d --name order --memory=512m --cpus=1.5 shop-order:1.0
cat /sys/fs/cgroup/memory/.../memory.limit_in_bytes   # 目的：验证 512m 落到 cgroup
# 结果：超内存 → cgroup OOM Killer 只杀容器内进程，不伤宿主；CPU 超额 → 限流(throttle)而非杀死
# 异常场景：以为 CGroup 是"分配"——它是"上限+权重"，不独占，宿主空闲时仍可用满（直到触顶）
```

## 四、UnionFS 与镜像分层：写时复制（CoW）

```dockerfile
# 目的：每条指令一层只读镜像层，组合成容器的可写上层
FROM eclipse-temurin:17-jre      # 层1：JRE 基础
COPY app.jar /app.jar            # 层2：应用 jar
RUN ln -s /app.jar /link          # 层3：软链
# 运行期最顶上加一个可写层：改文件=从下层复制到可写层再改（copy-on-write），下层始终只读可被多容器共享
# 反例：容器内 rm 大文件并不释放镜像体积——只是在上层写"删除标记"，下层数据还在（结果：镜像越滚越胖的真因）
```

- 分层复用是"pull 秒下"的关键：相同基础层全机器共享，只传差异层。

## 五、容器 vs 虚拟机取舍对照

| 维度 | 容器 | 虚拟机 |
|------|------|--------|
| 启动 | 毫秒~秒 | 数十秒~分钟 |
| 隔离强度 | 共享内核（弱） | 硬件级（强） |
| 密度 | 单机数十~上百 | 单机数~数十 |
| 镜像体积 | MB | GB |
| 适用 | 微服务、CI、弹性伸缩 | 强隔离/多租户/异构 OS |
- 互补而非替代：Kata/gVisor/Firecracker 走"容器体验+虚拟机隔离"的中间路线（面试高频补充点）。

## 六、关联技术

- CGroup 资源上限直接决定下一节 JVM 容器感知（s1-3）的堆大小判定。
- Namespace NET 与端口映射见 s2-1 网络模型；UnionFS 分层是 s1-2 镜像优化与 s2-3 安全的原理基础。
- 编排层如何复用这些能力见 kubernetes s1-1（Pod 即容器组隔离单元）。
