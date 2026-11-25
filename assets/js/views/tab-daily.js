// แท็บรายงานประจำวัน (1.0.5): ผู้ควบคุมงานบันทึกสภาพการปฏิบัติงานรายวัน (ระเบียบกระทรวงการคลังฯ ข้อ 178)
// และส่งรายงานประจำวัน/ประจำสัปดาห์ทางอีเมล พิมพ์แบบฟอร์ม กฟผ. FM-002 (บันทึกการควบคุมงานประจำวัน) FM-001 (ผลการตรวจวัสดุ) และ PT-F03/F05/F06
// 1.0.15: ผู้รับจ้างบันทึก Daily Report & Request (PT-F07) เอง · งานที่ทำกรอกตามหมวด/รายการ BOQ · บันทึกแล้วได้ไฟล์ PDF ในแท็บเอกสาร
import { store } from '../store.js';
import { esc, fmt, icon, emptyState, toast, confirmBox, setBusy, guard, menu } from '../ui.js';
import { mailNote, personName } from './common.js';
import { openForm } from '../forms.js';
import { libraryBox, bindLibraryBox } from './library.js';
import { openReportDialog } from './reports.js';
import { preview } from './tab-docs.js';
import { suggestions, learned, splitLine, joinLine, tradeLabel } from '../vocab.js';
import { saveDailyPdf, savedSignature, rememberSignature, openDailyForm, dailyFormCtx, mountFormPreview, dailyDocStale } from '../daily-pdf.js';
import '../annotate.js';

/** ชื่อผู้บันทึกโดยตัดวงเล็บท้ายชื่อ เช่น "นายช่างวิไล (ผู้ควบคุมงาน)" → "นายช่างวิไล" (ไม่ใช้ regex เพื่อไม่ให้ช้ากับข้อความยาวผิดปกติ) */
function shortName(n) {
  const s = String(n || '').slice(0, 300);
  const i = s.lastIndexOf('(');
  return i > 0 && s.endsWith(')') ? s.slice(0, i).trimEnd() : s;
}

const R = globalThis.PTRules;
// รูปของฟอร์มที่กำลังกรอก (คงไว้เมื่อวาดฟอร์มใหม่ เช่น ดึงข้อมูลจากรายงานผู้รับจ้าง)
const ed = { key: '', items: null };
window.addEventListener('pt:discard', () => { ed.key = ''; });
const PDF_PREF = 'pt.dy.pdf';
const pdfPref = () => { try { return localStorage.getItem(PDF_PREF) !== '0'; } catch { return true; } };
const setPdfPref = (on) => { try { localStorage.setItem(PDF_PREF, on ? '1' : '0'); } catch { /* ignore */ } };

/** ชนิดรายงาน: '' = ผู้ควบคุมงาน (FM-002) · contractor = ผู้รับจ้าง (PT-F07) */
const KIND = {
  '': { title: 'รายงานผู้ควบคุมงาน', short: 'รายงานประจำวัน', form: 'daily', code: 'FM-002', path: '', ic: 'clipboard' },
  contractor: { title: 'Daily Report & Request ผู้รับจ้าง', short: 'Daily Report & Request', form: 'cdaily', code: 'PT-F07', path: '/c', ic: 'users' },
};
const baseOf = (p, kind) => `#/p/${encodeURIComponent(p.id)}/daily${KIND[kind].path}`;

