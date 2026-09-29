# SCA 落地与自建/开源选型边界（关联）

> 本节难度：★★★☆☆
> 重要程度：★★★★☆
> 学习产出：能把"要不要用 Spring Cloud Alibaba、还是留在 Netflix 栈、还是自建中间件"从技术信仰拉回到**成本、合规、团队能力**的工程决策。先认清 **Spring Cloud Netflix 的现状**：Hystrix 已停止维护、Eureka/Ribbon/Zuul 1.x 进入维护模式，官方栈转向 Spring Cloud Gateway（替 Zuul）、Spring Cloud LoadBalancer（替 Ribbon）、Spring Cloud CircuitBreaker + Resilience4j（替 Hystrix），Spring Sleuth 也并入 Micrometer Tracing——继续抱旧 Netflix 件等于背技术债。**SCA 的一体化优势**是 Nacos（注册+配置）、Sentinel（流控/熔断）、Seata（分布式事务）、Dubbo（调用）出自同一体系、与阿里生态和国产云亲和，落地时**用 SCA BOM 把 Boot/Cloud/Alibaba 三套版本锁在官方兼容矩阵上**，避免混合栈运行期类冲突。**自建 vs 开源的 ROI 边界**：自研注册中心/配置中心/限流框架看似可控，但要养专门团队、造监控与故障排查、扛稳定性事故，除非有强定制/极致规模/合规隔离诉求，多数公司 **ROI 为负**；成熟开源组件胜在社区、生态、可招聘、文档全，代价是必须吃透运维。**国产化（信创）与运维成本是落地的关键变量**：国产栈（Nacos/Sentinel/Seata/Dubbo 均源自国内）在信创合规、与国产中间件/云适配上更顺，中文社区与招聘也更易；反之全球化团队、跨云一致性诉求下可能倾向国际主流栈。决策矩阵：阿里系/国内团队优先 SCA；已在 Netflix 老栈的先评估迁移成本、用 Gateway/LoadBalancer/Resilience4j 替换停滞件；只有确有强定制能力与诉求的超大厂才考虑部分自建。识破"无脑追新栈不核算迁移成本""把选型当信仰而非权衡""BOM 版本不对齐导致混合栈冲突""小团队硬上自研中间件拖垮业务迭代"等坑——电力/政务信创项目、金融自主可控、电商快速交付，各自的最优解并不相同。

## 一、版本对齐：落地第一道坎

```yaml
# 目的：用 BOM 把 Spring Boot/Cloud/Alibaba 三套版本锁在兼容矩阵上, 避免混合栈冲突
project:
  dependencyManagement:                # 说明：只在此集中锁版本, 子模块不再各自写 version
    imports:
      - groupId: org.springframework.boot     # 说明：先定 Boot 主版本
        artifactId: spring-boot-dependencies
        version: 3.2.x                         # 结果：以 Boot 为锚, 再据兼容矩阵选 Cloud 与 Alibaba
      - groupId: org.springframework.cloud     # 说明：Cloud 用 release train 命名
        artifactId: spring-cloud-dependencies
        version: 2023.0.x                       # 结果：Cloud release train 与 Boot 主版本必须配对
      - groupId: com.alibaba.cloud              # 说明：SCA 把 Nacos/Sentinel/Seata/Dubbo 版本一起纳管
        artifactId: spring-cloud-alibaba-dependencies
        version: 2023.0.x                       # 反例：三者 version 各拍脑袋 ❌ 运行期 Nacos/Sentinel/Seata starter 类冲突 ❌
```

## 二、Netflix 体系现状与替代

```text
图目的：老 Spring Cloud Netflix 件大多已停滞, 新项目别再默认选它
Hystrix(停维护) → Spring Cloud CircuitBreaker + Resilience4j
Ribbon(维护模式) → Spring Cloud LoadBalancer
Zuul 1.x(维护模式) → Spring Cloud Gateway
Eureka(AP/停滞) → Nacos / Consul
Sleuth → Micrometer Tracing
含义: "留在 Netflix 栈"往往意味着背着不再演进的组件, 迁移迟早要做
```

## 三、自建 vs 开源的 ROI

```text
图目的：什么才值得自建, 别把成本算漏
自建(注册/配置/限流/事务框架): 需专职团队 + 监控告警 + 故障复盘 + 稳定性事故风险
收益: 仅在强定制诉求、极致规模、合规物理隔离时才可能为正 ROI
开源成熟件: 社区/生态/可招聘/文档全, 代价是必须吃透运维(鉴权/HA/规则持久化)
决策: 多数公司用成熟开源, 把自研精力留给真正的业务护城河
```

## 四、国产化与运维成本底线

- **选型=权衡不是信仰**：用"团队熟悉度、招聘、监控运维成本、合规（信创/自主可控）、生态适配"打分，而非追新或守旧。
- **先算迁移成本**：从 Netflix 迁到 SCA/新栈要评估改动量、双栈过渡期风险，别"为换而换"。
- **版本用 BOM 锁死**：Boot/Cloud/Alibaba 兼容矩阵对齐，避免混合栈类冲突把选型决策变成线上事故。

## 五、关联课程

组件全景地图承接 [微服务组件选型地图](./S1-1-Lesson.md)；三件套装配与联动细节见 [Nacos + Sentinel + Seata 组件协同](./S1-2-Lesson.md)。
