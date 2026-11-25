// คำแนะนำในช่องกรอก (1.0.14)
// ค่าเริ่มต้นของหน่วยงาน + คำใหม่ที่ใช้ในโครงการเดียวกันครบ LEARN_DAYS วัน (นับจากรายงานประจำวัน) — ระบบจำเป็นคำแนะนำให้เอง
// คำนวณจากข้อมูลที่บันทึกไว้ทุกครั้ง จึงใช้ได้ทุกเครื่องและไม่ต้องเก็บแยก
import { store } from './store.js';

/** ใช้คำเดียวกันในโครงการเดียวกันครบกี่วัน จึงจำเป็นคำแนะนำ (ผู้ใช้กำหนด: เกิน 2 วัน) */
export const LEARN_DAYS = 3;

export const DEFAULTS = {
  trade: ['โฟร์แมน', 'วิศวกร', 'ช่างไม้', 'ช่างเหล็ก', 'ช่างปูน', 'ช่างเชื่อม', 'ช่างไฟฟ้า', 'ช่างประปา', 'ช่างทาสี', 'ผู้ปฏิบัติงาน'],
  equip: ['รถแบคโฮ', 'รถเครน', 'รถบรรทุก', 'รถโม่คอนกรีต', 'ปั๊มคอนกรีต', 'รถบดอัด', 'เครื่องตบดิน', 'เครื่องปั่นไฟ', 'นั่งร้าน (ชุด)'],
  unit: ['ลบ.ม.', 'ตร.ม.', 'ม.', 'กก.', 'ตัน', 'ชุด', 'จุด', 'ต้น', 'เส้น', 'แผ่น', 'ท่อน', 'ถุง', 'คัน', 'งาน', 'แห่ง', 'ตัว', 'บาน', 'เที่ยว'],
  work: [], mat: [], req: [], cap: [],
  // 1.0.17 แผนงานความปลอดภัย (F-04-03-08)
  safety: ['ปฐมนิเทศความปลอดภัยผู้ปฏิบัติงานใหม่', 'ประชุมความปลอดภัยก่อนเริ่มงาน (Toolbox Talk)', 'ตรวจอุปกรณ์ป้องกันอันตรายส่วนบุคคล (PPE)',
    'ติดตั้งป้ายเตือนและแผงกั้นพื้นที่ทำงาน', 'ตรวจสภาพเครื่องจักรและเครื่องมือ', 'ตรวจนั่งร้านและการทำงานบนที่สูง', 'ตรวจระบบไฟฟ้าชั่วคราวในหน่วยงาน',
    'ขออนุญาตทำงานที่มีความร้อน/ประกายไฟ (Hot Work Permit)', 'ตรวจถังดับเพลิงและอุปกรณ์ปฐมพยาบาล', 'ซ้อมแผนฉุกเฉิน/อพยพ',
    'ตรวจความปลอดภัยประจำสัปดาห์ร่วมกับ จป. กฟผ.', 'รายงานผลการดำเนินงานด้านความปลอดภัยประจำเดือน', 'ดูแลความสะอาดและความเป็นระเบียบในพื้นที่ (5ส)'],
};
/** ตำแหน่ง "กรรมกร" ใช้คำว่า "ผู้ปฏิบัติงาน" (1.0.14) */
export const tradeLabel = (t) => (String(t || '').trim() === 'กรรมกร' ? 'ผู้ปฏิบัติงาน' : String(t || '').trim());

/** หน่วยงานก่อสร้างที่รู้จัก (ตรงทั้งคำ) */
const UNIT_RE = /^(?:ลบ\.?ม\.?|ตร\.?ม\.?|ม\.|เมตร|ตารางเมตร|ลูกบาศก์เมตร|คิว|กก\.?|กิโลกรัม|ตัน|ต้น|จุด|ชุด|เส้น|แผ่น|ท่อน|ลิตร|คัน|ถุง|ก้อน|อัน|ตัว|ชิ้น|หลุม|ช่อง|บาน|ม้วน|กล่อง|ถัง|เที่ยว|งาน|แห่ง|m3|m2|m|kg|ton|pcs|set|lot|%)$/i;
const NUM_RE = /^\d[\d,]*(?:\.\d+)?$/;
const NUM_UNIT_RE = /^(\d[\d,]*(?:\.\d+)?)([^\d,.][^\d]{0,15})$/;
export const isUnit = (u) => DEFAULTS.unit.includes(String(u || '').trim()) || UNIT_RE.test(String(u || '').trim());
/**
 * แยกบรรทัดงาน/วัสดุ: "รายการ<TAB>ปริมาณ หน่วย" (บันทึกจากช่องแยก) หรือ "รายการ 45 ลบ.ม." (พิมพ์รวม) → [รายการ, ปริมาณ, หน่วย]
 * พิมพ์รวมในบรรทัดเดียว: นับเป็นปริมาณเมื่อมีหน่วยงานก่อสร้างต่อท้ายเท่านั้น (กัน "ชั้น 2" ถูกนับเป็นปริมาณ)
 * แยกด้วยคำ ไม่ใช้ regex ย้อนรอย — ข้อความยาวผิดปกติก็ไม่ช้า (1.0.14)
 */
