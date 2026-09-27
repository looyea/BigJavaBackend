/* 内容与解析自检：校验目录结构完整性 + 小测验 MD 是否能被正确解析判分
 * 用法：node scripts/check.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, INDEX, secFile, secKey } from '../assets/js/data.js';
import { renderMarkdown, parseQuiz, gradeQuiz, gradeQuestion, stripTitle } from '../assets/js/md.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let err = 0;
const fail = (msg) => { console.log('✘ ' + msg); err++; };

/* 1. 目录结构唯一性 */
const pkgIds = new Set(), secIds = new Set();
for (const cat of CATEGORIES) {
  for (const pkg of cat.packages) {
    if (pkgIds.has(pkg.id)) fail(`课程包 id 重复：${pkg.id}`);
    pkgIds.add(pkg.id);
    if (!pkg.importance || pkg.importance < 1 || pkg.importance > 5) fail(`重要性越界：${pkg.name}`);
    for (const st of pkg.stages) {
      for (const sec of st.sections) {
        const key = secKey(sec);
        if (secIds.has(key)) fail(`小节键重复：${key}`);
        secIds.add(key);
        for (const [label, v] of [['难度', sec.difficulty], ['重要性', sec.importance]]) {
          if (!(v >= 1 && v <= 5)) fail(`${key} ${label}越界：${v}`);
        }
      }
    }
  }
}

