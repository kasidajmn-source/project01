// แท็บรายงานประจำวัน (1.0.5): ผู้ควบคุมงานบันทึกสภาพการปฏิบัติงานรายวัน (ระเบียบกระทรวงการคลังฯ ข้อ 178)
// และส่งรายงานประจำวัน/ประจำสัปดาห์ทางอีเมล พิมพ์แบบฟอร์ม กฟผ. FM-002 (บันทึกการควบคุมงานประจำวัน) FM-001 (ผลการตรวจวัสดุ) และ PT-F03/F05/F06
import { store } from '../store.js';
import { esc, fmt, icon, emptyState, toast, confirmBox, setBusy, guard, menu } from '../ui.js';
import { mailNote, personName } from './common.js';
import { openForm } from '../forms.js';
import { libraryBox, bindLibraryBox } from './library.js';
import { openReportDialog } from './reports.js';
import { preview } from './tab-docs.js';
import { suggestions, learned, splitLine, joinLine, tradeLabel } from '../vocab.js';
import '../annotate.js';

/** ชื่อผู้บันทึกโดยตัดวงเล็บท้ายชื่อ เช่น "นายช่างวิไล (ผู้ควบคุมงาน)" → "นายช่างวิไล" (ไม่ใช้ regex เพื่อไม่ให้ช้ากับข้อความยาวผิดปกติ) */
function shortName(n) {
  const s = String(n || '').slice(0, 300);
  const i = s.lastIndexOf('(');
  return i > 0 && s.endsWith(')') ? s.slice(0, i).trimEnd() : s;
}

const R = globalThis.PTRules;
// ช่างและเครื่องจักรที่แนะนำ: ค่าเริ่มต้น + คำที่โครงการใช้ครบ 3 วัน (vocab.js)
const ed = { key: '', items: null };
window.addEventListener('pt:discard', () => { ed.key = ''; });

