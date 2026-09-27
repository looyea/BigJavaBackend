// 例子程序规范自检：对照 BigJavaBackend.md「例子程序说明」核验全部已写实课文
// 用法：npm run audit-examples   → 控制台输出统计，明细写入 scripts/_audit.txt
// 规则：①例子必带目的注释 ②行注释给出影响/结果 ③定义必配应用
//      ④每个知识点给正确使用案例 ⑤必须给错误用例并注释后果/异常
import fs from 'fs';
import path from 'path';

const PH = '本节课程正文待补充';
const KINDS = ['Lesson', 'Homework', 'Interview'];
// 真正的"例子程序"：带语言标记且非图示类的代码块
const DIAGRAM = new Set(['', 'flow', 'mermaid', 'text', 'txt', 'ascii', '图']);

const fencesOf = (c) => [...c.matchAll(/```(\w*)\r?\n([\s\S]*?)```/g)];
const codeOf = (c) => fencesOf(c).filter((m) => !DIAGRAM.has(m[1]));
const diagramOf = (c) => fencesOf(c).filter((m) => DIAGRAM.has(m[1]));

function walk(d, acc) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const all = walk('courses', []);
const out = [];
let totalFilled = 0;

for (const kind of KINDS) {
  const filled = all.filter((f) => f.endsWith(`-${kind}.md`) && !fs.readFileSync(f, 'utf8').includes(PH));
  if (kind === 'Lesson') totalFilled = filled.length;
  const rows = [];
  for (const f of filled) {
    const c = fs.readFileSync(f, 'utf8');
    const fc = codeOf(c);
    let lines = 0, commented = 0;
    for (const m of fc) for (const l of m[2].split('\n')) {
      if (!l.trim()) continue;
      lines++;
      // 行内注释：// 或 /* 或 #（含 bash 命令后的尾注释），或含中文说明关键词
      if (/\/\/|\/\*|#|目的|结果|输出|抛|错误|反例|说明|示例|例子/.test(l)) commented++;
    }
    const density = lines ? commented / lines : 1;
    const negInCode = fc.some((m) => /错误|反例|违规|异常|Exception|❌|✗|不合法/.test(m[2]));
    const purposeInCode = fc.some((m) => /例子目的|图目的|目的/.test(m[2]));
    // 图示块（无语言标记）不参与例子程序评分，但必须有"图目的/例子目的"说明行
    const diagramNoPurpose = diagramOf(c).filter((m) => !/目的/.test(m[2])).length;
    rows.push({ file: f.replace(/\\/g, '/'), blocks: fc.length, density: +density.toFixed(2), negInCode, purposeInCode, diagramNoPurpose });
  }
  const A = rows.filter((r) => r.blocks === 0);
  const B = rows.filter((r) => r.blocks > 0 && !r.negInCode);
  const C = rows.filter((r) => r.blocks > 0 && r.density < 0.35);
  const OK = rows.filter((r) => r.blocks > 0 && r.negInCode && r.density >= 0.35);
  const E = rows.filter((r) => r.diagramNoPurpose > 0);
  out.push(`\n===== ${kind}（已写实 ${rows.length} 个文件）=====`);
  out.push(`【A】无例子程序代码块: ${A.length}`);
  A.forEach((r) => out.push('   ' + r.file));
  out.push(`【B】有例子但缺"错误用例"标注: ${B.length}`);
  B.forEach((r) => out.push(`   ${r.file}  blocks=${r.blocks} 目的=${r.purposeInCode}`));
  out.push(`【C】例子注释密度<35%: ${C.length}`);
  C.forEach((r) => out.push(`   ${r.file}  density=${r.density}  blocks=${r.blocks}`));
  out.push(`【E】图示块缺"目的"说明: ${E.length}`);
  E.forEach((r) => out.push(`   ${r.file}  缺 ${r.diagramNoPurpose} 处`));
  out.push(`【D】合规: ${OK.length}`);
}

out.unshift('已写实课文数 = ' + totalFilled);
fs.writeFileSync('scripts/_audit.txt', out.join('\n'), 'utf8');
console.log('Lesson filled=' + totalFilled + '  明细见 scripts/_audit.txt');
