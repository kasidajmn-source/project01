// บทเรียนสอนการใช้งาน (1.0.7) — แต่ละบทบาทมีบทเรียนของตัวเอง
// ขั้นตอน (step):
//   title, text (HTML ที่เขียนเอง — ข้อมูลจากผู้ใช้ต้อง esc() ก่อน)
//   route   : hash ที่ต้องเปิดก่อนแสดงขั้นนี้ (ไม่ใส่ = อยู่หน้าเดิม)
//   target  : ตัวเลือก CSS, รายการตัวเลือก (ใช้ตัวแรกที่มองเห็น) หรือฟังก์ชันที่คืน element — ไม่ใส่ = การ์ดกลางจอ
//   do      : 'click' = ให้ผู้ใช้ลองกดเอง (มีปุ่ม "ทำให้ดู" และ "ข้ามขั้นนี้")
//   optional: ไม่พบเป้าหมาย → ข้ามขั้นนี้ไปเลย
//   note    : ไม่พบเป้าหมาย → แสดงข้อความนี้กลางจอแทน
import { store } from './store.js';
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

/** ข้อมูลของผู้ใช้ที่ใช้เลือกบทเรียน */
export function lessonCtx() {
  const me = store.me;
  const projects = store.data.projects.filter((p) => store.canView(p));
  const roles = new Set(projects.map((p) => store.roleOf(p)).filter(Boolean));
  const proj = (...want) => projects.find((p) => want.includes(store.roleOf(p))) || null;
  return {
    me, projects, roles, proj,
    any: projects.find((p) => p.status === 'active') || projects[0] || null,
    mobile: matchMedia('(max-width: 900px)').matches,
    local: !store.cloud,
  };
}

