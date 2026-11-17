// แบบฟอร์มมาตรฐานในระบบ (1.0.5) — ทุกโครงการใช้แบบเดียวกัน พิมพ์ได้ทันที และกรอกข้อมูลโครงการให้อัตโนมัติ
// เปิดเป็นหน้าแบบฟอร์มขนาด A4 ในแท็บใหม่ (บันทึกเป็น PDF ได้จากหน้าต่างพิมพ์ของเบราว์เซอร์)
// 1.0.12: แบบฟอร์มทางการตามคู่มือ QP-CMD-MS-005 การควบคุมงานก่อสร้าง (official: true) จัดหน้าตามต้นฉบับ
//   FM-001 รายละเอียดผลการตรวจวัสดุก่อสร้าง · FM-002 บันทึกการควบคุมงานประจำวัน (แทน PT-F02 เดิม) — ไม่มีตรา CONTROLLED
// 1.0.13: กรอกบนเว็บได้ทุกแบบ (form-editor.js) — ช่องกรอก [data-f] · วันที่ [data-date] (ค่าเริ่มต้นวันนี้ แก้ได้)
//   · ช่องติ๊ก [data-ck] · รูป [data-photo] · จำที่กรอกไว้ในเครื่อง · บันทึก PDF
//   PT-F01 เปลี่ยนเป็นหนังสือขออนุมัติ + บันทึกการขออนุมัติ/ผลการตรวจสอบ · เพิ่ม PT-F07 Daily Report and Daily Request
import { store } from './store.js';
import { analyze } from './calc.js';
import { download } from './ui.js';
import { APP_VERSION } from './defaults.js';

const R = globalThis.PTRules;
const e = (s) => R.esc(s);
const d = (iso) => (iso ? R.thaiDateTime(iso, false) : '');
const dt = (iso) => (iso ? R.thaiDateTime(iso) : '');
const pct = (r) => (r == null || Number.isNaN(+r) ? '' : `${(+r * 100).toFixed(2)}%`);
const FULL_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const SHORT_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** วันที่แบบไทย: long = 17 พฤศจิกายน 2569 · med = 17 พ.ย. 2569 · short = 17 พ.ย. 69 · slash = 17/11/2569 (ต้องตรงกับ form-editor.js) */
export function fmtDate(iso, fmt = 'short') {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  const y = +m[1] + 543, mo = +m[2] - 1, day = +m[3];
  if (fmt === 'long') return `${day} ${FULL_MONTHS[mo]} ${y}`;
  if (fmt === 'med') return `${day} ${SHORT_MONTHS[mo]} ${y}`;
  if (fmt === 'slash') return `${day}/${mo + 1}/${y}`;
  return `${day} ${SHORT_MONTHS[mo]} ${String(y).slice(-2)}`;
}
/** วันที่ (yyyy-mm-dd) ตามเวลาประเทศไทยของเวลาที่บันทึก */
const isoTh = (x) => {
  const s = String(x || '');
  if (!s) return '';
  if (s.length <= 10) return s.slice(0, 10);
  const t = Date.parse(s);
  return Number.isNaN(t) ? '' : new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
};
const todayTh = () => store.thaiNow().date;

/** จำนวนเงินเป็นตัวอักษร (เหมือน BAHTTEXT) */
export function bahtText(value) {
  const n = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(n) || n < 0) return '';
  const D = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const P = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  const read = (str) => {
    const s = String(str).replace(/^0+/, '');
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const dg = +s[i], pos = s.length - i - 1, p6 = pos % 6;
      if (dg) {
        if (p6 === 0 && dg === 1 && i > 0) out += 'เอ็ด';
        else if (p6 === 1 && dg === 2) out += 'ยี่';
        else if (!(p6 === 1 && dg === 1)) out += D[dg];
        out += P[p6];
      }
      if (p6 === 0 && pos > 0) out += 'ล้าน';
    }
    return out;
  };
  const [baht, satang] = n.toFixed(2).split('.');
  const b = read(baht);
  const st = +satang ? `${read(satang)}สตางค์` : 'ถ้วน';
  return `${b || (+satang ? '' : 'ศูนย์')}${b || !+satang ? 'บาท' : ''}${st}`;
}
const money = (v) => Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyTxt = (v) => (v === '' || v == null || Number.isNaN(+v) ? '' : (+v).toLocaleString('th-TH', { maximumFractionDigits: 2 }));

// ---------- ช่องกรอก (form-editor.js ทำให้พิมพ์ได้) ----------
/** ช่องข้อความในบรรทัด — ph = ข้อความที่พิมพ์ออกเมื่อว่าง (เช่น จุดไข่ปลา) · hint = คำแนะนำบนจอเท่านั้น */
const F = (v = '', { cls = '', ph = '', hint = '', l = '', style = '' } = {}) => `<span class="f${cls ? ` ${cls}` : ''}" data-f${ph ? ` data-ph="${e(ph)}"` : ''}${hint ? ` data-hint="${e(hint)}"` : ''}${l ? ` data-l="${e(l)}"` : ''}${style ? ` style="${style}"` : ''}>${e(v ?? '')}</span>`;
/** ช่องวันที่ — คลิกเพื่อเลือกจากปฏิทิน */
const FD = (iso = '', fmt = 'short', { cls = '', ph = '……/……/……', id = '', follow = '' } = {}) => `<span class="fd${cls ? ` ${cls}` : ''}" data-date="${e(iso || '')}" data-fmt="${fmt}" data-ph="${e(ph)}"${id ? ` data-id="${id}"` : ''}${follow ? ` data-follow="${follow}"` : ''}>${e(iso ? fmtDate(iso, fmt) : '')}</span>`;
/** ช่องติ๊ก — g = ชื่อกลุ่ม (ติ๊กได้ข้อเดียวในกลุ่ม) */
const CK = (on = false, g = '') => `<span class="ck" data-ck="${e(g)}">${on ? '✓' : ''}</span>`;
/** ช่องตาราง */
const TD = (v = '', attr = '') => {
  let cls = 'f';
  const rest = String(attr).replace(/class="([^"]*)"/, (_, c) => { cls += ` ${c}`; return ''; }).trim();
  return `<td class="${cls}"${rest ? ` ${rest}` : ''} data-f>${e(v ?? '')}</td>`;
};
/** บรรทัดเส้นประสำหรับเขียน (บรรทัดละ 1 ช่อง — Enter ไปบรรทัดถัดไป) */
const LINES = (n, vals = []) => `<div class="lines">${pad(vals, n, '').map((v) => `<div class="f" data-f>${e(v)}</div>`).join('')}</div>`;
const line = (w = '100%') => `<span class="fill f" data-f style="min-width:${w}"></span>`;
const val = (v, w) => (v === '' || v == null ? line(w) : `<span class="fill f" data-f>${e(v)}</span>`);

/** รายการแบบฟอร์ม: code, ชื่อ, ใช้เมื่อไร, ต้องมีอะไร */
export const FORMS = {
  sub: { code: 'PT-F01', title: 'หนังสือขออนุมัติ และบันทึกการขออนุมัติ/ผลการตรวจสอบ', use: 'ผู้รับจ้างขออนุมัติวัสดุ แบบ หรือวิธีการทำงาน — หนังสือนำส่ง ตารางสิ่งที่เสนอเทียบข้อกำหนดในสัญญา และช่องพิจารณาของผู้ควบคุมงาน กรรมการ ประธานกรรมการ (พิมพ์จากเรื่องขออนุมัติได้พร้อมผลการพิจารณา)', where: 'เรื่องขออนุมัติ' },
  material: { code: 'FM-001/QP-CMD-MS-005', short: 'FM-001', official: true, title: 'รายละเอียดผลการตรวจวัสดุก่อสร้าง', use: 'ผู้ควบคุมงานบันทึกผลการตรวจวัสดุที่นำเข้าใช้งาน เทียบขนาด/รูปแบบของตัวอย่างกับมาตรฐาน — แบบฟอร์มตามคู่มือ QP-CMD-MS-005', where: 'เรื่องขออนุมัติวัสดุ · รายงานประจำวัน', pdf: 'templates/egat/FM-001_QP-CMD-MS-005.pdf' },
  daily: { code: 'FM-002/QP-CMD-MS-005', short: 'FM-002', official: true, title: 'บันทึกการควบคุมงานประจำวัน', use: 'รายละเอียดและปริมาณงาน ปัญหาและการแก้ไข วัสดุนำเข้า ผู้ปฏิบัติงานและเครื่องจักรทุนแรง — แบบฟอร์มตามคู่มือ QP-CMD-MS-005 (ระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 178)', where: 'รายงานประจำวัน', pdf: 'templates/egat/FM-002_QP-CMD-MS-005.pdf' },
  cdaily: { code: 'PT-F07', title: 'Daily Report and Daily Request (ผู้รับจ้าง)', use: 'ผู้รับจ้างรายงานงานที่ทำได้และขอทำงานวันถัดไป พร้อมความคืบหน้าตาม BOQ คนงาน เครื่องจักร และภาพประกอบการทำงาน', where: 'รายงานประจำวัน' },
  weekly: { code: 'PT-F03', title: 'รายงานผลการปฏิบัติงานประจำสัปดาห์', use: 'ผู้ควบคุมงานรายงานคณะกรรมการตรวจรับพัสดุทุกสัปดาห์ สรุปจากรายงานประจำวัน', where: 'รายงานประจำวัน' },
  meeting: { code: 'PT-F04', title: 'บันทึกการประชุม', use: 'บันทึกการประชุมโครงการ พร้อมรายชื่อผู้เข้าร่วมและงานที่มอบหมาย', where: 'การประชุม' },
  inspect: { code: 'PT-F05', title: 'บันทึกการตรวจรับงานจ้าง (งวดงาน)', use: 'คณะกรรมการตรวจรับพัสดุตรวจรับงานงวด — มีช่องลงนามตามลำดับกรรมการของโครงการ', where: 'ส่งมอบ/ตรวจรับงาน' },
  instruction: { code: 'PT-F06', title: 'ใบสั่งการ / ข้อแนะนำของผู้ควบคุมงาน', use: 'แจ้งข้อสั่งการหรือข้อแนะนำเป็นลายลักษณ์อักษรต่อผู้รับจ้าง พร้อมช่องรับทราบ', where: 'รายงานประจำวัน' },
};
/** แบบฟอร์มที่ใช้ข้อมูลรายงานประจำวันของวันที่เลือก */
export const DAILY_FORMS = ['daily', 'cdaily', 'instruction'];

