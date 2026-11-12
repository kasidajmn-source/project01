// ประชุม: นัดประชุม (แผนก / โครงการ / ภายใน กฟผ.) เชิญทางอีเมล เพิ่มลงปฏิทิน วาระ บันทึกการประชุม งานที่มอบหมาย และห้องความเห็น
import { store } from '../store.js';
import { esc, icon, toast, confirmBox, setBusy, openModal, emptyState, download, fmt } from '../ui.js';
import { pageHead, personName, mailNote } from './common.js';
import { mountRoom, richText } from './room.js';
import { openForm } from '../forms.js';
import { libraryBox, bindLibraryBox } from './library.js';

const R = globalThis.PTRules;
const nowLocal = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16); // เวลาไทย YYYY-MM-DDTHH:mm

// ---------- ปฏิทิน ----------
const toUtc = (local, addMin = 0) => new Date(Date.parse(`${local}:00+07:00`) + addMin * 60000);
const icsTime = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
function details(m) {
  return [m.link ? `ประชุมออนไลน์: ${m.link}` : '', m.agenda ? `วาระ:\n${m.agenda}` : '', `${location.href.split('#')[0]}#/meetings/${m.id}`].filter(Boolean).join('\n\n');
}
export function icsOf(m) {
  const s = toUtc(m.startAt), e = toUtc(m.startAt, +m.durationMin || 60);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ProjectTracker//TH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${m.id}@project-tracker`, `DTSTAMP:${icsTime(new Date())}`, `DTSTART:${icsTime(s)}`, `DTEND:${icsTime(e)}`,
    `SUMMARY:${icsEsc(m.title)}`, m.place ? `LOCATION:${icsEsc(m.place)}` : '', `DESCRIPTION:${icsEsc(details(m))}`,
    m.status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}
function calLinks(m) {
  const s = toUtc(m.startAt), e = toUtc(m.startAt, +m.durationMin || 60);
  const g = new URLSearchParams({ action: 'TEMPLATE', text: m.title, dates: `${icsTime(s)}/${icsTime(e)}`, details: details(m), location: m.place || m.link || '' });
  const o = new URLSearchParams({ subject: m.title, startdt: s.toISOString(), enddt: e.toISOString(), body: details(m), location: m.place || '' });
  return { google: `https://calendar.google.com/calendar/render?${g}`, outlook: `https://outlook.office.com/calendar/0/deeplink/compose?${o}` };
}

// ---------- รายการ ----------
function rowHTML(m) {
  const p = m.projectId ? store.project(m.projectId) : null;
  const open = (m.actions || []).filter((a) => !a.done).length;
  const past = m.startAt < nowLocal();
  return `<li class="mt-row ${m.status === 'cancelled' ? 'is-cancelled' : ''} ${past ? 'is-past' : ''}">
    <a href="#/meetings/${encodeURIComponent(m.id)}">
      <span class="mt-date"><b>${esc(m.startAt.slice(8, 10))}</b><small>${esc(fmt.date(m.startAt.slice(0, 10)).replace(/^\d+\s*/, ''))}</small></span>
      <span class="mt-main"><b>${esc(m.title)}</b>
        <small>${esc(m.startAt.slice(11, 16))} น. · ${esc(R.AUDIENCES[m.audience])}${p ? ` · ${esc(p.code || p.name)}` : ''}${m.place ? ` · ${esc(m.place)}` : ''}${m.link ? ' · ออนไลน์' : ''}</small></span>
      <span class="mt-state">${m.status !== 'scheduled' ? `<span class="chip ${m.status === 'done' ? 'chip-ok' : ''}">${esc(R.MEETING_STATUS[m.status])}</span>` : ''}${open ? `<span class="chip chip-warn">งานค้าง ${open}</span>` : ''}</span>
    </a></li>`;
}
function listHTML(list, empty) {
  const now = nowLocal();
  const up = list.filter((m) => m.startAt >= now.slice(0, 10) && m.status !== 'cancelled' && m.status !== 'done');
  const past = list.filter((m) => !up.includes(m)).reverse();
  return `${up.length ? `<h3 class="sub-h">นัดที่กำลังจะถึง</h3><ul class="mt-list">${up.map(rowHTML).join('')}</ul>` : `<p class="muted pad">${empty}</p>`}
    ${past.length ? `<h3 class="sub-h">ประชุมที่ผ่านมา</h3><ul class="mt-list">${past.map(rowHTML).join('')}</ul>` : ''}`;
}

