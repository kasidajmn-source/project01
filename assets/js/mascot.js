// มาสคอตของระบบ (1.0.9)
// - ภาพหลัก: ชุดภาพของหน่วยงานใน assets/mascot/custom/ (ปัจจุบันคือ "น้อง ENGY" ของ กฟผ.) — ขยับด้วย CSS ทั้งภาพตามท่า
// - ภาพสำรอง: "น้องดิ่ง" ลูกดิ่งสวมหมวกนิรภัย (SVG ในไฟล์นี้) ใช้เมื่อปิดชุดภาพ ไฟล์ตั้งค่าเสีย หรือโหลดภาพไม่ได้
// ขยับตามบริบท: สอนการใช้งาน ทักทายที่หน้าหลัก หน้าว่าง บันทึกสำเร็จ หน้าผิดพลาด หน้าแนะนำ
// ความปลอดภัย: ไฟล์ตั้งค่ารับเฉพาะชื่อไฟล์ภาพในโฟลเดอร์เดียวกัน แสดงด้วย <img> (สคริปต์ใน SVG ไม่ทำงาน) — ดู README ในโฟลเดอร์
import { conf, saveConf } from './config.js';

/** ท่าหลัก (น้องดิ่งวาดได้ทุกท่า) */
export const POSES = ['idle', 'wave', 'point', 'cheer', 'think', 'oops'];
/** ท่าตามบริบทเพิ่มเติม (ใช้เมื่อชุดภาพมีให้ ไม่มีก็ใช้ท่าใกล้เคียง) */
export const EXTRA_POSES = ['welcome', 'wai', 'present', 'ok', 'search', 'busy', 'strong', 'love', 'relax'];
export const ALL_POSES = POSES.concat(EXTRA_POSES);
/** ถ้าไม่มีท่าที่ต้องการ ใช้ท่าถัดไปตามลำดับนี้ */
const FALLBACK = {
  welcome: 'wave', wai: 'wave', present: 'point', ok: 'cheer', love: 'cheer', strong: 'cheer',
  search: 'think', busy: 'think', relax: 'idle', wave: 'idle', point: 'idle', cheer: 'ok', think: 'idle', oops: 'idle',
};
const DIR = 'assets/mascot/custom/';
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,59}\.(png|svg|webp|gif)$/i;
let pack = null; // { name, poses: { pose: url } }
let packLoad = null;
let uid = 0;
const broken = new Set(); // ภาพที่โหลดไม่ได้ → ใช้น้องดิ่งแทนเฉพาะท่านั้น

const escA = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** ค่าตั้งของมาสคอตในเครื่องนี้ — ป้องกันค่าที่ผิดรูปแบบใน localStorage */
function mconf() {
  if (!conf.mascot || typeof conf.mascot !== 'object' || Array.isArray(conf.mascot)) conf.mascot = {};
  return conf.mascot;
}
export const mascotOn = () => mconf().off !== true;
export function setMascotOn(v) {
  mconf().off = !v;
  saveConf();
  document.documentElement.toggleAttribute('data-no-mascot', !v);
  window.dispatchEvent(new CustomEvent('pt:mascot'));
}
export const mascotName = () => (pack && pack.name) || 'น้องดิ่ง';
export const hasCustomPack = () => !!pack;

/** ท่าที่ใช้จริง: ท่าที่ขอ → ท่าใกล้เคียงที่มีภาพ → idle */
export function resolvePose(pose, avail) {
  let p = ALL_POSES.includes(pose) ? pose : 'idle';
  for (let i = 0; i < 6 && !avail(p); i++) p = FALLBACK[p] || 'idle';
  return avail(p) ? p : 'idle';
}
const packHas = (p) => !!pack && has(pack.poses, p) && !broken.has(pack.poses[p]);
const svgHas = (p) => POSES.includes(p);

