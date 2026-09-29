# Big Java Backend · 大Java后端 ☕

[中文 README](README.md) | **English**

A Java backend "level-up" learning platform that actually **runs**, tracks your check-ins, and can keep growing.
**Zero third-party runtime dependencies** — native ES Modules plus a hand-written Markdown renderer; no UI framework, no
server process. Development and building go through **Vite** (`npm run dev` / `npm run build`); the output is pure static
assets, **completely free of Python**; multiple dark / eye-care themes. Built for you, if you want to walk the whole Java
backend stack to the standard a senior architect applies, studying locally while pushing daily commits to GitHub.

Coverage: Java language core and advanced topics · Spring family / Jakarta EE / GraalVM · CS and algorithm foundations
(data structures & algorithms · computer networks · Netty) · databases and caching · persistence and connection pools ·
middleware · microservice governance · build, ops and CI/CD · testing and quality · performance tooling · security ·
high concurrency / high availability / distributed ID / idempotency and other architecture themes · industry playbooks for
e-commerce, finance, power grid and social media (per-category progress: see section 9).

---

## 1. Overall logical architecture

```
Web shell → 15 major technology categories → 86 course packages → stages → sections (lesson + quiz + homework + interview)
```

- **The shell** = `index.html` + `assets/js/*` (native ES Modules). At runtime it **reads the single source of truth for the
  skeleton — `assets/js/data.js`** — which holds the whole tree (category → package → stage → section) and drives the home
  cards, the learning map, lessons and quizzes. **Adding a course = one entry in data.js plus the matching Markdown files;
  no framework code changes.** The home page groups everything into **15 major categories** (list in section 9).
- **Course content** = plain Markdown, four files per section, always the same set:

  ```
  courses/<pkgId>/<stageId>/<Stage>-<Section>-{Lesson,Quiz,Homework,Interview}.md
  e.g. courses/data-algorithms/s1/S1-2-Lesson.md      # arrays & linked lists (lesson)
          S1-2-Quiz.md quiz · S1-2-Homework.md homework · S1-2-Interview.md interview questions
  ```

  > 【Path conventions】package ids and stage ids are lower-case with hyphens; the **numbering inside file names is upper
  > case** (`S1-2-`, produced by `sec.id.toUpperCase()`), while in-site ids, routes and progress keys stay lower case.
  > Windows file system is case-insensitive, so the two never collide.

- **One data source**: `assets/js/data.js` is the only skeleton of record; a section tuple is
  `[id, title, one-line takeaway, difficulty(1-5), importance(1-5)]`. 《教学大纲.md》 (the syllabus), the scaffolder and the
  self-check scripts are all derived from it — **change the skeleton in this one place only**.
- **Level-crawl unlocking**: different categories / packages **never lock each other**, pick any order; **inside one
  package** stages and sections unlock strictly in sequence, shallow to deep — if the previous section's quiz is not passed,
  the next section stays closed. **A quiz score ≥ 60 passes the section automatically** (there is no manual "pass" button),
  and once every section in a stage passes, the stage is marked complete by itself.

## 2. Requirements

- **Node.js ≥ 18** (20+ recommended; v24 works out of the box) with the bundled **npm**. Run `npm install` once at the root
  to install dev dependencies (**Vite only**, about 11 packages).
- **Zero third-party runtime dependencies**: page logic is native ES Modules + the in-house Markdown renderer; no Vue or
  React. `node_modules` serves the toolchain only — it never enters the build output nor the runtime.
- A modern browser with ES Module support (Chrome / Edge / Firefox from the last two years).
- **No Python anywhere**: development, build, local preview and deployment all run on npm + Vite
  (`npm run dev` / `npm run build` / `npm run preview`).
- ⚠️ Always open the site over `http://` (Vite starts the server for you). **Do not double-click `index.html`
  (`file://`)** — ES Module `import` and the runtime `fetch` are both blocked by the origin policy there.

