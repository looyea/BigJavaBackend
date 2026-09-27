# 大Java后端 · Big Java Backend ☕

一个**可运行、可打卡、可扩展**的 Java 后端「打怪升级」学习平台。**零依赖纯静态**——原生 ES Module + 自写
Markdown 渲染器，无框架、无构建、无后端进程；多套暗色/护眼主题。专为「想按资深架构师的标准，系统刷完 Java
后端技术栈，并在本地边学边往 GitHub 提交」的你而做。

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

- **只需一个静态 HTTP 服务器**：Python 3（自带 `http.server`）或 Node（`npx http-server`）任一即可。
  **本项目无 npm 依赖、无安装、无构建**——站点就是源码目录本身。
- 现代浏览器（支持 ES Modules：近两年的 Chrome / Edge / Firefox 皆可）。
- ⚠️ **必须经 `http://` 访问，不能直接双击 `index.html`（`file://`）**：ES Module 的 `import` 与运行时 `fetch`
  在 `file://` 下会被浏览器同源策略拦截。
- （可选）**作者工具** `scripts/*.mjs` 需要 **Node ≥ 18**，仅在你增删课程内容时使用，运行网站本身不需要。

> ⚠️ Windows PowerShell 若报「禁止运行脚本」：直接调用 `python` / 用 `npm.cmd`，或以管理员执行
> `Set-ExecutionPolicy RemoteSigned` 解锁。

## 三、安装与运行

无需安装。在项目根目录任选一种起一个静态服务器：

```bash
# Python（推荐，多数环境零安装即具备）
python -m http.server 5180

# —— 或 —— Node（无需全局安装）
npx --yes http-server -p 5180 -c-1 .
```

然后浏览器打开 **http://127.0.0.1:5180/** 。改文件后刷新即生效（`http.server` / `-c-1` 默认不强缓存）。

### 一键启动（两个 BAT）

Windows 下直接双击，或在命令行执行 `run-dev.bat` / `run-prod.bat`（脚本会自动探测 Python → Node 并打开浏览器）：

| 脚本 | 用途 | 浏览器访问地址 | 说明 |
| --- | --- | --- | --- |
| `run-dev.bat` | 日常学习 / 边写边改 | **http://127.0.0.1:5180** | 起静态服务并自动开浏览器；强刷新即见改动 |
| `run-prod.bat` | 部署前本地验收 | **http://127.0.0.1:8080** | 先跑一次内容自检 `node scripts/check.mjs`，再托管整站 |

> 本项目是**纯静态站、构建即源码**：所谓「生产部署」就是把整个目录当作静态资源丢到 Nginx / 对象存储 / GitHub Pages /
> 任意 CDN，没有额外的编译产物。`run-prod.bat` 只是在本地模拟这层静态托管，并附带一次骨架 / 小测契约自检。

- **手机或另一台电脑预览**（连同一 Wi-Fi）：照常起服务（Python `http.server` 默认监听 `0.0.0.0`），再用
  `http://<你电脑的局域网IP>:5180` 访问（IP 用 `ipconfig` 查看）。
- 打不开先自查两点：①端口是否被占用（换一个端口）；②是否误用了 `file://`（必须走 `http://`）。

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
- 然后（需 Node）：

  ```bash
  node scripts/scaffold.mjs   # 按 data.js 为所有小节补齐四件套占位（幂等，只建缺失的）
  node scripts/outline.mjs     # 由 data.js 重新生成《教学大纲.md》
  node scripts/check.mjs       # 自检：包 / 小节 id 唯一、重要级与难度取值合法、小测可解析判分
  ```

- ⚠️ **改完任何 `assets/js/*.js` 或 `assets/css/*.css`，都要同步递增 `index.html` 里 `<link>/<script>` 以及
  `app.js`、`store.js` 中 `import` 的 `?v=` 版本号**（浏览器强缓存 ES Module 的静态路径，不 bump 会看到旧逻辑）。当前全站 `?v=13`。
- **正文详略对齐重要级**（见 `app.js` 的 `depthOf`）：5 核心精讲 → 4 重点标准 → 3 标准概览 → 2 简明速览 → 1 了解即可；
  首页卡片右上角标签按此着色（红 → 绿，越重要越红）。

