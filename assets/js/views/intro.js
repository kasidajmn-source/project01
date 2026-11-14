// หน้าแนะนำระบบแบบเต็มจอ (1.0.6) — แทนหน้าต่าง "ยินดีต้อนรับ" เดิม
// 1.0.9: กระดาษพิมพ์เขียว + ส้มหน้างาน · ลูกดิ่ง (มาสคอต) ห้อยลงมาทักทาย · ตัวอักษรใหญ่ · การ์ดลอยเลื่อนตามการเลื่อนหน้า
import { conf } from '../config.js';
import { esc, icon } from '../ui.js';
import { motionOn } from '../motion.js';
import { mascot } from '../mascot.js';
import { APP_VERSION } from '../defaults.js';

const MARK = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="10" y="2" width="12" height="28" rx="1.5" class="bm-staff"/><path class="bm-e" d="M10 5h6v1.6h-6zM10 8.2h4v1.6h-4zM10 11.4h6v1.6h-6zM16 14.6h6v1.6h-6zM18 17.8h4v1.6h-4zM16 21h6v1.6h-6zM10 24.2h6v1.6h-6z"/></svg>`;

function heroBg() {
  const m = mascot({ pose: 'welcome', size: 'lg', hang: true });
  return `<div class="hero-bg" aria-hidden="true"><div class="hero-grid"></div>${m ? `<div class="hero-msc">${m}</div>` : ''}</div>`;
}

/** ฉากหลังแบบหน้าแนะนำ ใช้หลังหน้าต่างเข้าสู่ระบบ — คืนฟังก์ชันสำหรับเอาออก */
export function introBackdrop() {
  const el = document.createElement('div');
  el.className = 'intro-backdrop';
  el.innerHTML = `${heroBg()}<div class="ib-text"><span class="intro-eyebrow">${MARK}ติดตามโครงการ</span><h1 class="intro-h1">ทุกโครงการ<br>ในที่เดียว</h1></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  return () => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 350); };
}

const card = (cls, inner, speed) => `<div class="fc ${cls}" data-speed="${speed}">${inner}</div>`;

/**
 * เปิดหน้าแนะนำ — onPick(pick, { name, email }) เมื่อเลือกวิธีเริ่มใช้งาน
 * tour = true: เปิดดูอย่างเดียว (จากหน้าคู่มือ) ไม่มีแบบฟอร์มเริ่มใช้งาน
 */
