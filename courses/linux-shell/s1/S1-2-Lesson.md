# 网络、磁盘与日志定位脚本

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能用 ss/df/du/连接状态、以及 grep/awk/find/xargs 组合脚本快速定位"连不上、盘满了、日志里找异常"三类高频问题，并写出可复用、可放进告警脚本的一行式命令。

## 一、网络：连接状态是第一现场

排"接口超时/连不上"，先看连接与端口，再看包：

```bash
# 目的：判断连接堆积在哪个状态，定位是 accept 不过来还是下游连不上
ss -s                                   # 结果：连接总览（timewait/established 计数），5秒定性
ss -tanp | grep :8080 | awk '{print $1}' | sort | uniq -c   # 按状态统计 8080 的连接数
# CLOSE-WAIT 大量堆积 = 应用没 close（代码问题，连接池泄漏）
# SYN-RECV 大量 = 半连接队列被打满（可能 SYN flood 或对端建连风暴）
# TIME-WAIT 高一般是正常主动关闭端，除非耗尽临时端口才需要调 tw_reuse

# 连通性与端口，而不是先怪防火墙：
curl -sv --max-time 2 http://svc:8080/actuator/health   # 看握手与返回；比 telnet 更能暴露 HTTP 层
dig +short svc.internal                                  # DNS 解析对不对（解析错→连不上）
```

**反例**：一出连接问题就 `iptables -F`/重启网络——错误操作会把现场抹掉且可能误伤；先用 `ss`、`curl --max-time`、`dig` 定位层次（DNS/ TCP / 应用）。

## 二、磁盘：空间与 inode 两条命脉

"盘没满却写不进"是被忽略的 inode 场景：

```bash
# 目的：先分清"容量满"还是"inode 满"还是"某目录异常膨胀"
df -h          # 结果：容量水位，注意 Use% 与 Mounted on（别只看根盘）
df -i          # inode 使用率：海量小文件(如未清理的碎日志/临时文件)会 inode 100% 而 df -h 看着很空
du -xhd1 /var/log | sort -h    # 逐层定位谁在吃空间；-x 跨文件系统不越界，sort -h 人性化排序
# 反例：du 不加 -x 统计到 /proc、网络挂载导致又慢又怪
find / -xdev -type f -size +500M          # 揪出超大单文件（core dump、失控日志）
lsof +L1                   # 已删除但仍被进程持有的大文件：df 不降却找不到，靠它现身
```

删除大日志要懂"rm 不回收"：文件被进程打开时删除，空间要到进程 close/重启才释放——所以 `truncate -s 0 app.log` 往往比 `rm` 更适合在线清理。

## 三、日志定位：grep / awk / find 组合拳

排障最高频的动作是"在巨型日志里找异常并统计"：

```bash
# 目的：从 app.log 里找 ERROR、按小时统计、并取最近 N 条上下文
zgrep -h 'ERROR' app-*.log.gz                      # 说明：压缩日志也能直接查，省得 gunzip 撑爆磁盘
grep -Eo '"level":"ERROR".*' app.log | awk -F'"timestamp":"' '{print $2}' \
  | cut -c1-13 | sort | uniq -c                    # 结果：按"年-月-日 时"聚合错误条数，看突增时刻
grep -B3 -A15 'NullPointerException' app.log       # 取异常前后上下文（前后行数比只看一行有用得多）
find /var/log -name '*.log' -mtime +30 -delete     # 反例：直接 delete 未评估→正解先 -print 预览再删
```

## 四、可复用的一行式排障脚本

把"找异常 → 定位进程 → 看资源"串成应急脚本，是资深工程师的资产：

```bash
#!/usr/bin/env bash
# 目的：服务报警时一键抓现场，避免手忙脚乱且反复登录刷新了日志
# 结果：把关键快照落到 /tmp/snap_时间戳，供事后分析
set -euo pipefail
pid=$(pgrep -f demo-app | head -1)
out="/tmp/snap_$(date +%Y%m%d_%H%M)"; mkdir -p "$out"
ss -tanp state established | grep ":8080" > "$out/conn.txt"  2>/dev/null || true  # 说明：无匹配也别让脚本挂
top -bH -n1 -p "$pid" > "$out/top.txt"        # 线程级 CPU 快照
jstack "$pid" > "$out/jstack.txt"             # 反例：忘了 set ...|| true 时 grep 无结果会中断脚本
df -h > "$out/df.txt"; tail -n 2000 /var/log/demo/app.log > "$out/log.txt"
echo "现场已存 $out"
```

## 五、管道与文本处理的三个易错点

- `xargs` 空格/换行陷阱：`find ... -print0 | xargs -0 rm` 才不怕文件名带空格，`find | xargs` 会按空白切错；
- `grep` 无匹配退出码非 0，在 `set -e` 脚本里会中断——排查脚本常用 `|| true` 或 `grep ... ; echo $?`；
- `awk` 字段分隔对 JSON 日志不可靠（嵌套逗号），要精确就换 `jq`：`jq -r 'select(.level=="ERROR") | .traceId'`。

## 六、关联技术

这些是"手摇式"排障，规模化要靠 [ELK / Loki](../../elk/s1/S1-1-Lesson.md) 集中检索；进程内 CPU/线程用 [Arthas](../../arthas/s1/S1-1-Lesson.md)；容器里的网络与存储问题（CNI、PV 满）在 [Kubernetes](../../kubernetes/s1/S1-1-Lesson.md) 语境复看；资源类指标解读回到上一节 [进程/内存/CPU/IO 四件套与 Top/vmstat](S1-1-Lesson.md)。