const today = () => store.thaiNow().date;
const weatherText = (d) => [R.WEATHER[d.weather?.am] && `เช้า${R.WEATHER[d.weather.am]}`, R.WEATHER[d.weather?.pm] && `บ่าย${R.WEATHER[d.weather.pm]}`, R.WEATHER[d.weather?.night] && `กลางคืน${R.WEATHER[d.weather.night]}`, d.weather?.pm25 !== '' && d.weather?.pm25 != null && `PM2.5 ${d.weather.pm25}`].filter(Boolean).join(' · ') || '–';
const linesOf = (t) => String(t || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const qtyText = (q, u) => (q ? `${q}${u ? ` ${u}` : ''}` : '');
const boqLabel = (it) => (it ? `${it.no ? `${it.no} ` : ''}${it.desc}` : '');

export function renderDaily(el, ctx, sub = '') {
  const { p } = ctx;
  if (!store.canSeeDaily(p)) {
    el.innerHTML = `<section class="panel">${emptyState({ ic: 'lock', title: 'ไม่มีสิทธิ์ดูรายงานประจำวันของโครงการนี้', text: 'ให้เจ้าของโครงการเพิ่มคุณเป็นสมาชิกก่อน' })}</section>`;
    return;
  }
  if (store.serverOutdated('1.0.5')) {
    el.innerHTML = `<section class="panel">${emptyState({ ic: 'alert', title: 'ต้องอัปเดตระบบหลังบ้านก่อน', text: `รายงานประจำวันต้องใช้ Code.gs เวอร์ชัน 1.0.5 ขึ้นไป (ตอนนี้ ${esc(store.meta.version || 'เวอร์ชันเก่า')}) — ให้ผู้ดูแลวางโค้ดใหม่ รัน setup แล้ว Deploy เวอร์ชันใหม่` })}</section>`;
    return;
  }
  let parts = String(sub || '').split('?')[0].split('/').filter(Boolean);
  let kind = '';
  if (parts[0] === 'c') { kind = 'contractor'; parts = parts.slice(1); }
  // ผู้รับจ้างเห็นเฉพาะรายงานของผู้รับจ้าง
  if (kind === '' && store.isContractorOf(p)) {
    location.replace(`${baseOf(p, 'contractor')}${parts.length ? `/${parts.join('/')}` : ''}`);
    return;
  }
  const [a, b] = parts;
  const canW = store.canWriteDaily(p, kind);
  if (a === 'new') { location.replace(`${baseOf(p, kind)}/${today()}/edit`); return; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(a || '')) {
    const d = store.dailyAt(p.id, a, kind);
    if (b === 'edit' || !d) {
      if (!canW) {
        if (!d) { el.innerHTML = `${kindTabs(p, kind)}<section class="panel">${emptyState({ ic: 'calendar', title: `ไม่มี${KIND[kind].short}ของวันที่ ${fmt.dateLong(a)}`, actions: `<a class="btn" href="${baseOf(p, kind)}">กลับ</a>` })}</section>`; return; }
      } else { renderEditor(el, ctx, a, d, kind); return; }
    }
    renderView(el, ctx, d, kind);
    return;
  }
  renderList(el, ctx, kind);
}

/** แท็บย่อย: รายงานผู้ควบคุมงาน | Daily Report & Request ผู้รับจ้าง (ผู้รับจ้างไม่เห็นแท็บย่อย) */
function kindTabs(p, kind) {
  if (store.isContractorOf(p)) return '';
  const t = today();
  const n = store.dailyOf(p.id, 'contractor').filter((d) => d.date >= R.addDaysIso(t, -6)).length;
  return `<nav class="subtabs dy-kinds" aria-label="ชนิดรายงานประจำวัน">
    <a href="${baseOf(p, '')}" class="${kind === '' ? 'is-on' : ''}"${kind === '' ? ' aria-current="page"' : ''}>${icon(KIND[''].ic)}${KIND[''].title}</a>
    <a href="${baseOf(p, 'contractor')}" class="${kind ? 'is-on' : ''}"${kind ? ' aria-current="page"' : ''}>${icon(KIND.contractor.ic)}${KIND.contractor.title}${n ? `<em title="7 วันล่าสุด">${n}</em>` : ''}</a>
  </nav>`;
}

// ---------- รายการ ----------
function renderList(el, ctx, kind) {
  const { p } = ctx;
  const K = KIND[kind];
  const base = baseOf(p, kind);
  const list = store.dailyOf(p.id, kind);
  const canW = store.canWriteDaily(p, kind);
  const t = today();
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(R.addDaysIso(t, -i));
  const inRange = (iso) => (!p.startDate || iso >= p.startDate) && (!p.endDate || iso <= R.addDaysIso(p.endDate, 60));
  const last30 = list.filter((d) => d.date > R.addDaysIso(t, -30)).length;
  const canSend = kind === '' && store.canSendReport('daily', p.id);
  const seeC = kind === '' && !store.isContractorOf(p);
  const outdated = kind === 'contractor' && store.mode === 'gas' && store.serverOutdated('1.0.15');
  const forms = kind === '' ? [
    ['daily', 'บันทึกการควบคุมงานประจำวัน (เปล่า)', dailyFormCtx(p, 'daily', { day: t, mode: 'header' })],
    ['cdaily', 'Daily Report & Request ของผู้รับจ้าง', () => dailyFormCtx(p, 'cdaily', { day: t, rec: store.dailyAt(p.id, t, 'contractor') || store.dailyAt(p.id, t) })],
    ['material', 'ผลการตรวจวัสดุก่อสร้าง (เปล่า)', { p, date: t }],
    ['weekly', 'รายงานประจำสัปดาห์', () => ({ p, to: t })],
    ['instruction', 'ใบสั่งการ', { p }],
    ['pay', 'ใบส่งงวดงาน (F-04-03-09)', { p }],
  ] : [];
  const todayRec = store.dailyAt(p.id, t, kind);
  const reqText = (d) => (d.request || []).map((r) => r.work).filter(Boolean).join(' · ');
  el.innerHTML = `${kindTabs(p, kind)}
  <div class="toolbar">
    <div class="tb-info"><b>${list.length}</b> วัน <span class="sep"></span> 30 วันล่าสุดบันทึก ${last30} วัน</div>
    <div class="tb-actions">
      ${canSend ? menu({ label: 'ส่งอีเมล', icon: 'mail', items: [
        { icon: 'calendar', label: 'รายงานประจำวัน (วันนี้)', attrs: 'data-mail="daily"' },
        { icon: 'list', label: 'รายงานประจำสัปดาห์', sub: 'ถึงคณะกรรมการตรวจรับ เจ้าของ และผู้ควบคุมงาน', attrs: 'data-mail="weekly"' },
      ] }) : ''}
      ${kind === 'contractor' ? `<button class="btn" data-blank>${icon('print')}แบบฟอร์มเปล่า PT-F07</button>` : ''}
      ${canW && !outdated ? `<a class="btn btn-primary" id="dy-today" href="${base}/${t}${todayRec ? '' : '/edit'}">${icon(todayRec ? 'eye' : 'plus')}${todayRec ? `${K.short}วันนี้` : `บันทึก${K.short}วันนี้`}</a>` : ''}
    </div>
  </div>
  ${outdated ? `<p class="notice notice-warn">${icon('alert')}<span>Daily Report ของผู้รับจ้างต้องใช้ Code.gs 1.0.15 ขึ้นไป (ตอนนี้ ${esc(store.meta.version || 'เวอร์ชันเก่า')}) — ให้ผู้ดูแลวางโค้ดใหม่ รัน setup แล้ว Deploy เวอร์ชันใหม่</span></p>` : ''}
  <div class="dy-strip" role="list" aria-label="14 วันล่าสุด">${days.map((iso) => {
    const d = store.dailyAt(p.id, iso, kind);
    const c = seeC ? store.dailyAt(p.id, iso, 'contractor') : null;
    const tone = d ? (d.stoppage?.stopped ? 'warn' : 'ok') : (inRange(iso) ? 'miss' : 'none');
    const dow = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][new Date(`${iso}T00:00:00Z`).getUTCDay()];
    const href = d || canW ? `${base}/${iso}${d ? '' : '/edit'}` : '';
    return `<${href ? `a href="${href}"` : 'span'} role="listitem" class="dy-day dy-${tone} ${iso === t ? 'is-today' : ''}${c ? ' has-c' : ''}" title="${esc(fmt.dateLong(iso))}${d ? ` — ${esc(weatherText(d))}, คนงาน ${R.manpowerTotal(d)} คน${d.stoppage?.stopped ? ', หยุดงาน' : ''}` : ' — ยังไม่ได้บันทึก'}${c ? ' · ผู้รับจ้างส่ง Daily Report แล้ว' : ''}">
      <small>${dow}</small><b>${+iso.slice(8)}</b>${icon(d ? (d.stoppage?.stopped ? 'alert' : 'check') : 'x')}</${href ? 'a' : 'span'}>`;
  }).join('')}</div>
  <div class="dy-layout">
    <section class="panel panel-flush">
      ${list.length ? `<div class="table-wrap"><table class="hist dy-table">
        <thead><tr><th>วันที่</th><th>สภาพอากาศ</th><th class="r">คนงาน</th><th>งานที่ดำเนินการ</th>${kind === 'contractor' ? '<th>ขอทำวันถัดไป</th>' : '<th>หยุดงาน</th>'}${seeC ? '<th>ผู้รับจ้าง</th>' : ''}<th></th></tr></thead>
        <tbody>${list.slice(0, 120).map((d) => {
          const c = seeC ? store.dailyAt(p.id, d.date, 'contractor') : null;
          return `<tr>
          <td class="nowrap"><a class="link" href="${base}/${d.date}"><b>${fmt.date(d.date)}</b></a><small class="dy-by" title="${esc(d.createdBy || '')}">${esc(shortName(d.createdBy))}</small></td>
          <td class="nowrap" data-l="อากาศ">${esc(weatherText(d))}</td>
          <td class="r num" data-l="คนงาน">${R.manpowerTotal(d)}</td>
          <td class="c-note">${esc(String(d.work || '').replace(/\t/g, ' ').slice(0, 140))}${(d.files || []).length ? ` <span class="muted small">${icon('image')}${d.files.length}</span>` : ''}${store.dailyDocs(d).length ? ` <span class="muted small" title="มีไฟล์ PDF ในแท็บเอกสาร">${icon('file')}PDF</span>` : ''}</td>
          ${kind === 'contractor'
            ? `<td class="c-note" data-l="ขอทำ">${esc(reqText(d).slice(0, 120)) || '<span class="muted">–</span>'}</td>`
            : `<td class="dy-stopc" data-l="หยุดงาน">${d.stoppage?.stopped ? `<span class="t-issue">${icon('alert')}${esc(`${d.stoppage.hours ? `${d.stoppage.hours} ชม. ` : ''}${d.stoppage.reason || ''}`)}</span>` : '<span class="muted">–</span>'}</td>`}
          ${seeC ? `<td data-l="ผู้รับจ้าง">${c ? `<a class="link small" href="${baseOf(p, 'contractor')}/${d.date}">${icon('check')}ส่งแล้ว</a>` : '<span class="muted">–</span>'}</td>` : ''}
          <td class="row-tools"><button class="icon-btn" data-print="${esc(d.id)}" title="พิมพ์ ${esc(K.code)}" aria-label="พิมพ์">${icon('print')}</button>
            ${canW ? `<a class="icon-btn" href="${base}/${d.date}/edit" title="แก้ไข" aria-label="แก้ไข">${icon('edit')}</a>` : ''}</td>
        </tr>`;
        }).join('')}</tbody></table></div>`
    : emptyState({ ic: 'calendar', title: `ยังไม่มี${K.short}`,
      text: kind === 'contractor'
        ? (canW ? 'บันทึกงานที่ทำได้วันนี้ (ตามรายการ BOQ) ผู้ปฏิบัติงาน เครื่องจักร และงานที่ขอทำวันถัดไป ผู้ควบคุมงานเห็นทันทีและพิมพ์เป็นแบบ PT-F07 ได้' : 'ผู้รับจ้างจะบันทึก Daily Report & Request ที่นี่')
        : (canW ? 'บันทึกสภาพอากาศ คนงาน เครื่องจักร งานที่ทำ และการหยุดงานทุกวัน ระบบจะสรุปเป็นรายงานประจำสัปดาห์ให้คณะกรรมการตรวจรับพัสดุ และส่งทางอีเมลได้' : 'ผู้ควบคุมงานจะบันทึกรายงานประจำวันที่นี่'),
      actions: canW && !outdated ? `<a class="btn btn-primary" href="${base}/${t}/edit">${icon('plus')}บันทึก${K.short}วันนี้</a>` : '' })}
    </section>
    <aside class="dy-side">${kind === '' ? libraryBox({ use: 'daily', workType: p.type, forms, title: 'แบบฟอร์มสำหรับงานควบคุม' }) : ''}
      <p class="hint">${kind === 'contractor'
        ? 'Daily Report & Request (PT-F07) ผู้รับจ้างเป็นผู้บันทึก — งานที่ทำได้ ปริมาณตามรายการ BOQ ผู้ปฏิบัติงาน เครื่องจักร และงานที่ขอทำวันถัดไป ผู้ควบคุมงานเห็นรายงานนี้และดึงข้อมูลไปใช้ในรายงานประจำวันของตนได้ (ผู้รับจ้างไม่เห็นรายงานของผู้ควบคุมงาน)'
        : `${store.serverRules ? 'ระบบส่งรายงานประจำวันทางอีเมลอัตโนมัติตามเวลาที่ผู้ดูแลตั้ง (ค่าเริ่มต้น 17:00 น.) และส่งรายงานประจำสัปดาห์ทุกวันศุกร์' : 'กด "ส่งรายงาน" เพื่อส่งอีเมลจากบัญชีของคุณ'} — ผู้รับ: ผู้ที่รับอีเมลระดับ "ทุกเรื่อง" (รายวัน) และคณะกรรมการ/หัวหน้า (รายสัปดาห์) ไม่รวมผู้รับจ้าง`}</p>
    </aside>
  </div>`;
  if (kind === '') bindLibraryBox(el, forms);
  el.querySelector('[data-blank]')?.addEventListener('click', () => openDailyForm(p, 'cdaily', { day: t, mode: 'header' }));
  el.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => {
    const d = list.find((x) => x.id === b.dataset.print);
    openDailyForm(p, K.form, { rec: d });
  }));
  el.querySelectorAll('[data-mail]').forEach((b) => b.addEventListener('click', () => openReportDialog(b.dataset.mail, { projectId: p.id, date: t })));
}

/** 1.0.16 มุมมองรายงาน: แบบฟอร์ม (เหมือนหน้าต่างแบบฟอร์มและไฟล์ PDF) หรือข้อมูลรายงาน — จำในเครื่อง */
const VMODE_KEY = 'pt.dy.view';
function viewMode() {
  try { const v = localStorage.getItem(VMODE_KEY); if (v === 'form' || v === 'data') return v; } catch { /* ใช้ค่าเริ่มต้น */ }
  return window.matchMedia?.('(min-width: 900px)').matches ? 'form' : 'data';
}
let stopPreview = null;

