// 1.0.15 สร้างไฟล์ PDF จากหน้าแบบฟอร์ม (.sheet) โดยไม่ใช้ไลบรารีภายนอก
// วิธี: วาดแต่ละหน้าเป็นภาพผ่าน SVG foreignObject → canvas → JPEG แล้วเขียนเป็นไฟล์ PDF ขนาด A4
// ข้อจำกัด: ข้อความใน PDF เป็นภาพ (ค้นหาข้อความไม่ได้) — เบราว์เซอร์ที่ไม่ยอมให้อ่านภาพจาก canvas จะได้ไฟล์ HTML แทน

const A4W = 595.28, A4H = 841.89; // หน่วย point
const PX_MM = 96 / 25.4;

/** แปลงตัวเลือก body/html ในสไตล์ของแบบฟอร์ม ให้ใช้กับกล่องครอบในภาพได้ */
export function scopeCss(css) {
  return String(css || '')
    .replace(/(^|[\s{},>+~(])body(?=[\s.#:[{,>+~)])/g, '$1.pdf-body')
    .replace(/(^|[\s{},>+~(])html(?=[\s.#:[{,>+~)])/g, '$1.pdf-html');
}

/** Blob → data URL */
export function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error || new Error('อ่านไฟล์ไม่ได้'));
    r.readAsDataURL(blob);
  });
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('เปิดรูปไม่ได้'));
    im.src = src;
  });
}

/** ย่อรูปให้ด้านยาวไม่เกิน max px แล้วเป็น JPEG data URL (รูปเล็ก/PNG ลายเซ็นคงไว้) */
export async function shrinkImage(blob, max = 1500) {
  if (!blob) return '';
  if (/png|gif|svg/.test(blob.type || '') && blob.size < 400 * 1024) return blobToDataUrl(blob);
  const url = URL.createObjectURL(blob);
  try {
    const im = await loadImage(url);
    const s = Math.min(1, max / Math.max(im.naturalWidth || 1, im.naturalHeight || 1));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * s));
    c.height = Math.max(1, Math.round(im.naturalHeight * s));
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } catch {
    return blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** รูปจากที่อยู่ใดก็ได้ → data URL (ไม่ได้ = '') */
async function srcToDataUrl(src) {
  if (!src) return '';
  if (/^data:image\//.test(src)) return src;
  try {
    const r = await fetch(src, { credentials: 'omit' });
    if (!r.ok) return '';
    const b = await r.blob();
    return /^image\//.test(b.type || '') ? shrinkImage(b) : '';
  } catch {
    return '';
  }
}

// ---------- ฟอนต์: ฝังในภาพ (ภาพ SVG โหลดฟอนต์จากภายนอกไม่ได้) ----------
const fontCache = new Map();
/** CSS ของ Google Fonts → @font-face ที่ฝังไฟล์ฟอนต์ (เฉพาะชุดอักษรไทยและละติน) — ออฟไลน์ = '' (ใช้ฟอนต์ในเครื่อง) */
export function embeddedFontCss(url) {
  if (!url) return Promise.resolve('');
  if (!fontCache.has(url)) {
    fontCache.set(url, (async () => {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => ctl?.abort(), 15000);
      try {
        const css = await (await fetch(url, { signal: ctl?.signal })).text();
        const blocks = css.split('@font-face').slice(1).map((b) => `@font-face${b.slice(0, b.indexOf('}') + 1)}`);
        const keep = blocks.filter((b) => /U\+0E01|U\+0000-00FF/i.test(b) || !/unicode-range/i.test(b)).slice(0, 24);
        const out = await Promise.all(keep.map(async (b) => {
          const m = b.match(/url\((['"]?)(https:\/\/[^'")\s]+)\1\)/);
          if (!m) return '';
          const r = await fetch(m[2], { signal: ctl?.signal });
          if (!r.ok) return '';
          const data = await blobToDataUrl(await r.blob());
          return b.replace(m[0], `url(${data})`);
        }));
        return out.join('\n');
      } catch {
        fontCache.delete(url);
        return '';
      } finally {
        clearTimeout(timer);
      }
    })());
  }
  return fontCache.get(url);
}

// ---------- แบ่งหน้า ----------
/** ตำแหน่งที่ตัดหน้าได้ (ขอบล่างของแถวตาราง ย่อหน้า ฯลฯ) เทียบกับขอบบนของ sheet */
function breakPoints(sheet) {
  const top = sheet.getBoundingClientRect().top;
  const out = new Set();
  sheet.querySelectorAll('tr, p, li, h1, h2, h3, figure, .sign, .signs, .lf, .box, .nb, .of-sign, table, .ph-cell, [data-photo]').forEach((x) => {
    const r = x.getBoundingClientRect();
    if (r.height > 0) out.add(Math.round(r.bottom - top));
  });
  return [...out].sort((a, b) => a - b);
}
/** ช่วงที่ตัดของแต่ละหน้า [{ y, h, at }] — at = ตำแหน่งวางบนหน้า (px) */
function slices(H, pageH, margin, pts) {
  if (H <= pageH + 2) return [{ y: 0, h: Math.min(H, pageH), at: 0 }];
  const out = [];
  let y = 0;
  let first = true;
  while (y < H - 1 && out.length < 40) {
    const room = first ? pageH - margin : pageH - 2 * margin;
    const limit = y + room;
    let cut = limit;
    if (limit < H) {
      const ok = pts.filter((v) => v > y + room * 0.45 && v <= limit);
      if (ok.length) cut = ok[ok.length - 1];
    } else cut = H;
    out.push({ y, h: cut - y, at: first ? 0 : margin });
    y = cut;
    first = false;
  }
  return out;
}

// ---------- วาดหน้า ----------
async function sheetImages(sheet, clone, resolveImage) {
  const live = [...sheet.querySelectorAll('img')];
  const imgs = [...clone.querySelectorAll('img')];
  await Promise.all(imgs.map(async (img, i) => {
    const src = img.getAttribute('src') || '';
    let data = await srcToDataUrl(src);
    if (!data && resolveImage) {
      try { data = await resolveImage(live[i], src); } catch { data = ''; }
    }
    if (data) { img.setAttribute('src', data); return; }
    const ph = img.ownerDocument.createElement('span');
    ph.className = 'pdf-noimg';
    ph.textContent = 'รูปถ่าย — ดูในระบบติดตามโครงการ';
    img.replaceWith(ph);
  }));
}

function cleanClone(clone) {
  clone.querySelectorAll('.ph-x, .ph-mk, .ph-input, .ph-hint, .sig-chip, input, script, button').forEach((x) => x.remove());
  clone.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
  // ช่องคำนวณ (รวมคนงาน/เครื่องจักร) — คำนวณให้ ถ้ายังว่าง
  const n = (t) => { const v = parseFloat(String(t || '').replace(/,/g, '')); return Number.isFinite(v) ? v : 0; };
  const fmt = (v) => (v ? String(Math.round(v * 100) / 100) : '');
  clone.querySelectorAll('[data-calc]').forEach((c) => {
    if (c.textContent.trim()) return;
    const tr = c.closest('tr');
    const v = String(c.getAttribute('data-calc')).split('+').reduce((s, k) => s + n(tr?.querySelector(`[data-col="${k}"]`)?.textContent), 0);
    c.textContent = fmt(v);
  });
  clone.querySelectorAll('[data-sum]').forEach((c) => {
    if (c.textContent.trim()) return;
    const k = c.getAttribute('data-sum');
    const tb = c.closest('table');
    const v = [...(tb ? tb.querySelectorAll(`[data-col="${k}"]`) : [])].reduce((s, x) => s + n(x.textContent), 0);
    c.textContent = fmt(v);
  });
}

/** หน้าภาพประกอบที่ไม่มีรูปเลย — ไม่ต้องใส่ใน PDF */
const emptyPhotoSheet = (sheet) => {
  const cells = sheet.querySelectorAll('[data-photo]');
  return cells.length > 0 && ![...cells].some((c) => c.querySelector('img'));
};

async function renderSlice(svgUrl, W, H, s, sl, pageH, scale) {
  const im = await loadImage(svgUrl);
  try { await im.decode?.(); } catch { /* วาดได้อยู่แล้ว */ }
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale);
  c.height = Math.round(pageH * scale);
  const g = c.getContext('2d');
  const draw = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.save();
    g.beginPath();
    g.rect(0, sl.at * scale, c.width, sl.h * scale);
    g.clip();
    g.drawImage(im, 0, (sl.at - sl.y) * scale, W * scale, H * scale);
    g.restore();
  };
  draw();
  // Safari บางรุ่นยังไม่ใช้ฟอนต์/รูปที่ฝังในการวาดครั้งแรก — วาดซ้ำอีกครั้ง
  if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent || '')) { await new Promise((r) => setTimeout(r, 250)); draw(); }
  try {
    return c.toDataURL('image/jpeg', 0.86);
  } catch (e) {
    const err = new Error('เบราว์เซอร์นี้ไม่อนุญาตให้สร้างภาพหน้าแบบฟอร์ม');
    err.code = 'tainted';
    err.cause = e;
    throw err;
  }
}

/**
 * หน้าแบบฟอร์มทุกหน้าในเอกสาร doc → ไฟล์ PDF (Blob)
 * opts: { title, fontsUrl, resolveImage(liveImg, src) → dataURL, scale, onProgress(n, total) }
 */
export async function sheetsToPdf(doc, opts = {}) {
  const { title = '', fontsUrl = '', resolveImage = null, scale = 2, onProgress = null } = opts;
  const sheets = [...doc.querySelectorAll('.sheets .sheet, body > .sheet')].filter((s) => !emptyPhotoSheet(s));
  if (!sheets.length) throw new Error('ไม่พบหน้าแบบฟอร์ม');
  try { await doc.fonts?.ready; } catch { /* ใช้ฟอนต์ที่มี */ }
  const css = scopeCss([...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n'));
  const fonts = await embeddedFontCss(fontsUrl);
  const bodyCls = [...(doc.body?.classList || [])].filter((c) => !['ed', 'preview'].includes(c));
  const extra = '.pdf-body{margin:0;background:#fff}.pdf-body .sheet{margin:0!important;box-shadow:none!important}'
    + '.pdf-body [data-f],.pdf-body [data-date]{background:transparent!important;outline:0!important}'
    + '.pdf-noimg{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-height:30mm;color:#666;font-size:12px}';
  const ser = new (doc.defaultView?.XMLSerializer || XMLSerializer)();
  const pages = [];
  let n = 0;
  for (const sheet of sheets) {
    n++;
    onProgress?.(n, sheets.length);
    // 1.0.17 หน้าแนวนอน (แบบ F-04-03-07/08/09): <div class="sheet land">
    const land = sheet.classList.contains('land');
    const W = Math.round(sheet.offsetWidth || (land ? 297 : 210) * PX_MM);
    const H = Math.max(1, Math.ceil(sheet.scrollHeight || sheet.offsetHeight || (land ? 210 : 297) * PX_MM));
    const pageH = Math.round(W * (land ? A4W / A4H : A4H / A4W));
    const clone = sheet.cloneNode(true);
    cleanClone(clone);
    await sheetImages(sheet, clone, resolveImage);
    const wrap = doc.createElement('div');
    wrap.setAttribute('class', ['pdf-body', 'preview', ...bodyCls].join(' '));
    wrap.setAttribute('style', `width:${W}px;margin:0`);
    const st = doc.createElement('style');
    st.textContent = `${fonts}\n${css}\n${extra}`;
    wrap.appendChild(st);
    const box = doc.createElement('div');
    box.className = 'sheets';
    box.appendChild(clone);
    wrap.appendChild(box);
    const xhtml = ser.serializeToString(wrap);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${xhtml}</foreignObject></svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const cuts = slices(H, pageH, Math.round(12 * PX_MM), breakPoints(sheet));
    for (const sl of cuts) {
      const jpg = await renderSlice(url, W, H, sheet, sl, pageH, scale);
      pages.push(land ? { src: jpg, w: A4H, h: A4W } : jpg);
    }
  }
  return buildPdf(pages, { title });
}

// ---------- เขียนไฟล์ PDF ----------
function dataUrlBytes(u) {
  const b = atob(String(u).split(',')[1] || '');
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
function jpegSize(bytes) {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    const m = bytes[i + 1];
    const len = (bytes[i + 2] << 8) + bytes[i + 3];
    if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) {
      return { h: (bytes[i + 5] << 8) + bytes[i + 6], w: (bytes[i + 7] << 8) + bytes[i + 8] };
    }
    i += 2 + len;
  }
  return { w: 1, h: 1 };
}
/** ข้อความ → สตริง PDF แบบ UTF-16BE (ชื่อเอกสารภาษาไทย) */
function pdfText(s) {
  let hex = 'FEFF';
  for (const ch of String(s || '').slice(0, 200)) {
    const c = ch.codePointAt(0);
    if (c > 0xFFFF) {
      const v = c - 0x10000;
      hex += (0xD800 + (v >> 10)).toString(16).padStart(4, '0') + (0xDC00 + (v & 0x3FF)).toString(16).padStart(4, '0');
    } else hex += c.toString(16).padStart(4, '0');
  }
  return `<${hex.toUpperCase()}>`;
}
/**
 * หน้าเอกสาร → ไฟล์ PDF
 * pages: data URL ของ JPEG (เต็มหน้า A4 แนวตั้ง) หรือ { src, w, h } (JPEG เต็มหน้าขนาด w×h point)
 *        หรือ { w, h, images: [{ x, y, w, h, jpeg?: Uint8Array, rgb?: { bytes (zlib), width, height } }] } (1.0.17 ป้ายโครงการ: หลายภาพต่อหน้า)
 */
export function buildPdf(pages, { title = '' } = {}) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let pos = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; };
  const obj = (id, body) => { offsets[id] = pos; push(`${id} 0 obj\n`); body(); push('\nendobj\n'); };
  const norm = pages.map((pg) => {
    if (typeof pg === 'string') pg = { src: pg, w: A4W, h: A4H };
    if (pg.src) {
      const bytes = dataUrlBytes(pg.src);
      return { w: pg.w, h: pg.h, images: [{ x: 0, y: 0, w: pg.w, h: pg.h, jpeg: bytes }] };
    }
    return pg;
  });
  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
  // หมายเลขอ็อบเจ็กต์: 1 แคตตาล็อก · 2 รายการหน้า · 3 ข้อมูลเอกสาร · ต่อด้วย [หน้า, เนื้อหา, ภาพ…] ของแต่ละหน้า
  const ids = [];
  let next = 4;
  norm.forEach((pg) => { ids.push(next); next += 2 + pg.images.length; });
  const N = norm.length;
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Count ${N} /Kids [${ids.map((id) => `${id} 0 R`).join(' ')}] >>`));
  obj(3, () => push(`<< /Title ${pdfText(title)} /Producer ${pdfText('ระบบติดตามโครงการ')} /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`));
  const f = (n) => (Math.round(n * 1000) / 1000).toString();
  norm.forEach((pg, i) => {
    const pid = ids[i];
    const names = pg.images.map((_, k) => `/Im${k} ${pid + 2 + k} 0 R`).join(' ');
    const content = pg.images.map((im, k) => `q ${f(im.w)} 0 0 ${f(im.h)} ${f(im.x)} ${f(pg.h - im.y - im.h)} cm /Im${k} Do Q`).join('\n');
    obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pg.w)} ${f(pg.h)}] /Resources << /XObject << ${names} >> >> /Contents ${pid + 1} 0 R >>`));
    obj(pid + 1, () => { push(`<< /Length ${enc.encode(content).length} >>\nstream\n`); push(content); push('\nendstream'); });
    pg.images.forEach((im, k) => obj(pid + 2 + k, () => {
      if (im.jpeg) {
        const { w, h } = jpegSize(im.jpeg);
        push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`);
        push(im.jpeg);
      } else {
        push(`<< /Type /XObject /Subtype /Image /Width ${im.rgb.width} /Height ${im.rgb.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${im.rgb.bytes.length} >>\nstream\n`);
        push(im.rgb.bytes);
      }
      push('\nendstream');
    }));
  });
  const total = next;
  const xref = pos;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += `${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`;
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

/** 1.0.17 พิกเซล RGBA ของ canvas → RGB บีบอัดแบบ zlib (FlateDecode) — ไม่มี CompressionStream = null */
export async function canvasRgbFlate(canvas) {
  if (typeof CompressionStream !== 'function') return null;
  const { width, height } = canvas;
  const g = canvas.getContext('2d');
  const cs = new CompressionStream('deflate');
  const w = cs.writable.getWriter();
  const out = new Response(cs.readable).arrayBuffer();
  const band = 256; // ทีละแถบ ไม่ใช้หน่วยความจำมากเกิน
  for (let y = 0; y < height; y += band) {
    const h = Math.min(band, height - y);
    const px = g.getImageData(0, y, width, h).data;
    const rgb = new Uint8Array(width * h * 3);
    for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { rgb[j] = px[i]; rgb[j + 1] = px[i + 1]; rgb[j + 2] = px[i + 2]; }
    await w.write(rgb);
  }
  await w.close();
  return { bytes: new Uint8Array(await out), width, height };
}

/** สำรอง: หน้าแบบฟอร์มเป็นไฟล์ HTML ไฟล์เดียว (รูปฝังในไฟล์ เปิดแล้วสั่งพิมพ์เป็น PDF ได้) */
export async function sheetsToHtml(doc, { title = '', resolveImage = null } = {}) {
  const sheets = [...doc.querySelectorAll('.sheets .sheet')].filter((s) => !emptyPhotoSheet(s));
  const parts = [];
  for (const sheet of sheets) {
    const clone = sheet.cloneNode(true);
    cleanClone(clone);
    await sheetImages(sheet, clone, resolveImage);
    parts.push(clone.outerHTML);
  }
  const css = [...doc.querySelectorAll('style')].map((s) => s.textContent).join('\n');
  const cls = [...(doc.body?.classList || [])].filter((c) => !['ed'].includes(c)).concat('preview').join(' ');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}\n.pdf-noimg{color:#666;font-size:12px}</style></head><body class="${esc(cls)}"><div class="sheets">${parts.join('')}</div></body></html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}
