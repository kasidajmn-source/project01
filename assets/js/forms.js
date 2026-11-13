// แบบฟอร์มมาตรฐานในระบบ (1.0.5) — ทุกโครงการใช้แบบเดียวกัน พิมพ์ได้ทันที และกรอกข้อมูลโครงการให้อัตโนมัติ
// เปิดเป็นหน้าพิมพ์ขนาด A4 ในแท็บใหม่ (บันทึกเป็น PDF ได้จากหน้าต่างพิมพ์ของเบราว์เซอร์)
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
  daily: { code: 'PT-F02', title: 'รายงานประจำวันของผู้ควบคุมงาน', use: 'บันทึกสภาพการปฏิบัติงานของผู้รับจ้างและเหตุการณ์แวดล้อมรายวัน (ระเบียบกระทรวงการคลังฯ พ.ศ. 2560 ข้อ 178)', where: 'รายงานประจำวัน' },
  weekly: { code: 'PT-F03', title: 'รายงานผลการปฏิบัติงานประจำสัปดาห์', use: 'ผู้ควบคุมงานรายงานคณะกรรมการตรวจรับพัสดุทุกสัปดาห์ สรุปจากรายงานประจำวัน', where: 'รายงานประจำวัน' },
  meeting: { code: 'PT-F04', title: 'บันทึกการประชุม', use: 'บันทึกการประชุมโครงการ พร้อมรายชื่อผู้เข้าร่วมและงานที่มอบหมาย', where: 'การประชุม' },
  inspect: { code: 'PT-F05', title: 'บันทึกการตรวจรับงานจ้าง (งวดงาน)', use: 'คณะกรรมการตรวจรับพัสดุตรวจรับงานงวด — มีช่องลงนามตามลำดับกรรมการของโครงการ', where: 'ส่งมอบ/ตรวจรับงาน' },
  instruction: { code: 'PT-F06', title: 'ใบสั่งการ / ข้อแนะนำของผู้ควบคุมงาน', use: 'แจ้งข้อสั่งการหรือข้อแนะนำเป็นลายลักษณ์อักษรต่อผู้รับจ้าง พร้อมช่องรับทราบ', where: 'รายงานประจำวัน' },
};

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