function pickFiles(src) {
  const out = {};
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
  for (const k of ALL_POSES) {
    const f = has(src, k) ? src[k] : null;
    if (typeof f === 'string' && FILE_RE.test(f)) out[k] = DIR + f;
  }
  return out;
}
/**
 * ตรวจไฟล์ตั้งค่าภาพมาสคอตของหน่วยงาน
 * { "enabled": true, "name": "ชื่อ", "poses": { "idle": "idle.png", ... }, "ribbon": false, "ribbonPoses": { "idle": "..." } }
 * รับเฉพาะชื่อไฟล์ .png .svg .webp .gif ในโฟลเดอร์เดียวกัน (ห้ามมี / หรือ .. หรือที่อยู่เว็บอื่น) ต้องมีท่า idle เป็นอย่างน้อย
 * ribbon: true = ช่วงไว้ทุกข์ ใช้เฉพาะภาพติดริบบิ้น (ท่าที่ไม่มีภาพริบบิ้นจะใช้ท่าใกล้เคียงจากชุดริบบิ้น)
 */
export function parsePack(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j) || j.enabled !== true) return null;
  let poses = pickFiles(j.poses);
  if (j.ribbon === true) {
    const rb = pickFiles(j.ribbonPoses);
    if (rb.idle) poses = rb;
  }
  if (!poses.idle) return null;
  const name = typeof j.name === 'string' ? j.name.replace(/[\u0000-\u001f\u007f-\u009f<>"'`&]/g, '').trim().slice(0, 30) : '';
  return { name: name || 'มาสคอต', poses };
}

/** โหลดภาพของหน่วยงาน (ถ้ามี) ครั้งเดียว — ระหว่างรอ ซ่อนมาสคอตไว้ไม่ให้เห็นภาพสลับ */
export function loadMascotPack() {
  if (packLoad) return packLoad;
  const root = document.documentElement;
  root.toggleAttribute('data-no-mascot', !mascotOn());
  const ready = () => root.setAttribute('data-msc-ready', '');
  const guard = setTimeout(ready, 2500); // เครือข่ายช้า: แสดงน้องดิ่งไปก่อน
  packLoad = fetch(DIR + 'mascot.json', { cache: 'no-cache', credentials: 'same-origin', redirect: 'error' })
    .then((r) => (r.ok && /json|text\/plain/.test(r.headers.get('content-type') || 'application/json') ? r.json() : null))
    .then((j) => {
      pack = parsePack(j);
      if (pack) document.querySelectorAll('.mascot').forEach((el) => repaint(el));
      if (pack) window.dispatchEvent(new CustomEvent('pt:mascot-pack'));
      return pack;
    })
    .catch(() => null)
    .finally(() => { clearTimeout(guard); ready(); });
  // ภาพโหลดไม่ได้ → ใช้ท่าใกล้เคียง/น้องดิ่งแทน (ไม่ใช้ onerror ในแท็ก เพราะ CSP ห้ามสคริปต์ในบรรทัด)
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || !img.classList || !img.classList.contains('msc-img')) return;
    broken.add(img.getAttribute('src'));
    const el = img.closest('.mascot');
    if (el) repaint(el);
  }, true);
  return packLoad;
}

