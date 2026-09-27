# 小测验 · 数组与链表

> 本卷共 6 题，混合单选 / 多选 / 判断 / 填空 / 简答，满分 100 分，≥ 60 分过关。

### 1. 数组能做到 O(1) 随机访问的根本原因是？（15分）

- A. 它会自动扩容
- B. 元素连续存放，地址可由基址 + 下标 × 步长直接算出
- C. 它带哈希索引
- D. 它是线程安全的

> 答案：B
> 解析：连续内存 + 定长步长让第 i 个元素地址一条指令算出；链表必须从头遍历定位，所以是 O(n)。

### 2. `ArrayList` 满员时的扩容策略与代价是？（15分）

- A. 每次 +1 扩容，总拷贝 O(n²)
- B. 约 1.5 倍扩容并整体拷贝，n 次尾部 add 均摊 O(1)
- C. 不扩容，超出即报错
- D. 2 倍扩容且不拷贝

> 答案：B
> 解析：`oldCapacity + (oldCapacity>>1)` 约 1.5 倍 + `Arrays.copyOf` 拷贝；因等比扩容总拷贝收敛，均摊 O(1)。

### 3. 【多选】关于数组与链表（ArrayList / LinkedList）的说法，正确的有哪些？（20分）

- A. LinkedList 的 O(1) 插入只有在已持有目标节点/迭代器时才成立
- B. ArrayList 缓存友好，遍历/随机访问通常快于 LinkedList
- C. `Arrays.asList` 返回的列表可以直接 `add/remove`
- D. `System.arraycopy` / `Arrays.copyOf` 对对象元素是浅拷贝

> 答案：ABD
> 解析：C 错——`Arrays.asList` 是固定大小视图，增删抛 `UnsupportedOperationException`，需包一层 `new ArrayList<>(...)`。A/B/D 均为常见陷阱与事实。

### 4. 判断：因为"链表插入删除快"，所以后端开发中应优先用 LinkedList 替代 ArrayList。（10分）

- A. 正确
- B. 错误

> 答案：B
> 解析：按下标操作要先 O(n) 定位，且 LinkedList 内存/缓存更差；绝大多数以访问/遍历为主的负载里 ArrayList 更快更省，栈/队列也应交给 ArrayDeque。

### 5. 填空题：ArrayList 中间 `remove(i)` 之所以是 O(n)，是因为要 `System.arraycopy` ______ 后续元素；已知数据规模时应 ______ 以消除反复扩容拷贝。（10分）

> 答案：移动 / 搬移 / 前移 / 预分配容量 / 指定初始容量 / new ArrayList<>(n)

### 6. 设计一个"最近 K 条操作记录"的原语：既要高频在末尾追加，又要偶尔按序号读取中间记录，还要淘汰最旧数据。请从数组/链表角度分析你会用什么结构、为什么，并指出 LinkedList 是否合适。（30分）

> 参考答案：
> - 末尾追加 + 按下标随机读 → 本质是数组特征，ArrayList/ArrayDeque 更合适
> - "按序号读中间"是 O(1) 随机访问，链表做不到(要遍历)，排除 LinkedList
> - 淘汰最旧(头部)：ArrayDeque 头尾 O(1) 优于 ArrayList 头删 O(n)
> - 定长滚动可加容量上限，超出即从头部丢弃/覆盖
> - 结论：选 ArrayDeque(循环数组)兼顾追加、随机读、头尾增删；LinkedList 仅在有明确"持引用中间增删"时才考虑
