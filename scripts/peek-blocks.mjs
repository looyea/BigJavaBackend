// 辅助脚本：把指定课程文件里的代码块（含围栏语言与起止行号）导出到 scripts/_tmp.txt
// 用法：node scripts/peek-blocks.mjs networks s1/S1-2-Lesson.md s1/S1-3-Lesson.md
import fs from 'node:fs';
import path from 'node:path';

const [pkg, ...rest] = process.argv.slice(2);
const files = rest.filter((f) => !f.startsWith('--lang=') && !f.startsWith('--skip-lang='));
const only = (rest.find((f) => f.startsWith('--lang=')) || '').split('=')[1];
const skip = (rest.find((f) => f.startsWith('--skip-lang=')) || '').split('=')[1];
const out = [];
for (const f of files) {
  const p = path.join('courses', pkg, f);
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  out.push(`===== ${p} (${lines.length} 行)`);
  let open = -1;
  if (!only && !skip) {
    lines.forEach((l, i) => {
      if (/^```/.test(l)) {
        if (open < 0) open = i;
        else { out.push(`  块 ${open + 1}-${i + 1} 语言=${lines[open].slice(3).trim() || '无'}`); open = -1; }
      }
    });
  }
  // 逐个块打印内容，便于一次性判断需要改哪几行
  open = -1;
  lines.forEach((l, i) => {
    if (/^```/.test(l)) {
      if (open < 0) { open = i; }
      else {
        const lang = lines[open].slice(3).trim();
        const keep = (!only || lang === only) && (!skip || lang !== skip);
        if (keep) out.push(lines.slice(open, i + 1).map((x, k) => `    ${open + k + 1}| ${x}`).join('\n'));
        open = -1;
      }
    }
  });
}
fs.writeFileSync('scripts/_tmp.txt', out.join('\n'), 'utf8');
console.log('ok');
