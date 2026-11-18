// 1.0.15 หน้าพิจารณาคำขอสิทธิ์ (เปิดจากปุ่มในอีเมลถึงผู้อนุมัติ) — ใช้รหัสในลิงก์แทนการเข้าสู่ระบบ
import { store } from '../store.js';
import { gasBackend } from '../backends/gas.js';
import { esc, icon, emptyState, toast, setBusy, fmt, confirmBox } from '../ui.js';
import { pageHead } from './common.js';

const R = globalThis.PTRules;
const tokens = new Map(); // รหัสจากลิงก์ (เก็บในหน่วยความจำ — ไม่ค้างในประวัติเบราว์เซอร์)

export async function renderAccess(view, id, tok) {
  if (tok) {
    tokens.set(id, tok);
    history.replaceState(null, '', `${location.pathname}#/access/${encodeURIComponent(id)}`);
  }
  const atok = tokens.get(id) || '';
  if (store.mode !== 'gas') {
    view.innerHTML = `<section class="panel">${emptyState({ ic: 'lock', title: 'เปิดลิงก์นี้ในเครื่องที่เชื่อมต่อระบบของทีม', text: 'ลิงก์พิจารณาคำขอสิทธิ์ใช้กับระบบบน Google Drive — เปิดจากอีเมลอีกครั้ง หรือไปที่ ตั้งค่า › คำขอสิทธิ์' })}</section>`;
    return;
  }
  view.innerHTML = `<div class="loading"><span class="spin"></span>กำลังโหลดคำขอ…</div>`;
  let r = null;
  try {
    if (atok) r = await gasBackend.accessInfo(id, atok);
    else r = (store.data.access || []).find((x) => x.id === id) || null;
  } catch (e) {
    view.innerHTML = `<section class="panel">${emptyState({ ic: 'alert', title: 'เปิดคำขอนี้ไม่ได้', text: e.message, actions: '<a class="btn" href="#/">กลับหน้าหลัก</a>' })}</section>`;
    return;
  }
  if (!r) {
    view.innerHTML = `<section class="panel">${emptyState({ ic: 'users', title: 'ไม่พบคำขอนี้', text: 'คำขออาจถูกพิจารณาแล้ว หรือคุณไม่ใช่ผู้อนุมัติ — เปิดจากปุ่มในอีเมลอีกครั้ง', actions: '<a class="btn" href="#/">กลับหน้าหลัก</a>' })}</section>`;
    return;
  }
  draw(view, r, atok);
}

function draw(view, r, atok) {
  const pending = r.status === 'pending';
  const rows = [
    ['ชื่อ', r.name], ['อีเมล (ยืนยันแล้ว)', r.email], ['ตำแหน่งที่ขอ', r.roleLabel],
    r.projectName && ['โครงการ', `${r.projectCode ? `${r.projectCode} ` : ''}${r.projectName}`],
    r.scope && ['ขอบเขตงาน', r.scope],
    r.org && ['หน่วยงาน/บริษัท', r.org], r.phone && ['โทรศัพท์', r.phone], r.note && ['หมายเหตุ', r.note],
    ['ส่งคำขอเมื่อ', fmt.dateTime(r.createdAt)],
  ].filter(Boolean);
  view.innerHTML = `${pageHead('พิจารณาคำขอสิทธิ์', 'ผู้ขอยืนยันอีเมลด้วยรหัส 6 หลักแล้ว — ตรวจว่าเป็นบุคคลที่ควรได้สิทธิ์จริงก่อนอนุมัติ')}
  <section class="panel acc-view" id="acc">
    <dl class="facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${pending ? `<p class="hint">${icon('shield')}${r.by === 'admin'
      ? `อนุมัติแล้ว ${esc(r.email)} จะ${r.role === 'supervisor' ? 'สร้างและดูแลโครงการของตนเองได้' : 'ดูข้อมูลทุกโครงการได้ (อ่านอย่างเดียว)'}`
      : `อนุมัติแล้ว ${esc(r.email)} จะเป็นสมาชิกโครงการในตำแหน่ง${esc(r.roleLabel)} และได้รับอีเมลเชิญ (เปลี่ยนตำแหน่งภายหลังได้ที่หน้าสมาชิกของโครงการ)`}</p>
      <label class="field"><span>เหตุผล/หมายเหตุถึงผู้ขอ <small class="muted">(ใส่เมื่อไม่อนุมัติ)</small></span><textarea id="acc-reason" rows="2" maxlength="500"></textarea></label>
      <div class="row-actions acc-acts"><button class="btn btn-primary" data-dec="approve">${icon('check')}อนุมัติ</button><button class="btn btn-danger-text" data-dec="reject">${icon('x')}ไม่อนุมัติ</button></div>`
    : `<p class="notice ${r.status === 'approved' ? 'notice-ok' : 'notice-warn'}">${icon(r.status === 'approved' ? 'check' : 'alert')}<span>คำขอนี้<b>${esc(R.ACCESS_STATUS[r.status] || r.status)}</b>${r.decidedAt ? ` เมื่อ ${esc(fmt.dateTime(r.decidedAt))}` : ''}${r.reason ? ` — ${esc(r.reason)}` : ''}</span></p>`}
  </section>`;
  view.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', async () => {
    const decision = b.dataset.dec;
    const reason = view.querySelector('#acc-reason').value.trim();
    if (decision === 'reject' && !reason && !(await confirmBox({ title: 'ไม่อนุมัติโดยไม่ระบุเหตุผล', message: 'ผู้ขอจะได้รับอีเมลแจ้งว่าไม่อนุมัติ — ส่งต่อโดยไม่ระบุเหตุผล?', ok: 'ไม่อนุมัติ', danger: true }))) return;
    setBusy(b, true, 'กำลังบันทึก…');
    try {
      const out = atok ? await gasBackend.decideAccess({ id: r.id, decision, reason, atok }) : await store.decideAccess(r.id, decision, reason);
      tokens.delete(r.id);
      toast(decision === 'approve' ? `อนุมัติ ${out.name || out.email} แล้ว` : 'บันทึกว่าไม่อนุมัติแล้ว', 'ok', 6000);
      if (store.me?.email && !store.needLogin) { try { await store.refresh(); } catch { /* ไม่ได้เข้าสู่ระบบ */ } }
      draw(view, out, '');
    } catch (e) {
      toast(e.message, 'bad', 8000);
      setBusy(b, false);
    }
  }));
}