export function splitLine(line) {
  const s = String(line || '').trim();
  if (!s) return ['', '', ''];
  const tab = s.indexOf('\t');
  if (tab >= 0) {
    const desc = s.slice(0, tab).trim();
    const rest = s.slice(tab + 1).trim().replace(/^จำนวน\s*/, '');
    const sp = rest.indexOf(' ');
    const q = sp >= 0 ? rest.slice(0, sp) : rest;
    if (NUM_RE.test(q)) return [desc, q, sp >= 0 ? rest.slice(sp + 1).trim() : ''];
    const m = NUM_UNIT_RE.exec(rest);
    return m ? [desc, m[1], m[2].trim()] : [desc, '', rest];
  }
  const toks = s.split(/\s+/);
  let k = toks.length, num = '', unit = '';
  if (k >= 3 && NUM_RE.test(toks[k - 2]) && !NUM_RE.test(toks[k - 1]) && isUnit(toks[k - 1])) { num = toks[k - 2]; unit = toks[k - 1]; k -= 2; }
  else if (k >= 2) {
    const m = NUM_UNIT_RE.exec(toks[k - 1]);
    if (m && isUnit(m[2])) { num = m[1]; unit = m[2]; k -= 1; }
  }
  if (num) {
    if (toks[k - 1] === 'จำนวน') k -= 1;
    const desc = toks.slice(0, k).join(' ');
    if (desc.length > 1) return [desc, num, unit];
  }
  return [s, '', ''];
}
/** แถว → บรรทัดข้อความที่เก็บในรายงาน */
export function joinLine(desc, qty, unit) {
  const d = String(desc || '').replace(/\s+/g, ' ').trim();
  const q = String(qty || '').trim();
  if (!d) return '';
  return q ? `${d}\t${q}${String(unit || '').trim() ? ` ${String(unit).trim()}` : ''}` : d;
}
const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 120);

/** คำที่ใช้ในโครงการครบ LEARN_DAYS วันขึ้นไป แยกตามชนิดช่อง (เรียงตามจำนวนวันที่ใช้) */
export function learned(pid) {
  const bag = {};
  const add = (kind, term, date) => {
    const t = norm(term);
    if (!t || t.length < 2) return;
    const k = t.toLowerCase();
    bag[kind] = bag[kind] || new Map();
    const o = bag[kind].get(k) || { t, days: new Set() };
    o.days.add(date);
    bag[kind].set(k, o);
  };
  for (const d of store.dailyOf(pid, '*')) {
    (d.rows || []).forEach((r) => { add('work', r.w, d.date); add('unit', r.u, d.date); });
    const day = d.date;
    (d.manpower || []).forEach((r) => add('trade', tradeLabel(r.trade), day));
    (d.equipment || []).forEach((r) => add('equip', r.name, day));
    String(d.work || '').split(/\r?\n/).forEach((ln) => { const [w, , u] = splitLine(ln); add('work', w, day); add('unit', u, day); });
    String(d.materials || '').split(/\r?\n/).forEach((ln) => { const [w, , u] = splitLine(ln); add('mat', w, day); add('unit', u, day); });
    (d.request || []).forEach((r) => { add('req', r.work, day); add('work', r.work, day); add('unit', r.unit, day); });
    Object.values(d.captions || {}).forEach((c) => add('cap', c, day));
  }
  const out = {};
  Object.keys(bag).forEach((kind) => {
    out[kind] = [...bag[kind].values()].filter((o) => o.days.size >= LEARN_DAYS).sort((a, b) => b.days.size - a.days.size).map((o) => o.t);
  });
  return out;
}

/** คำแนะนำของช่องหนึ่ง: คำที่โครงการใช้บ่อย (จำไว้) ก่อน แล้วตามด้วยค่าเริ่มต้น */
export function suggestions(pid, kind, cache) {
  const l = cache || (pid ? learned(pid) : {});
  const seen = new Set();
  return [...(l[kind] || []), ...(DEFAULTS[kind] || [])].filter((t) => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 300);
}
/** คำแนะนำทุกชนิดช่อง (ส่งให้หน้าต่างแบบฟอร์ม) */
export function allSuggestions(pid) {
  const l = pid ? learned(pid) : {};
  const out = {};
  Object.keys(DEFAULTS).forEach((k) => { out[k] = suggestions(pid, k, l); });
  return out;
}
