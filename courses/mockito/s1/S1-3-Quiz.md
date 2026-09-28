# 静态/final Mock、strictness 与过度 Mock · 小测

## 一、单项选择题（每题 6 分，共 42 分）

### 1. mockStatic 返回的 MockedStatic 为什么要放在 try-with-resources 里？（6分）

- A. 语法美观
- B. 它是线程级全局接管，不 close 会把静态桩泄漏到同线程后续所有测试
- C. 避免内存泄漏即可，无行为影响
- D. 为了并行加速
> 答案：B
> 解析：静态方法被字节码改写，作用域=当前线程+未关闭期间；忘记 close 的典型案例是"单独跑绿、整包跑红"的顺序依赖故障。

### 2. 被测方法把任务提交到线程池执行，池内线程调用了被 mockStatic 的静态方法，结果是？（6分）

- A. 一样被接管
- B. 子线程不受 mockStatic 管辖，走真实静态实现，测试偶发失败/假绿
- C. 抛 IllegalStateException
- D. 自动等待池执行完
> 答案：B
> 解析：mockStatic 线程局部；异步路径要么改造为可注入依赖，要么用更高集成层验证，别指望静态 mock 罩住多线程。

### 3. Mockito 5 能直接 mock final 类/方法，是因为？（6分）

- A. 反射 setAccessible
- B. 默认 MockMaker 换为基于 instrumentation 的 inline 实现
- C. 编译期注解处理
- D. 动态代理支持 final
> 答案：B
> 解析：inline mock maker 在类加载时做字节码 instrument，摆脱"子类覆写"限制（subclass maker mock 不了 final）；mockito-inline 已并入核心包。

### 4. 使用 inline mock maker 的代价包括？（6分）

- A. 无法 mock 接口
- B. 与 JaCoCo on-the-fly 等 agent 可能冲突、启动/转换开销上升
- C. 失去 verify 能力
- D. 只能单线程运行
> 答案：B
> 解析：instrumentation 类能力都抢占字节码改写，历史上与覆盖率 agent、mock 框架互踩需版本对齐；性能上少量劣化换 final 可 mock。

### 5. "被测代码内部 new SmsClient() 且无法改注入"，最小侵入方案是？（6分）

- A. mockStatic
- B. mockConstruction（try-with-resources）
- C. 反射替换字段
- D. 放弃单测转集成
> 答案：B
> 解析：mockConstruction 拦截作用域内该类的每一次构造并产出替身，还能经 constructed() 验证构造次数；根治仍是重构成可注入。

### 6. STRICT_STUBS 下 PotentialStubbingProblem 的典型根因是？（6分）

- A. 忘记 close
- B. 实际调用参数与打桩参数不匹配（如 DTO 未重写 equals），Mockito 拒绝"假装命中"
- C. mock 数量过多
- D. final 方法未 instrument
> 答案：B
> 解析：报错会贴出桩参数 vs 实际参数对照；处置是修 matcher/补 equals，而不是降 LENIENT 掩盖。

### 7. 关于 mock 时间与随机数，被公认的正解是？（6分）

- A. mockStatic(Instant.class)
- B. 注入 Clock.fixed 与可播种 Random，把不可测点变成参数
- C. Thread.sleep 对齐
- D. 反射改静态 now 缓存
> 答案：B
> 解析：JDK 时间类 instrumentation 受限且脆弱；"seam 比 mock 便宜"——为可测性做一次参数化改造，收益永久。

## 二、多项选择题（每题 9 分，共 18 分）

### 8. （多选）关于 strictness 的说法正确的有？（9分）

- A. MockitoExtension 默认 STRICT_STUBS，会同时检查死桩与参数误用
- B. lenient() 可以只豁免单条打桩，@MockitoSettings 可按类调档
- C. 整个类长期 LENIENT 且无 TODO，是技术债信号
- D. LENIENT 模式下未打桩调用会抛异常
> 答案：ABC
> 解析：D 说反了——未打桩调用任何模式都返回默认值；strictness 管的是"报警响不响"，不改默认值行为。

### 9. （多选）以下哪些属于"过度 Mock"的信号？（9分）

- A. 纯重构（不改外部行为）导致十几个测试必红
- B. mock 了被测方法返回的 DTO 而不是 new 一个真的
- C. verifyNoMoreInteractions 覆盖被测类的全部公开方法
- D. @DataJpaTest 里用真 H2 跑 repository 查询
> 答案：ABC
> 解析：A=测试锁实现细节、B=值对象该用真实数据、C=交互断言密度过高；D 反而是"用真依赖"的健康形态（方言场景还应上 Testcontainers）。

## 三、简答题（40 分）（每题 40 分，共 40 分）

### 10. 团队老代码大量静态工具类与内部 new，问：(1) mockStatic/mockConstruction 的正确使用姿势与红线；(2) 如何规划从"全静态 mock"到"可注入设计"的演进；(3) strictness 策略怎么定。（40分）

> 参考答案：
- 要点1：mockStatic/mockConstruction 一律 try-with-resources，作用域=当前线程，异步路径不接管——先验证调用线程再决定能不能用它；
- 要点2：红线——不 mock JDK 核心类（Instant/System）、不用它覆盖高频工具（性能）、禁止把 MockedStatic 提升为成员字段跨用例复用；
- 要点3：演进路线：新代码强制构造器注入+Clock/随机源参数化；旧代码加"静态壳→委托可注入 Bean"的适配层，mock 只打适配层接口；
- 要点4：以"每文件 mockStatic 次数"设 CI 预算并逐降，配合 characterization test 保安全网，避免大爆炸重写；
- 要点5：strictness 基线：新代码 STRICT_STUBS 默认不动；迁移中的历史类允许整类 LENIENT 但挂 TODO+issue 跟踪，稳定后回收；
- 要点6：治理面：过度 Mock 五信号纳入 code review checklist，中三条即评审退回——制度先于个人自觉。
