// ตัวช่วยด้านหน้าจอ: ไอคอน, รูปแบบตัวเลข/วันที่, modal, toast, gauge
import { STATUS, num } from './calc.js';
import { mascot, cheerAllowed } from './mascot.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- ไอคอน (stroke 24×24) ----------
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v12h13V9"/><path d="M10 21v-6h4v6"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M4 19.5A2 2 0 0 0 6 21.5h14"/><path d="M8.5 7.5h7M8.5 11h5"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.9L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.9 3.9l1.1-1.4"/><path d="M20 20v-4.5h-4.5"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1.2-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/>',
  device: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevL: '<path d="m15 6-6 6 6 6"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  present: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/><path d="m10.5 7.5 4 2.5-4 2.5z"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.5M4.5 12h.5M4.5 18h.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 11h6M9 15h6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
  send: '<path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5z"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  message: '<path d="M4 5h16v11H9l-5 4z"/>',
  clip: '<path d="m20 11.5-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  gantt: '<path d="M4 4v16h16"/><path d="M7 7.5h6M10 11.5h7M8 15.5h5"/>',
  xcircle: '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="2.5"/><path d="M4 5.5v13c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-13"/><path d="M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5"/>',
  // 1.0.7 ไกด์สอนการใช้งาน
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.2-2.5 3.7"/><path d="M12 17.2v.1"/>',
  hand: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M12 9.5V8a1.5 1.5 0 0 1 3 0v2"/><path d="M15 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.6a6 6 0 0 1-4.6-2.2L3.6 16a1.6 1.6 0 0 1 2.4-2.1L9 16.5V11"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-2.5 5 2.5-1.5-7"/><path d="m9.8 9 1.5 1.5 3-3"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
}

// ---------- รูปแบบตัวเลขและวันที่ ----------
const dShort = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
const dLong = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
const dMonth = new Intl.DateTimeFormat('th-TH', { month: 'short' });
const dMonthYear = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' });
const toDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};

export const fmt = {
  num(n, d = 2) {
    return num(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: d });
  },
  fixed(n, d = 2) {
    return num(n).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
  },
  money(n) { return fmt.fixed(n, 2); },
  /** แสดงเป็นล้านบาทเมื่อค่ามาก */
  moneyShort(n) {
    const v = num(n);
    if (Math.abs(v) >= 1e6) return { v: fmt.fixed(v / 1e6, 2), u: 'ล้านบาท' };
    return { v: fmt.num(v, 0), u: 'บาท' };
  },
  pct(r, d = 1) { return `${(num(r) * 100).toFixed(d)}%`; },
  pctNum(r, d = 1) { return (num(r) * 100).toFixed(d); },
  signed(x, d = 1) {
    const v = num(x);
    const s = v.toFixed(d);
    return v > 0.0499 ? `+${s}` : v < -0.0499 ? `−${s.replace('-', '')}` : (0).toFixed(d);
  },
  date(iso) { const d = toDate(iso); return d ? dShort.format(d) : '–'; },
  dateLong(iso) { const d = toDate(iso); return d ? dLong.format(d) : '–'; },
  month(d) { return dMonth.format(d); },
  monthYear(d) { return dMonthYear.format(d); },
  dateTime(isoTs) {
    if (!isoTs) return '–';
    const d = new Date(isoTs);
    return Number.isNaN(+d) ? '–' : d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  },
  size(b) {
    const n = num(b);
    if (!n) return '–';
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  },
};