export function showIntro({ onPick, tour = false } = {}) {
  document.querySelector('.intro')?.remove();
  const el = document.createElement('div');
  el.className = 'intro';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'ยินดีต้อนรับสู่ระบบติดตามโครงการ');
  el.innerHTML = `
  <header class="intro-top">
    <span class="intro-brand">${MARK}<b>ติดตามโครงการ</b></span>
    <span class="intro-ver">เวอร์ชัน ${esc(APP_VERSION)}</span>
    ${tour ? `<button class="btn btn-sm intro-close" data-act="close">${icon('x')}ปิด</button>` : ''}
  </header>

  <section class="intro-hero" id="in-home">
    ${heroBg()}
    <div class="intro-hero-in">
      <div class="intro-copy">
        <span class="intro-pill">${icon('shield')}สำหรับทีมควบคุมงานก่อสร้าง</span>
        <h1 class="intro-h1">ทุกโครงการ<br>ในที่เดียว</h1>
        <p class="intro-lead">เอกสาร ความคืบหน้าจาก BOQ เรื่องขออนุมัติ รายงานประจำวัน และสรุปผู้บริหาร — <span class="nw">ผู้ควบคุมงาน</span> <span class="nw">คณะกรรมการ</span> <span class="nw">ผู้รับจ้าง</span> และ<span class="nw">หัวหน้า</span>ใช้ข้อมูลชุดเดียวกัน</p>
      </div>
      ${tour ? '' : `<form class="intro-card" id="wc" novalidate>
        <h2>เริ่มใช้งาน</h2>
        <label class="field"><span>ชื่อของคุณ</span><input id="wc-name" value="${esc(conf.user)}" placeholder="เช่น นายช่างสมชาย" autocomplete="name"></label>
        <label class="field"><span>อีเมล <small>(ใช้ระบุสิทธิ์ในโครงการ)</small></span><input id="wc-email" type="email" value="${esc(conf.email)}" placeholder="name@egat.co.th" autocomplete="email"></label>
        <div class="intro-opts">
          <button type="button" class="opt-btn intro-opt is-main magnet" data-pick="demo">${icon('present')}<span><b>ลองด้วยข้อมูลตัวอย่าง</b><small>4 โครงการ พร้อมสมาชิก เรื่องขออนุมัติ แผนงาน และรายงานประจำวัน</small></span>${icon('chevR')}</button>
          <button type="button" class="opt-btn intro-opt" data-pick="empty">${icon('plus')}<span><b>เริ่มแบบว่าง</b><small>สร้างโครงการเองในโหมดทดลอง (เก็บในเบราว์เซอร์)</small></span>${icon('chevR')}</button>
          <button type="button" class="opt-btn intro-opt" data-pick="cloud">${icon('cloud')}<span><b>เชื่อมต่อ Google Drive, SharePoint หรือ OneDrive</b><small>ใช้งานจริงร่วมกับทีม</small></span>${icon('chevR')}</button>
        </div>
      </form>`}
    </div>
    <a class="intro-scroll" href="#in-all" data-jump="in-all"><span>เลื่อนดู</span><i></i></a>
  </section>

  <section class="intro-all" id="in-all">
    <h2 class="intro-giant" data-scale>รวมทุกงาน<br>ไว้ด้วยกัน</h2>
    ${card('fc-prog', `<small>อาคารสำนักงาน CN-69-014</small><b class="num">41.1<i>%</i></b><span class="fc-bar"><i style="width:41%"></i><em style="left:46%"></em></span><small>แผน 45.7% เฝ้าระวัง</small>`, -0.35)}
    ${card('fc-ok', `${icon('check')}<span><b>ขออนุมัติวัสดุ #012</b><small>ประธานกรรมการอนุมัติแล้ว</small></span>`, 0.25)}
    ${card('fc-day', `${icon('sun')}<span><b>รายงานประจำวัน</b><small>แจ่มใส คนงาน 24 คน เทคอนกรีตเสา</small></span>`, -0.15)}
    ${card('fc-chat', `${icon('message')}<span><b>ห้องโครงการ</b><small>"พรุ่งนี้ 09:00 ประชุมหน้างานครับ"</small></span>`, 0.4)}
    ${card('fc-mail', `${icon('mail')}<span><b>รายงานประจำสัปดาห์</b><small>ส่งถึงคณะกรรมการ 5 คนแล้ว</small></span>`, -0.28)}
  </section>

  <section class="intro-steps" id="in-steps">
    ${[
    ['amber', 'clipboard', 'บันทึก', 'ความคืบหน้าจาก BOQ รายสัปดาห์ รายงานประจำวัน และรูปถ่ายหน้างาน'],
    ['green', 'check', 'อนุมัติ', 'ผู้ควบคุมงานส่งต่อกรรมการตามลำดับจนถึงประธาน โหวตเลือกวัสดุได้ และแจ้งทางอีเมลทุกขั้น'],
    ['blue', 'mail', 'รายงาน', 'รายวัน รายสัปดาห์ รายเดือน ส่งเข้าอีเมลอัตโนมัติ พร้อมสรุปผู้บริหารสำหรับนำเสนอ'],
  ].map(([c, ic, w, d]) => `<div class="intro-step st-${c}"><span class="st-tile">${icon(ic)}</span><div><h3>${w}</h3><p>${d}</p></div></div>`).join('')}
  </section>

  <section class="intro-roles" id="in-roles">
    <div class="ir-copy">
      <h2>ทุกบทบาท<br>ทุกอุปกรณ์</h2>
      <p>สิทธิ์ตามบทบาทในแต่ละโครงการ ใช้ได้ทั้งคอมพิวเตอร์และมือถือ เก็บข้อมูลใน Google Drive, SharePoint หรือ OneDrive ของหน่วยงาน</p>
      <ul class="ir-roles">${['เจ้าของโครงการ', 'ผู้ควบคุมงาน', 'คณะกรรมการตรวจรับ', 'ผู้รับจ้าง', 'หัวหน้า', 'ผู้บริหาร'].map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    </div>
    <div class="ir-phone" data-speed="-0.18" aria-hidden="true">
      <div class="ph-notch"></div>
      <div class="ph-screen">
        <small>ผลงานรวมทุกโครงการ</small><b class="num">58.4<i>%</i></b>
        <span class="fc-bar"><i style="width:58%"></i><em style="left:61%"></em></span>
        ${[['อาคารสำนักงาน 2 ชั้น', 41], ['ถนนภายในโรงไฟฟ้า', 72], ['ระบบระบายน้ำ', 63]].map(([n, v]) => `<div class="ph-row"><span>${n}</span><b class="num">${v}%</b><span class="fc-bar"><i style="width:${v}%"></i></span></div>`).join('')}
        <div class="ph-tabs"><i class="is-on"></i><i></i><i></i><i></i><i></i></div>
      </div>
    </div>
  </section>

  <section class="intro-end">
    <h2>${tour ? 'พร้อมใช้งานแล้ว' : 'เริ่มได้ภายในหนึ่งนาที'}</h2>
    <button class="btn btn-primary btn-lg magnet" data-act="${tour ? 'close' : 'start'}">${tour ? `${icon('check')}กลับไปที่ระบบ` : `${icon('chevR')}เริ่มใช้งาน`}</button>
  </section>

  <nav class="intro-dock" aria-label="ส่วนของหน้าแนะนำ">
    <a href="#in-home" data-jump="in-home" class="is-on">${icon('home')}<span>เริ่มต้น</span></a>
    <a href="#in-all" data-jump="in-all"><span>ภาพรวม</span></a>
    <a href="#in-steps" data-jump="in-steps"><span>ขั้นตอน</span></a>
    <a href="#in-roles" data-jump="in-roles"><span>บทบาท</span></a>
  </nav>`;
  document.body.appendChild(el);
  document.body.classList.add('has-intro');
  requestAnimationFrame(() => el.classList.add('is-in'));

  const close = () => {
    el.classList.remove('is-in');
    el.classList.add('is-out');
    document.body.classList.remove('has-intro');
    setTimeout(() => el.remove(), motionOn() ? 450 : 0);
    removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape' && tour) close(); };
  addEventListener('keydown', onKey);

  // เลื่อนไปยังส่วนต่างๆ (ไม่เปลี่ยน hash ของแอป)
  el.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    el.querySelector(`#${a.dataset.jump}`)?.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' });
  }));
  el.querySelector('[data-act="start"]')?.addEventListener('click', () => {
    el.scrollTo({ top: 0, behavior: motionOn() ? 'smooth' : 'auto' });
    setTimeout(() => el.querySelector('#wc-name')?.focus(), motionOn() ? 500 : 0);
  });
  el.querySelectorAll('[data-act="close"]').forEach((b) => b.addEventListener('click', close));
  el.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
    const name = el.querySelector('#wc-name').value.trim();
    const email = el.querySelector('#wc-email').value.trim().toLowerCase();
    close();
    onPick?.(b.dataset.pick, { name, email });
  }));
  el.querySelector('#wc')?.addEventListener('submit', (e) => { e.preventDefault(); el.querySelector('[data-pick="demo"]').click(); });

  // ส่วนที่ปรากฏเมื่อเลื่อนถึง + การ์ดลอยเลื่อนต่างความเร็ว + ตัวอักษรใหญ่ขยายเข้า + เมนูด้านล่างตามส่วนที่อยู่
  const items = el.querySelectorAll('.intro-step, .ir-copy, .intro-end h2, .intro-giant, .fc, .ir-phone');
  if (typeof IntersectionObserver === 'function' && motionOn()) {
    const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { root: el, threshold: 0.2 });
    items.forEach((x) => io.observe(x));
  } else items.forEach((x) => x.classList.add('in'));
  const secs = ['in-home', 'in-all', 'in-steps', 'in-roles'].map((id) => el.querySelector(`#${id}`));
  const dock = el.querySelectorAll('.intro-dock a');
  const floaters = el.querySelectorAll('[data-speed]');
  const giant = el.querySelector('[data-scale]');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = el.clientHeight;
      let cur = 0;
      secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < vh * 0.45) cur = i; });
      dock.forEach((a, i) => a.classList.toggle('is-on', i === cur));
      el.classList.toggle('is-scrolled', el.scrollTop > 40);
      if (!motionOn()) return;
      floaters.forEach((f) => {
        const r = f.parentElement.getBoundingClientRect();
        const prog = (vh - r.top) / (vh + r.height); // 0 → 1 ขณะส่วนนั้นผ่านจอ
        f.style.setProperty('--py', `${((prog - 0.5) * +f.dataset.speed * 420).toFixed(1)}px`);
      });
      if (giant) {
        const r = giant.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.9)));
        giant.style.setProperty('--gs', (0.82 + t * 0.18).toFixed(3));
      }
    });
  };
  el.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  setTimeout(() => (tour ? el.querySelector('.intro-close') : el.querySelector('#wc-name'))?.focus({ preventScroll: true }), 60);
  return { el, close };
}
