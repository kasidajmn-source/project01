// ห้องสนทนา (ใช้ร่วมกัน: หน้าสนทนา แท็บสนทนาของโครงการ และห้องของการประชุม)
import { store } from '../store.js';
import { esc, icon, toast, confirmBox, setBusy, fmt, onCleanup } from '../ui.js';
import { roleChip } from './common.js';
import { preview } from './tab-docs.js';

const R = globalThis.PTRules;
const nowIso = () => new Date().toISOString();

/** ข้อความ → HTML (escape แล้วจึงทำลิงก์เฉพาะ http/https) */
export function richText(t) {
  return esc(t).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
}
const timeOf = (iso) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const dayOf = (iso) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);

function messagesHTML(key, p) {
  const me = R.norm(store.me.email);
  const list = store.messagesOf(key);
  if (!list.length) return `<div class="rm-empty">${icon('message')}<p>ยังไม่มีข้อความ — เริ่มคุยได้เลย</p></div>`;
  let lastDay = '';
  let lastBy = '';
  return list.map((m) => {
    let head = '';
    const day = dayOf(m.at);
    if (day !== lastDay) { head = `<div class="rm-day"><span>${esc(fmt.date(day))}</span></div>`; lastDay = day; lastBy = ''; }
    const mine = m.by === me;
    const cont = lastBy === m.by;
    lastBy = m.by;
    const role = p ? R.roleOf(p, m.by) : '';
    const files = (m.files || []).map((id) => store.data.files.find((f) => f.id === id)).filter(Boolean);
    return `${head}<div class="rm-msg ${mine ? 'is-mine' : ''} ${cont ? 'is-cont' : ''}" data-mid="${esc(m.id)}">
      ${cont ? '' : `<div class="rm-who"><b>${esc(m.byName || m.by)}</b>${role ? roleChip(role) : ''}</div>`}
      <div class="rm-bubble">${m.deleted ? '<i class="muted">ข้อความถูกลบ</i>' : `${m.text ? `<div class="rm-text">${richText(m.text)}</div>` : ''}${files.length ? `<div class="rm-files">${files.map((f) => `<button type="button" class="rm-file" data-file="${esc(f.id)}">${icon('clip')}<span>${esc(f.name)}</span></button>`).join('')}</div>` : ''}`}</div>
      <div class="rm-meta"><span>${esc(timeOf(m.at))}</span>${R.canDeleteMessage(m, store.me) ? `<button type="button" class="link rm-del" data-del="${esc(m.id)}">ลบ</button>` : ''}</div>
    </div>`;
  }).join('');
}

/** สร้างห้องใน el — opts: { key, channel, pid, refId, meeting, compact } */
export function mountRoom(el, opts) {
  const { key, channel, pid = '', refId = '' } = opts;
  const p = pid ? store.project(pid) : null;
  const meeting = channel === 'meeting' ? store.meeting(refId) : null;
  const canPost = R.canPostChannel(channel, p, store.me, meeting);
  const canAttach = canPost && !!p;
  el.innerHTML = `<div class="room ${opts.compact ? 'is-compact' : ''}">
    <div class="rm-list" aria-live="polite">${messagesHTML(key, p)}</div>
    ${canPost ? `<form class="rm-compose">
      <div class="rm-picked" hidden></div>
      <div class="rm-row">
        ${canAttach ? `<label class="icon-btn rm-attach" title="แนบไฟล์" aria-label="แนบไฟล์">${icon('clip')}<input type="file" multiple hidden></label>` : ''}
        <textarea rows="1" maxlength="${R.MAX_MSG}" placeholder="พิมพ์ข้อความ…" title="Enter = ส่ง · Shift+Enter = ขึ้นบรรทัดใหม่" aria-label="ข้อความ"></textarea>
        <button class="btn btn-primary rm-send" type="submit" aria-label="ส่ง">${icon('send')}</button>
      </div>
    </form>` : `<p class="rm-readonly">${icon('eye')}${channel === 'dept' ? 'คุณอ่านห้องนี้ได้' : 'คุณอ่านห้องนี้ได้อย่างเดียว — พิมพ์ได้เฉพาะสมาชิกของโครงการ'}</p>`}
  </div>`;
  const list = el.querySelector('.rm-list');
  const scrollEnd = () => { list.scrollTop = list.scrollHeight; };
  const draw = () => {
    const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = messagesHTML(key, p);
    if (atEnd) scrollEnd();
    store.markRead(key);
  };
  scrollEnd();
  store.markRead(key);
  list.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-file]');
    if (f) { const rec = store.data.files.find((x) => x.id === f.dataset.file); if (rec) preview(rec); return; }
    const d = e.target.closest('[data-del]');
    if (d) {
      if (!(await confirmBox({ title: 'ลบข้อความ', message: 'ลบข้อความนี้? ผู้อื่นจะเห็นว่า "ข้อความถูกลบ"', ok: 'ลบ', danger: true }))) return;
      try { await store.deleteMessage(d.dataset.del); draw(); } catch (ex) { toast(ex.message, 'bad'); }
    }
  });
  const form = el.querySelector('.rm-compose');
  if (form) {
    const ta = form.querySelector('textarea');
    const picked = form.querySelector('.rm-picked');
    let files = [];
    const showPicked = () => {
      picked.hidden = !files.length;
      picked.innerHTML = files.map((f, i) => `<span class="chip">${icon('clip')}${esc(f.name)} <button type="button" class="link" data-unpick="${i}" aria-label="เอาออก">×</button></span>`).join('');
    };
    picked.addEventListener('click', (e) => { const b = e.target.closest('[data-unpick]'); if (b) { files.splice(+b.dataset.unpick, 1); showPicked(); } });
    form.querySelector('input[type="file"]')?.addEventListener('change', (e) => {
      for (const f of e.target.files) {
        if (f.size > store.maxUploadBytes()) { toast(`ไฟล์ "${f.name}" ใหญ่เกินกำหนด`, 'bad'); continue; }
        files.push(f);
      }
      e.target.value = '';
      showPicked();
    });
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(160, ta.scrollHeight)}px`; };
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if (!text && !files.length) return;
      const btn = form.querySelector('.rm-send');
      setBusy(btn, true, '');
      try {
        await store.postMessage({ channel, projectId: pid, refId, text }, files, (msg) => { btn.title = msg; });
        ta.value = ''; files = []; showPicked(); grow();
        draw(); scrollEnd();
      } catch (ex) { toast(ex.message, 'bad', 6000); }
      setBusy(btn, false);
      btn.innerHTML = icon('send');
      ta.focus();
    });
  }
  // ดึงข้อความใหม่เป็นระยะ (เฉพาะเมื่อเชื่อมต่อที่เก็บออนไลน์ และหน้าต่างเปิดอยู่)
  if (store.cloud) {
    const every = store.mode === 'gas' ? 15000 : 30000;
    const t = setInterval(async () => {
      if (document.hidden) return;
      try { if (await store.pollChat()) draw(); } catch { /* ออฟไลน์ชั่วคราว */ }
    }, every);
    onCleanup(() => clearInterval(t));
  }
  return { draw, canPost };
}

export function lastPreview(key) {
  const m = store.messagesOf(key).filter((x) => !x.deleted).pop();
  if (!m) return '';
  return `${m.byName || m.by}: ${m.text || 'ส่งไฟล์'}`;
}
export { nowIso };