/** ต้นฉบับ PDF ของ กฟผ. (เอาตรา CONTROLLED ออกแล้ว) — templates/egat/ */
export const EGAT_ORIGINALS = [
  { label: 'FM-001', title: 'รายละเอียดผลการตรวจวัสดุก่อสร้าง', href: 'templates/egat/FM-001_QP-CMD-MS-005.pdf' },
  { label: 'FM-002', title: 'บันทึกการควบคุมงานประจำวัน', href: 'templates/egat/FM-002_QP-CMD-MS-005.pdf' },
  { label: 'QP-CMD-MS-005', title: 'คู่มือ หน้า 15–17 และแบบฟอร์มทั้งชุด', href: 'templates/egat/QP-CMD-MS-005_forms.pdf' },
];

// ฟอนต์จาก Google Fonts โหลดด้วย <link> ท้ายหน้า (ไม่ใช้ @import) — ถ้าเครือข่ายหน่วยงานกันหรือช้า
// แบบฟอร์มยังเปิดและกรอกได้ทันทีด้วยฟอนต์ในเครื่อง ไม่ต้องรอ (สคริปต์กรอกแบบฟอร์มไม่ถูกบล็อกโดยสไตล์ชีตที่ค้าง)
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&family=Taviraj:wght@400;600&display=swap';
const CSS = `
@page { size: A4; margin: 14mm 14mm 16mm; }
* { box-sizing: border-box; }
body { font-family: 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif; font-size: 14.5px; line-height: 1.55; color: #111; margin: 0; background: #E9EBE6; }
.sheet { position: relative; background: #fff; width: 210mm; min-height: 297mm; margin: 12px auto; padding: 14mm; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
.bar { position: sticky; top: 0; background: #1D4F91; color: #fff; padding: 8px 14px; display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; font-family: Tahoma, sans-serif; font-size: 13px; z-index: 6; }
.bar button { font: inherit; padding: 6px 14px; border-radius: 3px; border: 0; cursor: pointer; background: #fff; color: #1D4F91; font-weight: 700; }
.bar button.ghost { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,.45); font-weight: 400; }
.bar button:focus-visible { outline: 2px solid #F2A900; outline-offset: 2px; }
.bar .bar-msg { flex: 1 1 280px; opacity: .88; line-height: 1.4; }
header.fh { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 10px; }
header.fh .org { font-weight: 700; font-size: 15px; }
header.fh .code { text-align: right; font-size: 12px; color: #444; }
h1 { text-align: center; font-size: 19px; margin: 6px 0 12px; }
h2 { font-size: 15px; margin: 14px 0 6px; border-left: 4px solid #F2A900; padding-left: 8px; }
table { width: 100%; border-collapse: collapse; }
table.grid td, table.grid th { border: 1px solid #555; padding: 4px 6px; vertical-align: top; }
table.grid th { background: #F0F1EC; font-weight: 600; text-align: left; }
table.grid td.f { height: 1.9em; }
table.info td { padding: 3px 4px; vertical-align: top; }
table.info td.k { white-space: nowrap; color: #333; width: 1%; padding-right: 10px; }
.fill { display: inline-block; border-bottom: 1px dotted #555; min-height: 1.4em; padding: 0 4px; }
.box { border: 1px solid #555; padding: 6px 8px; min-height: 64px; white-space: pre-wrap; }
.box.tall { min-height: 120px; }
.lines > div { border-bottom: 1px dotted #555; min-height: 1.75em; line-height: 1.75em; }
.r { text-align: right; } .c { text-align: center; } .muted { color: #555; } .small { font-size: 12.5px; }
.ck { display: inline-block; width: 13px; height: 13px; border: 1px solid #333; vertical-align: -2px; margin-right: 4px; text-align: center; line-height: 11px; font-size: 11px; }
.signs { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 22px 18px; margin-top: 26px; page-break-inside: avoid; }
.sign { text-align: center; font-size: 13.5px; }
.sign .ln { border-bottom: 1px dotted #333; height: 34px; margin: 0 12px 4px; }
.sign small { display: block; color: #444; }
footer.ff { margin-top: 18px; font-size: 11px; color: #666; border-top: 1px solid #ccc; padding-top: 4px; display: flex; justify-content: space-between; }
.nb { page-break-inside: avoid; }
/* ---------- กรอกบนเว็บ ---------- */
[data-f] { white-space: pre-wrap; overflow-wrap: anywhere; }
span.f:empty { display: inline-block; min-width: 3em; min-height: 1.2em; vertical-align: bottom; }
[data-ph]:empty::before { content: attr(data-ph); }
[data-date] { cursor: pointer; white-space: nowrap; }
[data-ck] { cursor: pointer; }
.fd-input { position: absolute; left: 0; top: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; border: 0; padding: 0; }
.fd-input.vis { width: auto; height: auto; opacity: 1; pointer-events: auto; z-index: 8; font-size: 15px; padding: 4px 6px; border: 2px solid #1D4F91; border-radius: 3px; background: #fff; }
.ph-input { position: absolute; left: 0; top: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
@media screen {
  body.ed [data-f], body.ed [data-date] { background-color: #EEF4FC; }
  body.ed [data-f]:hover, body.ed [data-date]:hover, body.ed [data-ck]:hover { background-color: #DCE8F8; }
  body.ed [data-f]:focus, body.ed [data-date]:focus, body.ed [data-ck]:focus, body.ed [data-photo]:focus { outline: 2px solid #1D4F91; outline-offset: -1px; background-color: #fff; }
  [data-hint]:empty::after { content: attr(data-hint); color: #7A8496; font-weight: 400; font-style: normal; }
  body.preview [data-f], body.preview [data-date] { background-color: transparent !important; }
  body.preview [data-hint]:empty::after, body.preview .ph-hint { visibility: hidden; }
}
@media print {
  body { background: #fff; } .bar, .fd-input, .ph-input, .ph-hint, .ph-x { display: none !important; }
  .sheet { box-shadow: none; margin: 0; width: auto; min-height: 0; padding: 0; }
  .sheet + .sheet { break-before: page; page-break-before: always; }
  [data-f], [data-date] { background: none !important; outline: none !important; }
}
`;

