// แบบฟอร์มมาตรฐานในระบบ (1.0.5) — ทุกโครงการใช้แบบเดียวกัน พิมพ์ได้ทันที และกรอกข้อมูลโครงการให้อัตโนมัติ
// เปิดเป็นหน้าพิมพ์ขนาด A4 ในแท็บใหม่ (บันทึกเป็น PDF ได้จากหน้าต่างพิมพ์ของเบราว์เซอร์)
// 1.0.11: แบบฟอร์มทางการตามคู่มือ QP-CMD-MS-005 การควบคุมงานก่อสร้าง (official: true) จัดหน้าตามต้นฉบับ
//   FM-001 รายละเอียดผลการตรวจวัสดุก่อสร้าง · FM-002 บันทึกการควบคุมงานประจำวัน (แทน PT-F02 เดิม) — ไม่มีตรา CONTROLLED
import { store } from './store.js';
import { analyze } from './calc.js';
import { download } from './ui.js';

const R = globalThis.PTRules;
const e = (s) => R.esc(s);
const d = (iso) => (iso ? R.thaiDateTime(iso, false) : '');
const dt = (iso) => (iso ? R.thaiDateTime(iso) : '');
const line = (w = '100%') => `<span class="fill" style="min-width:${w}">&nbsp;</span>`;
const val = (v, w) => (v === '' || v == null ? line(w) : `<span class="fill">${e(v)}</span>`);
const pct = (r) => (r == null || Number.isNaN(+r) ? '' : `${(+r * 100).toFixed(2)}%`);

/** รายการแบบฟอร์ม: code, ชื่อ, ใช้เมื่อไร, ต้องมีอะไร */
export const FORMS = {
  sub: { code: 'PT-F01', title: 'ใบขออนุมัติ / แจ้งเรื่องของผู้รับจ้าง', use: 'ผู้รับจ้างยื่นขออนุมัติวัสดุ แบบ แผนงาน หรือแจ้งปัญหา — พิมพ์จากเรื่องขออนุมัติได้พร้อมผลการพิจารณาทุกขั้น', where: 'เรื่องขออนุมัติ' },
  material: { code: 'FM-001/QP-CMD-MS-005', short: 'FM-001', official: true, title: 'รายละเอียดผลการตรวจวัสดุก่อสร้าง', use: 'ผู้ควบคุมงานบันทึกผลการตรวจวัสดุที่นำเข้าใช้งาน เทียบขนาด/รูปแบบของตัวอย่างกับมาตรฐาน — แบบฟอร์มตามคู่มือ QP-CMD-MS-005', where: 'เรื่องขออนุมัติวัสดุ · รายงานประจำวัน', pdf: 'templates/egat/FM-001_QP-CMD-MS-005.pdf' },
  daily: { code: 'FM-002/QP-CMD-MS-005', short: 'FM-002', official: true, title: 'บันทึกการควบคุมงานประจำวัน', use: 'รายละเอียดและปริมาณงาน ปัญหาและการแก้ไข วัสดุนำเข้า ผู้ปฏิบัติงานและเครื่องจักรทุนแรง — แบบฟอร์มตามคู่มือ QP-CMD-MS-005 (ระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 178)', where: 'รายงานประจำวัน', pdf: 'templates/egat/FM-002_QP-CMD-MS-005.pdf' },
  weekly: { code: 'PT-F03', title: 'รายงานผลการปฏิบัติงานประจำสัปดาห์', use: 'ผู้ควบคุมงานรายงานคณะกรรมการตรวจรับพัสดุทุกสัปดาห์ สรุปจากรายงานประจำวัน', where: 'รายงานประจำวัน' },
  meeting: { code: 'PT-F04', title: 'บันทึกการประชุม', use: 'บันทึกการประชุมโครงการ พร้อมรายชื่อผู้เข้าร่วมและงานที่มอบหมาย', where: 'การประชุม' },
  inspect: { code: 'PT-F05', title: 'บันทึกการตรวจรับงานจ้าง (งวดงาน)', use: 'คณะกรรมการตรวจรับพัสดุตรวจรับงานงวด — มีช่องลงนามตามลำดับกรรมการของโครงการ', where: 'ส่งมอบ/ตรวจรับงาน' },
  instruction: { code: 'PT-F06', title: 'ใบสั่งการ / ข้อแนะนำของผู้ควบคุมงาน', use: 'แจ้งข้อสั่งการหรือข้อแนะนำเป็นลายลักษณ์อักษรต่อผู้รับจ้าง พร้อมช่องรับทราบ', where: 'รายงานประจำวัน' },
};

/** ต้นฉบับ PDF ของ กฟผ. (เอาตรา CONTROLLED ออกแล้ว) — templates/egat/ */
export const EGAT_ORIGINALS = [
  { label: 'FM-001', title: 'รายละเอียดผลการตรวจวัสดุก่อสร้าง', href: 'templates/egat/FM-001_QP-CMD-MS-005.pdf' },
  { label: 'FM-002', title: 'บันทึกการควบคุมงานประจำวัน', href: 'templates/egat/FM-002_QP-CMD-MS-005.pdf' },
  { label: 'QP-CMD-MS-005', title: 'คู่มือ หน้า 15–17 และแบบฟอร์มทั้งชุด', href: 'templates/egat/QP-CMD-MS-005_forms.pdf' },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; }
