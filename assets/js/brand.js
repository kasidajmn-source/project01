// 1.0.10 ตราหน่วยงาน (โลโก้ กฟผ.) — ใช้ไฟล์ทางการที่หน่วยงานให้มาเท่านั้น
// วางไฟล์ใน assets/brand/ แล้วระบุชื่อไฟล์ใน assets/brand/brand.json เช่น { "logo": "egat-logo.png" }
// ไม่มีไฟล์/ไฟล์เสีย → ใช้เครื่องหมายเดิมของระบบ (ไม่มีผลกับการใช้งาน)
// ความปลอดภัย: รับเฉพาะชื่อไฟล์ในโฟลเดอร์นี้ (ไม่รับ path/URL) · ภาพโหลดผ่าน <img> (สคริปต์ใน SVG ไม่ทำงาน) · CSP img-src 'self'
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,59}\.(png|svg|webp)$/;
const TYPES = { png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp' };
let logo = null; // { src, alt }

export const brandLogo = () => logo;

function probe(src) {
  return new Promise((ok, bad) => {
    const im = new Image();
    const t = setTimeout(() => bad(new Error('timeout')), 4000);
    im.onload = () => { clearTimeout(t); im.naturalWidth > 0 ? ok() : bad(new Error('empty')); };
    im.onerror = () => { clearTimeout(t); bad(new Error('load')); };
    im.src = src;
  });
}

/** โหลดตราหน่วยงานตอนเปิดระบบ */
export async function loadBrand() {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('assets/brand/brand.json', { cache: 'no-cache', redirect: 'error', credentials: 'same-origin', signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
    const f = typeof j.logo === 'string' ? j.logo.trim() : '';
    if (!FILE_RE.test(f)) return null;
    const src = `assets/brand/${f}`;
    await probe(src);
    const alt = typeof j.alt === 'string' && j.alt.trim() ? j.alt.trim().slice(0, 60) : 'กฟผ.';
    logo = { src, alt };
    document.documentElement.dataset.brand = 'logo';
    if (j.favicon !== false) {
      const link = document.querySelector('link[rel="icon"]');
      if (link) { link.href = src; link.type = TYPES[f.split('.').pop()]; }
    }
    applyBrand();
    window.dispatchEvent(new Event('pt:brand'));
    return logo;
  } catch { return null; }
}

/** แทนเครื่องหมายเดิม (svg.brand-mark) ด้วยตราหน่วยงาน */
export function applyBrand(root = document) {
  if (!logo || !root?.querySelectorAll) return;
  root.querySelectorAll('svg.brand-mark').forEach((svg) => {
    const img = document.createElement('img');
    img.className = 'brand-mark brand-logo';
    img.src = logo.src;
    img.alt = logo.alt;
    img.decoding = 'async';
    img.draggable = false;
    svg.replaceWith(img);
  });
}
