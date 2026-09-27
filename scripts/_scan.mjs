// 一次性扫描：按 data.js 推荐顺序统计各课程包 Lesson 写实/占位状态
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../assets/js/data.js';

const PLACE = '本节课程正文待补充';
const ROOT = path.resolve(import.meta.dirname, '..');
const out = [];
for (const cat of CATEGORIES) {
  for (const pkg of cat.packages) {
    let filled = 0, ph = 0;
    for (const st of pkg.stages) {
      for (const sec of st.sections) {
        const p = path.join(ROOT, 'courses', pkg.id, st.id, sec.id + '-Lesson.md');
        const t = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
        if (!t || t.includes(PLACE)) ph++; else filled++;
      }
    }
    out.push(`${cat.name} | ${pkg.id} | sec=${filled + ph} | filled=${filled} | placeholder=${ph}`);
  }
}
console.log(out.join('\n'));
