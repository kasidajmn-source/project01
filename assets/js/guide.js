// ไกด์สอนการใช้งาน (1.0.7)
// - ปุ่มไกด์มุมขวาล่าง → แผงบทเรียนตามบทบาท
// - บทเรียนแบบเกม: ไฮไลต์ทีละจุด ผู้ใช้ "ลองทำ" เอง หรือกด "ทำให้ดู" / "ข้าม"
// - ผู้ใช้ใหม่: หลังผ่านหน้าแนะนำเข้าหน้าใช้งาน จะถามว่าจะเริ่มบทเรียนหรือข้าม
// - 1.0.9: มาสคอตอยู่บนปุ่มไกด์ ทักทายในแผง ชี้ไปยังจุดที่ไฮไลต์ และฉลองเมื่อจบบท
import { store, conf, saveConf } from './store.js';
import { icon, esc } from './ui.js';
import { motionOn } from './motion.js';
import { mascot, mascotOn, mascotName, setPose } from './mascot.js';
import { LESSONS, lessonById, lessonCtx, recommended, stepsOf, rolesText, demoEmailFor } from './lessons.js';

const R = globalThis.PTRules;
const PAD = 8; // ระยะขอบรอบสิ่งที่ไฮไลต์
const mobile = () => matchMedia('(max-width: 900px)').matches;
const visible = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- สถานะ (เก็บในเครื่อง แยกตามอีเมล) ----------
function gconf() {
  if (!conf.guide || typeof conf.guide !== 'object') conf.guide = {};
  conf.guide.users = conf.guide.users || {};
  return conf.guide;
}
function userKey() { return R.norm(store.cloud ? store.me.email : conf.email) || 'me'; }
function ustate() {
  const g = gconf();
  const k = userKey();
  g.users[k] = g.users[k] || { offered: false, done: [] };
  return g.users[k];
}
const isDone = (id) => ustate().done.includes(id);
function markDone(id) {
  const u = ustate();
  if (!u.done.includes(id)) u.done.push(id);
  saveConf();
  refreshFab();
}
export function resetGuide() {
  const u = ustate();
  u.done = []; u.offered = true;
  saveConf();
  refreshFab();
}
export const guideHidden = () => !!gconf().hide;
export function setGuideHidden(v) { gconf().hide = !!v; saveConf(); refreshFab(); }

// =====================================================================
// ปุ่มไกด์ + แผงบทเรียน
// =====================================================================
let fab = null;
let panelEl = null;

export function mountGuide() {
  if (fab) return;
  fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'guide-fab';
  fab.className = 'guide-fab';
  fab.setAttribute('aria-label', 'ไกด์สอนการใช้งาน');
  fab.setAttribute('aria-haspopup', 'dialog');
  paintFab();
  fab.addEventListener('click', () => (panelEl ? closePanel() : openPanel()));
  window.addEventListener('pt:mascot', () => { paintFab(); refreshFab(); });
  window.addEventListener('pt:mascot-pack', () => { paintFab(); refreshFab(); });
  document.body.appendChild(fab);
  window.addEventListener('pt:conn', refreshFab);
  window.addEventListener('pt:data', refreshFab);
  window.addEventListener('pt:guide', (e) => (e.detail?.lesson ? startLesson(e.detail.lesson) : openPanel()));
  refreshFab();
}

function paintFab() {
  if (!fab) return;
  const m = mascot({ pose: 'idle', size: 'xs', cls: 'gf-msc' });
  fab.classList.toggle('has-msc', !!m);
  fab.innerHTML = `${m || icon('compass')}<span class="gf-txt">ไกด์</span><i class="gf-dot" hidden></i>`;
}

function refreshFab() {
  if (!fab) return;
  fab.hidden = guideHidden() || store.needLogin;
  let pendingRec = false;
  try { pendingRec = ustate().offered && recommended().some((l) => !isDone(l.id)); } catch { pendingRec = false; }
  fab.querySelector('.gf-dot').hidden = !pendingRec;
  fab.classList.toggle('has-dot', pendingRec);
}

