// 1.0.17 ป้ายแสดงรายละเอียดงานก่อสร้าง (ตามตัวอย่างป้ายแนบท้ายสัญญา กฟผ.)
// - ข้อมูลหลักมาจากโครงการ (ชื่องาน ผู้รับจ้าง ราคางาน สัญญา วันเริ่ม/สิ้นสุด ผู้ควบคุมงาน) · ข้อมูลเสริมเก็บในโครงการ (p.sign)
// - พื้นสีน้ำเงิน ตัวอักษรและเส้นกรอบสีขาว · ขนาดตามราคางาน: < 50 ล้านบาท 1.20×2.40 ม. · > 50 ล้านบาท 2.40×4.80 ม. · ภายในอาคาร 0.60×1.20 ม.
// - ไฟล์ PDF ขนาดจริง (ภาพไม่บีบอัดแบบสูญเสีย แบ่งเป็นแผ่นย่อยตามความละเอียด) และ PNG สำหรับร้านทำป้าย
// - ตรา กฟผ.: ใช้ไฟล์ทางการเท่านั้น (ตราหน่วยงานของระบบ assets/brand หรือไฟล์ที่ผู้ใช้เลือก) — ระบบไม่วาดตราเอง
import { store } from './store.js';
import { esc, openModal, toast, setBusy, icon, download, confirmBox } from './ui.js';
import { FONTS_URL } from './forms.js';
import { buildPdf, canvasRgbFlate } from './pdf.js';
import { brandLogo } from './brand.js';
import { contractDays } from './calc.js';

