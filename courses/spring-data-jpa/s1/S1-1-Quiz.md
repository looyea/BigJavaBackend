# 持久化上下文与实体状态 · 小测

### 1. JPA 持久化上下文的本质是什么？（6分）

- A. 数据库连接池中的连接对象
- B. EntityManager 内部维护的一级缓存，跟踪托管实体状态
- C. 事务日志（WAL）的内存镜像
- D. Spring IoC 容器中的 Bean 实例缓存

> 答案：B
> 解析：持久化上下文 = L1 Cache，生命周期与事务或 Session 绑定，用于脏检查和标识映射。

### 2. 以下哪种操作会让实体从托管态变为游离态？（6分）

- A. 调用 em.persist(entity)
- B. 调用 entity.setName("x") 修改属性
- C. 事务提交后 EntityManager 关闭
- D. 调用 em.flush()

> 答案：C
> 解析：persist 使瞬时→托管；修改属性仍为托管态；flush 只刷 SQL 不改变状态；关闭 EM/上下文后实体变为游离。

### 3. em.merge(detached) 的返回值是？（6分）

- A. 与参数是同一个对象引用
- B. 一个新的托管态副本，原对象仍为游离
- C. 返回 null，表示 merge 无返回
- D. 返回持久化后的 PreparedStatement

> 答案：B
> 解析：merge 返回托管副本；原游离对象不会被跟踪，后续必须使用返回值。

### 4. 脏检查（Dirty Checking）在什么时机触发？（6分）

- A. 仅在手动调用 em.flush() 时
- B. 每次 setter 被调用时立即发 SQL
- C. 事务提交前 + JPQL/HQL 查询前自动 flush
- D. 仅在 GC 回收实体时

> 答案：C
> 解析：FlushModeType.AUTO 下，查询前自动 flush 确保一致性；事务提交前也 flush；不是每次 setter 就发 SQL。

### 5. 批量插入 10 万条时防止 OOM 的关键代码是？（6分）

- A. em.detach(entity) 每次循环
- B. 每 N 条执行 em.flush() + em.clear()
- C. 设置 hibernate.jdbc.batch_size=1
- D. 使用 em.remove() 释放内存

> 答案：B
> 解析：flush 把 INSERT 发给 DB，clear 清空持久化上下文释放内存；detach 只移单个但不清空快照；batch_size=1 无批处理意义。

### 6. @Transactional(readOnly=true) 对脏检查的影响是？（6分）

- A. 完全禁用 SQL 查询
- B. 跳过脏检查，减少 flush 时的快照比较开销
- C. 将 flushMode 改为 COMMIT
- D. 无任何影响，只是给 DBA 看的标记

> 答案：B
> 解析：readOnly=true 时 Hibernate 设 FlushMode.MANUAL 并标记 Session 只读，flush 时跳过脏检查提升性能。

### 7. em.remove(游离态实体) 会抛出什么异常？（6分）

- A. NullPointerException
- B. EntityNotFoundException
- C. IllegalArgumentException
- D. TransactionRequiredException

> 答案：C
> 解析：remove 只接受托管态实体，传入游离态抛 IllegalArgumentException。

### 8. 以下对 persist 说法正确的是（多选）？（9分）

- A. persist 立即向数据库发送 INSERT 语句
- B. persist 使瞬时实体进入托管态
- C. persist 返回值为 void
- D. persist 对已有 ID 的实体等同于 update

> 答案：B、C
> 解析：A 错——INSERT 在 flush 时才发出；D 错——persist 不管有无 ID，若实体已托管会抛 EntityExistsException。

### 9. 关于 Extended PersistenceContext 说法正确的是（多选）？（9分）

- A. 生命周期与 HTTP Session 绑定
- B. 适用于多轮对话的长事务场景
- C. 与 Transaction-Scoped 完全等价
- D. 通过 @PersistenceContext(type=EXTENDED) 声明
- E. 跨多个数据库事务仍然保持托管状态

> 答案：A、B、D、E
> 解析：Extended PC 跨事务保持状态，适合向导/多步表单场景；与 Transaction-Scoped 语义完全不同，C 错。

### 10. 简答题：描述实体从"瞬时"到"移除"的完整状态流转路径，并指出每一步的关键 API。（40分）

- 要点1：瞬时态——new 对象，无 ID 或 ID 未被 EM 管理
- 要点2：persist() 或 merge() → 进入托管态，被 L1 缓存跟踪
- 要点3：事务提交/EM 关闭 → 变为游离态，修改不再被脏检查捕获
- 要点4：对托管态实体调用 remove() → 进入移除态，flush 时发 DELETE
- 要点5：merge() 可让游离态实体重新回到托管态（返回新托管副本）

> 答案：见要点
> 解析：完整路径为 Transient → Managed → Detached → (merge → Managed) → Removed。
