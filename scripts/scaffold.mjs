/* 骨架脚手架：为 data.js 里每个小节批量建立 Lesson/Quiz/Homework/Interview 四个 MD 占位文件。
   - 只建缺失的，绝不覆盖已有内容（文件已存在即跳过）。
   - 占位文件带标题 + "待补充" 说明，保证 check.mjs 对非小测文件"至少有一个二级标题"的要求通过；
     小测占位不含标准题（### N.），会被 check.mjs 与前端一起降级为"手动过关"模式，不阻断解锁链。
   用法：node scripts/scaffold.mjs   （改动 data.js 增加小节后重跑即可补齐骨架）*/
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { INDEX, secFile } from '../assets/js/data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const KINDS = ['Lesson', 'Quiz', 'Homework', 'Interview'];
const KIND_CN = { Lesson: '课程', Quiz: '小测验', Homework: '作业题', Interview: '面试题' };

function template(sec, kind) {
  const title = sec.title;
  if (kind === 'Quiz') {
    return `# ${title} · 小测验\n\n`
      + `> 🚧 本节小测待补充。占位期间以前端"手动过关"方式处理，不影响后续小节解锁。\n\n`
      + `## 待补充\n\n`
      + `按约定格式补录题目后即可自动判分（详见规格《小测验多题型判分契约》）：\n\n`
      + `- 题干写成 \`### 1. 题目（5分）\`；多选题干需含"【多选】"；判断题写成 A/B 两个对立选项自动识别。\n`
      + `- 每题用 \`> 答案：\` 给标准答案，简答题用 \`> - 要点\` 列表给出得分关键词。\n`
      + `- 全卷分值合计应为 100。\n`;
  }
  const lead = kind === 'Lesson'
    ? `> 知识点：${sec.summary}\n\n`
    : '';
  const hint = {
    Lesson: '本节课程正文待补充：以资深架构师视角，讲透原理 → 给出可直接落地的代码/配置 → 结合电商、金融、电力场景说明取舍。',
    Homework: '本节作业题待补充：布置 2~4 道能动手验证本知识点的应用题，附验收标准与参考解法。',
    Interview: '本节面试题待补充：给出高频追问链与期望答题要点，覆盖"是什么 / 为什么 / 怎么落地 / 踩过什么坑"。',
  }[kind];
  return `# ${title}${kind === 'Lesson' ? '' : ' · ' + KIND_CN[kind]}\n\n`
    + lead
    + `## 🚧 待补充\n\n`
    + `${hint}\n`;
}

let created = 0, skipped = 0;
for (const sec of Object.values(INDEX.section)) {
  for (const kind of KINDS) {
    const rel = secFile(sec, kind);
    const abs = join(ROOT, rel);
    if (existsSync(abs)) { skipped++; continue; }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, template(sec, kind), 'utf8');
    created++;
  }
}

const total = Object.keys(INDEX.section).length;
console.log(`小节 ${total} 个 · 目标文件 ${total * KINDS.length} 个 · 新建 ${created} · 已存在跳过 ${skipped}`);
