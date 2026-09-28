# 网络、磁盘与日志定位脚本 · 面试题

## 题 1：接口"连不上/超时"，你在 Linux 层怎么分层排查？

- 分层：DNS（`dig +short`）→ TCP 建连与状态（`ss -s`、按状态统计）→ 应用层握手（`curl -sv --max-time`）→ 才谈防火墙/安全组；
- 状态判读：CLOSE-WAIT 堆积=应用没 close（连接池泄漏），SYN-RECV 高=半连接队列打满/建连风暴，TIME-WAIT 高一般是主动关闭端正常；
- 反例：一上来 `iptables -F`/重启网络会抹掉现场且可能误伤——先取证再动。

## 题 2：CLOSE-WAIT 和 TIME-WAIT 大量堆积，危害有何不同？

- CLOSE-WAIT：本端未 release，占着 fd 与连接池槽位，累积到 ulimit 就 "Too many open files"，且下游看到连接半开——是代码 bug，必须修；
- TIME-WAIT：主动关闭端为可靠关闭留的 2MSL，通常无害，只有高并发短连接耗尽本地临时端口才需要处置（上长连接/连接池，或谨慎调 tw_reuse）；
- 加分：把 CLOSE-WAIT 归因到具体进程用 `ss -tanp` 或 `lsof -p`，再回代码查 HttpClient/DB 池是否复用与超时。

## 题 3：`df -h` 说有空间却 "No space left on device"，可能原因？

- inode 满：`df -i` 看，海量小文件（碎日志、临时文件）会 inode 用尽而容量看着很空；
- 已删未回收：`lsof +L1` 查被进程持有的已删除大文件，close/重启或 `truncate` 才释放；
- 其它：写到只读挂载、配额（quota）、tmpfs 满；
- 治理不止救火：日志失控根因是 logback 没配滚动上限，事后手删是治标。

## 题 4：为什么不能直接 `rm` 一个正在被写的大日志？

- 有进程持有句柄时 `rm` 只 unlink 目录项，空间待最后持有者 close 才回收——`df` 不降、进程还在往"看不见"的 inode 写；
- 正确：`truncate -s 0 app.log`（保留句柄原地清空）或走信号量滚动；
- 追问"删了想立刻回收"：找到持有进程（lsof）重启它，或本就应由滚动策略避免"单文件巨大"。

## 题 5：写排查脚本时，`set -e` 下 grep 无匹配为什么会把脚本搞挂？怎么防？

- grep 无命中退出码为 1，`set -e` 遇非零即中断——排查里"没找到"是正常结果不该终止；
- 防法：对允许失败的命令 `grep ... || true`、或用 `if grep -q` 显式判断、`set -e` 下把可失败管道独立处理；
- 工程素养：排查脚本要幂等、防误删（破坏性 find 先 -print 预览）、把证据固化到带时间戳文件而非只打屏（复盘与多次登录会刷新现场）。

## 题 6：JSON 日志用 awk 按逗号切为什么不可靠？该用什么？

- JSON 字段值可能含逗号/转义/嵌套对象，awk/cut 按分隔符切会错位，`level` 取到错列——解析必须语法感知；
- 正解：`jq -r 'select(.level=="ERROR") | .traceId'`，字段化统计才准；
- 加分：真要在机器上高频按字段过滤，早该上集中日志（[ELK/Loki](../../elk/s1/S1-1-Lesson.md)），`zgrep`/`jq` 只是应急手摇式手段。
