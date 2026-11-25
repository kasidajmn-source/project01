// 1.0.15 รายงานประจำวัน → ไฟล์ PDF ในแท็บเอกสาร (หมวด "รายงานประจำวัน/สัปดาห์")
// - บันทึกรายงานแล้วสร้างให้อัตโนมัติ (ลงลายมือชื่อที่จำไว้ในเครื่องได้)
// - หรือเปิดแบบฟอร์ม ลงชื่อ/แก้ แล้วกด "บันทึกเข้าเอกสาร" ในหน้าต่างแบบฟอร์ม
import { store, DAILY_DOC_CATEGORY } from './store.js';
import { formHtml, FONTS_URL, FORMS, dailyPhotos, openForm } from './forms.js';
import { sheetsToPdf, sheetsToHtml, shrinkImage, blobToDataUrl } from './pdf.js';

const R = globalThis.PTRules;
const SIG_KEY = 'pt.sig';
const SIG_PREF = 'pt.sig.remember';

/** ลายเซ็นที่จำไว้ในเครื่องนี้ (ตั้งจากหน้าต่างแบบฟอร์มหรือหน้ารายงานประจำวัน) */
export function savedSignature() {
  try { const v = localStorage.getItem(SIG_KEY); return v && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 700000 ? v : ''; } catch { return ''; }
}
export function rememberSignature(dataUrl) {
  try {
    if (!dataUrl) { localStorage.removeItem(SIG_KEY); return true; }
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl) || dataUrl.length >= 700000) return false;
    localStorage.setItem(SIG_KEY, dataUrl);
    localStorage.setItem(SIG_PREF, '1');
    return true;
  } catch { return false; }
}

/** แบบฟอร์มของรายงานชนิดนี้ */
export const dailyForm = (d) => (R.dailyKind(d) === 'contractor' ? 'cdaily' : 'daily');

/** ชื่อไฟล์ เช่น "FM-002 บันทึกการควบคุมงานประจำวัน 2026-11-17 PRJ-01.pdf" */
export function dailyDocName(p, d, ext = 'pdf') {
  const f = FORMS[dailyForm(d)];
  const t = R.dailyKind(d) === 'contractor' ? 'Daily Report and Daily Request' : f.title;
  const code = String(p?.code || '').replace(/[^\w.-]+/g, '').slice(0, 30);
  return `${f.short || f.code} ${t} ${d.date}${code ? ` ${code}` : ''}.${ext}`.replace(/[\\/:*?"<>|]+/g, '-');
}

/** ช่องลงชื่อของผู้ใช้: FM-002 = ผู้ควบคุมงาน · PT-F07 = วิศวกรโครงการ (ผู้รับจ้าง) หรือผู้ควบคุมงาน (ช่องสุดท้าย) */
function signSlot(doc, p, d) {
  const slots = [...doc.querySelectorAll('.sheets [data-sign]')];
  if (!slots.length) return null;
  if (dailyForm(d) === 'daily') return slots[0];
  return store.isContractorOf(p) ? slots[0] : slots[slots.length - 1];
}
function putSignature(slot, src) {
  if (!slot || !src) return;
  let img = slot.querySelector('img');
  if (!img) { img = slot.ownerDocument.createElement('img'); img.className = 'sg-img'; img.alt = 'ลายมือชื่อ'; slot.appendChild(img); }
  img.src = src;
  slot.classList.add('has');
}

/** รูปของรายงาน (ตามลำดับช่องภาพประกอบ) → data URL — ไม่ได้ = '' */
async function photoData(f) {
  try {
    const b = await store.fileBlob(f);
    if (b) return await shrinkImage(b);
  } catch { /* ใช้รูปย่อแทน */ }
  try {
    const u = await store.thumbUrl(f);
    if (u && /^(blob:|data:image\/)/.test(u)) {
      if (u.startsWith('data:')) return u;
      const r = await fetch(u);
      return r.ok ? await shrinkImage(await r.blob()) : '';
    }
  } catch { /* ไม่มีรูป */ }
  return '';
}

/** ใช้กับหน้าต่างแบบฟอร์มที่มีรูปจากระบบ (รูปย่อจากโดเมนอื่นแปลงเป็นภาพในไฟล์ไม่ได้) → ดึงรูปเต็มจากระบบแทน */
function photoResolver(d) {
  const photos = new Map(dailyPhotos(d).map(([i, f]) => [String(i), f]));
  return async (liveImg) => {
    const cell = liveImg?.closest?.('[data-photo]');
    const f = cell ? photos.get(cell.getAttribute('data-photo')) : null;
    return f ? photoData(f) : '';
  };
}

/** สร้างหน้าแบบฟอร์มในกรอบที่มองไม่เห็น (ไม่โหลดตัวกรอกแบบฟอร์ม จึงไม่ใช้ร่างที่ค้างในเครื่อง) */
async function hiddenForm(form, ctx) {
  const fr = document.createElement('iframe');
  fr.setAttribute('aria-hidden', 'true');
  fr.tabIndex = -1;
  fr.title = 'สร้างไฟล์ PDF';
  fr.style.cssText = 'position:fixed;left:-12000px;top:0;width:1000px;height:1400px;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(fr);
  const doc = fr.contentDocument;
  const loaded = new Promise((res) => { fr.addEventListener('load', res, { once: true }); setTimeout(res, 8000); });
  doc.open();
  doc.write(formHtml(form, ctx));
  doc.close();
  await loaded;
  try { await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 6000))]); } catch { /* ใช้ฟอนต์ที่มี */ }
  return { fr, doc };
}