// ---------- F02 รายงานประจำวัน ----------
function formDaily({ p, daily: dy, date }) {
  const W = R.WEATHER;
  const ck = (on) => `<span class="ck">${on ? '✓' : ''}</span>`;
  const weather = (slot) => Object.entries(W).map(([k, l]) => `${ck(dy?.weather?.[slot] === k)}${e(l)}`).join('&nbsp;&nbsp;');
  const men = dy?.manpower || [];
  const eq = dy?.equipment || [];
  const rows = (list, n, a, b) => {
    const out = list.map((r) => `<tr><td>${e(r[a])}</td><td class="r">${e(r[b])}</td></tr>`);
    while (out.length < n) out.push('<tr><td>&nbsp;</td><td></td></tr>');
    return out.join('');
  };
  const a = p ? store.analysis(p.id) : null;
  const sup = dy ? dy.createdBy : (supervisors(p)[0] ? nameOf(p, supervisors(p)[0].email) : '');
  return `${head('daily', p)}
  ${projectInfo(p, [['ประจำวันที่', d(dy?.date || date) || ''], ['เวลาทำงาน', dy?.workHours || ''], ['ผลงานสะสม (ล่าสุด)', a ? `${pct(a.actual)} (แผน ${pct(a.plan)})` : '']])}
  <h2>สภาพอากาศ</h2>
  <table class="info"><tr><td class="k">ช่วงเช้า</td><td>${weather('am')}</td></tr><tr><td class="k">ช่วงบ่าย</td><td>${weather('pm')}</td></tr></table>
  <div class="nb" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div><h2>คนงาน${men.length ? ` (รวม ${R.manpowerTotal(dy)} คน)` : ''}</h2><table class="grid small"><tr><th>ประเภทช่าง/แรงงาน</th><th class="r" style="width:22%">จำนวน (คน)</th></tr>${rows(men, 6, 'trade', 'count')}</table></div>
    <div><h2>เครื่องจักร/เครื่องมือ</h2><table class="grid small"><tr><th>รายการ</th><th class="r" style="width:22%">จำนวน</th></tr>${rows(eq, 6, 'name', 'count')}</table></div>
  </div>
  <h2>งานที่ดำเนินการ</h2>${dy?.work ? `<div class="box tall">${e(dy.work)}</div>` : blankLines(6)}
  <h2>วัสดุที่นำเข้าหน่วยงาน</h2>${dy?.materials ? `<div class="box">${e(dy.materials)}</div>` : blankLines(2)}
  <h2>การหยุดงาน / อุปสรรค</h2>
  <div>${ck(dy && !dy.stoppage?.stopped)}ทำงานปกติ &nbsp; ${ck(dy?.stoppage?.stopped)}หยุดงาน ${val(dy?.stoppage?.stopped ? dy.stoppage.hours || '' : '', '40px')} ชั่วโมง สาเหตุ ${val(dy?.stoppage?.reason || '', '50%')}</div>
  <h2>ความปลอดภัย / อุบัติเหตุ</h2>${dy?.safety ? `<div class="box">${e(dy.safety)}</div>` : blankLines(2)}
  <h2>ข้อสั่งการ / ข้อแนะนำต่อผู้รับจ้าง</h2>${dy?.instructions ? `<div class="box">${e(dy.instructions)}</div>` : blankLines(3)}
  ${dy?.files?.length ? `<p class="small muted">รูปถ่ายประกอบ ${dy.files.length} รูป (เก็บในระบบ หมวดรูปถ่ายความคืบหน้า)</p>` : ''}
  ${signs([sign('ผู้ควบคุมงาน', sup, dy?.date || date), sign('ผู้แทนผู้รับจ้าง (รับทราบ)')])}${foot('daily')}`;
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

const BUILD = { sub: formSub, daily: formDaily, weekly: formWeekly, meeting: formMeeting, inspect: formInspect, instruction: formInstruction };

/** HTML ของแบบฟอร์ม (ใช้ทดสอบและพิมพ์) */
export function formHtml(kind, ctx = {}, { inline = false } = {}) {
  const f = FORMS[kind];
  if (!f) throw new Error(`ไม่รู้จักแบบฟอร์ม ${kind}`);
  const body = BUILD[kind](ctx);
  const title = `${f.code} ${f.title}${ctx.p ? ` — ${ctx.p.code || ctx.p.name}` : ''}`;
  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>${e(title)}</title><style>${CSS}</style></head>
  <body><div class="bar"><button data-pt="print"${inline ? ' onclick="window.print()"' : ''}>พิมพ์ / บันทึกเป็น PDF</button><button class="ghost" data-pt="close"${inline ? ' onclick="window.close()"' : ''}>ปิด</button><span>${e(f.code)} · ${ctx.p ? 'กรอกข้อมูลจากระบบแล้ว ตรวจทานก่อนพิมพ์' : 'แบบเปล่าสำหรับกรอกด้วยมือ'}</span></div>
  <div class="sheet">${body}</div></body></html>`;
}

/** เปิดแบบฟอร์มในแท็บใหม่ (ถ้าเบราว์เซอร์กันหน้าต่างใหม่ จะดาวน์โหลดเป็นไฟล์ .html แทน) */
export function openForm(kind, ctx = {}) {
  const w = window.open('', '_blank');
  if (!w) {
    // ไฟล์ที่ดาวน์โหลดเปิดแยกจากเว็บ จึงใช้ปุ่มแบบ inline ได้
    download(`${FORMS[kind].code}${ctx.p ? `-${ctx.p.code || 'project'}` : ''}.html`, formHtml(kind, ctx, { inline: true }), 'text/html;charset=utf-8');
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
