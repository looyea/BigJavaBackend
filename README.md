# 大Java后端 · Big Java Backend ☕

一个**可运行、可打卡、可扩展**的 Java 后端「打怪升级」学习平台。**运行时零第三方依赖**——原生 ES Module + 自写
Markdown 渲染器，无 UI 框架、无后端进程；开发 / 构建走 **Vite**（`npm run dev` / `npm run build`），产物为纯静态资源，
**彻底脱离 Python**；多套暗色/护眼主题。专为「想按资深架构师的标准，系统刷完 Java 后端技术栈，并在本地边学边往 GitHub 提交」的你而做。

覆盖方向：Java 语言核心与进阶 · Spring 全家桶 / Jakarta EE / GraalVM · 计算机与算法基础（数据结构算法 · 计算机网络 · Netty）· 数据库与缓存 · 持久层与连接池 · 中间件 · 微服务治理 · 构建运维与 CI/CD · 测试与质量 · 性能调优工具 · 安全 · 高并发/高可用/分布式 ID/幂等 等架构专题 · 电商 / 金融 / 电力 / SNS 行业实战（各分区完成度见第九节）。

---

## 一、整体逻辑架构

```
网页（外壳框架） → 大技术分区（15） → 课程包（86） → 阶段 → 小节（课文 + 小测 + 作业 + 面试题）
```

- **外壳框架** = `index.html` + `assets/js/*`（原生 ES Module）。框架运行时**从唯一的「骨架事实源」 `assets/js/data.js`
  读取**整棵目录树（分区 → 包 → 阶段 → 小节），据此渲染首页卡片、学习地图、课文、小测。**加一门课 = 在 data.js 里加一条
  + 建对应 Markdown 文件，无需改一行框架代码。** 首页按 **15 个大技术分区**自上而下分组（清单见第九节）。
- **课程内容** = 纯 Markdown，每小节固定四件套：

  ```
  courses/<包id>/<阶段id>/<阶段号>-<小节号>-{Lesson,Quiz,Homework,Interview}.md
  例：courses/data-algorithms/s1/S1-2-Lesson.md      # 数组与链表（课文）
          S1-2-Quiz.md 小测 · S1-2-Homework.md 作业 · S1-2-Interview.md 面试题
  ```

  > 【目录口径】课程包 id / 阶段 id 为小写短横线；小节**文件名编号用大写**（`S1-2-`，由 `sec.id.toUpperCase()` 生成），
  > 而站内 id、路由、进度键用小写。Windows 文件系统大小写不敏感，两者天然对齐。

- **数据源单一**：`assets/js/data.js` 是全站唯一骨架事实源，小节元组为 `[id, 标题, 一句话知识点, 难度(1-5), 重要(1-5)]`。
  《教学大纲.md》、脚手架、自检脚本都由它派生——**改骨架只改这一处**。
- **打怪升级**：不同分区 / 课程包之间**互不锁定**，可自由选择先后；**同一课程包内**阶段、小节按固定顺序、由浅入深
  **逐关解锁**——前一节小测未通过，后一节不可进入。**小测 ≥ 60 分即自动通关本小节**（无手动「通关」按钮），
  阶段内全部小节通过后自动标记该阶段完成。

## 二、环境要求

- **Node.js ≥ 18**（推荐 20+；本机 v24 直接满足）与随附的 **npm**。首次使用在项目根执行一次 `npm install`
  安装开发依赖（**仅 Vite**，约 11 个包）。
- **运行时零第三方依赖**：页面逻辑是原生 ES Module + 自写 Markdown 渲染器，不含 Vue/React 等框架；
  `node_modules` 只服务于开发与构建工具链（Vite），不进产物、不参与运行时。