function lessonCard(l, c, { rec }) {
  const n = stepsOf(l, c).length;
  const done = isDone(l.id);
  const mine = l.who(c);
  // โหมดทดลอง: บทของบทบาทอื่น → สลับไปทดลองในนามสมาชิกตัวอย่างของบทบาทนั้น
  const tryAs = c.local && !mine && l.act && l.act !== 'admin' && l.act !== 'owner' ? demoEmailFor(l.act) : '';
  const backToMe = c.local && !mine && conf.actAs && (l.act === 'admin' || l.act === 'owner');
  const label = tryAs ? `ลองเป็น${esc(l.role)}` : backToMe ? 'กลับเป็นตัวเองแล้วเริ่ม' : done ? 'เรียนอีกครั้ง' : 'เริ่ม';
  return `<li class="gp-item ${done ? 'is-done' : ''}">
    <button type="button" class="gp-btn" data-lesson="${l.id}" ${tryAs ? `data-as="${esc(tryAs)}"` : ''} ${backToMe ? 'data-me="1"' : ''}>
      <span class="gp-tile t-${l.tone}">${icon(l.icon)}</span>
      <span class="gp-txt"><b>${esc(l.title)}</b><small>${esc(l.short)}</small>
        <span class="gp-meta">${n} ขั้นตอน · ประมาณ ${Math.max(1, Math.round(n / 5))} นาที${rec && !done ? ' · <em>แนะนำสำหรับคุณ</em>' : ''}</span></span>
      <span class="gp-go">${done ? `<i class="gp-check">${icon('check')}</i>` : ''}<span>${label}</span></span>
    </button></li>`;
}

export function openPanel() {
  if (tour) return;
  closePanel();
  const c = lessonCtx();
  const rec = recommended(c);
  const others = LESSONS.filter((l) => !rec.includes(l));
  const doneRec = rec.filter((l) => isDone(l.id)).length;
  const roles = rolesText(c);
  panelEl = document.createElement('div');
  panelEl.className = 'gp-wrap';
  panelEl.innerHTML = `<section class="gp" role="dialog" aria-modal="false" aria-labelledby="gp-h">
    <header class="gp-head">
      ${mascot({ pose: 'wave', size: 'sm' }) || `<span class="gp-badge">${icon('compass')}</span>`}
      <div><h2 id="gp-h">ไกด์สอนการใช้งาน</h2><small>${roles.length ? `คุณคือ ${esc(roles.join(' · '))}` : 'เลือกบทเรียนที่ต้องการ'}</small></div>
      <button type="button" class="gp-x" data-close aria-label="ปิด">${icon('x')}</button>
    </header>
    <div class="gp-prog"><span>เรียนแล้ว <b>${doneRec}</b> จาก ${rec.length} บทที่แนะนำ</span><i><b style="width:${rec.length ? Math.round((doneRec / rec.length) * 100) : 0}%"></b></i></div>
    <div class="gp-scroll"><ul class="gp-list gp-rec">${rec.map((l) => lessonCard(l, c, { rec: true })).join('')}</ul>
    ${others.length ? `<details class="gp-more"><summary>บทเรียนของบทบาทอื่น (${others.length})</summary>
      ${c.local ? '<p class="gp-hint">โหมดทดลอง: กด “ลองเป็น…” เพื่อสลับไปใช้งานในนามสมาชิกตัวอย่างของบทบาทนั้น</p>' : '<p class="gp-hint">ดูได้ว่าบทบาทอื่นทำอะไร — ปุ่มที่คุณไม่มีสิทธิ์จะแสดงเป็นคำอธิบายแทน</p>'}
      <ul class="gp-list">${others.map((l) => lessonCard(l, c, { rec: false })).join('')}</ul></details>` : ''}</div>
    <footer class="gp-foot">
      <a href="#/help" data-close>${icon('book')}คู่มือฉบับเต็ม</a>
      <button type="button" data-act="intro">${icon('play')}หน้าแนะนำระบบ</button>
    </footer>
  </section>`;
  document.body.appendChild(panelEl);
  setPose(fab?.querySelector('.mascot'), 'wave');
  fab?.classList.add('is-open');
  fab?.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => panelEl?.classList.add('is-in'));
  panelEl.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closePanel()));
  panelEl.querySelector('[data-act="intro"]').addEventListener('click', () => { closePanel(); window.dispatchEvent(new Event('pt:intro')); });
  panelEl.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.lesson;
    closePanel();
    if (b.dataset.as || b.dataset.me) switchAs(b.dataset.as || '');
    startLesson(id);
  }));
  panelEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePanel(); fab?.focus(); } });
  panelEl.querySelector('.gp-btn')?.focus({ preventScroll: true });
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}
function outside(e) {
  if (!panelEl) return;
  if (panelEl.contains(e.target) || fab?.contains(e.target)) return;
  closePanel();
}
export function closePanel() {
  document.removeEventListener('pointerdown', outside, true);
  if (!panelEl) return;
  const el = panelEl;
  panelEl = null;
  setPose(fab?.querySelector('.mascot'), 'idle');
  fab?.classList.remove('is-open');
  fab?.setAttribute('aria-expanded', 'false');
  el.classList.remove('is-in');
  setTimeout(() => el.remove(), motionOn() ? 220 : 0);
}