// ---------- ดูรายงาน ----------
function renderView(el, ctx, d, kind) {
  const { p } = ctx;
  const K = KIND[kind];
  const base = baseOf(p, kind);
  const canW = store.canWriteDaily(p, kind);
  const files = (d.files || []).map((id) => store.data.files.find((f) => f.id === id)).filter(Boolean);
  const docs = store.dailyDocs(d);
  const stale = dailyDocStale(d, docs);
  const vm = viewMode();
  const row = (k, v) => (v ? `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>` : '');
  const same = store.dailyOf(p.id, kind);
  const prevD = same.find((x) => x.date < d.date);
  const nextD = [...same].reverse().find((x) => x.date > d.date);
  const boq = store.boqOf(p.id);
  const byId = (id) => boq.find((b) => b.id === id);
  const rows = Array.isArray(d.rows) && d.rows.length ? d.rows : null;
  const work = rows ? [] : linesOf(d.work).map(splitLine);
  const mats = linesOf(d.materials).map(splitLine);
  const linked = kind === '' ? store.dailyUpdate(d) : null;
  const boqRows = !rows && linked ? Object.entries(linked.entries || {}).map(([id, q]) => [byId(id), q]).filter(([it]) => it) : [];
  const other = kind === '' ? (store.isContractorOf(p) ? null : store.dailyAt(p.id, d.date, 'contractor')) : (store.isContractorOf(p) ? null : store.dailyAt(p.id, d.date, ''));
  const table = (head, trs) => `<div class="table-wrap"><table class="hist dy-tbl"><thead><tr>${head.map((h, i) => `<th${i && i === head.length - 1 ? ' class="r"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${trs.join('')}</tbody></table></div>`;
  const items = [
    { act: 'print', icon: 'print', label: kind === '' ? 'บันทึกการควบคุมงานประจำวัน FM-002' : 'Daily Report and Daily Request PT-F07' },
    kind === '' && { act: 'cdaily', icon: 'print', label: 'Daily Report and Daily Request PT-F07' },
    kind === '' && d.materials && { act: 'mat', icon: 'print', label: 'ผลการตรวจวัสดุ FM-001' },
    kind === '' && d.instructions && { act: 'instr', icon: 'print', label: 'ใบสั่งการ PT-F06' },
    kind === '' && store.canSendReport('daily', p.id) && { act: 'mail', icon: 'mail', label: 'ส่งรายงานนี้ทางอีเมล' },
    canW && { sep: true },
    canW && { act: 'pdf', icon: 'file', label: 'สร้างไฟล์ PDF เก็บในแท็บเอกสาร' },
    canW && { act: 'sign', icon: 'edit', label: 'เปิดแบบฟอร์มเพื่อลงชื่อ แล้วบันทึกเข้าเอกสาร' },
    canW && { sep: true },
    canW && { act: 'del', icon: 'trash', label: 'ลบรายงานนี้', danger: true },
  ];
  el.innerHTML = `${kindTabs(p, kind)}
  <div class="toolbar">
    <div class="tb-info"><a class="link" href="${base}">${icon('chevL')}${esc(K.title)}</a></div>
    <div class="tb-actions">
      ${prevD ? `<a class="btn btn-sm" href="${base}/${prevD.date}" title="วันก่อนหน้า">${icon('chevL')}${fmt.date(prevD.date)}</a>` : ''}
      ${nextD ? `<a class="btn btn-sm" href="${base}/${nextD.date}" title="วันถัดไป">${fmt.date(nextD.date)}${icon('chevR')}</a>` : ''}
      ${menu({ items })}
      ${canW ? `<a class="btn btn-primary" href="${base}/${d.date}/edit">${icon('edit')}แก้ไข</a>` : ''}
    </div>
  </div>
  <section class="panel dy-view">
    <header class="dy-vh"><h2>${esc(kind === 'contractor' ? 'Daily Report & Request' : 'รายงานประจำวัน')}ที่ ${esc(fmt.dateLong(d.date))}</h2>
      <span class="muted small">บันทึกโดย ${esc(d.createdBy || d.createdByEmail)} · ${esc(fmt.dateTime(d.updatedAt || d.createdAt))}</span></header>
    ${other ? `<p class="notice dy-other">${icon(KIND[R.dailyKind(other)].ic)}<span>${kind === '' ? 'ผู้รับจ้างส่ง Daily Report & Request ของวันนี้แล้ว' : 'มีรายงานของผู้ควบคุมงานวันนี้แล้ว'} — <a class="link" href="${baseOf(p, R.dailyKind(other))}/${other.date}">เปิดดู</a></span></p>`
      : (kind === 'contractor' && store.canWriteDaily(p, '') && !store.isContractorOf(p) ? `<p class="notice dy-other">${icon('clipboard')}<span>ยังไม่มีรายงานของผู้ควบคุมงานวันนี้ — <a class="link" href="${baseOf(p, '')}/${d.date}/edit?from=c">บันทึกโดยดึงข้อมูลจากรายงานนี้</a></span></p>` : '')}
    <div class="seg seg-sm dy-vmode" role="group" aria-label="มุมมองรายงาน">
      <button type="button" data-vmode="form" aria-pressed="${vm === 'form'}">${icon('file')}แบบฟอร์ม ${esc(K.code)}</button>
      <button type="button" data-vmode="data" aria-pressed="${vm === 'data'}">${icon('list')}ข้อมูลรายงาน</button>
    </div>
    <div class="dy-pv" id="dy-pv"${vm === 'form' ? '' : ' hidden'}><button type="button" class="btn btn-sm dy-pv-open" data-act="pv-open">${icon('edit')}เปิดแบบฟอร์มเต็มหน้า</button></div>
    <div class="dy-data" id="dy-data"${vm === 'data' ? '' : ' hidden'}>
    <dl class="facts dy-facts">
      ${row('สภาพอากาศ', esc(weatherText(d)))}
      ${row('เวลาทำงาน', esc(d.workHours))}
      ${row('ผู้ปฏิบัติงาน', `<b>${R.manpowerTotal(d)} คน</b>${d.manpower.length ? ` <small class="muted">(${esc(d.manpower.map((r) => `${tradeLabel(r.trade)} ${r.count}`).join(', '))})</small>` : ''}`)}
      ${row('เครื่องจักร', esc(d.equipment.map((r) => `${r.name} ${r.count}`).join(', ')))}
      ${linked && linked.manualPct !== '' && linked.manualPct != null ? row('ความคืบหน้ารวม', `<b>${fmt.num(+linked.manualPct)}%</b> <small class="muted">บันทึกพร้อมรายงานนี้</small>`) : ''}
      ${d.stoppage?.stopped ? row('หยุดงาน', `<b class="is-bad">${esc(`${d.stoppage.hours ? `${d.stoppage.hours} ชั่วโมง ` : ''}${d.stoppage.reason || ''}`)}</b>`) : ''}
    </dl>
    ${rows ? `<h3 class="dy-h">งานที่ดำเนินการ${kind === '' && linked ? ' <small class="muted">ปริมาณตามรายการ BOQ บันทึกเป็นความคืบหน้าของวันนี้แล้ว</small>' : ''}</h3>${table(['รายการ BOQ', 'รายละเอียดของงาน', 'ปริมาณ'], rows.map((r) => {
      const it = r.boq ? byId(r.boq) : null;
      return `<tr><td>${it ? `<small class="muted">${esc(it.group || '')}</small><br>${esc(boqLabel(it))}` : '<span class="muted">–</span>'}</td><td>${esc(r.w || (it ? it.desc : ''))}</td><td class="r num">${esc(qtyText(r.q, r.u || it?.unit || ''))}</td></tr>`;
    }))}` : ''}
    ${work.length ? `<h3 class="dy-h">งานที่ดำเนินการ</h3>${table(['รายละเอียดของงาน', 'ปริมาณงาน'], work.map(([w, q, u]) => `<tr><td>${esc(w)}</td><td class="r num">${esc(qtyText(q, u))}</td></tr>`))}` : ''}
    ${boqRows.length ? `<h3 class="dy-h">ปริมาณงานตาม BOQ <small class="muted">บันทึกเป็นความคืบหน้าของวันนี้แล้ว</small></h3>${table(['รายการ BOQ', 'ปริมาณ'], boqRows.map(([it, q]) => `<tr><td>${esc(boqLabel(it))}</td><td class="r num">${esc(`${(+q).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${it.unit || ''}`)}</td></tr>`))}` : ''}
    ${(d.request || []).length ? `<h3 class="dy-h">งานที่ขอทำวันถัดไป (Daily Request)</h3>${table(['รายละเอียดของงาน', 'ปริมาณ', 'ช่าง/คนงาน'], d.request.map((r) => `<tr><td>${esc(r.work)}</td><td class="r num">${esc(qtyText(r.qty, r.unit))}</td><td class="r num">${esc(r.men ?? '')}</td></tr>`))}` : ''}
    ${mats.length ? `<h3 class="dy-h">วัสดุเข้าหน่วยงาน</h3>${table(['ชนิด', 'ปริมาณ'], mats.map(([w, q, u]) => `<tr><td>${esc(w)}</td><td class="r num">${esc(qtyText(q, u))}</td></tr>`))}` : ''}
    ${[['ความปลอดภัย/อุบัติเหตุ', d.safety], ['ข้อสั่งการ/ข้อแนะนำต่อผู้รับจ้าง', d.instructions]]
    .filter(([, v]) => v).map(([k, v]) => `<h3 class="dy-h">${esc(k)}</h3><div class="dy-text">${esc(v)}</div>`).join('')}
    ${files.length ? `<h3 class="dy-h">ภาพประกอบ (${files.length})</h3><div class="dy-figs">${files.map((f, i) => `<figure><button class="fthumb" data-f="${esc(f.id)}" title="${esc(f.name)}"><img alt="" data-thumb="${esc(f.id)}"></button><figcaption><b>รูปที่ ${i + 1}</b> ${esc(d.captions?.[f.id] || '')}</figcaption></figure>`).join('')}</div>` : ''}
    </div>
    <h3 class="dy-h">ไฟล์รายงาน (PDF) <small class="muted">เก็บในแท็บเอกสาร หมวด ${esc(R.DAILY_DOC_CATEGORY)}</small></h3>
    <div class="dy-docs" id="dy-docs">${docs.length ? docs.map((f) => `<button type="button" class="btn btn-sm" data-doc="${esc(f.id)}" title="${esc(f.note || '')}">${icon('file')}${esc(f.name)}<small class="muted">${esc(fmt.dateTime(f.uploadedAt))}</small></button>`).join('')
      : `<span class="muted small">ยังไม่มีไฟล์${canW ? ' — กดเมนู "สร้างไฟล์ PDF เก็บในแท็บเอกสาร" หรือ "เปิดแบบฟอร์มเพื่อลงชื่อ"' : ''}</span>`}</div>
    ${stale ? `<p class="notice notice-warn dy-stale">${icon('alert')}<span>ไฟล์ PDF สร้างก่อนแก้ไขรายงานครั้งล่าสุด — ข้อมูลในไฟล์อาจไม่ตรงกับรายงาน${canW ? ' <button type="button" class="btn btn-sm" data-act="pdf2">สร้างไฟล์ใหม่</button>' : ''}</span></p>` : ''}
  </section>`;
  // มุมมองแบบฟอร์ม/ข้อมูล
  stopPreview?.(); stopPreview = null;
  const pv = el.querySelector('#dy-pv');
  const showMode = (m) => {
    el.querySelectorAll('[data-vmode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vmode === m)));
    pv.hidden = m !== 'form';
    el.querySelector('#dy-data').hidden = m !== 'data';
    if (m === 'form' && !stopPreview) stopPreview = mountFormPreview(pv, p, d);
  };
  el.querySelectorAll('[data-vmode]').forEach((b) => b.addEventListener('click', () => {
    try { localStorage.setItem(VMODE_KEY, b.dataset.vmode); } catch { /* ไม่จำ */ }
    showMode(b.dataset.vmode);
  }));
  showMode(vm);
  el.querySelector('[data-act="pv-open"]').addEventListener('click', () => openDailyForm(p, K.form, { rec: d }));
  el.querySelector('[data-act="print"]').addEventListener('click', () => openDailyForm(p, K.form, { rec: d }));
  el.querySelector('[data-act="instr"]')?.addEventListener('click', () => openForm('instruction', { p, daily: d }));
  el.querySelector('[data-act="cdaily"]')?.addEventListener('click', () => {
    // มี Daily Report ของผู้รับจ้าง = ฉบับของโครงการ · ยังไม่มี = สำเนาจากรายงานนี้ (ใช้ภายนอก)
    const c = store.dailyAt(p.id, d.date, 'contractor');
    openDailyForm(p, 'cdaily', c ? { rec: c } : { rec: d, mode: 'copy' });
  });
  el.querySelector('[data-act="mat"]')?.addEventListener('click', () => openForm('material', { p, date: d.date }));
  el.querySelector('[data-act="mail"]')?.addEventListener('click', () => openReportDialog('daily', { projectId: p.id, date: d.date }));
  el.querySelector('[data-act="sign"]')?.addEventListener('click', () => openDailyForm(p, K.form, { rec: d }));
  el.querySelector('[data-act="pdf"]')?.addEventListener('click', () => makePdf(p, d, { sign: savedSignature() }));
  el.querySelector('[data-act="pdf2"]')?.addEventListener('click', () => makePdf(p, d, { sign: savedSignature() }));
  el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => preview(files.find((f) => f.id === b.dataset.f))));
  el.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => preview(docs.find((f) => f.id === b.dataset.doc))));
  loadThumbs(el, files);
  el.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
    if (!(await confirmBox({ title: `ลบ${K.short}`, message: `ลบรายงานวันที่ ${esc(fmt.dateLong(d.date))}?${linked ? ' ปริมาณงานตาม BOQ ที่บันทึกพร้อมรายงานนี้จะถูกลบด้วย' : ''} (รูปถ่ายและไฟล์ PDF ยังอยู่ในแท็บเอกสาร)`, ok: 'ลบ', danger: true }))) return;
    try { await store.deleteDaily(d.id); toast('ลบรายงานแล้ว'); location.hash = base; } catch (ex) { toast(ex.message, 'bad'); }
  });
}

