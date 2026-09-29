# REST 设计、全局异常与统一返回

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能设计符合资源语义、幂等、可版本演进的 REST API；用 `@RestControllerAdvice` 建立分层的全局异常处理与统一错误契约；理解 RFC 7807 Problem Details 并在 Spring 6 里落地。

## 一、REST 的资源建模：URL 是名词，动作是 HTTP 动词

好 API 的第一原则：**面向资源**。用名词复数表达集合，用 HTTP 方法表达操作，别把动词写进路径。

| 语义 | 反例 | 正例 |
| --- | --- | --- |
| 查询订单列表 | `GET /getOrderList` | `GET /orders` |
| 查单个订单 | `GET /getOrder?id=1` | `GET /orders/{id}` |
| 创建 | `POST /addOrder` | `POST /orders` |
| 全量更新 | `POST /updateOrder` | `PUT /orders/{id}` |
| 部分更新 | `PUT` 塞部分字段 | `PATCH /orders/{id}` |
| 删除 | `GET /delOrder` | `DELETE /orders/{id}` |
| 非 CRUD 动作（下单/退款） | — | `POST /orders/{id}/refunds`（把动作建成子资源） |

**状态码要语义正确**（最常被滥用的部分）：200 查询/更新成功、201 创建（带 `Location` 头）、204 删除/无内容、400 参数错、401 未认证、403 无权限、404 资源不存在、409 冲突（如重复提交/乐观锁失败）、422 语义校验失败、5xx 服务端错。**别把一切错误都返回 200 + body 里 code**。

## 二、幂等、并发与版本演进

- **幂等**：`GET/PUT/DELETE` 天然幂等，`POST` 不幂等。支付/下单等重复提交高危操作要用**幂等键**（客户端生成 `Idempotency-Key` 头，服务端去重表/Redis SETNX + TTL），呼应金融"防重复扣款"。
- **乐观并发**：更新用 `ETag`/`version` 字段，`If-Match` 不匹配返回 412/409，避免丢失更新。
- **版本化**：URI 版本（`/v1/orders`，最直接）、请求头版本（`Api-Version`，更 REST 纯粹）、媒体类型版本。团队经验：**对外 API 用 URI 大版本 + 契约兼容的小版本演进**（加字段可选、不删不改义），破坏性变更才升主版本。

## 三、全局异常处理：@RestControllerAdvice 分层

`@ExceptionHandler` 散落在每个 Controller 是不可维护的。用 `@RestControllerAdvice` 集中，按"具体异常优先"匹配：

```java
// 例子目的：分层全局异常处理——越具体越先声明，末尾必有 Throwable 兜底不泄堆栈
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)   // @RequestBody 校验失败（比 Throwable 更具体，先声明）
    ResponseEntity<ProblemDetail> handleValid(MethodArgumentNotValidException e) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(BAD_REQUEST, "参数校验失败"); // RFC 7807 标准错误体
        pd.setProperty("errors", collect(e.getBindingResult()));  // 字段级错误明细，供前端逐栏提示
        return ResponseEntity.badRequest().body(pd);             // 正确用法：返回真实 400，而非 200+body.code
    }
    @ExceptionHandler(BusinessException.class)                 // 领域/业务异常→映射语义错误码
    ProblemDetail handleBiz(BusinessException e) { ... }
    @ExceptionHandler(Throwable.class)                         // 兜底：必须有一个，接住所有未处理异常
    ProblemDetail handleOther(Throwable e) { log.error("unhandled", e); ... } // 对内记 traceId，对外不暴露堆栈/SQL
    // 错误用法：没有 Throwable 兜底→ 未知异常回退到默认白页/泄露堆栈（安全隐患）
    // 错误用法：把 e.getMessage()/堆栈直接返回给客户端→ 泄露 SQL/内部结构
}
```

**分层原则**：越具体的异常处理器越先声明；一定要有一个 `Throwable` 兜底，**对外不暴露堆栈/SQL**（安全），对内记 traceId 关联日志。

## 四、统一返回：数据用 Result，错误用 Problem Details

- **成功响应**：多数团队用 `ResponseBodyAdvice` 统一包 `{code,success,data,traceId}`（见 s1-2）。
- **错误响应**：Spring 6 / Boot 3 原生支持 **RFC 7807 `ProblemDetail`**——标准错误体（`type/title/status/detail/instance` + 扩展属性）。对外优先用这个标准契约，跨语言/网关可机器识别，比自造错误码更规范。

一个务实的取舍：内部微服务可宽松用自研 `Result`；**对外开放 API 优先 ProblemDetail + 语义化 HTTP 状态码**，别再让 HTTP 状态全 200、错误全靠 body.code——那会让网关、监控、客户端重试策略全部失灵。

## 五、动手验证

1. 建 `@RestControllerAdvice` 分别处理：校验异常(400)、业务异常(4xx 语义码)、兜底(500 不含堆栈)，用非法/正常/抛异常三种请求验证响应结构。
2. 给创建接口实现 `Idempotency-Key`：同一 key 并发请求两次，验证只落一条、第二次返回首次结果（幂等）。
3. 用 `ProblemDetail` 返回一个 422 校验错误，观察标准字段 + 自定义 `errors` 扩展。

## 六、常见线上问题

| 现象 | 根因 |
| --- | --- |
| 网关/监控统计不出错误率 | 所有响应都 200，错误藏在 body.code |
| 前端拿不到字段级校验错误 | 没分别处理 `MethodArgumentNotValidException`/`BindException` |
| 异常响应泄露 SQL/堆栈 | 兜底 handler 把 `exception.getMessage()`/trace 直接返回 |
| 重复提交产生两笔支付 | POST 无幂等键 |
| 升级接口把老客户端打挂 | 删/改字段而非新增可选，破坏向后兼容 |

## 七、关联技术栈

- **异常/返回**：`@RestControllerAdvice`、`@ExceptionHandler`、`ProblemDetail`（RFC 7807）、`ResponseBodyAdvice`
- **校验**：JSR-380、`@Valid`、`BindingResult`（见 s1-2）
- **规范**：OpenAPI/Swagger、语义化 HTTP 状态码、幂等键、ETag
- **安全**：错误信息脱敏、401/403 与 Spring Security 协同（`AuthenticationEntryPoint`）
- **分布式**：幂等与最终一致、分布式锁（见分布式系统分区）