- 现代浏览器（支持 ES Modules：近两年的 Chrome / Edge / Firefox 皆可）。
- **完全脱离 Python**：开发、构建、本地预览、部署全流程走 npm + Vite（`npm run dev` / `npm run build` / `npm run preview`）。
- ⚠️ 无论开发还是预览，都经 `http://` 访问（Vite 已替你起好服务器），**不要直接双击 `index.html`（`file://`）**——
  ES Module 的 `import` 与运行时 `fetch` 在 `file://` 下会被同源策略拦截。

> ⚠️ Windows PowerShell 若报「禁止运行脚本」：用 `npm.cmd` 代替 `npm`（两个 BAT 已内置 `npm.cmd`），
> 或以管理员执行 `Set-ExecutionPolicy RemoteSigned` 解锁。

## 三、安装与运行

```bash
npm install        # 首次：安装开发依赖（Vite）

npm run dev        # 开发：Vite 热更新服务   → http://localhost:5180
npm run build      # 构建：输出纯静态产物到 dist/
npm run preview    # 预览构建产物            → http://localhost:8080
npm run prod       # 一键：build 完再 preview（等价 build + preview）
```

- **开发模式**（`npm run dev`）：改任意源文件，浏览器即时热更新（HMR），无需手动刷新。
- **生产模式**（`npm run build`）：Vite 把 `index.html` + JS/CSS 打包、按内容哈希命名，输出到 `dist/`；
  构建末尾自动把运行时按需 `fetch` 的 `courses/`、`progress/` 复制进 `dist/`（见 `vite.config.js` 的 `copy-content` 插件）。
  `dist/` 即**纯静态产物**，无任何后端。

### 该打开哪个地址？（含一键 BAT）

| 命令 / 脚本 | 模式 | 浏览器访问地址 | 说明 |
| --- | --- | --- | --- |
| `npm run dev` ／ `run-dev.bat` | 开发（Vite + HMR） | **http://localhost:5180** | 日常学习 / 边写边改；BAT 会在缺依赖时自动 `npm install` |
| `npm run prod` ／ `run-prod.bat` | 生产（构建 + 预览） | **http://localhost:8080** | 先 `npm run check` 自检、再 `build`、最后 `preview` |

- **内容脚本**：`npm run check`（结构 / 小测自检）· `npm run scaffold`（补齐四件套占位）· `npm run outline`（重生成《教学大纲.md》）。
- **手机 / 另一台电脑预览**（连同一 Wi-Fi）：Vite 配置已开 `host`，起服务后用 `http://<你电脑的局域网IP>:5180` 访问（IP 用 `ipconfig` 查看）。
- **部署上线**：`npm run build` 后把 `dist/` 整目录交给 Nginx / 对象存储 / GitHub Pages / 任意 CDN；因 `base` 为相对路径，可放置于任意子路径。

## 四、学习进度与每日打卡（浏览器 + Markdown + GitHub）

- 进度**主存储 = 浏览器 `localStorage`**（键 `bjb.progress.v1`；主题键 `bjb.theme`），记录每小节最高分、是否通过、时间戳。
- 满足「**进度文件必须是 Markdown**」：`进度` 页支持 **导出 / 导入 `progress.md`**（人能读、也可直接手改）；
  仓库自带种子文件 **`progress/progress.md`**，首次打开（`localStorage` 为空）且经 HTTP 访问时会自动读取以恢复解锁状态。
- **通关与解锁**：小测得分 ≥ 60 记本小节通过并解锁下一小节；同包顺序解锁、跨包不互锁；自定义格式（非选择题）的小测提供「手动标记完成」。
- **想从零开始 / 拷给别人**：在进度页一键清空，或删掉浏览器 `localStorage`；想恢复某天的进度，则把对应 `progress.md` 导入即可。
- **纳入 Git 即得打卡记录**：把导出的 `progress.md` 提交回仓库并 `git push`，GitHub 上就会出现逐日的提交 / 贡献（绿格子）。

## 五、如何扩展课程（后续更新到哪儿）

