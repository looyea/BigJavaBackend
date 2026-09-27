/* 路由 + 页面渲染：首页 / 课程包 / 小节课程 / 小测验 / 作业题 / 面试题 / 地图 / 进度 */
/* 模块 URL 带版本号：浏览器会强缓存 ES Module 的静态路径，改动 JS 后同步递增 index.html 与本文件的 ?v 以强制刷新 */
import { CATEGORIES, INDEX, findSection, secFile, secKey } from './data.js?v=5';
import { renderMarkdown, parseQuiz, stripTitle, renderInline, gradeQuiz } from './md.js?v=5';
import * as store from './store.js?v=5';

const app = document.getElementById('app');
const mdCache = new Map();

/* ---------- 通用工具 ---------- */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stars = (n) => `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2600);
}

async function loadMd(path) {
  if (mdCache.has(path)) return mdCache.get(path);
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const text = await res.text();
    mdCache.set(path, text);
    return text;
  } catch { return null; }
}

/** 把 ```flow 代码块渲染成流程图（零依赖，替代 mermaid） */
function paintFlows(root) {
  root.querySelectorAll('pre[data-lang="flow"]').forEach((pre) => {
    const chain = pre.textContent.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const box = document.createElement('div');
    box.className = 'flow';
    chain.forEach((line, li) => {
      if (li) box.insertAdjacentHTML('beforeend', '<span class="arrow">→</span>');
      line.split(/->|→/).map((s) => s.trim()).filter(Boolean).forEach((node, ni, arr) => {
        if (ni) box.insertAdjacentHTML('beforeend', '<span class="arrow">→</span>');
        box.insertAdjacentHTML('beforeend', `<span class="node">${esc(node)}</span>`);
      });
    });
    pre.replaceWith(box);
  });
}

function crumb(items) {
  return `<nav class="crumb">${items.map((it, i) =>
    (i ? '<span>›</span>' : '') + (it.href ? `<a href="${it.href}">${esc(it.text)}</a>` : `<em style="font-style:normal">${esc(it.text)}</em>`)
  ).join('')}</nav>`;
}

function notFound(title, hint) {
  return `<div class="notice"><strong>${esc(title)}</strong><br>${hint || '内容建设中，稍后再来。'}</div>`;
}

/* ---------- 首页 ---------- */

function viewHome() {
  const s = store.siteStats();
  const html = CATEGORIES.map((cat) => {
    const cards = cat.packages.map((pkg) => {
      const st = store.pkgStats(pkg.id);
      const tag = st.done === 0 ? '<span class="tag">未开始</span>'
        : st.done < st.total ? '<span class="tag avail">进行中</span>'
          : '<span class="tag done">已完成</span>';
      return `<a class="pkg-card" href="#/pkg/${pkg.id}">
        <h3>${esc(pkg.name)}${tag}</h3>
        <p class="desc">${esc(pkg.desc)}</p>
        <div class="meta">
          <span>阶段 ${pkg.stages.length} · 小节 ${st.total}</span>
          <span>重要性 ${stars(pkg.importance)}</span>
        </div>
        <div class="meta" style="margin-top:4px"><span>已过关 ${st.done}/${st.total}</span></div>
      </a>`;
    }).join('');
    return `<section class="category">
      <div class="category-head"><h2>${esc(cat.name)}</h2><span class="count">${cat.packages.length} 个课程包 · ${esc(cat.desc)}</span></div>
      <div class="grid">${cards}</div>
    </section>`;
  }).join('');

  return `${crumb([{ text: '首页' }])}
    <h1 class="page-title">Big Java Backend <span class="tag">大Java后端</span></h1>
    <p class="page-sub">以资深架构师的视角组织的 Java 后端学习体系：${CATEGORIES.length} 个大技术分区 · ${Object.keys(INDEX.pkg).length} 个课程包 · ${s.total} 个小节。已过关 ${s.sections} 节，采用过关制解锁。</p>
    ${html}`;
}

/* ---------- 课程包页 ---------- */