/** สร้างไฟล์ PDF ของรายงานแล้วเก็บในแท็บเอกสาร (แจ้งความคืบหน้าด้วยข้อความ) */
let pdfBusy = false;
async function makePdf(p, d, { sign = '' } = {}) {
  if (pdfBusy) { toast('กำลังสร้างไฟล์ PDF อยู่ — รอสักครู่', 'info'); return null; }
  pdfBusy = true;
  const close = toast('กำลังสร้างไฟล์ PDF ของรายงาน…', 'info', 120000);
  try {
    const rec = await saveDailyPdf(p, d, { sign });
    close?.();
    toast(`เก็บไฟล์ "${rec.name}" ในแท็บเอกสารแล้ว`, 'ok', 6000);
    // หน้ารายงานนี้ยังเปิดอยู่ → แสดงไฟล์ที่เพิ่งสร้าง
    if (!guard.dirty && document.querySelector('#dy-docs') && location.hash.includes(`/${d.date}`)) window.dispatchEvent(new Event('pt:rerender'));
    return rec;
  } catch (e) {
    close?.();
    toast(`สร้างไฟล์ PDF ไม่สำเร็จ: ${e.message}`, 'bad', 9000);
    return null;
  } finally {
    pdfBusy = false;
  }
}

/** รูปย่อจากระบบ — ดูไม่ได้ (เช่น ยังไม่ได้ลงชื่อเข้า Google ด้วยอีเมลที่ได้รับแชร์) แสดงไอคอนแทนภาพแตก */
function loadThumbs(el, files) {
  el.querySelectorAll('[data-thumb]').forEach(async (img) => {
    const f = files.find((x) => x.id === img.dataset.thumb);
    img.addEventListener('error', () => {
      const ph = document.createElement('span');
      ph.className = 'fthumb-ph';
      ph.innerHTML = `${icon('image')}<small>${esc(f?.name || 'รูปถ่าย')}</small>`;
      img.replaceWith(ph);
    }, { once: true });
    try { const u = await store.thumbUrl(f); if (u) img.src = u; } catch { /* ignore */ }
  });
}

// ---------- ฟอร์มบันทึก (1.0.14: ช่องตรงกับแบบฟอร์ม FM-002 / PT-F07 — กรอกครั้งเดียว แบบฟอร์มดึงไปเอง) ----------
/** แถวกรอกหลายช่อง: cols = [{ k, ph, w, type, list, label }] */
function rowsBox(id, cols, rows, addLabel) {
  const tpl = `minmax(0, 1fr) ${cols.slice(1).map((c) => c.w || '90px').join(' ')} 32px`;
  return `<div class="dy-rows" id="${id}" style="--dy-cols:${tpl}">${rows.map((r, i) => rowHTML(cols, r, i)).join('')}</div>
    <button type="button" class="btn btn-sm btn-ghost" data-addrow="${id}">${icon('plus')}${esc(addLabel || 'เพิ่มแถว')}</button>`;
}
function rowHTML(cols, r, i) {
  return `<div class="dy-row" data-row="${i}">${cols.map((c) => c.type === 'select'
    ? `<select data-k="${c.k}" aria-label="${esc(c.label || c.ph)}">${c.options(r[c.k])}</select>`
    : `<input data-k="${c.k}" value="${esc(r[c.k] ?? '')}"${c.type ? ` type="${c.type}" min="0" step="any" inputmode="decimal"` : ''}${c.list ? ` list="${c.list}"` : ''} placeholder="${esc(c.ph)}" aria-label="${esc(c.label || c.ph)}" maxlength="${c.max || 300}">`).join('')}
    <button type="button" class="icon-btn" data-rmrow aria-label="ลบแถว">${icon('x')}</button></div>`;
}
const readRowsOf = (box) => [...box.querySelectorAll('.dy-row')].map((r) => {
  const o = {};
  r.querySelectorAll('[data-k]').forEach((x) => { o[x.dataset.k] = x.value; });
  return o;
});

/** แถวงานที่ดำเนินการ (1.0.15): หมวด BOQ → รายการ BOQ → รายละเอียด (พิมพ์เองได้ ไม่ต้องตรงกับชื่อรายการ) → ปริมาณ → หน่วย */
/** 1.0.16 % สะสมของรายการ BOQ ⇄ ปริมาณของวันนี้ — before = ปริมาณสะสมก่อนรายงานนี้ */
const numOf = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : null; };
const trimNum = (x) => String(Math.round(x * 10000) / 10000);
export function pctFromQty(it, before, q) {
  const qty = +it?.qty || 0;
  const n = numOf(q);
  if (!(qty > 0) || n == null) return '';
  return String(Math.round(((before + n) / qty) * 10000) / 100);
}
export function qtyFromPct(it, before, pct) {
  const qty = +it?.qty || 0;
  const n = numOf(pct);
  if (!(qty > 0) || n == null) return { q: '', low: false };
  const q = (Math.min(Math.max(n, 0), 1000) / 100) * qty - before;
  return { q: q > 0 ? trimNum(q) : '0', low: q < -1e-9 };
}

