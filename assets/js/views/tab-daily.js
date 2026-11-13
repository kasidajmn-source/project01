// แท็บรายงานประจำวัน (1.0.5): ผู้ควบคุมงานบันทึกสภาพการปฏิบัติงานรายวัน (ระเบียบกระทรวงการคลังฯ ข้อ 178)
// และส่งรายงานประจำวัน/ประจำสัปดาห์ทางอีเมล พิมพ์แบบฟอร์มมาตรฐาน PT-F02/F03/F05/F06
import { store } from '../store.js';
import { esc, fmt, icon, emptyState, toast, confirmBox, setBusy, guard, menu } from '../ui.js';
import { mailNote, personName } from './common.js';
import { openForm } from '../forms.js';
import { libraryBox, bindLibraryBox } from './library.js';
import { openReportDialog } from './reports.js';
import { preview } from './tab-docs.js';

const R = globalThis.PTRules;
const TRADES = ['โฟร์แมน', 'วิศวกร', 'ช่างไม้', 'ช่างเหล็ก', 'ช่างปูน', 'ช่างเชื่อม', 'ช่างไฟฟ้า', 'ช่างประปา', 'ช่างทาสี', 'กรรมกร'];
const EQUIP = ['รถแบคโฮ', 'รถเครน', 'รถบรรทุก', 'รถโม่คอนกรีต', 'ปั๊มคอนกรีต', 'รถบดอัด', 'เครื่องตบดิน', 'เครื่องปั่นไฟ', 'นั่งร้าน (ชุด)'];
const ed = { key: '', photos: [] };
window.addEventListener('pt:discard', () => { ed.key = ''; });

const today = () => store.thaiNow().date;
const weatherText = (d) => [R.WEATHER[d.weather?.am] && `เช้า${R.WEATHER[d.weather.am]}`, R.WEATHER[d.weather?.pm] && `บ่าย${R.WEATHER[d.weather.pm]}`].filter(Boolean).join(' · ') || '–';

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
    ['daily', 'แบบรายงานประจำวัน (เปล่า)', { p, date: t }],
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
          <td class="nowrap"><a class="link" href="#/p/${pid}/daily/${d.date}"><b>${fmt.date(d.date)}</b></a><small class="dy-by" title="${esc(d.createdBy || '')}">${esc(String(d.createdBy || '').replace(/\s*\(.*\)$/, ''))}</small></td>
          <td class="nowrap" data-l="อากาศ">${esc(weatherText(d))}</td>
          <td class="r num" data-l="คนงาน">${R.manpowerTotal(d)}</td>
          <td class="c-note">${esc(String(d.work || '').slice(0, 140))}${(d.files || []).length ? ` <span class="muted small">${icon('image')}${d.files.length}</span>` : ''}</td>
          <td class="dy-stopc" data-l="หยุดงาน">${d.stoppage?.stopped ? `<span class="t-issue">${icon('alert')}${esc(`${d.stoppage.hours ? `${d.stoppage.hours} ชม. ` : ''}${d.stoppage.reason || ''}`)}</span>` : '<span class="muted">–</span>'}</td>
          <td class="row-tools"><button class="icon-btn" data-print="${esc(d.id)}" title="พิมพ์ PT-F02" aria-label="พิมพ์">${icon('print')}</button>
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
  el.innerHTML = `
  <div class="toolbar">
    <div class="tb-info"><a class="link" href="#/p/${pid}/daily">${icon('chevL')}รายงานประจำวัน</a></div>
    <div class="tb-actions">
      ${prevD ? `<a class="btn btn-sm" href="#/p/${pid}/daily/${prevD.date}" title="วันก่อนหน้า">${icon('chevL')}${fmt.date(prevD.date)}</a>` : ''}
      ${nextD ? `<a class="btn btn-sm" href="#/p/${pid}/daily/${nextD.date}" title="วันถัดไป">${fmt.date(nextD.date)}${icon('chevR')}</a>` : ''}
      ${menu({ items: [
        { act: 'print', icon: 'print', label: 'พิมพ์รายงานประจำวัน PT-F02' },
        d.instructions && { act: 'instr', icon: 'print', label: 'พิมพ์ใบสั่งการ PT-F06' },
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
      ${row('คนงาน', `<b>${R.manpowerTotal(d)} คน</b>${d.manpower.length ? ` <small class="muted">(${esc(d.manpower.map((r) => `${r.trade} ${r.count}`).join(', '))})</small>` : ''}`)}
      ${row('เครื่องจักร', esc(d.equipment.map((r) => `${r.name} ${r.count}`).join(', ')))}
      ${d.stoppage?.stopped ? row('หยุดงาน', `<b class="is-bad">${esc(`${d.stoppage.hours ? `${d.stoppage.hours} ชั่วโมง ` : ''}${d.stoppage.reason || ''}`)}</b>`) : ''}
    </dl>
    ${[['งานที่ดำเนินการ', d.work], ['วัสดุเข้าหน่วยงาน', d.materials], ['ความปลอดภัย/อุบัติเหตุ', d.safety], ['ข้อสั่งการ/ข้อแนะนำต่อผู้รับจ้าง', d.instructions]]
    .filter(([, v]) => v).map(([k, v]) => `<h3 class="dy-h">${esc(k)}</h3><div class="dy-text">${esc(v)}</div>`).join('')}
    ${files.length ? `<h3 class="dy-h">รูปถ่าย (${files.length})</h3><div class="thumbs dy-thumbs">${files.map((f) => `<button class="fthumb" data-f="${esc(f.id)}" title="${esc(f.name)}"><img alt="" data-thumb="${esc(f.id)}"></button>`).join('')}</div>` : ''}

  </section>`;
  el.querySelector('[data-act="print"]').addEventListener('click', () => openForm('daily', { p, daily: d }));
  el.querySelector('[data-act="instr"]')?.addEventListener('click', () => openForm('instruction', { p, daily: d }));
  el.querySelector('[data-act="mail"]')?.addEventListener('click', () => openReportDialog('daily', { projectId: p.id, date: d.date }));
  el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => preview(files.find((f) => f.id === b.dataset.f))));
  el.querySelectorAll('[data-thumb]').forEach(async (img) => {
    const f = files.find((x) => x.id === img.dataset.thumb);
    try { const u = await store.thumbUrl(f); if (u) img.src = u; } catch { /* ignore */ }
  });
  el.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
    if (!(await confirmBox({ title: 'ลบรายงานประจำวัน', message: `ลบรายงานวันที่ ${esc(fmt.dateLong(d.date))}? (รูปถ่ายยังอยู่ในแท็บเอกสาร)`, ok: 'ลบ', danger: true }))) return;
    try { await store.deleteDaily(d.id); toast('ลบรายงานแล้ว'); location.hash = `#/p/${pid}/daily`; } catch (ex) { toast(ex.message, 'bad'); }
  });
}