function viewPkg(pkgId) {
  const pkg = INDEX.pkg[pkgId];
  if (!pkg) return notFound('课程包不存在');
  const cat = INDEX.cat[pkg.categoryId];
  const stat = store.pkgStats(pkgId);

  const stages = pkg.stages.map((stage) => {
    const ss = store.stageStats(pkgId, stage.id);
    // 阶段地图：技术点 + 难度 + 重要性
    const map = `<table class="map-table">
      <thead><tr><th>小节</th><th>核心技术点</th><th class="center">难度</th><th class="center">重要性</th><th class="center">状态</th></tr></thead>
      <tbody>${stage.sections.map((sec) => `<tr>
        <td>${esc(sec.id)}</td><td>${esc(sec.title)}</td>
        <td class="center">${stars(sec.difficulty)}</td>
        <td class="center">${stars(sec.importance)}</td>
        <td class="center">${secStatusTag(sec)}</td></tr>`).join('')}</tbody>
    </table>`;

    const boxes = stage.sections.map((sec) => {
      const unlocked = store.isUnlocked(sec);
      const base = `#/sec/${pkgId}/${stage.id}/${sec.id}`;
      const passed = store.isPassed(sec);
      const blocks = `
        <div class="blocks">
          ${unlocked || passed ? `<a class="${passed ? 'passed' : ''}" href="${base}/quiz">小测验</a>` : '<span class="lock-tip">小测验 🔒</span>'}
          <a href="${base}/homework">作业题</a>
          <a href="${base}/interview">面试题</a>
        </div>`;
      const main = `<div class="main">
        <h3>${unlocked ? `<a href="${base}">${esc(sec.title)}</a>` : esc(sec.title)}</h3>
        <p class="sum">${esc(sec.summary)}</p>
        <div class="stars-line">难度 ${stars(sec.difficulty)} &nbsp; 重要性 ${stars(sec.importance)} &nbsp; ${secStatusTag(sec)}</div>
      </div>`;
      // 不能用 <a> 包裹整个方框（将与内部的三个链接嵌套，HTML 解析会提前闭合导致布局错乱）
      return `<div class="sec-box${unlocked ? '' : ' is-locked'}">${main}${blocks}</div>`;
    }).join('');

    return `<section class="stage">
      <div class="stage-head"><h2>${esc(stage.name)}</h2>
        <span class="pct">${ss.done}/${ss.total}${ss.complete ? ' · 阶段已完成' : ''}</span></div>
      ${map}${boxes}
    </section>`;
  }).join('');

  return `${crumb([{ text: '首页', href: '#/' }, { text: cat.name, href: '#/' }, { text: pkg.name }])}
    <h1 class="page-title">${esc(pkg.name)} <span class="tag">${esc(cat.name)}</span></h1>
    <p class="page-sub">${esc(pkg.desc)}<br>课程包重要性：${stars(pkg.importance)} &nbsp;·&nbsp; 共 ${pkg.stages.length} 个阶段 / ${stat.total} 个小节 &nbsp;·&nbsp; 当前进度 ${stat.done}/${stat.total}</p>
    ${stages}`;
}

function secStatusTag(sec) {
  if (store.isPassed(sec)) {
    const r = store.sectionRecord(sec);
    return `<span class="tag done">已通过${r.score === null || r.score === undefined ? '（自定义）' : ` ${r.score}分`}</span>`;
  }
  return store.isUnlocked(sec) ? '<span class="tag avail">可学习</span>' : '<span class="tag lock">未解锁</span>';
}

/* ---------- 小节子页面 ---------- */

async function viewSection(pkgId, stageId, secId, tab) {
  const sec = findSection(pkgId, stageId, secId);
  if (!sec) return notFound('小节不存在');
  const pkg = INDEX.pkg[pkgId], stage = pkg.stages.find((s) => s.id === stageId);
  if (!store.isUnlocked(sec) && tab !== 'homework' && tab !== 'interview') {
    return notFound('该小节尚未解锁', '请先通过同课程包内上一节的小测验（≥ 60 分）。');
  }
  const head = `${crumb([
    { text: '首页', href: '#/' },
    { text: pkg.name, href: `#/pkg/${pkgId}` },
    { text: stage.name },
    { text: sec.title },
  ])}
  <h1 class="page-title">${esc(sec.title)}</h1>
  <p class="page-sub">难度 ${stars(sec.difficulty)} · 重要性 ${stars(sec.importance)} · ${secStatusTag(sec)}</p>
  ${tabs(sec, tab)}`;

  /* 文件命名：阶段编号-小节编号-{Lesson|Quiz|Homework|Interview}.md */
  if (tab === 'quiz') return head + (await renderQuiz(sec, secFile(sec, 'Quiz')));
  if (tab === 'homework') return head + (await renderDoc(sec, secFile(sec, 'Homework'), '作业题'));
  if (tab === 'interview') return head + (await renderDoc(sec, secFile(sec, 'Interview'), '实际面试题'));
  return head + (await renderLesson(sec, secFile(sec, 'Lesson')));
}

function tabs(sec, tab) {
  const base = `#/sec/${sec.pkg}/${sec.stage}/${sec.id}`;
  const item = (t, label) => `<a class="btn ${tab === t || (!tab && t === 'lesson') ? '' : 'ghost'}" href="${base}${t === 'lesson' ? '' : '/' + t}"
    style="text-decoration:none">${label}</a>`;
  return `<div class="btn-row">${item('lesson', '课程内容')}${item('quiz', '小测验')}${item('homework', '作业题')}${item('interview', '实际面试题')}</div><div style="height:18px"></div>`;
}