/** รายการคำขอที่รออนุมัติ (ใช้ในหน้าตั้งค่า และหน้าสมาชิกของโครงการ) */
export function accessQueueHTML(list, done = []) {
  if (!list.length && !done.length) return '';
  return `<div class="acc-queue" id="acc-queue">
    ${list.length ? `<ul class="acc-list">${list.map((x) => `<li data-acc="${esc(x.id)}">
      <div class="acc-who"><b>${esc(x.name || x.email)}</b> <small class="muted">${esc(x.email)}</small><br>
        <span class="tag">${esc(x.roleLabel)}</span>${x.projectName ? ` <span class="muted small">${esc(x.projectName)}</span>` : ''}${x.scope ? ` <span class="muted small">· ขอบเขต: ${esc(x.scope)}</span>` : ''}${x.org ? ` <span class="muted small">· ${esc(x.org)}</span>` : ''}${x.phone ? ` <span class="muted small">· ${esc(x.phone)}</span>` : ''}
        ${x.note ? `<div class="small muted">${esc(x.note)}</div>` : ''}<small class="muted">${esc(fmt.dateTime(x.createdAt))}</small></div>
      <div class="acc-btns"><button class="btn btn-sm btn-primary" data-adec="approve">${icon('check')}อนุมัติ</button><button class="btn btn-sm btn-ghost" data-adec="reject">${icon('x')}ไม่อนุมัติ</button></div>
    </li>`).join('')}</ul>` : '<p class="muted small">ไม่มีคำขอที่รออนุมัติ</p>'}
    ${done.length ? `<details class="acc-done"><summary>พิจารณาแล้วล่าสุด (${done.length})</summary><ul>${done.map((x) => `<li>${esc(x.name || x.email)} · ${esc(x.roleLabel)} — <b>${esc(R.ACCESS_STATUS[x.status] || x.status)}</b> ${esc(fmt.date(String(x.decidedAt || '').slice(0, 10)))}${x.reason ? ` <small class="muted">${esc(x.reason)}</small>` : ''}</li>`).join('')}</ul></details>` : ''}
  </div>`;
}
/** ปุ่มอนุมัติ/ไม่อนุมัติในรายการ */
export function bindAccessQueue(el, onDone) {
  el.querySelectorAll('[data-adec]').forEach((b) => b.addEventListener('click', async () => {
    const li = b.closest('[data-acc]');
    const id = li.dataset.acc;
    const x = (store.data.access || []).find((y) => y.id === id);
    const decision = b.dataset.adec;
    let reason = '';
    if (decision === 'reject') {
      const { promptBox } = await import('../ui.js');
      reason = await promptBox({ title: `ไม่อนุมัติ ${x?.name || ''}`.trim(), label: 'เหตุผล (ส่งถึงผู้ขอทางอีเมล)', placeholder: 'เช่น ไม่ใช่บุคลากรของโครงการ' });
      if (reason == null) return;
    } else if (!(await confirmBox({ title: 'อนุมัติคำขอสิทธิ์', message: `${esc(x?.name || '')} (${esc(x?.email || '')}) — ${esc(x?.roleLabel || '')}${x?.projectName ? ` · ${esc(x.projectName)}` : ''}`, ok: 'อนุมัติ' }))) return;
    setBusy(b, true, '…');
    try {
      await store.decideAccess(id, decision, reason || '');
      toast(decision === 'approve' ? 'อนุมัติแล้ว — ระบบแจ้งผู้ขอทางอีเมล' : 'บันทึกว่าไม่อนุมัติแล้ว', 'ok', 5000);
      onDone?.();
    } catch (e) { toast(e.message, 'bad', 8000); setBusy(b, false); }
  }));
}