/** ลิงก์ที่ปลอดภัยสำหรับใส่ใน href/เปิดหน้าต่าง: http(s) หรือเส้นทางภายใน (#/) เท่านั้น — อย่างอื่น (เช่น javascript:) คืนค่าว่าง */
export function safeUrl(u, { blob = false } = {}) {
  const s = String(u ?? '').trim();
  if (/^https?:\/\/[^\s]+$/i.test(s) || /^#\//.test(s)) return s;
  if (blob && /^blob:/i.test(s)) return s;
  return '';
}

// ---------- เมนูรวมคำสั่ง (1.0.8) ----------
// รวมคำสั่งรองไว้ในปุ่มเดียว — ไอเท็มเป็น <button data-act> เดิม จึงผูก event แบบเดิมได้
// items: [{ act, label, icon, sub, href, danger, attrs } | { sep: true } | null]
let menuSeq = 0;
export function menu({ label = '', icon: ic = 'more', items, cls = '', btnCls = '', title = 'คำสั่งเพิ่มเติม' }) {
  const list = (items || []).filter(Boolean);
  while (list.length && list[0].sep) list.shift();
  while (list.length && list[list.length - 1].sep) list.pop();
  if (!list.length) return '';
  const id = `mn${++menuSeq}`;
  const item = (x) => {
    if (x.sep) return '<hr class="mn-sep">';
    const inner = `${x.icon ? icon(x.icon) : ''}<span>${x.label}${x.sub ? `<small>${x.sub}</small>` : ''}</span>`;
    const c = `mn-item${x.danger ? ' is-danger' : ''}`;
    return x.href
      ? (safeUrl(x.href) ? `<a role="menuitem" class="${c}" href="${esc(safeUrl(x.href))}" ${x.attrs || ''}>${inner}</a>` : '')
      : `<button type="button" role="menuitem" class="${c}" ${x.act ? `data-act="${esc(x.act)}"` : ''} ${x.attrs || ''}>${inner}</button>`;
  };
  return `<div class="mn ${cls}"><button type="button" class="btn mn-btn ${label ? '' : 'btn-icon'} ${btnCls}" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}"${label ? '' : ` aria-label="${esc(title)}" title="${esc(title)}"`}>${icon(ic)}${label ? `<span>${label}</span>${icon('chevD', 'mn-caret')}` : ''}</button><div class="mn-pop" role="menu" id="${id}" hidden>${list.map(item).join('')}</div></div>`;
}
function closeMenus(except = null) {
  document.querySelectorAll('.mn-pop:not([hidden])').forEach((pop) => {
    if (pop === except) return;
    pop.hidden = true;
    const btn = pop._btn;
    btn?.setAttribute('aria-expanded', 'false');
    // คืนเมนูกลับไว้ข้างปุ่ม (ถ้าหน้ายังอยู่) — ไม่อย่างนั้นทิ้งไป
    if (btn?.isConnected) btn.after(pop); else pop.remove();
  });
}
function placeMenu(btn, pop) {
  const b = btn.getBoundingClientRect();
  pop.style.minWidth = `${Math.max(200, b.width)}px`;
  const w = pop.offsetWidth, h = pop.offsetHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = b.right - w;
  if (left < 8) left = Math.min(b.left, vw - w - 8);
  let top = b.bottom + 6;
  if (top + h > vh - 8 && b.top - h - 6 > 8) top = b.top - h - 6;
  pop.style.left = `${Math.max(8, left)}px`;
  pop.style.top = `${Math.max(8, Math.min(top, vh - h - 8))}px`;
}
if (typeof document !== 'undefined' && !window.__ptMenu) {
  window.__ptMenu = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.mn-btn');
    if (btn) {
      const pop = btn._pop || btn.nextElementSibling;
      btn._pop = pop;
      pop._btn = btn;
      const open = pop.hidden;
      closeMenus(pop);
      if (!open) { closeMenus(); return; }
      // ย้ายไปไว้ที่ body ขณะเปิด ไม่ให้ถูกตัดโดยกล่องที่ซ่อนส่วนเกินหรือมี transform
      document.body.appendChild(pop);
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      placeMenu(btn, pop);
      pop.querySelector('.mn-item:not(:disabled)')?.focus({ preventScroll: true });
      return;
    }
    // กดคำสั่งในเมนู → ปิดเมนูหลังทำคำสั่ง · กดนอกเมนู → ปิด
    if (e.target.closest?.('.mn-item')) setTimeout(() => closeMenus(), 0);
    else if (!e.target.closest?.('.mn-pop')) closeMenus();
  });
  document.addEventListener('keydown', (e) => {
    const pop = e.target.closest?.('.mn-pop') || e.target.closest?.('.mn-btn')?._pop;
    if (!pop || pop.hidden) return;
    const items = [...pop.querySelectorAll('.mn-item')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const btn = pop._btn; closeMenus(); btn?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Tab') closeMenus();
  }, true);
  window.addEventListener('resize', () => closeMenus());
  // เลื่อนหน้าขณะเมนูเปิด: เมนูเลื่อนตามปุ่ม และปิดเมื่อปุ่มเลื่อนพ้นจอ
  document.addEventListener('scroll', (e) => {
    if (e.target.closest?.('.mn-pop')) return;
    document.querySelectorAll('.mn-pop:not([hidden])').forEach((pop) => {
      const btn = pop._btn;
      const r = btn?.isConnected ? btn.getBoundingClientRect() : null;
      if (!r || r.bottom < 0 || r.top > window.innerHeight) closeMenus(); else placeMenu(btn, pop);
    });
  }, true);
  window.addEventListener('hashchange', () => closeMenus());
}