async function renderLesson(sec, file) {
  const md = await loadMd(file);
  if (md === null) return notFound('课程内容正在编写中', `预期文件：<code>${file}</code>`);
  const { html, headings } = renderMarkdown(stripTitle(md));
  return `<div class="lesson-layout">
    <aside class="lesson-toc">${headings.map((h) => `<div style="padding-left:${(h.lv - 2) * 12}px"><button type="button" class="toc-link" data-jump="${h.id}">${esc(h.text)}</button></div>`).join('')}</aside>
    <article class="md" id="lesson-md">${html}</article>
  </div>` + nextLink(sec);
}

/* 目录跳转的处理在主 click 委托里：不能直接用 href="#h-x"，否则与 hash 路由冲突导致页面被判定为不存在 */

async function renderDoc(sec, file, label) {
  const md = await loadMd(file);
  if (md === null) return notFound(`${label}正在编写中`, `预期文件：<code>${file}</code>`);
  return `<article class="md">${renderMarkdown(stripTitle(md)).html}</article>` + nextLink(sec);
}

function nextLink(sec) {
  const next = store.nextSection(sec);
  if (!next) return '<p class="page-sub" style="margin-top:20px">这是课程包的最后一节。</p>';
  return `<div class="btn-row"><a class="btn ghost" href="#/sec/${next.pkg}/${next.stage}/${next.id}" style="text-decoration:none">下一节：${esc(next.title)}</a></div>`;
}

/* ---------- 小测验（多题型 / 判分 / 过关） ---------- */

let currentQuiz = null;                    // 当前页面已解析的试卷
const KIND_LABEL = { single: '单选', multi: '多选', judge: '判断', fill: '填空', short: '简答' };
const isChoiceKind = (kind) => kind === 'single' || kind === 'multi' || kind === 'judge';
const fmt = (n) => (Math.abs(n % 1) < 0.05 ? String(Math.round(n)) : n.toFixed(1));

