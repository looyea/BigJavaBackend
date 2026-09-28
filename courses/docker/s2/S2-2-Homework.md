# 卷、镜像仓库与 Compose · 作业

## 作业 1：三种挂载对比实验

**目标**：亲手验证持久化差异。

1. 分别用 命名卷、bind、tmpfs 挂到 /data，各写入一个文件后 `docker rm -f` 容器，再起新容器挂同一位置：卷与 bind 文件仍在、tmpfs 消失（输出：三种结果对照表，验收：能说清谁管生命周期）。
2. bind 加 `:ro` 后在容器内 `touch /data/x` → 报 Read-only（错误用例体验），去掉 :ro 复现可写。
3. 记录命名卷实际落盘路径 `docker volume inspect` 的 Mountpoint（说明：理解 volume 也在宿主磁盘，只是由 Docker 管）。

## 作业 2：私有仓库推送与回滚

**目标**：走通 build→tag→push→拉取→回滚全流程。

1. 给服务打 1.0.0/1.0.1 两个语义化 tag 推到本地 registry（registry:2 容器即可），`docker rmi` 本地后从仓库重新拉（验收：拉下的 digest 与推送一致）。
2. 复现 latest 陷阱：连续 push 两次同名 latest，演示回滚时无法定位旧版本（结果：写明团队 tag 规约——禁止生产用 latest）。
3. 用 `docker digest` 校验镜像一致性，说明 tag 与 digest 谁能真正保证不可变（提示：按 digest 拉取最严格）。

## 作业 3：Compose 一键环境

**目标**：把前两节网络+本节卷组合成可复现开发栈。

1. 写 docker-compose.yml：mysql(volume)+order(build+backend 网)+gateway(仅它 ports 对外)，跨网隔离（验收：宿主机扫端口只有 gateway 开放）。
2. 先只写裸 depends_on 复现"order 连不上未就绪 mysql"的异常，再加 healthcheck+condition 修复（输出：修复前后启动日志对比）。
3. `down` 与 `down -v` 各执行一次，观察卷保留/清除差异，写一句何时该用哪个的规约。
