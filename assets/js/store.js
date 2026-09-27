/* 进度存储：localStorage 为主，Markdown 进度文件为辅（可导入/导出，满足"进度文件必须是 Markdown"） */
import { CATEGORIES, INDEX, secKey } from './data.js?v=13';

const LS_PROGRESS = 'bjb.progress.v1';
const LS_THEME = 'bjb.theme';
const PASS_LINE = 60;

let progress = load();

function load() {
  try {
    return JSON.parse(localStorage.getItem(LS_PROGRESS) || '{}');
  } catch { return {}; }
}

function save() {
  localStorage.setItem(LS_PROGRESS, JSON.stringify(progress));
}

/* ---------- 状态查询 ---------- */

export const sectionRecord = (sec) => progress[secKey(sec)] || null;
export const isPassed = (sec) => !!progress[secKey(sec)]?.passed;

/** 包内小节的全局顺序（阶段顺序 → 小节顺序），用于逐关解锁 */
function orderedSections(pkgId) {
  return (INDEX.pkg[pkgId]?.stages || []).flatMap((s) => s.sections);
}

/** 解锁规则：同一大技术包内必须按顺序过关；不同包之间互不限制 */
export function isUnlocked(sec) {
  const list = orderedSections(sec.pkg);
  const idx = list.findIndex((s) => s.id === sec.id && s.stage === sec.stage);
  if (idx <= 0) return true;
  return isPassed(list[idx - 1]);
}

export function nextSection(sec) {
  const list = orderedSections(sec.pkg);
  const idx = list.findIndex((s) => s.id === sec.id && s.stage === sec.stage);
  return idx >= 0 && idx + 1 < list.length ? list[idx + 1] : null;
}

export function stageStats(pkgId, stageId) {
  const stage = (INDEX.pkg[pkgId]?.stages || []).find((s) => s.id === stageId);
  const total = stage?.sections.length || 0;
  const done = (stage?.sections || []).filter(isPassed).length;
  return { total, done, complete: total > 0 && done === total };
}

export function pkgStats(pkgId) {
  const list = orderedSections(pkgId);
  return { total: list.length, done: list.filter(isPassed).length };
}

export function siteStats() {
  let total = 0, done = 0;
  Object.values(INDEX.pkg).forEach((p) => {
    const s = pkgStats(p.id);
    total += s.total; done += s.done;
  });
  return { total, done, sections: Object.keys(progress).filter((k) => progress[k].passed).length };
}

/* ---------- 过关写入 ---------- */

/** 提交小测得分；返回是否新通过以及下一节 */
export function submitQuiz(sec, score) {
  const key = secKey(sec);
  const prev = progress[key] || {};
  const passed = score >= PASS_LINE;
  progress[key] = {
    ...prev,
    score: Math.max(prev.score || 0, score),
    passed: !!prev.passed || passed,
    at: stamp(),
  };
  save();
  const stage = stageStats(sec.pkg, sec.stage);
  const next = nextSection(sec);
  return { passed, stageComplete: stage.complete, next, unlockedNext: passed ? next : null };
}

export function resetAll() { progress = {}; save(); }

/** 自定义格式的小测（不自动判分）：人工标记本小节已完成 */
export function markManual(sec) {
  const key = secKey(sec);
  const prev = progress[key] || {};
  progress[key] = { ...prev, score: prev.score ?? null, passed: true, manual: true, at: stamp() };
  save();
  const stage = stageStats(sec.pkg, sec.stage);
  const next = nextSection(sec);
  return { passed: true, stageComplete: stage.complete, next };
}

/* ---------- 主题 ---------- */

export const getTheme = () => localStorage.getItem(LS_THEME) || 'dark';
export const setTheme = (t) => localStorage.setItem(LS_THEME, t);

/* ---------- Markdown 进度文件 ---------- */

const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

/** 生成 Markdown 进度文件内容 */
export function toMarkdown() {
  const lines = [
    '# Big Java Backend 学习进度文件',
    '',
    '> 本文件由网站自动导出，可通过「进度」页导入以恢复解锁状态。',
    '',
    `- 导出时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    `- 已通过小节：${siteStats().sections}`,
    '',
    '## 小节进度',
    '',
    '| 小节键 | 小节标题 | 最高得分 | 状态 | 最后提交 |',
    '| --- | --- | --- | --- | --- |',
  ];
  const entries = Object.entries(progress);
  if (!entries.length) {
    lines.push('| - | - | 0 | 未通过 | - |');
  }
  entries.forEach(([key, v]) => {
    const score = v.score === null || v.score === undefined ? '-' : v.score;
    const status = v.passed ? (v.manual && score === '-' ? '手动通过' : '通过') : '未通过';
    lines.push(`| \`${key}\` | ${INDEX.section[key]?.title || ''} | ${score} | ${status} | ${v.at || '-'} |`);
  });
  lines.push('', '## 阶段完成情况', '');
  CATEGORIES.forEach((cat) => cat.packages.forEach((pkg) => pkg.stages.forEach((st) => {
    const s = stageStats(pkg.id, st.id);
    if (s.done) lines.push(`- [${s.complete ? 'x' : ' ' }] ${pkg.name} / ${st.name}（${s.done}/${s.total}）`);
  })));
  return lines.join('\n') + '\n';
}

/** 解析 Markdown 进度文件，返回恢复的小节数 */
export function fromMarkdown(md) {
  let restored = 0;
  md.replace(/\r\n/g, '\n').split('\n').forEach((line) => {
    if (!line.startsWith('|')) return;
    const cells = line.split('|').map((c) => c.trim().replace(/^`|`$/g, ''));
    // 列序：小节键 | 小节标题 | 最高得分 | 状态 | 最后提交
    if (cells.length < 6 || !cells[1].includes('#')) return;
    const [rawKey, score, status, at] = [cells[1], cells[3], cells[4], cells[5]];
    const key = rawKey.toLowerCase();          // 兼容手写的进度文件（编号可能写成大写）
    if (!INDEX.section[key]) return;
    const num = Number(score);
    progress[key] = {
      score: Number.isFinite(num) && score !== '-' && score !== '' ? num : null,
      passed: /通过/.test(status) && status !== '未通过',
      manual: status === '手动通过',
      at: at && at !== '-' ? at : '',
    };
    restored++;
  });
  save();
  return restored;
}

/** 启动时尝试读取仓库自带的进度文件（若通过 HTTP 服务访问） */
export async function seedFromFile() {
  try {
    const res = await fetch('progress/progress.md', { cache: 'no-store' });
    if (!res.ok) return 0;
    return fromMarkdown(await res.text());
  } catch { return 0; }
}

/** 下载 Markdown 文件 */
export function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
