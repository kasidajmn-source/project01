// อีเมลรายงาน (1.0.5): ดูตัวอย่างก่อนส่ง และส่งทันที
// Google: เซิร์ฟเวอร์ส่งอัตโนมัติตามเวลา (ปุ่มนี้ใช้ส่งซ้ำ/ส่งเพิ่ม) · SharePoint/OneDrive: ส่งจากบัญชีผู้ใช้ · โหมดทดลอง: เก็บในกล่องอีเมลจำลอง
import { store } from '../store.js';
import { esc, icon, openModal, toast, setBusy } from '../ui.js';

const R = globalThis.PTRules;
export const REPORT_KINDS = {
  reminders: { label: 'อีเมลเตือนงานค้าง', ic: 'clock' },
  daily: { label: 'รายงานประจำวัน', ic: 'calendar' },
  weekly: { label: 'รายงานประจำสัปดาห์', ic: 'clipboard' },
  monthly: { label: 'รายงานความคืบหน้าประจำเดือน', ic: 'chart' },
};

/** ข้อความอธิบายว่าระบบส่งอีเมลได้หรือไม่ (null = ส่งได้) */
export function mailBlocker() {
  if (store.legacy) return 'ระบบหลังบ้าน (Code.gs) ยังเป็นเวอร์ชันเก่า — อัปเดตเป็น 1.0.5 ก่อน';
  if (store.direct && !store.settings.spMail) return 'ยังไม่ได้เปิด "ส่งอีเมลแจ้งเตือนผ่าน Microsoft 365" ที่หน้าตั้งค่า — เปิดก่อนจึงจะส่งรายงานได้';
  if (store.serverRules && store.meta.sendEmail === false) return 'ผู้ติดตั้งปิดการส่งอีเมลไว้ใน Code.gs (CONFIG.SEND_EMAIL)';
  return null;
}

const names = (m) => {
  const p = m.projectId ? store.project(m.projectId) : null;
  return m.to.map((e) => (p ? R.memberName(p, e) : store.nameOf(e)) || e);
};

/** เปิดหน้าต่างดูตัวอย่างและส่ง — opts = { projectId, date, month } */
export async function openReportDialog(kind, opts = {}) {
  const k = REPORT_KINDS[kind];
  const block = mailBlocker();
  const m = openModal({
    title: `${k.label}${opts.projectId ? ` — ${store.project(opts.projectId)?.code || store.project(opts.projectId)?.name || ''}` : ' — ทุกโครงการ'}`,
    size: 'xl',
    body: `<div class="rp" id="rp"><p class="muted"><span class="spin"></span> กำลังสร้างตัวอย่างอีเมล…</p></div>`,
    footer: `<span class="rp-note muted small" id="rp-note"></span><button class="btn" data-close>ปิด</button><button class="btn btn-primary" data-send disabled>${icon('send')}ส่งตอนนี้</button>`,
  });
  const box = m.el.querySelector('#rp');
  const send = m.el.querySelector('[data-send]');
  let msgs = [];
  try {
    msgs = await store.reportPreview(kind, opts);
  } catch (ex) {
    box.innerHTML = `<p class="notice notice-bad">${icon('alert')}<span>${esc(ex.message)}</span></p>`;
    return;
  }
  if (!msgs.length) {
    box.innerHTML = `<p class="notice">${icon('check')}<span>${kind === 'reminders' ? 'วันนี้ไม่มีงานค้างที่ถึงรอบเตือน' : kind === 'daily' ? 'ไม่มีรายงานที่ต้องส่ง (ไม่มีโครงการที่กำลังดำเนินการ หรือไม่มีผู้รับที่เปิดรับอีเมล)' : 'ไม่มีรายงานที่ต้องส่ง — ตรวจว่ามีโครงการที่กำลังดำเนินการ และมีผู้รับที่เปิดรับอีเมล'}</span></p>`;
    return;
  }
  const people = msgs.reduce((n, x) => n + x.to.length, 0);
  box.innerHTML = `<div class="rp-grid">
    <ul class="rp-list">${msgs.map((x, i) => `<li><button data-i="${i}" class="${i ? '' : 'is-on'}"><b>${esc(x.subject)}</b><small>ถึง ${esc(names(x).slice(0, 4).join(', '))}${x.to.length > 4 ? ` และอีก ${x.to.length - 4} คน` : ''}</small></button></li>`).join('')}</ul>
    <iframe class="rp-frame" title="ตัวอย่างอีเมล" sandbox=""></iframe>
  </div>`;
  const frame = box.querySelector('iframe');
  const show = (i) => {
    frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:16px;background:#fff}</style></head><body>${msgs[i].html}</body></html>`;
    box.querySelectorAll('[data-i]').forEach((b) => b.classList.toggle('is-on', +b.dataset.i === i));
  };
  box.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => show(+b.dataset.i)));
  show(0);
  const note = m.el.querySelector('#rp-note');
  note.textContent = block || `${msgs.length} ฉบับ ถึง ${people} คน${store.mode === 'local' ? ' — โหมดทดลอง: เก็บในกล่องอีเมลจำลอง' : store.direct ? ` — ส่งจากบัญชี ${store.me.email}` : ''}`;
  if (block) return;
  send.disabled = false;
  send.innerHTML = `${icon('send')}ส่งตอนนี้ (${msgs.length} ฉบับ)`;
  send.addEventListener('click', async () => {
    setBusy(send, true, 'กำลังส่ง…');
    try {
      const r = await store.sendReport(kind, opts);
      m.close();
      toast(r.simulated || store.mode === 'local'
        ? `สร้างอีเมล ${r.sent} คนแล้ว (โหมดทดลอง ดูได้ที่ ตั้งค่า › กล่องอีเมลจำลอง)`
        : `ส่งแล้ว ${r.sent} คน${r.failed ? ` · ไม่สำเร็จ ${r.failed}` : ''}${r.skipped ? ` · ข้าม ${r.skipped} (โควตาอีเมลไม่พอ)` : ''}`, r.failed ? 'bad' : 'ok', 6000);
      window.dispatchEvent(new Event('pt:jobs'));
    } catch (ex) {
      toast(ex.message, 'bad', 7000);
      setBusy(send, false);
    }
  });
}

/** สถานะอีเมลอัตโนมัติ: ส่งล่าสุดเมื่อไร */
export function jobLog() {
  return (store.serverRules ? store.meta.jobs?.log : store.settings.jobLog) || {};
}
export function lastSentText(kind) {
  const log = jobLog();
  const res = log[`${kind}Res`];
  if (!log[kind]) return 'ยังไม่เคยส่ง';
  const when = log[`${kind}At`] ? R.thaiDateTime(log[`${kind}At`]) : log[kind];
  return `ส่งล่าสุด ${when}${res ? ` · ${res.sent || 0} คน${res.failed ? ` (ไม่สำเร็จ ${res.failed})` : ''}${res.skipped ? ` (ข้าม ${res.skipped} — โควตา)` : ''}${res.by && res.by !== 'auto' ? ' · ส่งด้วยมือ' : ''}` : ''}`;
}