export function renderMeetings(el, rawId = '') {
  if (store.legacy) {
    el.innerHTML = `${pageHead('ประชุม')}<section class="panel">${emptyState({ ic: 'calendar', title: 'ต้องอัปเดตระบบหลังบ้านก่อน', text: 'การประชุมต้องใช้ Code.gs เวอร์ชัน 1.0.4 ขึ้นไป' })}</section>`;
    return;
  }
  if (rawId) { renderDetail(el, decodeURIComponent(rawId)); return; }
  const me = store.me;
  const list = store.meetingsVisible();
  const canCreate = R.canCreateMeeting('dept', null, me) || store.visibleProjects().some((p) => R.canCreateMeeting('project', p, me));
  el.innerHTML = `
  ${pageHead('ประชุม', 'นัดประชุม ส่งอีเมลเชิญ วาระ บันทึกการประชุม และติดตามงานที่มอบหมาย', canCreate ? `<button class="btn btn-primary" data-act="new">${icon('plus')}นัดประชุม</button>` : '')}
  <section class="panel">${listHTML(list, 'ยังไม่มีนัดประชุม')}</section>`;
  el.querySelector('[data-act="new"]')?.addEventListener('click', () => openMeetingForm({}));
}

/** รายการประชุมในแท็บของโครงการ */
export function renderProjectMeetings(el, p) {
  const me = store.me;
  const list = store.meetingsVisible(p.id);
  const canCreate = R.canCreateMeeting('project', p, me);
  el.innerHTML = `<section class="panel">
    <header class="panel-head"><h2>ประชุมของโครงการ</h2>${canCreate ? `<button class="btn btn-sm btn-primary" data-act="new">${icon('plus')}นัดประชุม</button>` : ''}</header>
    ${listHTML(list, 'ยังไม่มีนัดประชุมของโครงการนี้')}</section>`;
  el.querySelector('[data-act="new"]')?.addEventListener('click', () => openMeetingForm({ pid: p.id }));
}

// ---------- ฟอร์มนัด/แก้ไข ----------
function candidates(audience, pid) {
  const out = new Map();
  const add = (email, name, tag) => { const e = R.norm(email); if (R.validEmail(e) && !out.has(e)) out.set(e, { email: e, name: name || store.nameOf(e) || e, tag }); };
  if (audience === 'dept') {
    for (const e of R.parseList(store.settings.deptMembers)) if (!e.startsWith('@')) add(e, '', 'สมาชิกแผนก');
    for (const e of R.parseList(store.settings.executives)) if (!e.startsWith('@')) add(e, '', 'ผู้บริหาร');
  } else {
    const p = store.project(pid);
    if (p) for (const m of R.members(p)) if (audience === 'project' || m.role !== 'contractor') add(m.email, m.name, R.ROLES[m.role]?.label || m.role);
  }
  return [...out.values()];
}

