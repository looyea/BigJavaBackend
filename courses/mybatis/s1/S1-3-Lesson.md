# MyBatis-Plus 工程提效

> 本节难度：★★☆☆☆
> 本节重要性：★★★★☆
> 学习产出：掌握 MyBatis-Plus 的 BaseMapper 泛型 CRUD、条件构造器 Wrapper、分页/乐观锁/逻辑删除插件，以及代码生成器与 Active Record 模式的使用边界。

## 一、MyBatis-Plus 定位

MyBatis-Plus（MP）是 MyBatis 的增强工具——**只做增强不做改变**：在不修改 MyBatis 原生行为的前提下，提供通用 CRUD、条件构造器、分页、乐观锁、逻辑删除等开箱即用能力。

```flow
目的：展示 MP 在 MyBatis 上的增强层次
原生 MyBatis: SqlSession + Mapper + XML
MyBatis-Plus 增强: BaseMapper<T> + Wrapper + IService<T> + 插件链(分页/乐观锁/逻辑删除/多租户)
```

## 二、BaseMapper 与 IService

### 2.1 BaseMapper 泛型 CRUD

```java
// 目的：继承 BaseMapper 即可获得单表 CRUD，无需写任何 XML
// 错误用法: 复杂多表 JOIN 查询也硬塞 BaseMapper → 不支持，应回退手写 SQL
// 反例: 不标 @TableName 且驼峰转下划线关闭 → 表名/列名映射错误
@Mapper
public interface UserMapper extends BaseMapper<User> {
    // 自带：insert/deleteById/updateById/selectById/selectList/selectPage...
}
// 结果：一行代码 `userMapper.selectList(new LambdaQueryWrapper<User>().eq(User::getAge, 18))` 即查询
```

### 2.2 IService 批量与链式

```java
// 目的：IService 封装 Service 层通用方法
// 错误用法: saveBatch 设 batchSize 为默认 1000 但 MySQL max_allowed_packet 不够
// 反例: update(Wapper) 不设条件 → 全表更新
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements IUserService {
    // 自带：saveBatch / updateBatchById / removeByIds / list / page / lambdaQuery()...
}
```

## 三、条件构造器 Wrapper

| 类型 | 用法 | 特点 |
|------|------|------|
| QueryWrapper | `eq("age", 18).like("name", "J")` | 列名字符串 |
| LambdaQueryWrapper | `eq(User::getAge, 18).like(User::getName, "J")` | 类型安全、编译期检查 |
| UpdateWrapper | 同上 + `set("status", 1)` | 更新字段指定 |
| ChainWrappers | `chainQuery().eq(...).list()` | 链式语法糖 |

```java
// 目的：LambdaQueryWrapper 防列名拼错 + 重构安全
// 结果：SELECT * FROM user WHERE age > 18 AND name LIKE '%Tom%' ORDER BY create_time DESC LIMIT 10
List<User> list = userMapper.selectList(
    new LambdaQueryWrapper<User>()
        .gt(User::getAge, 18)
        .like(User::getName, "Tom")
        .orderByDesc(User::getCreateTime)
        .last("LIMIT 10")  // 说明：last 直接拼 SQL 尾部，慎用
);
```

## 四、内置插件

### 4.1 分页插件

```java
// 目的：MybatisPlusInterceptor + PaginationInnerInterceptor 替代 PageHelper
// 错误用法: 不设 maxLimit → 前端传 pageSize=100000 拖死 DB
// 反例: 分页 + 嵌套 select 导致 N+1 的 count 查询
MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
PaginationInnerInterceptor page = new PaginationInnerInterceptor(DbType.MYSQL);
page.setMaxLimit(500L);  // 结果：单页最大 500 条
interceptor.addInnerInterceptor(page);

// 使用：
IPage<User> result = userMapper.selectPage(new Page<>(1, 20),
    new LambdaQueryWrapper<User>().eq(User::getStatus, 1));
// 结果：自动执行 count SQL + LIMIT 0, 20
```

### 4.2 乐观锁插件

```java
// 目的：@Version 字段自动加入 UPDATE WHERE version = ? 条件
// 错误用法: 不注册 OptimisticLockerInnerInterceptor → @Version 无效
// 反例: 先查询再手动 set version 再 updateById → 绕过了乐观锁（应直接 updateById）
@Entity
public class Account {
    @Version  // 结果：每次 updateById 自动追加 WHERE version = oldValue 并 set version = newValue
    private Integer version;
}
```

### 4.3 逻辑删除

```java
// 目的：@TableLogic 标记删除字段 → deleteById 变 UPDATE SET deleted=1
// 错误用法: 逻辑删除字段无默认值 → INSERT 时 deleted=NULL 查询条件 deleted=0 漏掉
// 反例: 查询时手写 deleted=0 → 全局已配 logic-not-delete-value 就不要再手写
@TableLogic  // 结果：所有自动生成的 SELECT 加 WHERE deleted=0
private Integer deleted;
```

### 4.4 多租户插件

- TenantLineInnerInterceptor 自动在每条 SQL 的 WHERE 追加 `tenant_id = ?`。
- ThreadLocal / SecurityContext 提供当前租户 ID。
- 配置忽略表：`tenantHandler.doTableFilter(tableName)` 返回 true 则跳过。

## 五、代码生成器

```java
// 目的：AutoGenerator 一键生成 Controller/Service/Mapper/Entity 骨架
// 错误用法: 生成的代码不 review 直接上生产 → 缺少入参校验/异常处理
// 说明：3.5.x 起 Velocity 模板可选，支持 Freemarker/Beetl
new AutoGenerator().globalConfig(...)
    .dataSource(...)
    .generate();  // 结果：输出完整分层代码骨架
```

## 六、使用边界与注意事项

| 适合 MP | 回退手写 XML |
|---------|-------------|
| 单表 CRUD / 简单条件查询 | 多表 JOIN / 子查询 / 窗口函数 |
| 分页 / 逻辑删除 / 乐观锁 标准模式 | 存储过程 / 批量 MERGE |
| 快速原型验证 | 极致 SQL 调优场景 |

- `wrapper.apply("date_format(create_time,'%Y-%m')={0}", month)`：自定义 SQL 片段用 `{0}` 防注入。
- `@InterceptorIgnore`：对特定 Mapper 方法跳过某插件（如不需要多租户条件）。
- `Active Record 模式`：Entity 继承 Model<T> → `user.insert()` / `user.selectById()`；不推荐团队项目使用（Service 层职责下沉到实体）。
