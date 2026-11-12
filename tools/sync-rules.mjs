// คัดลอกโค้ดที่ใช้ร่วมกันไปไว้ท้าย backend/Code.gs
//  - กฎกลาง assets/js/rules.js        → ระหว่างบรรทัด RULES BEGIN / RULES END
//  - การคำนวณ assets/js/calc.js (1.0.5) → ระหว่างบรรทัด CALC BEGIN / CALC END (ห่อเป็น PTCalc ให้ Apps Script คำนวณผลงาน/แผนเหมือนหน้าเว็บ)
// ใช้หลังแก้ rules.js หรือ calc.js:   node tools/sync-rules.mjs
// ตรวจว่าตรงกันหรือไม่:             node tools/sync-rules.mjs --check
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gsPath = join(root, 'backend/Code.gs');
const rules = readFileSync(join(root, 'assets/js/rules.js'), 'utf8').trimEnd();

/** calc.js (ES module) → IIFE ที่ไม่ประกาศชื่อซ้ำกับฟังก์ชันใน Code.gs */
function calcBlock() {
  const src = readFileSync(join(root, 'assets/js/calc.js'), 'utf8').trimEnd();
  if (/^\s*import\s/m.test(src)) throw new Error('calc.js ต้องไม่ import ไฟล์อื่น');
  const names = [...src.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
  const body = src.replace(/^export /gm, '');
  return `var PTCalc = (function () {\n${body}\n\nreturn { ${names.map((n) => `${n}: ${n}`).join(', ')} };\n})();`;
}

function section(gs, tag, content, check) {
  const begin = gs.search(new RegExp(`^// =+ ${tag} BEGIN.*$`, 'm'));
  const endMatch = new RegExp(`^// =+ ${tag} END =+$`, 'm').exec(gs);
  if (begin < 0 || !endMatch) { console.error(`ไม่พบบรรทัด ${tag} BEGIN / ${tag} END ใน Code.gs`); process.exit(1); }
  const beginLineEnd = gs.indexOf('\n', begin) + 1;
  const current = gs.slice(beginLineEnd, endMatch.index).trimEnd();
  if (check) return { gs, same: current === content };
  return { gs: `${gs.slice(0, beginLineEnd)}${content}\n${gs.slice(endMatch.index)}`, same: current === content };
}

const check = process.argv.includes('--check');
let gs = readFileSync(gsPath, 'utf8');
const a = section(gs, 'RULES', rules, check);
gs = a.gs;
const b = section(gs, 'CALC', calcBlock(), check);
gs = b.gs;
if (check) {
  if (a.same && b.same) { console.log('Code.gs มีกฎและการคำนวณตรงกับ rules.js / calc.js'); process.exit(0); }
  console.error(`Code.gs ยังไม่ตรงกับ ${[!a.same && 'rules.js', !b.same && 'calc.js'].filter(Boolean).join(' และ ')} — รัน node tools/sync-rules.mjs`);
  process.exit(1);
}
writeFileSync(gsPath, gs);
console.log('คัดลอก rules.js และ calc.js ไปที่ Code.gs แล้ว');
