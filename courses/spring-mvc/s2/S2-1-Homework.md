# 作业题 · REST 设计、全局异常与统一返回

## 作业 1：把"动词 API"重构成资源 API（必做）

给一组反例接口（`/getUser`、`/createOrder`、`/cancelOrder?ids=1,2`、`/updateProductPrice`），重写成 RESTful 设计：

- 明确每个的 HTTP 方法、路径、状态码（含创建 201+Location、删除 204、无权限 403）
- "取消订单"这类非 CRUD 动作如何建成子资源（`POST /orders/{id}/cancellations`）

**产出**：一张"反例 → 正例 + 状态码语义"对照表。

## 作业 2：分层全局异常处理（必做，本节核心）

实现 `@RestControllerAdvice`，覆盖四类并验证响应结构统一、状态码语义正确：

1. `MethodArgumentNotValidException` / `BindException` → 400 + 字段级 errors 明细
2. 自定义 `BusinessException`（带错误码）→ 映射到合适 4xx
3. `HttpMessageNotReadableException`（坏 JSON）→ 400
4. `Throwable` 兜底 → 500，**不含堆栈**、含 traceId

**验收标准**：非法/正常/内部异常三种请求，错误体结构一致且不泄露内部信息；traceId 能在日志里检索到完整堆栈。

## 作业 3：幂等键防重复下单（必做）

给 `POST /orders` 实现 `Idempotency-Key` 幂等：

- 拦截器/AOP 读取头 → Redis `SETNX key TTL` + 结果缓存
- 并发同一 key 两次：只创建一个订单，第二次返回首次结果
- 讨论：处理中途失败时该 key 的状态如何回收（避免"卡住不重试"）

## 作业 4：版本演进策略（选做，架构师向）

为一个已被多方接入的电商开放 API 设计版本演进方案：URI 大版本 + 兼容性小版本规则（只增可选字段、不删不改语义），制定"弃用通知 + 双版本并行 + 下线时间"的治理流程，并用 `ProblemDetail` 定义统一的 4xx 契约给接入方。

## 作业 5：乐观并发与冲突（选做，架构师向）

给"电力 tariffs 配置"更新接口加 ETag/`version`：并发编辑时 `If-Match` 不匹配返回 412/409，设计冲突响应体告知客户端"当前版本 vs 提交版本"，并说明与"最后写入胜出"策略在高并发金融参数场景下的取舍。
