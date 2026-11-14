// บทเรียนสอนการใช้งาน (1.0.7) — แต่ละบทบาทมีบทเรียนของตัวเอง
// ขั้นตอน (step):
//   title, text (HTML ที่เขียนเอง — ข้อมูลจากผู้ใช้ต้อง esc() ก่อน)
//   route   : hash ที่ต้องเปิดก่อนแสดงขั้นนี้ หรือฟังก์ชันที่คืน hash (ไม่ใส่ = อยู่หน้าเดิม)
//   target  : ตัวเลือก CSS, รายการตัวเลือก (ใช้ตัวแรกที่มองเห็น) หรือฟังก์ชันที่คืน element — ไม่ใส่ = การ์ดกลางจอ
//   do      : 'click' = ให้ผู้ใช้ลองกดเอง (มีปุ่ม "ทำให้ดู" และ "ข้ามขั้นนี้")
//             'fill'  = ให้ผู้ใช้กรอกในส่วนที่ไฮไลต์ — fill: { sample(el), valid(el), need } (มีปุ่ม "ใส่ตัวอย่างให้")
//   until   : ฟังก์ชัน — ไปขั้นถัดไปเองเมื่อเป็นจริง (เช่น บันทึกสำเร็จแล้ว) ใช้คู่กับ do: 'click'
//   when    : ฟังก์ชัน — ไม่เป็นจริง = ข้ามขั้นนี้ · checkpoint: ห้ามย้อนกลับไปก่อนขั้นนี้ (เช่น หลังสร้างโครงการแล้ว)
//   timeout : เวลารอให้เป้าหมายปรากฏ (มิลลิวินาที) · pose: ท่ามาสคอตของขั้นนี้
//   optional: ไม่พบเป้าหมาย → ข้ามขั้นนี้ไปเลย
//   note    : ไม่พบเป้าหมาย → แสดงข้อความนี้กลางจอแทน
// 1.0.10: บท "สร้างโครงการแรก" แบบจับมือทำ (ผู้ควบคุมงาน) · บท "รอรับเชิญ" สำหรับผู้ที่ยังไม่มีโครงการ · ขั้นของแต่ละบทบาทแสดงตามสิทธิ์จริง
import { store, conf } from './store.js';
import { esc } from './ui.js';

const R = globalThis.PTRules;

// ---------- ตัวช่วยหาเป้าหมาย ----------
const visible = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
/** เมนูหลัก — คอมพิวเตอร์อยู่แถบซ้าย มือถืออยู่แถบล่าง */
export const nav = (k) => () => [...document.querySelectorAll(`[data-nav="${k}"]`)].find(visible) || null;
/** กล่อง (.panel) ที่มีหัวข้อนี้ */
export const panel = (text) => () => {
  const h = [...document.querySelectorAll('#view h2')].find((x) => visible(x) && x.textContent.includes(text));
  return h ? h.closest('.panel, section') : null;
};
/** แท็บของหน้าโครงการ */
const tab = (k) => `.tabs a[href$="/${k}"]`;
const P = (p, tail = '') => (p ? `#/p/${encodeURIComponent(p.id)}${tail ? `/${tail}` : ''}` : null);
/** อยู่ในหน้าโครงการแล้วไม่ต้องเปลี่ยนหน้า */
const inProject = (p, tail = '') => () => {
  const h = location.hash || '';
  if (!tail && h.startsWith('#/p/')) return null;
  return P(p, tail);
};

