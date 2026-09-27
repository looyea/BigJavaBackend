# 课后作业：动态 SQL、resultMap 与插件原理

## 作业 1：动态 SQL 实战（30分）

场景：电商后台商品搜索接口，支持多条件组合查询。

要求：
1. 写一个 Mapper XML：按名称模糊、分类精确、价格区间、状态列表(IN)、排序字段（白名单校验防注入）动态拼接查询。
2. 用 `<foreach>` 实现批量 upsert：`INSERT INTO products (...) VALUES (...), (...) ON DUPLICATE KEY UPDATE stock = VALUES(stock)`。
3. 用 `<bind>` 实现 LIKE 左右模糊：`<bind name="pattern" value="'%' + keyword + '%'"/>` + `LIKE #{pattern}`。
4. 讨论：为什么 `<if test="status != ''">` 在 status 为 Integer 0 时判断失败？给出修复方案。

## 作业 2：resultMap 关联映射（35分）

场景：User → Order → OrderItem 三层关联。

要求：
1. 用 resultMap 嵌套结果（JOIN 一次查出）实现：查用户时带出最近 5 笔订单和每笔订单的商品条目。
2. 用 resultMap 嵌套查询实现同样效果，观察日志中的 SQL 次数（N+1 现象）。
3. 开启 lazyLoading，验证只在调用 `user.getOrders()` 时才触发第二次查询。
4. 讨论：列表页只需"用户名+订单数"时，用 resultMap 还是直接 `COUNT(*)` 投影？性能差多少？

## 作业 3：手写 MyBatis 插件（35分）

要求：实现以下两个简单插件：
1. **SQL 耗时打印插件**：拦截 Executor.query/update，记录执行时间，超过 100ms 的 SQL 打印 WARN 日志（含完整 SQL + 参数）。
2. **数据脱敏插件**：拦截 ResultSetHandler.handleResultSets，遍历返回对象列表，对 name/phone/idCard 字段做掩码处理（通过注解 @Sensitive 标记）。
3. 注册插件到 mybatis-config.xml `<plugins>` 中。
4. 验证：两个插件同时生效时观察执行顺序，确认"最后注册的先执行"。
