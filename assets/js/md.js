/* 极简 Markdown 渲染器（零依赖），支持：标题/段落/列表/表格/代码块/引用/粗斜体/行内代码/链接/分隔线 */

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // 先处理加粗：非贪婪匹配，允许内文包含 *（如 **`count(*)` 不等于 ..**）
  out = out.replace(/\*\*([^*]*(?:\*(?!\*)[^*]*)*)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*<])\*([^*<>]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">');
  return out;
}

function splitRow(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

/** 行内 Markdown（题干、选项、解析等短文本用） */
export const renderInline = inline;

/** 去掉正文首部的一级标题，页面头部由课程目录统一提供，避免重复 h1 */
export function stripTitle(md) {
  const NL = String.fromCharCode(10);
  const text = String(md).split(String.fromCharCode(13)).join('');
  const lines = text.split(NL);
  if (lines.length && /^\s*#\s/.test(lines[0])) lines.shift();
  while (lines.length && !lines[0].trim()) lines.shift();
  return lines.join(NL);
}

export function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let i = 0;
  let anchor = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {                       // 代码块
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      html.push(`<pre data-lang="${esc(lang)}"><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);         // 标题
    if (h) {
      const lv = h[1].length;
      const txt = h[2].trim();
      const id = `h-${anchor++}`;
      html.push(`<h${lv} id="${id}">${inline(txt)}</h${lv}>`);
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { html.push('<hr>'); i++; continue; }

    // 白名单块级 HTML（如 details / summary）直接透传，便于课程里的折叠答案
    if (/^\s*<\/?\s*(details|summary|div|section|br|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|h[1-6]|p|span|figure|figcaption|img)\b[^>]*>\s*$/i.test(line)) {
      html.push(line.trim()); i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {                      // 引用块
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      html.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {  // 表格
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      html.push(
        '<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>'
      );
      continue;
    }

    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);        // 无序列表
    if (ul) {
      const buf = [];
      while (i < lines.length && /^\s*[-*+]\s+(.*)$/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++;
      }
      html.push('<ul>' + buf.map((t) => `<li>${inline(t)}</li>`).join('') + '</ul>');
      continue;
    }

    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);      // 有序列表
    if (ol) {
      const buf = [];
      while (i < lines.length && /^\s*\d+[.)]\s+(.*)$/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++;
      }
      html.push('<ol>' + buf.map((t) => `<li>${inline(t)}</li>`).join('') + '</ol>');
      continue;
    }

    if (!line.trim()) { i++; continue; }              // 空行

    const buf = [];                                    // 段落
    while (i < lines.length && lines[i].trim()
      && !/^(#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|\s*>|\s*```|\s*\|)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    html.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  return { html: html.join('\n'), headings: collectHeadings(md) };
}

/** 抽取二级/三级标题，用于生成课程目录（id 与 renderMarkdown 保持一致） */
function collectHeadings(md) {
  const out = [];
  let anchor = 0;
  let inCode = false;
  md.replace(/\r\n/g, '\n').split('\n').forEach((line) => {
    if (/^\s*```/.test(line)) { inCode = !inCode; return; }   // 代码块内的 # 不是标题
    if (inCode) return;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!h) return;
    if (h[1].length === 2 || h[1].length === 3) out.push({ id: `h-${anchor}`, lv: h[1].length, text: h[2].trim() });
    anchor++;
  });
  return out;
}

/**
 * 小测验解析：支持"根据实际情况设置格式"，同一份卷子里可混用多种题型。
 *
 * 题目以三级标题开头：### 1. 题干（可带分值：### 1. 题干（5分））
 *   选项行：  - A. 选项文本          → 客观选择题（题干含"多选"则为多选，判断题写成 A.正确 / B.错误 即可）
 *   无选项行 → 主观题：题干含 填空/填写/补全 或带 ____ 下划线记为填空题，否则为简答题
 * 答与解析（写在题目内或末尾统一"## 答案"段都可以）：
 *   > 答案：B            客观题填字母；主观题填参考答案（多个可接受答案用 / 或 | 分隔）
 *   > 参考答案：xxx       同义写法；也可用下方要点列表，每个 - 条目作为一个得分关键词
 *   > 解析：xxx          可选
 * 末尾“## 答案”段落逐行：1. B / 2. ABD / 3. 答案文本
 */
const FILL_HINT = /填空|填写|补全|每个空|下划线/;

const normText = (s) => String(s).toLowerCase().replace(/[\s`*_>、，。；;：:/／（）()]/g, '');

/** 拆参考答案为得分关键词：简答题优先用要点列表与 | 分隔；填空题用 / 、； 分隔多个可接受答案 */
function toKeywords(answer, bullets, kind) {
  if (kind === 'fill') {
    return String(answer).split(/[|｜/／；;]/).map((s) => s.trim()).filter(Boolean);
  }
  if (bullets && bullets.length) return bullets.map((b) => b.trim()).filter(Boolean);
  return String(answer).split(/[|｜]/).map((s) => s.trim()).filter(Boolean);
}

export function parseQuiz(src) {
  const md = String(src).replace(/\r\n/g, '\n').replace(/\r/g, '\n');   // 兼容 Windows CRLF 行尾

  /* 末尾统一答案段（可选） */
  const answerMap = {};
  const ansBlock = /##\s*答案[\s\S]*?(?=\n##\s|\s*$)/.exec(md);
  if (ansBlock) {
    ansBlock[0].split('\n').forEach((l) => {
      const m = /^\s*(?:[-*]\s*)?(\d+)[.)、:：\s]+(.*?)\s*$/.exec(l);
      if (!m) return;
      const val = m[2].trim();
      answerMap[m[1]] = /^[A-Ha-h]+$/.test(val) ? val.toUpperCase().split('').sort().join('') : val;
    });
  }

  const questions = [];
  const body = ansBlock ? md.replace(ansBlock[0], '') : md;

  body.split(/^###\s+/m).slice(1).forEach((part) => {
    const lines = part.split('\n');
    const m = /^(\d+)[.、]\s*(.*?)\s*$/.exec(lines[0].trim());
    if (!m) return;
    const no = m[1];
    let stem = m[2];

    /* 题干可显式标注分值，否则全卷平均分配 */
    let weight = null;
    const wm = /[（(]\s*(\d+(?:\.\d+)?)\s*分\s*[)）]/.exec(stem);
    if (wm) {
      weight = Number(wm[1]);
      stem = stem.replace(wm[0], '').trim();
    }

    const options = [];
    const bullets = [];                                   // 参考答案的要点列表
    let explain = '';
    let inlineAnswer = '';
    let inReferenceList = false;

    lines.slice(1).forEach((l) => {
      const om = /^\s*[-*+]\s*([A-H])[.、:]\s*(.*?)\s*$/.exec(l);
      if (om) { options.push({ key: om[1].toUpperCase(), text: om[2].trim() }); inReferenceList = false; return; }

      const am = /^\s*>?\s*(?:\*\*)?(?:正确答案|答案|参考答案)\s*(?:\*\*)?\s*[：:]\s*(.*?)\s*$/.exec(l);
      if (am) { inlineAnswer = am[1].trim(); inReferenceList = !inlineAnswer; return; }

      const em = /^\s*>\s*(?:\*\*)?解析\s*(?:\*\*)?\s*[：:]?\s*(.*?)\s*$/.exec(l);
      if (em) { explain += (explain ? ' ' : '') + em[1].replace(/\*/g, '').trim(); return; }

      const bm = /^\s*>?\s*[-*+]\s+(.{2,})$/.exec(l);      // 无字母前缀的列表项（含引用块内）= 参考要点
      if (bm && (inlineAnswer || inReferenceList)) bullets.push(bm[1].trim());
    });

    const answer = inlineAnswer || answerMap[no] || '';
    const isChoice = options.length >= 2;
    const isJudge = isChoice && options.every((o) => /^(正确|错误|对|错|√|×|true|false)$/i.test(o.text));
    const blank = /_{3,}|＿{2,}/.test(stem) || FILL_HINT.test(stem);
    const kind = isChoice ? (isJudge ? 'judge' : (/多选/.test(stem) ? 'multi' : 'single')) : (blank ? 'fill' : 'short');

    questions.push({
      no,
      stem,
      kind,
      options,
      weight,
      answer,
      keywords: isChoice ? [] : toKeywords(answer, bullets, kind),
      explain,
    });
  });

  const usable = questions.filter((q) => q.answer || q.keywords.length);

  /* 分值：有标注则按标注，没标注则平均 100 分 */
  const declared = usable.filter((q) => q.weight);
  if (declared.length === usable.length && usable.length) {
    usable.forEach((q) => { q.maxScore = q.weight; });
  } else {
    const per = usable.length ? 100 / usable.length : 0;
    usable.forEach((q) => { q.maxScore = per; });
  }

  return {
    title: (/^#\s+(.*)$/m.exec(md) || [, '小测验'])[1].trim(),
    total: usable.length,                                 // 解析不出任何题 → 0，调用方降级为纯文档展示
    parsed: questions.length,
    maxScore: Math.round(usable.reduce((s, q) => s + q.maxScore, 0) * 10) / 10,
    questions: usable,
  };
}

/** 主观题要点主干：括号前的主体部分（括号内视为补充说明） */
const mainOf = (k) => String(k).split(/[（(]/)[0].trim();

/** 把要点拆成可匹配的片段，用于主干未命中时的部分得分 */
function fragmentsOf(k) {
  return String(k)
    .split(/[（(）)、，,；;。\s]+/)
    .map(normText)
    .filter((s) => s.length >= 2);
}

/**
 * 单题评分，返回 0~1 的得分比例
 * picked：客观题为排序后的字母串（如 "AB"），主观题为输入的文本
 */
export function gradeQuestion(q, picked) {
  const value = String(picked || '').trim();
  if (q.kind === 'single' || q.kind === 'multi' || q.kind === 'judge') {
    const got = value.toUpperCase().split('').sort().join('');
    return got && got === q.answer.split('').sort().join('') ? 1 : 0;
  }
  if (!value) return 0;
  const got = normText(value);
  if (q.kind === 'fill') {
    const alts = (q.keywords.length ? q.keywords : q.answer.split(/[|｜/／；;]/)).map(normText).filter(Boolean);
    return alts.some((a) => got === a || got.includes(a) || a.includes(got)) ? 1 : 0;
  }
  /* 简答：逐个要点判定——主干命中计满分，否则按片段命中率给部分分 */
  const keys = (q.keywords.length ? q.keywords : [q.answer]).filter(Boolean);
  if (!keys.length) return 0;
  const per = keys.map((k) => {
    const main = normText(mainOf(k));
    if (main && got.includes(main)) return 1;
    const frs = fragmentsOf(k);
    if (!frs.length) return 0;
    return frs.filter((f) => got.includes(f)).length / frs.length;
  });
  return per.reduce((a, b) => a + b, 0) / per.length;
}

const round1 = (n) => Math.round(n * 10) / 10;

/** 整卷评分：逐题得分为精确值，只在展示层取整，避免分次四舍五入导致卷面溢出 100 */
export function gradeQuiz(quiz, picks) {
  const detail = quiz.questions.map((q) => {
    const ratio = gradeQuestion(q, picks[q.no] || '');
    return { no: q.no, ratio, earned: q.maxScore * ratio, correct: ratio >= 0.999 };
  });
  const full = quiz.questions.reduce((s, q) => s + q.maxScore, 0);
  const earned = detail.reduce((s, d) => s + d.earned, 0);
  return { detail, earned: round1(earned), full: round1(full), score: full ? Math.round((Math.min(earned, full) / full) * 100) : 0 };
}