function workRows(boq, { remain = null, before = null } = {}) {
  const NONE = 'ไม่ระบุหมวด';
  const groups = [...new Set(boq.map((b) => b.group || NONE))];
  const itemOf = (id) => (id ? boq.find((b) => b.id === id) : null);
  const groupOf = (r) => { const it = itemOf(r.boq); return it ? (it.group || NONE) : (r.g || ''); };
  const html = (r, i) => {
    const it = itemOf(r.boq);
    const g = groupOf(r);
    const list = boq.filter((b) => !g || (b.group || NONE) === g);
    const left = it && remain ? remain(it) : null;
    const prior = it && before ? before(it) : 0;
    const pctOk = !!(it && before && +it.qty > 0);
    const pctTip = pctOk ? `ก่อนรายงานนี้ทำได้แล้ว ${fmt.num(prior)} ${it.unit || ''} (${fmt.num((prior / +it.qty) * 100)}%) — พิมพ์ % สะสมหลังวันนี้ ระบบคำนวณปริมาณของวันนี้ให้` : 'เลือกรายการ BOQ ก่อน จึงกรอกเป็น % ได้';
    return `<div class="dy-row dy-wrow${boq.length ? '' : ' no-boq'}" data-row="${i}">
      ${boq.length ? `<select data-k="g" aria-label="หมวดงานใน BOQ"><option value="">— หมวด BOQ —</option>${groups.map((x) => `<option value="${esc(x)}"${x === g ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <select data-k="boq" aria-label="รายการ BOQ"><option value="">${g ? '— เลือกรายการ —' : '— ไม่อยู่ใน BOQ —'}</option>${list.map((b) => `<option value="${esc(b.id)}"${b.id === r.boq ? ' selected' : ''}>${esc(`${boqLabel(b)}${b.unit ? ` (${b.unit})` : ''}`)}</option>`).join('')}</select>` : ''}
      <input data-k="w" value="${esc(r.w ?? '')}" list="dl-work" maxlength="300" placeholder="${esc(it ? `รายละเอียด (เว้นว่าง = ${it.desc})` : 'รายละเอียดของงาน เช่น เทคอนกรีตฐานราก F1–F4')}" aria-label="รายละเอียดของงาน">
      <input data-k="q" value="${esc(r.q ?? '')}" inputmode="decimal" maxlength="40" placeholder="${esc(left != null ? `เหลือ ${fmt.num(left)}` : 'ปริมาณ')}" aria-label="ปริมาณ"${left != null ? ` title="ปริมาณตาม BOQ ที่ยังเหลือ ${esc(fmt.num(left))} ${esc(it.unit || '')}"` : ''}>
      <input data-k="u" value="${esc(it ? (it.unit || r.u || '') : (r.u ?? ''))}" list="dl-unit" maxlength="40" placeholder="หน่วย" aria-label="หน่วย"${it ? ' readonly title="หน่วยตามรายการ BOQ"' : ''}>
      ${boq.length && before ? `<label class="dy-pct" title="${esc(pctTip)}"><input data-k="pct" value="${esc(pctOk ? pctFromQty(it, prior, r.q) : '')}" inputmode="decimal" maxlength="8" placeholder="สะสม" aria-label="ความคืบหน้าสะสมของรายการ (%) หลังวันนี้"${pctOk ? '' : ' disabled'}><span aria-hidden="true">%</span></label>` : ''}
      <button type="button" class="icon-btn" data-rmrow aria-label="ลบแถว">${icon('x')}</button></div>`;
  };
  return { html, itemOf, groupOf, before };
}

function renderEditor(el, ctx, date, existing, kind, prefill = null) {
  const { p } = ctx;
  const K = KIND[kind];
  const base = baseOf(p, kind);
  const key = `${p.id}|${kind}|${date}|${existing?.id || 'new'}`;
  const filesById = (id) => store.data.files.find((f) => f.id === id);
  if (ed.key !== key || !ed.items) {
    ed.key = key;
    // รูปเดิม (เรียงตามรายงาน) + รูปใหม่ที่ยังไม่บันทึก — มีคำบรรยายใต้ภาพและย้ายลำดับได้
    ed.items = (existing?.files || []).filter(filesById).map((id) => ({ id, caption: existing.captions?.[id] || '' }));
  }
  const last = store.dailyOf(p.id, kind).find((x) => x.date < date);
  const src = prefill ? { ...(existing || {}), ...prefill } : existing;
  const d = src || { weather: {}, manpower: [], equipment: [], stoppage: {}, request: [], workHours: last?.workHours || '08:00–17:00' };
  d.weather = d.weather || {}; d.manpower = d.manpower || []; d.equipment = d.equipment || []; d.stoppage = d.stoppage || {};
  const W = Object.entries(R.WEATHER);
  const notifyTo = kind === '' ? R.reportRecipients(p, 'daily', true).filter((e) => e !== R.norm(store.me.email)) : [];
  const voc = learned(p.id);
  const sug = (k) => suggestions(p.id, k, voc);
  const boq = store.boqOf(p.id);
  const linked = kind === '' ? store.dailyUpdate(existing) : null;
  const outdated = store.mode === 'gas' && store.serverOutdated('1.0.15');
  const contractorRec = kind === '' && !store.isContractorOf(p) ? store.dailyAt(p.id, date, 'contractor') : null;
  // ปริมาณที่ยังเหลือของรายการ BOQ (ไม่นับปริมาณของรายงานนี้)
  const cum = store.analysis(p.id)?.cum || {};
  const mine = linked?.entries || {};
  const remain = (it) => Math.max(0, (+it.qty || 0) - ((cum[it.id] || 0) - (+mine[it.id] || 0)));
  // 1.0.16 ปริมาณสะสมของรายการ ณ วันที่ของรายงาน (ไม่นับปริมาณของรายงานนี้) — ใช้แปลง % สะสม ⇄ ปริมาณของวันนี้
  const linkId = existing ? store.dailyUpdateId(existing.id) : '';
  const upsAll = store.updatesOf(p.id).filter((u) => u.id !== linkId);
  let curDate = date; // วันที่ในฟอร์ม (เปลี่ยนได้ระหว่างกรอก)
  const before = (it) => upsAll.filter((u) => u.date <= curDate).reduce((a, u) => a + (+(u.entries || {})[it.id] || 0), 0);
  const WR = workRows(boq, { remain: kind === '' ? remain : null, before });
  // 1.0.16 โครงการที่คิดความคืบหน้าแบบกรอก % เอง (หรือยังไม่มี BOQ): ใส่ % รวมในรายงานประจำวันได้เลย
  const canProg = kind === '' && store.can(p, 'recordProgress') && !store.isContractorOf(p);
  const manualMode = canProg && p.progressMethod !== 'time' && (p.progressMethod === 'manual' || !boq.length);
  const prevManual = (() => {
    const ups = upsAll.filter((u) => u.date <= date && u.manualPct !== '' && u.manualPct != null && Number.isFinite(+u.manualPct))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    return ups.length ? +ups[ups.length - 1].manualPct : null;
  })();
  const myManual = linked && linked.manualPct !== '' && linked.manualPct != null ? linked.manualPct : '';
  const blank = (o) => [o];
  // งานที่ทำ: แถวที่บันทึกแบบ 1.0.15 หรือแปลงจากข้อความเดิม + ปริมาณ BOQ ที่บันทึกพร้อมรายงาน (1.0.14)
  let work;
  if (Array.isArray(d.rows) && d.rows.length) work = d.rows.map((r) => ({ boq: r.boq || '', w: r.w || '', q: r.q ?? '', u: r.u || '' }));
  else {
    work = linesOf(d.work).map(splitLine).map(([w, q, u]) => ({ boq: '', w, q, u }));
    if (!prefill) Object.entries(linked?.entries || {}).forEach(([id, q]) => { const it = boq.find((b) => b.id === id); if (it) work.push({ boq: id, w: '', q: String(q), u: it.unit || '' }); });
  }
  const st = {
    manpower: d.manpower.length ? d.manpower.map((r) => ({ trade: tradeLabel(r.trade), count: r.count })) : blank({ trade: '', count: '' }),
    equipment: d.equipment.length ? d.equipment.map((r) => ({ ...r })) : blank({ name: '', count: '' }),
    work: work.length ? work : blank({ boq: '', w: '', q: '', u: '' }),
    mats: linesOf(d.materials).map(splitLine).map(([w, q, u]) => ({ w, q, u })),
    req: (d.request || []).map((r) => ({ w: r.work, q: r.qty, u: r.unit, m: r.men })),
  };
  if (!st.mats.length) st.mats = blank({ w: '', q: '', u: '' });
  if (!st.req.length) st.req = blank({ w: '', q: '', u: '', m: '' });
  const showReq = kind === 'contractor' || (d.request || []).length > 0;
  const COLS = {
    'dy-mp': [{ k: 'trade', ph: 'ตำแหน่ง/ประเภทช่าง', list: 'dl-trade', label: 'ตำแหน่ง' }, { k: 'count', ph: 'จำนวน', type: 'number', w: '90px', label: 'จำนวนคน' }],
    'dy-eq': [{ k: 'name', ph: 'เครื่องจักร/เครื่องมือ', list: 'dl-equip', label: 'เครื่องจักร' }, { k: 'count', ph: 'จำนวน', type: 'number', w: '90px', label: 'จำนวนเครื่อง' }],
    'dy-req': [{ k: 'w', ph: 'งานที่จะทำ', list: 'dl-req', label: 'งานที่ขอทำ' }, { k: 'q', ph: 'ปริมาณ', w: '80px', label: 'ปริมาณ' }, { k: 'u', ph: 'หน่วย', list: 'dl-unit', w: '88px', label: 'หน่วย' }, { k: 'm', ph: 'ช่าง/คน', type: 'number', w: '80px', label: 'ช่างและคนงาน' }],
    'dy-mat': [{ k: 'w', ph: 'ชนิดวัสดุ', list: 'dl-mat', label: 'ชนิดวัสดุ' }, { k: 'q', ph: 'ปริมาณ', w: '80px', label: 'ปริมาณ' }, { k: 'u', ph: 'หน่วย', list: 'dl-unit', w: '88px', label: 'หน่วย' }],
  };
  const STATE = { 'dy-mp': 'manpower', 'dy-eq': 'equipment', 'dy-work': 'work', 'dy-req': 'req', 'dy-mat': 'mats' };
  const dl = (id, list) => `<datalist id="${id}">${list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>`;
  let sig = savedSignature();
  const sigHTML = () => (sig
    ? `<label class="check"><input type="checkbox" id="dy-sign" checked>ลงลายมือชื่อของฉันในไฟล์ <img class="dy-sigimg" src="${esc(sig)}" alt="ลายมือชื่อที่จำไว้"></label><button type="button" class="btn btn-sm btn-ghost" data-act="sig-new">${icon('edit')}เปลี่ยน</button>`
    : `<button type="button" class="btn btn-sm" data-act="sig-new">${icon('edit')}เพิ่มลายมือชื่อในไฟล์</button>`);
  el.innerHTML = `${kindTabs(p, kind)}
  <form class="panel upd dy-form" id="dyf" novalidate data-kind="${kind || 'sup'}">
    <header class="upd-head">
      <div><h2>${existing ? `แก้ไข${esc(K.short)}` : `บันทึก${esc(K.short)}`}</h2><p class="muted">${kind === 'contractor'
        ? 'ผู้รับจ้างกรอกครั้งเดียว — ใช้ในแบบ PT-F07 Daily Report and Daily Request และผู้ควบคุมงานดึงไปใช้ในรายงานประจำวันได้'
        : 'กรอกครั้งเดียว — ข้อมูลนี้ใช้ในแบบ FM-002 บันทึกการควบคุมงานประจำวัน · รายงานประจำสัปดาห์ · ความคืบหน้าตาม BOQ และกราฟ S-Curve'}</p></div>
      <label class="field field-inline"><span>วันที่</span><input type="date" name="date" value="${esc(date)}" max="${esc(R.addDaysIso(today(), 1))}" required></label>
    </header>
    ${outdated ? `<p class="notice notice-warn">${icon('alert')}<span>Code.gs ยังเป็นเวอร์ชัน ${esc(store.meta.version || 'เก่า')} — งานที่ทำตามรายการ BOQ${kind === 'contractor' ? ' และ Daily Report ของผู้รับจ้าง' : ''} จะบันทึกได้หลังผู้ดูแลวาง Code.gs 1.0.15</span></p>` : ''}
    ${contractorRec ? `<p class="notice dy-other">${icon('users')}<span>ผู้รับจ้างส่ง Daily Report ของวันนี้แล้ว (${R.manpowerTotal(contractorRec)} คน)</span><button type="button" class="btn btn-sm" data-act="from-c">${icon('copy')}ดึงข้อมูลจากรายงานผู้รับจ้าง</button></p>` : ''}
    <div class="form-grid">
      <div class="field"><span>อากาศช่วงเช้า</span><div class="seg seg-sm dy-wx">${W.map(([k, l]) => `<label><input type="radio" name="am" value="${k}" ${d.weather?.am === k ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div></div>
      <div class="field"><span>อากาศช่วงบ่าย</span><div class="seg seg-sm dy-wx">${W.map(([k, l]) => `<label><input type="radio" name="pm" value="${k}" ${d.weather?.pm === k ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div></div>
      <div class="field dy-night"><span>กลางคืน (18.00–06.00 น.) และฝุ่น</span><div class="dy-inl">
        <select name="night" aria-label="อากาศกลางคืน"><option value="">— ไม่ระบุ —</option>${W.map(([k, l]) => `<option value="${k}" ${d.weather?.night === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <input name="pm25" type="number" min="0" max="1000" step="1" inputmode="numeric" value="${esc(d.weather?.pm25 ?? '')}" placeholder="PM2.5" aria-label="PM2.5 ไมโครกรัมต่อลูกบาศก์เมตร"><small class="muted">µg/m³</small></div></div>
      <label class="field"><span>เวลาทำงาน</span><input name="workHours" value="${esc(d.workHours || '')}" maxlength="40" placeholder="เช่น 08:00–17:00, OT ถึง 20:00"></label>
      <div class="field span-2 dy-copy">${last && !existing && !prefill ? `<button type="button" class="btn btn-sm" data-act="copy" title="คัดลอกคนงานและเครื่องจักรจากรายงานวันที่ ${esc(fmt.date(last.date))}">${icon('copy')}คัดลอกคนงาน/เครื่องจักรจาก ${esc(fmt.date(last.date))}</button>` : ''}</div>
      <div class="field"><span>ผู้ปฏิบัติงาน/คนงาน <b id="dy-men" class="num"></b></span>${rowsBox('dy-mp', COLS['dy-mp'], st.manpower)}</div>
      <div class="field"><span>เครื่องจักร/เครื่องมือ</span>${rowsBox('dy-eq', COLS['dy-eq'], st.equipment)}</div>
      <div class="field span-2"><span>${kind === 'contractor' ? 'งานที่ทำได้วันนี้' : 'งานที่ดำเนินการ'} <small class="muted">${boq.length
        ? `เลือกหมวดและรายการ BOQ แล้วใส่ปริมาณของวันนี้ <b>หรือ % สะสม</b> ของรายการ (ระบบคำนวณปริมาณให้) — คำบรรยายพิมพ์เองได้ ไม่ต้องตรงกับชื่อรายการ${kind === '' ? (canProg ? ' · <b>ระบบอัปเดตความคืบหน้าของโครงการให้อัตโนมัติ</b> (เปอร์เซ็นต์ผลงาน รายงานประจำสัปดาห์ S-Curve) — แบบฟอร์มพิมพ์เหมือนเดิม' : '') : ' · ผู้ควบคุมงานเป็นผู้ยืนยันเป็นความคืบหน้าของโครงการ'} · งานที่ไม่อยู่ใน BOQ ไม่ต้องเลือกรายการ`
        : 'ทีละรายการ ใส่ปริมาณและหน่วยถ้ามี — ตาราง "รายละเอียดของงาน / ปริมาณงาน" ในแบบฟอร์ม'}</small></span>
        <div class="dy-rows dy-wrows" id="dy-work">${st.work.map((r, i) => WR.html(r, i)).join('')}</div>
        <button type="button" class="btn btn-sm btn-ghost" data-addrow="dy-work">${icon('plus')}เพิ่มรายการ</button></div>
      ${manualMode ? `<label class="field dy-mpct"><span>ความคืบหน้ารวมของโครงการ ณ วันนี้ (%) <small class="muted">อัปเดตความคืบหน้าของโครงการให้อัตโนมัติ — ไม่แสดงในแบบฟอร์ม${prevManual != null ? ` · ครั้งก่อน ${fmt.num(prevManual)}%` : ''}</small></span>
        <input type="number" name="manualPct" min="0" max="100" step="0.01" inputmode="decimal" value="${esc(myManual)}" placeholder="${prevManual != null ? `เช่น ${fmt.num(prevManual)}` : 'เช่น 35'}"></label>` : ''}
      ${showReq ? `<div class="field span-2"><span>งานที่ขอทำวันถัดไป <small class="muted">Daily Request ในแบบ PT-F07${kind === 'contractor' ? ' — ผู้ควบคุมงานเห็นและพิจารณาได้' : ''}</small></span>${rowsBox('dy-req', COLS['dy-req'], st.req, 'เพิ่มงาน')}</div>`
        : `<p class="field span-2 hint dy-reqhint">${icon('users')}งานที่ขอทำวันถัดไป (Daily Request) ผู้รับจ้างกรอกเองในแท็บ "${esc(KIND.contractor.title)}"</p>`}
      <div class="field"><span>วัสดุที่นำเข้าหน่วยงาน</span>${rowsBox('dy-mat', COLS['dy-mat'], st.mats, 'เพิ่มวัสดุ')}</div>
      <div class="field"><span>การหยุดงาน</span>
        <label class="check"><input type="checkbox" name="stopped" ${d.stoppage?.stopped ? 'checked' : ''}>มีการหยุดงาน/งานล่าช้า</label>
        <div class="dy-stop" ${d.stoppage?.stopped ? '' : 'hidden'}><input name="hours" type="number" min="0" max="24" step="0.5" value="${esc(d.stoppage?.hours || '')}" placeholder="ชั่วโมง" aria-label="จำนวนชั่วโมง"><input name="reason" value="${esc(d.stoppage?.reason || '')}" maxlength="500" placeholder="สาเหตุ เช่น ฝนตกหนัก รอวัสดุ" aria-label="สาเหตุ"></div></div>
      <label class="field"><span>ความปลอดภัย/อุบัติเหตุ</span><textarea name="safety" rows="2" maxlength="2000" placeholder="ถ้าไม่มีให้เว้นว่าง">${esc(d.safety || '')}</textarea></label>
      ${kind === '' ? `<label class="field"><span>ข้อสั่งการ/ข้อแนะนำต่อผู้รับจ้าง <small class="muted">ช่อง "การแก้ไข" ใน FM-002</small></span><textarea name="instructions" rows="2" maxlength="2000" placeholder="พิมพ์เป็นใบสั่งการ (PT-F06) ได้">${esc(d.instructions || '')}</textarea></label>` : ''}
      <div class="field span-2"><span>ภาพประกอบ <small class="muted">เรียงลำดับและบรรยายใต้ภาพ เช่น "รูปที่ 1 ดำเนินการผูกเหล็ก" · กด "มาร์ค" เพื่อวาดหรือเขียนโน้ตบนรูปใหม่</small></span>
        <label class="drop drop-sm" id="dy-drop">${icon('image')}<b>เลือกรูปหรือลากมาวาง</b><input type="file" accept="image/*" multiple hidden id="dy-photos"></label>
        <ol class="dy-photos" id="dy-list"></ol></div>
    </div>
    ${dl('dl-trade', sug('trade'))}${dl('dl-equip', sug('equip'))}${dl('dl-work', sug('work'))}${dl('dl-req', sug('req').concat(sug('work')))}${dl('dl-mat', sug('mat'))}${dl('dl-unit', sug('unit'))}${dl('dl-cap', sug('cap'))}
    <div class="dy-pdf" id="dy-pdfbox">
      <label class="check"><input type="checkbox" id="dy-pdf" ${pdfPref() ? 'checked' : ''}>${icon('file')}เก็บเป็นไฟล์ PDF (แบบ ${esc(K.code)}) ในแท็บเอกสาร หมวด "${esc(R.DAILY_DOC_CATEGORY)}"</label>
      <span class="dy-sig" id="dy-sig">${sigHTML()}</span>
    </div>
    <footer class="upd-foot">
      ${notifyTo.length ? `<label class="check upd-notify" title="${esc(notifyTo.map((e) => personName(p, e)).join(', '))}"><input type="checkbox" id="dy-notify">${icon('mail')}ส่งรายงานนี้ทางอีเมลทันที ${notifyTo.length} คน</label>` : ''}
      <a class="btn" href="${base}${existing ? `/${existing.date}` : ''}" data-act="cancel">ยกเลิก</a>
      <button class="btn btn-primary" type="submit" data-act="save">${icon('check')}บันทึก</button>
    </footer>
  </form>`;
  const form = el.querySelector('#dyf');
  const box = (id) => el.querySelector(`#${id}`);
  const read = (id) => { if (box(id)) st[STATE[id]] = readRowsOf(box(id)); };
  const draw = (id) => {
    const b = box(id);
    if (!b) return;
    b.innerHTML = id === 'dy-work' ? st.work.map((r, i) => WR.html(r, i)).join('') : st[STATE[id]].map((r, i) => rowHTML(COLS[id], r, i)).join('');
  };
  const total = () => {
    read('dy-mp');
    const n = st.manpower.reduce((a, r) => a + Math.max(0, Math.round(+r.count || 0)), 0);
    el.querySelector('#dy-men').textContent = n ? `รวม ${n} คน` : '';
  };
  total();
  el.querySelector('#dy-mp').addEventListener('input', total);
  // หมวด/รายการ BOQ: เลือกหมวด = กรองรายการ · เลือกรายการ = ตั้งหมวดและหน่วยตาม BOQ
  box('dy-work').addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-k]');
    if (!sel) return;
    read('dy-work');
    const i = +sel.closest('.dy-row').dataset.row;
    const r = st.work[i];
    if (sel.dataset.k === 'g') {
      const it = WR.itemOf(r.boq);
      if (it && (it.group || 'ไม่ระบุหมวด') !== r.g) r.boq = '';
    } else if (sel.dataset.k === 'boq') {
      const it = WR.itemOf(r.boq);
      if (it) { r.g = it.group || 'ไม่ระบุหมวด'; r.u = it.unit || ''; }
    }
    const rowEl = sel.closest('.dy-row');
    const tmp = document.createElement('div');
    tmp.innerHTML = WR.html(r, i);
    rowEl.replaceWith(tmp.firstElementChild);
    box('dy-work').querySelector(`.dy-row[data-row="${i}"] [data-k="${sel.dataset.k === 'g' ? 'boq' : 'w'}"]`)?.focus();
    guard.dirty = true;
  });
  // 1.0.16 % สะสม ⇄ ปริมาณของวันนี้
  box('dy-work').addEventListener('input', (e) => {
    const t = e.target;
    const row = t.closest('.dy-row');
    const pctEl = row?.querySelector('[data-k="pct"]');
    if (!pctEl || pctEl.disabled) return;
    const it = WR.itemOf(row.querySelector('[data-k="boq"]')?.value);
    if (!it) return;
    const prior = WR.before(it);
    if (t.dataset.k === 'pct') {
      // เกิน 100% ได้เฉพาะโครงการที่ยอมให้ปริมาณเกิน BOQ
      const over = !p.allowOver && numOf(t.value) > 100;
      const { q, low } = qtyFromPct(it, prior, over ? '100' : t.value);
      row.querySelector('[data-k="q"]').value = t.value.trim() === '' ? '' : q;
      t.classList.toggle('is-bad', low || over);
      t.closest('.dy-pct').title = low ? `ต่ำกว่าผลงานสะสมก่อนหน้า (${fmt.num((prior / +it.qty) * 100)}%) — ปริมาณของวันนี้เป็น 0`
        : over ? 'เกิน 100% — ใช้ปริมาณที่เหลือทั้งหมดของรายการ (ตั้ง "ยอมให้ปริมาณเกิน BOQ" ได้ที่ตั้งค่าโครงการ)' : `ก่อนรายงานนี้ทำได้แล้ว ${fmt.num(prior)} ${it.unit || ''} (${fmt.num((prior / +it.qty) * 100)}%)`;
    } else if (t.dataset.k === 'q') {
      pctEl.value = pctFromQty(it, prior, t.value);
      pctEl.classList.remove('is-bad');
    }
  });
  // เปลี่ยนวันที่ของรายงาน → ผลงานสะสมก่อนหน้าเปลี่ยน คำนวณ % ใหม่
  form.elements.date.addEventListener('change', () => { curDate = form.elements.date.value || date; read('dy-work'); draw('dy-work'); });
  form.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rmrow]');
    if (rm) {
      const b = rm.closest('.dy-rows');
      read(b.id);
      st[STATE[b.id]].splice(+rm.closest('.dy-row').dataset.row, 1);
      if (!st[STATE[b.id]].length) st[STATE[b.id]].push({});
      draw(b.id);
      if (b.id === 'dy-mp') total();
      guard.dirty = true;
      return;
    }
    const add = e.target.closest('[data-addrow]');
    if (add) {
      const id = add.dataset.addrow;
      read(id);
      // แถวงานใหม่ใช้หมวด BOQ เดียวกับแถวก่อนหน้า (กรอกงานในหมวดเดียวกันต่อได้เร็ว)
      const prev = id === 'dy-work' ? st.work[st.work.length - 1] : null;
      st[STATE[id]].push(prev ? { g: WR.groupOf(prev) } : {});
      draw(id);
      box(id).querySelector('.dy-row:last-of-type [data-k]')?.focus();
    }
  });
  // Enter ในแถวสุดท้าย = เพิ่มแถวใหม่ (กรอกต่อเนื่องได้เร็ว)
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    const inp = e.target.closest('.dy-row input');
    if (!inp) return;
    e.preventDefault();
    const rowEl = inp.closest('.dy-row');
    const nextIn = [...rowEl.querySelectorAll('input[data-k]:not([readonly]):not([data-k="pct"])')].find((x) => inp.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (nextIn) { nextIn.focus(); return; }
    const b = rowEl.closest('.dy-rows');
    if (rowEl.nextElementSibling) { rowEl.nextElementSibling.querySelector('input[data-k]')?.focus(); return; }
    read(b.id);
    const prev = b.id === 'dy-work' ? st.work[st.work.length - 1] : null;
    st[STATE[b.id]].push(prev ? { g: WR.groupOf(prev) } : {});
    draw(b.id);
    b.querySelector('.dy-row:last-of-type input[data-k]')?.focus();
  });
  el.querySelector('[data-act="copy"]')?.addEventListener('click', () => {
    st.manpower = last.manpower.length ? last.manpower.map((r) => ({ trade: tradeLabel(r.trade), count: r.count })) : [{}];
    st.equipment = last.equipment.length ? last.equipment.map((r) => ({ ...r })) : [{}];
    draw('dy-mp'); draw('dy-eq'); total();
    if (!form.elements.workHours.value) form.elements.workHours.value = last.workHours || '';
    guard.dirty = true;
  });
  // ดึงข้อมูลจาก Daily Report ของผู้รับจ้างวันเดียวกัน (อากาศ เวลา คนงาน เครื่องจักร งานที่ทำ วัสดุ)
  const fromC = () => {
    const c = contractorRec;
    if (!c) return;
    readCaps();
    renderEditor(el, ctx, date, existing, kind, {
      weather: { ...(c.weather || {}) }, workHours: c.workHours || '', manpower: (c.manpower || []).map((r) => ({ ...r })), equipment: (c.equipment || []).map((r) => ({ ...r })),
      rows: Array.isArray(c.rows) && c.rows.length ? c.rows.map((r) => ({ ...r })) : linesOf(c.work).map(splitLine).map(([w, q, u]) => ({ w, q, u, boq: '' })),
      materials: c.materials || '', work: c.work || '',
    });
    guard.dirty = true;
    toast('ดึงข้อมูลจากรายงานผู้รับจ้างแล้ว — ตรวจทานปริมาณงานก่อนบันทึก', 'info', 5000);
  };
  el.querySelector('[data-act="from-c"]')?.addEventListener('click', fromC);
  form.addEventListener('input', () => { guard.dirty = true; });
  form.elements.stopped.addEventListener('change', (e) => { el.querySelector('.dy-stop').hidden = !e.target.checked; });
  form.elements.date.addEventListener('change', () => {
    const v = form.elements.date.value;
    const other = v && store.dailyAt(p.id, v, kind);
    if (other && other.id !== existing?.id) toast(`มีรายงานของวันที่ ${fmt.dateLong(v)} แล้ว — เปิดรายงานเดิมเพื่อแก้ไข`, 'bad', 5000);
  });
  // ลายมือชื่อในไฟล์ PDF: วาด หรือเลือกรูป แล้วจำไว้ในเครื่องนี้ได้
  el.querySelector('#dy-pdf').addEventListener('change', (e) => setPdfPref(e.target.checked));
  el.querySelector('#dy-sig').addEventListener('click', async (e) => {
    if (!e.target.closest('[data-act="sig-new"]') || !window.PTAnnotate) return;
    const url = await window.PTAnnotate.signature();
    if (!url) return;
    sig = url;
    const kept = rememberSignature(url);
    el.querySelector('#dy-sig').innerHTML = sigHTML();
    toast(kept ? 'จำลายมือชื่อไว้ในเครื่องนี้แล้ว (ลบได้ในหน้าต่างแบบฟอร์ม › ลืมลายเซ็น)' : 'ใช้ลายมือชื่อนี้กับไฟล์ครั้งนี้', 'ok');
  });

  // ---------- ภาพประกอบ: ลำดับ คำบรรยาย มาร์ค ----------
  const list = el.querySelector('#dy-list');
  function readCaps() { list.querySelectorAll('[data-cap]').forEach((x) => { if (ed.items[+x.dataset.cap]) ed.items[+x.dataset.cap].caption = x.value; }); }
  const urls = new Map();
  const srcOf = (it) => {
    if (!it.file) return '';
    if (!urls.has(it.file)) urls.set(it.file, URL.createObjectURL(it.file));
    return urls.get(it.file);
  };
  const drawPhotos = () => {
    list.innerHTML = ed.items.map((it, i) => `<li class="dy-ph">
      <div class="dy-ph-img">${it.file ? `<img src="${srcOf(it)}" alt="">` : `<img alt="" data-thumb="${esc(it.id)}">`}</div>
      <div class="dy-ph-body"><b>รูปที่ ${i + 1}</b>${it.file ? ' <small class="muted">ใหม่</small>' : ''}
        <input data-cap="${i}" value="${esc(it.caption || '')}" list="dl-cap" maxlength="300" placeholder="คำบรรยายใต้ภาพ เช่น ดำเนินการผูกเหล็ก" aria-label="คำบรรยายรูปที่ ${i + 1}">
        <div class="dy-ph-tools">
          <button type="button" class="btn btn-sm btn-ghost" data-mv="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="เลื่อนรูปที่ ${i + 1} ขึ้น">${icon('chevL')}ก่อน</button>
          <button type="button" class="btn btn-sm btn-ghost" data-mv="${i}" data-d="1" ${i < ed.items.length - 1 ? '' : 'disabled'} aria-label="เลื่อนรูปที่ ${i + 1} ลง">หลัง${icon('chevR')}</button>
          ${it.file ? `<button type="button" class="btn btn-sm" data-mark="${i}">${icon('edit')}มาร์ค</button>` : ''}
          <button type="button" class="btn btn-sm btn-ghost" data-rmp="${i}" aria-label="เอารูปที่ ${i + 1} ออก">${icon('x')}เอาออก</button>
        </div></div></li>`).join('');
    loadThumbs(list, ed.items.filter((x) => !x.file).map((x) => filesById(x.id)).filter(Boolean));
  };
  list.addEventListener('input', () => { readCaps(); guard.dirty = true; });
  list.addEventListener('click', async (e) => {
    const mv = e.target.closest('[data-mv]');
    const rmp = e.target.closest('[data-rmp]');
    const mk = e.target.closest('[data-mark]');
    readCaps();
    if (mv) {
      const i = +mv.dataset.mv, j = i + +mv.dataset.d;
      if (j < 0 || j >= ed.items.length) return;
      [ed.items[i], ed.items[j]] = [ed.items[j], ed.items[i]];
      guard.dirty = true; drawPhotos();
      list.querySelector(`[data-mv="${j}"][data-d="${mv.dataset.d}"]`)?.focus();
    } else if (rmp) {
      ed.items.splice(+rmp.dataset.rmp, 1); guard.dirty = true; drawPhotos();
    } else if (mk) {
      const it = ed.items[+mk.dataset.mark];
      if (!it?.file || !window.PTAnnotate) return;
      try {
        const f2 = await window.PTAnnotate.annotateFile(it.file, { title: `มาร์ค/โน้ต รูปที่ ${+mk.dataset.mark + 1}` });
        if (f2 !== it.file) { it.file = f2; guard.dirty = true; drawPhotos(); }
      } catch (ex) { toast(ex.message || 'เปิดรูปนี้ไม่ได้', 'bad'); }
    }
  });
  const addPhotos = (fl) => {
    readCaps();
    const imgs = [...fl].filter((f) => f.type.startsWith('image/'));
    if (ed.items.length + imgs.length > 30) toast('แนบรูปได้ไม่เกิน 30 รูปต่อรายงาน', 'bad');
    imgs.slice(0, Math.max(0, 30 - ed.items.length)).forEach((f) => ed.items.push({ file: f, caption: '' }));
    guard.dirty = true; drawPhotos();
  };
  const drop = el.querySelector('#dy-drop');
  el.querySelector('#dy-photos').addEventListener('change', (e) => { addPhotos(e.target.files); e.target.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); addPhotos(e.dataTransfer.files); });
  drawPhotos();
  el.querySelector('[data-act="cancel"]').addEventListener('click', () => { guard.dirty = false; ed.key = ''; ed.items = null; });
  // เปิดจาก "บันทึกโดยดึงข้อมูลจากรายงานนี้" ในรายงานผู้รับจ้าง
  if (!existing && !prefill && contractorRec && /[?&]from=c\b/.test(location.hash)) { fromC(); return; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    Object.keys(STATE).forEach(read);
    readCaps();
    const f = form.elements;
    const newFiles = [];
    const tokens = ed.items.map((it) => { if (it.file) { newFiles.push(it.file); return `new:${newFiles.length - 1}`; } return it.id; });
    const captions = {};
    ed.items.forEach((it, i) => { if (String(it.caption || '').trim()) captions[tokens[i]] = it.caption.trim(); });
    const rows = st.work.map((r) => ({ w: String(r.w || '').trim(), q: String(r.q ?? '').trim(), u: String(r.u || '').trim(), boq: r.boq || '' })).filter((r) => r.w || r.boq);
    const badQ = rows.find((r) => r.boq && r.q && !Number.isFinite(parseFloat(r.q.replace(/,/g, ''))));
    if (badQ) { toast(`ปริมาณของรายการ "${boqLabel(WR.itemOf(badQ.boq))}" ต้องเป็นตัวเลข`, 'bad'); return; }
    const input = {
      ...(existing || {}), projectId: p.id, date: f.date.value, kind,
      weather: { am: form.querySelector('[name="am"]:checked')?.value || '', pm: form.querySelector('[name="pm"]:checked')?.value || '', night: f.night.value, pm25: f.pm25.value.trim() },
      workHours: f.workHours.value.trim(),
      manpower: st.manpower.filter((r) => String(r.trade || '').trim()).map((r) => ({ trade: tradeLabel(r.trade), count: r.count })),
      equipment: st.equipment.filter((r) => String(r.name || '').trim()).map((r) => ({ name: r.name.trim(), count: r.count })),
      rows,
      work: rows.map((r) => joinLine(r.w || boqLabel(WR.itemOf(r.boq)), r.q, r.u)).filter(Boolean).join('\n'),
      materials: st.mats.map((r) => joinLine(r.w, r.q, r.u)).filter(Boolean).join('\n'),
      request: showReq ? st.req.filter((r) => String(r.w || '').trim()).map((r) => ({ work: r.w.trim(), qty: String(r.q || '').trim(), unit: String(r.u || '').trim(), men: r.m })) : (existing?.request || []),
      stoppage: { stopped: f.stopped.checked, hours: f.hours.value, reason: f.reason.value.trim() },
      safety: f.safety.value.trim(), instructions: kind === '' ? (f.instructions?.value || '').trim() : '',
      files: tokens, captions,
    };
    delete input.boq;
    if (!input.date) { toast('กรุณาระบุวันที่', 'bad'); return; }
    if (f.manualPct) {
      const mp = f.manualPct.value.trim();
      if (mp !== '' && !(Number.isFinite(+mp) && +mp >= 0 && +mp <= 100)) { toast('ความคืบหน้ารวมต้องเป็นตัวเลข 0–100', 'bad'); f.manualPct.focus(); return; }
      input.manualPct = mp === '' ? '' : +mp;
    }
    const wantPdf = !!el.querySelector('#dy-pdf')?.checked;
    const signIt = wantPdf && !!el.querySelector('#dy-sign')?.checked ? sig : '';
    const btn = el.querySelector('[data-act="save"]');
    setBusy(btn, true, 'กำลังบันทึก…');
    try {
      const saved = await store.saveDaily(input, newFiles, {
        notify: !!el.querySelector('#dy-notify')?.checked,
        onProgress: (label) => { btn.innerHTML = `<span class="spin"></span>${esc(label)}…`; },
      });
      guard.dirty = false;
      ed.key = ''; ed.items = null;
      urls.forEach((u) => URL.revokeObjectURL(u));
      if (saved._boqError) toast(`บันทึกรายงานแล้ว แต่บันทึกปริมาณงาน BOQ ไม่สำเร็จ: ${saved._boqError}`, 'bad', 8000);
      else toast(`บันทึก${K.short}แล้ว${mailNote(saved._mail, store.mode)}`, saved._mail?.error ? 'bad' : 'ok', 5000);
      location.hash = `${base}/${saved.date}`;
      // ไฟล์ PDF สร้างต่อเบื้องหลัง (หน้าจอไปที่รายงานแล้ว)
      if (wantPdf) {
        const rec = store.data.daily.find((x) => x.id === saved.id) || saved;
        makePdf(p, rec, { sign: signIt });
      }
    } catch (ex) {
      toast(ex.message, 'bad', 6000);
      setBusy(btn, false);
    }
  });
}