// ---------- ฟอร์มบันทึก ----------
function rowsHTML(list, kind) {
  const opts = kind === 'manpower' ? TRADES : EQUIP;
  const key = kind === 'manpower' ? 'trade' : 'name';
  return list.map((r, i) => `<div class="dy-row" data-row="${i}">
    <input data-k="${key}" value="${esc(r[key] || '')}" list="dl-${kind}" placeholder="${kind === 'manpower' ? 'ประเภทช่าง/แรงงาน' : 'เครื่องจักร/เครื่องมือ'}" aria-label="${kind === 'manpower' ? 'ประเภทช่าง' : 'เครื่องจักร'}">
    <input data-k="count" type="number" min="0" step="1" inputmode="numeric" value="${r.count === '' || r.count == null ? '' : esc(r.count)}" placeholder="จำนวน" aria-label="จำนวน">
    <button type="button" class="icon-btn" data-rm="${i}" aria-label="ลบแถว">${icon('x')}</button></div>`).join('')
    + `<datalist id="dl-${kind}">${opts.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>`;
}

function renderEditor(el, ctx, date, existing) {
  const { p } = ctx;
  const pid = encodeURIComponent(p.id);
  const key = `${p.id}|${date}|${existing?.id || 'new'}`;
  if (ed.key !== key) { ed.key = key; ed.photos = []; }
  const last = store.dailyOf(p.id).find((x) => x.date < date);
  const d = existing || { weather: {}, manpower: [], equipment: [], stoppage: {}, workHours: last?.workHours || '08:00–17:00' };
  const W = Object.entries(R.WEATHER);
  const notifyTo = R.reportRecipients(p, 'daily', true).filter((e) => e !== R.norm(store.me.email));
  const state = {
    manpower: d.manpower.length ? d.manpower.map((r) => ({ ...r })) : [{ trade: '', count: '' }],
    equipment: d.equipment.length ? d.equipment.map((r) => ({ ...r })) : [{ name: '', count: '' }],
  };
  el.innerHTML = `
  <form class="panel upd dy-form" id="dyf" novalidate>
    <header class="upd-head">
      <div><h2>${existing ? 'แก้ไขรายงานประจำวัน' : 'บันทึกรายงานประจำวัน'}</h2><p class="muted">บันทึกสภาพการปฏิบัติงานของผู้รับจ้างและเหตุการณ์แวดล้อม — สรุปเป็นรายงานประจำสัปดาห์ให้คณะกรรมการตรวจรับพัสดุ</p></div>
      <label class="field field-inline"><span>วันที่</span><input type="date" name="date" value="${esc(date)}" max="${esc(R.addDaysIso(today(), 1))}" required></label>
    </header>
    <div class="form-grid">
      <div class="field"><span>อากาศช่วงเช้า</span><div class="seg seg-sm dy-wx">${W.map(([k, l]) => `<label><input type="radio" name="am" value="${k}" ${d.weather?.am === k ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div></div>
      <div class="field"><span>อากาศช่วงบ่าย</span><div class="seg seg-sm dy-wx">${W.map(([k, l]) => `<label><input type="radio" name="pm" value="${k}" ${d.weather?.pm === k ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div></div>
      <label class="field"><span>เวลาทำงาน</span><input name="workHours" value="${esc(d.workHours || '')}" maxlength="40" placeholder="เช่น 08:00–17:00, OT ถึง 20:00"></label>
      <div class="field dy-copy">${last && !existing ? `<button type="button" class="btn btn-sm" data-act="copy" title="คัดลอกคนงานและเครื่องจักรจากรายงานวันที่ ${esc(fmt.date(last.date))}">${icon('copy')}คัดลอกคนงาน/เครื่องจักรจาก ${esc(fmt.date(last.date))}</button>` : ''}</div>
      <div class="field"><span>คนงาน <b id="dy-men" class="num"></b></span><div id="dy-mp" class="dy-rows"></div><button type="button" class="btn btn-sm btn-ghost" data-add="manpower">${icon('plus')}เพิ่มแถว</button></div>
      <div class="field"><span>เครื่องจักร/เครื่องมือ</span><div id="dy-eq" class="dy-rows"></div><button type="button" class="btn btn-sm btn-ghost" data-add="equipment">${icon('plus')}เพิ่มแถว</button></div>
      <label class="field span-2"><span>งานที่ดำเนินการ</span><textarea name="work" rows="4" maxlength="4000" placeholder="เช่น เทคอนกรีตฐานราก F1–F4 (12 ลบ.ม.) ผูกเหล็กเสาชั้น 1 แนว A">${esc(d.work || '')}</textarea></label>
      <label class="field"><span>วัสดุที่นำเข้าหน่วยงาน</span><textarea name="materials" rows="2" maxlength="2000" placeholder="เช่น เหล็ก DB16 2 ตัน (ตรวจใบรับรองแล้ว)">${esc(d.materials || '')}</textarea></label>
      <div class="field"><span>การหยุดงาน</span>
        <label class="check"><input type="checkbox" name="stopped" ${d.stoppage?.stopped ? 'checked' : ''}>มีการหยุดงาน/งานล่าช้า</label>
        <div class="dy-stop" ${d.stoppage?.stopped ? '' : 'hidden'}><input name="hours" type="number" min="0" max="24" step="0.5" value="${esc(d.stoppage?.hours || '')}" placeholder="ชั่วโมง" aria-label="จำนวนชั่วโมง"><input name="reason" value="${esc(d.stoppage?.reason || '')}" maxlength="500" placeholder="สาเหตุ เช่น ฝนตกหนัก รอวัสดุ" aria-label="สาเหตุ"></div></div>
      <label class="field"><span>ความปลอดภัย/อุบัติเหตุ</span><textarea name="safety" rows="2" maxlength="2000" placeholder="ถ้าไม่มีให้เว้นว่าง">${esc(d.safety || '')}</textarea></label>
      <label class="field"><span>ข้อสั่งการ/ข้อแนะนำต่อผู้รับจ้าง</span><textarea name="instructions" rows="2" maxlength="2000" placeholder="พิมพ์เป็นใบสั่งการ (PT-F06) ได้">${esc(d.instructions || '')}</textarea></label>
      <div class="field span-2"><span>รูปถ่ายหน้างาน <small class="muted">เก็บในหมวด "รูปถ่ายความคืบหน้า"${existing?.files?.length ? ` · มีแล้ว ${existing.files.length} รูป` : ''}</small></span>
        <label class="drop drop-sm" id="dy-drop">${icon('image')}<b>เลือกรูปหรือลากมาวาง</b><input type="file" accept="image/*" multiple hidden id="dy-photos"></label>
        <div class="thumbs" id="dy-thumbs"></div></div>
    </div>
    <footer class="upd-foot">
      ${notifyTo.length ? `<label class="check upd-notify" title="${esc(notifyTo.map((e) => personName(p, e)).join(', '))}"><input type="checkbox" id="dy-notify">${icon('mail')}ส่งรายงานนี้ทางอีเมลทันที ${notifyTo.length} คน</label>` : ''}
      <a class="btn" href="#/p/${pid}/daily${existing ? `/${existing.date}` : ''}" data-act="cancel">ยกเลิก</a>
      <button class="btn btn-primary" type="submit" data-act="save">${icon('check')}บันทึก</button>
    </footer>
  </form>`;
  const form = el.querySelector('#dyf');
  const readRows = (kind) => {
    const box = el.querySelector(kind === 'manpower' ? '#dy-mp' : '#dy-eq');
    state[kind] = [...box.querySelectorAll('.dy-row')].map((r) => {
      const o = {};
      r.querySelectorAll('[data-k]').forEach((i) => { o[i.dataset.k] = i.value; });
      return o;
    });
  };
  const drawRows = (kind) => {
    const box = el.querySelector(kind === 'manpower' ? '#dy-mp' : '#dy-eq');
    box.innerHTML = rowsHTML(state[kind], kind);
    box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { readRows(kind); state[kind].splice(+b.dataset.rm, 1); drawRows(kind); total(); guard.dirty = true; }));
  };
  const total = () => {
    readRows('manpower');
    const n = state.manpower.reduce((s, r) => s + (Math.max(0, Math.round(+r.count || 0))), 0);
    el.querySelector('#dy-men').textContent = n ? `รวม ${n} คน` : '';
  };
  drawRows('manpower'); drawRows('equipment'); total();
  el.querySelector('#dy-mp').addEventListener('input', total);
  el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const kind = b.dataset.add;
    readRows(kind);
    state[kind].push(kind === 'manpower' ? { trade: '', count: '' } : { name: '', count: '' });
    drawRows(kind);
    el.querySelector(`${kind === 'manpower' ? '#dy-mp' : '#dy-eq'} .dy-row:last-of-type input`)?.focus();
  }));
  el.querySelector('[data-act="copy"]')?.addEventListener('click', () => {
    state.manpower = last.manpower.map((r) => ({ ...r }));
    state.equipment = last.equipment.map((r) => ({ ...r }));
    if (!state.manpower.length) state.manpower = [{ trade: '', count: '' }];
    if (!state.equipment.length) state.equipment = [{ name: '', count: '' }];
    drawRows('manpower'); drawRows('equipment'); total();
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
  // รูปถ่าย
  const drawThumbs = () => {
    const box = el.querySelector('#dy-thumbs');
    box.innerHTML = ed.photos.map((f, i) => `<figure><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="icon-btn" data-rmp="${i}" aria-label="เอาออก">${icon('x')}</button><figcaption>${esc(f.name)}</figcaption></figure>`).join('');
    box.querySelectorAll('[data-rmp]').forEach((b) => b.addEventListener('click', () => { ed.photos.splice(+b.dataset.rmp, 1); drawThumbs(); }));
  };
  const addPhotos = (list) => { guard.dirty = true; ed.photos.push(...[...list].filter((f) => f.type.startsWith('image/'))); drawThumbs(); };
  const drop = el.querySelector('#dy-drop');
  el.querySelector('#dy-photos').addEventListener('change', (e) => addPhotos(e.target.files));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); addPhotos(e.dataTransfer.files); });
  drawThumbs();
  el.querySelector('[data-act="cancel"]').addEventListener('click', () => { guard.dirty = false; ed.key = ''; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    readRows('manpower'); readRows('equipment');
    const f = form.elements;
    const input = {
      ...(existing || {}), projectId: p.id, date: f.date.value,
      weather: { am: form.querySelector('[name="am"]:checked')?.value || '', pm: form.querySelector('[name="pm"]:checked')?.value || '' },
      workHours: f.workHours.value.trim(), manpower: state.manpower.filter((r) => String(r.trade || '').trim()).map((r) => ({ trade: r.trade.trim(), count: r.count })),
      equipment: state.equipment.filter((r) => String(r.name || '').trim()).map((r) => ({ name: r.name.trim(), count: r.count })),
      work: f.work.value.trim(), materials: f.materials.value.trim(),
      stoppage: { stopped: f.stopped.checked, hours: f.hours.value, reason: f.reason.value.trim() },
      safety: f.safety.value.trim(), instructions: f.instructions.value.trim(),
      files: existing?.files || [],
    };
    if (!input.date) { toast('กรุณาระบุวันที่', 'bad'); return; }
    const btn = el.querySelector('[data-act="save"]');
    setBusy(btn, true, 'กำลังบันทึก…');
    try {
      const saved = await store.saveDaily(input, ed.photos, {
        notify: !!el.querySelector('#dy-notify')?.checked,
        onProgress: (label) => { btn.innerHTML = `<span class="spin"></span>${esc(label)}…`; },
      });
      guard.dirty = false;
      ed.key = ''; ed.photos = [];
      toast(`บันทึกรายงานประจำวันแล้ว${mailNote(saved._mail, store.mode)}`, saved._mail?.error ? 'bad' : 'ok', 5000);
      location.hash = `#/p/${pid}/daily/${saved.date}`;
    } catch (ex) {
      toast(ex.message, 'bad', 6000);
      setBusy(btn, false);
    }
  });
}
