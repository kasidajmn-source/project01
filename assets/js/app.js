// จุดเริ่มต้นของแอป: โครงหน้าจอ, เส้นทาง (hash router), การเชื่อมต่อ
import './annotate.js'; // 1.0.14 มาร์ค/โน้ตบนรูป และลายมือชื่อ (window.PTAnnotate)
import { store, conf, saveConf, testConnection, backendFor, gasUrlProblem, spSiteProblem, msIdProblem } from './store.js';
import { icon, esc, toast, runCleanups, guard, openModal, setBusy, emptyArt } from './ui.js';
import { renderDashboard } from './views/dashboard.js';
import { renderProjects } from './views/projects.js';
import { renderProject } from './views/project.js';
import { renderSummary } from './views/summary.js';
import { renderSettings, applyTheme } from './views/settings.js';
import { renderInbox, inboxCount } from './views/inbox.js';
import { renderHelp } from './views/help.js';
import { renderChat } from './views/chat.js';
import { renderMeetings } from './views/meetings.js';
import { renderActivity } from './views/activity.js';
import { renderLibrary } from './views/library.js';
import { renderAccess } from './views/access.js';
import { showIntro } from './views/intro.js';
import { applyMotion, enterView, bindPointerFx, replayNext } from './motion.js';
import { mountGuide, maybeOffer } from './guide.js';
import { loadMascotPack } from './mascot.js';
import { loadBrand, applyBrand } from './brand.js';
import { openLogin } from './views/login.js';
import { loadDemoData } from './views/common.js';
import { msAuth } from './backends/ms-auth.js';
import { spScopes } from './backends/sharepoint.js';
import { odScopes } from './backends/onedrive.js';

const view = document.getElementById('view');

const NAV = [
  ['home', '#/', 'home', 'หน้าหลัก'],
  ['inbox', '#/inbox', 'inbox', 'งานของฉัน'],
  ['projects', '#/projects', 'grid', 'โครงการ'],
  ['chat', '#/chat', 'message', 'สนทนา'],
  ['summary', '#/summary', 'chart', 'สรุปผู้บริหาร', '', 'สรุป'],
  ['library', '#/library', 'clipboard', 'แบบฟอร์มและระเบียบ', 'side'],
  ['settings', '#/settings', 'sliders', 'ตั้งค่า'],
  ['help', '#/help', 'book', 'คู่มือ', 'side'],
];

const BRAND = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
  <rect x="10" y="2" width="12" height="28" rx="1.5" class="bm-staff"/>
  <path class="bm-e" d="M10 5h6v1.6h-6zM10 8.2h4v1.6h-4zM10 11.4h6v1.6h-6zM16 14.6h6v1.6h-6zM18 17.8h4v1.6h-4zM16 21h6v1.6h-6zM10 24.2h6v1.6h-6z"/>