/**
 * ไฟล์ของหน้าแบบฟอร์มใน doc → Blob PDF
 * เบราว์เซอร์ที่วาดภาพจากหน้าเว็บไม่ได้ (เช่น Safari) และใช้ Google Drive (Code.gs 1.0.15) → ให้ระบบหลังบ้านแปลงเป็น PDF
 * คืน { blob } หรือ { serverRec } (ระบบหลังบ้านบันทึกไฟล์ให้แล้ว)
 */
async function buildPdf(doc, { title, resolveImage, onProgress, p, d, name, note }) {
  try {
    const blob = await sheetsToPdf(doc, { title, fontsUrl: FONTS_URL, resolveImage, onProgress: (n, t) => onProgress?.(`กำลังสร้างหน้า ${n}/${t}`) });
    return { blob };
  } catch (e) {
    if (e.code !== 'tainted') throw e;
    if (store.mode === 'gas' && store.backend.htmlToPdf && !store.serverOutdated('1.0.15')) {
      onProgress?.('กำลังให้ระบบหลังบ้านแปลงเป็น PDF');
      const html = await sheetsToHtml(doc, { title, resolveImage });
      const rec = await store.dailyHtmlToPdf(p.id, d.id, name, await html.text(), note);
      return { serverRec: rec };
    }
    const err = new Error('เบราว์เซอร์นี้สร้างไฟล์ PDF อัตโนมัติไม่ได้ — เปิดแบบฟอร์ม กด "บันทึก PDF / พิมพ์" แล้วอัปโหลดไฟล์ในแท็บเอกสาร หรือใช้ Chrome/Edge/Firefox');
    err.code = 'pdf_unsupported';
    throw err;
  }
}

/** ลบไฟล์ PDF รุ่นก่อนของรายงานเดียวกันที่ผู้ใช้สร้างเอง (เก็บไว้ถ้าลบไม่ได้) */
async function dropOld(d, keepId) {
  const me = R.norm(store.me?.email);
  for (const f of store.dailyDocs(d)) {
    if (f.id === keepId || R.norm(f.uploadedByEmail) !== me || !store.canEditFile(f)) continue;
    try { await store.deleteFile(f.id); } catch { /* เก็บไว้ */ }
  }
}

async function upload(p, d, out, name, note) {
  if (out.serverRec) return out.serverRec;
  const type = 'application/pdf';
  const file = new File([out.blob], name, { type });
  return store.uploadFile(p.id, DAILY_DOC_CATEGORY, file, { dailyId: d.id, note });
}

