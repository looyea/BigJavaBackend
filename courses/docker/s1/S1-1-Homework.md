# 容器 vs 虚拟机与底层隔离 · 作业

## 作业 1：亲眼看见三大隔离机制

**目标**：用命令验证 Namespace、CGroup、UnionFS 不是抽象名词。

1. `docker run --rm alpine sh -c 'cat /proc/1/cgroup; ls /proc/self/ns'`，记录容器内 PID 1 与命名空间 inode（输出：与宿主不同的证据）。
2. `docker run -d --memory=100m --cpus=0.5 alpine sh -c 'while :;do :;done'`，再用 `docker stats` 观察 CPU 被限到 ~50%（结果：说明是配额不是独占核）。
3. 起一个容器，在里面 `dd if=/dev/zero of=/tmp/x bs=1M count=500` 然后 `rm x`，`docker ps -s` 看可写层 size 变化（错误用例预期：删了但 Virtual Size 不降，复现 CoW 删除标记）。

## 作业 2：OOMKilled 现场

**目标**：亲手触发一次 cgroup OOM。

1. 起 `--memory=100m` 的容器，用 `stress --vm 1 --vm-bytes 300m` 打爆 → `docker inspect` 查 OOMKilled 与退出码 137（验收：贴出 inspect 片段）。
2. 思考题（写入笔记）：为什么内存超了是"杀"，CPU 超了是"慢"？（提示：可压缩 vs 不可压缩资源）。

## 作业 3：容器 vs 虚拟机论证

**目标**：把本节取舍写成决策卡。

1. 列 3 个电商/金融场景，判断该用容器还是 VM 沙箱（如：多租户不可信代码、常规微服务、需要加载自定义内核模块的 Agent），每个给一句理由（说明：理由要落在隔离边界/内核依赖，不是"容器流行"）。
2. 反例自检：是否把"启动快"当成了安全性论据——二者无关。