/** ภาพลูกดิ่ง — ทุกท่าใช้ภาพชุดเดียวกัน ท่าทางกำหนดด้วย CSS ตามคลาส is-<pose> */
function svgArt() {
  const n = ++uid;
  return `<svg class="msc-svg" viewBox="0 0 120 160" focusable="false" aria-hidden="true">
  <defs>
    <linearGradient id="msc-b${n}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F7843F"/><stop offset=".5" stop-color="#E8590C"/><stop offset="1" stop-color="#B9410A"/></linearGradient>
    <linearGradient id="msc-h${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE3EC"/></linearGradient>
  </defs>
  <g class="msc-line"><line x1="60" y1="-600" x2="60" y2="20"/><circle cx="60" cy="22" r="3.6"/></g>
  <g class="msc-body">
    <path class="msc-bob" fill="url(#msc-b${n})" d="M28 60C28 50 40 45 60 45C80 45 92 50 92 60V86C92 103 73 123 63 139H57C47 123 28 103 28 86Z"/>
    <path class="msc-shine" d="M36 64C36 58 41 54 47 53"/>
    <path class="msc-band" d="M31 100C45 105 75 105 89 100"/>
    <path class="msc-tip" d="M55.5 138L60 152L64.5 138Z"/>
    <g class="msc-hat">
      <path fill="url(#msc-h${n})" d="M33 51C33 35 45 26 60 26C75 26 87 35 87 51Z"/>
      <path class="msc-ridge" d="M60 27V50M49 30V49M71 30V49"/>
      <rect x="25" y="48.5" width="70" height="7" rx="3.5" fill="#FFFFFF"/>
    </g>
    <g class="msc-face">
      <g class="msc-eyes"><ellipse cx="47" cy="72" rx="4.6" ry="5.8"/><ellipse cx="73" cy="72" rx="4.6" ry="5.8"/><circle class="msc-glint" cx="48.6" cy="69.6" r="1.6"/><circle class="msc-glint" cx="74.6" cy="69.6" r="1.6"/></g>
      <g class="msc-happy"><path d="M42 74Q47 67 52 74"/><path d="M68 74Q73 67 78 74"/></g>
      <g class="msc-brows"><path d="M41 61.5L52 60"/><path d="M79 61.5L68 60"/></g>
      <ellipse class="msc-cheek" cx="39" cy="82" rx="4.4" ry="3"/><ellipse class="msc-cheek" cx="81" cy="82" rx="4.4" ry="3"/>
      <path class="msc-mouth m-smile" d="M53 83Q60 90 67 83"/>
      <path class="msc-mouth m-open" d="M52 81.5Q60 96 68 81.5Z"/>
      <ellipse class="msc-mouth m-o" cx="60" cy="86" rx="3.4" ry="4"/>
    </g>
    <g class="msc-arm msc-arm-l"><path d="M31 69Q20 77 15 89"/><circle cx="14.5" cy="91" r="5.2"/></g>
    <g class="msc-arm msc-arm-r"><path d="M89 69Q100 77 105 89"/><circle cx="105.5" cy="91" r="5.2"/></g>
  </g>
  <g class="msc-fx msc-fx-cheer"><path d="M12 30l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/><path d="M104 22l2.4 4.6 4.6 2.4-4.6 2.4-2.4 4.6-2.4-4.6-4.6-2.4 4.6-2.4z"/><path d="M110 64l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></g>
  <g class="msc-fx msc-fx-think"><circle cx="100" cy="40" r="2.6"/><circle cx="106" cy="31" r="3.4"/><text x="104" y="22" text-anchor="middle">?</text></g>
  <g class="msc-fx msc-fx-oops"><path d="M98 52C98 52 92 60 92 64A6 6 0 0 0 104 64C104 60 98 52 98 52Z"/></g>
</svg>`;
}

/** HTML ของภาพตามท่าที่ขอ → { html, pose (ท่าที่ใช้จริง), img } */
function art(want) {
  if (pack) {
    const p = resolvePose(want, packHas);
    if (packHas(p)) return { pose: p, img: true, html: `<img class="msc-img" src="${escA(pack.poses[p])}" alt="" width="360" height="360" draggable="false" decoding="async">` };
  }
  return { pose: resolvePose(want, svgHas), img: false, html: svgArt() };
}

function apply(el, a) {
  ALL_POSES.forEach((k) => el.classList.remove(`is-${k}`));
  el.classList.add(`is-${a.pose}`);
  el.classList.toggle('is-pack', a.img);
  el.dataset.pose = a.pose;
}