export function openMeetingForm({ pid = '', existing = null }) {
  const me = store.me;
  const m = existing;
  const projects = store.visibleProjects().filter((p) => R.canCreateMeeting('project', p, me));
  const canDept = R.canCreateMeeting('dept', null, me);
  const fixedPid = m ? m.projectId : pid;
  const audiences = m ? [m.audience] : Object.keys(R.AUDIENCES).filter((a) => (a === 'dept' ? canDept && !pid : projects.length));
  if (!audiences.length) { toast('คุณไม่มีสิทธิ์นัดประชุม', 'bad'); return; }
  const def = m || { audience: audiences.includes('internal') && pid ? 'project' : audiences[0], title: '', startAt: `${nowLocal().slice(0, 10)}T09:00`, durationMin: 60, place: '', link: '', attendees: [], agenda: '' };
  const md = openModal({
    title: m ? 'แก้ไขการประชุม' : 'นัดประชุม',
    size: 'lg',
    body: `<form class="form-grid" id="mf" novalidate>
      <label class="field"><span>ประเภท</span><select name="audience" ${m ? 'disabled' : ''}>${audiences.map((a) => `<option value="${a}" ${def.audience === a ? 'selected' : ''}>${esc(R.AUDIENCES[a])}</option>`).join('')}</select></label>
      <label class="field" data-pfield><span>โครงการ</span><select name="pid" ${fixedPid ? 'disabled' : ''}>${(fixedPid ? [store.project(fixedPid)].filter(Boolean) : projects).map((p) => `<option value="${esc(p.id)}" ${p.id === fixedPid ? 'selected' : ''}>${esc(p.code ? `${p.code} ${p.name}` : p.name)}</option>`).join('')}</select></label>
      <label class="field span-2"><span>หัวข้อการประชุม <em>*</em></span><input name="title" maxlength="200" value="${esc(def.title)}" placeholder="เช่น ประชุมติดตามความก้าวหน้า ครั้งที่ 5" required></label>
      <label class="field"><span>วันที่ <em>*</em></span><input type="date" name="date" value="${esc(def.startAt.slice(0, 10))}"></label>
      <div class="field"><span>เวลา</span><div class="row-inline"><input type="time" name="time" value="${esc(def.startAt.slice(11, 16))}">
        <select name="dur" aria-label="ระยะเวลา">${[30, 60, 90, 120, 180, 240].map((n) => `<option value="${n}" ${+def.durationMin === n ? 'selected' : ''}>${n < 60 ? `${n} นาที` : `${n / 60} ชม.`}</option>`).join('')}</select></div></div>
      <label class="field"><span>สถานที่</span><input name="place" maxlength="200" value="${esc(def.place)}" placeholder="เช่น ห้องประชุม 2 อาคาร ท.100"></label>
      <label class="field"><span>ลิงก์ประชุมออนไลน์</span><input name="link" maxlength="500" value="${esc(def.link)}" placeholder="https://teams.microsoft.com/…"></label>
      <div class="field span-2"><span>ผู้เข้าประชุม</span><div class="mf-people" id="mf-people"></div>
        <input name="extra" placeholder="อีเมลอื่นๆ คั่นด้วยจุลภาค" value=""></div>
      <label class="field span-2"><span>วาระการประชุม</span><textarea name="agenda" rows="5" maxlength="4000" placeholder="1. เรื่องแจ้งเพื่อทราบ&#10;2. ความก้าวหน้าของงาน&#10;3. ปัญหาและอุปสรรค">${esc(def.agenda)}</textarea></label>
      <label class="check span-2"><input type="checkbox" name="notify" checked>${m ? 'ส่งอีเมลแจ้งการเปลี่ยนแปลงถึงผู้เข้าประชุม' : 'ส่งอีเมลเชิญผู้เข้าประชุม'}</label>
    </form>`,
    footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" data-go>${icon('calendar')}${m ? 'บันทึก' : 'นัดประชุม'}</button>`,
  });
  const f = md.el.querySelector('#mf');
  const chosen = new Set((def.attendees || []).map(R.norm));
  if (!m) chosen.add(R.norm(me.email));
  const drawPeople = () => {
    const aud = f.elements.audience.value;
    md.el.querySelector('[data-pfield]').hidden = aud === 'dept';
    const list = candidates(aud, f.elements.pid.value);
    const known = new Set(list.map((x) => x.email));
    // สมาชิกโครงการที่ไม่อยู่ในรายชื่อของประเภทนี้ (เช่น ผู้รับจ้างในประชุมภายใน) ไม่ต้องย้ายไปช่องอีเมลอื่นๆ
    const proj = store.project(f.elements.pid.value);
    const members = new Set(proj ? R.members(proj).map((x) => x.email) : []);
    for (const e of [...chosen]) if (!known.has(e) && members.has(e)) chosen.delete(e);
    f.elements.extra.value = [...chosen].filter((e) => !known.has(e)).join(', ');
    md.el.querySelector('#mf-people').innerHTML = list.length
      ? list.map((x) => `<label class="check"><input type="checkbox" value="${esc(x.email)}" ${chosen.has(x.email) ? 'checked' : ''}><span>${esc(x.name)} <small class="muted">${esc(x.tag)}</small></span></label>`).join('')
      : '<p class="muted">ยังไม่มีรายชื่อ — พิมพ์อีเมลด้านล่าง</p>';
  };
  md.el.querySelector('#mf-people').addEventListener('change', (e) => { if (e.target.checked) chosen.add(e.target.value); else chosen.delete(e.target.value); });
  f.elements.audience.addEventListener('change', drawPeople);
  f.elements.pid.addEventListener('change', drawPeople);
  drawPeople();
  md.el.querySelector('[data-go]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const extra = R.parseList(f.elements.extra.value);
    const known = new Set(candidates(f.elements.audience.value, f.elements.pid.value).map((x) => x.email));
    const attendees = [...new Set([...[...chosen].filter((x) => known.has(x)), ...extra])];
    const input = {
      ...(m || {}), id: m?.id, audience: f.elements.audience.value, projectId: f.elements.audience.value === 'dept' ? '' : f.elements.pid.value,
      title: f.elements.title.value, startAt: `${f.elements.date.value}T${f.elements.time.value || '09:00'}`, durationMin: +f.elements.dur.value,
      place: f.elements.place.value, link: f.elements.link.value.trim(), attendees, agenda: f.elements.agenda.value,
    };
    setBusy(btn, true, 'กำลังบันทึก…');
    try {
      const saved = await store.saveMeeting(input, { notify: f.elements.notify.checked });
      md.close();
      toast(`${m ? 'บันทึกการประชุมแล้ว' : 'นัดประชุมแล้ว'}${f.elements.notify.checked ? mailNote(saved._mail, store.mode) : ''}`, saved._mail?.error ? 'bad' : 'ok', 6000);
      location.hash = `#/meetings/${encodeURIComponent(saved.id)}`;
      window.dispatchEvent(new Event('pt:rerender'));
    } catch (ex) { toast(ex.message, 'bad', 6000); setBusy(btn, false); }
  });
}