const R = globalThis.PTRules;
const LOGO_KEY = 'pt.sign.logo';
const DRAFT = (pid) => `pt.sign.${pid || 'blank'}`;
const BLUE = '#0A3A8C';
const WHITE = '#FFFFFF';
const FONT = "'Sarabun', 'Anuphan', 'Tahoma', sans-serif";
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const thaiLong = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${+m[1] + 543}` : ''; };
const moneyTxt = (v) => (v === '' || v == null || !Number.isFinite(+v) ? '' : `${(+v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`);

/** ข้อมูลบนป้าย: จากโครงการ + ข้อมูลเสริม (p.sign) + ร่างในเครื่อง */
const NONE = '-'; // ช่องที่ผู้ใช้ลบค่าตั้งต้นออก (ไม่แสดงบนป้าย)
const DEFAULTED = ['by', 'rep', 'sup1', 'sup2', 'sup3'];
export function signData(p, extra = {}) {
  const s = { ...(p?.sign || {}), ...extra };
  const sups = p ? R.members(p).filter((m) => m.role === 'supervisor' || (m.role === 'owner' && R.ownerActsAs(p) === 'supervisor')).map((m) => R.memberName(p, m.email) || m.email) : [];
  if (p?.manager && !sups.includes(p.manager)) sups.unshift(p.manager);
  const days = p ? contractDays(p) : 0;
  return {
    name: p?.name || '', contractor: p?.contractor || '', value: moneyTxt(p?.contractValue), contractNo: p?.contractNo || '',
    days: days ? String(days) : '', start: thaiLong(p?.startDate), end: thaiLong(p?.endDate),
    by: s.by ?? 'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย',
    addr: s.addr || '', tel: s.tel || '', rep: s.rep ?? (p?.contractorRep || ''), repTel: s.repTel || '',
    eng: s.eng || '', engTel: s.engTel || '', safety: s.safety || '', safetyTel: s.safetyTel || '',
    sup1: s.sup1 ?? (sups[0] || ''), sup1Tel: s.sup1Tel || '', sup2: s.sup2 ?? (sups[1] || ''), sup2Tel: s.sup2Tel || '', sup3: s.sup3 ?? (sups[2] || ''), sup3Tel: s.sup3Tel || '',
    officeTel: s.officeTel || '', officeFax: s.officeFax || '',
    size: R.SIGN_SIZES[s.size] ? s.size : R.signSizeFor(p),
  };
}
/** ข้อมูลเสริมที่เก็บในโครงการ: เก็บเฉพาะที่ต่างจากค่าตั้งต้น (ชื่อผู้ควบคุมงานฯ ที่ดึงจากโครงการจะตามโครงการเสมอ) */
function signExtra(p, vals) {
  const base = signData(p ? { ...p, sign: {} } : null, {});
  const out = {};
  R.SIGN_KEYS.forEach((k) => {
    const v = String(vals[k] ?? '').trim();
    if (DEFAULTED.includes(k)) {
      if (v === (base[k] || '')) return;
      out[k] = v || NONE;
    } else if (k === 'size') { if (v && v !== R.signSizeFor({ ...(p || {}), sign: {} })) out[k] = v; } else if (v) out[k] = v;
  });
  return R.cleanSign(out);
}
const shown = (d) => { const o = { ...d }; Object.keys(o).forEach((k) => { if (o[k] === NONE) o[k] = ''; }); return o; };

// ---------- วาดป้าย (หน่วยฐาน 2400 × 1200 — ทุกขนาดสัดส่วน 2:1) ----------
function fit(g, text, maxW, size, weight = 400, min = 0.55) {
  let s = size;
  g.font = `${weight} ${s}px ${FONT}`;
  while (s > size * min && g.measureText(text).width > maxW) { s -= size * 0.03; g.font = `${weight} ${s}px ${FONT}`; }
  return s;
}
/** ตัดเป็นบรรทัดตามความกว้าง (ตัดที่ช่องว่าง ถ้าไม่มีช่องว่างตัดตามตัวอักษร) */
function wrap(g, text, maxW, maxLines) {
  const words = String(text).split(/(\s+)/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur + w;
    if (g.measureText(t).width <= maxW || !cur.trim()) { cur = t; continue; }
    lines.push(cur.trim()); cur = w.trimStart();
  }
  if (cur.trim()) lines.push(cur.trim());
  const out = [];
  for (const l of lines) {
    if (g.measureText(l).width <= maxW) { out.push(l); continue; }
    let part = '';
    for (const ch of Array.from(l)) { if (g.measureText(part + ch).width > maxW && part) { out.push(part); part = ch; } else part += ch; }
    if (part) out.push(part);
  }
  if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = `${out[maxLines - 1].replace(/\s*\S{0,3}$/, '')}…`; }
  return out;
}
/**
 * วาดป้ายลง canvas context — k = พิกเซลต่อหน่วยฐาน · ox/oy = เลื่อน (หน่วยฐาน) ใช้แบ่งแผ่นย่อย
 */
export function drawSign(g, d0, logo, { k = 1, ox = 0, oy = 0 } = {}) {
  const d = shown(d0);
  g.save();
  g.setTransform(k, 0, 0, k, -ox * k, -oy * k);
  g.fillStyle = BLUE;
  g.fillRect(0, 0, 2400, 1200);
  g.strokeStyle = WHITE; g.fillStyle = WHITE;
  g.textBaseline = 'alphabetic';
  // กรอบคู่
  g.lineWidth = 10; g.strokeRect(28, 28, 2344, 1144);
  g.lineWidth = 4; g.strokeRect(46, 46, 2308, 1108);
  const L = 46, Rx = 2354, T = 46;
  // แถบบน: ตรา + ออกแบบและดำเนินการโดย
  const topH = 290, logoW = 400;
  g.beginPath(); g.moveTo(L, T + topH); g.lineTo(Rx, T + topH); g.moveTo(L + logoW, T); g.lineTo(L + logoW, T + topH); g.stroke();
  if (logo) {
    const pad = 22, bw = logoW - pad * 2, bh = topH - pad * 2;
    g.fillStyle = WHITE;
    roundRect(g, L + pad, T + pad, bw, bh, 18); g.fill();
    const iw = logo.naturalWidth || logo.width, ih = logo.naturalHeight || logo.height;
    const sc = Math.min((bw - 24) / iw, (bh - 24) / ih);
    g.drawImage(logo, L + pad + (bw - iw * sc) / 2, T + pad + (bh - ih * sc) / 2, iw * sc, ih * sc);
    g.fillStyle = WHITE;
  }
  const tx = L + logoW + (Rx - L - logoW) / 2, tw = Rx - L - logoW - 80;
  g.textAlign = 'center';
  fit(g, 'ออกแบบและดำเนินการโดย', tw, 92, 700); g.fillText('ออกแบบและดำเนินการโดย', tx, T + 120);
  if (d.by) { fit(g, d.by, tw, 84, 700); g.fillText(d.by, tx, T + 238); }
  g.textAlign = 'left';
  // ข้อมูลงาน — ระยะบรรทัดคำนวณให้พอดีกรอบ (ชื่องานยาว 2 บรรทัด / ผู้ควบคุมงาน 1–3 คน)
  const lx = 84, vx = 520, right = Rx - 36, telX = 1640;
  const sups = [[d.sup1, d.sup1Tel], [d.sup2, d.sup2Tel], [d.sup3, d.sup3Tel]].filter(([n, t], i) => i === 0 || n || t);
  g.font = `700 52px ${FONT}`;
  const nameLines = d.name ? wrap(g, d.name, right - vx, 2) : [''];
  const rowsMid = 7 + nameLines.length, rowsBot = sups.length + 1;
  const h = Math.min(74, (1144 - (T + topH)) / (rowsMid + rowsBot + 0.55));
  const ls = h * 0.66, vs = h * 0.72; // ขนาดตัวอักษรหัวข้อ/ข้อมูล
  const label = (t, x, y, size = ls) => { g.font = `400 ${size}px ${FONT}`; g.fillText(t, x, y); return g.measureText(t).width; };
  const value = (t, x, y, maxW, size = vs) => { if (!t) return; fit(g, t, maxW, size, 700); g.fillText(t, x, y); };
  let y = T + topH + h * 0.92;
  label('งานก่อสร้าง', lx, y);
  g.font = `700 ${vs}px ${FONT}`;
  wrap(g, d.name, right - vx, 2).forEach((t, i) => { value(t, vx, y, right - vx); if (i === 0 && nameLines.length > 1) y += h; });
  y += h;
  label('ผู้รับจ้าง', lx, y); value(d.contractor, vx, y, right - vx);
  y += h;
  const wa = label('ที่อยู่', vx, y, ls * 0.95); value(d.addr, vx + wa + 20, y, telX - vx - wa - 50, vs * 0.95);
  const wt = label('โทรศัพท์', telX, y, ls * 0.95); value(d.tel, telX + wt + 20, y, right - telX - wt - 20, vs * 0.95);
  y += h;
  label('ราคางานก่อสร้าง', lx, y); value(d.value, vx, y, 1410 - vx);
  const wn = label('สัญญาเลขที่', 1440, y); value(d.contractNo, 1440 + wn + 24, y, right - 1440 - wn - 24);
  y += h;
  const w0 = label('ระยะเวลาก่อสร้าง', lx, y);
  value(d.days, lx + w0 + 22, y, 150);
  g.font = `700 ${vs}px ${FONT}`;
  label('วัน', lx + w0 + 22 + Math.min(150, d.days ? g.measureText(d.days).width : 60) + 20, y);
  const ws = label('วันเริ่มสัญญา', 830, y); value(d.start, 830 + ws + 20, y, 1410 - 830 - ws - 20);
  const we = label('วันสิ้นสุดสัญญา', 1440, y); value(d.end, 1440 + we + 20, y, right - 1440 - we - 20);
  [['ตัวแทนผู้รับจ้าง', d.rep, d.repTel], ['วิศวกรผู้รับจ้าง', d.eng, d.engTel], ['เจ้าหน้าที่ความปลอดภัย (จป.) ผู้รับจ้าง', d.safety, d.safetyTel]].forEach(([lb, v, t]) => {
    y += h;
    const w = label(lb, lx, y);
    const x0 = Math.max(vx, lx + w + 24);
    value(v, x0, y, telX - x0 - 30);
    const w2 = label('โทรศัพท์', telX, y); value(t, telX + w2 + 20, y, right - telX - w2 - 20);
  });
  // ผู้ควบคุมงานและเจ้าหน้าที่ความปลอดภัย กฟผ.
  const lineY = y + h * 0.42;
  g.lineWidth = 4; g.beginPath(); g.moveTo(L, lineY); g.lineTo(Rx, lineY); g.stroke();
  y = lineY + h * 0.95;
  const sx = 1010;
  label('ผู้ควบคุมงานและเจ้าหน้าที่ความปลอดภัย กฟผ.', lx, y, ls * 0.95);
  sups.forEach(([n, t], i) => {
    if (i) y += h;
    const wi = label(`${i + 1}.`, sx, y); value(n, sx + wi + 18, y, telX - sx - wi - 48);
    const w2 = label('โทรศัพท์', telX, y); value(t, telX + w2 + 20, y, right - telX - w2 - 20);
  });
  y += h;
  label('สำนักงานสนาม', lx, y);
  const wo = label('โทรศัพท์', sx, y); value(d.officeTel, sx + wo + 20, y, telX - sx - wo - 50);
  const wf = label('โทรสาร', telX, y); value(d.officeFax, telX + wf + 20, y, right - telX - wf - 20);
  g.restore();
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------- ฟอนต์และตรา ----------
let fontReady = null;
function loadFonts() {
  if (!fontReady) {
    fontReady = (async () => {
      if (!document.querySelector(`link[data-sign-font]`)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = FONTS_URL; l.setAttribute('data-sign-font', '1');
        document.head.appendChild(l);
      }
      try { await Promise.race([Promise.all([document.fonts.load(`700 60px Sarabun`), document.fonts.load(`400 60px Sarabun`)]), new Promise((r) => setTimeout(r, 5000))]); } catch { /* ใช้ฟอนต์สำรอง */ }
    })();
  }
  return fontReady;
}
function loadImage(src) {
  return new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => bad(new Error('โหลดภาพตราไม่ได้')); im.src = src; });
}
function savedLogo() { try { const v = localStorage.getItem(LOGO_KEY); return v && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : ''; } catch { return ''; } }

// ---------- ไฟล์ส่งร้านทำป้าย ----------
/** PDF ขนาดจริง: แบ่งเป็นแผ่นย่อยให้ได้ความละเอียดราว 100 dpi ที่ขนาด 2.40 ม. (ไม่เกิน 3×3 แผ่น) */
export async function signPdf(d, logo, { onProgress } = {}) {
  const size = R.SIGN_SIZES[d.size] || R.SIGN_SIZES.s;
  const ptW = (size.w / 25.4) * 72, ptH = (size.h / 25.4) * 72;
  const tilesX = Math.min(3, Math.max(1, Math.ceil(((size.w / 25.4) * 100) / 5000)));
  const tilesY = tilesX;
  const TW = 5000, TH = 2500; // พิกเซลต่อแผ่นย่อย (พื้นที่ภาพต่อ canvas ไม่เกินที่ Safari รับได้)
  const k = (TW * tilesX) / 2400;
  const images = [];
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  const g = c.getContext('2d');
  let n = 0;
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      n++;
      onProgress?.(`กำลังสร้างแผ่นที่ ${n}/${tilesX * tilesY}`);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, TW, TH);
      drawSign(g, d, logo, { k, ox: (2400 / tilesX) * tx, oy: (1200 / tilesY) * ty });
      await new Promise((r) => setTimeout(r, 0));
      let rgb;
      try { rgb = await canvasRgbFlate(c); } catch (e) {
        if (e?.name === 'SecurityError') throw new Error('เบราว์เซอร์ไม่ให้อ่านภาพป้ายที่มีไฟล์ตรานี้ — ลองเลือกไฟล์ตราเป็น PNG');
        throw e;
      }
      const box = { x: (ptW / tilesX) * tx, y: (ptH / tilesY) * ty, w: ptW / tilesX, h: ptH / tilesY };
      if (rgb) images.push({ ...box, rgb });
      else {
        const u = c.toDataURL('image/jpeg', 0.95);
        const b = atob(u.split(',')[1]); const bytes = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
        images.push({ ...box, jpeg: bytes });
      }
    }
  }
  c.width = c.height = 1;
  return buildPdf([{ w: ptW, h: ptH, images }], { title: `ป้ายแสดงรายละเอียดงานก่อสร้าง ${d.name}` });
}
export async function signPng(d, logo) {
  const c = document.createElement('canvas');
  c.width = 5600; c.height = 2800;
  drawSign(c.getContext('2d'), d, logo, { k: 5600 / 2400 });
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  c.width = c.height = 1;
  return blob;
}
// ชื่อไฟล์ภาษาอังกฤษ/ตัวเลข (บางเบราว์เซอร์ไม่รับชื่อไฟล์ภาษาไทยตอนดาวน์โหลด) เช่น project-sign-CN-69-014-120x240cm
const fileBase = (d, p) => {
  const sz = R.SIGN_SIZES[d.size] || R.SIGN_SIZES.s;
  const code = String(p?.code || '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `project-sign${code ? `-${code}` : ''}-${sz.h / 10}x${sz.w / 10}cm`;
};

// ---------- หน้าต่างทำป้าย ----------
const FIELDS = [
  ['by', 'ออกแบบและดำเนินการโดย', 'เช่น การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย'],
  ['addr', 'ที่อยู่ผู้รับจ้าง', ''], ['tel', 'โทรศัพท์ผู้รับจ้าง', ''],
  ['rep', 'ตัวแทนผู้รับจ้าง', ''], ['repTel', 'โทรศัพท์', ''],
  ['eng', 'วิศวกรผู้รับจ้าง', ''], ['engTel', 'โทรศัพท์', ''],
  ['safety', 'เจ้าหน้าที่ความปลอดภัย (จป.) ผู้รับจ้าง', ''], ['safetyTel', 'โทรศัพท์', ''],
  ['sup1', 'ผู้ควบคุมงาน/จป. กฟผ. 1', ''], ['sup1Tel', 'โทรศัพท์', ''],
  ['sup2', 'ผู้ควบคุมงาน/จป. กฟผ. 2', ''], ['sup2Tel', 'โทรศัพท์', ''],
  ['sup3', 'ผู้ควบคุมงาน/จป. กฟผ. 3', ''], ['sup3Tel', 'โทรศัพท์', ''],
  ['officeTel', 'สำนักงานสนาม โทรศัพท์', ''], ['officeFax', 'โทรสาร', ''],
];
export function openSignMaker(p) {
  let draft = {};
  try { draft = JSON.parse(localStorage.getItem(DRAFT(p?.id)) || '{}') || {}; } catch { draft = {}; }
  let d = shown(signData(p, R.cleanSign(draft)));
  const canSave = !!p && store.can(p, 'editProject') && !(store.mode === 'gas' && store.serverOutdated('1.0.17'));
  const bl = brandLogo();
  let logoSrc = bl?.src || savedLogo();
  const proj = [['งานก่อสร้าง', d.name], ['ผู้รับจ้าง', d.contractor], ['ราคางานก่อสร้าง', d.value], ['สัญญาเลขที่', d.contractNo], ['ระยะเวลาก่อสร้าง', d.days ? `${d.days} วัน` : ''], ['วันเริ่ม – สิ้นสุดสัญญา', d.start || d.end ? `${d.start || '–'} – ${d.end || '–'}` : '']];
  const missing = proj.filter(([, v]) => !v).map(([k]) => k);
  const m = openModal({
    title: `ป้ายแสดงรายละเอียดงานก่อสร้าง${p ? ` — ${p.code ? `${p.code} ` : ''}${p.name}` : ''}`,
    size: 'xl',
    body: `<div class="sgm">
      <div class="sgm-prev"><canvas id="sgm-cv" width="1200" height="600" aria-label="ภาพตัวอย่างป้าย" role="img"></canvas>
        <p class="hint">${icon('alert')}พื้นสีน้ำเงิน ตัวอักษรและเส้นกรอบสีขาว ตามหมายเหตุในตัวอย่างป้ายแนบท้ายสัญญา · งานที่ยาว (ถนน รางระบายน้ำ) ติดตั้งที่จุดเริ่มต้นและจุดสิ้นสุด อย่างน้อย 2 จุด</p>
        <div class="sgm-logo" id="sgm-logo"></div></div>
      <form class="form sgm-form" id="sgm-f" novalidate>
        <div class="field"><span>ขนาดป้าย</span><select name="size">${Object.entries(R.SIGN_SIZES).map(([k, v]) => `<option value="${k}"${k === d.size ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>
        <div class="sgm-proj"><b>ข้อมูลจากโครงการ</b>${p ? ` <a href="#/p/${encodeURIComponent(p.id)}/settings" data-close>แก้ที่ตั้งค่าโครงการ</a>` : ''}
          <dl>${proj.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v ? esc(v) : '<span class="is-bad">ยังไม่มี</span>'}</dd></div>`).join('')}</dl></div>
        <div class="sgm-grid">${FIELDS.map(([k, l, ph]) => `<label class="field${/Tel|Fax/.test(k) ? ' sgm-tel' : ''}"><span>${esc(l)}</span><input name="${k}" value="${esc(d[k] || '')}" maxlength="200"${ph ? ` placeholder="${esc(ph)}"` : ''}${/Tel|Fax/.test(k) ? ' inputmode="tel"' : ''}></label>`).join('')}</div>
      </form></div>`,
    footer: `${missing.length ? `<span class="muted small sgm-miss">${icon('alert')}ข้อมูลโครงการยังไม่ครบ: ${esc(missing.join(', '))}</span>` : ''}
      <button class="btn" data-close>ปิด</button>
      ${canSave ? `<button class="btn" data-act="save">${icon('check')}บันทึกข้อมูลป้าย</button>` : ''}
      <button class="btn" data-act="png">${icon('image')}PNG</button>
      <button class="btn btn-primary" data-act="pdf">${icon('file')}PDF ขนาดจริง</button>`,
  });
  const form = m.el.querySelector('#sgm-f');
  const cv = m.el.querySelector('#sgm-cv');
  let logo = null;
  const read = () => {
    const extra = {};
    R.SIGN_KEYS.forEach((k) => { if (form.elements[k]) extra[k] = form.elements[k].value.trim(); });
    return extra;
  };
  const redraw = () => {
    d = { ...signData(p, {}), ...read() };
    d.size = R.SIGN_SIZES[d.size] ? d.size : R.signSizeFor(p);
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    drawSign(g, d, logo, { k: cv.width / 2400 });
  };
  const logoBox = m.el.querySelector('#sgm-logo');
  const drawLogoBox = () => {
    logoBox.innerHTML = `${logo ? `<span class="tag tag-ok">${icon('check')}ใส่ตราแล้ว${bl && logoSrc === bl.src ? ' (ตราหน่วยงานของระบบ)' : ''}</span>` : `<span class="tag tag-bad">${icon('alert')}ยังไม่มีตรา กฟผ.</span>`}
      <label class="btn btn-sm">${icon('upload')}${logo ? 'เปลี่ยนไฟล์ตรา' : 'เลือกไฟล์ตราทางการ (PNG/JPG)'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden id="sgm-lf"></label>
      ${logo && !(bl && logoSrc === bl.src) ? '<button type="button" class="btn btn-sm btn-ghost" data-act="nologo">เอาตราออก</button>' : ''}
      <small class="muted">ใช้ไฟล์ตราที่ได้รับจากหน่วยงานเท่านั้น — ผู้ดูแลระบบใส่ตราประจำระบบได้ที่ assets/brand</small>`;
  };
  const setLogo = async (src) => {
    logoSrc = src;
    try { logo = src ? await loadImage(src) : null; } catch { logo = null; toast('เปิดไฟล์ตรานี้ไม่ได้', 'bad'); }
    drawLogoBox(); redraw();
  };
  form.addEventListener('input', () => {
    try { localStorage.setItem(DRAFT(p?.id), JSON.stringify(signExtra(p, read()))); } catch { /* ไม่จำร่าง */ }
    redraw();
  });
  form.addEventListener('change', () => redraw());
  logoBox.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 3 * 1048576) { toast('ใช้ไฟล์ PNG/JPG/WebP ขนาดไม่เกิน 3 MB', 'bad'); return; }
    const r = new FileReader();
    r.onload = () => {
      const u = String(r.result);
      try { if (u.length < 4500000) localStorage.setItem(LOGO_KEY, u); } catch { /* จำไม่ได้ก็ใช้ครั้งนี้ */ }
      setLogo(u);
    };
    r.readAsDataURL(f);
  });
  logoBox.addEventListener('click', (e) => {
    if (!e.target.closest('[data-act="nologo"]')) return;
    try { localStorage.removeItem(LOGO_KEY); } catch { /* ไม่มี */ }
    setLogo(bl?.src || '');
  });
  const busy = async (btn, label, fn) => {
    const old = btn.innerHTML;
    setBusy(btn, true, label);
    try { await fn((t) => { btn.innerHTML = `<span class="spin"></span>${esc(t)}…`; }); } catch (ex) { toast(ex.message || String(ex), 'bad', 7000); } finally { setBusy(btn, false); btn.innerHTML = old; }
  };
  m.el.querySelector('[data-act="pdf"]').addEventListener('click', (e) => busy(e.currentTarget, 'กำลังสร้าง PDF…', async (prog) => {
    redraw();
    if (!logo && !(await confirmNoLogo())) return;
    const blob = await signPdf(d, logo, { onProgress: prog });
    download(`${fileBase(d, p)}.pdf`, blob, 'application/pdf');
    toast('ดาวน์โหลดไฟล์ PDF ขนาดจริงแล้ว — ส่งร้านทำป้ายได้เลย', 'ok', 6000);
  }));
  m.el.querySelector('[data-act="png"]').addEventListener('click', (e) => busy(e.currentTarget, 'กำลังสร้าง PNG…', async () => {
    redraw();
    if (!logo && !(await confirmNoLogo())) return;
    download(`${fileBase(d, p)}.png`, await signPng(d, logo), 'image/png');
  }));
  m.el.querySelector('[data-act="save"]')?.addEventListener('click', (e) => busy(e.currentTarget, 'กำลังบันทึก…', async () => {
    const cur = store.project(p.id);
    await store.saveProject({ ...cur, sign: signExtra(cur, read()) }, { invite: false });
    try { localStorage.removeItem(DRAFT(p.id)); } catch { /* ไม่มี */ }
    toast('บันทึกข้อมูลป้ายในโครงการแล้ว (ใช้ในแบบฟอร์มที่เกี่ยวข้องด้วย)');
  }));
  function confirmNoLogo() {
    return confirmBox({ title: 'ป้ายยังไม่มีตรา กฟผ.', message: 'สร้างไฟล์โดยเว้นช่องตราไว้ (ให้ร้านทำป้ายใส่ตราทางการให้) หรือกดยกเลิกแล้วเลือกไฟล์ตราทางการก่อน', ok: 'สร้างไฟล์ต่อ' });
  }
  drawLogoBox();
  redraw();
  loadFonts().then(redraw);
  if (logoSrc) setLogo(logoSrc);
  return m;
}