// ---------- toast ----------
export function toast(msg, tone = 'ok', ms = 3200) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.setAttribute('role', tone === 'bad' ? 'alert' : 'status');
  // บันทึกสำเร็จ: มาสคอตกระโดดดีใจ (ไม่เกินทุก 2 นาที เพื่อไม่ให้รบกวน)
  const cheer = tone === 'ok' && cheerAllowed() ? mascot({ pose: 'cheer', size: 'xs', cls: 'toast-msc' }) : '';
  if (cheer) el.classList.add('has-msc');
  el.innerHTML = `${cheer || icon(tone === 'bad' ? 'alert' : tone === 'info' ? 'refresh' : 'check')}<span>${esc(msg)}</span>`;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const close = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 250); };
  setTimeout(close, ms);
  el.addEventListener('click', close);
  return close;
}

// ---------- modal ----------
let modalStack = [];
export function openModal({ title, body = '', footer = '', size = 'md', onClose, dismissable = true }) {
  const root = document.getElementById('overlay-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="ปิด">${icon('x')}</button>
      </header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;
  const prevFocus = document.activeElement;
  root.appendChild(wrap);
  document.body.classList.add('has-modal');
  requestAnimationFrame(() => wrap.classList.add('in'));
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    modalStack = modalStack.filter((m) => m !== api);
    wrap.classList.remove('in');
    setTimeout(() => {
      wrap.remove();
      if (!modalStack.length) document.body.classList.remove('has-modal');
    }, 180);
    prevFocus?.focus?.();
    onClose?.(result);
  };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap && dismissable) close(); });
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close()));
  const api = { el: wrap.querySelector('.modal'), close };
  modalStack.push(api);
  setTimeout(() => {
    const f = wrap.querySelector('[autofocus], input:not([type=hidden]):not([disabled]), select, textarea, .btn-primary');
    f?.focus();
  }, 30);
  return api;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length) {
    e.preventDefault();
    modalStack[modalStack.length - 1].close();
  }
});

export function confirmBox({ title = 'ยืนยัน', message = '', ok = 'ยืนยัน', danger = false }) {
  return new Promise((resolve) => {
    let val = false;
    const m = openModal({
      title, size: 'sm',
      body: `<p class="confirm-msg">${message}</p>`,
      footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button>`,
      onClose: () => resolve(val),
    });
    m.el.querySelector('[data-ok]').addEventListener('click', () => { val = true; m.close(); });
  });
}

export function promptBox({ title, label, value = '', placeholder = '', ok = 'ตกลง' }) {
  return new Promise((resolve) => {
    let val = null;
    const m = openModal({
      title, size: 'sm',
      body: `<form class="form" data-f><label class="field"><span>${esc(label)}</span><input name="v" value="${esc(value)}" placeholder="${esc(placeholder)}" autofocus required></label></form>`,
      footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" data-ok>${esc(ok)}</button>`,
      onClose: () => resolve(val),
    });
    const input = m.el.querySelector('input');
    const submit = (e) => { e?.preventDefault(); if (!input.value.trim()) { input.focus(); return; } val = input.value.trim(); m.close(); };
    m.el.querySelector('[data-f]').addEventListener('submit', submit);
    m.el.querySelector('[data-ok]').addEventListener('click', submit);
  });
}

// ---------- กันออกจากหน้าที่ยังไม่บันทึก ----------
export const guard = { dirty: false };

// ---------- งานล้างค่าเมื่อเปลี่ยนหน้า ----------
const cleanups = [];
export function onCleanup(fn) { cleanups.push(fn); }
export function runCleanups() { while (cleanups.length) { try { cleanups.pop()(); } catch { /* ignore */ } } }

// ---------- ส่วนประกอบ ----------
export function chip(status, extra = '') {
  const s = STATUS[status] || { label: status, tone: 'muted' };
  return `<span class="chip chip-${s.tone} ${extra}">${esc(s.label)}</span>`;
}