function head(kind, p) {
  const f = FORMS[kind];
  const org = store.settings.orgName || 'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย';
  return `<header class="fh"><div><div class="org">${e(org)}</div><div class="small muted">${F(p ? `${p.code ? `${p.code} ` : ''}${p.name}` : '', { ph: 'โครงการ ……………………………………………' })}</div></div>
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
    ['ระยะเวลาสัญญา', { html: `${FD(p?.startDate || '', 'short')} – ${FD(p?.endDate || '', 'short')}` }],
    ...extra,
  ];
  return `<table class="info">${rows.map(([k, v]) => `<tr><td class="k">${e(k)}</td><td>${typeof v === 'object' && v?.html ? v.html : val(v, '70%')}</td></tr>`).join('')}</table>`;
}
const DOTS = '……………………………………';
const sign = (role, name = '', date = '') => `<div class="sign"><div class="ln"></div>(${F(name, { cls: 'nm', ph: DOTS })})<small>${e(role)}</small><small>วันที่ ${FD(isoTh(date))}</small></div>`;
const signs = (list) => `<div class="signs">${list.join('')}</div>`;
const nameOf = (p, email) => (p ? R.memberName(p, email) : '') || email || '';
const supervisors = (p) => (p ? R.members(p).filter((m) => m.role === 'supervisor' || (m.role === 'owner' && R.ownerActsAs(p) === 'supervisor')) : []);
const committee = (p) => (p ? R.committeeSeats(p).slice().sort((a, b) => (+a.seat === 0 ? -1 : +b.seat === 0 ? 1 : +a.seat - +b.seat)) : []);

// ---------- แบบฟอร์มทางการ QP-CMD-MS-005 (จัดหน้าตามต้นฉบับ ไม่มีตรา CONTROLLED) ----------
const OFFICIAL_CSS = `
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
table.of td[data-f] { white-space: pre-wrap; overflow: visible; text-overflow: clip; }
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
.lf .dl.has { border-bottom: 0; height: auto; line-height: 1.4; white-space: pre-wrap; overflow: visible; }
.sp { display: inline-flex; gap: 4px; align-items: baseline; vertical-align: top; width: 100%; }
.sp > span:first-child { flex: none; }
.sp .v { flex: 1; min-width: 2em; }
.of-gap { height: 5.2mm; }
.of-sign { margin: 8mm 0 0 auto; width: 46%; text-align: center; line-height: 2; }
.of-sign .ln { display: block; width: 58%; margin: 0 auto; border-bottom: 1px dotted #000; height: 1.6em; }
.of-sign .nm { display: inline-flex; gap: 2px; align-items: baseline; }
.of-sign .nm .dl { display: inline-block; min-width: 150px; border-bottom: 1px dotted #000; min-height: 1.1em; line-height: 1.4; }
.of-sign .nm .dl.has { border-bottom: 0; font-weight: 600; }
.of-notes { margin-top: 3mm; } .of-notes ol { margin: 2mm 0 0 17mm; padding: 0; } .of-notes li { margin-bottom: 1.5mm; }
.u { text-decoration: underline; }
table.of-foot { width: 100%; border-collapse: collapse; margin-top: 5mm; }
table.of-foot td { border: 1px solid #000; padding: 4px 8px; text-align: center; }
@media print { body.official .sheet { margin: 0; box-shadow: none; } body.official:not(.of-long) .sheet { height: 297mm; } body.official.of-long .sheet { min-height: 0; } }
`;
/** ช่อง "หัวข้อ......" แบบ FM-001: มีค่า = แสดงค่า · ไม่มีค่า = เส้นประยาวถึงขอบช่อง */
const lf = (label, v) => `<div class="lf"><span>${e(label)}</span><span class="dl f${v === '' || v == null ? '' : ' has'}" data-f>${v === '' || v == null ? '' : e(v)}</span></div>`;
const lfd = (label, iso) => `<div class="lf"><span>${e(label)}</span>${FD(iso, 'short', { cls: `dl${iso ? ' has' : ''}`, ph: '' })}</div>`;
/** ช่องแบบ FM-002: หัวข้อแล้วตามด้วยค่า (ต้นฉบับไม่มีเส้นประ) — w = ความกว้างเมื่อมีหลายช่องในแถวเดียว */
const pv = (label, v, w = '') => `<span class="sp"${w ? ` style="width:${w}"` : ''}><span>${e(label)}</span><span class="v f" data-f>${e(v ?? '')}</span></span>`;
const pvd = (label, iso, w = '') => `<span class="sp"${w ? ` style="width:${w}"` : ''}><span>${e(label)}</span>${FD(iso, 'short', { cls: 'v', ph: '' })}</span>`;
/** ท้ายกระดาษตามต้นฉบับ (รหัสเอกสารและครั้งที่แก้ไข) */
const ofFoot = (kind) => `<table class="of-foot"><tr><td style="width:40%">รองผู้ว่าการธุรกิจเกี่ยวเนื่อง</td><td>รหัสเอกสาร ${e(FORMS[kind].code)}</td><td style="width:20%">แก้ไขครั้งที่ 00</td></tr></table>`;
const ORG = 'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย';
/** แยก "ขุดดินฐานราก 45 ลบ.ม." → [รายการ, ปริมาณ] — รับเฉพาะตัวเลขที่ตามด้วยหน่วยงานก่อสร้าง (กัน "ชั้น 2" ถูกนับเป็นปริมาณ) */
const UNIT = '(?:ลบ\\.?ม\\.?|ตร\\.?ม\\.?|ม\\.|เมตร|ตารางเมตร|ลูกบาศก์เมตร|คิว|กก\\.?|กิโลกรัม|ตัน|ต้น|จุด|ชุด|เส้น|แผ่น|ท่อน|ลิตร|คัน|ถุง|ก้อน|อัน|ตัว|ชิ้น|หลุม|ช่อง|บาน|ม้วน|กล่อง|ถัง|เที่ยว|งาน|แห่ง|m3|m2|m|kg|ton|pcs|set|lot|%)';
const QTY_RE = new RegExp(`^(.+?)[\\s:]+((?:จำนวน\\s*)?\\d[\\d,]*(?:\\.\\d+)?\\s*${UNIT})$`, 'i');
function splitQty(text) {
  const t = String(text || '').replace(/^\s*(?:\d+[.)]|[-•·])\s+/, '').trim();
  const m = t.match(QTY_RE);
  return m && m[1].length > 1 ? [m[1].trim(), m[2].trim()] : [t, ''];
}
/** "45 ลบ.ม." → ["45", "ลบ.ม."] */
const numUnit = (q) => {
  const m = String(q || '').match(/^(?:จำนวน\s*)?(\d[\d,]*(?:\.\d+)?)\s*(.*)$/);
  return m ? [m[1], m[2].trim()] : [String(q || ''), ''];
};
const linesOf = (text) => String(text || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const pad = (list, n, blank) => { const out = list.slice(); while (out.length < n) out.push(blank); return out; };
const contractorRep = (p) => p?.contractorRep || (p ? (R.members(p).find((m) => m.role === 'contractor')?.name || '') : '');
const supervisorName = (p) => p?.manager || (supervisors(p)[0] ? nameOf(p, supervisors(p)[0].email) : '');
/** งานที่บันทึกความคืบหน้า BOQ ในวันนั้น → [[รายการ, ปริมาณ, หน่วย]] */
function boqDone(p, day) {
  if (!p || !day) return [];
  const boq = store.boqOf(p.id);
  const out = [];
  store.updatesOf(p.id).filter((u) => u.date === day).forEach((u) => {
    Object.entries(u.entries || {}).forEach(([id, q]) => {
      const it = boq.find((b) => b.id === id);
      if (it && +q) out.push([`${it.no ? `${it.no} ` : ''}${it.desc}`, qtyTxt(q), it.unit || '']);
    });
  });
  return out;
}

// ---------- FM-001/QP-CMD-MS-005 รายละเอียดผลการตรวจวัสดุก่อสร้าง ----------
function formMaterial({ p, sub, date, today }) {
  const mat = sub ? String(sub.title || '').replace(/^ขออนุมัติ(?:ใช้)?\s*/, '') : '';
  const when = sub ? isoTh(sub.closedAt || sub.submittedAt) : (date || today || '');
  const rows = pad([], 9, `<tr>${TD()}${TD()}${TD()}${TD()}${TD()}</tr>`).join('');
  const sup = supervisorName(p);
  return `<div class="of-main">
  <div class="of-title">${e(ORG)}</div>
  <table class="of">
    <colgroup><col style="width:33.3%"><col style="width:30.8%"><col style="width:35.9%"></colgroup>
    <tr><td colspan="3">${lf('งานก่อสร้าง', p ? `${p.code ? `${p.code} ` : ''}${p.name}` : '')}</td></tr>
    <tr><td colspan="2">${lf('สถานที่', p?.location)}</td><td>${lf('เลขที่งาน (PM-Orderกอง)', p?.pmOrder)}</td></tr>
    <tr><td colspan="2">${lf('ผู้รับจ้าง', p?.contractor)}</td><td>${lf('สัญญาเลขที่', p?.contractNo)}</td></tr>
    <tr class="big"><td colspan="3">รายละเอียดผลการตรวจวัสดุก่อสร้าง</td></tr>
    <tr><td colspan="2">${lf('วัสดุ', mat)}</td><td>${lfd('วันที่', when)}</td></tr>
    <tr><td>${lf('จำนวนนำเข้าใช้งาน', '')}</td><td>${lf('จำนวนสุ่มตรวจ', '')}</td><td>${lf('มาตรฐานของวัสดุ', '')}</td></tr>
  </table>
  <div class="of-gap"></div>
  <table class="of">
    <colgroup><col style="width:32.5%"><col style="width:13.7%"><col style="width:14.3%"><col style="width:19.5%"><col style="width:20%"></colgroup>
    <tr class="head2"><th rowspan="2">รายละเอียดวัสดุ</th><th colspan="2">ขนาด หรือรูปแบบของวัสดุ</th><th rowspan="2">ผลการตรวจ</th><th rowspan="2">หมายเหตุ</th></tr>
    <tr class="head2"><th>ตัวอย่าง</th><th>มาตรฐาน</th></tr>
    ${rows}
  </table>
  <div class="of-sign"><span class="ln"></span><span class="nm">(<span class="dl f${sup ? ' has' : ''}" data-f>${e(sup)}</span>)</span><br>ผู้ควบคุมงาน</div>
  <div class="of-notes">หมายเหตุ
    <ol>
      <li>มาตรฐานที่ใช้อ้างอิง เป็นมาตรฐานของผู้ออกแบบ หรือมาตรฐานของผู้ผลิต หรือมาตรฐานสากลที่สามารถยอมรับได้</li>
      <li>จำนวนตัวอย่างตรวจสอบ ตามข้อกำหนดของผู้ออกแบบ<br>หรือตามข้อกำหนดของผลิตภัณฑ์ หรือตามข้อกำหนดของมาตรฐานสากลที่สามารถยอมรับได้</li>
    </ol>
  </div></div>
  ${ofFoot('material')}`;
}

// ---------- FM-002/QP-CMD-MS-005 บันทึกการควบคุมงานประจำวัน ----------
function formDaily({ p, daily: dy, date, today }) {
  const day = dy?.date || date || today || '';
  const W = R.WEATHER;
  const wx = dy ? [dy.weather?.am && `เช้า ${W[dy.weather.am] || ''}`, dy.weather?.pm && `บ่าย ${W[dy.weather.pm] || ''}`].filter(Boolean).join(' · ') : '';
  const [from, to] = String(dy?.workHours || '').split(/\s*(?:–|-|—|ถึง)\s*/).concat(['', '']);
  // รายละเอียดของงาน: งานที่บันทึก + ปริมาณงานจากบันทึกความคืบหน้าวันเดียวกัน (ถ้ามี)
  const work = linesOf(dy?.work).map(splitQty);
  const up = p && day ? store.updatesOf(p.id).find((u) => u.date === day) : null;
  if (dy || date) boqDone(p, day).forEach(([w, q, u]) => work.push([w, `${q} ${u}`.trim()]));
  const workRows = pad(work.map(([w, q], i) => `<tr>${TD(String(i + 1), 'class="c"')}${TD(w)}${TD(q)}</tr>`), 11, `<tr>${TD('', 'class="c"')}${TD()}${TD()}</tr>`).join('');
  // ปัญหา / การแก้ไข
  const probs = [
    ...(dy?.stoppage?.stopped ? [`หยุดงาน${dy.stoppage.hours ? ` ${dy.stoppage.hours} ชั่วโมง` : ''}${dy.stoppage.reason ? ` — ${dy.stoppage.reason}` : ''}`] : []),
    ...(up?.issues ? linesOf(up.issues) : []),
    ...(dy?.safety ? linesOf(dy.safety).map((x) => `ความปลอดภัย: ${x}`) : []),
  ];
  const fixes = linesOf(dy?.instructions);
  const lineRows = (list, n) => pad(list.map((x) => `<tr class="blank">${TD(x, 'colspan="6"')}</tr>`), n, `<tr class="blank">${TD('', 'colspan="6"')}</tr>`).join('');
  // วัสดุนำเข้า · ผู้ปฏิบัติงาน · เครื่องจักรทุนแรง
  const mats = linesOf(dy?.materials).map(splitQty);
  const men = dy?.manpower || [];
  const eq = dy?.equipment || [];
  const n = Math.max(5, mats.length, men.length, eq.length);
  const resRows = Array.from({ length: n }, (_, i) => `<tr>${TD(mats[i]?.[0] || '')}${TD(mats[i]?.[1] || '')}${TD(men[i]?.trade || '')}${TD(men[i]?.count ?? '', 'class="c"')}${TD(eq[i]?.name || '')}${TD(eq[i]?.count ?? '', 'class="c"')}</tr>`).join('');
  return `<div class="of-main">
  <div class="of-title">${e(ORG)}</div>
  <div class="of-sub">บันทึกการควบคุมงานประจำวัน</div>
  <table class="of">
    <colgroup><col style="width:50.4%"><col style="width:49.6%"></colgroup>
    <tr><td colspan="2">${pv('แผนก', p?.orgSection, '36%')}${pv('กอง', p?.orgDivision, '33%')}${pv('ฝ่าย', p?.orgDept, '31%')}</td></tr>
    <tr><td>${pv('งาน', p?.name)}</td><td>${pv('ผู้รับจ้าง', p?.contractor)}</td></tr>
    <tr><td>${pv('สถานที่', p?.location)}</td><td>${pv('ผู้แทนผู้รับจ้าง', contractorRep(p))}</td></tr>
    <tr><td>${pvd('วันที่', day, '38%')}${pv('เวลา จาก', from, '34%')}${pv('ถึง', to, '28%')}</td><td>${pv('สภาพอากาศ', wx)}</td></tr>
    <tr class="blank">${TD('', 'colspan="2"')}</tr>
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

// ---------- PT-F01 หนังสือขออนุมัติ + บันทึกการขออนุมัติ/ผลการตรวจสอบการขออนุมัติ ----------
const SUB_CSS = `
.sheet.letter { padding: 16mm 22mm 18mm; font-size: 15px; line-height: 1.7; }
.lh { border-bottom: 1.5px solid #555; padding-bottom: 4px; margin-bottom: 14px; min-height: 16mm; }
.lh .lh-name { display: block; font-size: 18px; font-weight: 700; }
.lh .lh-addr { display: block; font-size: 12.5px; color: #333; min-height: 1.2em; }
.lt-date { text-align: center; margin: 4px 0 16px; padding-left: 30%; }
table.lt-info { width: 100%; margin-bottom: 14px; }
table.lt-info td { padding: 1px 0; vertical-align: top; }
table.lt-info td.k { width: 1%; white-space: nowrap; padding-right: 8px; }
.att-row { display: flex; gap: 12px; } .att-row .att-t { flex: 1; } .att-row .att-q { flex: none; width: 31%; }
.para { margin: 0 0 12px; text-indent: 2.4em; text-align: left; min-height: 1.7em; }
.lt-close { margin: 26px 0 0 2.4em; }
.lt-sign { margin: 22px 0 0 46%; text-align: center; }
.lt-sign .sg-space { height: 46px; }
.sheet.tv { font-family: 'Taviraj', 'Angsana New', 'TH Sarabun New', serif; font-size: 13px; line-height: 1.45; }
table.rec { width: 100%; border-collapse: collapse; border: 2px solid #000; table-layout: fixed; }
table.rec th, table.rec td { border: 1px solid #000; padding: 2px 5px; font-weight: 400; }
table.rec .rec-t { text-align: center; font-size: 14px; padding: 3px; }
.rh { display: flex; gap: 10px; } .rh-l { flex: 1; } .rh-r { flex: none; width: 41%; text-align: right; }
.kv { display: flex; gap: 6px; align-items: baseline; } .kv .k { flex: none; width: 74px; } .kv .f { flex: 1; }
.rh-r .kv .k { width: auto; } .rh-r .kv { justify-content: flex-end; } .rh-r .kv .f { flex: 0 1 auto; text-align: left; }
.rh-gap { height: 14px; }
.ckgrid { display: grid; gap: 3px 14px; align-items: baseline; padding: 3px 0; font-size: 12.5px; }
.ckgrid > span { white-space: nowrap; }
.ckgrid.g3 { grid-template-columns: 74px repeat(3, max-content); column-gap: 30px; } .ckgrid.g5 { grid-template-columns: 74px repeat(5, max-content); }
.ckgrid .lbl { grid-column: 1; }
.ckgrid .q { display: inline-block; min-width: 2.2em; border-bottom: 1px dotted #000; text-align: center; }
.rec-items th { text-align: center; line-height: 1.3; vertical-align: middle; }
.rec-items td { height: 70px; text-align: center; vertical-align: middle; font-size: 12px; line-height: 1.35; }
.rec-note { margin-top: 3px; min-height: 1.4em; }
.rec-wrap { margin-top: 8mm; }
table.apv { width: 100%; border-collapse: collapse; border: 2px solid #000; table-layout: fixed; }
table.apv > tbody > tr > td { border: 2px solid #000; vertical-align: top; padding: 12px 14px 14px; height: 75mm; }
.ab { display: flex; flex-direction: column; gap: 3px; height: 100%; }
.ab .ah { margin-bottom: 8px; }
.ab .dline { display: flex; gap: 4px; align-items: baseline; } .ab .dline > span:first-child { flex: none; }
.ab .dline .f, .ab .dline .fd { flex: 1; border-bottom: 1px dotted #000; min-height: 1.35em; }
.ab .dline .f.has, .ab .dline .fd.has { border-bottom-color: transparent; }
.ab .ind { padding-left: 2.2em; }
.ab .cen { text-align: center; }
.ab .sgl { display: block; width: 52%; margin: 6px auto 2px; border-bottom: 1px dotted #000; height: 1.6em; }
.ab .nm { display: inline-block; min-width: 46%; }
.ab .role { font-size: 11.5px; color: #333; }
.ab .opt { display: flex; gap: 4px; align-items: baseline; padding-left: 0.4em; }
.ab .opt .f { flex: 1; border-bottom: 1px dotted #000; min-height: 1.35em; }
.ab .opt .f.has { border-bottom-color: transparent; }
@media print { .sheet.letter { padding: 2mm 8mm 0; } .sheet.tv { padding: 0; } }
`;
function formSub({ p, sub, today }) {
  const contractor = p?.contractor || '';
  const firm = /^บริษัท/.test(contractor) ? 'บริษัทฯ' : /^ห้าง/.test(contractor) ? 'ห้างฯ' : 'ผู้รับจ้าง';
  const files = sub ? (sub.files || []).map((id) => store.data.files.find((f) => f.id === id)).filter(Boolean) : [];
  const steps = sub?.steps || [];
  const no = sub ? `${R.subNo(sub)}${+sub.rev > 1 ? ` (ส่งครั้งที่ ${sub.rev})` : ''}` : '';
  const title = sub?.title || '';
  const date = sub ? isoTh(sub.submittedAt) : today;
  const value = p?.contractValue !== '' && p?.contractValue != null && +p.contractValue > 0 ? +p.contractValue : 0;
  const days = p?.startDate && p?.endDate ? Math.round((Date.parse(p.endDate) - Date.parse(p.startDate)) / 864e5) + 1 : 0;
  const detail = String(sub?.detail || '').replace(/\s*\n+\s*/g, ' ').trim().slice(0, 600);
  const P1 = `ตามที่ ${contractor || '………………………………'} ได้เป็นผู้รับจ้างทำ${p?.name || '………………………………………………'} มูลค่างาน ${value ? `${money(value)} บาท (${bahtText(value)})` : '……………………… บาท (………………………………)'} รวมภาษีมูลค่าเพิ่ม ระยะเวลาทำงาน ${days ? days.toLocaleString('th-TH') : '………'} วัน ตามสัญญาที่อ้างถึงนั้น`;
  const P2 = `ทาง${firm} มีความประสงค์${title ? `${title.replace(/^ขอ/, 'ขอ')}` : 'ขออนุมัติใช้วัสดุ ………………………………………………'}${detail ? ` ${detail}` : ''} เพื่อประกอบการดำเนินงานในโครงการฯ โดยมีรายละเอียดตามเอกสารแนบท้าย`;
  const P3 = `ในการนี้ ${firm} ขอความอนุเคราะห์จากท่าน โปรดพิจารณาอนุมัติตามที่เสนอ เพื่อให้การดำเนินโครงการเป็นไปอย่างต่อเนื่องและแล้วเสร็จตามแผนที่กำหนด`;
  const submitter = sub?.submittedByName || contractorRep(p);
  const atts = [
    `<div class="att-row">${F('1. ใบบันทึกการขออนุมัติ/ผลการตรวจสอบการขออนุมัติ', { cls: 'att-t' })}<span class="att-q">จำนวน ${F('2', { cls: 'q' })} แผ่น</span></div>`,
    ...files.map((f, i) => `<div class="att-row">${F(`${i + 2}. ${f.name}`, { cls: 'att-t' })}<span class="att-q">จำนวน ${F('1', { cls: 'q' })} ชุด</span></div>`),
  ];
  while (atts.length < 3) atts.push(`<div class="att-row">${F('', { cls: 'att-t', hint: `${atts.length + 1}. เอกสารแนบเพิ่ม (ถ้ามี)` })}</div>`);
  const letter = `
  <div class="lh">${F(contractor, { cls: 'lh-name', hint: 'ชื่อผู้รับจ้าง' })}${F('', { cls: 'lh-addr', hint: 'ที่อยู่ / โทรศัพท์ของผู้รับจ้าง (ถ้ามี)' })}</div>
  <div class="lt-date">วันที่ ${FD(date, 'long', { ph: '…………………………………' })}</div>
  <table class="lt-info">
    <tr><td class="k">เลขที่</td><td>: ${F(no, { ph: DOTS })}</td></tr>
    <tr><td class="k">เรื่อง</td><td>: ${F(title, { ph: DOTS })}</td></tr>
    <tr><td class="k">เรียน</td><td>: ${F('ผู้ควบคุมงาน')}</td></tr>
    <tr><td class="k">อ้างถึง</td><td>: สัญญาเลขที่ ${F(p?.contractNo || '', { ph: '…………………' })} ลงวันที่ ${FD(p?.contractDate || '', 'long', { ph: '…………………………' })}</td></tr>
    <tr><td class="k">สิ่งที่แนบมาด้วย</td><td>${atts.join('')}</td></tr>
  </table>
  <p class="para f multi" data-f>${e(P1)}</p>
  <p class="para f multi" data-f>${e(P2)}</p>
  <p class="para f multi" data-f>${e(P3)}</p>
  <p class="lt-close">จึงเรียนมาเพื่อโปรดพิจารณา</p>
  <div class="lt-sign">ขอแสดงความนับถือ<br>${F(contractor, { ph: DOTS })}<div class="sg-space"></div>(${F(submitter, { ph: DOTS })})<br>${F('', { hint: 'ตำแหน่ง' })}</div>`;

  // หน้า 2 บันทึกการขออนุมัติ
  const vote = sub?.vote?.status === 'closed' ? (sub.vote.options || []).find((o) => o.id === sub.vote.result)?.label || '' : '';
  const ck = (on, label, q = null) => `<span>${CK(on)}${e(label)}${q != null ? `จำนวน${F(q, { cls: 'q' })}ชุด` : ''}</span>`;
  const items = pad([], 8, `<tr>${TD()}${TD()}${TD()}${TD()}${TD()}${TD()}${TD()}</tr>`).join('');
  const record = `
  <table class="rec">
    <tr><th class="rec-t">บันทึกการขออนุมัติ/ผลการตรวจสอบการขออนุมัติ</th></tr>
    <tr><td>
      <div class="rh">
        <div class="rh-l">
          <div class="kv"><span class="k">เลขที่ :</span>${F(no)}</div>
          <div class="kv"><span class="k">เรื่อง :</span>${F(title)}</div>
          <div class="kv"><span class="k">วันที่ :</span>${FD(date, 'long', { ph: '' })}</div>
          <div class="kv"><span class="k">โครงการ :</span>${F(p?.name || '')}</div>
          <div class="kv"><span class="k">ผู้รับจ้าง :</span>${F(contractor)}</div>
        </div>
        <div class="rh-r">
          <div class="kv"><span class="k">เรียน</span>${F('คณะกรรมการตรวจรับ ผ่านผู้ควบคุมงาน')}</div>
          <div class="kv"><span class="k">ตามสัญญาเลขที่ :</span>${F(p?.contractNo || '')}</div>
        </div>
      </div>
      <div class="rh-gap"></div>
    </td></tr>
    <tr><td>
      <div class="ckgrid g3">
        <span class="lbl">แนบเอกสาร</span>${ck(false, 'แค็ตตาล็อก', '')}${ck(false, 'ตัวอย่างวัสดุ', '')}${ck(!!files.length, 'เอกสารประกอบ', files.length ? String(files.length) : '')}
        <span class="lbl"></span>${ck(false, 'Shop Drawing ', '')}${ck(false, 'อื่น', '')}<span></span>
      </div>
      <div class="ckgrid g5">
        <span class="lbl">ประเภทงาน</span>${ck(false, 'งานโครงสร้าง')}${ck(false, 'งานสถาปัตยกรรม')}${ck(false, 'งานระบบสุขาภิบาล')}${ck(false, 'งานระบบไฟฟ้า')}${ck(false, 'งานระบบเครื่องกล')}
        <span class="lbl"></span>${ck(false, 'งานระบบประปา')}<span style="grid-column:span 3">${CK(false)}งานอื่นๆ ${F('', { ph: '……………………………………………' })}</span><span></span>
      </div>
    </td></tr>
  </table>
  <table class="rec rec-items" style="margin-top:4px">
    <colgroup><col style="width:8%"><col style="width:14.5%"><col style="width:18%"><col style="width:18%"><col style="width:14.5%"><col style="width:14.5%"><col style="width:12.5%"></colgroup>
    <tr><th colspan="4">สิ่งที่ผู้รับจ้างเสนอ</th><th colspan="3">ผลการตรวจสอบของ กฟผ.</th></tr>
    <tr><th>ลำดับ</th><th>หมายเลขแบบอ้างอิง<br>(Drawing No.)</th><th>คุณสมบัติ/ข้อกำหนดใน<br>สัญญา (Technical Spec.)</th><th>คุณสมบัติ/ข้อกำหนดที่เสนอ<br>(Submitted Spec.)</th><th>สิ่งที่ไม่สอดคล้อง<br>(Deviation)</th><th>เห็นชอบ/ไม่เห็นชอบ<br>(Accept/No.)</th><th>หมายเหตุ<br>(Remark)</th></tr>
    ${items}
  </table>
  <div class="rec-note">${F(vote ? `ผลโหวตเลือกรูปแบบ: ${vote}` : '', { hint: 'หมายเหตุใต้ตาราง (ถ้ามี)' })}</div>`;

  // หน้า 3 ช่องพิจารณา — จับคู่กับขั้นตอนพิจารณาในระบบ (ผู้ควบคุมงาน กรรมการตามลำดับ ประธานกรรมการ)
  const decided = (s) => s && (s.status === 'approved' || s.status === 'rejected');
  const supStep = steps.find((s) => s.role === 'supervisor');
  const comSteps = steps.filter((s) => s.role === 'committee');
  const hasSeat = (s) => s && s.seat !== '' && s.seat != null;
  const chairStep = comSteps.find((s) => hasSeat(s) && +s.seat === 0);
  const seats = committee(p);
  const chairMember = seats.find((m) => +m.seat === 0);
  let members = seats.filter((m) => +m.seat !== 0).map((m) => ({ m, s: comSteps.find((s) => hasSeat(s) && String(s.seat) === String(m.seat)) }));
  if (!members.length && comSteps.some((s) => !hasSeat(s))) members = comSteps.filter((s) => !hasSeat(s)).map((s) => ({ m: null, s }));
  while (members.length < 2) members.push({ m: null, s: null });
  const who = (s, m) => (decided(s) ? s.byName || nameOf(p, s.by) : '') || (m ? nameOf(p, m.email) : '');
  const when = (s) => (decided(s) ? isoTh(s.at) : '');
  const dl = (label, v, opts = {}) => `<div class="dline"><span>${e(label)}</span>${F(v, opts)}</div>`;
  const signBlock = (name, date, role = '', { dept = false } = {}) => `<span class="sgl"></span>
    <div class="cen">(${F(name, { cls: 'nm', ph: DOTS })})</div>
    ${dept ? `<div class="dline ind" style="justify-content:center"><span>แผนก/หมวด</span>${F('', { style: 'flex:0 1 46%' })}</div>` : ''}
    <div class="cen">วันที่ ${FD(date, 'slash', { ph: '…………/…………/…………' })}</div>
    ${role ? `<div class="cen role">${F(role)}</div>` : ''}`;
  const boxSender = (comment, name, date, role) => `<div class="ab">${dl('หมายเหตุ', comment)}<div class="ind">จึงเรียนมาเพื่อโปรดพิจารณา</div>${signBlock(name, date, role)}</div>`;
  const boxChair = () => {
    const s = chairStep;
    const ok = decided(s) && s.status === 'approved';
    const no2 = decided(s) && s.status === 'rejected';
    return `<div class="ab" data-ckg><div class="ah">เรียน ประธานกรรมการ</div>
      <div class="opt">${CK(ok && !s.comment, 'chair')}<span>อนุมัติ</span></div>
      <div class="opt">${CK(ok && !!s.comment, 'chair')}<span>อนุมัติ โดย</span>${F(ok ? s.comment || '' : '')}</div>
      <div class="opt">${F('')}</div>
      <div class="opt">${CK(no2, 'chair')}<span>ไม่อนุมัติ โดย</span>${F(no2 ? s.comment || '' : '')}</div>
      <div class="opt">${F('')}</div>
      <div class="cen" style="margin-top:4px">ลงชื่อ</div>${signBlock(who(s, chairMember), when(s), 'ประธานกรรมการ', { dept: true })}</div>`;
  };
  const boxMember = ({ m, s }, i) => `<div class="ab" data-ckg><div class="ah">กรรมการ${m && +m.seat ? ` ลำดับที่ ${+m.seat}` : members.length > 2 ? ` ลำดับที่ ${i + 1}` : ''}</div>
      <div class="opt">${CK(decided(s) && s.status === 'approved', 'cm')}<span>เห็นชอบ</span></div>
      <div class="opt">${CK(decided(s) && s.status === 'rejected', 'cm')}<span>ไม่เห็นชอบ</span></div>
      ${dl('หมายเหตุ', decided(s) ? s.comment || '' : '')}
      <div class="opt">${F('')}</div>
      <div class="ind">จึงเรียนมาเพื่อโปรดพิจารณา</div>
      <div class="cen">ลงชื่อ</div>${signBlock(who(s, m), when(s), '', { dept: true })}</div>`;
  const boxAck = `<div class="ab"><div class="ah">หมายเหตุ</div><div style="margin-top:14px">ผู้รับจ้างลงนามรับทราบเพื่อดำเนินการต่อไป</div>${LINES(3)}</div>`;
  const cells = [
    boxSender('', submitter, date, 'ผู้รับจ้าง'),
    boxSender(decided(supStep) ? supStep.comment || '' : '', who(supStep, null) || supervisorName(p), when(supStep), 'ผู้ควบคุมงาน'),
    boxChair(),
    ...members.map(boxMember),
    boxAck,
  ];
  if (cells.length % 2) cells.push('');
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(`<tr><td${i === 0 ? ' style="height:62mm"' : ''}>${cells[i]}</td><td${i === 0 ? ' style="height:62mm"' : ''}>${cells[i + 1]}</td></tr>`);
  const approvals = `<div class="rec-wrap"><table class="apv"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tbody>${rows.join('')}</tbody></table></div>`;
  return [{ cls: 'letter', html: letter }, { cls: 'tv', html: record }, { cls: 'tv', html: approvals }];
}

// ---------- PT-F07 Daily Report and Daily Request (ผู้รับจ้าง) ----------
const CDAILY_CSS = `
@page { size: A4; margin: 8mm; }
.sheet.cd { padding: 8mm; font-size: 9.6px; line-height: 1.3; font-family: 'Sarabun', Tahoma, sans-serif; }
table.cd { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.cd td, table.cd th { border: 1px solid #000; padding: 1px 3px; height: 15px; vertical-align: middle; font-weight: 400; }
table.cd th { text-align: center; font-weight: 600; }
table.cd td.c, table.cd th.c { text-align: center; } table.cd td.r { text-align: right; }
.cd .blue { background: #0070C0; color: #fff; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cd .yel { background: #FFFF00; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.cd .hd-t { font-size: 11.5px; font-weight: 700; text-decoration: underline; text-align: center; height: 22px; }
.cd .red { color: #C00000; }
.cd .kv { display: flex; gap: 4px; align-items: baseline; } .cd .kv .k { flex: none; width: 54px; } .cd .kv .f { flex: 1; }
.cd .wx { display: flex; flex-wrap: wrap; gap: 2px 10px; margin-top: 2px; } .cd .wx .f { min-width: 5em; }
.cd .rt { text-align: right; } .cd .rt .f { min-width: 6em; }
.cd .fdrow { display: flex; justify-content: center; gap: 22px; }
.cd .g { font-weight: 600; } .cd .g1 { padding-left: 10px !important; } .cd .g2 { padding-left: 18px !important; } .cd .g3 { padding-left: 26px !important; }
.cd .gap { height: 4px; }
.cd .sg td { height: 17px; } .cd .sg .lbl { width: 50px; white-space: nowrap; } .cd .sg .ln { border-bottom: 1px dotted #000; }
.sheet.ph { padding: 10mm 14mm; font-size: 13px; }
table.phg { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.phg th { border: 1px solid #000; font-size: 15px; padding: 3px; }
table.phg td { border: 1px solid #000; padding: 3px; text-align: center; }
table.phg td.ph-cell { height: 72mm; position: relative; cursor: pointer; }
table.phg td.ph-cell img { max-width: 100%; max-height: 70mm; object-fit: contain; display: block; margin: 0 auto; }
table.phg td.cap { height: 7mm; font-weight: 600; }
.ph-hint { color: #7A8496; font-size: 12px; }
.ph-cell.has-img .ph-hint { display: none; }
.ph-x { position: absolute; top: 4px; right: 4px; display: none; width: 24px; height: 24px; border-radius: 12px; border: 0; background: rgba(0,0,0,.6); color: #fff; font-size: 15px; line-height: 24px; cursor: pointer; }
.ph-cell.has-img:hover .ph-x, .ph-cell.has-img:focus-within .ph-x { display: block; }
@media print { .sheet.cd, .sheet.ph { padding: 0; } }
`;
const MP_DEFAULT = ['Project Manager', 'Site Engineer', 'Office Engineer', 'Supervisor', 'Foreman', 'Operator/Driver', 'M&E technician', 'Safety', 'Headman', 'Worker', 'Welder'];
function formCDaily({ p, daily: dy, date, today }) {
  const doc = today || todayTh();
  const rep = dy?.date || date || doc;
  const req = R.addDaysIso(rep, 1);
  const hours = dy?.workHours ? `${dy.workHours}${/น\.?$/.test(dy.workHours) ? '' : ' น.'}` : '08.00-17.00 น.';
  const W = R.WEATHER;
  const contractor = p?.contractor || '';
  // งานที่ทำได้ (รายงาน) — จากรายงานประจำวัน + บันทึกความคืบหน้า BOQ ของวันนั้น
  const done = linesOf(dy?.work).map(splitQty).map(([w, q]) => [w, ...numUnit(q)]);
  if (p) boqDone(p, rep).forEach((x) => done.push(x));
  const nRows = Math.max(14, done.length);
  const dRows = Array.from({ length: nRows }, (_, i) => {
    const x = done[i];
    return `<tr>${TD(x ? String(i + 1) : '', 'class="c"')}${TD(x?.[0] || '')}${TD(x?.[1] || '', 'class="c"')}${TD(x?.[2] || '', 'class="c"')}${TD('', 'class="c"')}${TD()}${TD('', 'class="c"')}${TD('', 'class="c"')}</tr>`;
  }).join('');
  // ความคืบหน้าตาม BOQ ณ วันที่รายงาน
  const items = p ? store.boqOf(p.id) : [];
  const ups = p ? store.updatesOf(p.id).filter((u) => u.date && u.date <= rep) : [];
  const accum = Object.create(null), day = Object.create(null);
  ups.forEach((u) => Object.entries(u.entries || {}).forEach(([k, q]) => {
    accum[k] = (accum[k] || 0) + (+q || 0);
    if (u.date === rep) day[k] = (day[k] || 0) + (+q || 0);
  }));
  const dash = (v) => (v ? qtyTxt(v) : '-');
  const boqRows = [];
  let prev = [];
  items.forEach((it) => {
    const path = String(it.group || '').split(' › ').map((x) => x.trim()).filter(Boolean);
    path.forEach((g, i) => {
      if (prev[i] !== g || prev.slice(0, i).join('›') !== path.slice(0, i).join('›')) {
        boqRows.push(`<tr>${TD(g, `class="g g${Math.min(i, 3)}"`)}${TD()}${TD('', 'class="c"')}${TD('', 'class="r"')}${TD('', 'class="r"')}${TD('', 'class="r"')}${TD('', 'class="r"')}${TD()}</tr>`);
      }
    });
    prev = path;
    const q = +it.qty || 0;
    const a = accum[it.id] || 0;
    const r = q > 0 ? Math.max(0, a / q) : 0;
    boqRows.push(`<tr>${TD(`${it.no ? `${it.no} ` : ''}${it.desc || ''}`, `class="g${Math.min(path.length, 3)}"`)}${TD(q ? qtyTxt(q) : '', 'class="r"')}${TD(it.unit || '', 'class="c"')}${TD(dash(day[it.id]), 'class="r"')}${TD(dash(a), 'class="r"')}${TD(q > 0 ? `${(r * 100).toFixed(1)}%` : '', 'class="r"')}${TD(q > 0 ? `${(Math.max(0, 1 - r) * 100).toFixed(1)}%` : '', 'class="r"')}${TD()}</tr>`);
  });
  while (boqRows.length < 10) boqRows.push(`<tr>${TD()}${TD('', 'class="r"')}${TD('', 'class="c"')}${TD('', 'class="r"')}${TD('', 'class="r"')}${TD('', 'class="r"')}${TD('', 'class="r"')}${TD()}</tr>`);
  const issues = [
    ...(dy?.stoppage?.stopped ? [`หยุดงาน${dy.stoppage.hours ? ` ${dy.stoppage.hours} ชม.` : ''}${dy.stoppage.reason ? ` — ${dy.stoppage.reason}` : ''}`] : []),
    ...ups.filter((u) => u.date === rep && u.issues).flatMap((u) => linesOf(u.issues)),
  ].join('\n');
  // แทรกช่อง "ปัญหาและอุปสรรค" (ช่องเดียวสูงตลอดตาราง) ในแถวแรก
  boqRows[0] = boqRows[0].replace(/<\/tr>$/, `<td class="f multi" data-f rowspan="${boqRows.length}" style="vertical-align:top">${e(issues)}</td></tr>`);
  // คนงาน: สะสมจากรายงานประจำวันก่อนหน้า + วันนี้
  const dys = p ? store.dailyOf(p.id).filter((x) => x.date <= rep) : (dy ? [dy] : []);
  const trades = [];
  const upto = Object.create(null), now = Object.create(null);
  [...(dy ? [dy] : []), ...dys].forEach((x) => (x.manpower || []).forEach((m) => { const t = String(m.trade || '').trim(); if (t && !trades.includes(t)) trades.push(t); }));
  dys.filter((x) => x.date < rep).forEach((x) => (x.manpower || []).forEach((m) => { const t = String(m.trade || '').trim(); upto[t] = (upto[t] || 0) + (+m.count || 0); }));
  (dy?.manpower || []).forEach((m) => { const t = String(m.trade || '').trim(); now[t] = (now[t] || 0) + (+m.count || 0); });
  const mpList = trades.length ? trades : MP_DEFAULT;
  const eq = (dy?.equipment || []).filter((x) => x.name);
  const half = Math.max(15, Math.ceil(eq.length / 2));
  const nMp = Math.max(16, mpList.length, half);
  // แถวเดียวกัน: คนงาน (ซ้าย) และเครื่องจักร 2 ชุดคอลัมน์ (ขวา) — ผลรวม Accumulate และ Total คำนวณใหม่เมื่อแก้ตัวเลข
  const resRows = Array.from({ length: nMp }, (_, i) => {
    const t = mpList[i];
    const u = t && trades.length ? qtyTxt(upto[t] || 0) : '';
    const n = t && trades.length ? qtyTxt(now[t] || 0) : '';
    const a = eq[i], b = eq[i + nMp];
    return `<tr>${TD(t ? `${i + 1}. ${t}` : '')}${TD(u, 'class="r" data-col="ud"')}${TD('', 'class="r" data-col="uo"')}${TD(n, 'class="r" data-col="dd"')}${TD('', 'class="r" data-col="do"')}<td class="r" data-calc="ud+dd" data-col="ad"></td><td class="r" data-calc="uo+do" data-col="ao"></td>`
      + `${TD(a ? `${i + 1}. ${a.name}` : '')}${TD(a ? qtyTxt(a.count) : '', 'class="c" data-col="eq"')}${TD()}${TD(b ? `${i + nMp + 1}. ${b.name}` : '')}${TD(b ? qtyTxt(b.count) : '', 'class="c" data-col="eq"')}${TD()}</tr>`;
  }).join('');
  const wx = dy ? [dy.weather?.am && W[dy.weather.am], dy.weather?.pm && W[dy.weather.pm]].filter(Boolean).join(' / ') : '';
  const sgCell = (name, role, dateIso) => `<td style="padding:2px 4px;vertical-align:top"><table class="cd sg"><colgroup><col style="width:50px"><col></colgroup>
    <tr><td class="lbl" style="border:0">Signature :</td><td style="border:0" class="ln"></td></tr>
    <tr><td class="lbl" style="border:0">Name :</td><td style="border:0">${F(name, { ph: '…………………………' })}</td></tr>
    <tr><td class="lbl" style="border:0">Date :</td><td style="border:0">${FD(dateIso, 'med', { ph: '……………………………' })}</td></tr>
    <tr><td style="border:0"></td><td style="border:0" class="c">${F(role, { hint: 'ตำแหน่ง' })}</td></tr></table></td>`;
  const page1 = `
  <table class="cd">
    <colgroup><col style="width:50%"><col style="width:50%"></colgroup>
    <tr><td class="hd-t">Daily Report and Daily Request</td><td class="hd-t">${F(contractor, { hint: 'ชื่อผู้รับจ้าง' })}</td></tr>
    <tr><td style="padding:3px 4px">
        <div class="kv"><span class="k">Project :</span>${F(p ? `${p.code ? `${p.code} ` : ''}${p.name}` : '')}</div>
        <div class="kv"><span class="k">Owner :</span>${F(ORG)}</div>
        <div class="kv"><span class="k">Contractor :</span>${F(contractor)}</div>
        <div class="wx"><span>สภาพอากาศ 06.00–18.00 น. ${F(wx)}</span><span>18.00–06.00 น. ${F('')}</span><span>PM 2.5 ${F('')} µg/m³</span></div>
      </td>
      <td style="padding:3px 6px">
        <div class="rt">สัญญาเลขที่ ${F(p?.contractNo || '', { ph: '……………………' })} ลงวันที่ ${FD(p?.contractDate || '', 'long', { ph: '……………………' })}</div>
        <div class="rt" style="margin-top:14px">Date: <span class="red">${FD(doc, 'long')}</span></div>
      </td></tr>
  </table>
  <table class="cd" style="border-top:0">
    <colgroup><col style="width:4%"><col style="width:29%"><col style="width:6%"><col style="width:6%"><col style="width:4%"><col style="width:39%"><col style="width:5%"><col style="width:7%"></colgroup>
    <tr><td colspan="4" class="blue">Daily Report</td><td colspan="4" class="blue">Daily Request</td></tr>
    <tr><td colspan="4"><div class="fdrow red"><span>For date : ${FD(rep, 'short', { id: 'rep' })}</span><span>Time : ${F(hours)}</span></div></td>
      <td colspan="4"><div class="fdrow red"><span>For date : ${FD(req, 'short', { follow: 'rep:1' })}</span><span>Time : ${F(hours)}</span></div></td></tr>
    <tr><th rowspan="2">ลำดับ</th><th rowspan="2">รายละเอียดของงาน</th><th colspan="2">ปริมาณที่ทำได้</th><th rowspan="2">ลำดับ</th><th rowspan="2">รายละเอียดของงาน</th><th rowspan="2">ปริมาณ</th><th rowspan="2">ช่าง/คนงาน</th></tr>
    <tr><th>จำนวน</th><th>หน่วย</th></tr>
    ${dRows}
    <tr><td colspan="8"><div class="kv"><span class="k" style="width:auto;color:#0070C0">Miscellaneous works :</span>${F('')}</div></td></tr>
    <tr>${TD('', 'colspan="8"')}</tr>
  </table>
  <div class="gap"></div>
  <table class="cd">
    <colgroup><col style="width:33%"><col style="width:7%"><col style="width:5%"><col style="width:7%"><col style="width:7%"><col style="width:7%"><col style="width:7%"><col style="width:9%"><col style="width:18%"></colgroup>
    <tr><th class="blue">Description</th><th class="blue">Est. Qty.</th><th class="blue">Unit</th><th class="blue">Yesterday Qty.</th><th class="blue">Accum. Qty.</th><th class="blue">Progress (%)</th><th class="blue">Remaining Qty.</th><th class="blue">Remark</th><th class="yel">ปัญหาและอุปสรรค</th></tr>
    ${boqRows.join('')}
  </table>
  <div class="gap"></div>
  <table class="cd">
    <colgroup><col style="width:16%"><col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%"><col style="width:14.5%"><col style="width:4.2%"><col style="width:5.5%"><col style="width:14.5%"><col style="width:4.2%"><col style="width:6.3%"></colgroup>
    <tr><th rowspan="2" class="blue">Description</th><th colspan="2" class="blue">Upto last day</th><th colspan="2" class="blue">To day</th><th colspan="2" class="blue">Accumulate</th><th colspan="6" class="blue">Const. Equipment Status (S/D)</th></tr>
    <tr><th class="blue">Day</th><th class="blue">O/T(hr.)</th><th class="blue">Day</th><th class="blue">O/T(hr.)</th><th class="blue">Day</th><th class="blue">O/T(hr.)</th><th class="blue">Description</th><th class="blue">Qty.</th><th class="blue">Remark</th><th class="blue">Description</th><th class="blue">Qty.</th><th class="blue">Remark</th></tr>
    ${resRows}
    <tr><td class="c">Total (MD)</td><td class="r" data-sum="ud"></td><td class="r" data-sum="uo"></td><td class="r" data-sum="dd"></td><td class="r" data-sum="do"></td><td class="r" data-sum="ad"></td><td class="r" data-sum="ao"></td><td colspan="4" class="c">Total (SD)</td><td class="c" data-sum="eq"></td><td></td></tr>
  </table>
  <table class="cd" style="margin-top:-1px">
    <colgroup><col style="width:20%"><col style="width:20%"><col style="width:20%"><col style="width:40%"></colgroup>
    <tr><th colspan="3">ผู้รับจ้าง</th><th>ผู้ควบคุมงาน</th></tr>
    <tr>${sgCell(contractorRep(p), 'วิศวกรโครงการ', doc)}${sgCell('', 'วิศวกรสนาม', doc)}${sgCell('', 'เจ้าหน้าที่ความปลอดภัย', doc)}${sgCell(supervisorName(p), 'ผู้ควบคุมงาน', '')}</tr>
  </table>`;
  const cell = (i) => `<td class="ph-cell" data-photo="${i}"><span class="ph-hint">คลิกเพื่อเลือกรูป หรือลากรูปมาวาง</span><button type="button" class="ph-x" aria-label="เอารูปออก">×</button></td>`;
  const page2 = `
  <table class="phg">
    <tr><th colspan="2">ภาพประกอบการทำงาน</th></tr>
    ${[0, 2, 4].map((i) => `<tr>${cell(i)}${cell(i + 1)}</tr><tr>${TD('', 'class="cap"')}${TD('', 'class="cap"')}</tr>`).join('')}
  </table>`;
  return [{ cls: 'cd', html: page1 }, { cls: 'ph', html: page2 }];
}

// ---------- F03 รายงานประจำสัปดาห์ ----------
function formWeekly({ p, to, today }) {
  to = to || today || todayTh();
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
    return `<tr><td class="nowrap">${e(d(iso))}</td>${TD(w)}${TD(x ? String(R.manpowerTotal(x)) : '', 'class="r"')}${TD(x ? String(x.work || '').slice(0, 160) : '')}${TD(x?.stoppage?.stopped ? `${x.stoppage.hours ? `${x.stoppage.hours} ชม. ` : ''}${x.stoppage.reason || ''}` : '')}</tr>`;
  };
  return `${head('weekly', p)}
  ${projectInfo(p, [['ระหว่างวันที่', { html: `${FD(from)} – ${FD(to)}` }], ['สัปดาห์ที่ของสัญญา', a?.week ? String(a.week) : '']])}
  <h2>ผลงาน</h2>
  <table class="grid small"><tr><th>ผลงานสะสม</th><th>แผนงานสะสม</th><th>เทียบแผน</th><th>เพิ่มขึ้นในสัปดาห์</th><th>ระยะเวลาคงเหลือ</th></tr>
    <tr>${TD(pct(a?.actual), 'class="c"')}${TD(pct(a?.plan), 'class="c"')}${TD(a ? `${((a.actual - a.plan) * 100).toFixed(2)}%` : '', 'class="c"')}${TD(a && prev ? `${((a.actual - prev.actual) * 100).toFixed(2)}%` : '', 'class="c"')}${TD(a?.daysLeft != null ? (a.daysLeft >= 0 ? `${a.daysLeft} วัน` : `เกินสัญญา ${-a.daysLeft} วัน`) : '', 'class="c"')}</tr></table>
  <h2>สรุปรายวัน</h2>
  <table class="grid small"><tr><th style="width:13%">วันที่</th><th style="width:13%">อากาศ</th><th class="r" style="width:8%">คนงาน</th><th>งานที่ดำเนินการ</th><th style="width:20%">หยุดงาน</th></tr>${days.map(rowOf).join('')}</table>
  <h2>ปัญหาและอุปสรรค</h2>${LINES(Math.max(3, issues.length), issues.map((u) => `${d(u.date)}: ${u.issues}`))}
  <h2>เรื่องขออนุมัติ</h2>
  <p class="small">ปิดเรื่องในสัปดาห์ ${closed.length} เรื่อง · ค้างพิจารณา ${pend.length} เรื่อง</p>
  ${pend.length ? `<table class="grid small"><tr><th style="width:10%">เลขที่</th><th>เรื่อง</th><th style="width:28%">ขั้นตอนปัจจุบัน</th><th class="r" style="width:12%">ค้าง (วัน)</th></tr>${pend.map((s) => `<tr><td>${e(R.subNo(s))}</td><td>${e(s.title)}</td><td>${e(s.steps?.[s.currentStep || 0]?.label || '')}</td><td class="r">${Math.floor(R.subSla(s, p, store.settings).age)}</td></tr>`).join('')}</table>` : ''}
  <h2>ความเห็นของผู้ควบคุมงาน</h2>${LINES(3)}
  ${signs([sign('ผู้ควบคุมงาน', supervisors(p)[0] ? nameOf(p, supervisors(p)[0].email) : '', to), ...committee(p).slice(0, 1).map((m) => sign(`${R.seatLabel(m.seat)}ตรวจรับพัสดุ (รับทราบ)`, nameOf(p, m.email)))])}
  ${foot('weekly')}`;
}

// ---------- F04 บันทึกการประชุม ----------
function formMeeting({ p, m, today }) {
  const att = m ? m.attendees || [] : [];
  const acts = m ? m.actions || [] : [];
  return `${head('meeting', p)}
  <table class="info">
    <tr><td class="k">เรื่อง</td><td>${val(m?.title || '', '80%')}</td></tr>
    <tr><td class="k">วันเวลา</td><td>${m ? val(R.meetingWhen(m), '60%') : `${FD(today, 'long')} เวลา ${line('120px')}`}</td></tr>
    <tr><td class="k">สถานที่</td><td>${val(m ? m.place || (m.link ? 'ประชุมออนไลน์' : '') : '', '60%')}</td></tr>
  </table>
  <h2>ผู้เข้าประชุม</h2>
  <table class="grid small"><tr><th style="width:6%">ที่</th><th>ชื่อ</th><th style="width:30%">ตำแหน่ง/บทบาท</th><th style="width:22%">ลงชื่อ</th></tr>
    ${(att.length ? att : Array(8).fill('')).map((x, i) => `<tr><td class="c">${i + 1}</td>${TD(x ? nameOf(p, x) : '')}${TD(x && p && R.roleOf(p, x) ? R.ROLES[R.roleOf(p, x)].label : '')}<td></td></tr>`).join('')}</table>
  <h2>วาระการประชุม</h2>${LINES(Math.max(4, linesOf(m?.agenda).length), linesOf(m?.agenda))}
  <h2>สรุปการประชุม</h2>${LINES(Math.max(8, linesOf(m?.minutes).length), linesOf(m?.minutes))}
  <h2>งานที่มอบหมาย</h2>
  <table class="grid small"><tr><th style="width:6%">ที่</th><th>งาน</th><th style="width:24%">ผู้รับผิดชอบ</th><th style="width:16%">กำหนดเสร็จ</th><th style="width:10%">สถานะ</th></tr>
    ${(acts.length ? acts : Array(4).fill(null)).map((a, i) => `<tr><td class="c">${i + 1}</td>${TD(a?.text || '')}${TD(a?.owner ? nameOf(p, a.owner) : '')}<td>${FD(a?.due || '', 'short', { ph: '' })}</td>${TD(a ? (a.done ? 'เสร็จแล้ว' : 'ยังไม่เสร็จ') : '')}</tr>`).join('')}</table>
  ${signs([sign('ผู้จดบันทึกการประชุม', m?.updatedByName || m?.createdByName || '', m?.date || today), sign('ประธานในที่ประชุม')])}${foot('meeting')}`;
}

// ---------- F05 บันทึกการตรวจรับงาน ----------
function formInspect({ p, today }) {
  const a = p ? store.analysis(p.id) : null;
  const com = committee(p);
  const seats = com.length ? com : [{ seat: 0 }, { seat: 1 }, { seat: 2 }];
  return `${head('inspect', p)}
  ${projectInfo(p, [['มูลค่าสัญญา', p?.contractValue ? `${money(p.contractValue)} บาท` : ''], ['งวดงานที่', ''], ['วันที่ผู้รับจ้างส่งมอบงาน', { html: FD('', 'long', { ph: '…………………………' }) }], ['วันที่ตรวจรับ', { html: FD(today, 'long') }]])}
  <h2>ผลงานตามระบบ ณ วันที่พิมพ์</h2>
  <p>ผลงานสะสม ${val(pct(a?.actual), '80px')} แผนงานสะสม ${val(pct(a?.plan), '80px')}</p>
  <h2>รายการงานที่ส่งมอบในงวดนี้</h2>${LINES(6)}
  <h2>ผลการตรวจรับ</h2>
  <div style="line-height:2" data-ckg>
    <div>${CK(false, 'res')}ผู้รับจ้างได้ปฏิบัติงานถูกต้องครบถ้วนตามสัญญา คณะกรรมการตรวจรับพัสดุเห็นควรรับงานงวดนี้</div>
    <div>${CK(false, 'res')}ผู้รับจ้างได้ปฏิบัติงานไม่ถูกต้อง/ไม่ครบถ้วน ให้แก้ไขภายในวันที่ ${FD('', 'long', { ph: '…………………………' })}</div>
    <div>รายละเอียด ${line('80%')}</div>
  </div>
  <h2>ค่าปรับ (ถ้ามี)</h2>
  <p>ส่งมอบเกินกำหนด ${line('60px')} วัน อัตราค่าปรับร้อยละ ${line('60px')} ต่อวัน เป็นเงิน ${line('120px')} บาท</p>
  <p class="small muted">อ้างอิง: พ.ร.บ. การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 และระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 176 (การตรวจรับในงานจ้างก่อสร้าง) — ตรวจสอบระเบียบและหนังสือเวียนฉบับปัจจุบันในคลังแบบฟอร์มและระเบียบ</p>
  ${signs(seats.map((m) => sign(`${R.seatLabel(m.seat) || 'กรรมการ'}ตรวจรับพัสดุ`, m.email ? nameOf(p, m.email) : '')))}
  ${foot('inspect')}`;
}

// ---------- F06 ใบสั่งการ ----------
function formInstruction({ p, daily: dy, date, today }) {
  const ins = linesOf(dy?.instructions);
  return `${head('instruction', p)}
  ${projectInfo(p, [['เลขที่', ''], ['วันที่', { html: FD(dy?.date || date || today, 'long') }], ['ถึง', p?.contractor ? `ผู้แทนผู้รับจ้าง ${p.contractor}` : '']])}
  <h2>เรื่อง</h2>${LINES(1)}
  <h2>ข้อสั่งการ / ข้อแนะนำ</h2>${LINES(Math.max(8, ins.length), ins)}
  <h2>กำหนดดำเนินการแล้วเสร็จ</h2><p>${FD('', 'long', { ph: '…………………………………………' })}</p>
  ${signs([sign('ผู้ควบคุมงาน (ผู้สั่งการ)', dy?.createdBy || '', dy?.date || date || today), sign('ผู้แทนผู้รับจ้าง (รับทราบ)')])}
  <h2>ผลการดำเนินการของผู้รับจ้าง</h2>${LINES(3)}
  ${foot('instruction')}`;
}

const BUILD = { sub: formSub, material: formMaterial, daily: formDaily, cdaily: formCDaily, weekly: formWeekly, meeting: formMeeting, inspect: formInspect, instruction: formInstruction };
const EXTRA_CSS = { sub: SUB_CSS, cdaily: CDAILY_CSS };

/** คีย์จำร่างที่กรอก: แบบฟอร์ม + โครงการ + เรื่อง/รายงาน/วันที่ */
function draftKey(kind, ctx) {
  const rec = ctx.sub?.id || ctx.daily?.id || ctx.m?.id || ctx.date || ctx.to || 'blank';
  return `${kind}|${ctx.p?.id || '-'}|${rec}`;
}
const HINT = 'คลิกช่องสีฟ้าอ่อนเพื่อพิมพ์ · Enter = ช่องถัดไป · คลิกวันที่เพื่อเลือกจากปฏิทิน · ช่องสี่เหลี่ยมคลิกเพื่อติ๊ก · ที่กรอกจำไว้ในเครื่องนี้';

/** HTML ของแบบฟอร์ม (ใช้ทดสอบและพิมพ์) — editor = URL ของ form-editor.js */
export function formHtml(kind, ctx = {}, { inline = false, editor = '' } = {}) {
  const f = FORMS[kind];
  if (!f) throw new Error(`ไม่รู้จักแบบฟอร์ม ${kind}`);
  ctx = { today: todayTh(), ...ctx };
  const out = BUILD[kind](ctx);
  const pages = (Array.isArray(out) ? out : [{ cls: '', html: out }]);
  const body = pages.map((pg) => pg.html).join('');
  // แบบฟอร์มทางการที่ข้อมูลยาวเกิน 1 หน้า → ให้ขึ้นหน้าใหม่ได้ (ปกติพอดี A4 หน้าเดียวเหมือนต้นฉบับ)
  const long = f.official && (body.match(/<tr/g) || []).length > 60;
  const dateKey = ctx.sub ? isoTh(ctx.sub.submittedAt) : ctx.daily?.date || ctx.date || ctx.to || ctx.today;
  const title = `${f.short || f.code} ${f.title}${ctx.p ? ` ${ctx.p.code || ctx.p.name}` : ''} ${dateKey || ''}`.trim();
  const cls = [f.official ? 'official' : '', long ? 'of-long' : ''].filter(Boolean).join(' ');
  const fallback = inline ? `<script>if(document.body.getAttribute('data-ed')!=='1'){document.querySelector('[data-pt="print"]').onclick=function(){window.print()};document.querySelector('[data-pt="close"]').onclick=function(){window.close()};}</script>` : '';
  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>${e(title)}</title><style>${CSS}${f.official ? OFFICIAL_CSS : ''}${EXTRA_CSS[kind] || ''}</style></head>
  <body${cls ? ` class="${cls}"` : ''}${long ? ' data-long="1"' : ''} data-form="${kind}" data-key="${e(draftKey(kind, ctx))}"><div class="bar" role="toolbar" aria-label="แบบฟอร์ม"><button type="button" data-pt="print">บันทึก PDF / พิมพ์</button><button type="button" class="ghost" data-pt="preview" aria-pressed="false">ดูแบบพิมพ์</button><button type="button" class="ghost" data-pt="reset" hidden>ล้างที่กรอก</button><button type="button" class="ghost" data-pt="close">ปิด</button><span class="bar-msg" data-pt="msg" role="status">${e(f.code)} · ${ctx.p ? 'กรอกข้อมูลจากระบบแล้ว ตรวจทานและแก้ได้ก่อนพิมพ์' : 'แบบเปล่า'} — ${HINT}${f.official ? ' · ตอนพิมพ์ตั้งระยะขอบกระดาษเป็น "ไม่มี"' : ''}</span></div>
  <div class="sheets">${pages.map((pg) => `<div class="sheet${pg.cls ? ` ${pg.cls}` : ''}">${pg.html}</div>`).join('')}</div>
  ${editor ? `<script src="${e(editor)}"></script>` : ''}${fallback}<link rel="stylesheet" href="${FONTS_URL}"></body></html>`;
}

/** ไฟล์รูปภาพในรายงานประจำวัน (ใส่ในหน้า "ภาพประกอบการทำงาน" ของ PT-F07) */
function dailyPhotos(dy) {
  return (dy?.files || []).map((id) => store.data.files.find((f) => f.id === id)).filter((f) => f && (/^image\//.test(f.mime || '') || /\.(jpe?g|png|gif|webp|heic)$/i.test(f.name || ''))).slice(0, 6);
}

/** เปิดแบบฟอร์มในแท็บใหม่ (ถ้าเบราว์เซอร์กันหน้าต่างใหม่ จะดาวน์โหลดเป็นไฟล์ .html แทน) */
export function openForm(kind, ctx = {}) {
  ctx = { today: todayTh(), ...ctx };
  const editor = new URL(`assets/js/form-editor.js?v=${APP_VERSION}`, location.href).href;
  const w = window.open('', '_blank');
  if (!w) {
    download(`${(FORMS[kind].short || FORMS[kind].code).replace(/[^A-Za-z0-9-]/g, '-')}${ctx.p ? `-${ctx.p.code || 'project'}` : ''}.html`, formHtml(kind, ctx, { inline: true, editor }), 'text/html;charset=utf-8');
    return null;
  }
  w.document.open();
  w.document.write(formHtml(kind, ctx, { editor }));
  w.document.close();
  // ปุ่มพิมพ์/ปิดสำรอง — ใช้เมื่อสคริปต์กรอกแบบฟอร์มยังโหลดไม่เสร็จหรือโหลดไม่ได้ (ถ้าโหลดแล้ว สคริปต์นั้นจัดการเอง)
  const doc0 = w.document;
  const fb = (act) => () => { if (doc0.body?.getAttribute('data-ed') !== '1') act(); };
  doc0.querySelector('[data-pt="print"]')?.addEventListener('click', fb(() => w.print()));
  doc0.querySelector('[data-pt="close"]')?.addEventListener('click', fb(() => w.close()));
  const photos = kind === 'cdaily' ? dailyPhotos(ctx.daily) : [];
  const fillPhotos = () => photos.forEach(async (f, i) => {
    try { const u = await store.thumbUrl(f); if (u && w.ptForm) w.ptForm.setPhoto(i, u); } catch { /* ไม่มีรูปก็กรอกเองได้ */ }
  });
  let done = false;
  const ready = () => {
    if (done || w.closed) return;
    done = true;
    if (w.document.body?.getAttribute('data-ed') !== '1') return;
    fillPhotos();
    w.addEventListener('pt-form-reset', fillPhotos);
  };
  w.addEventListener('load', ready);
  // บางเบราว์เซอร์ไม่ส่ง load ให้หน้าที่เขียนด้วย document.write — ตรวจซ้ำเมื่อสคริปต์พร้อมแล้ว
  setTimeout(() => { if (!w.closed && w.document.body?.getAttribute('data-ed') === '1') ready(); }, 6000);
  return w;
}