function repaint(el) {
  const a = art(el.dataset.want || el.dataset.pose || 'idle');
  const box = el.querySelector('.msc-art');
  if (box) box.innerHTML = a.html;
  apply(el, a);
}

/**
 * HTML ของมาสคอต — คืนค่าว่างเมื่อผู้ใช้ปิดมาสคอตไว้ (ผู้เรียกต้องมีสิ่งแทน เช่น ไอคอนเดิม)
 * pose: ท่าหลักหรือท่าตามบริบท (ALL_POSES) · size: xs | sm | md | lg | xl · hang: ห้อยจากเชือก (เฉพาะน้องดิ่ง) · flip: หันไปทางซ้าย (เฉพาะน้องดิ่ง — ไม่กลับภาพของหน่วยงานเพราะตัวอักษรบนภาพจะกลับด้าน)
 */
export function mascot({ pose = 'idle', size = 'md', hang = false, flip = false, cls = '', force = false } = {}) {
  if (!force && !mascotOn()) return '';
  const want = ALL_POSES.includes(pose) ? pose : 'idle';
  const a = art(want);
  return `<span class="mascot msc-${escA(size)} is-${a.pose}${hang ? ' is-hang' : ''}${flip ? ' is-flip' : ''}${a.img ? ' is-pack' : ''}${cls ? ` ${escA(cls)}` : ''}" data-pose="${a.pose}" data-want="${want}" aria-hidden="true"><span class="msc-art">${a.html}</span></span>`;
}

/** เปลี่ยนท่าของมาสคอตที่อยู่บนจอ */
export function setPose(el, pose, { flip } = {}) {
  if (!el) return;
  const want = ALL_POSES.includes(pose) ? pose : 'idle';
  const old = el.dataset.pose;
  el.dataset.want = want;
  if (flip != null) el.classList.toggle('is-flip', !!flip);
  const a = art(want);
  if (a.img || old !== a.pose) { const box = el.querySelector('.msc-art'); if (box && (a.img || !box.querySelector('svg'))) box.innerHTML = a.html; }
  apply(el, a);
  // เล่นท่าใหม่ตั้งแต่ต้น
  el.classList.remove('is-replay'); void el.offsetWidth; el.classList.add('is-replay');
}

// ---------- คำทักทายที่หน้าหลัก (วันละครั้งต่อผู้ใช้) ----------
const thaiDay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const gkey = (who) => `u:${String(who).slice(0, 200)}`; // ขึ้นต้นด้วย u: กันชื่อคีย์พิเศษ เช่น __proto__
export function greetDue(who) {
  if (!mascotOn()) return false;
  const g = mconf().greet;
  return !(g && typeof g === 'object' && !Array.isArray(g) && Object.prototype.hasOwnProperty.call(g, gkey(who)) && g[gkey(who)] === thaiDay());
}
export function greetDone(who) {
  const m = mconf();
  if (!m.greet || typeof m.greet !== 'object' || Array.isArray(m.greet)) m.greet = {};
  const k = gkey(who);
  delete m.greet[k];
  m.greet[k] = thaiDay();
  // เก็บเฉพาะ 20 ผู้ใช้ล่าสุด (คีย์ที่ใส่ล่าสุดอยู่ท้าย)
  const keys = Object.keys(m.greet);
  if (keys.length > 20) keys.slice(0, keys.length - 20).forEach((x) => delete m.greet[x]);
  saveConf();
}
export function greetWord() {
  const h = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  return h < 11 ? 'สวัสดีตอนเช้า' : h < 13 ? 'สวัสดีตอนเที่ยง' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
}

// ---------- ฉลองเล็กๆ ตอนบันทึกสำเร็จ (ไม่บ่อยเกินไป) ----------
let lastCheer = 0;
export function cheerAllowed(gap = 120000) {
  if (!mascotOn()) return false;
  const now = Date.now();
  if (now - lastCheer < gap) return false;
  lastCheer = now;
  return true;
}