/** สิทธิ์ของผู้ใช้ในโครงการ (ตามที่เจ้าของโครงการตั้งไว้จริง) */
const can = (p, perm) => !!p && store.can(p, perm);
/** การ์ดสรุปสิทธิ์ของผู้ใช้ในโครงการ — เจ้าของโครงการเปิด/ปิดสิทธิ์รายบทบาทได้ */
const permStep = (p) => {
  if (!p) return null;
  const on = R.PERM_KEYS.filter((k) => can(p, k));
  const off = R.PERM_KEYS.filter((k) => !can(p, k));
  return {
    route: P(p, 'members'), target: [panel('สิทธิ์ของคุณในโครงการนี้'), panel('สิทธิ์ของแต่ละบทบาท'), '.proj-head'],
    title: 'สิทธิ์ของคุณในโครงการนี้',
    text: `ส่วนที่ไฮไลต์คือสิ่งที่คุณทำได้ — คุณมีสิทธิ์ <b>${on.length}</b> จาก ${R.PERM_KEYS.length} อย่าง${off.length
      ? `<br>ยังไม่มีสิทธิ์:<span class="tb-perms">${off.map((k) => `<span class="is-off"><i aria-hidden="true">–</i>${esc(R.PERMS[k])}</span>`).join('')}</span>`
      : ''}<small>บทเรียนนี้สอนเฉพาะสิ่งที่คุณทำได้ — ถ้าต้องการสิทธิ์เพิ่ม ติดต่อเจ้าของโครงการ “${esc(p.name)}”</small>`,
  };
};
// ---------- ตัวช่วยบท "สร้างโครงการแรก" ----------
/** ใส่ค่าผ่าน event จริง ให้หน้าจอคำนวณต่อเหมือนผู้ใช้พิมพ์เอง */
export function setVal(el, v) {
  if (!el) return;
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(v));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
const $ = (sel) => [...document.querySelectorAll(sel)].find(visible) || null;
/** กล่องของช่องกรอก (label.field) ที่มีช่องนี้ */
const fieldOf = (sel) => () => { const el = $(sel); return el ? el.closest('.field-pair, .field, label') || el : null; };
const valOf = (sel) => ($(sel)?.value || '').trim();
/** โครงการที่เปิดอยู่ (หลังสร้างใหม่) */
const curPid = () => { const m = (location.hash || '').match(/^#\/p\/([^/?]+)/); return m ? decodeURIComponent(m[1]) : ''; };
const curProject = () => store.project(curPid()) || null;
const curP = (tail = '') => () => { const id = curPid(); return id ? `#/p/${encodeURIComponent(id)}${tail ? `/${tail}` : ''}` : null; };
const usesBoq = () => { const p = curProject(); return !!p && !['manual', 'time'].includes(p.progressMethod); };
const myBoq = () => { const id = curPid(); return id ? store.data.boq.filter((b) => b.projectId === id) : []; };
const isoShift = (days) => new Date(Date.now() + 7 * 3600e3 + days * 864e5).toISOString().slice(0, 10);
const SAMPLE_BOQ = [
  ['งานดิน', '1', 'ขุดดินฐานราก', 'ลบ.ม.', 120, 0, 85],
  ['งานโครงสร้าง', '2', 'คอนกรีตโครงสร้าง 240 ksc.', 'ลบ.ม.', 45, 2150, 450],
  ['งานโครงสร้าง', '3', 'เหล็กเสริม SD40', 'กก.', 4200, 26, 4],
  ['งานหลังคา', '4', 'โครงหลังคาเหล็กพร้อมแผ่นเมทัลชีท', 'ตร.ม.', 320, 650, 120],
];
const BOQ_F = ['group', 'no', 'desc', 'unit', 'qty', 'mat', 'labor'];
function sampleBoq() {
  const cell = (i, f) => document.querySelector(`#be-body [data-i="${i}"][data-f="${f}"]`);
  // เริ่มที่แถวว่างแถวแรก ไม่ทับรายการที่ผู้ใช้พิมพ์ไว้
  let start = 0;
  while (cell(start, 'desc') && cell(start, 'desc').value.trim()) start++;
  SAMPLE_BOQ.forEach((row, k) => {
    const i = start + k;
    if (!cell(i, 'desc')) document.querySelector('#tab [data-act="add"]')?.click();
    BOQ_F.forEach((f, n) => setVal(cell(i, f), row[n]));
  });
}
const boqRowsOk = () => [...document.querySelectorAll('#be-body tr')].some((tr) => {
  const v = (f) => (tr.querySelector(`[data-f="${f}"]`)?.value || '').replace(/,/g, '').trim();
  return v('desc') && +v('qty') > 0 && (+v('mat') > 0 || +v('labor') > 0);
});
function sampleProgress() {
  const pct = document.querySelector('#upd [name="inputMode"]:checked')?.value === 'pct';
  const boq = myBoq();
  [...document.querySelectorAll('#u-body .c-in input')].slice(0, 3).forEach((inp) => {
    const it = boq.find((b) => b.id === inp.dataset.id);
    const q = +it?.qty || 0;
    setVal(inp, pct ? 30 : Math.round(q * 0.3 * 100) / 100);
  });
  const manual = $('#upd [name="manualPct"]');
  if (manual && !manual.value) setVal(manual, 8);
}
const progressOk = () => [...document.querySelectorAll('#u-body .c-in input')].some((x) => +String(x.value).replace(/,/g, '') > 0)
  || +valOf('#upd [name="manualPct"]') > 0;

/** ข้อมูลของผู้ใช้ที่ใช้เลือกบทเรียน */
export function lessonCtx() {
  const me = store.me;
  const projects = store.data.projects.filter((p) => store.canView(p));
  const roles = new Set(projects.map((p) => store.roleOf(p)).filter(Boolean));
  const proj = (...want) => projects.find((p) => want.includes(store.roleOf(p))) || null;
  return {
    me, projects, roles, proj,
    any: projects.find((p) => p.status === 'active') || projects[0] || null,
    none: !projects.length,
    creator: !!(me.canCreate || store.legacy),
    mobile: matchMedia('(max-width: 900px)').matches,
    local: !store.cloud,
  };
}

export const LESSONS = [
  // ------------------------------------------------------------------
  // 1.0.10 สร้างโครงการแรกแบบจับมือทำ ในฐานะผู้ควบคุมงาน
  {
    id: 'first', icon: 'plus', tone: 'amber', role: 'ผู้ควบคุมงาน', chip: 'สร้างโครงการแรก', act: 'owner', next: 'owner',
    title: 'สร้างโครงการแรก (ลงมือทำ)',
    short: 'กรอกข้อมูลสัญญา ใส่ BOQ บันทึกความคืบหน้าครั้งแรก รายงานประจำวัน และเชิญทีม',
    who: (c) => c.creator,
    steps: (c) => {
      const myName = (store.me.name && store.me.name !== store.me.email ? store.me.name : conf.user) || '';
      return [
        { title: 'มาสร้างโครงการแรกด้วยกัน', pose: 'wai', text: `เราจะทำจริงไปทีละขั้น ในฐานะ<b>ผู้ควบคุมงาน</b>: กรอกข้อมูลสัญญา → ใส่ BOQ → บันทึกความคืบหน้าครั้งแรก → รายงานประจำวัน → เชิญผู้รับจ้างและกรรมการ<br>
          <small>ใส่ข้อมูลโครงการจริงได้เลย หรือกด <b>ใส่ตัวอย่างให้</b> ในแต่ละขั้นเพื่อฝึกก่อน (โครงการฝึกลบได้ที่แท็บตั้งค่าของโครงการ) · ใช้เวลาประมาณ 4 นาที</small>` },
        { route: '#/', target: ['#view .page-head [data-act="new"]', '#view [data-act="new"]'], do: 'click', must: true, until: () => !!$('#pf'), title: 'กดสร้างโครงการ',
          text: '<b>ลองกด “สร้างโครงการ”</b> — แบบฟอร์มจะเปิดขึ้น', note: 'บัญชีนี้ยังสร้างโครงการไม่ได้ — ผู้ดูแลระบบกำหนด “ผู้ที่สร้างโครงการได้” ที่หน้าตั้งค่า' },
        { target: fieldOf('#pf [name="name"]'), do: 'fill', title: 'ชื่อโครงการ', text: 'ใช้ชื่อตามสัญญา เพื่อให้ค้นหาและออกรายงานได้ถูกต้อง',
          fill: { sample: () => setVal($('#pf [name="name"]'), 'ก่อสร้างโรงจอดรถ คสล. 1 ชั้น (ฝึกใช้งาน)'), valid: () => valOf('#pf [name="name"]').length >= 3, need: 'พิมพ์ชื่อโครงการอย่างน้อย 3 ตัวอักษร หรือกด “ใส่ตัวอย่างให้”' } },
        { target: fieldOf('#pf [name="code"]'), do: 'fill', title: 'รหัสโครงการและประเภท', text: 'รหัสใช้อ้างอิงในรายงานและชื่อไฟล์ เช่น CN-69-001 · ประเภทเลือกจากรายการหรือพิมพ์ใหม่ <small>(ไม่บังคับ)</small>',
          fill: { sample: () => { setVal($('#pf [name="code"]'), 'TR-69-001'); setVal($('#pf [name="type"]'), 'อาคาร'); } } },
        { target: fieldOf('#pf [name="contractor"]'), do: 'fill', title: 'ผู้รับจ้างและเลขที่สัญญา', text: 'ชื่อบริษัท/ห้างผู้รับจ้าง และเลขที่สัญญา — แสดงในหัวโครงการและแบบฟอร์มที่พิมพ์ <small>(ไม่บังคับ)</small>',
          fill: { sample: () => { setVal($('#pf [name="contractor"]'), 'หจก. ตัวอย่างการช่าง'); setVal($('#pf [name="contractNo"]'), 'สญ. 001/2569'); } } },
        { target: fieldOf('#pf [name="startDate"]'), do: 'fill', title: 'วันเริ่มสัญญา', text: 'ระบบใช้คำนวณเส้นแผนใน S-Curve และจำนวนวันที่เหลือ',
          fill: { sample: () => setVal($('#pf [name="startDate"]'), isoShift(-30)), valid: () => !!valOf('#pf [name="startDate"]'), need: 'เลือกวันเริ่มสัญญา หรือกด “ใส่ตัวอย่างให้”' } },
        { target: fieldOf('#pf [name="duration"]'), do: 'fill', title: 'ระยะเวลาสัญญา', text: 'ใส่<b>จำนวนวัน</b> แล้วระบบคำนวณวันสิ้นสุดให้ (หรือเลือกวันสิ้นสุดเองก็ได้)',
          fill: { sample: () => setVal($('#pf [name="duration"]'), 180), valid: () => !!valOf('#pf [name="endDate"]'), need: 'ใส่ระยะเวลา (วัน) หรือวันสิ้นสุดสัญญา' } },
        { target: fieldOf('#pf [name="contractValue"]'), do: 'fill', title: 'มูลค่าสัญญา', text: 'ใช้ถ่วงน้ำหนักผลงานรวมทุกโครงการ และคิดผลงานเป็นเงิน — ไม่ระบุ = ใช้ยอดรวม BOQ',
          fill: { sample: () => setVal($('#pf [name="contractValue"]'), '535,000') } },
        { target: fieldOf('#pf [name="manager"]'), do: 'fill', title: 'ผู้ควบคุมงาน', text: 'ชื่อผู้ควบคุมงาน (คุณ) ที่จะแสดงในหัวโครงการและแบบฟอร์ม',
          fill: { sample: () => setVal($('#pf [name="manager"]'), myName || 'นายช่างผู้ควบคุมงาน') } },
        { target: fieldOf('#pf [name="progressMethod"]'), title: 'คิดความคืบหน้าจาก', text: '<b>มูลค่างานตาม BOQ</b> (แนะนำ): ระบบคำนวณ % จากปริมาณที่ทำได้ของแต่ละรายการ · หรือเลือกน้ำหนักงาน / กรอก % เอง / ตามเวลา<br><small>เปลี่ยนได้ภายหลังที่แท็บตั้งค่าของโครงการ</small>' },
        { target: '.modal [data-save]', do: 'click', must: true, until: () => !!curPid(), timeout: 4000, title: 'บันทึกโครงการ', pose: 'point',
          text: '<b>ลองกด “สร้างโครงการ”</b> — คุณจะเป็น<b>เจ้าของโครงการ</b> ที่ทำหน้าที่ผู้ควบคุมงาน (แต่งตั้งทีมได้คนเดียว)<br><small>ระบบกับคลาวด์อาจใช้เวลาสร้างโฟลเดอร์เอกสารสักครู่</small>' },
        { target: '.proj-head', timeout: 20000, checkpoint: true, pose: 'cheer', title: 'ได้โครงการแรกแล้ว!', text: 'หัวโครงการเหมือนกรอบชื่อแบบ: ข้อมูลสัญญา รหัสโครงการ และผลงานสะสมเทียบแผน<br>ต่อไปใส่ <b>BOQ</b> เพื่อให้ระบบคำนวณ % ผลงาน' },
        { route: curP('boq'), when: usesBoq, target: ['#tab [data-act="edit"]'], do: 'click', until: () => !!$('#be-body'), title: 'พิมพ์รายการ BOQ', text: '<b>ลองกด “พิมพ์รายการเอง”</b> (หรือ <b>แก้ไข BOQ</b>)<br><small>มีไฟล์ ปร.4 อยู่แล้ว? ใช้ “นำเข้าจาก Excel / CSV” ได้ภายหลัง</small>' },
        { when: usesBoq, target: () => $('#be-body')?.closest('.table-wrap, table') || $('#be-body'), do: 'fill', title: 'กรอกรายการงาน',
          text: 'แต่ละแถว: หมวดงาน · ลำดับ · รายการ · หน่วย · ปริมาณ · ค่าวัสดุ/หน่วย · ค่าแรง/หน่วย — ระบบคำนวณจำนวนเงินให้<br><small>กด Enter ที่แถวสุดท้ายเพื่อเพิ่มแถว · วางจาก Excel ได้ทั้งตาราง</small>',
          fill: { sample: sampleBoq, valid: boqRowsOk, need: 'ใส่อย่างน้อย 1 รายการ (รายการ ปริมาณ และราคาต่อหน่วย) หรือกด “ใส่ตัวอย่างให้”' } },
        { when: usesBoq, target: '#tab .sticky-bar [data-act="save"]', do: 'click', until: () => !$('#be-body') && myBoq().length > 0, timeout: 3000, title: 'บันทึก BOQ', text: '<b>ลองกด “บันทึก BOQ”</b>' },
        { target: ['.ph-prog a.btn-primary[href*="/updates/new"]', '#view a[href*="/updates/new"]'], do: 'click', until: () => !!$('#upd'), title: 'บันทึกความคืบหน้าครั้งแรก', note: 'บัญชีนี้ไม่มีสิทธิ์บันทึกความคืบหน้าในโครงการนี้',
          text: 'ปุ่มหลักของผู้ควบคุมงาน — ทำทุกสัปดาห์<br><b>ลองกด “บันทึกความคืบหน้า”</b>' },
        { target: () => $('#u-body')?.closest('.table-wrap, table') || $('#upd [name="manualPct"]')?.closest('.field') || null, do: 'fill', title: 'กรอกงานที่ทำได้',
          text: 'ใส่<b>ปริมาณที่ทำได้ช่วงนี้</b>ของแต่ละรายการ (หรือสลับเป็น % สะสม) — แถบด้านบนคำนวณผลงานเทียบแผนทันที',
          fill: { sample: sampleProgress, valid: progressOk, need: 'ใส่ปริมาณงานอย่างน้อย 1 รายการ หรือกด “ใส่ตัวอย่างให้”' } },
        { target: fieldOf('#upd [name="note"]'), do: 'fill', optional: true, title: 'ผลการดำเนินงานและปัญหา', text: 'สรุปสั้นๆ ว่าช่วงนี้ทำอะไร มีปัญหาอะไร แนบรูปหน้างานได้ — ข้อความนี้ไปอยู่ในอีเมลและรายงาน',
          fill: { sample: () => { setVal($('#upd [name="note"]'), 'ขุดดินฐานรากและเทคอนกรีตหยาบแล้ว เริ่มผูกเหล็กฐานราก'); setVal($('#upd [name="issues"]'), 'ฝนตกช่วงบ่าย 2 วัน'); } } },
        { target: '#upd [data-act="save"]', do: 'click', until: () => !$('#upd') && store.data.updates.some((u) => u.projectId === curPid()), timeout: 3000, title: 'บันทึก', text: '<b>ลองกด “บันทึก”</b> — ระบบแจ้งอีเมลหัวหน้าได้ (ถ้าตั้งไว้)' },
        { target: ['#scurve', '.ph-prog'], timeout: 6000, checkpoint: true, pose: 'cheer', title: 'S-Curve จุดแรก', text: 'เส้นประ = แผน · เส้นน้ำเงิน = ผลงานจริง · บันทึกทุกสัปดาห์แล้วเส้นจะต่อกันเป็นกราฟ' },
        { target: '.tabs a[href$="/daily"]', do: 'click', until: () => /\/daily/.test(location.hash), optional: true, title: 'รายงานประจำวัน', text: '<b>ลองกดแท็บ “รายงานประจำวัน”</b>' },
        { when: () => /\/daily/.test(location.hash), target: ['#tab a.btn-primary[href*="/daily/"]'], do: 'click', until: () => !!$('#dyf'), optional: true, title: 'บันทึกรายงานวันนี้', text: '<b>ลองกด “บันทึกรายงานวันนี้”</b>' },
        { when: () => !!$('#dyf'), target: fieldOf('#dyf [name="work"]'), do: 'fill', title: 'กรอกรายงานประจำวัน',
          text: 'ใส่<b>งานที่ดำเนินการ</b>วันนี้ — ช่องอื่น (อากาศเช้า/บ่าย เวลาทำงาน คนงาน เครื่องจักร วัสดุเข้า การหยุดงาน ความปลอดภัย ข้อสั่งการ รูปถ่าย) กรอกเท่าที่มี · <b>ผู้รับจ้างไม่เห็นรายงานนี้</b>',
          fill: {
            sample: () => {
              document.querySelector('#dyf [name="am"][value="clear"]')?.click();
              document.querySelector('#dyf [name="pm"][value="rain"]')?.click();
              setVal($('#dyf [name="workHours"]'), '08:00–17:00');
              setVal($('#dyf [name="work"]'), 'ผูกเหล็กฐานราก F1–F6 ตั้งแบบหล่อฐานราก');
            },
            valid: () => !!valOf('#dyf [name="work"]'), need: 'ใส่ “งานที่ดำเนินการ” หรือกด “ใส่ตัวอย่างให้”',
          } },
        { when: () => !!$('#dyf'), target: '#dyf [data-act="save"]', do: 'click', until: () => !$('#dyf') && store.data.daily.some((d) => d.projectId === curPid()), timeout: 3000, title: 'บันทึกรายงาน', text: '<b>ลองกด “บันทึก”</b> — ส่งอีเมลรายงานประจำวันหรือพิมพ์แบบ PT-F02 ได้จากหน้ารายงาน' },
        { route: curP('members'), target: ['.mem-add', '.mem-panel'], checkpoint: true, title: 'เชิญทีมเข้าโครงการ', text: 'ใส่อีเมล เลือกบทบาท แล้วกด <b>เพิ่มสมาชิก</b> และ <b>บันทึกสมาชิกและสิทธิ์</b> — ระบบส่งอีเมลเชิญให้<br><b>ผู้รับจ้าง</b> ส่งเรื่องขออนุมัติ · <b>คณะกรรมการ</b> พิจารณาตามลำดับ 1 → 2 → ประธาน · <b>หัวหน้า</b> ดูภาพรวม' },
        { target: fieldOf('[data-owner-role]'), optional: true, title: 'คุณทำหน้าที่ผู้ควบคุมงาน', text: 'เจ้าของโครงการเลือกได้ว่าทำหน้าที่ใดในการพิจารณาเรื่อง — ค่าเริ่มต้นคือ <b>ผู้ควบคุมงาน</b> (ผ่าน/ไม่ผ่านเรื่องของผู้รับจ้างเป็นขั้นแรก)' },
        { target: panel('หมวดเรื่องและขั้นตอนพิจารณา'), optional: true, title: 'ขั้นตอนอนุมัติ', text: 'แต่ละหมวดเรื่องกำหนดผู้พิจารณาและจำนวนวันได้ เช่น ผู้ควบคุมงาน 7 วัน → คณะกรรมการ 3 วัน' },
      ];
    },
    doneNote: () => {
      const p = curProject();
      return p && /ฝึกใช้งาน/.test(p.name) ? `โครงการ “${esc(p.name)}” เป็นโครงการฝึก — ลบได้ที่แท็บ <b>ตั้งค่า</b> ของโครงการ แล้วสร้างโครงการจริงจากหน้าหลัก` : '';
    },
  },
  // ------------------------------------------------------------------
  // 1.0.10 ยังไม่มีโครงการ และสร้างโครงการเองไม่ได้ (ผู้รับจ้าง กรรมการ หัวหน้า ที่รอรับเชิญ)
  {
    id: 'invited', icon: 'mail', tone: 'blue', role: 'ทุกคน', chip: 'เริ่มต้น',
    title: 'เริ่มต้น: รอรับเชิญเข้าโครงการ',
    short: 'โครงการจะมาอย่างไร สิ่งที่ทำได้ตอนนี้ และบทเรียนตามบทบาท',
    who: (c) => c.none && !c.creator,
    steps: (c) => [
      { title: 'ยินดีต้อนรับ', pose: 'wai', text: `ตอนนี้คุณยังไม่ได้เป็นสมาชิกของโครงการใด — <b>เจ้าของโครงการ</b>จะเพิ่มอีเมล <b>${esc(c.me.email || '')}</b> พร้อมบทบาท (ผู้รับจ้าง · คณะกรรมการ · หัวหน้า …) แล้วคุณจะได้รับอีเมลเชิญ` },
      { route: '#/', target: '#view .empty', title: 'โครงการจะแสดงที่นี่', text: 'เมื่อได้รับเชิญ โครงการจะขึ้นที่หน้าหลักทันที พร้อมปุ่มหลักตามบทบาทของคุณ' },
      c.mobile
        ? { target: '#tabbar', title: 'เมนูหลัก', text: 'หน้าหลัก · งานของฉัน · โครงการ · สนทนา · สรุป · ตั้งค่า' }
        : { target: '.side .nav', title: 'เมนูหลัก', text: '<b>งานของฉัน</b> รวมทุกเรื่องที่รอคุณ · <b>สนทนาและประชุม</b> · <b>แบบฟอร์มและระเบียบ</b> ใช้ได้ทันทีแม้ยังไม่มีโครงการ' },
      !c.mobile && { target: nav('library'), do: 'click', title: 'แบบฟอร์มและระเบียบ', text: '<b>ลองกด “แบบฟอร์มและระเบียบ”</b>' },
      { route: '#/library', target: [panel('แบบฟอร์มมาตรฐานในระบบ'), '#view .panel'], title: 'แบบฟอร์มมาตรฐาน', text: 'ใบขออนุมัติ รายงานประจำวัน/สัปดาห์ บันทึกประชุม ตรวจรับงานงวด — พิมพ์หรือบันทึก PDF ได้ทันที' },
      { route: '#/settings', target: [panel('บัญชีของฉัน'), '#view .panel'], title: 'ชื่อที่แสดงและการแจ้งเตือน', text: 'ตรวจชื่อ–ตำแหน่งที่จะแสดงในเรื่องที่คุณส่ง/พิจารณา และตั้งค่าการแสดงผลของเครื่องนี้' },
      { target: '#guide-fab', optional: true, title: 'บทเรียนตามบทบาทจะชวนเอง', text: 'เมื่อได้รับเชิญเป็น<b>ผู้รับจ้าง</b> <b>คณะกรรมการ</b> หรือ<b>หัวหน้า</b> ไกด์จะชวนเรียนบทของบทบาทนั้นอัตโนมัติ — สอนเฉพาะสิ่งที่คุณมีสิทธิ์ทำ' },
    ],
  },
  // ------------------------------------------------------------------
  {
    id: 'basics', icon: 'home', tone: 'amber', role: 'ทุกคน', chip: 'พื้นฐาน',
    title: 'พื้นฐาน: รู้จักหน้าจอ',
    short: 'เมนู ภาพรวมผลงาน งานของฉัน และหน้าโครงการ',
    who: () => true,
    steps: (c) => {
      const p = c.any;
      return [
        { title: 'ยินดีต้อนรับสู่ระบบติดตามโครงการ', text: `บทเรียนนี้พาดูส่วนสำคัญของหน้าจอ ใช้เวลาประมาณ 1 นาที<br>กด <b>ถัดไป</b> เพื่อไปต่อ — ถ้าขั้นไหนมีป้าย <b>ลองทำ</b> ให้กดตรงที่ไฮไลต์ด้วยตัวเอง` },
        c.mobile
          ? { route: '#/', target: '#tabbar', title: 'เมนูหลัก', text: 'บนมือถือเมนูอยู่ด้านล่าง: หน้าหลัก · งานของฉัน · โครงการ · สนทนา · สรุป · ตั้งค่า<br>ตัวเลขสีส้มบนเมนูคือจำนวนเรื่องที่รอคุณ' }
          : { route: '#/', target: '.side .nav', title: 'เมนูหลัก', text: 'หน้าหลัก · <b>งานของฉัน</b> · โครงการ · สนทนาและประชุม · สรุปผู้บริหาร · แบบฟอร์มและระเบียบ · ตั้งค่า · คู่มือ<br>ตัวเลขสีส้มบนเมนูคือจำนวนเรื่องที่รอคุณ' },
        p
          ? { route: '#/', target: '.portfolio', title: 'ผลงานรวมทุกโครงการ', text: 'ตัวเลขใหญ่คือผลงานรวม (ถ่วงน้ำหนักด้วยมูลค่าสัญญา)<br>แถบน้ำเงิน = ผลงานจริง · เส้นดำ = แผน · ลายแดง = ส่วนที่ตามหลังแผน' }
          : { route: '#/', target: '[data-act="new"]', title: 'เริ่มจากสร้างโครงการ', text: 'ยังไม่มีโครงการ — กด <b>สร้างโครงการ</b> แล้วกรอกชื่อ เลขที่สัญญา วันเริ่ม–สิ้นสุด และมูลค่าสัญญา', note: 'ยังไม่มีโครงการที่คุณเป็นสมาชิก — เมื่อเจ้าของโครงการเพิ่มอีเมลของคุณ โครงการจะแสดงที่หน้าหลักทันที' },
        { route: '#/', target: '.mywork', optional: true, title: 'งานของฉัน', text: 'สิ่งที่ต้องทำของคุณ: เรื่องรอพิจารณา เรื่องที่ถูกตีกลับ เอกสารใกล้ครบกำหนด และประชุมใน 7 วัน — กดแต่ละแถวเพื่อไปที่เรื่องนั้นทันที' },
        p && { route: '#/', target: ['.prow-list .prow', '.prow'], do: 'click', title: 'เข้าโครงการ', text: 'แต่ละแถวคือ 1 โครงการ: % ผลงานเทียบแผน สถานะเร็ว/ช้ากว่าแผน และเรื่องรอพิจารณา<br><b>ลองกดที่โครงการนี้</b>' },
        p && { route: inProject(p), target: '.proj-head', title: 'หน้าโครงการ', text: 'ข้อมูลสัญญา ผลงานสะสมเทียบแผน และปุ่มหลักตามบทบาทของคุณ<br>ป้าย <b>“คุณคือ …”</b> บอกบทบาทของคุณในโครงการนี้' },
        p && { target: '.tabs', title: 'แท็บของโครงการ', text: 'ภาพรวม (S-Curve) · BOQ และแผนงาน · บันทึกความคืบหน้า · รายงานประจำวัน · เรื่องขออนุมัติ · เอกสาร · สนทนาและประชุม · สมาชิกและสิทธิ์<br><small>แท็บที่เห็นขึ้นกับสิทธิ์ของคุณ</small>' },
        { target: nav('inbox'), do: 'click', title: 'เปิดงานของฉัน', text: '<b>ลองกด “งานของฉัน”</b> ที่เมนู' },
        { route: '#/inbox', target: ['#view .inbox-sec', '#view .panel'], title: 'รวมทุกเรื่องที่รอคุณ', text: 'เรียงจากเรื่องที่ค้างนานที่สุด<br>ป้ายสีเหลือง = ค้าง 7 วันขึ้นไปหรือเกินกำหนดพิจารณา · สีแดง = ค้าง 14 วันขึ้นไป <small>(ค่าเริ่มต้น ปรับได้)</small>' },
        { target: nav('chat'), title: 'สนทนาและประชุม', text: 'ห้องแผนก · ห้องโครงการ (รวมผู้รับจ้าง) · ห้องภายใน กฟผ. · นัดประชุมพร้อมอีเมลเชิญ วาระ และบันทึกการประชุม' },
        { target: '#guide-fab', optional: true, title: 'กลับมาเรียนต่อได้ที่ปุ่มนี้', text: 'ปุ่มไกด์มุมขวาล่างมี<b>บทเรียนตามบทบาทของคุณ</b> และลิงก์ไปคู่มือฉบับเต็ม — เปิดได้ทุกเมื่อ' },
      ];
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'owner', icon: 'star', tone: 'navy', role: 'เจ้าของโครงการ', act: 'owner',
    title: 'เจ้าของโครงการ: ตั้งต้นโครงการ',
    short: 'สร้างโครงการ แต่งตั้งสมาชิก ขั้นตอนอนุมัติ BOQ',
    who: (c) => c.roles.has('owner'),
    steps: (c) => {
      const p = c.proj('owner');
      return [
        { route: '#/projects', target: '[data-act="new"]', title: 'สร้างโครงการ', text: 'ผู้สร้างเป็น<b>เจ้าของโครงการ</b> — ผู้เดียวที่แต่งตั้งสมาชิกและกำหนดขั้นตอนอนุมัติได้<br>กรอกชื่อ เลขที่สัญญา วันเริ่ม–สิ้นสุด และมูลค่าสัญญา', note: 'บัญชีนี้ยังสร้างโครงการไม่ได้ — ผู้ดูแลระบบกำหนด “ผู้ที่สร้างโครงการได้” ที่หน้าตั้งค่า' },
        p && { route: P(p, 'members'), target: panel('สมาชิกโครงการ'), title: 'แต่งตั้งสมาชิก', text: 'เพิ่มด้วยอีเมล แล้วเลือกบทบาท: ผู้ควบคุมงาน · ผู้รับจ้าง · คณะกรรมการตรวจรับ (กำหนดลำดับ 1 → 2 → … → ประธาน) · หัวหน้า/ผู้บริหาร · ผู้ติดตาม<br>เลือกระดับการรับอีเมลรายคนได้' },
        p && { target: panel('สิทธิ์ของแต่ละบทบาท'), optional: true, title: 'สิทธิ์ของแต่ละบทบาท', text: 'เปิด/ปิดสิทธิ์ได้ เช่น ให้ผู้ควบคุมงานแก้ BOQ หรือให้กรรมการส่งเรื่องได้' },
        p && { target: panel('หมวดเรื่องและขั้นตอนพิจารณา'), optional: true, title: 'ขั้นตอนอนุมัติ', text: 'แต่ละหมวดกำหนดขั้นพิจารณาและจำนวนวัน เช่น ผู้ควบคุมงาน 7 วัน → คณะกรรมการ 3 วัน<br>ขั้นคณะกรรมการเลือก “ทุกคนเรียงตามลำดับ” หรือ “คนใดคนหนึ่ง” ได้' },
        p && { target: tab('boq'), do: 'click', title: 'ไปที่ BOQ และแผนงาน', text: '<b>ลองกดแท็บ “BOQ และแผนงาน”</b>' },
        p && { route: P(p, 'boq'), target: ['#tab .tb-actions', '#tab .toolbar', '#tab'], title: 'ใส่ BOQ', text: 'กด <b>แก้ไข BOQ</b> เพื่อพิมพ์รายการ หรือปุ่ม <b>⋯</b> เพื่อนำเข้าจาก Excel/CSV วางจาก Excel และส่งออก ตามแบบ ปร.4 — ระบบใช้มูลค่าแต่ละรายการคำนวณ % ผลงาน<br>แท็บย่อย <b>แผนงาน</b> กำหนดวันเริ่ม–จบเพื่อทำ Gantt และเส้นแผนใน S-Curve' },
        p && { route: P(p, 'subs/required'), target: ['.req-table', '#tab .panel', '#tab'], title: 'เอกสารที่ต้องส่งตามสัญญา', text: 'กำหนดได้ เช่น “ภายใน 15 วันหลังเริ่มสัญญา” — ระบบคำนวณวันครบกำหนด เตือนผู้รับจ้าง และบอกว่าส่งตรงเวลาหรือช้ากี่วัน' },
        p && { target: tab('settings'), optional: true, title: 'ตั้งค่าโครงการ', text: 'วิธีคำนวณผลงาน เกณฑ์สีเหลือง/แดงของโครงการ ผู้รับอีเมลเพิ่มเติม และการโอน/ลบโครงการ' },
      ];
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'supervisor', icon: 'clipboard', tone: 'green', role: 'ผู้ควบคุมงาน', act: 'supervisor',
    title: 'ผู้ควบคุมงาน: บันทึกงานและพิจารณาเรื่อง',
    short: 'บันทึกความคืบหน้า รายงานประจำวัน ผ่าน/ไม่ผ่าน',
    who: (c) => c.roles.has('supervisor'),
    steps: (c) => {
      const p = c.proj('supervisor') || c.proj('owner') || c.any;
      const rec = can(p, 'recordProgress');
      const approve = can(p, 'approve');
      return [
        p && { route: P(p), target: '.proj-head', title: `โครงการ “${p.name}”`, text: 'หัวโครงการแสดงข้อมูลสัญญาและผลงานสะสมเทียบแผน · ป้าย <b>“คุณคือ …”</b> บอกบทบาทของคุณ — กดเพื่อดูสิทธิ์' },
        rec && { route: P(p), target: '.ph-prog a[href*="/updates/new"]', do: 'click', until: () => !!$('#upd'), title: 'บันทึกความคืบหน้า', text: 'ปุ่มหลักของคุณ — ทำทุกสัปดาห์<br><b>ลองกด “บันทึกความคืบหน้า”</b>' },
        rec && { target: () => $('#u-body')?.closest('.table-wrap, table') || $('#upd'), title: 'กรอกงานที่ทำได้', text: 'ใส่<b>ปริมาณที่ทำได้ช่วงนี้</b>ของแต่ละรายการ (หรือสลับเป็น % สะสม) ระบบคำนวณผลงานเทียบแผนทันที แนบรูปหน้างาน แล้วกด <b>บันทึก</b> — หัวหน้าได้รับอีเมล<br><small>บทเรียนนี้ยังไม่บันทึกจริง</small>' },
        p && { route: P(p, 'daily'), target: ['.dy-strip', '#tab'], optional: true, title: 'รายงานประจำวัน', text: rec
          ? 'แถบ 14 วันบอกว่าวันไหนบันทึกแล้ว · บันทึกสภาพอากาศ คนงาน เครื่องจักร งานที่ทำ การหยุดงาน ความปลอดภัย ข้อสั่งการ และรูป<br>“คัดลอกจากวันก่อน” ช่วยให้กรอกเร็วขึ้น · <b>ผู้รับจ้างไม่เห็นแท็บนี้</b>'
          : 'ดูรายงานประจำวันที่บันทึกไว้ และส่งออก/พิมพ์แบบ PT-F02 ได้ — การบันทึกใช้สิทธิ์ “บันทึกความคืบหน้า” ซึ่งเจ้าของโครงการยังไม่ได้เปิดให้คุณ' },
        can(p, 'editBoq') && { route: P(p, 'boq'), target: ['#tab [data-act="edit"]', '#tab'], optional: true, title: 'BOQ และแผนงาน', text: 'คุณแก้ไข BOQ ได้ — พิมพ์เอง วางจาก Excel หรือนำเข้าไฟล์ ปร.4 · แท็บย่อย <b>แผนงาน</b> ทำ Gantt และเส้นแผนใน S-Curve' },
        p && { route: P(p, 'subs'), target: ['.sub-kpis', '#tab'], title: 'เรื่องขออนุมัติ', text: 'กดตัวเลขเพื่อกรอง: รอพิจารณา · สีเหลือง/แดง (ค้างนาน) · ผ่าน · ไม่ผ่าน' + (approve ? ' · <b>รอคุณพิจารณา</b>' : '') },
        approve && { target: ['#s-list .subrow:has(.chip-me) a', '#s-list .subrow a'], do: 'click', optional: true, title: 'เปิดเรื่อง', text: 'เรื่องที่มีป้าย “รอคุณพิจารณา” คือถึงขั้นของคุณแล้ว<br><b>ลองกดเปิดเรื่องนี้</b>' },
        approve && { target: '.stepper', optional: true, title: 'ขั้นตอนการพิจารณา', text: 'เห็นว่าเรื่องอยู่ขั้นไหน ใครต้องพิจารณา กำหนดกี่วัน และผลกับความเห็นของแต่ละขั้น' },
        approve && { target: '#act-decide', optional: true, title: 'ผ่าน / ไม่ผ่าน', text: 'เลือกผลการพิจารณา — <b>ไม่ผ่านต้องระบุเหตุผล</b><br>ผู้ส่งได้รับอีเมลทันที และแก้ไขส่งใหม่ได้' },
        can(p, 'manageRequired') && { route: P(p, 'subs/required'), target: ['.req-table', '#tab .panel', '#tab'], optional: true, title: 'เอกสารที่ต้องส่งตามสัญญา', text: 'คุณกำหนดรายการเอกสารที่ผู้รับจ้างต้องส่งได้ เช่น “ภายใน 15 วันหลังเริ่มสัญญา” — ระบบเตือนและบอกว่าส่งตรงเวลาหรือช้ากี่วัน' },
        permStep(p),
        { route: '#/library', target: panel('แบบฟอร์มมาตรฐานในระบบ'), title: 'แบบฟอร์มมาตรฐาน', text: 'PT-F01 – F06 (ใบขออนุมัติ รายงานประจำวัน/สัปดาห์ บันทึกประชุม ตรวจรับงานงวด ใบสั่งการ) พิมพ์หรือบันทึก PDF ได้ทันที พร้อมข้อมูลโครงการ' },
      ];
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'contractor', icon: 'send', tone: 'blue', role: 'ผู้รับจ้าง', act: 'contractor',
    title: 'ผู้รับจ้าง: ส่งเรื่องและติดตามผล',
    short: 'ส่งเรื่องขออนุมัติ เอกสารตามสัญญา ส่งใหม่เมื่อถูกตีกลับ',
    who: (c) => c.roles.has('contractor'),
    steps: (c) => {
      const p = c.proj('contractor') || c.any;
      const submit = can(p, 'submit') && !store.legacy;
      return [
        p && { route: P(p), target: '.proj-head', title: `โครงการ “${p.name}”`, text: 'หัวโครงการแสดงข้อมูลสัญญาและผลงานเทียบแผนที่ผู้ควบคุมงานบันทึก · ป้าย <b>“คุณคือ ผู้รับจ้าง”</b>' },
        submit && { route: P(p), target: ['.ph-prog a[href*="/subs/new"]', '#tab a[href*="/subs/new"]'], do: 'click', until: () => !!$('#nf'), title: 'ส่งเรื่องขออนุมัติ / แจ้งปัญหา', text: 'ปุ่มหลักของคุณ<br><b>ลองกดเพื่อเปิดแบบฟอร์ม</b> <small>(บทเรียนนี้ยังไม่ส่งเรื่องจริง)</small>' },
        submit && { target: () => $('#nf [name="category"]')?.closest('.field') || $('#nf'), optional: true, title: 'เลือกหมวดเรื่อง', text: 'วัสดุ/อุปกรณ์ · แบบ (Shop Drawing) · แผนงาน · แจ้งปัญหา · ส่งมอบงาน ฯลฯ — แต่ละหมวดมีขั้นตอนพิจารณาและจำนวนวันของตัวเอง' },
        submit && { target: ['#nf', '#tab'], title: 'กรอกและส่งเรื่อง', text: 'ใส่ชื่อเรื่อง รายละเอียด แนบไฟล์ แล้วกด <b>ส่งเรื่อง</b> — ผู้ควบคุมงานได้รับอีเมลทันที และเห็นว่าต้องพิจารณาภายในกี่วัน' },
        p && { route: P(p, 'subs'), target: ['.sub-kpis', '#s-list', '#tab'], title: 'ติดตามผล', text: 'ดูว่าเรื่องอยู่ขั้นไหน ใครกำลังพิจารณา ค้างกี่วัน และผลผ่าน/ไม่ผ่าน — คุณได้รับอีเมลเมื่อมีผล' },
        p && { route: P(p, 'subs/required'), target: ['.req-table', '#tab .panel', '#tab'], optional: true, title: 'เอกสารที่ต้องส่งตามสัญญา', text: 'รายการเอกสารพร้อมวันครบกำหนด สีแดงคือเลยกำหนด' + (submit ? '<br>กด <b>ส่งเอกสารนี้</b> ในแต่ละแถวเพื่อส่งเป็นเรื่องขออนุมัติ' : '') },
        submit && { target: nav('inbox'), title: 'เรื่องที่ถูกตีกลับ', text: 'เรื่องที่ไม่ผ่านจะอยู่ใน <b>งานของฉัน</b> พร้อมเหตุผล — เปิดเรื่องแล้วกด “แก้ไขและส่งใหม่”' },
        p && { route: P(p, 'chat'), target: ['#tab .room', '#tab .panel', '#tab'], optional: true, title: 'สนทนาในโครงการ', text: 'สอบถามผู้ควบคุมงานในห้องโครงการ และดูนัดประชุมที่คุณได้รับเชิญ' },
        permStep(p),
      ];
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'committee', icon: 'users', tone: 'violet', role: 'คณะกรรมการตรวจรับ', act: 'committee',
    title: 'คณะกรรมการ: พิจารณาตามลำดับและโหวต',
    short: 'ลำดับกรรมการ พิจารณาเรื่อง โหวตเลือกรูปแบบ/สี',
    who: (c) => c.roles.has('committee'),
    steps: (c) => {
      const p = c.proj('committee') || c.any;
      const approve = can(p, 'approve');
      return [
        approve && { route: '#/inbox', target: ['#view .inbox-sec', '#view .panel'], title: 'เรื่องรอคุณพิจารณา', text: 'เรื่องจะมาถึงคุณเมื่อผ่านผู้ควบคุมงานและกรรมการลำดับก่อนหน้าแล้ว — ระบบส่งอีเมลแจ้งทุกครั้ง' },
        p && { route: P(p, 'members'), target: ['.seat-flow', panel('สมาชิกโครงการ')], title: 'ลำดับกรรมการ', text: 'กรรมการลำดับที่ 1 → 2 → 3 … → <b>ประธานกรรมการ</b> (พิจารณาเป็นคนสุดท้าย) — เจ้าของโครงการเป็นผู้กำหนดลำดับ' },
        p && { route: P(p), target: tab('subs'), do: 'click', until: () => /\/subs/.test(location.hash), title: 'เรื่องขออนุมัติ', text: '<b>ลองกดแท็บ “เรื่องขออนุมัติ”</b>' },
        p && { target: ['#s-list .subrow:has(.chip-me) a', '#s-list .subrow:has(.vote-tag) a', '#s-list .subrow a'], do: 'click', optional: true, title: 'เปิดเรื่อง', text: (approve ? 'ป้าย “รอคุณพิจารณา” = ถึงลำดับของคุณแล้ว · ' : '') + 'ป้าย “กำลังโหวต” = รอคณะกรรมการเลือกรูปแบบ/สี<br><b>ลองกดเปิดเรื่องนี้</b>' },
        p && { target: '.stepper', optional: true, title: 'ขั้นตอนการพิจารณา', text: 'เห็นผลและความเห็นของผู้ควบคุมงานและกรรมการลำดับก่อนหน้า' },
        approve && { target: ['#vote', '.vote-cta', '#act-decide'], title: 'โหวต หรือ ผ่าน/ไม่ผ่าน', text: 'ถ้าเรื่องเปิดโหวตรูปแบบ/สี ให้เลือกตัวเลือก — เสียงข้างมากชนะ คะแนนเท่ากันประธานชี้ขาด<br>ไม่ผ่านต้องระบุเหตุผลเสมอ', note: 'เมื่อถึงลำดับของคุณ ส่วน “พิจารณาเรื่องนี้” หรือ “โหวต” จะแสดงในหน้าเรื่อง' },
        p && { target: '[data-act="f01"]', optional: true, title: 'พิมพ์ใบขออนุมัติ', text: 'พิมพ์แบบ PT-F01 พร้อมผลการพิจารณาทุกขั้นเพื่อลงนาม' },
        can(p, 'submit') && !store.legacy && { route: P(p, 'subs'), target: ['#tab a[href*="/subs/new"]', '.sub-kpis'], optional: true, title: 'ส่งเรื่องเองได้', text: 'คณะกรรมการส่งเรื่องหรือแจ้งปัญหาในโครงการได้ด้วย (ตามที่เจ้าของโครงการเปิดสิทธิ์)' },
        permStep(p),
      ];
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'head', icon: 'chart', tone: 'teal', role: 'หัวหน้า/ผู้บริหาร', act: 'head',
    title: 'หัวหน้า/ผู้บริหาร: ภาพรวมและนำเสนอ',
    short: 'สรุปผู้บริหาร โหมดนำเสนอ ส่งออก Excel รายงานประจำเดือน',
    who: (c) => c.roles.has('head') || c.roles.has('viewer') || c.me.isExec || c.me.isDept,
    steps: (c) => {
      const p = c.proj('head', 'viewer') || c.any;
      return [
        p && { route: '#/', target: '.portfolio', title: 'ภาพรวมทุกโครงการ', text: 'ผลงานรวมเทียบแผน มูลค่าสัญญา ผลงานคิดเป็นเงิน และจำนวนโครงการที่ล่าช้า' },
        { target: nav('summary'), do: 'click', title: 'สรุปผู้บริหาร', text: '<b>ลองกด “สรุปผู้บริหาร”</b>' },
        { route: '#/summary', target: ['.rep-kpi', '#view .panel'], title: 'สรุปความคืบหน้า', text: 'ผลงานรวม โครงการที่ล่าช้า และเรื่องค้างพิจารณาสีเหลือง/แดงของทุกโครงการในหน้าเดียว' },
        { target: '[data-act="present"]', optional: true, title: 'โหมดนำเสนอ', text: 'เปิดเต็มจอสำหรับประชุมแผนก — กดลูกศรเพื่อเลื่อนหน้า กด Esc เพื่อออก' },
        { target: '.page-head .mn-btn', optional: true, title: 'ส่งออก', text: 'รวมคำสั่งไว้ในปุ่มเดียว: <b>ส่งออก Excel</b> · <b>พิมพ์/บันทึก PDF</b> · <b>ส่งรายงานประจำเดือน</b>ทางอีเมล (ระบบส่งอัตโนมัติวันที่ 1 ของทุกเดือน)' },
        p && { route: P(p), target: '#scurve', optional: true, title: 'S-Curve รายโครงการ', text: 'เส้นแผนเทียบผลงานจริงของแต่ละโครงการ — คุณได้รับอีเมลเมื่อมีผลการพิจารณาหรือการอัปเดตความคืบหน้า' },
      ];
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'admin', icon: 'sliders', tone: 'slate', role: 'ผู้ดูแลระบบ', act: 'admin',
    title: 'ผู้ดูแลระบบ: ตั้งค่าระบบ',
    short: 'ที่เก็บข้อมูล ผู้ใช้ของระบบ อีเมลอัตโนมัติ คลังแบบฟอร์ม',
    who: (c) => !!c.me.isAdmin,
    steps: () => [
      { route: '#/settings', target: panel('ที่เก็บข้อมูล'), title: 'ที่เก็บข้อมูล', text: 'เลือก Google Drive · SharePoint · OneDrive แล้วส่ง<b>ลิงก์เชิญ</b>ให้ทีม<br><small>โหมดทดลองเก็บข้อมูลในเบราว์เซอร์นี้เท่านั้น</small>' },
      { target: panel('ผู้ใช้และสิทธิ์ของระบบ'), optional: true, title: 'ผู้ใช้ของระบบ', text: 'กำหนดผู้ดูแลระบบ ผู้บริหาร (ดูทุกโครงการ) และผู้ที่สร้างโครงการได้ (อีเมลหรือโดเมน เช่น <code>@egat.co.th</code>)' },
      { target: panel('ค่ากลางของหน่วยงาน'), optional: true, title: 'ค่ากลางของหน่วยงาน', text: 'ชื่อหน่วยงานและเกณฑ์สีเหลือง/แดงกลาง ใช้กับทุกโครงการที่ไม่ได้ตั้งเอง' },
      { target: panel('อีเมลอัตโนมัติ'), optional: true, title: 'อีเมลอัตโนมัติ', text: 'ตั้งเวลาเตือนงานค้าง รายงานประจำวัน/สัปดาห์/เดือน — Google ส่งเองตามเวลา · Microsoft 365 ส่งเมื่อผู้ดูแลกดส่งหรือเปิดแอป' },
      { route: '#/library', target: ['#view [data-act="add"]', '#view .panel'], title: 'คลังแบบฟอร์มและระเบียบ', text: 'อัปโหลดแบบฟอร์ม ระเบียบ และมาตรฐานของหน่วยงาน แล้วเลือกให้แสดงในหน้าที่ใช้งานของทุกโครงการ (ตามหมวดเรื่อง/ประเภทงาน)' },
      { route: '#/settings', target: panel('สำรองและกู้คืนข้อมูล'), optional: true, title: 'สำรองข้อมูล', text: 'ดาวน์โหลดไฟล์สำรองเป็นระยะ และใช้ย้ายข้อมูลจากโหมดทดลองขึ้นที่เก็บจริง' },
    ],
  },
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;

/** บทเรียนที่แนะนำ เรียงตามลำดับที่ควรเรียน */
export function recommended(c = lessonCtx()) {
  const order = c.none
    // ยังไม่มีโครงการ: ผู้สร้างได้ → ลงมือสร้างโครงการแรก · ผู้อื่น → รอรับเชิญ
    ? (c.creator ? ['first', 'admin'] : ['invited', 'head', 'admin'])
    : ['basics', 'contractor', 'supervisor', 'committee', 'owner', 'head', 'admin']; // มีโครงการแล้ว: บทสร้างโครงการแรกอยู่ใน "บทเรียนอื่น"
  return order.map(lessonById).filter((l) => l && l.who(c));
}

/** บทเรียนของบทบาท (ใช้ชวนเรียนเมื่อได้รับบทบาทใหม่) */
export const ROLE_LESSON = Object.freeze(Object.assign(Object.create(null), { owner: 'owner', supervisor: 'supervisor', contractor: 'contractor', committee: 'committee', head: 'head', viewer: 'head' }));

/** ขั้นตอนที่ใช้ได้ (ตัดขั้นที่ไม่มีโครงการรองรับ) */
export function stepsOf(lesson, c = lessonCtx()) {
  const all = lesson.steps(c);
  const steps = all.filter(Boolean);
  if (c.none && steps.length < all.length && !['basics', 'first', 'invited'].includes(lesson.id)) {
    steps.push({ title: 'ยังไม่มีโครงการสำหรับบทนี้', pose: 'think', text: `ส่วนที่เหลือของบทเรียนต้องมีโครงการที่คุณเป็น${esc(lesson.role)} — เมื่อเจ้าของโครงการเพิ่มอีเมลของคุณ ไกด์จะชวนเรียนบทนี้อีกครั้ง${c.creator ? '<br>หรือเริ่มจากบท <b>สร้างโครงการแรก (ลงมือทำ)</b>' : ''}` });
  }
  return steps;
}

/** บทบาทของผู้ใช้ (ข้อความ) */
export function rolesText(c = lessonCtx()) {
  const out = [];
  if (c.me.isAdmin) out.push('ผู้ดูแลระบบ');
  if (c.me.isExec) out.push('ผู้บริหาร');
  for (const r of ['owner', 'supervisor', 'committee', 'contractor', 'head', 'viewer']) if (c.roles.has(r)) out.push(R.ROLES[r].label);
  return out;
}

/** อีเมลตัวอย่างของบทบาทนี้ (ใช้ "ลองเป็น…" ในโหมดทดลอง) */
export function demoEmailFor(role) {
  for (const p of store.data.projects) {
    const m = (p.members || []).find((x) => (role === 'head' ? ['head', 'viewer'].includes(x.role) : x.role === role));
    if (m) return R.norm(m.email);
  }
  return '';
}