/**
 * สร้างไฟล์ PDF ของรายงานประจำวันแล้วเก็บในแท็บเอกสาร
 * opts: { sign: dataURL ลายเซ็น (ว่าง = ไม่ลงชื่อ), onProgress(label) }
 */
export async function saveDailyPdf(p, d, { sign = '', onProgress } = {}) {
  if (!p || !d?.id) throw new Error('ไม่พบรายงานประจำวัน');
  if (!store.canWriteDaily(p, R.dailyKind(d))) throw new Error('คุณไม่มีสิทธิ์บันทึกไฟล์ของรายงานนี้');
  const form = dailyForm(d);
  onProgress?.('กำลังเตรียมแบบฟอร์ม');
  const { fr, doc } = await hiddenForm(form, { p, daily: d, today: store.thaiNow().date });
  try {
    // รูปถ่ายของรายงาน
    const photos = dailyPhotos(d);
    if (photos.length) onProgress?.(`กำลังใส่รูป ${photos.length} รูป`);
    await Promise.all(photos.map(async ([i, f]) => {
      const cell = doc.querySelector(`.sheets [data-photo="${i}"]`);
      if (!cell) return;
      const src = await photoData(f);
      if (!src) return;
      const img = doc.createElement('img');
      img.alt = '';
      img.src = src;
      cell.insertBefore(img, cell.firstChild);
      cell.classList.add('has-img');
    }));
    if (sign) putSignature(signSlot(doc, p, d), sign);
    const name = dailyDocName(p, d);
    const note = `สร้างจากรายงานประจำวันที่ ${d.date}${sign ? ' (ลงลายมือชื่อแล้ว)' : ''}`;
    const out = await buildPdf(doc, { title: name.replace(/\.pdf$/, ''), resolveImage: null, onProgress, p, d, name, note });
    onProgress?.('กำลังอัปโหลดไฟล์');
    const rec = await upload(p, d, out, name, note);
    await dropOld(d, rec.id);
    return rec;
  } finally {
    fr.remove();
  }
}

/** ปุ่ม "บันทึกเข้าเอกสาร" ในหน้าต่างแบบฟอร์ม: ใช้หน้าที่กรอก/ลงชื่อแล้ว */
export async function saveFormWindowPdf(win, p, d, { onProgress } = {}) {
  if (!win || win.closed) throw new Error('หน้าต่างแบบฟอร์มถูกปิดแล้ว');
  if (!store.canWriteDaily(p, R.dailyKind(d))) throw new Error('คุณไม่มีสิทธิ์บันทึกไฟล์ของรายงานนี้');
  const doc = win.document;
  const signed = !!doc.querySelector('.sheets [data-sign].has');
  const name = dailyDocName(p, d);
  const note = `บันทึกจากแบบฟอร์มของรายงานวันที่ ${d.date}${signed ? ' (ลงลายมือชื่อแล้ว)' : ''}`;
  const out = await buildPdf(doc, { title: name.replace(/\.pdf$/, ''), resolveImage: photoResolver(d), onProgress, p, d, name, note });
  onProgress?.('กำลังอัปโหลดไฟล์');
  const rec = await upload(p, d, out, name, note);
  await dropOld(d, rec.id);
  return rec;
}

export { blobToDataUrl };

// ---------- 1.0.16 แบบฟอร์มรายงานประจำวันฉบับเดียวกันทุกหน้า ----------
/**
 * ข้อมูลให้หน้าต่างแบบฟอร์มของรายงานประจำวัน — ใช้ทั้งในโครงการและหน้า "แบบฟอร์มและระเบียบ"
 * mode: 'linked' = รายงานของโครงการ (ข้อมูล ร่างที่กรอก และไฟล์ PDF ชุดเดียวกัน บันทึกเข้าเอกสารได้ถ้ามีสิทธิ์)
 *       'copy'   = สำเนาสำหรับใช้ภายนอก (ดึงข้อมูลรายงานมาใส่ แก้แยก ไม่บันทึกกลับเข้าโครงการ)
 *       'header' = แบบเปล่า มีหัวกระดาษของโครงการ
 */