async function renderQuiz(sec, file) {
  const md = await loadMd(file);
  if (md === null) return notFound('小测验正在编写中', `预期文件：<code>${file}</code>`);

  const quiz = parseQuiz(md);
  currentQuiz = quiz.questions.length ? quiz : null;

  /* 非标格式降级：小测可按实际情况采用其它形式（实验清单/设问/答辩题），此时不自动判分，但必须能过关 */
  if (!currentQuiz) {
    return `<article class="md">
      ${renderMarkdown(stripTitle(md)).html}
      <div class="btn-row"><button class="btn" id="quiz-manual">我已完成本小节自定义测验，标记通过</button></div>
      <div class="banner">本小节小测采用自定义格式（未解析出可自动判分的题目），因此不计分不判分，仅记录完成。
      若需自动判分，请使用约定格式：<code>### 1. 题干（5分）</code> + <code>- A. 选项</code> + <code>&gt; 答案：B</code>（主观题用 <code>&gt; 参考答案：</code>）。</div>
    </article>` + nextLink(sec);
  }

  const kinds = {};
  quiz.questions.forEach((q) => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });

  const body = quiz.questions.map((q) => {
    const input = isChoiceKind(q.kind)
      ? q.options.map((o) => `<label><input type="${q.kind === 'multi' ? 'checkbox' : 'radio'}" name="q${q.no}" value="${o.key}"><strong>${o.key}.</strong> ${renderInline(o.text)}</label>`).join('')
      : q.kind === 'fill'
        ? '<input class="q-text" type="text" autocomplete="off" placeholder="填写答案（多个可接受答案在题面用 / 分隔）">'
        : '<textarea class="q-text" rows="4" placeholder="写出你的要点，判分时按参考答案关键词命中比例给分"></textarea>';
    return `<div class="quiz-q" data-no="${q.no}" data-kind="${q.kind}" data-answer="${esc(q.answer)}" data-answer-text="${esc(q.keywords.join('｜') || q.answer)}" data-explain="${esc(q.explain || '')}">
      <span class="q-score">${fmt(q.maxScore)} 分</span>
      <div class="q-title">${q.no}. ${renderInline(q.stem)} <span class="tag">${KIND_LABEL[q.kind]}</span></div>
      ${input}
      <div class="quiz-result"></div>
    </div>`;
  }).join('');

  const kindText = Object.entries(kinds).map(([k, n]) => `${KIND_LABEL[k]} ${n}`).join(' · ');
  const stored = store.sectionRecord(sec);
  return `<article class="md">
    <p>本小节共 ${quiz.questions.length} 题（${kindText}），满分 ${fmt(quiz.maxScore)} 分折算百分制，<strong>≥ 60 分记为本小节通过</strong>并解锁下一节。未作答按零分处理。</p>
    ${stored?.passed ? `<div class="banner ok">本小节已由 ${stored.score} 分判为通过，可重做刷新成绩。</div>` : ''}
    ${body}
    <div class="btn-row">
      <button class="btn" id="quiz-submit">提交并判分</button>
      <button class="btn ghost" id="quiz-reset">重做</button>
    </div>
    <div id="quiz-banner"></div>
  </div>`;
}

/** 收集当前卷面作答 */
function collectPicks() {
  const picks = {};
  document.querySelectorAll('.quiz-q').forEach((box) => {
    const { no, kind } = box.dataset;
    picks[no] = isChoiceKind(kind)
      ? [...box.querySelectorAll('input:checked')].map((i) => i.value).sort().join('')
      : (box.querySelector('.q-text')?.value || '').trim();
  });
  return picks;
}

function clearQuiz() {
  document.querySelectorAll('.quiz-q').forEach((box) => {
    box.classList.remove('right', 'wrong', 'partial');
    box.querySelector('.quiz-result').innerHTML = '';
    // 选项的 value 存的是字母键，抹掉会让重做后的选择题永远取不到答案；勾选态与文本态要分开清
    box.querySelectorAll('input[type=radio], input[type=checkbox]').forEach((i) => { i.checked = false; i.disabled = false; });
    box.querySelectorAll('input[type=text], textarea').forEach((i) => { i.value = ''; i.disabled = false; });
  });
  const b = document.getElementById('quiz-banner');
  if (b) b.innerHTML = '';
}