/** โหมดทดลอง: สลับไปใช้งานในนามผู้อื่น ('' = กลับเป็นตัวเอง) */
function switchAs(email) {
  if (store.cloud) return;
  conf.actAs = email;
  saveConf();
  window.dispatchEvent(new Event('pt:conn'));
  window.dispatchEvent(new Event('pt:rerender'));
}

// =====================================================================
// ชวนผู้ใช้ใหม่เริ่มบทเรียน
// =====================================================================
let offerTimer = 0;
const autoAllowed = () => !navigator.webdriver || localStorage.getItem('pt.guide.auto') === '1';
/** ผู้ใช้นี้กำลังจะได้รับคำชวนเรียน (ยังไม่เคยชวน) — หน้าหลักจะเลื่อนคำทักทายของมาสคอตไปครั้งถัดไป */
export function offerPending() {
  try { return autoAllowed() && !guideHidden() && !store.needLogin && !!conf.onboarded && !ustate().offered; } catch { return false; }
}

/** เรียกหลังวาดทุกหน้า — ชวนครั้งเดียวต่อผู้ใช้ เมื่อพร้อมใช้งานจริง */
export function maybeOffer() {
  refreshFab();
  clearTimeout(offerTimer);
  offerTimer = setTimeout(() => {
    if (!autoAllowed() || guideHidden() || tour || panelEl || document.querySelector('.tour, .intro, .modal-wrap, .present, .intro-backdrop')) return;
    if (store.needLogin || !conf.onboarded) return;
    if (!store.cloud && (location.hash || '').startsWith('#/settings')) return; // กำลังตั้งค่าการเชื่อมต่อ
    const u = ustate();
    if (u.offered) return;
    u.offered = true;
    saveConf();
    showOffer();
  }, 700);
}