> ⚠️ On Windows PowerShell, if you see "running scripts is disabled": use `npm.cmd` instead of `npm` (both BAT files already
> call `npm.cmd`), or unlock with `Set-ExecutionPolicy RemoteSigned` in an elevated session.

## 3. Install and run

```bash
npm install        # first time: install dev dependency (Vite)

npm run dev        # development: Vite HMR server        → http://localhost:5180
npm run build      # build: emit pure static output to dist/
npm run preview    # preview the build output            → http://localhost:8080
npm run prod       # one shot: build then preview
```

- **Development** (`npm run dev`): edit any source file and the browser hot-updates immediately.
- **Production** (`npm run build`): Vite bundles `index.html` + JS/CSS with content-hashed file names into `dist/`; at the
  end of the build the `courses/` and `progress/` trees — which the app `fetch`es on demand — are copied into `dist/`
  (see the `copy-content` plugin in `vite.config.js`). `dist/` **is the deployable static site**, no backend at all.

### Which URL should I open? (incl. one-click BAT files)

| Command / script | Mode | URL | Notes |
| --- | --- | --- | --- |
| `npm run dev` / `run-dev.bat` | development (Vite + HMR) | **http://localhost:5180** | daily study & editing; the BAT runs `npm install` if deps are missing |
| `npm run prod` / `run-prod.bat` | production (build + preview) | **http://localhost:8080** | first `npm run check`, then `build`, then `preview` |

- **Content scripts**: `npm run check` (structure / quiz self-check) · `npm run scaffold` (create missing placeholders for
  the four-file set) · `npm run outline` (regenerate 《教学大纲.md》).
- **Phone / another machine** (same Wi-Fi): `host` is already enabled in the Vite config, so use
  `http://<your-LAN-ip>:5180` (find the ip with `ipconfig`).
- **Deploying**: after `npm run build`, hand the whole `dist/` directory to Nginx / object storage / GitHub Pages / any CDN;
  `base` is relative, so it works from any sub-path.

## 4. Progress and daily check-ins (browser + Markdown + GitHub)

- **Primary storage is `localStorage`** (key `bjb.progress.v1`; the theme lives under `bjb.theme`), holding the best score,
  pass flag and timestamp of every section.
- The "**progress file must be Markdown**" requirement is met by the **progress page: export / import `progress.md`**
  (human-readable, hand-editable). The repository ships a seed file **`progress/progress.md`**: on the first open (empty
  local progress) over HTTP it is read automatically to restore unlock state.
- **Passing and unlocking**: quiz ≥ 60 passes the section and unlocks the next one; unlocking is sequential inside a package
  and never across packages; custom-format quizzes (not multiple choice) offer a "mark as done" button.
- **Start over / hand a copy to a friend**: clear progress on the progress page, or delete the `localStorage` key. To jump
  back to a given day, import that day's `progress.md`.
- **Commit it and you own a check-in record**: commit the exported `progress.md` back to the repo and `git push`, and GitHub
  shows the daily commits / contribution squares.

## 5. Extending the courses (where the content goes from here)

- **Deepen a section**: edit `courses/<pkg>/<stage>/Sx-y-Lesson.md` (the body) / `-Quiz.md` / `-Homework.md` / `-Interview.md`.
- **Add a section / stage / package / category**: **only touch `assets/js/data.js`** — extend
  `CATEGORIES → packages → stages → sections`.
- Then (Node required, via npm scripts):

  ```bash
  npm run scaffold   # create the four-file placeholders for every section (idempotent, only missing ones)
  npm run outline    # regenerate 《教学大纲.md》 from data.js
  npm run check      # self-check: unique pkg/section ids, legal importance & difficulty, quizzes parse and grade
  ```

- **Caching and versioning are Vite's job**: content-hashed file names invalidate caches automatically and the dev server
  does not strongly cache, so an edit is visible on reload — **no manual `?v=` counters anymore** (that mechanism went away
  with the Python static hosting).