/** 事件委托：提交判分、重做、自定义格式手动过关 */
app.addEventListener('click', (e) => {
  if (e.target.closest('.toc-link')) {
    const btn = e.target.closest('.toc-link');
    const target = document.getElementById(btn.dataset.jump);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (e.target.id === 'quiz-reset') { clearQuiz(); return; }

  const sec = currentSection();
  if (!sec) return;

  /* 自定义格式的小测：不计分，仅标记完成 */
  if (e.target.id === 'quiz-manual') {
    const result = store.markManual(sec);
    e.target.disabled = true;
    document.getElementById('quiz-banner')?.remove?.();
    toast('本小节已标记通过');
    afterPass(result, sec);
  }

  if (e.target.id !== 'quiz-submit' || !currentQuiz) return;

  const picks = collectPicks();
  const r = gradeQuiz(currentQuiz, picks);
  const map = Object.fromEntries(r.detail.map((d) => [d.no, d]));

  document.querySelectorAll('.quiz-q').forEach((box) => {
    const d = map[box.dataset.no];
    if (!d) return;
    const q = currentQuiz.questions.find((x) => x.no === box.dataset.no);
    const full = d.ratio >= 0.999, none = d.ratio <= 0;
    box.classList.toggle('right', full);
    box.classList.toggle('wrong', none);
    box.classList.toggle('partial', !full && !none);
    const mine = picks[box.dataset.no];
    const expected = isChoiceKind(q.kind)
      ? `正确项：${q.answer}` : `参考答案：${esc(q.keywords.join(' ｜ ') || q.answer)}`;
    box.querySelector('.quiz-result').innerHTML =
      `${full ? `<span style="color:var(--ok)">✔ 正确（${fmt(q.maxScore)} 分）</span>`
        : `<span style="color:${none ? 'var(--bad)' : 'var(--accent)'}">${none ? '✘ 不得分' : '△ 部分命中'}（得 ${fmt(d.earned)} / ${fmt(q.maxScore)} 分）</span>`}
      ${(full ? '' : `你的作答：${mine || '未作答'}；${isChoiceKind(q.kind) ? expected : renderInline(expected)}<br>`) + (q.explain ? `<div class="exp">解析：${renderInline(q.explain)}</div>` : '')}`;
    box.querySelectorAll('input, textarea').forEach((i) => { i.disabled = true; });
  });

  const result = store.submitQuiz(sec, r.score);
  const banner = document.getElementById('quiz-banner');
  banner.innerHTML = `<div class="banner ${result.passed ? 'ok' : 'bad'}">
    得分 <strong>${r.score}</strong> / 100（卷面 ${fmt(r.earned)} / ${fmt(r.full)} 分）——
    ${result.passed ? '本小节已通过 ✅' : '未达 60 分，本小节未通过，可重做后再试。'}
    ${result.stageComplete ? ' 该阶段所有小节已完成，阶段自动标记为完成。' : ''}
    ${result.unlockedNext ? ` 已解锁下一节：<a href="#/sec/${result.next.pkg}/${result.next.stage}/${result.next.id}">${esc(result.next.title)}</a>` : ''}
    <div class="btn-row"><a class="btn ghost" href="#/pkg/${sec.pkg}" style="text-decoration:none">返回课程包</a>
    ${result.unlockedNext ? `<a class="btn" href="#/sec/${result.next.pkg}/${result.next.stage}/${result.next.id}" style="text-decoration:none">进入下一节</a>` : ''}</div>
  </div>`;
  banner.scrollIntoView({ block: 'nearest' });
  toast(`本次得分 ${r.score} 分，${result.passed ? '已过关' : '未过关'}`);
});

/** 自定义格式过关后的引导（重用横幅位置） */
function afterPass(result, sec) {
  const box = document.createElement('div');
  box.className = 'banner ok';
  box.innerHTML = `本小节已标记通过。
    ${result.stageComplete ? ' 该阶段所有小节已完成，阶段自动标记为完成。' : ''}
    ${result.next ? ` 已解锁下一节：<a href="#/sec/${result.next.pkg}/${result.next.stage}/${result.next.id}">${esc(result.next.title)}</a>` : ''}
    <div class="btn-row"><a class="btn ghost" href="#/pkg/${sec.pkg}" style="text-decoration:none">返回课程包</a></div>`;
  document.querySelector('.md').appendChild(box);
}

/** 当前路由是否处于小测页，若是则返回对应小节 */
function currentSection() {
  const m = /^#\/sec\/([^/]+)\/([^/]+)\/([^/]+)\/quiz$/.exec(location.hash);
  return m ? findSection(m[1], m[2], m[3]) : null;
}

/* ---------- 学习地图 ---------- */

function viewMap() {
  const rows = CATEGORIES.map((cat) => {
    const cells = cat.packages.map((pkg) => {
      const st = store.pkgStats(pkg.id);
      return `<tr><td><a href="#/pkg/${pkg.id}">${esc(pkg.name)}</a></td>
        <td class="center">${stars(pkg.importance)}</td>
        <td>${pkg.stages.length}</td>
        <td>${pkg.stages.map((s) => esc(s.name.replace(/^阶段[一二三四五六七八九十]+\s*·\s*/, ''))).join(' / ')}</td>
        <td class="center">${st.done}/${st.total}</td></tr>`;
    }).join('');
    return `<h2 style="border-left:4px solid var(--accent);padding-left:10px">${esc(cat.name)}</h2>
      <table class="map-table"><thead><tr><th>课程包</th><th class="center">重要性</th><th>阶段数</th><th>阶段主题</th><th class="center">过关</th></tr></thead><tbody>${cells}</tbody></table>`;
  }).join('');
  return `${crumb([{ text: '首页', href: '#/' }, { text: '学习地图' }])}
    <h1 class="page-title">全站学习地图</h1><p class="page-sub">纵览每个大技术分区下课程包的重要性与阶段编排</p>${rows}`;
}

/* ---------- 进度页 ---------- */

function viewProgress() {
  const s = store.siteStats();
  const recs = Object.entries(INDEX.section).filter(([, sec]) => store.sectionRecord(sec));
  return `${crumb([{ text: '首页', href: '#/' }, { text: '进度' }])}
    <h1 class="page-title">学习进度</h1>
    <p class="page-sub">全站小节 ${s.total} 个，已通过 ${s.done} 个（${Math.round((s.done / s.total) * 100)}%）。进度保存在浏览器本地，并可导出为 Markdown 进度文件跨设备恢复。</p>
    <div class="btn-row">
      <button class="btn" id="pd-export">导出 progress.md</button>
      <label class="btn ghost" style="cursor:pointer">导入 Markdown 进度文件<input type="file" id="pd-import" accept=".md,text/markdown" hidden></label>
      <button class="btn ghost" id="pd-reset">清空进度</button>
    </div>
    <div class="md" style="margin-top:18px">
      <h2>已通过 / 已作答小节</h2>
      ${recs.length ? `<table><thead><tr><th>小节</th><th class="center">最高分</th><th class="center">状态</th><th>最后提交</th></tr></thead><tbody>
        ${recs.map(([key, sec]) => {
          const r = store.sectionRecord(sec);
          return `<tr><td><a href="#/sec/${sec.pkg}/${sec.stage}/${sec.id}">${esc(sec.title)}</a></td>
            <td class="center">${r.score === null || r.score === undefined ? '自定义' : r.score}</td>
            <td class="center">${r.passed ? `<span class="tag done">${r.manual && r.score == null ? '手动通过' : '通过'}</span>` : '<span class="tag lock">未通过</span>'}</td>
            <td>${esc(r.at || '-')}</td></tr>`;
        }).join('')}</tbody></table>` : '<p>还没有作答记录。从<a href="#/">首页</a>任选一个课程包开始吧。</p>'}
    </div>`;
}

app.addEventListener('click', async (e) => {
  if (e.target.id === 'pd-export') {
    store.download(store.toMarkdown(), 'progress.md');
    toast('progress.md 已导出');
  }
  if (e.target.id === 'pd-reset' && confirm('确认清空全部学习进度？此操作不可恢复。')) {
    store.resetAll(); toast('进度已清空'); render();
  }
});
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'pd-import') return;
  const file = e.target.files[0];
  if (!file) return;
  const n = store.fromMarkdown(await file.text());
  toast(`已恢复 ${n} 条小节进度`);
  render();
});