export function dailyFormCtx(p, form, { day = '', rec = null, mode = 'linked' } = {}) {
  const date = day || rec?.date || store.thaiNow().date;
  if (!p) return { date };
  if (mode === 'header' || !rec) return { p, date, src: 'header' };
  if (mode === 'copy' || dailyForm(rec) !== form) return { p, date, daily: rec, copy: true, src: 'copy' };
  const ctx = { p, date, daily: rec, src: 'linked' };
  if (store.canWriteDaily(p, R.dailyKind(rec))) ctx.saveDoc = (w, onProgress) => saveFormWindowPdf(w, p, rec, { onProgress });
  return ctx;
}
export function openDailyForm(p, form, opts = {}) { return openForm(form, dailyFormCtx(p, form, opts)); }

/** ไฟล์ PDF ของรายงานเก่ากว่าข้อมูลรายงาน (แก้รายงานหลังสร้างไฟล์) */
export function dailyDocStale(d, docs = store.dailyDocs(d)) {
  if (!d || !docs.length) return false;
  const last = docs.map((f) => String(f.uploadedAt || '')).sort().pop();
  return !!(d.updatedAt && last && String(d.updatedAt) > last);
}

/**
 * ภาพแบบฟอร์ม (FM-002 / PT-F07) ของรายงานในหน้ารายงานประจำวัน — สร้างจากแบบฟอร์มเดียวกับหน้าต่างแบบฟอร์มและไฟล์ PDF
 * กรอบไม่รันสคริปต์ (sandbox) ย่อให้พอดีความกว้าง · คืนฟังก์ชันเลิกติดตามขนาดจอ
 */
export function mountFormPreview(host, p, d) {
  const form = dailyForm(d);
  const fr = document.createElement('iframe');
  fr.className = 'dy-pvframe';
  fr.title = `แบบฟอร์ม ${FORMS[form].short || FORMS[form].code} ของรายงานวันที่ ${d.date}`;
  fr.setAttribute('sandbox', 'allow-same-origin');
  fr.setAttribute('scrolling', 'no');
  fr.tabIndex = -1;
  host.querySelectorAll('iframe').forEach((x) => x.remove());
  host.insertBefore(fr, host.firstChild);
  const doc = fr.contentDocument;
  doc.open();
  doc.write(formHtml(form, { p, daily: d, src: 'linked', today: store.thaiNow().date }, { preview: true }));
  doc.close();
  // รูปของรายงานในช่องภาพประกอบ
  dailyPhotos(d).forEach(async ([i, f]) => {
    try {
      const u = await store.thumbUrl(f);
      const cell = doc.querySelector(`.sheets [data-photo="${i}"]`);
      if (!u || !cell || cell.querySelector('img') || !/^(blob:|data:image\/|https:)/.test(u)) return;
      const img = doc.createElement('img');
      img.alt = '';
      img.src = u;
      cell.insertBefore(img, cell.firstChild);
      cell.classList.add('has-img');
      fit();
    } catch { /* ไม่มีรูปก็แสดงแบบฟอร์มได้ */ }
  });
  let W = 0;
  function fit() {
    const root = doc.documentElement;
    if (!root || !host.isConnected) return;
    W = Math.max(W, root.scrollWidth, 820);
    const H = Math.max(root.scrollHeight, doc.body?.scrollHeight || 0);
    const hw = host.clientWidth || W;
    const k = Math.min(1, hw / W);
    fr.style.width = `${k < 1 ? W : hw}px`; // จอกว้างกว่าแบบฟอร์ม → กรอบเต็มความกว้าง แบบฟอร์มอยู่กลาง
    fr.style.height = `${H}px`;
    fr.style.transform = `scale(${k})`;
    host.style.height = `${Math.ceil(H * k)}px`;
  }
  fr.addEventListener('load', fit);
  doc.fonts?.ready?.then(fit).catch(() => {});
  setTimeout(fit, 50);
  setTimeout(fit, 800);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => fit()) : null;
  ro?.observe(host);
  return () => ro?.disconnect();
}
