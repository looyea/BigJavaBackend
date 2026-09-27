# 课后作业：MyBatis-Plus 工程提效

## 作业 1：CRUD + 条件构造器实战（30分）

场景：商品管理模块，字段含 id/name/price/category/status/createTime/version/deleted。

要求：
1. 用 LambdaQueryWrapper 实现：查"分类=电子、价格 100~500、status=1、按 createTime 倒序前 20 条"。
2. 用 UpdateWrapper 批量把"category=服装 且 price < 50"的商品 status 改为 2。
3. 用 `wrapper.apply` 实现"创建时间在某月份"条件：`date_format(create_time,'%Y-%m') = {0}`，说明为什么用 `{0}` 而不是 `${}`。
4. 用 IService.saveBatch 导入 10 万条商品数据，设 batchSize=5000，观察耗时；对比 `<foreach>` 多值 INSERT 方案。

## 作业 2：插件链配置（35分）

要求：在一个 Spring Boot 项目中同时配置 MP 的以下插件并验证效果：
1. **分页插件**：PaginationInnerInterceptor，maxLimit=200。
2. **乐观锁插件**：优化 Account 表扣款——先 selectById → 修改 balance → updateById，验证 version 递增和并发冲突返回 0。
3. **逻辑删除**：Product 表 @TableLogic deleted 字段；验证 deleteById 变 UPDATE、自动查询过滤已删除数据。
4. **自动填充**：MetaObjectHandler 实现 createTime/updateTime 自动填充当前时间。
5. 写出插件注册顺序及"多插件执行顺序影响"的分析。

## 作业 3：工程规范与边界分析（35分）

要求：
1. 团队规范制定：列出"什么情况用 MP BaseMapper / 什么情况手写 XML"的决策清单。
2. 用代码生成器为"订单表"生成 Controller/Service/Mapper/Entity，然后手动修改：加入参数校验、统一异常处理、返回值 Result<T> 包装。
3. 安全审计：检查项目中是否存在 `${}` 拼接、`last()` 接受用户输入、Wrapper 条件为空导致全表操作的隐患，给出修复方案。
4. 对比分析：MyBatis-Plus vs 原生 MyBatis vs JPA，从开发效率/SQL 控制力/学习曲线/社区维护四个维度打分并总结适用场景。
