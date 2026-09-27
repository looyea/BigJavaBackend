# 小测验：MyBatis-Plus 工程提效

### 1. MyBatis-Plus 的设计原则是？（10分）
- A. 替代 MyBatis
- B. 只做增强不做改变
- C. 内置连接池
- D. 仅支持 MySQL
> 答案：B
> 解析：MP 完全兼容原生 MyBatis，在其基础上增加 BaseMapper/Wrapper/插件等能力，不改原有行为。

### 2. 以下哪种 Wrapper 是类型安全的？（10分）
- A. QueryWrapper
- B. LambdaQueryWrapper
- C. UpdateWrapper
- D. ChainWrappers
> 答案：B
> 解析：LambdaQueryWrapper 用方法引用（User::getAge）在编译期检查属性名是否存在，防止拼错列名。

### 3. MyBatis-Plus 分页插件需要配置哪个类？（10分）
- A. PageHelper
- B. MybatisPlusInterceptor + PaginationInnerInterceptor
- C. SqlSessionInterceptor
- D. PaginationPlugin
> 答案：B
> 解析：MP 3.4+ 用统一的 MybatisPlusInterceptor 注册各 InnerInterceptor，分页用 PaginationInnerInterceptor。

### 4. @Version 注解生效的前提是？（10分）
- A. 只需要加注解
- B. 必须注册 OptimisticLockerInnerInterceptor
- C. 必须用 QueryWrapper 更新
- D. 必须关闭分页插件
> 答案：B
> 解析：乐观锁是 MP 内置拦截器功能，需在 MybatisPlusInterceptor 中注册 OptimisticLockerInnerInterceptor 才生效。

### 5. @TableLogic 的作用是？（10分）
- A. 标记主键
- B. 逻辑删除——deleteById 变 UPDATE、SELECT 自动加 WHERE deleted=0
- C. 自动填充创建时间
- D. 字段加密
> 答案：B
> 解析：@TableLogic 标记逻辑删除字段，MP 自动把物理删除改为标记删除、查询时自动过滤已删除记录。

### 6. 以下哪些是 MyBatis-Plus 提供的能力？（多选，10分）
- A. BaseMapper 通用 CRUD
- B. 代码生成器
- C. 自动读写分离
- D. 多租户插件
> 答案：A、B、D
> 解析：C 错误——读写分离需要 ShardingSphere / 中间件配合，MP 本身不提供。

### 7. 判断："MyBatis-Plus 的 saveBatch 底层是逐条 INSERT。"（5分）
- A. 正确
- B. 错误
> 答案：A
> 解析：saveBatch 底层用 ExecutorType.BATCH 逐条 addBatch，不是拼多值 INSERT；性能优于逐条但弱于 foreach 拼接。

### 8. 以下哪种场景应回退手写 XML 而非使用 MP BaseMapper？（10分）
- A. 根据 ID 查询单条
- B. 多表 JOIN + 窗口函数 + CTE 复杂报表
- C. 分页查询
- D. 批量更新某字段
> 答案：B
> 解析：MP 的 Wrapper 只适合单表条件构造；复杂多表查询、CTE、窗口函数应手写 XML/注解 SQL。

### 9. 简答题：MyBatis-Plus 的乐观锁机制是什么？给出完整使用步骤与注意事项。（15分）
> 参考答案：
> - 实体字段加 @Version 注解（Integer/Long 类型）
> - 注册 OptimisticLockerInnerInterceptor 到 MybatisPlusInterceptor
> - 使用 updateById(entity)：MP 自动在 SQL 追加 WHERE version=旧值 + SET version=新值
> - 更新返回 0 表示版本冲突，需重查再修改重试
> - 注意：只对 updateById/update(entity,wrapper) 生效；自定义 XML SQL 不生效

### 10. 简答题：MyBatis-Plus 的条件构造器中 `.last("LIMIT 1")` 有什么风险？推荐用什么替代？（10分）
> 参考答案：
> - .last 直接拼接 SQL 尾部字符串，绕过预编译，有 SQL 注入风险（如果参数来自用户输入）
> - 多次调用 .last 只有最后一个生效（覆盖而非追加）
> - 替代方案：使用 `.limit(1)` (3.5.4+) 或 `selectPage(new Page<>(1,1), wrapper)` 取第一条
> - 最佳实践：永远不要在 .last/.apply 中拼接用户输入