- **Depth follows importance** (see `depthOf` in `app.js`): 5 core deep-dive → 4 key standard → 3 standard overview →
  2 concise survey → 1 awareness only; home-card tags are coloured accordingly (red → green, the more important the redder).

### Hard rules for every example program (`BigJavaBackend.md`, "example program" section)

Every example that appears in a lesson, homework or interview file must satisfy all five rules — check them one by one when
writing or back-filling:

1. **Always commented**: a leading comment stating what this example is for.
2. **Inline comments state the effect**: after key statements, give the effect / output / state change they produce.
3. **A definition must be applied**: if you declare something (a `record`, for instance) you must also use it in code —
   definitions without usage are not allowed.
4. **One positive case per knowledge point**: every knowledge point and every usage scenario needs a correct case whose
   expected result is spelled out in the comment.
5. **Negative cases are mandatory**: also show the wrong usage, with a comment on what it produces and which exception it throws.

> Self-check: `npm run audit-examples` (`scripts/audit-examples.mjs`) scans all written lessons / homework / interview files
> and reports "has examples · negative case present · comment density", with details in `scripts/_audit.txt`.

## 6. Pushing to GitHub (first time)

```bash
git init                 # if not initialised yet
git add -A
git commit -m "feat: Big Java Backend learning platform (Vite-driven static shell + 15 categories / 86 packages)"
git branch -M main
git remote add origin https://github.com/<your-user>/<repo-name>.git
git push -u origin main
# then, every study day: git add -A && git commit -m "day: learned xxx" && git push
```

## 7. Tech stack

| Layer | Choice |
| --- | --- |
| Shell | plain HTML + CSS + **JavaScript ES Modules** (no UI framework, zero runtime dependencies) |
| Markdown rendering | in-house parser `assets/js/md.js` (incl. quiz parsing `parseQuiz` / grading `gradeQuiz`) |
| Routing | hand-written `location.hash` router (`app.js`): `#/` · `#/map` · `#/progress` · `#/pkg/:id` · `#/sec/:pkg/:stage/:id[/quiz\|homework\|interview]` |
| Skeleton source | `assets/js/data.js` (single source of truth, drives home / map / unlock chain) |
| Course content | `courses/**/*.md` four-file set (lesson / quiz / homework / interview) |
| Progress | `localStorage` primary + Markdown import/export (`progress/progress.md`) |
| Themes | CSS custom properties ×4: `dark` / `eye` / `navy` / `paper` (`themes.css`) |
| Dev / build | **Vite 5** (`npm run dev` / `build` / `preview` / `prod`), custom plugin copies courses/progress into dist |
| Content tooling | Node ESM scripts: `scaffold` / `outline` / `check` (exposed as npm scripts) |
| Run / deploy | Vite for development and preview; `dist/` is pure static output for any static server (Nginx / Pages / CDN) |

## 8. Directory at a glance

```
BigJavaBackend/
├─ package.json               # npm scripts: dev/build/preview/prod/check/scaffold/outline (devDep: Vite)
├─ vite.config.js             # Vite config: ports 5180/8080, relative base, copy courses/progress into dist
├─ index.html                 # the single page shell: theme CSS + ES Module entry
├─ assets/
│  ├─ js/data.js              # ★ single source of truth: categories → packages → stages → sections
│  ├─ js/app.js               # router + views (home / package / section / quiz / homework / interview / map / progress)
│  ├─ js/store.js             # progress: localStorage primary + Markdown import/export + theme
│  ├─ js/md.js                # in-house Markdown renderer + quiz parsing / grading
│  ├─ css/main.css            # layout and components (5-level depth tags, 18px body text)
│  └─ css/themes.css          # variables for the four dark / eye-care themes
├─ courses/                   # 86 packages (content layer, plain Markdown)
│  └─ <pkgId>/<stageId>/Sx-y-{Lesson,Quiz,Homework,Interview}.md
├─ progress/progress.md       # shipped progress seed (importable, read on first start)
├─ scripts/                   # content tooling (Node): scaffold / outline / check .mjs, called via npm
├─ dist/                      # pure static output of npm run build (git-ignored)
├─ node_modules/              # dev dependencies (created by npm install; git-ignored)
├─ README.md                  # Chinese readme (default repository page)
├─ README.en.md               # this English readme
├─ BigJavaBackend.md          # original requirement spec (the course design brief)
├─ 教学大纲.md                # full syllabus generated from data.js by npm run outline
├─ run-dev.bat                # development: auto npm install → npm run dev (:5180)
└─ run-prod.bat               # production: npm run check → build → preview (:8080)
```