- **加深某节**：直接编辑对应 `courses/<包>/<阶段>/Sx-y-Lesson.md`（正文）/ `-Quiz.md` / `-Homework.md` / `-Interview.md`。
- **加一节课 / 一阶段 / 一个包 / 一个分区**：**只改 `assets/js/data.js`** 这一处骨架——增补 `CATEGORIES → packages → stages → sections`。
- 然后（需 Node，走 npm 脚本）：

  ```bash
  npm run scaffold   # 按 data.js 为所有小节补齐四件套占位（幂等，只建缺失的）
  npm run outline     # 由 data.js 重新生成《教学大纲.md》
  npm run check       # 自检：包 / 小节 id 唯一、重要级与难度取值合法、小测可解析判分
  ```

- **缓存与版本交给 Vite**：构建按文件内容生成哈希名自动失效缓存，开发期 dev server 不强缓存，改完即时生效——
  **不再需要手动维护 `?v=` 版本号**（该机制已随脱离 Python 静态托管一并移除）。
- **正文详略对齐重要级**（见 `app.js` 的 `depthOf`）：5 核心精讲 → 4 重点标准 → 3 标准概览 → 2 简明速览 → 1 了解即可；
  首页卡片右上角标签按此着色（红 → 绿，越重要越红）。

### 例子程序硬性规范（`BigJavaBackend.md`「例子程序说明」）

课文 / 作业 / 面试题中出现的**每一个例子程序**都必须满足以下五条，新写与回填时逐条对照：

1. **必带注释**：例子开头注释说明「这个例子目的是什么」。
2. **行注释讲影响与结果**：关键语句后用行注释给出该语句当前产生的影响 / 输出 / 状态变化。
3. **定义必配应用**：给了定义（如 `record` 声明）就必须给出实际使用它的代码，不允许只定义不使用。
4. **逐知识点正确用例**：每个知识点 / 每种使用场景都要有对应的正确案例，并在注释中写明正确的使用结果是什么。
5. **必备错误用例**：同时给出错误用例，并用注释说明该错误会产生什么结果、抛出什么异常。

> 自检：`npm run audit-examples`（`scripts/audit-examples.mjs`）会扫描全部已写实课文 / 作业 / 面试题，按「有无例子 / 例子内是否标注错误用例 / 注释密度」输出统计，违规明细写入 `scripts/_audit.txt`。

## 六、提交到 GitHub（首次）

```bash
git init                 # 若尚未初始化
git add -A
git commit -m "feat: Big Java Backend 学习平台（Vite 驱动的纯静态框架 + 15 分区 / 86 课程包骨架）"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
# 之后每天学完：git add -A && git commit -m "day: 学了 xxx" && git push
```

## 七、技术栈

| 层 | 选型 |
| --- | --- |
| 外壳 | 原生 HTML + CSS + **JavaScript ES Modules**（无 UI 框架、运行时零第三方依赖） |
| Markdown 渲染 | 自写解析器 `assets/js/md.js`（含小测解析 `parseQuiz` / 判分 `gradeQuiz`） |
| 路由 | `location.hash` 手写路由（`app.js`）：`#/` · `#/map` · `#/progress` · `#/pkg/:id` · `#/sec/:pkg/:stage/:id[/quiz\|homework\|interview]` |
| 骨架数据源 | `assets/js/data.js`（唯一事实源，驱动首页 / 地图 / 解锁链路） |
| 课程内容 | `courses/**/*.md` 四件套（课文 / 小测 / 作业 / 面试题） |
| 进度 | `localStorage` 主 + Markdown 导入导出（`progress/progress.md`） |
| 主题 | CSS 自定义属性 ×4：深色 `dark` / 护眼 `eye` / 藏青 `navy` / 纸白 `paper`（`themes.css`） |
| 开发 / 构建 | **Vite 5**（`npm run dev` / `build` / `preview` / `prod`），构建后由自定义插件复制 courses/progress 到 dist |
| 内容工具 | Node ESM 脚本：`scaffold` / `outline` / `check`（已封装为 npm 脚本） |
| 运行 / 部署 | 开发预览用 Vite；产物 `dist/` 为纯静态资源，交付任意静态服务器（Nginx / Pages / CDN）即可 |