/* ---------- 路由 ---------- */

const ROUTES = [
  [/^#\/$/, viewHome],
  [/^#\/map$/, viewMap],
  [/^#\/progress$/, viewProgress],
  [/^#\/pkg\/([\w-]+)$/, (m) => viewPkg(m[1])],
  [/^#\/sec\/([\w-]+)\/([\w-]+)\/([\w-]+)(?:\/(quiz|homework|interview))?$/, (m) => viewSection(m[1], m[2], m[3], m[4] || 'lesson')],
];

let renderToken = 0;

async function render() {
  const token = ++renderToken;
  const hash = location.hash || '#/';
  for (const [re, fn] of ROUTES) {
    const m = re.exec(hash);
    if (!m) continue;
    const out = await fn(m);
    if (token !== renderToken) return;             // 丢弃过期渲染
    app.innerHTML = out;
    paintFlows(app);
    document.querySelectorAll('.top-nav a').forEach((a) =>
      a.classList.toggle('active', a.getAttribute('href') === (hash === '#/' ? '#/' : hash.split('/').slice(0, 2).join('/'))));
    window.scrollTo({ top: 0 });
    return;
  }
  if (token === renderToken) app.innerHTML = notFound('页面不存在', '<a href="#/">回到首页</a>');
}

/* 主题切换 */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('[data-theme-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeBtn === t)));
}
document.getElementById('theme-switch').addEventListener('click', (e) => {
  const t = e.target.dataset.themeBtn;
  if (!t) return;
  store.setTheme(t); applyTheme(t);
});

window.addEventListener('hashchange', render);

(async function boot() {
  applyTheme(store.getTheme());
  const restored = Object.keys(localStorage).length ? 0 : await store.seedFromFile();
  if (restored) toast(`已从 progress.md 恢复 ${restored} 条进度`);
  await render();
})();
