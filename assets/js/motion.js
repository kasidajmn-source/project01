// ภาพเคลื่อนไหวของหน้าเว็บ (1.0.6) — เปลี่ยนหน้าแบบนุ่มนวล การ์ดค่อยๆ ปรากฏเมื่อเลื่อนถึง ตัวเลขนับขึ้น แถบผลงานวิ่ง
// และตัวชี้เมนูมือถือที่เลื่อนตาม — ปิดอัตโนมัติเมื่อผู้ใช้ตั้ง "ลดการเคลื่อนไหว" ในเครื่อง
import { conf } from './config.js';

const root = document.documentElement;
let io = null;
let lastHash = null;
let freshAt = -1e9;

/** 'full' | 'off' — conf.motion: auto (ตามเครื่อง) | full | off */
export function motionLevel() {
  const m = conf.motion || 'auto';
  if (m === 'off' || m === 'full') return m;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // เบราว์เซอร์อัตโนมัติ (ทดสอบระบบ) ใช้หน้าแบบนิ่งเพื่อให้ผลคงที่
  return reduce || navigator.webdriver ? 'off' : 'full';
}
export const motionOn = () => root.dataset.motion === 'full';

export function applyMotion() {
  root.dataset.motion = motionLevel();
  if (!motionOn()) document.querySelectorAll('.rv').forEach((el) => el.classList.add('rv-in'));
}

const ease = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** ตัวเลขนับขึ้น — เปลี่ยนเฉพาะข้อความตัวเลขแรก (คงรูปแบบ เช่น 1,234.5 และหน่วยที่อยู่ในแท็กลูก) */
function countUp(el) {
  if (el.dataset.counted) return;
  el.dataset.counted = '1';
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node && !/\d/.test(node.nodeValue)) node = walker.nextNode();
  if (!node) return;
  const m = node.nodeValue.match(/-?[\d,]*\.?\d+/);
  if (!m) return;
  const raw = m[0];
  const target = parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(target) || target === 0) return;
  const dec = (raw.split('.')[1] || '').length;
  const comma = raw.includes(',');
  const pre = node.nodeValue.slice(0, m.index);
  const post = node.nodeValue.slice(m.index + raw.length);
  const fmtN = (v) => {
    const s = v.toFixed(dec);
    return comma ? Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : s;
  };
  const dur = 900;
  const t0 = performance.now();
  const final = node.nodeValue;
  const step = (now) => {
    if (!node.isConnected) return;
    const t = Math.min(1, (now - t0) / dur);
    node.nodeValue = t >= 1 ? final : pre + fmtN(target * ease(t)) + post;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const REVEAL = [
  '#view > .page-head', '#view > .panel', '#view > section', '#view > .notice', '#view > .dash-grid > *', '#view > .dash-grid .dash-side > *',
  '.prow', '.mw-list li', '.lib-form', '.lib-list > li', '.dy-day', '.rk-card', '.cmp-row', '.sum-grid > *', '.kpis > *',
  '#tab > .toolbar', '#tab > .panel', '#tab > section', '.dy-layout > *', '.sub-list > *', '.flist > li',
].join(',');
const COUNT = '.big-num, .prow-nums b, .pf-stats dd, .ph-prog .num, .rk-stats .num, .kpi .num';

function observer() {
  if (io || typeof IntersectionObserver !== 'function') return io;
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      el.classList.add('rv-in');
      io.unobserve(el);
      el.querySelectorAll(COUNT).forEach(countUp);
      if (el.matches(COUNT)) countUp(el);
    }
  }, { rootMargin: '0px', threshold: 0 });
  return io;
}

/** ให้การวาดหน้าครั้งถัดไปมีภาพเคลื่อนไหว (เช่น หลังปิดหน้าแนะนำ) */
export function replayNext() { lastHash = null; }

/** เรียกหลังวาดหน้าใหม่ — เปลี่ยนหน้า (hash ใหม่) จะมีภาพเคลื่อนไหว ส่วนการวาดซ้ำจากข้อมูลใหม่จะนิ่ง */
export function enterView(view) {
  const h = location.hash || '#/';
  // หน้าใหม่ หรือหน้าเดิมที่ถูกวาดซ้ำทันที (เช่น hashchange ตามหลังการเปลี่ยนหน้าเอง) = เล่นภาพเคลื่อนไหว
  const fresh = h !== lastHash || performance.now() - freshAt < 600;
  if (h !== lastHash) freshAt = performance.now();
  lastHash = h;
  syncTabIndicator();
  if (!motionOn() || !fresh) { view.querySelectorAll('.rv').forEach((el) => el.classList.add('rv-in')); return; }
  view.classList.remove('view-in');
  void view.offsetWidth; // เริ่มภาพเคลื่อนไหวใหม่
  view.classList.add('view-in');
  const obs = observer();
  const groups = new Map();
  view.querySelectorAll(REVEAL).forEach((el) => {
    if (el.closest('.modal-wrap')) return;
    const parent = el.parentElement;
    const i = groups.get(parent) || 0;
    groups.set(parent, i + 1);
    el.style.setProperty('--i', Math.min(i, 12));
    el.classList.add('rv');
    if (obs) obs.observe(el); else el.classList.add('rv-in');
  });
  // ตัวเลขที่ไม่อยู่ในกลุ่มที่ค่อยๆ ปรากฏ
  view.querySelectorAll(COUNT).forEach((el) => { if (!el.closest('.rv')) countUp(el); });
  // กันค้าง: อะไรที่ยังไม่ปรากฏหลัง 1.2 วินาทีและอยู่ในจอ ให้แสดงเลย
  setTimeout(() => view.querySelectorAll('.rv:not(.rv-in)').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) el.classList.add('rv-in');
  }), 1200);
}

/** ปุ่มหลักในหน้าแนะนำขยับเข้าหาเมาส์เล็กน้อย (1.0.9: เลิกใช้แสงตามเมาส์บนการ์ด) */
export function bindPointerFx() {
  if (bindPointerFx.done) return;
  bindPointerFx.done = true;
  document.addEventListener('pointermove', (e) => {
    if (!motionOn() || e.pointerType !== 'mouse') return;
    const mag = e.target.closest?.('.magnet');
    document.querySelectorAll('.magnet.is-pulled').forEach((b) => { if (b !== mag) { b.classList.remove('is-pulled'); b.style.transform = ''; } });
    if (mag) {
      const r = mag.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      mag.classList.add('is-pulled');
      mag.style.transform = `translate(${(dx * 6).toFixed(1)}px, ${(dy * 5).toFixed(1)}px)`;
    }
  }, { passive: true });
}

/** ตัวชี้เมนูมือถือ (แถบล่างแบบลอย) เลื่อนไปอยู่ใต้เมนูที่เลือก */
export function syncTabIndicator() {
  const bar = document.getElementById('tabbar');
  if (!bar) return;
  let ind = bar.querySelector('.tb-ind');
  if (!ind) { ind = document.createElement('i'); ind.className = 'tb-ind'; ind.setAttribute('aria-hidden', 'true'); bar.prepend(ind); }
  const on = bar.querySelector('a.is-on');
  if (!on || !bar.offsetWidth) { ind.style.opacity = '0'; return; }
  ind.style.opacity = '1';
  ind.style.width = `${on.offsetWidth}px`;
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
}
window.addEventListener('resize', () => syncTabIndicator(), { passive: true });