## 八、目录速览

```
BigJavaBackend/
├─ package.json               # npm 脚本：dev/build/preview/prod/check/scaffold/outline（devDep：Vite）
├─ vite.config.js             # Vite 配置：端口 5180/8080、相对 base、构建后复制 courses/progress 到 dist
├─ index.html                 # 唯一页面外壳：加载主题 CSS 与 ES Module 入口
├─ assets/
│  ├─ js/data.js              # ★ 唯一骨架事实源：分区 → 包 → 阶段 → 小节
│  ├─ js/app.js               # 路由 + 各视图渲染（首页 / 包 / 小节 / 小测 / 作业 / 面试题 / 地图 / 进度）
│  ├─ js/store.js             # 进度：localStorage 主 + Markdown 导入导出 + 主题
│  ├─ js/md.js                # 自写 Markdown 渲染器 + 小测解析 / 判分
│  ├─ css/main.css            # 布局与组件（含详略标签五级配色、正文 18px）
│  └─ css/themes.css          # 四套暗色 / 护眼主题变量
├─ courses/                   # 86 个课程包（内容层，纯 Markdown）
│  └─ <包id>/<阶段id>/Sx-y-{Lesson,Quiz,Homework,Interview}.md
├─ progress/progress.md       # 仓库自带进度种子（网站可导入 / 首启自动读取）
├─ scripts/                   # 内容工具（Node）：scaffold / outline / check .mjs（经 npm 脚本调用）
├─ dist/                      # npm run build 的纯静态产物（已 .gitignore）
├─ node_modules/              # 开发依赖（npm install 生成；已 .gitignore）
├─ BigJavaBackend.md          # 原始需求规格（课程设计初衷）
├─ 教学大纲.md                # 由 npm run outline 从 data.js 生成的全课程大纲
├─ run-dev.bat                # 开发：缺依赖自动 npm install → npm run dev（:5180）
└─ run-prod.bat               # 生产：npm run check → build → preview（:8080）
```

## 九、内容完成度说明