## 六、提交到 GitHub（首次）

```bash
git init                 # 若尚未初始化
git add -A
git commit -m "feat: Big Java Backend 学习平台（零依赖静态框架 + 15 分区 / 86 课程包骨架）"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
# 之后每天学完：git add -A && git commit -m "day: 学了 xxx" && git push
```

## 七、技术栈

| 层 | 选型 |
| --- | --- |
| 外壳 | 原生 HTML + CSS + **JavaScript ES Modules**（无框架、无构建、零第三方依赖） |
| Markdown 渲染 | 自写解析器 `assets/js/md.js`（含小测解析 `parseQuiz` / 判分 `gradeQuiz`） |
| 路由 | `location.hash` 手写路由（`app.js`）：`#/` · `#/map` · `#/progress` · `#/pkg/:id` · `#/sec/:pkg/:stage/:id[/quiz\|homework\|interview]` |
| 骨架数据源 | `assets/js/data.js`（唯一事实源，驱动首页 / 地图 / 解锁链路） |
| 课程内容 | `courses/**/*.md` 四件套（课文 / 小测 / 作业 / 面试题） |
| 进度 | `localStorage` 主 + Markdown 导入导出（`progress/progress.md`） |
| 主题 | CSS 自定义属性 ×4：深色 `dark` / 护眼 `eye` / 藏青 `navy` / 纸白 `paper`（`themes.css`） |
| 作者工具 | Node ESM 脚本：`scaffold` / `outline` / `check`（可选，仅增删内容时用） |
| 运行 | 任意静态 HTTP 服务器（`python -m http.server` / `npx http-server`） |

## 八、目录速览

```
BigJavaBackend/
├─ index.html                 # 唯一页面外壳：加载主题 CSS 与 ES Module 入口
├─ assets/
│  ├─ js/data.js              # ★ 唯一骨架事实源：分区 → 包 → 阶段 → 小节
│  ├─ js/app.js               # 路由 + 各视图渲染（首页 / 包 / 小节 / 小测 / 作业 / 面试题 / 地图 / 进度）
│  ├─ js/store.js             # 进度：localStorage 主 + Markdown 导入导出 + 主题
│  ├─ js/md.js                # 自写 Markdown 渲染器 + 小测解析 / 判分
│  ├─ css/main.css            # 布局与组件（含详略标签五级配色）
│  └─ css/themes.css          # 四套暗色 / 护眼主题变量
├─ courses/                   # 86 个课程包（内容层，纯 Markdown）
│  └─ <包id>/<阶段id>/Sx-y-{Lesson,Quiz,Homework,Interview}.md
├─ progress/progress.md       # 仓库自带进度种子（网站可导入 / 首启自动读取）
├─ scripts/                   # 作者工具（Node，可选）：scaffold / outline / check .mjs
├─ BigJavaBackend.md          # 原始需求规格（课程设计初衷）
├─ 教学大纲.md                # 由 outline.mjs 从 data.js 生成的全课程大纲
├─ run-dev.bat                # 一键起本地静态服务（DEV，:5180）
└─ run-prod.bat               # 内容自检 + 静态托管（PROD，:8080）
```

## 九、内容完成度说明

> 平台骨架已全线贯通：**15 个大技术分区 / 86 个课程包 / 300 个小节**，每小节均已生成 **课文 + 小测 + 作业 + 面试题**
> 四件套（共 1200 个 Markdown 文件）；结构、解锁链路与小测判分契约经 `scripts/check.mjs` 自检通过。
>
> **正文写实进度：已完成 46 / 300 节。** 其中「**计算机与算法基础**」分区 **3 个包全部满配**（数据结构与算法 17 节、
> 计算机网络 14 节、Netty 9 节——逐节撰写正文、深讲原理并配行业实践），另有 `java-basics`（3/11）、`spring-boot`（2/8）、
> `mysql`（1/7）部分完成；其余课程包正文为占位待写（骨架、阶段 / 小节顺序与四件套均已就位，按第五节流程填充即可）。

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
