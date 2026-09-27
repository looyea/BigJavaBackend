/* 从 data.js 生成《教学大纲.md》：全站骨架的唯一事实源镜像，逐分区/包/阶段/小节列知识点。
   运行：node scripts/outline.mjs  （改动 data.js 后重新生成，保证大纲与结构一致）*/
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATEGORIES } from '../assets/js/data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* 详略分档：与 app.js depthOf 保持一致（重要级决定讲解深度） */
const DEPTH = {
  5: '核心精讲（源码 + 场景 + 行业实践，逐层深入）',
  4: '重点标准（讲透原理并配实战与权衡）',
  3: '标准概览（够用机制 + 典型示例）',
  2: '简明速览（定位、用法与取舍）',
  1: '了解即可（知道是什么、何时需要）',
};
const depth = (imp) => DEPTH[imp] || DEPTH[3];
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

const lines = [];
lines.push('# Big Java Backend · 教学大纲');
lines.push('');
lines.push('> 本文件由 `data.js` 自动生成（`node scripts/outline.mjs`），是首页各技术大方块的**内容结构总纲**：');
lines.push('> 讲哪些知识点、分几个阶段、每阶段哪些小节、按重要级排定的讲解详略，均以资深架构师视角组织，');
lines.push('> 覆盖电子商务 / 金融 / 电力三类行业的真实所需。填内容时以每小节的知识点清单为准。');
lines.push('');

/* 总览 */
let pkgCount = 0, secCount = 0;
CATEGORIES.forEach((c) => c.packages.forEach((p) => { pkgCount++; p.stages.forEach((s) => { secCount += s.sections.length; }); }));
lines.push(`**总览**：${CATEGORIES.length} 个大技术分区 · ${pkgCount} 个课程包 · ${secCount} 个小节。`);
lines.push('');
lines.push('**推荐学习路径**（分区顺序即地基到上层）：' + CATEGORIES.map((c) => c.name).join(' → ') + '。');
lines.push('');
lines.push('**详略分档图例**：' + Object.values(DEPTH).join('　|　'));
lines.push('');
lines.push('---');
lines.push('');

CATEGORIES.forEach((cat, ci) => {
  lines.push(`## ${ci + 1}、${cat.name}`);
  lines.push('');
  lines.push(`> ${cat.desc}`);
  lines.push('');
  cat.packages.forEach((pkg) => {
    lines.push(`### ${pkg.name}　\`${pkg.id}\``);
    lines.push('');
    lines.push(`- 重要性：${stars(pkg.importance)} ｜ 讲解详略：**${depth(pkg.importance)}**`);
    lines.push(`- 简介：${pkg.desc}`);
    lines.push('');
    pkg.stages.forEach((stage) => {
      lines.push(`#### ${stage.name}`);
      lines.push('');
      stage.sections.forEach((sec) => {
        /* data.js 构建 INDEX 时已把小节元组原地映射为对象 */
        const sid = sec.id, title = sec.title, summary = sec.summary, diff = sec.difficulty, imp = sec.importance;
        lines.push(`- **${sid} · ${title}** ｜ 难度 ${stars(diff)} ｜ 重要 ${stars(imp)} ｜ 详略：${depth(imp).split('（')[0]}`);
        lines.push(`  - 知识点：${summary}`);
      });
      lines.push('');
    });
    lines.push('');
  });
});

writeFileSync(join(ROOT, '教学大纲.md'), lines.join('\n') + '\n', 'utf8');
console.log(`已生成 教学大纲.md：${CATEGORIES.length} 分区 · ${pkgCount} 包 · ${secCount} 小节`);