/* 2. 内容文件检查与解析 */
let built = 0;
for (const sec of Object.values(INDEX.section)) {
  const files = { lesson: 'Lesson', quiz: 'Quiz', homework: 'Homework', interview: 'Interview' };
  for (const [kind, suffix] of Object.entries(files)) {
    const p = join(root, secFile(sec, suffix));
    if (!existsSync(p)) continue;
    built++;
    const md = readFileSync(p, 'utf8');
    if (kind === 'quiz') {
      const quiz = parseQuiz(md);
      const declared = (md.match(/^###\s+\d+[.、]/gm) || []).length;
      if (declared && quiz.total !== declared) fail(`${p} 题目解析 ${quiz.total}/${declared}（答案或题型格式不符）`);
      if (!declared) continue;                                  // 自定义格式的小测：不自动判分，允许无标准题
      const sum = quiz.questions.reduce((s, q) => s + q.maxScore, 0);
      if (Math.abs(sum - 100) > 0.5) fail(`${p} 分值合计 ${sum}，应为 100`);
      quiz.questions.forEach((q) => {
        const where = `${p} 第${q.no}题`;
        if (q.kind === 'single' || q.kind === 'multi' || q.kind === 'judge') {
          if (!/^[A-H]+$/.test(q.answer)) fail(`${where} 客观题答案异常：${q.answer}`);
          if ((q.kind === 'single' || q.kind === 'judge') && q.answer.length !== 1) fail(`${where} ${q.kind} 但答案多字母：${q.answer}`);
          if (q.kind === 'multi' && q.answer.length < 2) fail(`${where} 多选但答案唯一：${q.answer}`);
          if (q.kind === 'judge' && q.options.length !== 2) fail(`${where} 判断题应只有两个对立选项`);
          q.answer.split('').forEach((k) => { if (!q.options.some((o) => o.key === k)) fail(`${where} 答案 ${k} 不在选项中`); });
          if (!q.explain) fail(`${where} 缺少解析`);
        } else {
          if (!q.keywords.length) fail(`${where} ${q.kind} 题缺少参考答案或要点`);
        }
        if (!q.maxScore) fail(`${where} 分值为 0`);
      });
      /* 判分冒烟：全对应得 100，未作答应为 0 */
      const all = Object.fromEntries(quiz.questions.map((q) => [q.no, q.answer]));
      quiz.questions.forEach((q) => {
        if (q.kind === 'fill') all[q.no] = q.keywords[0];
        if (q.kind === 'short') all[q.no] = q.keywords.join(' ');
      });
      const perfect = gradeQuiz(quiz, all);
      if (perfect.score !== 100) fail(`${p} 满分校验失败：${perfect.score}（${perfect.earned}/${perfect.full}）`);
      if (perfect.earned - perfect.full > 1e-9) fail(`${p} 卷面得分溢出满分：${perfect.earned}/${perfect.full}`);
      if (gradeQuiz(quiz, {}).score !== 0) fail(`${p} 未作答应得 0 分`);
      /* 重做场景回归：选择题的参考答案必须是字母串，否则 clearQuiz 后重做取不到值会默默归零 */
      quiz.questions.filter((q) => q.kind === 'single' || q.kind === 'multi' || q.kind === 'judge')
        .forEach((q) => { if (!/^[A-H]+$/.test(all[q.no])) fail(`${p} 第${q.no}题选择题预期答案异常：${all[q.no]}`); });
      /* 简答部分命中：只写一半要点应得 0~1 之间的部分分，不得归零也不得满分 */
      const shortQ = quiz.questions.find((q) => q.kind === 'short' && q.keywords.length >= 4);
      if (shortQ) {
        const half = gradeQuestion(shortQ, shortQ.keywords.slice(0, 2).join(' '));
        if (!(half > 0 && half < 1)) fail(`${p} 简答部分命中得分异常：${half}`);
      }
      const kinds = quiz.questions.map((q) => q.kind).filter((v, i, a) => a.indexOf(v) === i).join('/');
      console.log(`  ✓ ${secKey(sec)} 小测 ${quiz.total} 题〔${kinds}〕满分 ${quiz.maxScore}，自动判分通过`);
    } else {
      const { html } = renderMarkdown(md);
      if (/<(h2|h3)[\s>]/.test(html) === false) fail(`${p} 未解析出任何二级标题`);
      if (/&lt;(h2|table|ul)&gt;/.test(html)) fail(`${p} 结构被转义，渲染异常`);
    }
  }
}

/* 3. 渲染器冒烟测试 */
const sample = renderMarkdown('# T\n\n## A\n\n- 一\n- 二\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n```java\nint i = 1;\n```\n\n> 说明\n\n### 子标题\n');
if (!sample.html.includes('<table>')) fail('表格未渲染');
if (!sample.html.includes('<code>int i = 1;')) fail('代码块未渲染');
if (sample.headings.length !== 2) fail(`目录抽取异常，期望 2 条实际 ${sample.headings.length}`);

/* 4. 行内语法边界：加粗内含星号、下划线、链接 */
const tricky = renderMarkdown('**`count(*)` 不等于 `count(列)`** 与 *斜体* 并存\n');
if (!tricky.html.includes('<strong><code>count(*)</code> 不等于 <code>count(列)</code></strong>')) {
  fail('加粗内含 * 时渲染异常：' + tricky.html.trim());
}
if (tricky.html.includes('**') || /(^|[^<])\*code/.test(tricky.html)) fail('残留未解析的星号：' + tricky.html.trim());

/* 5. stripTitle：只去掉首个一级标题，不动正文里的 ## */
const stripped = stripTitle('# 标题\n\n## 小节\n\n正文');
if (stripped.startsWith('# ') || !stripped.startsWith('## 小节')) fail('stripTitle 处理异常：' + JSON.stringify(stripped));

/* 6. 自定义格式的小测：解析不出标准题时降级为文档展示（不报错、不卡死解锁链） */
const custom = parseQuiz('# 小测验\n\n## 实验任务\n\n1. 动手搭建一主一从并写崩主库\n2. 记录主从行数差异\n');
if (custom.total !== 0) fail('自定义格式应解析为 0 题以便降级展示，实际 ' + custom.total);

const pkgCount = Object.keys(INDEX.pkg).length;
const doneCount = Object.values(INDEX.section).filter((s) => existsSync(join(root, secFile(s, 'Lesson')))).length;
console.log(`\n分区 ${CATEGORIES.length} 个 · 课程包 ${pkgCount} 个 · 小节 ${secIds.size} 个 · 已产出内容文件 ${built} 个（覆盖 ${doneCount} 个小节）`);
console.log(err ? `\n发现 ${err} 个问题 ❌` : '\n全部检查通过 ✅');
process.exit(err ? 1 : 0);