> 平台骨架已全线贯通：**15 个大技术分区 / 86 个课程包 / 300 个小节**，每小节均已生成 **课文 + 小测 + 作业 + 面试题**
> 四件套（共 1200 个 Markdown 文件）；结构、解锁链路与小测判分契约经 `scripts/check.mjs` 自检通过。
>
> **正文写实进度：300 / 300 节全部完成（四件套同步写实）。** 已满配包：「**计算机与算法基础**」分区 3 包（数据结构与算法 17、
> 计算机网络 14、Netty 9）、`java-basics` 11、`java-modern` 4、`juc` 9、`jvm` 7、
> `mysql` 7、`redis` 5、`lettuce` 3、`redisson` 4、`caffeine` 2、
> `spring-boot` 8、`spring-core` 4、`spring-mvc` 4、`spring-ai` 4、`jakarta-ee` 2、`graalvm` 1、
> 「**分布式系统**」`dist-theory` 6、`dist-data` 4；
> 「**架构设计**」`design-patterns` 5、`ddd-architecture` 5、`system-design` 6；
> 「**数据库与缓存**」`postgresql` 2、`tidb` 2、`minio` 1、`memcached` 1；
> 「**持久层与连接池**」`mybatis` 3、`spring-data-jpa` 2、`druid` 1、`hikaricp` 1；
> 「**中间件**」`rocketmq` 3、`rabbitmq` 1、`kafka` 2；
> 「**定时与调度**」`job-scheduling` 2；
> 「**微服务治理**」`spring-cloud-alibaba` 1、`nacos` 2、`gateway` 2、`openfeign` 1、`sentinel` 2、`seata` 2、`rpc` 2；
> 「**可观测性**」`opentelemetry` 4、`prometheus` 4、`grafana` 2、`skywalking` 3、`istio` 4；
> 「**服务网格与数据分片**」`linkerd` 2、`shardingsphere` 2；
> 「**构建、运维与云原生**」`maven` 5、`gradle` 4、`docker` 6、`kubernetes` 7、`gitlab-ci` 3、`github-actions` 3、`argocd` 3、`elk` 3、`loki` 3、`linux-shell` 2；
> 「**测试**」`junit` 4、`mockito` 4、`test-containers` 1、`jmeter` 3、`gatling` 3、`sonar` 1、`chaos` 1；
> 「**性能调优工具**」`arthas` 2、`async-profiler` 1、`jol` 1；
> 「**安全**」`spring-security` 2、`shiro` 1、`oauth2` 3、`jwt` 3、`web-defense` 3、`data-security` 2；
> 「**其他补充**」`elasticsearch` 3、`temporal` 1、`flink` 4、`kafka-streams` 2；
> 「**专题**」`high-concurrency` 4、`high-availability` 3、`idempotent` 2、`ecommerce` 4、`fintech` 4、`power-grid` 2、`media-sns` 2。
> 至此全部 86 个课程包 / 300 个小节的「课文 + 小测 + 作业 + 面试题」四件套正文写实完成。
>
> **例子程序规范回填**：按上文五条硬性规范对已写实课文做了逐包审计与回填（补目的注释、行注释影响 / 结果、
> 正确用例与错误用例及异常说明），已覆盖全部 300 个写实节。`node scripts/audit-examples.mjs` 复核：**课文与面试题的【A】无例子 / 【B】缺错误用例 / 【C】注释密度<35% 三项均为 0**；`node scripts/check.mjs` 全部小测自动判分满分 100 通过。本 README 随每轮任务结束更新。

- **15 个分区一览**（首页分组顺序，与 `data.js` 的 `CATEGORIES` 一致）：

| # | 大技术分区 | 课程包 | 小节 |
| --- | --- | --- | --- |
| 1 | 计算机与算法基础 | 3 | 40 |
| 2 | Java 基础语言 | 4 | 31 |
| 3 | 相关框架 | 6 | 23 |
| 4 | 分布式系统 | 2 | 10 |
| 5 | 架构设计与方法论 | 3 | 16 |
| 6 | 数据库与缓存 | 9 | 27 |
| 7 | 持久层与连接池 | 4 | 7 |
| 8 | 中间件 | 4 | 8 |
| 9 | 微服务治理 | 14 | 33 |
| 10 | 构建、运维与 CI/CD | 10 | 39 |
| 11 | 测试 | 7 | 17 |
| 12 | 性能调优工具 | 3 | 4 |
| 13 | 安全 | 6 | 14 |
| 14 | 其他补充 | 4 | 10 |
| 15 | 专题 | 7 | 21 |
| | **合计 15 分区** | **86** | **300** |

- **详略分档**：每个包按 `importance(1-5)` 落到「核心精讲 / 重点标准 / 标准概览 / 简明速览 / 了解即可」五档；首页卡片标签
  红 → 绿着色区分，重要级越高讲解越深入，越要求源码、场景与行业实践。
- **拆分原则**：凡**多门独立产品**（如 Maven 与 Gradle、Docker 与 Kubernetes、JUnit 与 Mockito、Lettuce 与 Redisson、
  ELK 与 Loki、OAuth 2.0 与 JWT 等）各自独立成包、各占一张首页卡片，并在包内互设「关联 / 对比 / 选型」小节承载共同部分；
  同族或组合式主题（MyBatis 与 MyBatis-Plus、Spring Cloud Alibaba 组合总览、RPC 原理、Web 攻防、数据加密与签名）保持合包。

> 技术事实若涉版本演进，请一律以各技术**官方文档 / 权威规范**为准——本课程反复提醒：警惕过时教程与 AI 幻觉。
