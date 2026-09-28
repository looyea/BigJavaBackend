# 方法级观测与调用链耗时

> 本节难度：★★★☆☆
> 本节重要性：★★★★★
> 学习产出：掌握 Arthas"不停机、不改代码"的核心观测链路 dashboard→trace→watch/stack/tt，能回答"哪一跳慢、入参返回值长什么样、谁调用的我"，并会用 sc -d 与类加载器树定位"同一个类被加载两次"的冲突事故。

## 一、心智模型：attach 即临时字节码增强

Arthas 不改 JVM 参数、不重启进程，通过 `java.lang.instrument` 对目标方法做 retransform，在方法进出边界织入计时/采集逻辑——所以观测粒度天然落在 **Java 方法边界**上，锁内部等待与 native 代码它看不见；也正因为是"增强"，用完必须卸载，否则观测工具自己变成生产风险。

```text
图目的：按"问题三问"选择 Arthas 命令的决策路径
哪一跳慢？        → trace（调用链逐级耗时分解，含子调用）
为什么慢/数据呢？ → watch（入参/返回值/异常表达式）· tt（记录-回放现场）
谁在调用我？      → stack（反向调用树，揪出幽灵入口）
整体健康度？      → dashboard + thread -n 3（先分流"CPU 高"还是"线程池堵"）
❌ 反例心智：把 Arthas 当常驻探针——增强是字节码替换，排查结束要 stop 复位全部增强
```

## 二、trace：把调用链拆到每一跳

```shell
# 目的：只展开耗时 >100ms 的 createOrder 调用，过滤正常请求噪声
trace com.bigjava.order.OrderService createOrder '#cost > 100' -n 5
# 说明：#cost 是内置条件变量（返回后才有值）；-n 5 采集 5 次自动停止，防增强常驻
# 反例：大促现场 trace 不加条件也不带 -n，全量调用被织入计时，观测开销放大成二次事故
# 结果：`+---[123.45ms] com.bigjava.pay.PayClient:pay()` 直接暴露慢的那一跳
```

边界与技巧：trace 只见**耗时**不见数据；子类/重载用通配 `trace *.order.*Service create*`，但匹配越宽被增强的类越多，应先用 `sc` 确认命中面再收窄。想看慢跳内部继续下钻，就对慢的那个类再来一层 trace——逐层二分，比读代码猜快一个数量级。

## 三、watch / stack / tt：从"哪跳慢"到"为什么"

```shell
# 目的：只在抛异常时观测入参、返回值与异常，-x 2 控制对象展开深度
watch com.bigjava.pay.PayClient pay '{params, returnObj, throwExp}' -x 2 'throwExp != null' -n 3
# 说明：末尾条件是 observe-at-exception-after 边界；-b（进入前）与 -e（退出后）可对比入参出参
# 反例：观察整页订单列表等大对象，不设条件与深度上限——toString 拷贝刷堆，观测工具搞挂目标进程
# 结果：`throwExp=DubboRpcException: Invoke timeout` 一步锁定是依赖慢而非本方法慢
```

- `stack com.bigjava.CartService addItem`：回答"谁调用我"，定时任务/漏配的内部入口调了交易接口，一屏现形；
- `tt -t com.bigjava.OrderService createOrder -n 10` 把每次调用的现场索引存储，`tt -i 1002 -w 1` 展开查看；❌ 回放（`tt -i ... -p`）对外卖下单这类**非幂等方法**会真实重放副作用，写操作只看现场不回放；
- `monitor -c 5 com.bigjava.PayClient pay`：5 秒窗口聚合调用数/平均 RT/成功率，适合"刚才的修复生效没有"的持续回读。

## 四、类加载器排查：NoSuchMethodError 的真相

"类明明在 jar 里却找不到方法"的事故，本质多为**同一个全限定类被两个以上 ClassLoader 各自加载**，运行时命中了旧版本；JVM 只认"类 = 全限定名 + 加载器"。

```shell
# 目的：列出同名类及其加载器与来源 jar，坐实"双份加载"
sc -d com.bigjava.util.JsonUtils | grep -E 'class-info|classLoaderHash|code-source'
# 说明：出现多个 classLoaderHash 即嫌疑人；code-source 指明各自来自哪个 jar
# 结果：BOOT-INF/lib 与容器共享目录各有一份不同版本的 JsonUtils，方法签名对不上
# 后续：classloader -t 看加载器父子树确认谁该赢；根治靠统一版本/排除依赖，而非线上热改糊弄
```

## 五、观测纪律

每条增强命令都带 `-n` 与条件表达式；会话结束 `stop` 复位（只退会话用 `quit`，`stop` 才彻底关停并还原字节码）；同一方法避免 trace/watch/tt 叠加增强；生产机优先排查实例而非网段广播端口。观测是外科刀，不是长期输液。

## 六、关联课程

热更新与死锁/CPU 高组合拳在 [热更新、反编译与线上排查](S1-2-Lesson.md)；压测曲线下钻到方法级归因见 [并发模型、思考时间与 TPS/RT 解读](../../jmeter/s1/S1-2-Lesson.md)；单点观测之外要全局证据看 [火焰图怎么看与常见瓶颈](../../async-profiler/s1/S1-1-Lesson.md)；机器层先分流 CPU/内存/IO 问题参见 [进程/内存/CPU/IO 四件套与 Top/vmstat](../../linux-shell/s1/S1-1-Lesson.md)；方法现场之外的历史日志证据在 [ELK 组件与数据流](../../elk/s1/S1-1-Lesson.md)。