body { font-family: 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif; font-size: 14.5px; line-height: 1.55; color: #111; margin: 0; background: #E9EBE6; }
.sheet { background: #fff; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 14mm; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
.bar { position: sticky; top: 0; background: #1D4F91; color: #fff; padding: 8px 14px; display: flex; gap: 10px; align-items: center; font-family: Tahoma, sans-serif; font-size: 13px; z-index: 2; }
.bar button { font: inherit; padding: 6px 14px; border-radius: 3px; border: 0; cursor: pointer; background: #fff; color: #1D4F91; font-weight: 700; }
.bar button.ghost { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.4); font-weight: 400; }
.bar span { opacity: .8; }
header.fh { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 10px; }
header.fh .org { font-weight: 700; font-size: 15px; }
header.fh .code { text-align: right; font-size: 12px; color: #444; }
h1 { text-align: center; font-size: 19px; margin: 6px 0 12px; }
h2 { font-size: 15px; margin: 14px 0 6px; border-left: 4px solid #F2A900; padding-left: 8px; }
table { width: 100%; border-collapse: collapse; }
table.grid td, table.grid th { border: 1px solid #555; padding: 4px 6px; vertical-align: top; }
table.grid th { background: #F0F1EC; font-weight: 600; text-align: left; }
table.info td { padding: 3px 4px; vertical-align: top; }
table.info td.k { white-space: nowrap; color: #333; width: 1%; padding-right: 10px; }
.fill { display: inline-block; border-bottom: 1px dotted #555; min-height: 1.4em; padding: 0 4px; }
.box { border: 1px solid #555; padding: 6px 8px; min-height: 64px; white-space: pre-wrap; }
.box.tall { min-height: 120px; }
.lines div { border-bottom: 1px dotted #555; height: 1.75em; }
.r { text-align: right; } .c { text-align: center; } .muted { color: #555; } .small { font-size: 12.5px; }
.ck { display: inline-block; width: 13px; height: 13px; border: 1px solid #333; vertical-align: -2px; margin-right: 4px; text-align: center; line-height: 11px; font-size: 11px; }
.signs { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 22px 18px; margin-top: 26px; page-break-inside: avoid; }
.sign { text-align: center; font-size: 13.5px; }
.sign .ln { border-bottom: 1px dotted #333; height: 34px; margin: 0 12px 4px; }
.sign small { display: block; color: #444; }
footer.ff { margin-top: 18px; font-size: 11px; color: #666; border-top: 1px solid #ccc; padding-top: 4px; display: flex; justify-content: space-between; }
.nb { page-break-inside: avoid; }
@media print { body { background: #fff; } .bar { display: none; } .sheet { box-shadow: none; margin: 0; width: auto; min-height: 0; padding: 0; } }
`;

function head(kind, p) {
  const f = FORMS[kind];
  const org = store.settings.orgName || 'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย';
  return `<header class="fh"><div><div class="org">${e(org)}</div><div class="small muted">${p ? e(`${p.code ? `${p.code} ` : ''}${p.name}`) : 'โครงการ ……………………………………………'}</div></div>
    <div class="code">แบบ ${f.code}<br>ระบบติดตามโครงการ</div></header><h1>${e(f.title)}</h1>`;
}
function foot(kind) {
  return `<footer class="ff"><span>${FORMS[kind].code} · พิมพ์เมื่อ ${e(R.thaiDateTime(new Date().toISOString()))}</span><span>${e(store.me.name || store.me.email || '')}</span></footer>`;
}
function projectInfo(p, extra = []) {
  const rows = [
    ['โครงการ', p ? `${p.code ? `${p.code} ` : ''}${p.name}` : ''],
    ['เลขที่สัญญา', p?.contractNo || ''],
    ['ผู้รับจ้าง', p?.contractor || ''],
    ['ระยะเวลาสัญญา', p?.startDate ? `${d(p.startDate)} – ${d(p.endDate)}` : ''],
    ...extra,
  ];
  return `<table class="info">${rows.map(([k, v]) => `<tr><td class="k">${e(k)}</td><td>${typeof v === 'object' && v?.html ? v.html : val(v, '70%')}</td></tr>`).join('')}</table>`;
}
const sign = (role, name = '', date = '') => `<div class="sign"><div class="ln"></div>(${name ? e(name) : '……………………………………'})<small>${e(role)}</small><small>วันที่ ${date ? e(d(date)) : '……/……/……'}</small></div>`;
const signs = (list) => `<div class="signs">${list.join('')}</div>`;
const blankLines = (n) => `<div class="lines">${'<div></div>'.repeat(n)}</div>`;
const nameOf = (p, email) => (p ? R.memberName(p, email) : '') || email || '';
const supervisors = (p) => (p ? R.members(p).filter((m) => m.role === 'supervisor' || (m.role === 'owner' && R.ownerActsAs(p) === 'supervisor')) : []);
const committee = (p) => (p ? R.committeeSeats(p).slice().sort((a, b) => (+a.seat === 0 ? -1 : +b.seat === 0 ? 1 : +a.seat - +b.seat)) : []);

// ---------- แบบฟอร์มทางการ QP-CMD-MS-005 (จัดหน้าตามต้นฉบับ ไม่มีตรา CONTROLLED) ----------
const OFFICIAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Taviraj:wght@400;600&display=swap');
@page { size: A4; margin: 0; }
/* ตัวอักษรใกล้เคียงต้นฉบับ (Angsana New) — Taviraj จาก Google Fonts ถ้าออฟไลน์ใช้ฟอนต์ไทยในเครื่อง */
body.official .sheet { width: 210mm; height: 297mm; overflow: hidden; padding: 21mm 14mm 30mm 18mm; display: flex; flex-direction: column;
  font-family: 'Taviraj', 'Angsana New', 'AngsanaUPC', 'TH Sarabun New', serif; font-size: 12.6px; line-height: 1.4; }
body.official.of-long .sheet { height: auto; min-height: 297mm; overflow: visible; }
body.official .of-main { flex: 1 0 auto; }
.of-title { text-align: center; font-size: 20.5px; margin: 0 0 1.5mm; }
.of-sub { text-align: center; font-size: 13.6px; margin: 0 0 1.2mm; }
table.of { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.of td, table.of th { border: 1px solid #000; padding: 1px 5px; height: 24px; font-weight: 400; vertical-align: middle; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
table.of td.wrap { white-space: normal; }
table.of th { text-align: center; }
table.of td.c { text-align: center; }
table.of .v { font-weight: 600; }
table.of tr.big td { height: 60px; text-align: center; font-size: 15.5px; }
table.of tr.blank td { height: 18.5px; }
table.of tr.head2 th { height: 36px; }
.lf { display: flex; align-items: baseline; gap: 3px; min-width: 0; }
.lf > span:first-child { flex: none; }
.lf .dl { flex: 1; min-width: 12px; border-bottom: 1px dotted #000; height: 1.05em; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; line-height: 1; font-weight: 600; }
.lf .dl.has { border-bottom: 0; height: auto; line-height: 1.4; }
.sp { display: inline-flex; gap: 4px; align-items: baseline; }
.of-gap { height: 5.2mm; }
.of-sign { margin: 8mm 0 0 auto; width: 46%; text-align: center; line-height: 2; }
.of-sign .ln { display: block; width: 58%; margin: 0 auto; border-bottom: 1px dotted #000; height: 1.6em; }
.of-sign .nm { display: inline-flex; gap: 2px; align-items: baseline; }
.of-sign .nm .dl { display: inline-block; min-width: 150px; border-bottom: 1px dotted #000; height: 1.1em; }
.of-notes { margin-top: 3mm; } .of-notes ol { margin: 2mm 0 0 17mm; padding: 0; } .of-notes li { margin-bottom: 1.5mm; }
.u { text-decoration: underline; }
table.of-foot { width: 100%; border-collapse: collapse; margin-top: 5mm; }
table.of-foot td { border: 1px solid #000; padding: 4px 8px; text-align: center; }
@media print { body.official .sheet { margin: 0; box-shadow: none; } body.official:not(.of-long) .sheet { height: 297mm; } }
`;
/** ช่อง "หัวข้อ......" แบบ FM-001: มีค่า = แสดงค่า · ไม่มีค่า = เส้นประยาวถึงขอบช่อง */
const lf = (label, v) => `<div class="lf"><span>${e(label)}</span><span class="dl ${v === '' || v == null ? '' : 'has'}">${v === '' || v == null ? '' : e(v)}</span></div>`;
/** ช่องแบบ FM-002: หัวข้อแล้วตามด้วยค่า (ต้นฉบับไม่มีเส้นประ) */
const pv = (label, v) => `<span class="sp"><span>${e(label)}</span>${v === '' || v == null ? '' : `<span class="v">${e(v)}</span>`}</span>`;
/** ท้ายกระดาษตามต้นฉบับ (รหัสเอกสารและครั้งที่แก้ไข) */
const ofFoot = (kind) => `<table class="of-foot"><tr><td style="width:40%">รองผู้ว่าการธุรกิจเกี่ยวเนื่อง</td><td>รหัสเอกสาร ${e(FORMS[kind].code)}</td><td style="width:20%">แก้ไขครั้งที่ 00</td></tr></table>`;
const ORG = 'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย';
/** แยก "ขุดดินฐานราก 45 ลบ.ม." → [รายการ, ปริมาณ] — รับเฉพาะตัวเลขที่ตามด้วยหน่วยงานก่อสร้าง (กัน "ชั้น 2" ถูกนับเป็นปริมาณ) */
const UNIT = '(?:ลบ\\.?ม\\.?|ตร\\.?ม\\.?|ม\\.|เมตร|ตารางเมตร|ลูกบาศก์เมตร|คิว|กก\\.?|กิโลกรัม|ตัน|ต้น|จุด|ชุด|เส้น|แผ่น|ท่อน|ลิตร|คัน|ถุง|ก้อน|อัน|ตัว|ชิ้น|หลุม|ช่อง|บาน|ม้วน|กล่อง|ถัง|เที่ยว|งาน|แห่ง|m3|m2|m|kg|ton|pcs|set|lot|%)';
const QTY_RE = new RegExp(`^(.+?)[\\s:]+((?:จำนวน\\s*)?\\d[\\d,]*(?:\\.\\d+)?\\s*${UNIT})$`, 'i');
function splitQty(text) {
  const t = String(text || '').replace(/^\\s*(?:\\d+[.)]|[-•·])\\s+/, '').trim();
  const m = t.match(QTY_RE);
  return m && m[1].length > 1 ? [m[1].trim(), m[2].trim()] : [t, ''];
}
const linesOf = (text) => String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const pad = (list, n, blank) => { const out = list.slice(); while (out.length < n) out.push(blank); return out; };
const contractorRep = (p) => p?.contractorRep || (p ? (R.members(p).find((m) => m.role === 'contractor')?.name || '') : '');
const supervisorName = (p) => p?.manager || (supervisors(p)[0] ? nameOf(p, supervisors(p)[0].email) : '');

// ---------- FM-001/QP-CMD-MS-005 รายละเอียดผลการตรวจวัสดุก่อสร้าง ----------
function formMaterial({ p, sub, date }) {
  const mat = sub ? String(sub.title || '').replace(/^ขออนุมัติ(?:ใช้)?\s*/, '') : '';
  const when = sub ? d(sub.closedAt || sub.submittedAt) : (date ? d(date) : '');
  const rows = pad([], 9, '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('');
  const sup = supervisorName(p);
  return `<div class="of-main">
  <div class="of-title">${e(ORG)}</div>
  <table class="of">
    <colgroup><col style="width:33.3%"><col style="width:30.8%"><col style="width:35.9%"></colgroup>
    <tr><td colspan="3">${lf('งานก่อสร้าง', p ? `${p.code ? `${p.code} ` : ''}${p.name}` : '')}</td></tr>
    <tr><td colspan="2">${lf('สถานที่', p?.location)}</td><td>${lf('เลขที่งาน (PM-Orderกอง)', p?.pmOrder)}</td></tr>
    <tr><td colspan="2">${lf('ผู้รับจ้าง', p?.contractor)}</td><td>${lf('สัญญาเลขที่', p?.contractNo)}</td></tr>
    <tr class="big"><td colspan="3">รายละเอียดผลการตรวจวัสดุก่อสร้าง</td></tr>
    <tr><td colspan="2">${lf('วัสดุ', mat)}</td><td>${lf('วันที่', when)}</td></tr>
    <tr><td>${lf('จำนวนนำเข้าใช้งาน', '')}</td><td>${lf('จำนวนสุ่มตรวจ', '')}</td><td>${lf('มาตรฐานของวัสดุ', '')}</td></tr>
  </table>
  <div class="of-gap"></div>
  <table class="of">
    <colgroup><col style="width:32.5%"><col style="width:13.7%"><col style="width:14.3%"><col style="width:19.5%"><col style="width:20%"></colgroup>
    <tr class="head2"><th rowspan="2">รายละเอียดวัสดุ</th><th colspan="2">ขนาด หรือรูปแบบของวัสดุ</th><th rowspan="2">ผลการตรวจ</th><th rowspan="2">หมายเหตุ</th></tr>
    <tr class="head2"><th>ตัวอย่าง</th><th>มาตรฐาน</th></tr>
    ${rows}
  </table>
  <div class="of-sign"><span class="ln"></span><span class="nm">(${sup ? `<span class="v">${e(sup)}</span>` : '<span class="dl"></span>'})</span><br>ผู้ควบคุมงาน</div>
  <div class="of-notes">หมายเหตุ
    <ol>
      <li>มาตรฐานที่ใช้อ้างอิง เป็นมาตรฐานของผู้ออกแบบ หรือมาตรฐานของผู้ผลิต หรือมาตรฐานสากลที่สามารถยอมรับได้</li>
      <li>จำนวนตัวอย่างตรวจสอบ ตามข้อกำหนดของผู้ออกแบบ<br>หรือตามข้อกำหนดของผลิตภัณฑ์ หรือตามข้อกำหนดของมาตรฐานสากลที่สามารถยอมรับได้</li>
    </ol>
  </div></div>
  ${ofFoot('material')}`;
}

// ---------- FM-002/QP-CMD-MS-005 บันทึกการควบคุมงานประจำวัน ----------
function formDaily({ p, daily: dy, date }) {
  const day = dy?.date || date || '';
  const W = R.WEATHER;
  const wx = dy ? [dy.weather?.am && `เช้า ${W[dy.weather.am] || ''}`, dy.weather?.pm && `บ่าย ${W[dy.weather.pm] || ''}`].filter(Boolean).join(' · ') : '';
  const [from, to] = String(dy?.workHours || '').split(/\s*(?:–|-|—|ถึง)\s*/).concat(['', '']);
  // รายละเอียดของงาน: งานที่บันทึก + ปริมาณงานจากบันทึกความคืบหน้าวันเดียวกัน (ถ้ามี)
  const work = linesOf(dy?.work).map(splitQty);
  const up = p && day ? store.updatesOf(p.id).find((u) => u.date === day) : null;
  if (up) {
    const boq = store.boqOf(p.id);
    Object.entries(up.entries || {}).forEach(([id, q]) => {
      const it = boq.find((b) => b.id === id);
      if (it && +q) work.push([`${it.no ? `${it.no} ` : ''}${it.desc}`, `${(+q).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${it.unit || ''}`.trim()]);
    });
  }
  const workRows = pad(work.map(([w, q], i) => `<tr><td class="c">${i + 1}</td><td>${e(w)}</td><td>${e(q)}</td></tr>`), 11, '<tr><td>&nbsp;</td><td></td><td></td></tr>').join('');
  // ปัญหา / การแก้ไข
  const probs = [
    ...(dy?.stoppage?.stopped ? [`หยุดงาน${dy.stoppage.hours ? ` ${dy.stoppage.hours} ชั่วโมง` : ''}${dy.stoppage.reason ? ` — ${dy.stoppage.reason}` : ''}`] : []),
    ...(up?.issues ? linesOf(up.issues) : []),
    ...(dy?.safety ? linesOf(dy.safety).map((x) => `ความปลอดภัย: ${x}`) : []),
  ];
  const fixes = linesOf(dy?.instructions);
  const lineRows = (list, n) => pad(list.map((x) => `<tr class="blank"><td colspan="6">${e(x)}</td></tr>`), n, '<tr class="blank"><td colspan="6">&nbsp;</td></tr>').join('');
  // วัสดุนำเข้า · ผู้ปฏิบัติงาน · เครื่องจักรทุนแรง
  const mats = linesOf(dy?.materials).map(splitQty);
  const men = dy?.manpower || [];
  const eq = dy?.equipment || [];
  const n = Math.max(5, mats.length, men.length, eq.length);
  const resRows = Array.from({ length: n }, (_, i) => `<tr><td>${e(mats[i]?.[0] || '')}</td><td>${e(mats[i]?.[1] || '')}</td><td>${e(men[i]?.trade || '')}</td><td class="c">${e(men[i]?.count ?? '')}</td><td>${e(eq[i]?.name || '')}</td><td class="c">${e(eq[i]?.count ?? '')}</td></tr>`).join('');
  return `<div class="of-main">
  <div class="of-title">${e(ORG)}</div>
  <div class="of-sub">บันทึกการควบคุมงานประจำวัน</div>
  <table class="of">
    <colgroup><col style="width:50.4%"><col style="width:49.6%"></colgroup>
    <tr><td colspan="2"><span style="display:inline-block;width:36%">${pv('แผนก', p?.orgSection)}</span><span style="display:inline-block;width:33%">${pv('กอง', p?.orgDivision)}</span>${pv('ฝ่าย', p?.orgDept)}</td></tr>
    <tr><td>${pv('งาน', p?.name)}</td><td>${pv('ผู้รับจ้าง', p?.contractor)}</td></tr>
    <tr><td>${pv('สถานที่', p?.location)}</td><td>${pv('ผู้แทนผู้รับจ้าง', contractorRep(p))}</td></tr>
    <tr><td><span style="display:inline-block;width:38%">${pv('วันที่', day ? R.thaiDateTime(day, false) : '')}</span><span style="display:inline-block;width:34%">${pv('เวลา จาก', from)}</span>${pv('ถึง', to)}</td><td>${pv('สภาพอากาศ', wx)}</td></tr>
    <tr class="blank"><td colspan="2">&nbsp;</td></tr>
  </table>
  <div class="of-gap"></div>
  <table class="of">
    <colgroup><col style="width:9%"><col style="width:45.5%"><col style="width:45.5%"></colgroup>
    <tr><th>ลำดับ</th><th>รายละเอียดของงาน</th><th>ปริมาณงาน</th></tr>
    ${workRows}
  </table>
  <table class="of" style="border-top:0">
    <colgroup><col style="width:31.6%"><col style="width:18.1%"><col style="width:18%"><col style="width:9.1%"><col style="width:15.8%"><col style="width:7.4%"></colgroup>
    <tr class="blank"><td colspan="6">หมายเหตุ - <span class="u">ปัญหา</span></td></tr>
    ${lineRows(probs, 2)}
    <tr class="blank"><td colspan="6"><span style="padding-left:12mm" class="u">การแก้ไข</span></td></tr>
    ${lineRows(fixes, 2)}
    <tr><th colspan="2">วัสดุนำเข้า</th><th colspan="4">ผู้ปฏิบัติงานและเครื่องจักรทุนแรง</th></tr>
    <tr><th>ชนิด</th><th>ปริมาณ</th><th>ประเภท</th><th>จำนวน</th><th>ชนิด</th><th>จำนวน</th></tr>
    ${resRows}
  </table>
  <div class="of-gap"></div>
  <table class="of"><tr><td style="height:28px">${pv('ผู้ควบคุมงาน', dy?.createdBy || supervisorName(p))}</td></tr></table>
  ${dy?.files?.length ? `<p class="small" style="margin-top:2mm">รูปถ่ายประกอบ ${dy.files.length} รูป (เก็บในระบบ หมวดรูปถ่ายความคืบหน้า)</p>` : ''}
  </div>
  ${ofFoot('daily')}`;
}

// ---------- F01 ใบขออนุมัติ ----------
function formSub({ p, sub }) {
  const files = sub ? (sub.files || []).map((id) => store.data.files.find((f) => f.id === id)).filter(Boolean) : [];
  const steps = sub ? sub.steps || [] : [];
  const cats = R.workflows(p).map((w) => w.name);
  const stepRows = steps.length ? steps.map((s, i) => `<tr><td class="c">${i + 1}</td><td>${e(s.label || '')}</td><td>${e(s.byName || (s.by ? nameOf(p, s.by) : ''))}</td>
      <td>${s.status === 'approved' ? 'ผ่าน' : s.status === 'rejected' ? 'ไม่ผ่าน' : s.status === 'current' ? 'กำลังพิจารณา' : ''}</td><td>${e(d(s.at))}</td><td>${e(s.comment || '')}</td></tr>`).join('')
    : [1, 2, 3, 4].map((i) => `<tr><td class="c">${i}</td><td>${i === 1 ? 'ผู้ควบคุมงานพิจารณา' : i === 4 ? 'ประธานกรรมการพิจารณา' : `กรรมการลำดับที่ ${i - 1} พิจารณา`}</td><td></td><td><span class="ck"></span>ผ่าน <span class="ck"></span>ไม่ผ่าน</td><td></td><td></td></tr>`).join('');
  return `${head('sub', p)}
  ${projectInfo(p, [
    ['เลขที่เรื่อง', sub ? `${R.subNo(sub)}${+sub.rev > 1 ? ` (ส่งครั้งที่ ${sub.rev})` : ''}` : ''],
    ['วันที่ยื่น', sub ? dt(sub.submittedAt) : ''],
  ])}
  <h2>ประเภทเรื่อง</h2>
  <div>${cats.map((c) => `<span style="display:inline-block;margin:0 14px 4px 0"><span class="ck">${sub && sub.category === c ? '✓' : ''}</span>${e(c)}</span>`).join('')}</div>
  <h2>เรื่อง</h2><div class="box" style="min-height:0">${sub ? e(sub.title) : '&nbsp;'}</div>
  <h2>รายละเอียด</h2>${sub ? `<div class="box tall">${e(sub.detail || '-')}</div>` : blankLines(6)}
  <h2>เอกสารแนบ</h2>${files.length ? `<ol class="small">${files.map((f) => `<li>${e(f.name)}</li>`).join('')}</ol>` : blankLines(3)}
  <h2>ผลการพิจารณา</h2>
  <table class="grid small"><tr><th style="width:5%">ขั้น</th><th style="width:22%">ผู้พิจารณา</th><th style="width:20%">ชื่อ</th><th style="width:13%">ผล</th><th style="width:12%">วันที่</th><th>ความเห็น</th></tr>${stepRows}</table>
  ${sub?.vote?.status === 'closed' ? `<p class="small">ผลโหวตเลือกรูปแบบ: <b>${e((sub.vote.options || []).find((o) => o.id === sub.vote.result)?.label || '')}</b></p>` : ''}
  ${signs([
    sign('ผู้แทนผู้รับจ้าง (ผู้ยื่นเรื่อง)', sub?.submittedByName || '', sub?.submittedAt),
    ...(steps.length ? steps.filter((s) => s.status === 'approved' || s.status === 'rejected').map((s) => sign(s.label.replace(/ ?พิจารณา$/, ''), s.byName || nameOf(p, s.by), s.at))
      : [sign('ผู้ควบคุมงาน'), sign('ประธานกรรมการตรวจรับพัสดุ')]),
  ])}${foot('sub')}`;
}

// ---------- F03 รายงานประจำสัปดาห์ ----------
function formWeekly({ p, to }) {
  to = to || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const from = R.addDaysIso(to, -6);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(R.addDaysIso(from, i));
  const dys = p ? store.dailyOf(p.id) : [];
  const a = p ? analyze(p, store.boqOf(p.id), store.updatesOf(p.id), store.settings, to) : null;
  const prev = p ? analyze(p, store.boqOf(p.id), store.updatesOf(p.id), store.settings, R.addDaysIso(to, -7)) : null;
  const subs = p ? store.subsOf(p.id) : [];
  const inWeek = (iso) => String(iso || '').slice(0, 10) >= from && String(iso || '').slice(0, 10) <= to;
  const issues = p ? store.updatesOf(p.id).filter((u) => inWeek(u.date) && u.issues) : [];
  const pend = subs.filter((s) => s.status === 'pending');
  const closed = subs.filter((s) => s.status !== 'pending' && inWeek(s.closedAt));
  const rowOf = (iso) => {
    const x = dys.find((y) => y.date === iso);
    const w = x ? [x.weather?.am, x.weather?.pm].map((k) => R.WEATHER[k]).filter(Boolean).join('/') : '';
    return `<tr><td class="nowrap">${e(d(iso))}</td><td>${e(w)}</td><td class="r">${x ? R.manpowerTotal(x) : ''}</td><td>${e(x ? String(x.work || '').slice(0, 160) : '')}</td><td>${x?.stoppage?.stopped ? e(`${x.stoppage.hours ? `${x.stoppage.hours} ชม. ` : ''}${x.stoppage.reason || ''}`) : ''}</td></tr>`;
  };
  return `${head('weekly', p)}
  ${projectInfo(p, [['ระหว่างวันที่', `${d(from)} – ${d(to)}`], ['สัปดาห์ที่ของสัญญา', a?.week ? String(a.week) : '']])}
  <h2>ผลงาน</h2>
  <table class="grid small"><tr><th>ผลงานสะสม</th><th>แผนงานสะสม</th><th>เทียบแผน</th><th>เพิ่มขึ้นในสัปดาห์</th><th>ระยะเวลาคงเหลือ</th></tr>
    <tr><td class="c">${pct(a?.actual)}</td><td class="c">${pct(a?.plan)}</td><td class="c">${a ? `${((a.actual - a.plan) * 100).toFixed(2)}%` : ''}</td><td class="c">${a && prev ? `${((a.actual - prev.actual) * 100).toFixed(2)}%` : ''}</td><td class="c">${a?.daysLeft != null ? (a.daysLeft >= 0 ? `${a.daysLeft} วัน` : `เกินสัญญา ${-a.daysLeft} วัน`) : ''}</td></tr></table>
  <h2>สรุปรายวัน</h2>
  <table class="grid small"><tr><th style="width:13%">วันที่</th><th style="width:13%">อากาศ</th><th class="r" style="width:8%">คนงาน</th><th>งานที่ดำเนินการ</th><th style="width:20%">หยุดงาน</th></tr>${days.map(rowOf).join('')}</table>
  <h2>ปัญหาและอุปสรรค</h2>${issues.length ? `<ul class="small">${issues.map((u) => `<li>${e(d(u.date))}: ${e(u.issues)}</li>`).join('')}</ul>` : blankLines(3)}
  <h2>เรื่องขออนุมัติ</h2>
  <p class="small">ปิดเรื่องในสัปดาห์ ${closed.length} เรื่อง · ค้างพิจารณา ${pend.length} เรื่อง</p>
  ${pend.length ? `<table class="grid small"><tr><th style="width:10%">เลขที่</th><th>เรื่อง</th><th style="width:28%">ขั้นตอนปัจจุบัน</th><th class="r" style="width:12%">ค้าง (วัน)</th></tr>${pend.map((s) => `<tr><td>${e(R.subNo(s))}</td><td>${e(s.title)}</td><td>${e(s.steps?.[s.currentStep || 0]?.label || '')}</td><td class="r">${Math.floor(R.subSla(s, p, store.settings).age)}</td></tr>`).join('')}</table>` : ''}
  <h2>ความเห็นของผู้ควบคุมงาน</h2>${blankLines(3)}
  ${signs([sign('ผู้ควบคุมงาน', supervisors(p)[0] ? nameOf(p, supervisors(p)[0].email) : '', to), ...committee(p).slice(0, 1).map((m) => sign(`${R.seatLabel(m.seat)}ตรวจรับพัสดุ (รับทราบ)`, nameOf(p, m.email)))])}
  ${foot('weekly')}`;
}

// ---------- F04 บันทึกการประชุม ----------
function formMeeting({ p, m }) {
  const att = m ? m.attendees || [] : [];
  const acts = m ? m.actions || [] : [];
  return `${head('meeting', p)}
  <table class="info">
    <tr><td class="k">เรื่อง</td><td>${val(m?.title || '', '80%')}</td></tr>
    <tr><td class="k">วันเวลา</td><td>${val(m ? R.meetingWhen(m) : '', '60%')}</td></tr>
    <tr><td class="k">สถานที่</td><td>${val(m ? m.place || (m.link ? 'ประชุมออนไลน์' : '') : '', '60%')}</td></tr>
  </table>
  <h2>ผู้เข้าประชุม</h2>
  <table class="grid small"><tr><th style="width:6%">ที่</th><th>ชื่อ</th><th style="width:30%">ตำแหน่ง/บทบาท</th><th style="width:22%">ลงชื่อ</th></tr>
    ${(att.length ? att : Array(8).fill('')).map((x, i) => `<tr><td class="c">${i + 1}</td><td>${e(x ? nameOf(p, x) : '')}</td><td>${e(x && p && R.roleOf(p, x) ? R.ROLES[R.roleOf(p, x)].label : '')}</td><td></td></tr>`).join('')}</table>
  <h2>วาระการประชุม</h2>${m?.agenda ? `<div class="box">${e(m.agenda)}</div>` : blankLines(4)}
  <h2>สรุปการประชุม</h2>${m?.minutes ? `<div class="box tall">${e(m.minutes)}</div>` : blankLines(8)}
  <h2>งานที่มอบหมาย</h2>
  <table class="grid small"><tr><th style="width:6%">ที่</th><th>งาน</th><th style="width:24%">ผู้รับผิดชอบ</th><th style="width:16%">กำหนดเสร็จ</th><th style="width:10%">สถานะ</th></tr>
    ${(acts.length ? acts : Array(4).fill(null)).map((a, i) => `<tr><td class="c">${i + 1}</td><td>${e(a?.text || '')}</td><td>${e(a?.owner ? nameOf(p, a.owner) : '')}</td><td>${e(a?.due ? d(a.due) : '')}</td><td>${a ? (a.done ? 'เสร็จแล้ว' : 'ยังไม่เสร็จ') : ''}</td></tr>`).join('')}</table>
  ${signs([sign('ผู้จดบันทึกการประชุม', m?.updatedByName || m?.createdByName || ''), sign('ประธานในที่ประชุม')])}${foot('meeting')}`;
}

// ---------- F05 บันทึกการตรวจรับงาน ----------
function formInspect({ p }) {
  const a = p ? store.analysis(p.id) : null;
  const com = committee(p);
  const seats = com.length ? com : [{ seat: 0 }, { seat: 1 }, { seat: 2 }];
  return `${head('inspect', p)}
  ${projectInfo(p, [['มูลค่าสัญญา', p?.contractValue ? `${Number(p.contractValue).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท` : ''], ['งวดงานที่', ''], ['วันที่ผู้รับจ้างส่งมอบงาน', ''], ['วันที่ตรวจรับ', '']])}
  <h2>ผลงานตามระบบ ณ วันที่พิมพ์</h2>
  <p>ผลงานสะสม ${val(pct(a?.actual), '80px')} แผนงานสะสม ${val(pct(a?.plan), '80px')}</p>
  <h2>รายการงานที่ส่งมอบในงวดนี้</h2>${blankLines(6)}
  <h2>ผลการตรวจรับ</h2>
  <div style="line-height:2">
    <div><span class="ck"></span>ผู้รับจ้างได้ปฏิบัติงานถูกต้องครบถ้วนตามสัญญา คณะกรรมการตรวจรับพัสดุเห็นควรรับงานงวดนี้</div>
    <div><span class="ck"></span>ผู้รับจ้างได้ปฏิบัติงานไม่ถูกต้อง/ไม่ครบถ้วน ให้แก้ไขภายในวันที่ ${line('120px')}</div>
    <div>รายละเอียด ${line('80%')}</div>
  </div>
  <h2>ค่าปรับ (ถ้ามี)</h2>
  <p>ส่งมอบเกินกำหนด ${line('60px')} วัน อัตราค่าปรับร้อยละ ${line('60px')} ต่อวัน เป็นเงิน ${line('120px')} บาท</p>
  <p class="small muted">อ้างอิง: พ.ร.บ. การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 และระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 176 (การตรวจรับในงานจ้างก่อสร้าง) — ตรวจสอบระเบียบและหนังสือเวียนฉบับปัจจุบันในคลังแบบฟอร์มและระเบียบ</p>
  ${signs(seats.map((m) => sign(`${R.seatLabel(m.seat) || 'กรรมการ'}ตรวจรับพัสดุ`, m.email ? nameOf(p, m.email) : '')))}
  ${foot('inspect')}`;
}

// ---------- F06 ใบสั่งการ ----------
function formInstruction({ p, daily: dy }) {
  return `${head('instruction', p)}
  ${projectInfo(p, [['เลขที่', ''], ['วันที่', d(dy?.date) || ''], ['ถึง', p?.contractor ? `ผู้แทนผู้รับจ้าง ${p.contractor}` : '']])}
  <h2>เรื่อง</h2>${blankLines(1)}
  <h2>ข้อสั่งการ / ข้อแนะนำ</h2>${dy?.instructions ? `<div class="box tall">${e(dy.instructions)}</div>` : blankLines(8)}
  <h2>กำหนดดำเนินการแล้วเสร็จ</h2>${blankLines(1)}
  ${signs([sign('ผู้ควบคุมงาน (ผู้สั่งการ)', dy?.createdBy || ''), sign('ผู้แทนผู้รับจ้าง (รับทราบ)')])}
  <h2>ผลการดำเนินการของผู้รับจ้าง</h2>${blankLines(3)}
  ${foot('instruction')}`;
}

const BUILD = { sub: formSub, material: formMaterial, daily: formDaily, weekly: formWeekly, meeting: formMeeting, inspect: formInspect, instruction: formInstruction };

/** HTML ของแบบฟอร์ม (ใช้ทดสอบและพิมพ์) */
export function formHtml(kind, ctx = {}, { inline = false } = {}) {
  const f = FORMS[kind];
  if (!f) throw new Error(`ไม่รู้จักแบบฟอร์ม ${kind}`);
  const body = BUILD[kind](ctx);
  // แบบฟอร์มทางการที่ข้อมูลยาวเกิน 1 หน้า → ให้ขึ้นหน้าใหม่ได้ (ปกติพอดี A4 หน้าเดียวเหมือนต้นฉบับ)
  const long = f.official && (body.match(/<tr/g) || []).length > 60;
  const title = `${f.code} ${f.title}${ctx.p ? ` — ${ctx.p.code || ctx.p.name}` : ''}`;
  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>${e(title)}</title><style>${CSS}${f.official ? OFFICIAL_CSS : ''}</style></head>
  <body${f.official ? ` class="official${long ? ' of-long' : ''}"` : ''}><div class="bar"><button data-pt="print"${inline ? ' onclick="window.print()"' : ''}>พิมพ์ / บันทึกเป็น PDF</button><button class="ghost" data-pt="close"${inline ? ' onclick="window.close()"' : ''}>ปิด</button><span>${e(f.code)} · ${ctx.p ? 'กรอกข้อมูลจากระบบแล้ว ตรวจทานก่อนพิมพ์' : 'แบบเปล่าสำหรับกรอกด้วยมือ'}${f.official ? ' · ตั้งระยะขอบกระดาษเป็น "ไม่มี" หรือ "ค่าเริ่มต้น" ตอนพิมพ์' : ''}</span></div>
  <div class="sheet">${body}</div></body></html>`;
}

/** เปิดแบบฟอร์มในแท็บใหม่ (ถ้าเบราว์เซอร์กันหน้าต่างใหม่ จะดาวน์โหลดเป็นไฟล์ .html แทน) */
export function openForm(kind, ctx = {}) {
  const w = window.open('', '_blank');
  if (!w) {
    // ไฟล์ที่ดาวน์โหลดเปิดแยกจากเว็บ จึงใช้ปุ่มแบบ inline ได้
    download(`${(FORMS[kind].short || FORMS[kind].code).replace(/[^A-Za-z0-9-]/g, '-')}${ctx.p ? `-${ctx.p.code || 'project'}` : ''}.html`, formHtml(kind, ctx, { inline: true }), 'text/html;charset=utf-8');
    return null;
  }
  w.document.open();
  w.document.write(formHtml(kind, ctx));
  w.document.close();
  // หน้าต่างใหม่ใช้นโยบายความปลอดภัยเดียวกับเว็บ (ไม่รันสคริปต์ inline) — ผูกปุ่มจากหน้านี้แทน
  w.document.querySelector('[data-pt="print"]')?.addEventListener('click', () => w.print());
  w.document.querySelector('[data-pt="close"]')?.addEventListener('click', () => w.close());
  return w;
}