/** มาตรวัดความคืบหน้าแบบไม้สต๊าฟ: แถบน้ำเงิน = ผลงานจริง, เส้นตั้ง = แผน, ลายเฉียงแดง = ส่วนที่ตามหลังแผน */
export function gauge(actual, plan, { size = 'sm', scale = false } = {}) {
  const a = Math.max(0, Math.min(1, num(actual))) * 100;
  const p = Math.max(0, Math.min(1, num(plan))) * 100;
  const gap = p - a;
  return `<div class="gauge gauge-${size}" role="img" aria-label="ผลงาน ${a.toFixed(1)}% แผน ${p.toFixed(1)}%">
    <div class="g-track">
      <div class="g-fill" style="width:${a.toFixed(2)}%"></div>
      ${gap > 0.3 ? `<div class="g-gap" style="left:${a.toFixed(2)}%;width:${gap.toFixed(2)}%"></div>` : ''}
      <div class="g-plan" style="left:${p.toFixed(2)}%"></div>
    </div>
    ${scale ? `<div class="g-scale" aria-hidden="true">${[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => `<span style="left:${v}%">${v}</span>`).join('')}</div>` : ''}
  </div>`;
}

/** ท่ามาสคอตตามความหมายของหน้าว่าง: ไม่มีสิทธิ์/ผิดพลาด → ตกใจ · ค้นหา/ไม่พบ → ค้นหา · อื่นๆ → รอ */
const EMPTY_POSE = { lock: 'oops', alert: 'oops', search: 'search' };
export function emptyArt(ic, pose) {
  return mascot({ pose: pose || EMPTY_POSE[ic] || 'idle', size: 'md', cls: 'empty-msc' }) || `<div class="empty-ic">${icon(ic)}</div>`;
}
export function emptyState({ ic = 'folder', title, text = '', actions = '', pose = '' }) {
  return `<div class="empty">
    ${emptyArt(ic, pose)}
    <h3>${esc(title)}</h3>
    ${text ? `<p>${text}</p>` : ''}
    ${actions ? `<div class="empty-actions">${actions}</div>` : ''}
  </div>`;
}

export function moneyHTML(n) {
  const m = fmt.moneyShort(n);
  return `${m.v} <small>${m.u}</small>`;
}

export function daysText(p, a) {
  if (p.status === 'done') return 'แล้วเสร็จ';
  if (p.status === 'cancelled') return 'ยกเลิก';
  if (!a.started && p.startDate) return `เริ่ม ${fmt.date(p.startDate)}`;
  if (a.daysLeft == null) return 'ไม่ระบุวันสิ้นสุด';
  if (a.daysLeft < 0) return `เกินกำหนด ${fmt.num(-a.daysLeft, 0)} วัน`;
  if (a.daysLeft === 0) return 'ครบกำหนดวันนี้';
  return `เหลือ ${fmt.num(a.daysLeft, 0)} วัน`;
}

// ---------- ประเภทไฟล์ ----------
const KINDS = [
  ['image', /^image\//, /\.(jpe?g|png|gif|webp|heic|bmp|svg)$/i, 'รูปภาพ'],
  ['pdf', /pdf/, /\.pdf$/i, 'PDF'],
  ['word', /word|officedocument\.wordprocessing|vnd\.google-apps\.document/, /\.(docx?|odt|rtf)$/i, 'Word'],
  ['excel', /sheet|excel|csv|vnd\.google-apps\.spreadsheet/, /\.(xlsx?|xlsm|ods|csv)$/i, 'Excel'],
  ['ppt', /presentation|powerpoint/, /\.(pptx?|odp)$/i, 'PowerPoint'],
  ['cad', /dwg|dxf|acad/, /\.(dwg|dxf|rvt|skp|ifc)$/i, 'แบบ CAD'],
  ['zip', /zip|rar|7z|compressed/, /\.(zip|rar|7z)$/i, 'ไฟล์บีบอัด'],
  ['video', /^video\//, /\.(mp4|mov|avi|mkv)$/i, 'วิดีโอ'],
];
export function fileKind(rec) {
  if (rec.url && !rec.driveId && !rec.localBlob && rec.mime === 'link') return { kind: 'link', label: 'ลิงก์' };
  for (const [kind, mre, nre, label] of KINDS) {
    if ((rec.mime && mre.test(rec.mime)) || nre.test(rec.name || '')) return { kind, label };
  }
  return { kind: 'other', label: 'ไฟล์' };
}
export function fileBadge(rec) {
  const { kind } = fileKind(rec);
  const ext = kind === 'link' ? 'URL' : ((rec.name || '').split('.').pop() || '').slice(0, 4).toUpperCase();
  return `<span class="fbadge fb-${kind}">${esc(kind === 'image' ? '' : ext || '?')}${kind === 'image' ? icon('image') : ''}</span>`;
}

export function setBusy(btn, busy, text) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-busy');
    if (text) btn.innerHTML = `<span class="spin"></span>${esc(text)}`;
  } else {
    btn.disabled = false;
    btn.classList.remove('is-busy');
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

export function download(filename, content, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