function showOffer() {
  const c = lessonCtx();
  const rec = recommended(c).slice(0, 3);
  const name = store.me.name && store.me.name !== store.me.email ? store.me.name : conf.user;
  openTour({ offer: true });
  tour.card({
    center: true,
    kind: 'offer',
    html: `<div class="tb-hero">${mascot({ pose: 'wai', size: 'lg' }) || `<span class="tb-badge">${icon('compass')}</span>`}</div>
      <h3 id="tb-h">สวัสดี${name ? ` ${esc(name)}` : ''}</h3>
      <p>${mascotOn() ? `${esc(mascotName())} จะพาใช้งานทีละขั้น` : 'อยากให้พาใช้งานทีละขั้นไหม?'} เหมือนบทสอนเล่นเกม — ไฮไลต์ให้ดูทีละจุด ลองกดเองได้ หรือข้ามได้ทุกเมื่อ</p>
      <ol class="tb-path">${rec.map((l, i) => `<li><span class="gp-tile t-${l.tone}">${icon(l.icon)}</span><span><b>${esc(l.title)}</b><small>${stepsOf(l, c).length} ขั้นตอน${i === 0 ? ' · เริ่มที่บทนี้' : ''}</small></span></li>`).join('')}</ol>`,
    buttons: [
      { label: 'ข้ามไปก่อน', act: 'skip', cls: 'tb-ghost' },
      { label: `${icon('play')}เริ่มบทเรียน`, act: 'start', cls: 'tb-main' },
    ],
    foot: `${icon('compass')}เปิดบทเรียนได้ทุกเมื่อที่ปุ่ม <b>ไกด์</b> มุมขวาล่าง`,
    on: {
      start: () => { const first = rec[0]; closeTour(true); if (first) startLesson(first.id, { chain: rec.map((l) => l.id) }); },
      skip: () => { closeTour(); hintFab(); },
    },
  });
}

function hintFab() {
  if (!fab || fab.hidden) return;
  fab.classList.add('is-hint');
  setTimeout(() => fab?.classList.remove('is-hint'), 4200);
}

// =====================================================================
// ตัวเดินบทเรียน
// =====================================================================
let tour = null;

function openTour({ offer = false } = {}) {
  closePanel();
  if (tour) closeTour(true);
  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = `
    <div class="tr-spot" aria-hidden="true"></div>
    <div class="tr-ring" aria-hidden="true"></div>
    <div class="tr-hand" aria-hidden="true">${icon('hand')}</div>
    <div class="tr-block tr-bt"></div><div class="tr-block tr-bb"></div><div class="tr-block tr-bl"></div><div class="tr-block tr-br"></div><div class="tr-block tr-bh"></div>
    <section class="tr-card" role="dialog" aria-modal="false" aria-live="polite" aria-labelledby="tb-h" tabindex="-1"></section>`;
  document.body.appendChild(root);
  document.body.classList.add('tour-on');
  requestAnimationFrame(() => root.classList.add('is-in'));
  const T = {
    root, el: null, getEl: null, raf: 0, last: '', clickOff: null, kind: offer ? 'offer' : 'step', on: {},
    card(opts) { renderCard(T, opts); },
  };
  T.keys = (e) => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); T.on.skipAll ? T.on.skipAll() : T.on.skip?.(); }
    else if (e.key === 'ArrowRight' && T.on.next && !typing) { e.preventDefault(); T.on.next(); }
    else if (e.key === 'ArrowLeft' && T.on.back && !typing) { e.preventDefault(); T.on.back(); }
  };
  document.addEventListener('keydown', T.keys, true);
  // คลิกนอกจุดไฮไลต์ → สั่นการ์ดเบาๆ ให้รู้ว่าต้องทำอะไร
  root.querySelectorAll('.tr-block').forEach((b) => b.addEventListener('click', () => {
    const card = root.querySelector('.tr-card');
    card.classList.remove('is-nudge'); void card.offsetWidth; card.classList.add('is-nudge');
  }));
  T.resize = () => { T.last = ''; };
  window.addEventListener('resize', T.resize);
  tour = T;
  loop();
  return T;
}

export function closeTour(instant = false) {
  if (!tour) return;
  const T = tour;
  tour = null;
  cancelAnimationFrame(T.raf);
  T.clickOff?.();
  document.removeEventListener('keydown', T.keys, true);
  window.removeEventListener('resize', T.resize);
  document.body.classList.remove('tour-on');
  fab?.classList.remove('is-spot');
  T.root.classList.remove('is-in');
  setTimeout(() => T.root.remove(), instant || !motionOn() ? 0 : 260);
  refreshFab();
}
export const tourActive = () => !!tour;