// ---------- รายละเอียด ----------
function renderDetail(el, id) {
  const m = store.meeting(id);
  const p = m?.projectId ? store.project(m.projectId) : null;
  const me = store.me;
  if (!m || !R.canSeeMeeting(m, p, me)) {
    el.innerHTML = `<section class="panel">${emptyState({ ic: 'calendar', title: 'ไม่พบการประชุมนี้', text: 'อาจถูกลบ หรือคุณไม่ได้อยู่ในรายชื่อผู้เข้าประชุม', actions: '<a class="btn" href="#/meetings">กลับไปรายการประชุม</a>' })}</section>`;
    return;
  }
  const canEdit = R.canEditMeeting(m, p, me);
  const links = calLinks(m);
  const person = (e) => (p ? personName(p, e) : store.nameOf(e) || e);
  const actRow = (a, i) => canEdit
    ? `<tr><td><input data-a="${i}|text" value="${esc(a.text)}" maxlength="300" aria-label="งาน"></td>
        <td><select data-a="${i}|owner" aria-label="ผู้รับผิดชอบ"><option value="">—</option>${m.attendees.map((e) => `<option value="${esc(e)}" ${a.owner === e ? 'selected' : ''}>${esc(person(e))}</option>`).join('')}</select></td>
        <td><input type="date" data-a="${i}|due" value="${esc(a.due)}" aria-label="กำหนดเสร็จ"></td>
        <td class="c"><input type="checkbox" data-a="${i}|done" ${a.done ? 'checked' : ''} aria-label="เสร็จแล้ว"></td>
        <td><button type="button" class="icon-btn" data-arm="${i}" aria-label="ลบงาน">${icon('x')}</button></td></tr>`
    : `<tr class="${a.done ? 'is-done' : ''}"><td>${esc(a.text)}</td><td>${esc(a.owner ? person(a.owner) : '—')}</td><td>${a.due ? esc(fmt.date(a.due)) : '—'}</td>
        <td class="c">${R.canToggleAction(m, p, me, a) ? `<input type="checkbox" data-toggle="${esc(a.id)}" ${a.done ? 'checked' : ''} aria-label="เสร็จแล้ว">` : (a.done ? icon('check') : '')}</td><td></td></tr>`;
  el.innerHTML = `
  <nav class="crumbs"><a href="#/meetings">${icon('chevL')}ประชุมทั้งหมด</a>${p ? ` <span>·</span> <a href="#/p/${encodeURIComponent(p.id)}/chat/meetings">${esc(p.code || p.name)}</a>` : ''}</nav>
  <div class="mt-detail">
    <div class="mt-main-col">
      <section class="panel mt-head ${m.status === 'cancelled' ? 'is-cancelled' : ''}">
        <div class="sd-tags"><span class="tag">${esc(R.AUDIENCES[m.audience])}</span>${m.status !== 'scheduled' ? `<span class="chip ${m.status === 'done' ? 'chip-ok' : ''}">${esc(R.MEETING_STATUS[m.status])}</span>` : ''}</div>
        <h2>${esc(m.title)}</h2>
        <dl class="sd-facts">
          <div><dt>วันเวลา</dt><dd>${esc(R.meetingWhen(m))}</dd></div>
          ${m.place ? `<div><dt>สถานที่</dt><dd>${esc(m.place)}</dd></div>` : ''}
          ${p ? `<div><dt>โครงการ</dt><dd><a class="link" href="#/p/${encodeURIComponent(p.id)}">${esc(p.name)}</a></dd></div>` : ''}
          <div><dt>ผู้นัดประชุม</dt><dd>${esc(m.createdByName || m.createdBy)}</dd></div>
        </dl>
        <div class="row-actions">
          ${m.link && m.status !== 'cancelled' ? `<a class="btn btn-primary" href="${esc(m.link)}" target="_blank" rel="noopener">${icon('external')}เข้าร่วมประชุมออนไลน์</a>` : ''}
          <button class="btn" data-act="ics">${icon('calendar')}เพิ่มลงปฏิทิน (.ics)</button>
          <button class="btn" data-act="f04" title="พิมพ์บันทึกการประชุมตามแบบมาตรฐาน">${icon('print')}พิมพ์ PT-F04</button>
          <a class="btn btn-ghost" href="${esc(links.google)}" target="_blank" rel="noopener">Google Calendar</a>
          <a class="btn btn-ghost" href="${esc(links.outlook)}" target="_blank" rel="noopener">Outlook</a>
        </div>
        ${canEdit ? `<div class="row-actions">
          <button class="btn btn-sm" data-act="edit">${icon('edit')}แก้ไขนัด</button>
          ${m.status === 'scheduled' ? `<button class="btn btn-sm" data-act="done">${icon('check')}ประชุมแล้ว</button><button class="btn btn-sm btn-ghost btn-danger-text" data-act="cancel">${icon('x')}ยกเลิกการประชุม</button>` : ''}
        </div>` : ''}
      </section>
      <section class="panel">
        <header class="panel-head"><h2>วาระการประชุม</h2></header>
        ${m.agenda ? `<div class="sd-text">${richText(m.agenda)}</div>` : '<p class="muted">ยังไม่ได้กำหนดวาระ</p>'}
      </section>
      <section class="panel">
        <header class="panel-head"><h2>บันทึกการประชุม</h2>${m.updatedByName && m.minutes ? `<small class="muted">แก้ไขล่าสุดโดย ${esc(m.updatedByName)} · ${esc(R.thaiDateTime(m.updatedAt))}</small>` : ''}</header>
        ${canEdit ? `<textarea id="mt-minutes" rows="8" maxlength="20000" placeholder="สรุปมติและข้อสั่งการของที่ประชุม">${esc(m.minutes)}</textarea>`
          : (m.minutes ? `<div class="sd-text">${richText(m.minutes)}</div>` : '<p class="muted">ยังไม่มีบันทึกการประชุม</p>')}
        <h3 class="sub-h">งานที่มอบหมาย</h3>
        <div class="table-wrap"><table class="table mt-actions"><thead><tr><th>งาน</th><th>ผู้รับผิดชอบ</th><th>กำหนดเสร็จ</th><th class="c">เสร็จ</th><th></th></tr></thead>
          <tbody id="mt-acts">${(m.actions || []).map(actRow).join('') || (canEdit ? '' : '<tr><td colspan="5" class="muted">ไม่มีงานที่มอบหมาย</td></tr>')}</tbody></table></div>
        ${canEdit ? `<div class="row-actions"><button class="btn btn-sm btn-ghost" data-act="add-act">${icon('plus')}เพิ่มงาน</button></div>
          <div class="save-row"><button class="btn" data-act="save-min">${icon('check')}บันทึก</button><button class="btn btn-primary" data-act="send-min">${icon('mail')}บันทึกและส่งบันทึกการประชุมทางอีเมล</button></div>` : ''}
      </section>
      <section class="panel">
        <header class="panel-head"><h2>${icon('message')}ความเห็นและเอกสารประกอบการประชุม</h2></header>
        <div id="mt-room"></div>
      </section>
    </div>
    <aside class="panel mt-people">
      <header class="panel-head"><h2>ผู้เข้าประชุม</h2><span class="count">${m.attendees.length}</span></header>
      <ul class="mt-att">${m.attendees.map((e) => `<li>${icon('user')}<span>${esc(person(e))}<small>${esc(e)}</small></span></li>`).join('') || '<li class="muted">ยังไม่ได้ระบุ</li>'}</ul>
      ${libraryBox({ use: 'meeting', workType: p?.type || '', title: 'แบบฟอร์มการประชุม' })}
    </aside>
  </div>`;
  mountRoom(el.querySelector('#mt-room'), { key: `meeting:${m.id}`, channel: 'meeting', pid: m.projectId || '', refId: m.id, compact: true });
  el.querySelector('[data-act="ics"]').addEventListener('click', () => download(`${m.title.replace(/[\\/:*?"<>|]/g, '-')}.ics`, icsOf(m), 'text/calendar'));
  el.querySelector('[data-act="f04"]').addEventListener('click', () => openForm('meeting', { p, m: { ...m, minutes: el.querySelector('#mt-minutes')?.value ?? m.minutes } }));
  bindLibraryBox(el);
  el.querySelector('[data-act="edit"]')?.addEventListener('click', () => openMeetingForm({ existing: m }));
  const rerender = () => renderDetail(el, id);
  const save = async (patch, notify, btn, msg) => {
    if (btn) setBusy(btn, true, 'กำลังบันทึก…');
    try {
      const saved = await store.saveMeeting({ ...m, ...patch }, { notify });
      toast(`${msg}${notify ? mailNote(saved._mail, store.mode) : ''}`, saved._mail?.error ? 'bad' : 'ok', 6000);
      rerender();
    } catch (ex) { toast(ex.message, 'bad', 6000); if (btn) setBusy(btn, false); }
  };
  el.querySelector('[data-act="done"]')?.addEventListener('click', (e) => save({ status: 'done' }, false, e.currentTarget, 'บันทึกว่าประชุมแล้ว'));
  el.querySelector('[data-act="cancel"]')?.addEventListener('click', async (e) => {
    if (!(await confirmBox({ title: 'ยกเลิกการประชุม', message: `ยกเลิก "${esc(m.title)}"? ระบบจะแจ้งผู้เข้าประชุมทางอีเมล`, ok: 'ยกเลิกการประชุม', danger: true }))) return;
    save({ status: 'cancelled' }, true, e.currentTarget, 'ยกเลิกการประชุมแล้ว');
  });
  // บันทึกการประชุม + งานที่มอบหมาย
  if (canEdit) {
    const acts = (m.actions || []).map((a) => ({ ...a }));
    const body = el.querySelector('#mt-acts');
    const drawActs = () => { body.innerHTML = acts.map(actRow).join(''); };
    body.addEventListener('input', (e) => { const [i, k] = (e.target.dataset.a || '').split('|'); if (k && k !== 'done') acts[+i][k] = e.target.value; });
    body.addEventListener('change', (e) => { const [i, k] = (e.target.dataset.a || '').split('|'); if (k) acts[+i][k] = k === 'done' ? e.target.checked : e.target.value; });
    body.addEventListener('click', (e) => { const b = e.target.closest('[data-arm]'); if (b) { acts.splice(+b.dataset.arm, 1); drawActs(); } });
    el.querySelector('[data-act="add-act"]').addEventListener('click', () => { acts.push({ text: '', owner: '', due: '', done: false }); drawActs(); body.querySelector('tr:last-child input')?.focus(); });
    const collect = () => ({ minutes: el.querySelector('#mt-minutes').value, actions: acts.filter((a) => String(a.text || '').trim()) });
    el.querySelector('[data-act="save-min"]').addEventListener('click', (e) => save(collect(), false, e.currentTarget, 'บันทึกการประชุมแล้ว'));
    el.querySelector('[data-act="send-min"]').addEventListener('click', (e) => save({ ...collect(), status: m.status === 'scheduled' ? 'done' : m.status }, 'minutes', e.currentTarget, 'ส่งบันทึกการประชุมแล้ว'));
  } else {
    el.querySelectorAll('[data-toggle]').forEach((cb) => cb.addEventListener('change', async () => {
      try { await store.toggleMeetingAction(m.id, cb.dataset.toggle, cb.checked); toast(cb.checked ? 'บันทึกว่างานเสร็จแล้ว' : 'ยกเลิกสถานะเสร็จแล้ว'); rerender(); } catch (ex) { toast(ex.message, 'bad'); cb.checked = !cb.checked; }
    }));
  }
}
