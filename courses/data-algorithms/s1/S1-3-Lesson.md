# 栈、队列与双端队列

> 本节难度：★★☆☆☆
> 重要程度：★★★★☆
> 学习产出：LIFO/FIFO 语义，ArrayDeque 取代 Stack，栈做表达式/DFS/回溯、队列做 BFS/削峰，Deque 通吃。

> 数组与链表是"通用容器"，而栈和队列是**限制存取端**的抽象：只在特定一端进出，换来清晰的语义与 O(1) 操作。
> 后端里它们不是做题工具，而是线程池、消息削峰、BFS、表达式求值、撤销/回滚的骨架。

## 一、栈 Stack：后进先出（LIFO）

只在一端（栈顶）push/pop，均 O(1)。它的本质是**"最近的最先处理"**——嵌套结构、撤销、回溯都天然是栈。

```java
// 反面教材：java.util.Stack 继承 Vector，方法全 synchronized，还暴露 get(i) 破坏栈语义
Deque<Integer> stack = new ArrayDeque<>();   // JDK 官方推荐：用 Deque 当栈
stack.push(1);                               // 入栈：栈深变 1，栈底是 1
stack.push(2);                               // 再入：栈顶为 2（LIFO）
int top = stack.pop();                       // 弹出栈顶 → top = 2，剩余栈 [1]
System.out.println(top);                     // 正确使用结果：输出 2，弹出后 size() 为 1
System.out.println(stack.peek());            // 只看不弹 → 输出 1，size() 仍为 1
```

**典型用途**：
- **表达式求值 / 括号匹配**：`()` `[]` `{}` 的嵌套校验，遇到闭括号弹栈顶配对。
- **DFS 与回溯**：递归的调用栈就是栈；把递归改迭代时手工维护栈。
- **撤销 / 编译**：Ctrl+Z、浏览器前进后退、编译器语法分析（算符优先）。
- **单调栈**：求"下一个更大元素"（阶段四 s4-6 详解）。

## 二、队列 Queue：先进先出（FIFO）

尾部入、头部出，均 O(1)。它体现的是**"先来先服务"**，是并发与调度的天然模型。

```java
Deque<Integer> q = new ArrayDeque<>();   // 单线程队列
q.offer(1); q.offer(2);                   // 尾部依次入队 → [1, 2]
q.poll();                                 // 头部出队 → 返回 1，剩 [2]（FIFO）
System.out.println(q.peek());             // 正确使用结果：输出 2，队头可见但不移除
```

**典型用途**：
- **BFS / 层序遍历**：按距离逐层扩散，队列保证先发现的先扩展。
- **线程池任务队列**、**消息队列（MQ）**、**请求排队**、**滑动窗口限流**。
- **生产者-消费者**：一方 `offer`、一方 `poll`，中间用队列解耦。

## 三、双端队列 Deque：两头通吃

`ArrayDeque` 底层是**循环数组** + `head/tail` 取模移动，两头都能 O(1) 增删，既能当栈又能当队列，还比 `Stack`/`LinkedList` 更快更省内存。**单线程要栈或队列，一律 `ArrayDeque`。**

```java
Deque<Integer> dq = new ArrayDeque<>();
dq.addFirst(2); dq.addLast(3);            // 两端各入 → [2, 3]，都是 O(1)
dq.removeFirst(); dq.removeLast();        // 两端各出 → 队列变空
System.out.println(dq.size());            // 正确使用结果：输出 0
// 不能存 null：用 null 表示"空/无元素"，存 null 会与 peek 返回 null 歧义
```

## 四、PriorityQueue：出队按优先级，不是 FIFO

`PriorityQueue` 底层是**二叉堆**（下节 s2-3 详解），`offer/poll` O(log n)，堆顶永远是极值。适合"每次取最优先/最小/最大"的场景：任务调度、Top-K、Dijkstra、合并 K 个有序序列。注意它**不保证整体有序**，只保证堆顶最值出队。

## 五、BlockingQueue：并发生产消的核心

`put/take` 自带"队空阻塞等待 / 队满阻塞生产者"，是 JUC 线程池与生产者-消费者的骨架：

| 实现 | 结构 | 锁 | 典型场景 |
|---|---|---|---|
| `ArrayBlockingQueue` | 有界数组 | 单锁 + notEmpty/notFull | 需要严格有界背压 |
| `LinkedBlockingQueue` | 可选有界链表 | put/take 两把锁，吞吐高 | 高并发产消（务必显式设容量） |
| `SynchronousQueue` | 不存元素 | 直接交接 | `CachedThreadPool` 即拿即走 |
| `PriorityBlockingQueue` | 无界堆 | — | 按优先级出队 |

**稳定性生命线——必须用有界队列**：无界队列会让线程池的 `maximumPoolSize` 与拒绝策略形同虚设（任务全进队列，线程数停在 core），突发流量下无限堆积 → OOM，且排队延迟不可控。