const today = () => store.thaiNow().date;
const weatherText = (d) => [R.WEATHER[d.weather?.am] && `เช้า${R.WEATHER[d.weather.am]}`, R.WEATHER[d.weather?.pm] && `บ่าย${R.WEATHER[d.weather.pm]}`, R.WEATHER[d.weather?.night] && `กลางคืน${R.WEATHER[d.weather.night]}`, d.weather?.pm25 !== '' && d.weather?.pm25 != null && `PM2.5 ${d.weather.pm25}`].filter(Boolean).join(' · ') || '–';
const linesOf = (t) => String(t || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const qtyText = (q, u) => (q ? `${q}${u ? ` ${u}` : ''}` : '');

export function renderDaily(el, ctx, sub = '') {
  const { p } = ctx;
  if (!store.canSeeDaily(p)) {
    el.innerHTML = `<section class="panel">${emptyState({ ic: 'lock', title: 'รายงานประจำวันเป็นบันทึกภายในของผู้ควบคุมงาน', text: 'ผู้รับจ้างดูรายงานนี้ไม่ได้ — ข้อสั่งการที่เกี่ยวข้องจะแจ้งผ่านห้องสนทนาหรือใบสั่งการ' })}</section>`;
    return;
  }
  if (store.serverOutdated('1.0.5')) {
    el.innerHTML = `<section class="panel">${emptyState({ ic: 'alert', title: 'ต้องอัปเดตระบบหลังบ้านก่อน', text: `รายงานประจำวันต้องใช้ Code.gs เวอร์ชัน 1.0.5 ขึ้นไป (ตอนนี้ ${esc(store.meta.version || 'เวอร์ชันเก่า')}) — ให้ผู้ดูแลวางโค้ดใหม่ รัน setup แล้ว Deploy เวอร์ชันใหม่` })}</section>`;
    return;
  }
  const [a, b] = String(sub || '').split('/');
  const canRec = store.can(p, 'recordProgress');
  if (a === 'new') { location.replace(`#/p/${encodeURIComponent(p.id)}/daily/${today()}/edit`); return; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(a || '')) {
    const d = store.dailyAt(p.id, a);
    if (b === 'edit' || !d) {
      if (!canRec) { if (!d) { el.innerHTML = `<section class="panel">${emptyState({ ic: 'calendar', title: `ไม่มีรายงานของวันที่ ${fmt.dateLong(a)}`, actions: `<a class="btn" href="#/p/${encodeURIComponent(p.id)}/daily">กลับ</a>` })}</section>`; return; } }
      else { renderEditor(el, ctx, a, d); return; }
    }
    renderView(el, ctx, d);
    return;
  }
  renderList(el, ctx);
}

// ---------- รายการ ----------
function renderList(el, ctx) {
  const { p } = ctx;
  const pid = encodeURIComponent(p.id);
  const list = store.dailyOf(p.id);
  const canRec = store.can(p, 'recordProgress');
  const t = today();
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(R.addDaysIso(t, -i));
  const inRange = (iso) => (!p.startDate || iso >= p.startDate) && (!p.endDate || iso <= R.addDaysIso(p.endDate, 60));
  const last30 = list.filter((d) => d.date > R.addDaysIso(t, -30)).length;
  const canSend = store.canSendReport('daily', p.id);
  const forms = [
    ['daily', 'บันทึกการควบคุมงานประจำวัน (เปล่า)', { p, date: t }],
    ['cdaily', 'Daily Report & Request ของผู้รับจ้าง', () => ({ p, date: t, daily: store.dailyAt(p.id, t) })],
    ['material', 'ผลการตรวจวัสดุก่อสร้าง (เปล่า)', { p, date: t }],
    ['weekly', 'รายงานประจำสัปดาห์', () => ({ p, to: t })],
    ['instruction', 'ใบสั่งการ', { p }],
    ['inspect', 'บันทึกการตรวจรับงาน', { p }],
  ];
  el.innerHTML = `
  <div class="toolbar">
    <div class="tb-info"><b>${list.length}</b> วัน <span class="sep"></span> 30 วันล่าสุดบันทึก ${last30} วัน</div>
    <div class="tb-actions">
      ${canSend ? menu({ label: 'ส่งอีเมล', icon: 'mail', items: [
        { icon: 'calendar', label: 'รายงานประจำวัน (วันนี้)', attrs: 'data-mail="daily"' },
        { icon: 'list', label: 'รายงานประจำสัปดาห์', sub: 'ถึงคณะกรรมการตรวจรับ เจ้าของ และผู้ควบคุมงาน', attrs: 'data-mail="weekly"' },
      ] }) : ''}
      ${canRec ? `<a class="btn btn-primary" href="#/p/${pid}/daily/${t}${store.dailyAt(p.id, t) ? '' : '/edit'}">${icon(store.dailyAt(p.id, t) ? 'eye' : 'plus')}${store.dailyAt(p.id, t) ? 'รายงานวันนี้' : 'บันทึกรายงานวันนี้'}</a>` : ''}
    </div>
  </div>
  <div class="dy-strip" role="list" aria-label="14 วันล่าสุด">${days.map((iso) => {
    const d = store.dailyAt(p.id, iso);
    const tone = d ? (d.stoppage?.stopped ? 'warn' : 'ok') : (inRange(iso) ? 'miss' : 'none');
    const dow = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][new Date(`${iso}T00:00:00Z`).getUTCDay()];
    const href = d || canRec ? `#/p/${pid}/daily/${iso}${d ? '' : '/edit'}` : '';
    return `<${href ? `a href="${href}"` : 'span'} role="listitem" class="dy-day dy-${tone} ${iso === t ? 'is-today' : ''}" title="${esc(fmt.dateLong(iso))}${d ? ` — ${esc(weatherText(d))}, คนงาน ${R.manpowerTotal(d)} คน${d.stoppage?.stopped ? ', หยุดงาน' : ''}` : ' — ยังไม่ได้บันทึก'}">
      <small>${dow}</small><b>${+iso.slice(8)}</b>${icon(d ? (d.stoppage?.stopped ? 'alert' : 'check') : 'x')}</${href ? 'a' : 'span'}>`;
  }).join('')}</div>
  <div class="dy-layout">
    <section class="panel panel-flush">
      ${list.length ? `<div class="table-wrap"><table class="hist dy-table">
        <thead><tr><th>วันที่</th><th>สภาพอากาศ</th><th class="r">คนงาน</th><th>งานที่ดำเนินการ</th><th>หยุดงาน</th><th></th></tr></thead>
        <tbody>${list.slice(0, 120).map((d) => `<tr>
          <td class="nowrap"><a class="link" href="#/p/${pid}/daily/${d.date}"><b>${fmt.date(d.date)}</b></a><small class="dy-by" title="${esc(d.createdBy || '')}">${esc(shortName(d.createdBy))}</small></td>
          <td class="nowrap" data-l="อากาศ">${esc(weatherText(d))}</td>
          <td class="r num" data-l="คนงาน">${R.manpowerTotal(d)}</td>
          <td class="c-note">${esc(String(d.work || '').slice(0, 140))}${(d.files || []).length ? ` <span class="muted small">${icon('image')}${d.files.length}</span>` : ''}</td>
          <td class="dy-stopc" data-l="หยุดงาน">${d.stoppage?.stopped ? `<span class="t-issue">${icon('alert')}${esc(`${d.stoppage.hours ? `${d.stoppage.hours} ชม. ` : ''}${d.stoppage.reason || ''}`)}</span>` : '<span class="muted">–</span>'}</td>
          <td class="row-tools"><button class="icon-btn" data-print="${esc(d.id)}" title="พิมพ์บันทึกการควบคุมงานประจำวัน FM-002" aria-label="พิมพ์">${icon('print')}</button>
            ${canRec ? `<a class="icon-btn" href="#/p/${pid}/daily/${d.date}/edit" title="แก้ไข" aria-label="แก้ไข">${icon('edit')}</a>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>`
    : emptyState({ ic: 'calendar', title: 'ยังไม่มีรายงานประจำวัน', text: canRec ? 'บันทึกสภาพอากาศ คนงาน เครื่องจักร งานที่ทำ และการหยุดงานทุกวัน ระบบจะสรุปเป็นรายงานประจำสัปดาห์ให้คณะกรรมการตรวจรับพัสดุ และส่งทางอีเมลได้' : 'ผู้ควบคุมงานจะบันทึกรายงานประจำวันที่นี่',
      actions: canRec ? `<a class="btn btn-primary" href="#/p/${pid}/daily/${t}/edit">${icon('plus')}บันทึกรายงานวันนี้</a>` : '' })}
    </section>
    <aside class="dy-side">${libraryBox({ use: 'daily', workType: p.type, forms, title: 'แบบฟอร์มสำหรับงานควบคุม' })}
      <p class="hint">${store.serverRules ? 'ระบบส่งรายงานประจำวันทางอีเมลอัตโนมัติตามเวลาที่ผู้ดูแลตั้ง (ค่าเริ่มต้น 17:00 น.) และส่งรายงานประจำสัปดาห์ทุกวันศุกร์' : 'กด "ส่งรายงาน" เพื่อส่งอีเมลจากบัญชีของคุณ'} — ผู้รับ: ผู้ที่รับอีเมลระดับ "ทุกเรื่อง" (รายวัน) และคณะกรรมการ/หัวหน้า (รายสัปดาห์) ไม่รวมผู้รับจ้าง</p>
    </aside>
  </div>`;
  bindLibraryBox(el, forms);
  el.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => openForm('daily', { p, daily: list.find((x) => x.id === b.dataset.print) })));
  el.querySelectorAll('[data-mail]').forEach((b) => b.addEventListener('click', () => openReportDialog(b.dataset.mail, { projectId: p.id, date: t })));
}

// ---------- ดูรายงาน ----------
function renderView(el, ctx, d) {
  const { p } = ctx;
  const pid = encodeURIComponent(p.id);
  const canRec = store.can(p, 'recordProgress');
  const files = (d.files || []).map((id) => store.data.files.find((f) => f.id === id)).filter(Boolean);
  const row = (k, v) => (v ? `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>` : '');
  const prevD = store.dailyOf(p.id).find((x) => x.date < d.date);
  const nextD = [...store.dailyOf(p.id)].reverse().find((x) => x.date > d.date);
  const work = linesOf(d.work).map(splitLine);
  const mats = linesOf(d.materials).map(splitLine);
  const linked = store.dailyUpdate(d);
  const boq = store.boqOf(p.id);
  const boqRows = linked ? Object.entries(linked.entries || {}).map(([id, q]) => [boq.find((b) => b.id === id), q]).filter(([it]) => it) : [];
  const table = (head, rows) => `<div class="table-wrap"><table class="hist dy-tbl"><thead><tr>${head.map((h, i) => `<th${i ? ' class="r"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  el.innerHTML = `
  <div class="toolbar">
    <div class="tb-info"><a class="link" href="#/p/${pid}/daily">${icon('chevL')}รายงานประจำวัน</a></div>
    <div class="tb-actions">
      ${prevD ? `<a class="btn btn-sm" href="#/p/${pid}/daily/${prevD.date}" title="วันก่อนหน้า">${icon('chevL')}${fmt.date(prevD.date)}</a>` : ''}
      ${nextD ? `<a class="btn btn-sm" href="#/p/${pid}/daily/${nextD.date}" title="วันถัดไป">${fmt.date(nextD.date)}${icon('chevR')}</a>` : ''}
      ${menu({ items: [
        { act: 'print', icon: 'print', label: 'บันทึกการควบคุมงานประจำวัน FM-002' },
        { act: 'cdaily', icon: 'print', label: 'Daily Report and Daily Request PT-F07' },
        d.materials && { act: 'mat', icon: 'print', label: 'ผลการตรวจวัสดุ FM-001' },
        d.instructions && { act: 'instr', icon: 'print', label: 'ใบสั่งการ PT-F06' },
        store.canSendReport('daily', p.id) && { act: 'mail', icon: 'mail', label: 'ส่งรายงานนี้ทางอีเมล' },
        canRec && { sep: true },
        canRec && { act: 'del', icon: 'trash', label: 'ลบรายงานนี้', danger: true },
      ] })}
      ${canRec ? `<a class="btn btn-primary" href="#/p/${pid}/daily/${d.date}/edit">${icon('edit')}แก้ไข</a>` : ''}
    </div>
  </div>
  <section class="panel dy-view">
    <header class="dy-vh"><h2>รายงานประจำวันที่ ${esc(fmt.dateLong(d.date))}</h2>
      <span class="muted small">บันทึกโดย ${esc(d.createdBy || d.createdByEmail)} · ${esc(fmt.dateTime(d.updatedAt || d.createdAt))}</span></header>
    <dl class="facts dy-facts">
      ${row('สภาพอากาศ', esc(weatherText(d)))}
      ${row('เวลาทำงาน', esc(d.workHours))}
      ${row('คนงาน', `<b>${R.manpowerTotal(d)} คน</b>${d.manpower.length ? ` <small class="muted">(${esc(d.manpower.map((r) => `${tradeLabel(r.trade)} ${r.count}`).join(', '))})</small>` : ''}`)}
      ${row('เครื่องจักร', esc(d.equipment.map((r) => `${r.name} ${r.count}`).join(', ')))}
      ${d.stoppage?.stopped ? row('หยุดงาน', `<b class="is-bad">${esc(`${d.stoppage.hours ? `${d.stoppage.hours} ชั่วโมง ` : ''}${d.stoppage.reason || ''}`)}</b>`) : ''}
    </dl>
    ${work.length ? `<h3 class="dy-h">งานที่ดำเนินการ</h3>${table(['รายละเอียดของงาน', 'ปริมาณงาน'], work.map(([w, q, u]) => `<tr><td>${esc(w)}</td><td class="r num">${esc(qtyText(q, u))}</td></tr>`))}` : ''}
    ${boqRows.length ? `<h3 class="dy-h">ปริมาณงานตาม BOQ <small class="muted">บันทึกเป็นความคืบหน้าของวันนี้แล้ว</small></h3>${table(['รายการ BOQ', 'ปริมาณ'], boqRows.map(([it, q]) => `<tr><td>${esc(`${it.no ? `${it.no} ` : ''}${it.desc}`)}</td><td class="r num">${esc(`${(+q).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ${it.unit || ''}`)}</td></tr>`))}` : ''}
    ${(d.request || []).length ? `<h3 class="dy-h">งานที่ขอทำวันถัดไป (Daily Request)</h3>${table(['รายละเอียดของงาน', 'ปริมาณ', 'ช่าง/คนงาน'], d.request.map((r) => `<tr><td>${esc(r.work)}</td><td class="r num">${esc(qtyText(r.qty, r.unit))}</td><td class="r num">${esc(r.men ?? '')}</td></tr>`))}` : ''}
    ${mats.length ? `<h3 class="dy-h">วัสดุเข้าหน่วยงาน</h3>${table(['ชนิด', 'ปริมาณ'], mats.map(([w, q, u]) => `<tr><td>${esc(w)}</td><td class="r num">${esc(qtyText(q, u))}</td></tr>`))}` : ''}
    ${[['ความปลอดภัย/อุบัติเหตุ', d.safety], ['ข้อสั่งการ/ข้อแนะนำต่อผู้รับจ้าง', d.instructions]]
    .filter(([, v]) => v).map(([k, v]) => `<h3 class="dy-h">${esc(k)}</h3><div class="dy-text">${esc(v)}</div>`).join('')}
    ${files.length ? `<h3 class="dy-h">ภาพประกอบ (${files.length})</h3><div class="dy-figs">${files.map((f, i) => `<figure><button class="fthumb" data-f="${esc(f.id)}" title="${esc(f.name)}"><img alt="" data-thumb="${esc(f.id)}"></button><figcaption><b>รูปที่ ${i + 1}</b> ${esc(d.captions?.[f.id] || '')}</figcaption></figure>`).join('')}</div>` : ''}
  </section>`;
  el.querySelector('[data-act="print"]').addEventListener('click', () => openForm('daily', { p, daily: d }));
  el.querySelector('[data-act="instr"]')?.addEventListener('click', () => openForm('instruction', { p, daily: d }));
  el.querySelector('[data-act="cdaily"]')?.addEventListener('click', () => openForm('cdaily', { p, daily: d }));
  el.querySelector('[data-act="mat"]')?.addEventListener('click', () => openForm('material', { p, date: d.date }));
  el.querySelector('[data-act="mail"]')?.addEventListener('click', () => openReportDialog('daily', { projectId: p.id, date: d.date }));
  el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => preview(files.find((f) => f.id === b.dataset.f))));
  loadThumbs(el, files);
  el.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
    if (!(await confirmBox({ title: 'ลบรายงานประจำวัน', message: `ลบรายงานวันที่ ${esc(fmt.dateLong(d.date))}?${linked ? ' ปริมาณงานตาม BOQ ที่บันทึกพร้อมรายงานนี้จะถูกลบด้วย' : ''} (รูปถ่ายยังอยู่ในแท็บเอกสาร)`, ok: 'ลบ', danger: true }))) return;
    try { await store.deleteDaily(d.id); toast('ลบรายงานแล้ว'); location.hash = `#/p/${pid}/daily`; } catch (ex) { toast(ex.message, 'bad'); }
  });
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

function renderEditor(el, ctx, date, existing) {
  const { p } = ctx;
  const pid = encodeURIComponent(p.id);
  const key = `${p.id}|${date}|${existing?.id || 'new'}`;
  const filesById = (id) => store.data.files.find((f) => f.id === id);
  if (ed.key !== key || !ed.items) {
    ed.key = key;
    // รูปเดิม (เรียงตามรายงาน) + รูปใหม่ที่ยังไม่บันทึก — มีคำบรรยายใต้ภาพและย้ายลำดับได้
    ed.items = (existing?.files || []).filter(filesById).map((id) => ({ id, caption: existing.captions?.[id] || '' }));
  }
  const last = store.dailyOf(p.id).find((x) => x.date < date);
  const d = existing || { weather: {}, manpower: [], equipment: [], stoppage: {}, request: [], workHours: last?.workHours || '08:00–17:00' };
  const W = Object.entries(R.WEATHER);
  const notifyTo = R.reportRecipients(p, 'daily', true).filter((e) => e !== R.norm(store.me.email));
  const voc = learned(p.id);
  const sug = (k) => suggestions(p.id, k, voc);
  const boq = store.boqOf(p.id);
  const linked = store.dailyUpdate(existing);
  const outdated = store.serverOutdated('1.0.14');
  const blank = (o) => [o];
  const st = {
    manpower: d.manpower.length ? d.manpower.map((r) => ({ trade: tradeLabel(r.trade), count: r.count })) : blank({ trade: '', count: '' }),
    equipment: d.equipment.length ? d.equipment.map((r) => ({ ...r })) : blank({ name: '', count: '' }),
    work: linesOf(d.work).map(splitLine).map(([w, q, u]) => ({ w, q, u })),
    mats: linesOf(d.materials).map(splitLine).map(([w, q, u]) => ({ w, q, u })),
    req: (d.request || []).map((r) => ({ w: r.work, q: r.qty, u: r.unit, m: r.men })),
    boq: Object.entries(linked?.entries || {}).map(([id, q]) => ({ id, q })),
  };
  if (!st.work.length) st.work = blank({ w: '', q: '', u: '' });
  if (!st.mats.length) st.mats = blank({ w: '', q: '', u: '' });
  if (!st.req.length) st.req = blank({ w: '', q: '', u: '', m: '' });
  if (!st.boq.length) st.boq = blank({ id: '', q: '' });
  const groups = [...new Set(boq.map((b) => b.group || 'ไม่ระบุหมวด'))];
  const boqOptions = (sel) => `<option value="">— เลือกรายการ BOQ —</option>${groups.map((g) => `<optgroup label="${esc(g)}">${boq.filter((b) => (b.group || 'ไม่ระบุหมวด') === g).map((b) => `<option value="${esc(b.id)}" ${b.id === sel ? 'selected' : ''}>${esc(`${b.no ? `${b.no} ` : ''}${b.desc}${b.unit ? ` (${b.unit})` : ''}`)}</option>`).join('')}</optgroup>`).join('')}`;
  const COLS = {
    'dy-mp': [{ k: 'trade', ph: 'ตำแหน่ง/ประเภทช่าง', list: 'dl-trade', label: 'ตำแหน่ง' }, { k: 'count', ph: 'จำนวน', type: 'number', w: '90px', label: 'จำนวนคน' }],
    'dy-eq': [{ k: 'name', ph: 'เครื่องจักร/เครื่องมือ', list: 'dl-equip', label: 'เครื่องจักร' }, { k: 'count', ph: 'จำนวน', type: 'number', w: '90px', label: 'จำนวนเครื่อง' }],
    'dy-work': [{ k: 'w', ph: 'รายละเอียดของงาน เช่น เทคอนกรีตฐานราก F1–F4', list: 'dl-work', label: 'รายละเอียดของงาน' }, { k: 'q', ph: 'ปริมาณ', w: '90px', label: 'ปริมาณ' }, { k: 'u', ph: 'หน่วย', list: 'dl-unit', w: '96px', label: 'หน่วย' }],
    'dy-boq': [{ k: 'id', ph: 'รายการ BOQ', type: 'select', options: boqOptions, label: 'รายการ BOQ' }, { k: 'q', ph: 'ปริมาณ', type: 'number', w: '110px', label: 'ปริมาณที่ทำได้วันนี้' }],
    'dy-req': [{ k: 'w', ph: 'งานที่จะทำ', list: 'dl-req', label: 'งานที่ขอทำ' }, { k: 'q', ph: 'ปริมาณ', w: '80px', label: 'ปริมาณ' }, { k: 'u', ph: 'หน่วย', list: 'dl-unit', w: '88px', label: 'หน่วย' }, { k: 'm', ph: 'ช่าง/คน', type: 'number', w: '80px', label: 'ช่างและคนงาน' }],
    'dy-mat': [{ k: 'w', ph: 'ชนิดวัสดุ', list: 'dl-mat', label: 'ชนิดวัสดุ' }, { k: 'q', ph: 'ปริมาณ', w: '80px', label: 'ปริมาณ' }, { k: 'u', ph: 'หน่วย', list: 'dl-unit', w: '88px', label: 'หน่วย' }],
  };
  const STATE = { 'dy-mp': 'manpower', 'dy-eq': 'equipment', 'dy-work': 'work', 'dy-boq': 'boq', 'dy-req': 'req', 'dy-mat': 'mats' };
  const dl = (id, list) => `<datalist id="${id}">${list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>`;
  el.innerHTML = `
  <form class="panel upd dy-form" id="dyf" novalidate>
    <header class="upd-head">
      <div><h2>${existing ? 'แก้ไขรายงานประจำวัน' : 'บันทึกรายงานประจำวัน'}</h2><p class="muted">กรอกครั้งเดียว — ข้อมูลนี้ใช้ในแบบ FM-002 บันทึกการควบคุมงานประจำวัน · PT-F07 Daily Report and Daily Request · รายงานประจำสัปดาห์ และกราฟ S-Curve</p></div>
      <label class="field field-inline"><span>วันที่</span><input type="date" name="date" value="${esc(date)}" max="${esc(R.addDaysIso(today(), 1))}" required></label>
    </header>
    ${outdated ? `<p class="notice notice-warn">${icon('alert')}<span>Code.gs ยังเป็นเวอร์ชัน ${esc(store.meta.version || 'เก่า')} — คำบรรยายรูป ลำดับรูป และงานที่ขอทำวันถัดไปจะบันทึกได้หลังผู้ดูแลวาง Code.gs 1.0.14</span></p>` : ''}
    <div class="form-grid">
      <div class="field"><span>อากาศช่วงเช้า</span><div class="seg seg-sm dy-wx">${W.map(([k, l]) => `<label><input type="radio" name="am" value="${k}" ${d.weather?.am === k ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div></div>
      <div class="field"><span>อากาศช่วงบ่าย</span><div class="seg seg-sm dy-wx">${W.map(([k, l]) => `<label><input type="radio" name="pm" value="${k}" ${d.weather?.pm === k ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div></div>
      <div class="field dy-night"><span>กลางคืน (18.00–06.00 น.) และฝุ่น</span><div class="dy-inl">
        <select name="night" aria-label="อากาศกลางคืน"><option value="">— ไม่ระบุ —</option>${W.map(([k, l]) => `<option value="${k}" ${d.weather?.night === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <input name="pm25" type="number" min="0" max="1000" step="1" inputmode="numeric" value="${esc(d.weather?.pm25 ?? '')}" placeholder="PM2.5" aria-label="PM2.5 ไมโครกรัมต่อลูกบาศก์เมตร"><small class="muted">µg/m³</small></div></div>
      <label class="field"><span>เวลาทำงาน</span><input name="workHours" value="${esc(d.workHours || '')}" maxlength="40" placeholder="เช่น 08:00–17:00, OT ถึง 20:00"></label>
      <div class="field span-2 dy-copy">${last && !existing ? `<button type="button" class="btn btn-sm" data-act="copy" title="คัดลอกคนงานและเครื่องจักรจากรายงานวันที่ ${esc(fmt.date(last.date))}">${icon('copy')}คัดลอกคนงาน/เครื่องจักรจาก ${esc(fmt.date(last.date))}</button>` : ''}</div>
      <div class="field"><span>ผู้ปฏิบัติงาน/คนงาน <b id="dy-men" class="num"></b></span>${rowsBox('dy-mp', COLS['dy-mp'], st.manpower)}</div>
      <div class="field"><span>เครื่องจักร/เครื่องมือ</span>${rowsBox('dy-eq', COLS['dy-eq'], st.equipment)}</div>
      <div class="field span-2"><span>งานที่ดำเนินการ <small class="muted">ทีละรายการ ใส่ปริมาณและหน่วยถ้ามี — ตาราง "รายละเอียดของงาน / ปริมาณงาน" ในแบบฟอร์ม</small></span>${rowsBox('dy-work', COLS['dy-work'], st.work, 'เพิ่มรายการ')}</div>
      ${boq.length ? `<div class="field span-2"><span>ปริมาณงานตาม BOQ วันนี้ <small class="muted">บันทึกเป็นความคืบหน้าของวันนี้ให้ด้วย — ใช้คิดเปอร์เซ็นต์ผลงาน รายงานประจำสัปดาห์ และ S-Curve (ไม่ต้องพิมพ์ซ้ำในงานที่ดำเนินการ)</small></span>${rowsBox('dy-boq', COLS['dy-boq'], st.boq, 'เพิ่มรายการ BOQ')}</div>` : ''}
      <div class="field span-2"><span>งานที่ผู้รับจ้างขอทำวันถัดไป <small class="muted">Daily Request ในแบบ PT-F07</small></span>${rowsBox('dy-req', COLS['dy-req'], st.req, 'เพิ่มงาน')}</div>
      <div class="field"><span>วัสดุที่นำเข้าหน่วยงาน</span>${rowsBox('dy-mat', COLS['dy-mat'], st.mats, 'เพิ่มวัสดุ')}</div>
      <div class="field"><span>การหยุดงาน</span>
        <label class="check"><input type="checkbox" name="stopped" ${d.stoppage?.stopped ? 'checked' : ''}>มีการหยุดงาน/งานล่าช้า</label>
        <div class="dy-stop" ${d.stoppage?.stopped ? '' : 'hidden'}><input name="hours" type="number" min="0" max="24" step="0.5" value="${esc(d.stoppage?.hours || '')}" placeholder="ชั่วโมง" aria-label="จำนวนชั่วโมง"><input name="reason" value="${esc(d.stoppage?.reason || '')}" maxlength="500" placeholder="สาเหตุ เช่น ฝนตกหนัก รอวัสดุ" aria-label="สาเหตุ"></div></div>
      <label class="field"><span>ความปลอดภัย/อุบัติเหตุ</span><textarea name="safety" rows="2" maxlength="2000" placeholder="ถ้าไม่มีให้เว้นว่าง">${esc(d.safety || '')}</textarea></label>
      <label class="field"><span>ข้อสั่งการ/ข้อแนะนำต่อผู้รับจ้าง <small class="muted">ช่อง "การแก้ไข" ใน FM-002</small></span><textarea name="instructions" rows="2" maxlength="2000" placeholder="พิมพ์เป็นใบสั่งการ (PT-F06) ได้">${esc(d.instructions || '')}</textarea></label>
      <div class="field span-2"><span>ภาพประกอบ <small class="muted">เรียงลำดับและบรรยายใต้ภาพ เช่น "รูปที่ 1 ดำเนินการผูกเหล็ก" · กด "มาร์ค" เพื่อวาดหรือเขียนโน้ตบนรูปใหม่</small></span>
        <label class="drop drop-sm" id="dy-drop">${icon('image')}<b>เลือกรูปหรือลากมาวาง</b><input type="file" accept="image/*" multiple hidden id="dy-photos"></label>
        <ol class="dy-photos" id="dy-list"></ol></div>
    </div>
    ${dl('dl-trade', sug('trade'))}${dl('dl-equip', sug('equip'))}${dl('dl-work', sug('work'))}${dl('dl-req', sug('req').concat(sug('work')))}${dl('dl-mat', sug('mat'))}${dl('dl-unit', sug('unit'))}${dl('dl-cap', sug('cap'))}
    <footer class="upd-foot">
      ${notifyTo.length ? `<label class="check upd-notify" title="${esc(notifyTo.map((e) => personName(p, e)).join(', '))}"><input type="checkbox" id="dy-notify">${icon('mail')}ส่งรายงานนี้ทางอีเมลทันที ${notifyTo.length} คน</label>` : ''}
      <a class="btn" href="#/p/${pid}/daily${existing ? `/${existing.date}` : ''}" data-act="cancel">ยกเลิก</a>
      <button class="btn btn-primary" type="submit" data-act="save">${icon('check')}บันทึก</button>
    </footer>
  </form>`;
  const form = el.querySelector('#dyf');
  const box = (id) => el.querySelector(`#${id}`);
  const read = (id) => { if (box(id)) st[STATE[id]] = readRowsOf(box(id)); };
  const draw = (id) => {
    const b = box(id);
    if (!b) return;
    b.innerHTML = st[STATE[id]].map((r, i) => rowHTML(COLS[id], r, i)).join('');
  };
  const total = () => {
    read('dy-mp');
    const n = st.manpower.reduce((a, r) => a + Math.max(0, Math.round(+r.count || 0)), 0);
    el.querySelector('#dy-men').textContent = n ? `รวม ${n} คน` : '';
  };
  total();
  el.querySelector('#dy-mp').addEventListener('input', total);
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
      st[STATE[id]].push({});
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
    const nextIn = [...rowEl.querySelectorAll('[data-k]')].find((x, i, arr) => arr.indexOf(inp) < i);
    if (nextIn) { nextIn.focus(); return; }
    const b = rowEl.closest('.dy-rows');
    if (rowEl.nextElementSibling) { rowEl.nextElementSibling.querySelector('[data-k]')?.focus(); return; }
    read(b.id); st[STATE[b.id]].push({}); draw(b.id);
    b.querySelector('.dy-row:last-of-type [data-k]')?.focus();
  });
  el.querySelector('[data-act="copy"]')?.addEventListener('click', () => {
    st.manpower = last.manpower.length ? last.manpower.map((r) => ({ trade: tradeLabel(r.trade), count: r.count })) : [{}];
    st.equipment = last.equipment.length ? last.equipment.map((r) => ({ ...r })) : [{}];
    draw('dy-mp'); draw('dy-eq'); total();
    if (!form.elements.workHours.value) form.elements.workHours.value = last.workHours || '';
    guard.dirty = true;
  });
  form.addEventListener('input', () => { guard.dirty = true; });
  form.elements.stopped.addEventListener('change', (e) => { el.querySelector('.dy-stop').hidden = !e.target.checked; });
  form.elements.date.addEventListener('change', () => {
    const v = form.elements.date.value;
    const other = v && store.dailyAt(p.id, v);
    if (other && other.id !== existing?.id) toast(`มีรายงานของวันที่ ${fmt.dateLong(v)} แล้ว — เปิดรายงานเดิมเพื่อแก้ไข`, 'bad', 5000);
  });

  // ---------- ภาพประกอบ: ลำดับ คำบรรยาย มาร์ค ----------
  const list = el.querySelector('#dy-list');
  const readCaps = () => list.querySelectorAll('[data-cap]').forEach((x) => { if (ed.items[+x.dataset.cap]) ed.items[+x.dataset.cap].caption = x.value; });
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    Object.keys(STATE).forEach(read);
    readCaps();
    const f = form.elements;
    const newFiles = [];
    const tokens = ed.items.map((it) => { if (it.file) { newFiles.push(it.file); return `new:${newFiles.length - 1}`; } return it.id; });
    const captions = {};
    ed.items.forEach((it, i) => { if (String(it.caption || '').trim()) captions[tokens[i]] = it.caption.trim(); });
    const boqEntries = {};
    st.boq.forEach((r) => { if (r.id && +r.q) boqEntries[r.id] = (boqEntries[r.id] || 0) + +r.q; });
    const input = {
      ...(existing || {}), projectId: p.id, date: f.date.value,
      weather: { am: form.querySelector('[name="am"]:checked')?.value || '', pm: form.querySelector('[name="pm"]:checked')?.value || '', night: f.night.value, pm25: f.pm25.value.trim() },
      workHours: f.workHours.value.trim(),
      manpower: st.manpower.filter((r) => String(r.trade || '').trim()).map((r) => ({ trade: tradeLabel(r.trade), count: r.count })),
      equipment: st.equipment.filter((r) => String(r.name || '').trim()).map((r) => ({ name: r.name.trim(), count: r.count })),
      work: st.work.map((r) => joinLine(r.w, r.q, r.u)).filter(Boolean).join('\n'),
      materials: st.mats.map((r) => joinLine(r.w, r.q, r.u)).filter(Boolean).join('\n'),
      request: st.req.filter((r) => String(r.w || '').trim()).map((r) => ({ work: r.w.trim(), qty: String(r.q || '').trim(), unit: String(r.u || '').trim(), men: r.m })),
      stoppage: { stopped: f.stopped.checked, hours: f.hours.value, reason: f.reason.value.trim() },
      safety: f.safety.value.trim(), instructions: f.instructions.value.trim(),
      files: tokens, captions,
      ...(boq.length ? { boq: boqEntries } : {}),
    };
    if (!input.date) { toast('กรุณาระบุวันที่', 'bad'); return; }
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
      else toast(`บันทึกรายงานประจำวันแล้ว${mailNote(saved._mail, store.mode)}`, saved._mail?.error ? 'bad' : 'ok', 5000);
      location.hash = `#/p/${pid}/daily/${saved.date}`;
    } catch (ex) {
      toast(ex.message, 'bad', 6000);
      setBusy(btn, false);
    }
  });
}