## 9. Content completion

> The skeleton is fully wired end to end: **15 major categories / 86 course packages / 343 sections**, and every section has
> its **lesson + quiz + homework + interview** set (1372 Markdown files in total); structure, unlock chain and quiz grading
> contract pass `scripts/check.mjs`.
>
> **Written body progress: 343 / 343 sections complete (all four files written, not placeholders).** In the latest round the
> sections were back-filled to the **depth-tier minimums** (core deep-dive packages ≥ 6 sections across ≥ 2 stages, key
> standard packages ≥ 3 sections), which took the total from 300 to 343 sections.
>
> **Example-program back-fill**: all 343 written sections were audited against the five hard rules above (purpose comments,
> inline effects, positive and negative cases with the thrown exception). `node scripts/audit-examples.mjs` confirms
> **【A】no example / 【B】no negative case / 【C】comment density < 35% are all 0** for lessons and interview files, and
> `node scripts/check.mjs` grades every quiz to a full 100. This README is updated at the end of every round.
>
> Language switch: GitHub renders `README.md` as the repository home page, so this English version is linked from the top of
> the Chinese one (and vice versa) — that pair of links is the switcher.

- **The 15 categories** (home page grouping order, identical to `CATEGORIES` in `data.js`):

| # | Category | Packages | Sections |
| --- | --- | --- | --- |
| 1 | CS and algorithm foundations | 3 | 40 |
| 2 | Java language basics | 4 | 31 |
| 3 | Frameworks | 6 | 25 |
| 4 | Distributed systems | 2 | 12 |
| 5 | Architecture design and methodology | 3 | 17 |
| 6 | Databases and caching | 9 | 31 |
| 7 | Persistence and connection pools | 4 | 13 |
| 8 | Middleware | 4 | 10 |
| 9 | Microservice governance | 14 | 41 |
| 10 | Build, ops and CI/CD | 10 | 40 |
| 11 | Testing | 7 | 17 |
| 12 | Performance tooling | 3 | 7 |
| 13 | Security | 6 | 19 |
| 14 | Additional topics | 4 | 10 |
| 15 | Special themes | 7 | 30 |
| | **Total, 15 categories** | **86** | **343** |

- **Depth tiers**: each package falls into one of five tiers by `importance(1-5)` — core deep-dive / key standard / standard
  overview / concise survey / awareness only; the red → green card tags mark the tier, and the higher the importance the
  deeper the treatment (source code, scenarios and industry practice).
- **Splitting principle**: genuinely **independent products** (Maven vs Gradle, Docker vs Kubernetes, JUnit vs Mockito,
  Lettuce vs Redisson, ELK vs Loki, OAuth 2.0 vs JWT, …) each get their own package and home card, with a "related /
  comparison / selection" section inside; same-family or bundled themes (MyBatis with MyBatis-Plus, the Spring Cloud Alibaba
  overview, RPC fundamentals, Web attack & defence, data encryption and signatures) stay merged.

> Wherever a fact depends on a version, trust the **official documentation / authoritative specification** of that technology
> — this course keeps repeating the warning: beware of outdated tutorials and AI hallucinations.
