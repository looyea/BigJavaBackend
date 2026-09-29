# MyBatis 执行流程与一级二级缓存

> 本节难度：★★★★☆
> 重要程度：★★★★★
> 学习产出：掌握 MyBatis 从 SqlSessionFactory → SqlSession → Executor → StatementHandler → ResultSetHandler 的完整执行链路，以及一级/二级缓存的作用域、失效规则与生产陷阱。

## 一、整体架构与核心组件

```flow
目的：展示 MyBatis 执行的完整分层调用链
SqlSessionFactory → SqlSession → Executor(SimpleExecutor/ReuseExecutor/BatchExecutor/CachingExecutor)
    → StatementHandler(Prepare/Parameter/Set) → Handler 链处理参数与结果
    → ResultSetHandler → TypeHandler → 映射为 Java 对象
```

| 组件 | 职责 |
|------|------|
| SqlSessionFactory | 读取配置，创建 SqlSession；重量级单例 |
| SqlSession | 顶层 API，暴露 select/insert/update/delete/commit |
| Executor | SQL 执行器，管理一级/二级缓存、事务 |
| StatementHandler | JDBC Statement 的创建、参数设置、执行 |
| ParameterHandler | 把 Java 对象参数设置到 PreparedStatement |
| ResultSetHandler | 把 ResultSet 映射为 Java 对象 |
| TypeHandler | Java 类型 ↔ JDBC 类型转换 |

## 二、初始化流程

```java
// 目的：从 mybatis-config.xml 构建 SqlSessionFactory（应用启动只做一次）
// 错误用法: 每次查询都 new SqlSessionFactoryBuilder().build() → 重复解析配置性能极差
// 反例: SqlSession 作为单例共享 → 线程不安全（内部有 Executor 状态）
String resource = "mybatis-config.xml";
InputStream is = Resources.getResourceAsStream(resource);
SqlSessionFactory factory = new SqlSessionFactoryBuilder().build(is);
// 结果：解析 configuration → 注册 MappedStatement → 初始化 TypeHandler/Interceptor 链
```

初始化核心步骤：
1. XMLConfigBuilder 解析全局配置 → Configuration 对象。
2. 扫描 Mapper XML / 注解 → 每个 SQL 映射为 MappedStatement 注册到 Configuration。
3. 构建 Interceptor 链（插件责任链）。
4. 注册 TypeHandler 映射表。

## 三、查询执行全流程

```java
// 目的：一次 selectList 调用的完整内部流程
// 错误用法: 循环中不关闭 SqlSession → 连接泄漏 + 一级缓存无限增长
List<User> users = sqlSession.selectList("com.example.UserMapper.selectAll");
```

**内部步骤拆解**：

1. **SqlSession.selectList** → 调用 Executor.query。
2. **CachingExecutor**（若开启二级缓存）：先查 TransactionalCacheManager → 命中则返回。
3. **BaseExecutor**：查一级缓存 PerpetualCache（key = MappedStatement.id + RowBounds + SQL + 参数）。
4. 未命中 → **doQuery**：
   - 创建 **PreparedStatementHandler** → 从 DataSource 获取 Connection → Prepare Statement。
   - **ParameterHandler.setParameters**：按 TypeHandler 逐个填充 `?`。
   - Statement.execute → 得到 ResultSet。
   - **ResultSetHandler.handleResultSets**：按 ResultMap 映射列 → 属性，嵌套查询/关联。
5. 结果写入一级缓存 → 返回。

```java
// 目的：一级缓存验证——同一 SqlSession 两次相同查询只走一次 DB
User u1 = session.selectOne("...getUser", 1L);  // 结果：查 DB，写入一级缓存
User u2 = session.selectOne("...getUser", 1L);  // 结果：命中一级缓存，u1 == u2（同一引用）
session.clearCache();  // 结果：手动清空一级缓存
User u3 = session.selectOne("...getUser", 1L);  // 结果：再查 DB
// 错误用法: 以为一级缓存跨 SqlSession 也生效 → 不是，SqlSession 级别隔离
```

## 四、二级缓存（Namespace 级）

### 4.1 开启方式

```xml
<!-- mybatis-config.xml -->
<settings>
    <setting name="cacheEnabled" value="true"/>  <!-- 结果：全局开启（默认 true 但需 Mapper 配置才生效） -->
</settings>
<!-- UserMapper.xml -->
<cache eviction="LRU" flushInterval="600000" size="1024" readOnly="false"/>
```

### 4.2 作用域与失效

- 作用域：同一 `<mapper namespace>` 内所有语句共享一个缓存区。
- **失效时机**：同一 namespace 下执行 insert/update/delete → commit 后清空该 namespace 全部缓存。
- **事务感知**：二级缓存数据在 commit 后才可读（未提交事务间的隔离）。
- 跨 namespace 不共享：UserMapper 改了数据，OrderMapper 的缓存不会失效 → **脏读风险**。

### 4.3 生产陷阱

```java
// 目的：二级缓存的分布式环境陷阱
// 错误用法: 多实例部署开启二级缓存 → 各 JVM 的缓存互不感知 → 数据不一致
// 反例: readOnly=true 返回同一对象引用 → 外部修改污染缓存
// 说明：生产环境通常关闭二级缓存（cacheEnabled=false），改用 Redis 做分布式缓存
```

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 分布式不一致 | JVM 本地缓存不共享 | 用 Redis/Caffeine 替代 |
| 脏读跨 namespace | 不同 namespace 不互相 flush | 合并 namespace / 关闭二级缓存 |
| 序列化开销 | readOnly=false 需 clone 对象 | 对象实现 Serializable 或用 readOnly=true |

## 五、Executor 类型

| 类型 | 特点 | 适用 |
|------|------|------|
| SimpleExecutor | 每次执行新建 PreparedStatement，用完关闭 | 默认，通用 |
| ReuseExecutor | 缓存 PreparedStatement（按 SQL 为 key） | 大量重复 SQL |
| BatchExecutor | addBatch + executeBatch | 批量插入/更新 |
| CachingExecutor | 装饰器模式，加一级/二级缓存层 | 有缓存需求时包装上面三种 |

## 六、Spring 集成要点

- `MapperScannerConfigurer` / `@MapperScan` 扫描接口 → 为每个 Mapper 接口生成代理。
- `SqlSessionTemplate`（线程安全的 SqlSession 代理）→ 内部根据事务管理器决定每次新建或复用 SqlSession。
- Spring `@Transactional` 管理事务 → SqlSession 生命周期与事务绑定 → 一级缓存在同一事务内有效。