```java
// 手动建线程池：有界队列 + 明确拒绝策略，才是生产可用配置
ThreadPoolExecutor pool = new ThreadPoolExecutor(core, max, 60, SECONDS,
    new ArrayBlockingQueue<>(queueCap),        // 队列容量 = 到达速率 × 可容忍排队时间
    new ThreadPoolExecutor.CallerRunsPolicy()); // 打满时回压到调用方，而非静默丢弃
pool.execute(task);                             // 提交任务：核心线程未满先建线程，满了才入队，队满走拒绝策略
```

> 电力/电商场景：采集网关每秒海量上报涌入 → 前端 `BlockingQueue` 缓冲削峰，消费者 `drainTo` 批量落库；队列容量由压测出的合理排队深度决定，太大是"把过载藏起来"，RT 会更晚更隐蔽地爆发。

## 六、例子：正确用法与错误用法

```java
// 例子目的：栈/队列/双端队列/优先队列/并发队列各给一个正确用例与一个错误用例，写出真实输出与异常
import java.util.*;
import java.util.concurrent.*;

public class StackQueueDemo {

    // 知识点 1 正确用法：栈做括号匹配（嵌套结构天然 LIFO）
    static boolean balanced(String s) {
        Deque<Character> st = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            if (c == '(') st.push(c);                          // 左括号入栈，记录未闭合层数
            else if (c == ')') { if (st.isEmpty()) return false; st.pop(); }   // 右括号必须弹到配对左括号
        }
        return st.isEmpty();                                    // 全部闭合 → true
    }

    public static void main(String[] args) throws Exception {
        System.out.println(balanced("(()") + " " + balanced("()()"));   // 正确用例输出：false true

        // 知识点 2 错误用法：空栈弹元素——pop 返回 null，removeFirst 直接报错
        Deque<Integer> empty = new ArrayDeque<>();
        Integer v = empty.pop();                    // 错误：空栈 → 返回 null（静默！用来拆箱会 NPE）
        try {
            empty.removeFirst();                    // 错误：同一个空队列换 removeFirst → 抛 NoSuchElementException
        } catch (NoSuchElementException e) {
            System.out.println("removeFirst 对空栈抛异常，而 pop 只给 null");   // 输出该行：两种 API 失配行为不同
        }

        // 知识点 3 错误用法：ArrayDeque 存 null
        Deque<Integer> dq = new ArrayDeque<>();
        try {
            dq.addFirst(null);                      // 错误：与 peek 返回 null 歧义 → 抛 NullPointerException
        } catch (NullPointerException e) {
            System.out.println("双端队列禁止 null 元素");   // 输出该行
        }

        // 知识点 4 正确用法：PriorityQueue 只保证堆顶是极值
        Queue<Integer> pq = new PriorityQueue<>();                 // 默认小顶堆
        pq.offer(30); pq.offer(10); pq.offer(20);                   // 入队顺序 30,10,20，内部按堆序下沉
        System.out.println(pq.poll() + "," + pq.poll());            // 正确用例输出：10,20（按优先级出队，不是 FIFO）

        // 知识点 5 错误用法：线程池用无界队列 → maximumPoolSize 与拒绝策略形同虚设
        ExecutorService unbounded = new ThreadPoolExecutor(2, 10, 60, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>());                       // 错误：默认容量 Integer.MAX_VALUE → 任务只入队不增线程
        // 正确用法：显式有界 + 明确拒绝策略
        ExecutorService safe = new ThreadPoolExecutor(2, 10, 60, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(100),                        // 队列容量 = 到达速率 × 可容忍排队时间
                new ThreadPoolExecutor.CallerRunsPolicy());            // 打满时回压到调用方，而非静默丢弃
        for (int i = 0; i < 50; i++) safe.execute(() -> System.out.print("."));  // 正常运行：线程在 2→10 间扩容，满则回压
        safe.shutdown();
        unbounded.shutdown();
        System.out.println(!unbounded.awaitTermination(1, TimeUnit.SECONDS));    // 输出布尔：演示队列已排空
    }
}
```

## 七、选型口诀

1. 单线程要**栈** → `ArrayDeque`（push/pop/peek），弃用 `java.util.Stack`。
2. 单线程要**队列** → `ArrayDeque`（offer/poll/peek）。
3. 要**按优先级**出队 → `PriorityQueue`（堆）。
4. **并发**产消 / 线程池 → `BlockingQueue`，且**必须显式有界**并配拒绝策略。

## 八、本节要点回顾

1. 栈=LIFO（表达式/DFS/回溯/撤销），队列=FIFO（BFS/调度/削峰），Deque=两头通吃的循环数组。
2. JDK 里栈和队列都用 `ArrayDeque`，别用 `Stack`；优先级出队用 `PriorityQueue`。
3. `BlockingQueue` 是线程池与生产者-消费者的骨架，**有界是铁律**，容量靠压测定。
4. 这些抽象在阶段三会重逢：BFS 用队列、DFS/回溯用栈、Dijkstra 用优先队列。