/** วางตำแหน่งจุดไฮไลต์ตามตำแหน่งจริงของเป้าหมายทุกเฟรม (หน้าเลื่อน/วาดใหม่ก็ตามทัน) */
function loop() {
  if (!tour) return;
  const T = tour;
  let el = T.el;
  if (T.getEl && (!el || !el.isConnected)) { el = T.getEl(); T.el = el; }
  const vw = window.innerWidth, vh = window.innerHeight;
  let r = null;
  if (el && visible(el)) {
    const b = el.getBoundingClientRect();
    r = { x: Math.max(4, b.left - PAD), y: Math.max(4, b.top - PAD), w: 0, h: 0 };
    r.w = Math.min(vw - 4, b.right + PAD) - r.x;
    r.h = Math.min(vh - 4, b.bottom + PAD) - r.y;
    if (r.w <= 0 || r.h <= 0) r = null;
  }
  const key = r ? `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0},${vw},${vh}` : `none,${vw},${vh}`;
  if (key !== T.last) {
    T.last = key;
    place(T, r, vw, vh);
  }
  T.raf = requestAnimationFrame(loop);
}

function place(T, r, vw, vh) {
  const $ = (s) => T.root.querySelector(s);
  const spot = $('.tr-spot'), ring = $('.tr-ring'), hand = $('.tr-hand');
  const set = (n, x, y, w, h) => Object.assign(n.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` });
  T.root.classList.toggle('has-target', !!r);
  if (r) {
    set(spot, r.x, r.y, r.w, r.h);
    set(ring, r.x, r.y, r.w, r.h);
    set($('.tr-bt'), 0, 0, vw, r.y);
    set($('.tr-bb'), 0, r.y + r.h, vw, vh - r.y - r.h);
    set($('.tr-bl'), 0, r.y, r.x, r.h);
    set($('.tr-br'), r.x + r.w, r.y, vw - r.x - r.w, r.h);
    set($('.tr-bh'), r.x, r.y, r.w, r.h); // ขั้นที่ไม่ต้องกด: กันการกดโดนเป้าหมาย
    hand.style.left = `${Math.min(vw - 40, r.x + Math.min(r.w / 2, 120))}px`;
    hand.style.top = `${Math.min(vh - 44, r.y + r.h - 10)}px`;
  } else {
    set(spot, vw / 2, vh / 2, 0, 0);
    set($('.tr-bt'), 0, 0, vw, vh);
    ['.tr-bb', '.tr-bl', '.tr-br', '.tr-bh'].forEach((s) => set($(s), 0, 0, 0, 0));
  }
  placeCard(T, r, vw, vh);
}

function placeCard(T, r, vw, vh) {
  const card = T.root.querySelector('.tr-card');
  card.classList.remove('at-top', 'at-bottom', 'at-left', 'at-right', 'at-center', 'is-sheet');
  card.style.left = card.style.top = card.style.right = card.style.bottom = '';
  if (!r || T.center) {
    card.classList.add('at-center');
    return;
  }
  const M = 12;
  if (mobile()) {
    // มือถือ: การ์ดเป็นแผ่นล่าง หรือย้ายขึ้นบนเมื่อเป้าหมายอยู่ครึ่งล่างของจอ
    card.classList.add('is-sheet');
    if (r.y + r.h / 2 > vh * 0.5) { card.classList.add('at-top'); card.style.top = `${66}px`; } else { card.classList.add('at-bottom'); card.style.bottom = `calc(${16}px + env(safe-area-inset-bottom))`; }
    return;
  }
  const cw = card.offsetWidth || 360, ch = card.offsetHeight || 220;
  const spaces = { bottom: vh - (r.y + r.h), top: r.y, right: vw - (r.x + r.w), left: r.x };
  const side = ['bottom', 'top', 'right', 'left'].find((s) => (s === 'bottom' || s === 'top' ? spaces[s] >= ch + M * 2 : spaces[s] >= cw + M * 2))
    || Object.entries(spaces).sort((a, b) => b[1] - a[1])[0][0];
  let x, y;
  if (side === 'bottom' || side === 'top') {
    x = Math.min(Math.max(M, r.x + r.w / 2 - cw / 2), vw - cw - M);
    y = side === 'bottom' ? r.y + r.h + M : r.y - ch - M;
  } else {
    y = Math.min(Math.max(M, r.y + r.h / 2 - ch / 2), vh - ch - M);
    x = side === 'right' ? r.x + r.w + M : r.x - cw - M;
  }
  y = Math.min(Math.max(M, y), vh - ch - M);
  x = Math.min(Math.max(M, x), vw - cw - M);
  card.classList.add(`at-${side}`);
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
  // มาสคอตชี้ไปทางเป้าหมาย
  const m = card.querySelector('.tb-msc');
  if (m && m.dataset.pose === 'point') m.classList.toggle('is-flip', r.x + r.w / 2 < x + 30);
  // ลูกศรชี้ไปที่เป้าหมาย
  const ax = side === 'bottom' || side === 'top' ? Math.min(Math.max(22, r.x + r.w / 2 - x), cw - 22) : null;
  const ay = side === 'left' || side === 'right' ? Math.min(Math.max(22, r.y + r.h / 2 - y), ch - 22) : null;
  card.style.setProperty('--ax', ax == null ? '50%' : `${ax}px`);
  card.style.setProperty('--ay', ay == null ? '50%' : `${ay}px`);
}

function renderCard(T, { center = false, kind = 'step', html, buttons = [], foot = '', on = {}, click = false, top = '', msc = '' }) {
  const card = T.root.querySelector('.tr-card');
  T.center = center;
  T.on = on;
  T.kind = kind;
  T.root.classList.toggle('is-click', !!click);
  T.root.classList.toggle('is-offer', kind === 'offer' || kind === 'done');
  const m = msc ? mascot({ pose: msc, size: 'sm', cls: 'tb-msc' }) : '';
  card.className = `tr-card k-${kind}${m ? ' has-msc' : ''}`;
  card.innerHTML = `${top}<div class="tb-body">${m ? `${m}<div class="tb-text">${html}</div>` : html}</div>
    ${buttons.length ? `<div class="tb-actions">${buttons.map((b) => `<button type="button" class="tb-btn ${b.cls || ''}" data-tb="${b.act}">${b.label}</button>`).join('')}</div>` : ''}
    ${foot ? `<p class="tb-foot">${foot}</p>` : ''}`;
  card.querySelectorAll('[data-tb]').forEach((b) => b.addEventListener('click', () => on[b.dataset.tb]?.()));
  if (motionOn()) { card.classList.remove('is-pop'); void card.offsetWidth; card.classList.add('is-pop'); }
  T.last = ''; // วางตำแหน่งใหม่ตามขนาดการ์ด
  (card.querySelector('.tb-main') || card.querySelector('.tb-btn'))?.focus({ preventScroll: true });
}

// ---------- เดินบทเรียน ----------
async function resolveTarget(step, timeout = step.optional ? 1400 : 2400) {
  if (!step.target) return null;
  const list = Array.isArray(step.target) ? step.target : [step.target];
  const find = () => {
    for (const t of list) {
      const el = typeof t === 'function' ? t() : [...document.querySelectorAll(t)].find(visible);
      if (visible(el)) return el;
    }
    return null;
  };
  const t0 = performance.now();
  for (;;) {
    const el = find();
    if (el) return { el, find };
    if (performance.now() - t0 > timeout || !tour) return { el: null, find };
    await sleep(90);
  }
}

function hashOf(step) {
  const r = typeof step.route === 'function' ? step.route() : step.route;
  return r || null;
}

/** เลื่อนให้เห็นเป้าหมาย (เป้าหมายที่สูงกว่าจอ: ให้เห็นส่วนบน) — คืน true ถ้ามีการเลื่อน */
function bringIntoView(el) {
  const b = el.getBoundingClientRect();
  const top = mobile() ? 62 : 8;
  const bottom = window.innerHeight - (mobile() ? 96 : 8);
  const avail = bottom - top;
  const okH = b.left >= 0 && b.right <= window.innerWidth;
  const behavior = motionOn() ? 'smooth' : 'auto';
  if (b.height <= avail) {
    if (okH && b.top >= top && b.bottom <= bottom) return false;
    el.scrollIntoView({ block: 'center', inline: 'center', behavior });
    return true;
  }
  if (okH && b.top >= top && b.top <= top + avail * 0.35) return false;
  const prev = el.style.scrollMarginTop;
  el.style.scrollMarginTop = `${top + 12}px`;
  el.scrollIntoView({ block: 'start', inline: 'center', behavior });
  el.style.scrollMarginTop = prev;
  return true;
}

/** เริ่มบทเรียน — chain = ลำดับบทที่จะชวนเรียนต่อ */
export async function startLesson(id, { chain = null } = {}) {
  const lesson = lessonById(id);
  if (!lesson) return;
  const steps = stepsOf(lesson);
  if (!steps.length) return;
  openTour();
  const T = tour;
  T.lesson = lesson;
  T.chain = chain;
  let i = 0;
  let seq = 0;

  const show = async (idx, dir = 1) => {
    if (tour !== T) return;
    const my = ++seq;
    i = idx;
    const step = steps[i];
    T.clickOff?.(); T.clickOff = null;
    T.el = null; T.getEl = null; T.last = '';
    T.root.classList.add('is-moving');
    const h = hashOf(step);
    if (h && h !== (location.hash || '#/')) {
      location.hash = h;
      await sleep(60);
    }
    const found = await resolveTarget(step);
    if (my !== seq || tour !== T) return;
    if (step.target && !found.el && step.optional && !step.note) {
      // ไม่มีส่วนนี้สำหรับผู้ใช้นี้ — ไปขั้นถัดไป (หรือย้อนต่อ)
      const nx = i + dir;
      if (nx >= 0 && nx < steps.length) return show(nx, dir);
      if (nx >= steps.length) return finish();
      return show(0, 1);
    }
    const el = found?.el || null;
    if (el && bringIntoView(el)) {
      await sleep(motionOn() ? 460 : 30);
      if (my !== seq || tour !== T) return;
    }
    T.el = el;
    T.getEl = el ? found.find : null;
    T.root.classList.remove('is-moving');
    fab?.classList.toggle('is-spot', step.target === '#guide-fab');
    const click = !!(el && step.do === 'click');
    const last = i === steps.length - 1;
    const dots = steps.map((_, k) => `<i class="${k < i ? 'is-past' : k === i ? 'is-now' : ''}"></i>`).join('');
    const missing = step.target && !el;
    const text = missing ? `${step.note || 'ส่วนนี้ยังไม่แสดงสำหรับบัญชีของคุณ'}` : step.text;
    T.card({
      center: !el,
      click,
      // ท่าตามขั้น: ขั้นแรก = ทักทาย · ลองทำ = ชี้ · อธิบายจุดที่ไฮไลต์ = ผายมือ · ไม่มีส่วนนี้ = คิด
      msc: missing ? 'think' : i === 0 ? 'wave' : click ? 'point' : el ? 'present' : 'idle',
      top: `<div class="tb-top"><span class="tb-lesson t-${lesson.tone}">${icon(lesson.icon)}${esc(lesson.chip || lesson.role)}</span>${click ? `<span class="tb-try">${icon('hand')}ลองทำ</span>` : missing ? `<span class="tb-try tb-info">${icon('help')}คำอธิบาย</span>` : ''}<span class="tb-count num">${i + 1}/${steps.length}</span>
        <button type="button" class="tb-x" data-tb="skipAll" aria-label="ข้ามบทเรียน" title="ข้ามบทเรียน (Esc)">${icon('x')}</button></div>`,
      html: `<h3 id="tb-h">${esc(step.title)}</h3><p>${text}</p><div class="tb-dots" aria-hidden="true">${dots}</div>`,
      buttons: click
        ? [
          { label: 'ข้ามขั้นนี้', act: 'next', cls: 'tb-ghost' },
          { label: `${icon('play')}ทำให้ดู`, act: 'auto', cls: 'tb-main' },
        ]
        : [
          ...(i > 0 ? [{ label: `${icon('chevL')}ย้อนกลับ`, act: 'back', cls: 'tb-ghost' }] : [{ label: 'ข้ามบทเรียน', act: 'skipAll', cls: 'tb-ghost' }]),
          { label: last ? `${icon('flag')}จบบทเรียน` : `ถัดไป${icon('chevR')}`, act: 'next', cls: 'tb-main' },
        ],
      on: {
        next: () => (last ? finish() : show(i + 1, 1)),
        back: () => (i > 0 ? show(i - 1, -1) : null),
        skipAll: () => { closeTour(); hintFab(); },
        auto: () => { const t = T.el; if (t) { advance(); t.click(); } },
      },
    });
    // ขั้น "ลองทำ": เมื่อผู้ใช้กดเป้าหมายเอง → ไปขั้นถัดไป
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      setTimeout(() => (last ? finish() : show(i + 1, 1)), 80);
    };
    if (click) {
      const onDown = (e) => { if (T.el && T.el.contains(e.target)) advance(); };
      document.addEventListener('click', onDown, true);
      T.clickOff = () => document.removeEventListener('click', onDown, true);
    }
  };

  const finish = () => {
    if (tour !== T) return;
    markDone(lesson.id);
    T.clickOff?.(); T.clickOff = null;
    T.el = null; T.getEl = null; T.last = '';
    fab?.classList.remove('is-spot');
    T.root.classList.remove('is-moving');
    const c = lessonCtx();
    const rec = recommended(c);
    const order = T.chain || rec.map((l) => l.id);
    const nextId = order.find((x) => x !== lesson.id && !isDone(x));
    const next = nextId ? lessonById(nextId) : null;
    const done = rec.filter((l) => isDone(l.id)).length;
    T.card({
      center: true,
      kind: 'done',
      html: `<div class="tb-hero">${mascot({ pose: next ? 'cheer' : 'love', size: 'lg' }) || `<span class="tb-badge is-done">${icon('award')}</span>`}${confetti()}</div>
        <h3 id="tb-h">ผ่านบทเรียนแล้ว!</h3>
        <p><b>${esc(lesson.title)}</b></p>
        <div class="gp-prog tb-prog"><span>บทที่แนะนำสำหรับคุณ เรียนแล้ว <b>${done}</b> จาก ${rec.length}</span><i><b style="width:${rec.length ? Math.round((done / rec.length) * 100) : 100}%"></b></i></div>
        ${next ? `<p class="tb-next">บทต่อไป: <b>${esc(next.title)}</b><br><small>${esc(next.short)}</small></p>` : '<p class="tb-next">เรียนครบบทที่แนะนำแล้ว — เปิดบทอื่นหรือคู่มือฉบับเต็มได้จากปุ่มไกด์</p>'}`,
      buttons: next
        ? [{ label: 'พอแค่นี้', act: 'close', cls: 'tb-ghost' }, { label: `เรียนบทต่อไป${icon('chevR')}`, act: 'next', cls: 'tb-main' }]
        : [{ label: `${icon('check')}เสร็จสิ้น`, act: 'close', cls: 'tb-main' }],
      on: {
        close: () => closeTour(),
        skipAll: () => closeTour(),
        next: () => { closeTour(true); startLesson(next.id, { chain: T.chain }); },
      },
    });
  };

  show(0, 1);
}

function confetti() {
  if (!motionOn()) return '';
  const colors = ['#E8590C', '#FFFFFF', '#2E7D4F', '#4C82D0', '#C2362F', '#F7843F'];
  return `<span class="tb-confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, k) => {
    const a = (k / 18) * Math.PI * 2;
    const d = 70 + (k % 3) * 26;
    return `<i style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d - 30)}px;--r:${k * 47}deg;background:${colors[k % colors.length]};animation-delay:${(k % 4) * 30}ms"></i>`;
  }).join('')}</span>`;
}

// ให้หน้าอื่นเรียกได้ (เช่น หน้าคู่มือ หน้าตั้งค่า)
export { LESSONS, recommended, lessonCtx, isDone };