</svg>`;

function renderShell() {
  document.getElementById('side').innerHTML = `
    <a class="brand" href="#/">${BRAND}<span class="brand-text"><b>ติดตามโครงการ</b><small id="brand-org"></small></span></a>
    <nav class="nav" aria-label="เมนูหลัก">${NAV.map(([k, h, ic, l]) => `<a href="${h}" data-nav="${k}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    <div class="side-foot"><a href="#/settings" id="conn" class="conn"></a></div>`;
  applyBrand(document.getElementById('side'));
  document.getElementById('tabbar').innerHTML = NAV.filter((n) => n[4] !== 'side').map(([k, h, ic, l, , sh]) => `<a href="${h}" data-nav="${k}">${icon(ic)}<span>${sh || l}</span></a>`).join('');
  updateConn();
}

function updateConn() {
  const c = document.getElementById('conn');
  if (!c) return;
  const cloud = store.cloud;
  const me = store.me;
  const who = me.email ? `${me.name && me.name !== me.email ? `${me.name} · ` : ''}${me.email}` : (conf.user || 'ยังไม่ได้ระบุอีเมล');
  c.className = `conn ${cloud ? (store.online ? 'is-on' : 'is-off') : 'is-local'}`;
  c.title = `${who}${me.isAdmin ? ' (ผู้ดูแลระบบ)' : ''}`;
  const state = store.needLogin ? `${store.backendLabel} · ยังไม่ได้เข้าสู่ระบบ` : store.online ? store.backendLabel : `${store.backendLabel} (ออฟไลน์)`;
  c.innerHTML = `${icon(cloud ? 'cloud' : 'device')}<span><b>${cloud ? state : 'โหมดทดลอง'}</b><small>${esc(store.needLogin ? 'กดเพื่อตั้งค่าการเชื่อมต่อ' : who)}</small></span>`;
  const org = document.getElementById('brand-org');
  if (org) org.textContent = store.settings.orgName || 'เอกสารและความคืบหน้างานก่อสร้าง';
  updateBadges();
  // แถบแจ้งเมื่อทดลองใช้งานในนามผู้อื่น (โหมดทดลอง)
  let pill = document.getElementById('actas');
  if (!cloud && conf.actAs) {
    if (!pill) { pill = document.createElement('div'); pill.id = 'actas'; pill.className = 'actas'; document.body.appendChild(pill); }
    pill.innerHTML = `${icon('user')}<span>ทดลองในนาม <b>${esc(me.name || me.email)}</b></span><button class="btn btn-sm" data-act="me">กลับเป็นตัวเอง</button>`;
    pill.querySelector('[data-act="me"]').onclick = () => { conf.actAs = ''; saveConf(); updateConn(); route(); };
  } else pill?.remove();
}
window.addEventListener('pt:conn', updateConn);
window.addEventListener('pt:data', () => updateBadges());
window.addEventListener('pt:chat', () => updateBadges());
window.addEventListener('pt:rerender', () => route());
// ข้อความใหม่ระหว่างที่ไม่ได้เปิดห้องสนทนา (ทุก 1 นาที ขณะเปิดหน้าเว็บอยู่)
setInterval(async () => {
  if (document.hidden || !store.cloud || store.needLogin || (location.hash || '').startsWith('#/chat')) return;
  try { if (await store.pollChat()) updateBadges(); } catch { /* ออฟไลน์ชั่วคราว */ }
}, 60000);

function updateBadges() {
  let n = 0, c = 0;
  try { n = inboxCount(); } catch { n = 0; }
  try { c = store.unreadTotal(); } catch { c = 0; }
  const put = (nav, count) => document.querySelectorAll(`[data-nav="${nav}"]`).forEach((a) => {
    let b = a.querySelector('.nav-badge');
    if (!count) { b?.remove(); return; }
    if (!b) { b = document.createElement('em'); b.className = 'nav-badge'; a.appendChild(b); }
    b.textContent = count > 99 ? '99+' : String(count);
  });
  put('inbox', n);
  put('chat', c);
}

// ---------- เส้นทาง ----------
const routes = [
  [/^#\/?$/, () => renderDashboard(view), 'home'],
  [/^#\/inbox\/?$/, () => renderInbox(view), 'inbox'],
  [/^#\/projects\/?$/, () => renderProjects(view), 'projects'],
  [/^#\/p\/([^/?]+)(?:\/([^/?]+))?(?:\/([^?]+))?/, (m) => renderProject(view, m[1], m[2], m[3]), 'projects'],
  [/^#\/summary\/?$/, () => renderSummary(view), 'summary'],
  [/^#\/settings\/?$/, () => renderSettings(view), 'settings'],
  [/^#\/help\/?$/, () => renderHelp(view), 'help'],
  [/^#\/chat(?:\/([^?]+))?\/?$/, (m) => renderChat(view, m[1] || ''), 'chat'],
  [/^#\/meetings(?:\/([^/?]+))?\/?$/, (m) => renderMeetings(view, m[1] || ''), 'chat'],
  [/^#\/activity\/?$/, () => renderActivity(view), 'chat'],
  [/^#\/library\/?$/, () => renderLibrary(view), 'library'],
  // 1.0.15 พิจารณาคำขอสิทธิ์จากลิงก์ในอีเมล (ไม่ต้องเข้าสู่ระบบ — ใช้รหัสในลิงก์)
  [/^#\/access\/([A-Za-z0-9_-]{1,64})(?:\/([a-f0-9]{40}))?\/?$/, (m) => renderAccess(view, m[1], m[2] || ''), 'settings'],
];

const baseOf = (h) => (h || '#/').split('/').slice(0, 3).join('/');
let current = location.hash || '#/';

// 1.0.11: ข้อมูลในแท็บที่เปิดค้างไว้นานอาจเก่า (เช่น ผู้รับจ้างเพิ่งส่งเรื่อง)
// · เปิดหน้าโครงการ/เรื่องที่ยังไม่มีในเครื่อง → ดึงข้อมูลล่าสุดก่อนแสดง (ครั้งเดียวต่อหน้า)
// · เปิดหน้าหลัก/งานของฉัน/รายการโครงการ เมื่อดึงข้อมูลครั้งล่าสุดเกิน 1 นาที → แสดงข้อมูลเดิมก่อน แล้วอัปเดตเบื้องหลัง
const freshTried = new Set();
let freshening = null;
function needsFresh(h) {
  if (!store.cloud || store.needLogin || guard.dirty) return '';
  const m = h.match(/^#\/p\/([^/?]+)(?:\/subs\/([^/?]+))?/);
  if (m) {
    const pid = decodeURIComponent(m[1]);
    const missing = !store.project(pid) || (m[2] && m[2] !== 'new' && m[2] !== 'required' && !store.data.subs.some((x) => x.id === decodeURIComponent(m[2])));
    const age = store.lastSync ? Date.now() - new Date(store.lastSync).getTime() : Infinity;
    if (missing) return !freshTried.has(h) ? 'wait' : '';
    // หน้าเรื่องขออนุมัติ: สถานะอาจเปลี่ยนแล้ว (ผ่าน/ตีกลับโดยคนอื่น) → อัปเดตเบื้องหลัง
    return m[2] && !/^(new|required)$/.test(m[2]) && age > 10000 ? 'background' : '';
  }
  const age = store.lastSync ? Date.now() - new Date(store.lastSync).getTime() : Infinity;
  // งานของฉัน = หน้าที่ต้องสดที่สุด (15 วินาที) · หน้าหลัก 1 นาที
  return ((h === '#/inbox' || h === '#/chat') && age > 15000) || ((h === '#/' || h === '') && age > 60000) ? 'background' : '';
}
/** ลายนิ้วมือข้อมูลอย่างย่อ — อัปเดตเบื้องหลังแล้วไม่มีอะไรเปลี่ยน ไม่ต้องวาดหน้าใหม่ (ไม่กระพริบ) */
const dataSig = () => {
  const d = store.data;
  return [d.projects.length, d.updates.length, d.daily?.length || 0, d.files?.length || 0,
    d.subs.map((x) => `${x.id}:${x.status}:${x.step ?? ''}:${(x.history || x.log || []).length}`).join(','),
    d.projects.map((x) => `${x.id}:${x.updatedAt || ''}:${(x.members || []).length}`).join(',')].join('|');
};
function freshen(h, wait) {
  freshTried.add(h);
  const before = dataSig();
  if (!freshening) {
    freshening = store.refresh().then(() => { updateConn(); return true; }, (e) => {
      if (e.code === 'login') window.dispatchEvent(new Event('pt:relogin'));
      return false;
    }).finally(() => { freshening = null; });
  }
  return freshening.then((ok) => {
    if (!ok || (location.hash || '#/') !== h || guard.dirty || document.querySelector('.modal-wrap')) return;
    // กำลังพิมพ์ความเห็น/ข้อความอยู่ → ไม่วาดหน้าใหม่ทับ
    if (!wait && [...view.querySelectorAll('textarea, input[type="text"], input:not([type])')].some((x) => x.value && x.value !== x.defaultValue)) return;
    if (wait || view.querySelector('.loading') || dataSig() !== before) route();
  });
}

function route() {
  runCleanups();
  const h = location.hash || '#/';
  const fresh = needsFresh(h);
  if (fresh === 'wait') {
    view.innerHTML = `<div class="loading"><span class="spin"></span>กำลังดึงข้อมูลล่าสุดจาก ${esc(store.backendLabel)}…</div>`;
    freshen(h, true);
    return;
  }
  if (fresh === 'background') setTimeout(() => freshen(h, false), 0);
  if (store.needLogin && store.mode === 'gas' && !h.startsWith('#/settings') && !h.startsWith('#/help') && !h.startsWith('#/access/')) {
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.remove('is-on'));
    window.dispatchEvent(new Event('pt:login-cancel'));
    return;
  }
  for (const [re, fn, nav] of routes) {
    const m = h.match(re);
    if (!m) continue;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('is-on', a.dataset.nav === nav));
    try { fn(m); enterView(view); maybeOffer(); } catch (e) {
      console.error(e);
      view.innerHTML = `<section class="panel"><div class="empty">${emptyArt('alert')}<h3>แสดงหน้านี้ไม่ได้</h3><p>${esc(e.message)}</p><a class="btn" href="#/">กลับหน้าหลัก</a></div></section>`;
    }
    updateBadges();
    return;
  }
  document.querySelectorAll('[data-nav]').forEach((x) => x.classList.remove('is-on'));
  view.innerHTML = `<section class="panel"><div class="empty">${emptyArt('search')}<h3>ไม่พบหน้าที่ต้องการ</h3><p>ลิงก์อาจพิมพ์ไม่ครบ หรือหน้านี้ถูกย้ายไปแล้ว</p><a class="btn" href="#/">กลับหน้าหลัก</a></div></section>`;
}

// โหลดชุดภาพมาสคอตเสร็จ → วาดหน้าตั้งค่า/คู่มือใหม่ครั้งเดียว (มีชื่อมาสคอต) เว้นแต่กำลังแก้ข้อมูลค้างอยู่
window.addEventListener('pt:mascot-pack', () => { if (/^#\/(settings|help)/.test(location.hash) && !guard.dirty && !store.needLogin && view.firstElementChild && !view.querySelector('.loading')) route(); });
window.addEventListener('hashchange', () => {
  const next = location.hash || '#/';
  if (next.startsWith('#/connect')) { handleConnect(); return; }
  if (guard.dirty && next !== current) {
    // eslint-disable-next-line no-alert
    if (!window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?')) {
      history.replaceState(null, '', current);
      return;
    }
    guard.dirty = false;
    window.dispatchEvent(new Event('pt:discard'));
  }
  const jump = baseOf(next) !== baseOf(current);
  current = next;
  route();
  if (jump) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
});
window.addEventListener('beforeunload', (e) => { if (guard.dirty) { e.preventDefault(); e.returnValue = ''; } });

// 1.0.11: ช่องวันที่ของเบราว์เซอร์ใช้ปี ค.ศ. — ถ้าพิมพ์ปี พ.ศ. (เช่น 2569) แปลงให้อัตโนมัติ ไม่ให้สัญญายาว 543 ปี
document.addEventListener('change', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement) || t.type !== 'date' || !/^\d{4}-\d{2}-\d{2}$/.test(t.value)) return;
  const y = +t.value.slice(0, 4);
  if (y < 2400 || y > 2700) return;
  t.value = `${y - 543}${t.value.slice(4)}`;
  t.dispatchEvent(new Event('input', { bubbles: true })); // ให้ช่องที่คำนวณต่อ (เช่น วันสิ้นสุดสัญญา) ใช้ค่าที่แปลงแล้ว
  toast(`ช่องวันที่ใช้ปี ค.ศ. — แปลงปี พ.ศ. ${y} เป็น ค.ศ. ${y - 543} ให้แล้ว`, 'info', 5000);
}, true);

// ---------- ลิงก์เชิญ ----------
// Google:     #/connect?u=<URL เว็บแอป>&k=<รหัส>
// SharePoint: #/connect?sp=1&t=<tenant>&c=<client id>&s=<site url>&f=<โฟลเดอร์>&m=<all|selected>
// OneDrive:   #/connect?od=1&t=<tenant>&c=<client id>&d=<drive id>&i=<item id>&n=<ชื่อโฟลเดอร์>&f=<ลิงก์โฟลเดอร์>
// 1.0.11: to=<หน้า> — เปิดหน้านั้นหลังเชื่อมต่อ (ลิงก์ในอีเมลแจ้งเตือน) · รับเฉพาะหน้าในระบบ
const CONNECT_TO = /^\/(?:p\/[A-Za-z0-9_-]{1,64}(?:\/(?:overview|boq|updates|daily|subs|docs|chat|members|settings)(?:\/[A-Za-z0-9_-]{1,64})?)?|meetings\/[A-Za-z0-9_-]{1,64}|access\/[A-Za-z0-9_-]{1,64}\/[a-f0-9]{40}|inbox|summary|projects)$/;
async function handleConnect() {
  const q = new URLSearchParams((location.hash.split('?')[1] || ''));
  const isOd = q.get('od') === '1';
  const isSp = q.get('sp') === '1' || isOd;
  const url = q.get('u'), key = q.get('k') || '';
  const to = CONNECT_TO.test(q.get('to') || '') ? `#${q.get('to')}` : '#/';
  window.dispatchEvent(new Event('pt:intro-close')); // หน้าแนะนำระบบเปิดอยู่ → ปิดก่อน ไม่ให้บังหน้าต่างเชื่อมต่อ
  history.replaceState(null, '', `${location.pathname}#/`);
  current = '#/';
  if (!isSp && !url) { route(); return; }
  // เชื่อมต่อระบบเดียวกันอยู่แล้ว (เช่น กดลิงก์ในอีเมลฉบับถัดไป) → ไปหน้านั้นเลย ไม่ถามซ้ำ
  const same = isOd ? conf.mode === 'onedrive' && !!conf.od.itemId && conf.od.itemId === q.get('i')
    : isSp ? conf.mode === 'sharepoint' && !!conf.sp.site && conf.sp.site === q.get('s')
      : conf.mode === 'gas' && conf.url === url;
  if (same) {
    if (!isSp && key && key !== conf.key) {
      try { await testConnection(url, key); conf.key = key; saveConf(); } catch { /* รหัสในลิงก์ใช้ไม่ได้ — ใช้รหัสเดิม */ }
    }
    history.replaceState(null, '', `${location.pathname}${to}`);
    current = to;
    if (to.startsWith('#/access/')) { await initQuiet(); updateConn(); route(); return; }
    try { await initWithLogin(); } catch (e) { if (e.code !== 'login') toast(e.message, 'bad', 8000); }
    updateConn();
    route();
    return;
  }
  // ตรวจลิงก์เชิญก่อน: ปลายทางต้องเป็น Google Apps Script / SharePoint / Microsoft จริงเท่านั้น
  const problem = isOd
    ? msIdProblem(q.get('t') || 'organizations', 'รหัสองค์กร (tenant) ') || msIdProblem(q.get('c'), 'Client ID ') || (/^[A-Za-z0-9!_.-]{2,200}$/.test(q.get('d') || '') && /^[A-Za-z0-9!_.-]{2,200}$/.test(q.get('i') || '') ? '' : 'รหัสโฟลเดอร์ OneDrive ไม่ถูกต้อง')
    : isSp
      ? spSiteProblem(q.get('s')) || msIdProblem(q.get('t'), 'รหัสองค์กร (tenant) ') || msIdProblem(q.get('c'), 'Client ID ')
      : gasUrlProblem(url);
  if (problem) {
    const bad = openModal({
      title: 'ลิงก์เชิญไม่ถูกต้อง',
      body: `<p class="notice notice-warn">${icon('alert')}<span><b>ไม่เชื่อมต่อ</b> — ${esc(problem)}</span></p>
        <p>ลิงก์อาจพิมพ์ผิด ถูกตัดทอน หรือถูกแก้ไขให้ชี้ไปยังเซิร์ฟเวอร์อื่น ขอลิงก์ใหม่จากผู้ดูแลระบบของทีมโดยตรง และอย่ากรอกรหัสเข้าสู่ระบบในหน้าที่ไม่แน่ใจ</p>`,
      footer: '<button class="btn btn-primary" data-close>ตกลง</button>',
    });
    bad.el.querySelector('[data-close]')?.addEventListener('click', () => route());
    route();
    return;
  }
  const dest = isOd ? 'OneDrive (Microsoft 365)' : isSp ? (() => { try { return new URL(q.get('s')).host; } catch { return ''; } })() : (() => { try { return new URL(url).host; } catch { return ''; } })();
  const where = isOd ? `OneDrive (โฟลเดอร์ ${q.get('n') || 'ที่แชร์ให้คุณ'})` : isSp ? 'SharePoint (Microsoft 365)' : 'Google Drive';
  const m = openModal({
    title: 'เชื่อมต่อฐานข้อมูลของทีม',
    dismissable: false,
    body: `<p>ลิงก์นี้จะเชื่อมต่อแอปบนเครื่องนี้กับข้อมูลโครงการของทีมใน ${esc(where)}</p>
      ${dest ? `<p class="hint">${icon('shield')}ปลายทาง: <b>${esc(dest)}</b> — ตรวจว่าได้รับลิงก์จากผู้ดูแลระบบของทีมจริง</p>` : ''}
      ${isOd ? '<p class="hint">กด "เชื่อมต่อ" แล้วลงชื่อเข้าใช้ด้วยบัญชี Microsoft ที่ได้รับแชร์โฟลเดอร์ — ใช้อีเมลเดียวกับที่เจ้าของโครงการแต่งตั้งไว้</p>'
        : isSp ? '<p class="hint">กด "เชื่อมต่อ" แล้วลงชื่อเข้าใช้ด้วยบัญชีองค์กรในหน้าต่างของ Microsoft — คุณต้องเป็นสมาชิกของไซต์ SharePoint นั้น</p>' : ''}
      <label class="field"><span>ชื่อของคุณ (แสดงในบันทึกที่คุณสร้าง)</span><input id="cn-name" value="${esc(conf.user)}" placeholder="เช่น นายช่างสมชาย" autofocus></label>`,
    footer: '<button class="btn" data-close>ไม่เชื่อมต่อ</button><button class="btn btn-primary" data-go>เชื่อมต่อ</button>',
  });
  const go = m.el.querySelector('[data-go]');
  go.addEventListener('click', async () => {
    const name = m.el.querySelector('#cn-name').value.trim() || conf.user;
    setBusy(go, true, 'กำลังเชื่อมต่อ…');
    try {
      if (isOd) {
        const prev = { mode: conf.mode, od: { ...conf.od } };
        Object.assign(conf.od, {
          tenant: q.get('t') || 'organizations', clientId: q.get('c') || '', driveId: q.get('d') || '', itemId: q.get('i') || '',
          folder: q.get('f') || 'ProjectTracker',
        });
        const odb = backendFor('onedrive');
        try {
          odb.account();
          const login = msAuth.signedIn() && msAuth.hasScopes(odScopes()) ? null : msAuth.loginPopup(odScopes(), { prompt: 'select_account' });
          if (login) await login;
          const info = await odb.probe();
          if (!info.ready) throw new Error('โฟลเดอร์นี้ยังไม่ได้ตั้งค่า — ให้ผู้ดูแลเชื่อมต่อและกด "สร้างโฟลเดอร์ข้อมูล" ก่อน');
        } catch (e) { Object.assign(conf, prev); throw e; }
        Object.assign(conf, { mode: 'onedrive', user: name, onboarded: true });
      } else if (isSp) {
        const prev = { mode: conf.mode, sp: { ...conf.sp } };
        Object.assign(conf.sp, {
          tenant: q.get('t') || '', clientId: q.get('c') || '', site: q.get('s') || '',
          folder: q.get('f') || 'ProjectTracker', scopeMode: q.get('m') === 'selected' ? 'selected' : 'all',
        });
        const sp = backendFor('sharepoint');
        try {
          sp.account(); // ตั้งค่าตัวลงชื่อเข้าใช้ตาม tenant/client id ใหม่
          // เปิด pop-up ทันทีในจังหวะคลิก (ถ้ามี await ก่อนหน้า เบราว์เซอร์จะบล็อก)
          const login = msAuth.signedIn() ? null : msAuth.loginPopup(spScopes(), { prompt: 'select_account' });
          if (login) await login;
          const info = await sp.probe();
          if (info.missing.length) throw new Error('ไซต์นี้ยังไม่ได้ตั้งค่ารายการข้อมูล — ให้ผู้ดูแลเปิดหน้าตั้งค่าแล้วกด "สร้างรายการข้อมูลในไซต์" ก่อน');
        } catch (e) { Object.assign(conf, prev); throw e; }
        Object.assign(conf, { mode: 'sharepoint', user: name, onboarded: true });
      } else {
        await testConnection(url, key);
        if (conf.url !== url) conf.token = '';
        Object.assign(conf, { mode: 'gas', url, key, user: name, onboarded: true });
      }
      saveConf();
      m.close();
      if (to.startsWith('#/access/')) {
        history.replaceState(null, '', `${location.pathname}${to}`); current = to;
        await initQuiet(); updateConn(); route(); return;
      }
      await initWithLogin();
      updateConn();
      if (conf.mode !== 'gas') toast('เชื่อมต่อข้อมูลของทีมแล้ว'); // Google: ข้อความต้อนรับหลังยืนยัน OTP บอกอยู่แล้ว
      if (to !== '#/') { history.replaceState(null, '', `${location.pathname}${to}`); current = to; }
      route();
    } catch (e) {
      toast(e.message, 'bad', 8000);
      setBusy(go, false);
    }
  });
  m.el.querySelector('[data-close]')?.addEventListener('click', () => route());
}

/** 1.0.15 โหลดข้อมูลโดยไม่บังคับเข้าสู่ระบบ (หน้าพิจารณาคำขอสิทธิ์จากลิงก์ในอีเมล) */
async function initQuiet() {
  try { await store.init(); store.needLogin = false; } catch (e) {
    if (e.code === 'login') { store.forget(); store.needLogin = true; } else toast(e.message, 'bad', 8000);
  }
}
/** โหลดข้อมูล — ถ้าเซิร์ฟเวอร์ต้องการให้เข้าสู่ระบบ (Google 1.0.1) จะเปิดหน้าต่างเข้าสู่ระบบก่อน */
async function initWithLogin() {
  try {
    await store.init();
  } catch (e) {
    if (e.code !== 'login') throw e;
    store.forget();
    store.needLogin = true;
    updateConn();
    view.innerHTML = `<div class="loading">${icon('lock')}กรุณาเข้าสู่ระบบ</div>`;
    await openLogin();
    view.innerHTML = `<div class="loading"><span class="spin"></span>กำลังโหลดข้อมูล…</div>`;
    await store.init();
  }
  store.needLogin = false;
}
window.addEventListener('pt:login-cancel', () => {
  view.innerHTML = `<section class="panel"><div class="empty">${emptyArt('lock')}<h3>ยังไม่ได้เข้าสู่ระบบ</h3>
    <p>ข้อมูลโครงการของทีมเก็บใน Google Drive ต้องยืนยันอีเมลก่อนจึงจะเห็นโครงการที่คุณเป็นสมาชิก</p>
    <div class="empty-actions"><button class="btn btn-primary" data-act="login">${icon('mail')}เข้าสู่ระบบด้วยอีเมล</button><a class="btn" href="#/settings">ตั้งค่าการเชื่อมต่อ</a></div></div></section>`;
  view.querySelector('[data-act="login"]').addEventListener('click', () => window.dispatchEvent(new Event('pt:relogin')));
});
window.addEventListener('pt:relogin', async () => {
  try { await initWithLogin(); updateConn(); route(); } catch (e) { toast(e.message, 'bad', 8000); }
});

// ---------- ต้อนรับผู้ใช้ใหม่ ----------
function welcome() {
  showIntro({
    onPick: (pick, { name, email }) => {
      conf.user = name || conf.user;
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) conf.email = email;
      conf.onboarded = true;
      saveConf();
      updateConn();
      if (pick === 'demo') { loadDemoData(); location.hash = '#/'; replayNext(); route(); }
      else if (pick === 'cloud') location.hash = '#/settings';
      else { replayNext(); route(); }
    },
  });
}
window.addEventListener('pt:intro', () => showIntro({ tour: true }));

// ---------- ซิงก์อัตโนมัติเมื่อกลับมาที่แท็บ ----------
let syncing = false;
async function autoSync() {
  if (!store.cloud || syncing || guard.dirty || document.querySelector('.modal-wrap, .present')) return;
  if (store.lastSync && Date.now() - store.lastSync < 30000) return; // 1.0.11: กลับมาที่แท็บหลัง 30 วินาที → ดึงข้อมูลล่าสุด
  syncing = true;
  try { await store.refresh(); updateConn(); if (!guard.dirty) route(); } catch (e) {
    if (e.code === 'login') { syncing = false; window.dispatchEvent(new Event('pt:relogin')); return; }
    store.online = false; updateConn();
  }
  syncing = false;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoSync(); });

// ---------- เริ่มต้น ----------
async function boot() {
  applyTheme();
  applyMotion();
  bindPointerFx();
  loadMascotPack();
  loadBrand();
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', applyMotion);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  renderShell();
  mountGuide();
  if ((location.hash || '').startsWith('#/connect')) {
    try { await store.init(); } catch { /* ignore */ }
    updateConn();
    handleConnect();
    return;
  }
  if (store.cloud) view.innerHTML = `<div class="loading"><span class="spin"></span>กำลังโหลดข้อมูลจาก ${esc(store.backendLabel)}…</div>`;
  if ((location.hash || '').startsWith('#/access/')) {
    await initQuiet(); updateConn(); current = location.hash; route(); return;
  }
  try {
    await initWithLogin();
  } catch (e) {
    if (e.code === 'setup_required' || e.code === 'auth_required') {
      toast(e.message, 'bad', 9000);
      if (!location.hash.startsWith('#/settings')) location.hash = '#/settings';
    } else if (e.code === 'login_required') {
      toast('ยังไม่ได้ลงชื่อเข้าใช้ Microsoft — แสดงข้อมูลที่บันทึกไว้ล่าสุด กด "ดึงข้อมูลล่าสุด" ที่หน้าตั้งค่าเพื่อลงชื่อเข้าใช้', 'info', 9000);
    } else {
      toast(`${e.message} — แสดงข้อมูลที่บันทึกไว้ล่าสุดแทน`, 'bad', 8000);
    }
  }
  updateConn();
  current = location.hash || '#/';
  route();
  if (!conf.onboarded && !store.cloud && !store.data.projects.length) welcome();
  autoJobs();
}

/** Microsoft 365: ส่งอีเมลตามรอบเมื่อผู้ดูแลระบบเปิดแอป (ถ้าผู้ดูแลเปิดตัวเลือกนี้) */
async function autoJobs() {
  try {
    if (!store.direct || !store.online || !store.settings.clientAutoSend || !store.settings.spMail) return;
    const due = store.pendingJobs();
    if (!due.length) return;
    const res = await store.runPendingJobs();
    const sent = Object.values(res).reduce((n, r) => n + (r.sent || 0), 0);
    toast(`ส่งอีเมลตามรอบแล้ว (${due.length} รายการ ถึง ${sent} คน)`, 'ok', 6000);
    window.dispatchEvent(new Event('pt:jobs'));
  } catch (e) { toast(`ส่งอีเมลตามรอบไม่สำเร็จ: ${e.message}`, 'bad', 8000); }
}

boot();