export const LESSONS = [
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
          ? { route: '#/', target: '#tabbar', title: 'เมนูหลัก', text: 'บนมือถือเมนูอยู่ด้านล่าง: หน้าหลัก · งานของฉัน · โครงการ · สนทนา · สรุป · ตั้งค่า<br>ตัวเลขสีเหลืองบนเมนูคือจำนวนเรื่องที่รอคุณ' }
          : { route: '#/', target: '.side .nav', title: 'เมนูหลัก', text: 'หน้าหลัก · <b>งานของฉัน</b> · โครงการ · สนทนาและประชุม · สรุปผู้บริหาร · แบบฟอร์มและระเบียบ · ตั้งค่า · คู่มือ<br>ตัวเลขสีเหลืองบนเมนูคือจำนวนเรื่องที่รอคุณ' },
        p
          ? { route: '#/', target: '.portfolio', title: 'ผลงานรวมทุกโครงการ', text: 'ตัวเลขใหญ่คือผลงานรวม (ถ่วงน้ำหนักด้วยมูลค่าสัญญา)<br>แถบเหลือง = ผลงานจริง · เส้นดำ = แผน · ลายแดง = ส่วนที่ตามหลังแผน' }
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
    who: (c) => c.roles.has('owner') || (c.me.canCreate && !c.roles.size),
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
      return [
        p && { route: P(p), target: '.ph-prog .btn-primary', title: 'บันทึกความคืบหน้า', text: 'ปุ่มหลักของคุณ: กรอกปริมาณงานที่ทำได้หรือ % สะสม ระบบคำนวณผลงานเทียบแผนทันที แนบรูป และแจ้งอีเมลหัวหน้า', note: 'ปุ่มบันทึกความคืบหน้าแสดงเมื่อคุณมีสิทธิ์บันทึกในโครงการนั้น' },
        p && { target: tab('daily'), do: 'click', optional: true, title: 'รายงานประจำวัน', text: '<b>ลองกดแท็บ “รายงานประจำวัน”</b>' },
        p && { route: P(p, 'daily'), target: ['.dy-strip', '#tab'], optional: true, title: 'บันทึกทุกวัน', text: 'แถบ 14 วันบอกว่าวันไหนบันทึกแล้ว · บันทึกสภาพอากาศ คนงาน เครื่องจักร งานที่ทำ การหยุดงาน ความปลอดภัย ข้อสั่งการ และรูป<br>“คัดลอกจากวันก่อน” ช่วยให้กรอกเร็วขึ้น · <b>ผู้รับจ้างไม่เห็นแท็บนี้</b>' },
        p && { target: tab('subs'), do: 'click', title: 'เรื่องขออนุมัติ', text: '<b>ลองกดแท็บ “เรื่องขออนุมัติ”</b>' },
        p && { route: P(p, 'subs'), target: ['.sub-kpis', '#tab'], title: 'ภาพรวมเรื่อง', text: 'กดตัวเลขเพื่อกรอง: รอพิจารณา · สีเหลือง/แดง (ค้างนาน) · ผ่าน · ไม่ผ่าน · <b>รอคุณพิจารณา</b>' },
        p && { target: ['#s-list .subrow:has(.chip-me) a', '#s-list .subrow a'], do: 'click', optional: true, title: 'เปิดเรื่อง', text: 'เรื่องที่มีป้าย “รอคุณพิจารณา” คือถึงขั้นของคุณแล้ว<br><b>ลองกดเปิดเรื่องนี้</b>' },
        p && { target: '.stepper', optional: true, title: 'ขั้นตอนการพิจารณา', text: 'เห็นว่าเรื่องอยู่ขั้นไหน ใครต้องพิจารณา กำหนดกี่วัน และผลกับความเห็นของแต่ละขั้น' },
        p && { target: '#act-decide', optional: true, title: 'ผ่าน / ไม่ผ่าน', text: 'เลือกผลการพิจารณา — <b>ไม่ผ่านต้องระบุเหตุผล</b><br>ผู้ส่งได้รับอีเมลทันที และแก้ไขส่งใหม่ได้' },
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
      return [
        p && { route: P(p), target: '.ph-prog .btn-primary', do: 'click', title: 'ส่งเรื่องขออนุมัติ / แจ้งปัญหา', text: 'ปุ่มหลักของคุณ<br><b>ลองกดเพื่อเปิดแบบฟอร์ม</b> <small>(บทเรียนนี้ยังไม่ส่งเรื่องจริง)</small>', note: 'ปุ่มส่งเรื่องแสดงเมื่อคุณมีสิทธิ์ส่งเรื่องในโครงการนั้น' },
        p && { route: P(p, 'subs/new'), target: ['#nf', '#tab'], title: 'กรอกเรื่อง', text: 'เลือกหมวด (วัสดุ แบบ แผนงาน แจ้งปัญหา ส่งมอบงาน ฯลฯ) ใส่ชื่อเรื่อง รายละเอียด แนบไฟล์ แล้วกด <b>ส่งเรื่อง</b><br>ผู้ควบคุมงานได้รับอีเมลทันที และเห็นว่าต้องพิจารณาภายในกี่วัน' },
        p && { route: P(p, 'subs'), target: ['.sub-kpis', '#s-list', '#tab'], title: 'ติดตามผล', text: 'ดูว่าเรื่องอยู่ขั้นไหน ใครกำลังพิจารณา ค้างกี่วัน และผลผ่าน/ไม่ผ่าน — คุณได้รับอีเมลเมื่อมีผล' },
        p && { route: P(p, 'subs/required'), target: ['.req-table', '#tab .panel', '#tab'], title: 'เอกสารที่ต้องส่งตามสัญญา', text: 'รายการเอกสารพร้อมวันครบกำหนด สีแดงคือเลยกำหนด<br>กด <b>ส่งเอกสารนี้</b> ในแต่ละแถวเพื่อส่งเป็นเรื่องขออนุมัติ' },
        { target: nav('inbox'), title: 'เรื่องที่ถูกตีกลับ', text: 'เรื่องที่ไม่ผ่านจะอยู่ใน <b>งานของฉัน</b> พร้อมเหตุผล — เปิดเรื่องแล้วกด “แก้ไขและส่งใหม่”' },
        p && { route: P(p, 'chat'), target: ['#tab .room', '#tab .panel', '#tab'], title: 'สนทนาในโครงการ', text: 'สอบถามผู้ควบคุมงานในห้องโครงการ และดูนัดประชุมที่คุณได้รับเชิญ' },
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
      return [
        { route: '#/inbox', target: ['#view .inbox-sec', '#view .panel'], title: 'เรื่องรอคุณพิจารณา', text: 'เรื่องจะมาถึงคุณเมื่อผ่านผู้ควบคุมงานและกรรมการลำดับก่อนหน้าแล้ว — ระบบส่งอีเมลแจ้งทุกครั้ง' },
        p && { route: P(p, 'members'), target: ['.seat-flow', panel('สมาชิกโครงการ')], title: 'ลำดับกรรมการ', text: 'กรรมการลำดับที่ 1 → 2 → 3 … → <b>ประธานกรรมการ</b> (พิจารณาเป็นคนสุดท้าย) — เจ้าของโครงการเป็นผู้กำหนดลำดับ' },
        p && { target: tab('subs'), do: 'click', title: 'เรื่องขออนุมัติ', text: '<b>ลองกดแท็บ “เรื่องขออนุมัติ”</b>' },
        p && { route: P(p, 'subs'), target: ['#s-list .subrow:has(.chip-me) a', '#s-list .subrow:has(.vote-tag) a', '#s-list .subrow a'], do: 'click', optional: true, title: 'เปิดเรื่อง', text: 'ป้าย “รอคุณพิจารณา” = ถึงลำดับของคุณแล้ว · ป้าย “กำลังโหวต” = รอคณะกรรมการเลือกรูปแบบ/สี<br><b>ลองกดเปิดเรื่องนี้</b>' },
        p && { target: '.stepper', optional: true, title: 'ขั้นตอนการพิจารณา', text: 'เห็นผลและความเห็นของผู้ควบคุมงานและกรรมการลำดับก่อนหน้า' },
        p && { target: ['#vote', '.vote-cta', '#act-decide'], title: 'โหวต หรือ ผ่าน/ไม่ผ่าน', text: 'ถ้าเรื่องเปิดโหวตรูปแบบ/สี ให้เลือกตัวเลือก — เสียงข้างมากชนะ คะแนนเท่ากันประธานชี้ขาด<br>ไม่ผ่านต้องระบุเหตุผลเสมอ', note: 'เมื่อถึงลำดับของคุณ ส่วน “พิจารณาเรื่องนี้” หรือ “โหวต” จะแสดงในหน้าเรื่อง' },
        p && { target: '[data-act="f01"]', optional: true, title: 'พิมพ์ใบขออนุมัติ', text: 'พิมพ์แบบ PT-F01 พร้อมผลการพิจารณาทุกขั้นเพื่อลงนาม' },
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
  const order = ['basics', 'contractor', 'supervisor', 'committee', 'owner', 'head', 'admin'];
  return order.map(lessonById).filter((l) => l.who(c));
}

/** ขั้นตอนที่ใช้ได้ (ตัดขั้นที่ไม่มีโครงการรองรับ) */
export function stepsOf(lesson, c = lessonCtx()) {
  const all = lesson.steps(c);
  const steps = all.filter(Boolean);
  if (steps.length < all.length && lesson.id !== 'basics') {
    steps.push({ title: 'ยังไม่มีโครงการสำหรับบทนี้', text: `ส่วนที่เหลือของบทเรียนต้องมีโครงการที่คุณเป็น${esc(lesson.role)} — เมื่อเจ้าของโครงการเพิ่มอีเมลของคุณ เปิดบทนี้อีกครั้งได้จากปุ่มไกด์` });
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
