# 反序列化、越权与业务逻辑漏洞

> 本节难度：★★★★☆
> 本节重要性：★★★★★
> 学习产出：理解 Java 反序列化为何沦为 RCE 重灾区并给出安全替代（白名单/序列化格式升级）；系统掌握水平越权与垂直越权的检测点与统一拦截方案；能从"业务分支被薅"的角度审视支付、库存、优惠券等逻辑漏洞的设计期防线。

## 一、反序列化：把不可信字节流当代码执行

Java 原生 `ObjectInputStream.readObject()` 会依据流中的类元数据**重建对象并调用其方法链**，若 classpath 上存在可利用的"gadget chain"（如 commons-collections），攻击者构造的恶意流即可在反序列化瞬间触发任意代码执行（RCE）。

```java
// 目的：认清"信任边界"——反序列化的输入来自哪里，决定它危不危险
// 反例：直接 readObject 网络/Cookie/消息里来的字节流 ❌
Object o = new ObjectInputStream(socketIn).readObject();  // 结果：命中 gadget → RCE，无需业务漏洞
// 正解一：换格式——用 JSON/Protobuf 等"数据格式"而非"对象重建"，不触发任意类实例化
Order order = objectMapper.readValue(json, Order.class);   // 只映射到指定类型，无 readObject 魔法
// 正解二：必须用原生序列化时上"反序列化白名单"（JEP 290 / ObjectInputFilter）
ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
    "com.acme.dto.Order;com.acme.dto.User;!*");            // 只放行已知安全类，其余 !* 全拒
objIn.setObjectInputFilter(filter);                         // 说明：!* 是默认拒绝，漏配等于没设
```

- 治理动作：升级/移除有 gadget 的依赖、关闭调试端点、对 RMI/JNDI 反序列化入口做网络隔离；记住 **JNDI 注入**（log4j 类）是同一信任问题的远程加载变体。

## 二、越权：认证解决了"你是谁"，没解决"这数据是不是你的"

```text
图目的：两类越权的分界与各自检测点
水平越权（同权限层级，跨用户数据）
  症状：/order/detail?id=1001 换成 1002 就能看到别人的单
  根因：只校验"登录了"，没校验"这条资源属于当前用户"
垂直越权（低权限访问高权限功能）
  症状：普通用户直接 POST /admin/user/delete 执行了管理员操作
  根因：只在菜单/按钮藏了入口，接口本身没做角色鉴权
```

```java
// 目的：水平越权的标准兜底——资源归属校验下推到查询条件
@GetMapping("/orders/{id}")
public Order detail(@PathVariable Long id, @AuthenticationPrincipal User me) {
    return orderRepo.findByIdAndOwnerId(id, me.getId())    // ✅ 查询即带归属，越权自然查不到
        .orElseThrow(() -> new NotFoundException());       // 说明：返回 404 而非 403，不泄漏"存在性"
}
// 反例：先 findById(id) 再 if(!o.getUserId().equals(me.getId())) ... ❌
//        一旦某处忘写这个 if 就破防；正解是把归属做进数据访问层的统一条件
```

- 统一拦截优于"每个接口自觉写 if"：MyBatis 拦截器给查询注入 `owner_id/tenant_id` 条件（数据权限），与 [认证授权模型与权限设计](../../spring-security/s1/S1-2-Lesson.md) 的下推思路一致；垂直越权交给链上 `AuthorizationFilter` + 方法注解双层。
- 检测纪律：**每个"按 id 读/改"的接口都要能回答"凭什么是你这条"**，审计时全局搜 `findById(` 看有无归属约束。

## 三、业务逻辑漏洞：技术防线之外，规则也会被薅

这类漏洞往往没有特征码，扫不出来，纯靠设计期审视"攻击者会怎么滥用这条流程"：

```text
图目的：常见被薅的业务分支与对应不变式（invariant）
支付：改金额/数量为负或 0、复用支付回调、并发重复核销  → 金额服务端重算、幂等校验、回调验签去重
库存：超卖（读-改-写竞态）、负数扣减              → DB 条件扣减 stock>=n、乐观锁/唯一流水幂等
优惠券：同一券并发用两次、叠加绕过互斥规则        → 券状态机 + 原子核销 + 叠加规则服务端裁决
验证码/短信：无限重发、万能码、校验可跳过          → 频率限制、一次性、服务端记录已验证态
```

```java
// 目的：并发"用券"的原子核销——用带条件的 UPDATE 把幂等压到 DB
int rows = couponMapper.use(couponId, orderNo);   // UPDATE coupon SET status='USED',used_by=#{} 
                                                    // WHERE id=#{couponId} AND status='UNUSED'
if (rows == 0) throw new BizException("券已核销"); // 结果：并发第二个请求 affected rows=0，被拒
// 反例：先 select 判断 status 再 update ❌ 两个请求都读到 UNUSED → 同券花两次（TOCTOU 竞态）
```

- 心法：把每条业务规则翻译成**数据库/代码必须恒成立的不变式**，并用"服务端为准 + 原子操作 + 幂等键"三件套守住；对照 [重复请求的四类解法](../../idempotent/s1/S1-1-Lesson.md)。

## 四、关联课程

注入侧同源问题在 [注入原理与预处理防御](S1-1-Lesson.md)；越权的鉴权框架落地在 [认证授权模型与权限设计](../../spring-security/s1/S1-2-Lesson.md)；幂等与并发核销在 [重复请求的四类解法](../../idempotent/s1/S1-1-Lesson.md)；库存与下单业务在 [下单链路与库存扣减](../../ecommerce/s1/S1-1-Lesson.md)。
