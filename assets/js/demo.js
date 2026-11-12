// ข้อมูลตัวอย่างสำหรับทดลองใช้ (สร้างตามวันที่ปัจจุบันทุกครั้ง)
import { addDays, todayISO, diffDays } from './calc.js';
import { uid } from './ui.js';

// [หมวด, รายการ, หน่วย, ปริมาณ, ค่าวัสดุ/หน่วย, ค่าแรง/หน่วย, ช่วงเริ่ม, ช่วงจบ (สัดส่วนของระยะเวลา)]
const BUILDING = [
  ['งานเตรียมการและงานดิน', 'ปรับพื้นที่และวางผัง', 'ตร.ม.', 620, 0, 25, 0, 0.06],
  ['งานเตรียมการและงานดิน', 'ขุดดินฐานราก', 'ลบ.ม.', 180, 0, 120, 0.04, 0.12],
  ['งานเตรียมการและงานดิน', 'ทรายหยาบรองพื้นบดอัดแน่น', 'ลบ.ม.', 45, 450, 80, 0.08, 0.15],
  ['งานโครงสร้าง', 'เสาเข็มคอนกรีตอัดแรง I-0.22×0.22×12.00 ม.', 'ต้น', 64, 2650, 350, 0.05, 0.15],
  ['งานโครงสร้าง', "คอนกรีตโครงสร้าง fc' 240 ksc", 'ลบ.ม.', 160, 2450, 420, 0.12, 0.55],
  ['งานโครงสร้าง', 'เหล็กเสริม SD40 / SR24', 'กก.', 14500, 26.5, 4, 0.12, 0.55],
  ['งานโครงสร้าง', 'ไม้แบบหล่อคอนกรีต', 'ตร.ม.', 980, 240, 160, 0.12, 0.55],
  ['งานโครงสร้าง', 'โครงหลังคาเหล็กรูปพรรณ', 'กก.', 4200, 38, 9, 0.5, 0.65],
  ['งานสถาปัตยกรรม', 'ผนังก่ออิฐมวลเบา หนา 7.5 ซม.', 'ตร.ม.', 720, 260, 110, 0.55, 0.75],
  ['งานสถาปัตยกรรม', 'ฉาบปูนเรียบ', 'ตร.ม.', 1440, 85, 95, 0.6, 0.82],
  ['งานสถาปัตยกรรม', 'หลังคาเมทัลชีทพร้อมฉนวน', 'ตร.ม.', 520, 380, 90, 0.62, 0.75],
  ['งานสถาปัตยกรรม', 'ปูกระเบื้องแกรนิตโต้ 60×60 ซม.', 'ตร.ม.', 560, 520, 160, 0.75, 0.9],
  ['งานสถาปัตยกรรม', 'ประตู-หน้าต่างอลูมิเนียมพร้อมกระจก', 'ชุด', 42, 6800, 900, 0.8, 0.95],
  ['งานสถาปัตยกรรม', 'ทาสีภายใน-ภายนอก', 'ตร.ม.', 1440, 55, 45, 0.85, 0.97],
  ['งานระบบไฟฟ้าและสุขาภิบาล', 'ระบบประปาและท่อน้ำทิ้ง', 'จุด', 36, 900, 450, 0.5, 0.85],
  ['งานระบบไฟฟ้าและสุขาภิบาล', 'เดินสายไฟฟ้าแสงสว่างและเต้ารับ', 'จุด', 140, 650, 350, 0.55, 0.9],
  ['งานระบบไฟฟ้าและสุขาภิบาล', 'สุขภัณฑ์พร้อมอุปกรณ์', 'ชุด', 12, 4800, 1200, 0.85, 0.97],
];

const ROAD = [
  ['งานรื้อถอนและเตรียมพื้นที่', 'ไสผิวทางแอสฟัลต์เดิม หนา 5 ซม.', 'ตร.ม.', 8400, 0, 38, 0, 0.25],
  ['งานรื้อถอนและเตรียมพื้นที่', 'ปรับระดับและบดอัดชั้นพื้นทาง', 'ตร.ม.', 8400, 0, 22, 0.15, 0.4],
  ['งานระบายน้ำ', 'รางระบายน้ำ คสล. กว้าง 0.40 ม. พร้อมฝาตะแกรง', 'ม.', 640, 1150, 350, 0.2, 0.7],
  ['งานระบายน้ำ', 'ท่อลอดเหลี่ยม คสล. 1.20×1.20 ม.', 'ม.', 24, 9800, 2200, 0.35, 0.6],
  ['งานผิวทาง', 'Prime Coat', 'ตร.ม.', 8400, 28, 6, 0.3, 0.55],
  ['งานผิวทาง', 'แอสฟัลต์คอนกรีต หนา 5 ซม.', 'ตร.ม.', 8400, 245, 30, 0.4, 0.8],
  ['งานเครื่องหมายจราจร', 'ตีเส้นจราจรด้วยสีเทอร์โมพลาสติก', 'ตร.ม.', 620, 180, 40, 0.8, 0.95],
  ['งานเครื่องหมายจราจร', 'ป้ายจราจรพร้อมเสา', 'ป้าย', 18, 3500, 500, 0.85, 0.98],
];

const FOUNDATION = [
  ['งานดิน', 'ขุดดินฐานราก', 'ลบ.ม.', 420, 0, 120, 0, 0.15],
  ['งานเสาเข็ม', 'เสาเข็มเจาะ Ø 0.50 ม.', 'ม.', 960, 1650, 450, 0.05, 0.35],
  ['งานเสาเข็ม', 'ทดสอบความสมบูรณ์เสาเข็ม (Seismic Test)', 'ต้น', 48, 0, 1500, 0.3, 0.4],
  ['งานฐานราก', "คอนกรีตฐานราก fc' 280 ksc", 'ลบ.ม.', 310, 2650, 420, 0.3, 0.75],
  ['งานฐานราก', 'เหล็กเสริม SD40', 'กก.', 27500, 26.5, 4, 0.3, 0.75],
  ['งานฐานราก', 'Anchor Bolt พร้อมแผ่นเหล็ก', 'ชุด', 96, 1850, 300, 0.55, 0.85],
  ['งานดิน', 'ถมดินกลับและบดอัด', 'ลบ.ม.', 260, 180, 90, 0.35, 0.6],
  ['งานรางเคเบิลและงานปิดท้าย', 'Cable Trench คสล.', 'ม.', 380, 2200, 650, 0.6, 0.95],
  ['งานรางเคเบิลและงานปิดท้าย', 'โรยหินเกล็ดลานไกไฟฟ้า หนา 10 ซม.', 'ลบ.ม.', 520, 650, 90, 0.85, 1],
];

const CARPORT = [
  ['งานโครงสร้าง', "คอนกรีตโครงสร้าง fc' 240 ksc", 'ลบ.ม.', 48, 2450, 420, 0, 0.5],
  ['งานโครงสร้าง', 'เหล็กเสริม SD40', 'กก.', 4300, 26.5, 4, 0, 0.5],
  ['งานหลังคา', 'โครงหลังคาเหล็กและเมทัลชีท', 'ตร.ม.', 760, 640, 140, 0.4, 0.8],
  ['งานพื้น', 'พื้นคอนกรีตเสริมเหล็กหนา 15 ซม.', 'ตร.ม.', 820, 520, 120, 0.6, 1],
];

const ISSUES = [
  'ฝนตกหนัก 2 วัน ต้องหยุดงานคอนกรีต',
  'รอผลทดสอบกำลังอัดคอนกรีตจากห้องปฏิบัติการ',
  'แรงงานไม่เพียงพอ ผู้รับจ้างแจ้งจะเพิ่มคนงานสัปดาห์หน้า',
  'วัสดุเหล็กเสริมส่งล่าช้า 3 วัน',
  'รอการอนุมัติแบบขยายรายละเอียดจากผู้ออกแบบ',
];

const R = globalThis.PTRules;

function makeProject(spec, settings, today) {
  const pid = uid('P');
  const start = addDays(today, spec.startOff);
  const end = addDays(start, spec.dur);
  const items = spec.items.map((r, i) => ({
    id: `${pid}-B${i + 1}`, projectId: pid, group: r[0], no: '', desc: r[1], unit: r[2],
    qty: r[3], mat: r[4], labor: r[5], weight: '', order: i + 1, _a: r[6], _b: r[7],
  }));
  // ใส่ลำดับแบบ 1.1, 1.2, 2.1 …
  const groups = [...new Set(items.map((i) => i.group))];
  const cnt = {};
  for (const it of items) {
    const g = groups.indexOf(it.group) + 1;
    cnt[g] = (cnt[g] || 0) + 1;
    it.no = `${g}.${cnt[g]}`;
  }
  const direct = items.reduce((s, i) => s + i.qty * (i.mat + i.labor), 0);
  const p = {
    id: pid, code: spec.code, name: spec.name, type: spec.type, tags: [], status: spec.status || 'active',
    owner: spec.owner || 'แผนกโยธา', manager: spec.manager, contractor: spec.contractor,
    contractNo: spec.contractNo, location: spec.location,
    startDate: start, endDate: end,
    contractValue: Math.round((direct * 1.2) / 1000) * 1000,
    description: spec.description || '',
    progressMethod: 'boq_value', priceBasis: 'total', allowOver: false,
    planMode: 'scurve', planPoints: [],
    docCategories: [...settings.docCategories], folderId: '', folderUrl: '',
    createdBy: 'ข้อมูลตัวอย่าง', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };

  const updates = [];
  const elapsed = diffDays(start, today);
  const prev = {};
  let seed = spec.code.length * 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let w = 1; w * 7 <= elapsed; w++) {
    const date = addDays(start, w * 7);
    const t = Math.min(1, ((w * 7) / spec.dur) * spec.speed);
    const entries = {};
    const worked = [];
    for (const it of items) {
      const frac = Math.min(1, Math.max(0, (t - it._a) / (it._b - it._a)));
      const big = it.qty >= 100;
      const cum = big ? Math.round(it.qty * frac) : Math.round(it.qty * frac * 100) / 100;
      const d = Math.round((cum - (prev[it.id] || 0)) * 100) / 100;
      if (d > 0) { entries[it.id] = d; prev[it.id] = cum; worked.push([it.desc, d * (it.mat + it.labor)]); }
    }
    worked.sort((a, b) => b[1] - a[1]);
    updates.push({
      id: uid('U'), projectId: pid, date, week: w, entries, manualPct: '',
      note: worked.length ? `งานที่ดำเนินการ: ${worked.slice(0, 2).map((x) => x[0]).join(' และ ')}` : 'เตรียมพื้นที่และระดมเครื่องจักร',
      issues: spec.speed < 0.95 && rand() < 0.35 ? ISSUES[Math.floor(rand() * ISSUES.length)] : '',
      createdBy: spec.manager, createdAt: `${date}T02:00:00.000Z`, updatedAt: `${date}T02:00:00.000Z`,
    });
  }
  // แผนงานรายรายการ: วันที่เริ่ม–จบของสัญญา (วันที่ 1 = วันเริ่มสัญญา)
  const days = spec.dur + 1;
  items.forEach((i) => {
    i.ps = Math.max(1, Math.round(i._a * days) + 1);
    i.pe = Math.max(i.ps, Math.min(days, Math.round(i._b * days)));
    delete i._a; delete i._b;
  });
  return { project: p, items, updates };
}

/** me = { email, name } ผู้ใช้ปัจจุบัน (เป็นเจ้าของโครงการตัวอย่าง) */
export function buildDemo(settings, me = { email: '', name: '' }) {
  const today = todayISO();
  const specs = [
    {
      code: 'CN-69-014', name: 'ก่อสร้างอาคารสำนักงานควบคุมงาน 2 ชั้น', type: 'อาคาร',
      contractor: 'หจก. ตัวอย่างการโยธา', contractNo: 'สญ.014/2569', location: 'โรงไฟฟ้าตัวอย่าง พื้นที่ A',
      manager: 'นายช่างสมชาย', startOff: -140, dur: 250, speed: 0.93, items: BUILDING,
      description: 'อาคาร คสล. 2 ชั้น พื้นที่ใช้สอย 620 ตร.ม. พร้อมระบบไฟฟ้าและสุขาภิบาล',
    },
    {
      code: 'CN-69-021', name: 'ปรับปรุงผิวถนนแอสฟัลต์ภายในโรงไฟฟ้า ระยะทาง 1.2 กม.', type: 'ถนน/ลานจอด',
      contractor: 'บจก. ถนนดีก่อสร้าง (ตัวอย่าง)', contractNo: 'สญ.021/2569', location: 'ถนนสายหลักภายในโรงไฟฟ้า',
      manager: 'นายช่างวิไล', startOff: -70, dur: 120, speed: 1.07, items: ROAD,
    },
    {
      code: 'CN-69-008', name: 'ก่อสร้างฐานรากอุปกรณ์ลานไกไฟฟ้า 230 kV', type: 'งานโครงสร้างพิเศษ',
      contractor: 'บจก. ฐานรากมั่นคง (ตัวอย่าง)', contractNo: 'สญ.008/2569', location: 'ลานไกไฟฟ้า 230 kV',
      manager: 'นายช่างสมชาย', startOff: -168, dur: 200, speed: 0.8, items: FOUNDATION,
    },
    {
      code: 'CN-69-030', name: 'ก่อสร้างโรงจอดรถยนต์ คสล. 40 คัน', type: 'อาคาร', status: 'planning',
      contractor: 'อยู่ระหว่างจัดจ้าง', contractNo: '', location: 'ลานจอดรถด้านทิศเหนือ',
      manager: 'นายช่างวิไล', startOff: 21, dur: 150, speed: 1, items: CARPORT,
    },
  ];
  const out = { projects: [], boq: [], updates: [], subs: [], reqs: [], msgs: [], meetings: [], daily: [], library: [] };
  for (const s of specs) {
    const r = makeProject(s, settings, today);
    out.projects.push(r.project);
    out.boq.push(...r.items);
    out.updates.push(...r.updates);
  }
  if (R) addTeam(out, me, today);
  return out;
}

// ---------- สมาชิก เรื่องขออนุมัติ และเอกสารที่ต้องส่ง (ตัวอย่าง) ----------
const TEAM = {
  supervisor: { email: 'wilai@egat.co.th', name: 'นายช่างวิไล (ผู้ควบคุมงาน)' },
  committee: { email: 'prathan@egat.co.th', name: 'นายประธาน (ประธานกรรมการตรวจรับ)' },
  committee1: { email: 'kammakarn1@egat.co.th', name: 'นายกรรมการ หนึ่ง' },
  committee2: { email: 'kammakarn2@egat.co.th', name: 'นางสาวกรรมการ สอง' },
  head: { email: 'head.civil@egat.co.th', name: 'หัวหน้าแผนกโยธา' },
};
const CONTRACTORS = ['mana@example-civil.co.th', 'road@example-road.co.th', 'pile@example-pile.co.th', 'bid@example.co.th'];

function addTeam(out, me, today) {
  const at = (daysAgo, hour = 9) => {
    const d = new Date(`${today}T00:00:00+07:00`);
    d.setTime(d.getTime() - daysAgo * 864e5 + (hour - 0) * 3600e3);
    return d.toISOString();
  };
  out.projects.forEach((p, i) => {
    p.ownerEmail = me.email;
    p.ownerName = me.name;
    p.ownerRole = 'supervisor';
    p.members = [
      { email: CONTRACTORS[i], name: `ผู้แทน ${p.contractor}`, role: 'contractor', notify: 'mine' },
      { ...TEAM.supervisor, role: 'supervisor', notify: 'all' },
      { ...TEAM.committee, role: 'committee', notify: 'mine', seat: 0 },
      { ...TEAM.committee1, role: 'committee', notify: 'mine', seat: 1 },
      { ...TEAM.committee2, role: 'committee', notify: 'mine', seat: 2 },
      { ...TEAM.head, role: 'head', notify: 'decisions' },
    ];
  });
  out.projects[0].planMode = 'boq';

  // โครงการที่ 1: เรื่องหลายสถานะ
  const p = out.projects[0];
  const con = { email: CONTRACTORS[0], name: `ผู้แทน ${p.contractor}` };
  const ownerU = { email: me.email, name: me.name };
  const sup = { email: TEAM.supervisor.email, name: TEAM.supervisor.name };
  const com = { email: TEAM.committee.email, name: TEAM.committee.name };
  const c1 = { email: TEAM.committee1.email, name: TEAM.committee1.name };
  const c2 = { email: TEAM.committee2.email, name: TEAM.committee2.name };
  // คณะกรรมการพิจารณาเรียงลำดับ: กรรมการลำดับ 1 → 2 → ประธาน
  const committeeOk = (sub, when, comment = 'เห็นชอบ') => {
    let x = act(sub, c1, 'approve', comment, when);
    x = act(x, c2, 'approve', comment, when);
    return act(x, com, 'approve', comment, when);
  };
  const reqs = R.REQUIRED_TEMPLATE.map((t, k) => ({ ...t, id: `${p.id}-Q${k + 1}`, projectId: p.id, dueDate: '', note: '', order: k + 1 }));
  out.reqs.push(...reqs);
  const subs = [];
  const make = (input, actor, when) => {
    const r = R.createSubmission(p, { id: uid('S'), ...input }, actor, when, subs);
    subs.push(r.sub);
    return r.sub;
  };
  const act = (sub, actor, action, comment, when) => {
    const r = R.act(sub, p, actor, action, { comment, changes: { comment } }, when);
    subs[subs.indexOf(sub)] = r.sub;
    return r.sub;
  };
  const started = diffDays(p.startDate, today); // วันที่ผ่านไปตั้งแต่เริ่มสัญญา
  let s;
  s = make({ category: 'ขออนุมัติแผนงาน/วิธีการทำงาน', title: 'ส่งแผนการทำงาน (Work Schedule) ฉบับแรก', detail: 'แผนการทำงานรายสัปดาห์ตลอดสัญญา 250 วัน', requiredId: reqs[0].id }, con, at(started - 17, 10));
  s = act(s, sup, 'approve', 'แผนงานสอดคล้องกับ BOQ เห็นควรอนุมัติ', at(started - 20, 15));
  committeeOk(s, at(started - 19, 11));
  s = make({ category: 'อื่นๆ', title: 'รายชื่อวิศวกรควบคุมงานของผู้รับจ้าง พร้อมใบ กว.', requiredId: reqs[1].id }, con, at(started - 5, 11));
  act(s, ownerU, 'approve', 'ตรวจสอบใบอนุญาตแล้ว', at(started - 6, 9));
  s = make({ category: 'ขออนุมัติวัสดุ/อุปกรณ์', title: 'ขออนุมัติใช้เหล็กเส้น SD40 ยี่ห้อตัวอย่าง', detail: 'แนบใบรับรอง มอก. 24-2559 และผลทดสอบแรงดึง', requiredId: reqs[4].id }, con, at(60, 10));
  s = act(s, sup, 'reject', 'ใบรับรอง มอก. หมดอายุ กรุณาแนบฉบับปัจจุบัน', at(57, 14));
  s = act(s, con, 'resubmit', 'แนบใบรับรอง มอก. ฉบับปี 2569 แล้ว', at(55, 9));
  s = act(s, sup, 'approve', 'เอกสารครบถ้วน เสนอคณะกรรมการ', at(54, 16));
  committeeOk(s, at(52, 10));
  make({ category: 'ขออนุมัติแบบ (Shop Drawing)', title: 'Shop Drawing โครงหลังคาเหล็กรูปพรรณ', detail: 'แบบขยายรายละเอียดโครงหลังคา จุดต่อ และแผ่นเหล็กฐาน รวม 12 แผ่น', requiredId: reqs[3].id }, con, at(9, 13));
  make({ category: 'แจ้งปัญหา/อุปสรรค', title: 'น้ำท่วมขังบริเวณฐานราก F12–F16 หลังฝนตกหนัก', detail: 'ขอให้พิจารณาแนวทางสูบน้ำและเลื่อนการเทคอนกรีตออกไป 3 วัน' }, con, at(16, 8));
  s = make({ category: 'ขอขยายเวลา/เปลี่ยนแปลงงาน', title: 'ขอขยายระยะเวลาก่อสร้าง 15 วัน เนื่องจากฝนตก', detail: 'ฝนตกต่อเนื่อง 11 วันในเดือนที่ผ่านมา ตามบันทึกปริมาณน้ำฝนที่แนบ' }, con, at(12, 10));
  act(s, ownerU, 'reject', 'ข้อมูลปริมาณน้ำฝนไม่ได้รับรองจากหน่วยงานราชการ กรุณาแนบเอกสารรับรองจากกรมอุตุนิยมวิทยา', at(5, 15));
  s = make({ category: 'ส่งมอบงาน/ขอตรวจรับงวดงาน', title: 'ขอส่งมอบงานงวดที่ 2 (งานโครงสร้างชั้นที่ 1)', detail: 'งานแล้วเสร็จตามสัญญางวดที่ 2 พร้อมผลทดสอบกำลังอัดคอนกรีต' }, con, at(6, 9));
  act(s, sup, 'approve', 'ตรวจสอบหน้างานแล้ว ถูกต้องตามแบบ เสนอคณะกรรมการตรวจรับ', at(2, 16));
  s = make({
    category: 'ขออนุมัติวัสดุ/อุปกรณ์', title: 'ขออนุมัติกระเบื้องแกรนิตโต้ 60×60 ซม. ห้องโถง', detail: 'แบบระบุเพียง "แกรนิตโต้ 60×60 ซม." ไม่ได้ระบุสีและลาย — เสนอ 3 แบบให้คณะกรรมการเลือก',
    vote: {
      question: 'เลือกสี/ลายกระเบื้องแกรนิตโต้ห้องโถง (แบบไม่ได้ระบุ)',
      options: [
        { label: 'เทาอ่อน ลายหินอ่อน', detail: 'ยี่ห้อ ก รุ่น GT-6021 ผิวด้าน' },
        { label: 'ครีม เรียบ', detail: 'ยี่ห้อ ข รุ่น CR-600 ผิวกึ่งเงา' },
        { label: 'เทาเข้ม ลายเสี้ยน', detail: 'ยี่ห้อ ก รุ่น DG-6040 ผิวด้าน กันลื่น R10' },
      ],
    },
  }, con, at(3, 14));
  s = act(s, sup, 'approve', 'คุณสมบัติตามข้อกำหนด เสนอคณะกรรมการเลือกสี', at(2, 10));
  const vote = (x, who, option, comment, when) => {
    const r = R.act(x, p, who, 'vote', { option, comment }, when);
    subs[subs.indexOf(x)] = r.sub;
    return r.sub;
  };
  s = vote(s, c1, 'o1', 'เข้ากับผนังเดิม', at(1, 9));
  vote(s, c2, 'o3', 'ดูแลรักษาง่าย กันลื่น', at(1, 11));
  out.subs.push(...subs);

  // โครงการที่ 3: เรื่องรอคณะกรรมการ
  const p3 = out.projects[2];
  const con3 = { email: CONTRACTORS[2], name: `ผู้แทน ${p3.contractor}` };
  const subs3 = [];
  let t = R.createSubmission(p3, { id: uid('S'), category: 'ขออนุมัติวัสดุ/อุปกรณ์', title: 'ขออนุมัติ Anchor Bolt ASTM F1554 Grade 36' }, con3, at(20, 10), subs3).sub;
  subs3.push(t);
  t = R.createSubmission(p3, { id: uid('S'), category: 'แจ้งปัญหา/อุปสรรค', title: 'พบชั้นหินแข็งที่ความลึก 8 ม. เจาะเสาเข็มไม่ได้ตามแบบ' }, con3, at(4, 15), subs3).sub;
  subs3.push(t);
  out.subs.push(...subs3);

  // ห้องสนทนาและการประชุม (1.0.4)
  out.settings = { deptMembers: [me.email, TEAM.supervisor.email, 'kittipong@egat.co.th'].join(', ') };
  const sup3 = { email: TEAM.supervisor.email, name: TEAM.supervisor.name };
  const say = (who, channel, pid, text, when, refId = '') => out.msgs.push({
    id: uid('M'), projectId: pid, channel, refId, by: who.email, byName: who.name, at: when, text, files: [], deleted: false, editedAt: '',
  });
  const kit = { email: 'kittipong@egat.co.th', name: 'นายช่างกิตติพงษ์ (โครงการลานไกไฟฟ้า)' };
  say(kit, 'dept', '', 'แจ้งทุกโครงการ: สัปดาห์หน้ามีตรวจความปลอดภัยหน้างานจากฝ่ายความปลอดภัย กรุณาเตรียมเอกสาร JSA ให้พร้อมครับ', at(2, 9));
  say(ownerU, 'dept', '', 'รับทราบครับ โครงการอาคารควบคุมงานเตรียมไว้แล้ว', at(2, 10));
  say(sup3, 'dept', '', 'ใครมีแบบฟอร์มรายงานประจำวันฉบับล่าสุดของแผนก ขอหน่อยค่ะ https://example.com/daily-report-form', at(1, 14));
  say(con, 'project', p.id, 'แจ้งเข้าทำงานเทคอนกรีตพื้นชั้น 2 วันพฤหัสนี้ เริ่ม 07:00 น. ครับ', at(3, 16));
  say(sup, 'project', p.id, 'รับทราบ ขอผลทดสอบ Slump และคิวบ์ตัวอย่างตามข้อกำหนดด้วยค่ะ', at(3, 17));
  say(ownerU, 'internal', p.id, 'ผู้รับจ้างตามหลังแผน 4.6% — ประชุมเร่งรัดสัปดาห์หน้าดีไหมครับ', at(1, 9));
  say(sup, 'internal', p.id, 'เห็นด้วยค่ะ จะเตรียมสรุปปัญหาไปให้', at(1, 10));
  const day = (n, hm) => { const d = new Date(`${today}T00:00:00+07:00`); d.setDate(d.getDate() + n); return `${new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10)}T${hm}`; };
  const meet = (o) => { const m = { status: 'scheduled', minutes: '', actions: [], place: '', link: '', durationMin: 60, createdAt: at(1, 11), updatedAt: at(1, 11), updatedBy: o.createdBy, updatedByName: o.createdByName, ...o }; out.meetings.push(m); return m; };
  meet({ id: uid('G'), projectId: p.id, audience: 'project', title: 'ประชุมเร่งรัดงานและติดตามความก้าวหน้า ครั้งที่ 8', startAt: day(3, '09:30'), durationMin: 90,
    place: 'ห้องประชุมหน้างาน', link: 'https://teams.microsoft.com/l/meetup-join/example', attendees: [me.email, TEAM.supervisor.email, CONTRACTORS[0], TEAM.committee.email],
    agenda: '1. ความก้าวหน้าเทียบแผน (ตามหลัง 4.6%)\n2. แผนเร่งรัดงานโครงสร้าง\n3. การอนุมัติวัสดุที่ค้าง', createdBy: me.email, createdByName: me.name });
  meet({ id: uid('G'), projectId: p.id, audience: 'project', title: 'ประชุมติดตามความก้าวหน้า ครั้งที่ 7', startAt: day(-11, '09:30'), status: 'done', attendees: [me.email, TEAM.supervisor.email, CONTRACTORS[0]],
    agenda: '1. ความก้าวหน้า\n2. ปัญหาน้ำท่วมขังบริเวณฐานราก', minutes: 'ที่ประชุมรับทราบความก้าวหน้า 38%\nมติ: ผู้รับจ้างจัดหาเครื่องสูบน้ำเพิ่ม 2 ชุด และส่งแผนงานปรับปรุง',
    actions: [{ id: 'A1-demo', text: 'จัดหาเครื่องสูบน้ำเพิ่ม 2 ชุด', owner: CONTRACTORS[0], due: day(-8, '00:00').slice(0, 10), done: true, doneAt: at(9, 10) },
      { id: 'A2-demo', text: 'ส่งแผนงานปรับปรุง (Recovery plan)', owner: CONTRACTORS[0], due: day(2, '00:00').slice(0, 10), done: false, doneAt: '' }],
    createdBy: TEAM.supervisor.email, createdByName: TEAM.supervisor.name, createdAt: at(14, 9) });
  // รายงานประจำวัน (1.0.5): 12 วันล่าสุดของโครงการที่ 1 (เว้นวันอาทิตย์ และวันที่ลืมบันทึก)
  const WORKS = ['ผูกเหล็กเสาชั้น 2 แนว A–C', 'ตั้งแบบหล่อคานชั้น 2 แนว 1–4', 'เทคอนกรีตเสาชั้น 2 จำนวน 12 ต้น (6 ลบ.ม.)', 'ก่ออิฐผนังชั้น 1 ด้านทิศเหนือ', 'ติดตั้งท่อร้อยสายไฟฟ้าชั้น 1',
    'ถอดแบบหล่อคานชั้น 1 และบ่มคอนกรีต', 'ผูกเหล็กพื้นชั้น 2 โซน B', 'เตรียมเทคอนกรีตพื้นชั้น 2 ตรวจระดับแบบหล่อ'];
  for (let i = 0, n = 0; i <= 12; i++) {
    const date = addDays(today, -i);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (dow === 0 || i === 4 || (i === 0 && new Date().getHours() < 12)) continue;
    const k = n; // ลำดับรายงานที่บันทึก (วันที่ 4–5 ที่บันทึกย้อนหลังมีฝน วันที่ 4 หยุดงาน)
    const rain = k === 4 || k === 5;
    const stop = k === 4;
    out.daily.push({
      id: uid('D'), projectId: p.id, date,
      weather: { am: rain ? 'cloudy' : 'clear', pm: rain ? (stop ? 'heavy' : 'rain') : (i % 3 ? 'clear' : 'cloudy') }, workHours: '08:00–17:00',
      manpower: [{ trade: 'โฟร์แมน', count: 1 }, { trade: 'ช่างเหล็ก', count: 6 + (i % 3) }, { trade: 'ช่างไม้', count: 5 }, { trade: 'กรรมกร', count: rain ? 6 : 10 + (i % 4) }],
      equipment: [{ name: 'รถเครน', count: i % 2 }, { name: 'เครื่องปั่นไฟ', count: 1 }].filter((x) => x.count),
      work: WORKS[n++ % WORKS.length], materials: i === 2 ? 'เหล็กข้ออ้อย DB16 จำนวน 2.5 ตัน (ตรวจใบ มอก. แล้ว)' : '',
      stoppage: { stopped: stop, hours: stop ? 4 : 0, reason: stop ? 'ฝนตกหนักช่วงบ่าย หยุดงานเทคอนกรีต' : '' },
      safety: i === 3 ? 'พบคนงานไม่สวมเข็มขัดนิรภัยบนนั่งร้านชั้น 2 — ตักเตือนแล้ว' : '', instructions: i === 3 ? 'ให้ผู้รับจ้างจัดอบรมความปลอดภัยการทำงานบนที่สูงภายในสัปดาห์นี้' : '',
      files: [], createdBy: TEAM.supervisor.name, createdByEmail: TEAM.supervisor.email, createdAt: at(i, 17), updatedAt: at(i, 17),
    });
  }
  // คลังแบบฟอร์มและระเบียบ (ตัวอย่าง — ลิงก์สมมุติ)
  const lib = (o, k) => ({ id: `L-demo-${k}`, kind: 'form', workType: '', category: '', uses: ['all'], version: '', effective: '', note: '', url: '', file: null, active: true, order: k, audience: 'all', updatedBy: me.name, updatedAt: at(30, 10), createdAt: at(30, 10), ...o });
  out.library.push(
    lib({ title: 'แบบฟอร์มขออนุมัติวัสดุ/อุปกรณ์ (ฉบับหน่วยงาน — ตัวอย่าง)', uses: ['sub'], category: 'ขออนุมัติวัสดุ/อุปกรณ์', url: 'https://example.com/forms/material-approval.docx', version: 'Rev.3', note: 'แนบใบ มอก./ผลทดสอบทุกครั้ง' }, 1),
    lib({ title: 'แบบฟอร์มขออนุมัติแบบขยายรายละเอียด (Shop Drawing — ตัวอย่าง)', uses: ['sub'], category: 'ขออนุมัติแบบ (Shop Drawing)', url: 'https://example.com/forms/shop-drawing.docx', version: 'Rev.2' }, 2),
    lib({ title: 'ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560', kind: 'regulation', uses: ['daily', 'weekly', 'handover'], url: 'https://www.gprocurement.go.th/', note: 'ข้อ 176 การตรวจรับงานจ้างก่อสร้าง · ข้อ 178 หน้าที่ผู้ควบคุมงาน (บันทึกรายวัน รายงานคณะกรรมการทุกสัปดาห์)' }, 3),
    lib({ title: 'มาตรฐานงานคอนกรีตและคอนกรีตเสริมเหล็ก (ตัวอย่าง)', kind: 'standard', workType: 'อาคาร', uses: ['sub', 'daily'], url: 'https://eit.or.th/' }, 4),
    lib({ title: 'รายการตรวจสอบก่อนเทคอนกรีต (Pour checklist)', kind: 'checklist', uses: ['daily'], url: 'https://example.com/forms/pour-checklist.xlsx', audience: 'internal' }, 5),
    lib({ title: 'คู่มือความปลอดภัยในงานก่อสร้าง และแบบ JSA', kind: 'manual', uses: ['meeting', 'daily'], url: 'https://example.com/safety-manual.pdf' }, 6),
  );
  meet({ id: uid('G'), projectId: '', audience: 'dept', title: 'ประชุมประจำเดือนแผนกโยธา', startAt: day(6, '13:30'), durationMin: 120, place: 'ห้องประชุม 3',
    attendees: [me.email, TEAM.supervisor.email, kit.email], agenda: '1. สรุปสถานะทุกโครงการ\n2. โครงการที่ล่าช้า\n3. เรื่องอื่นๆ', createdBy: me.email, createdByName: me.name });
}
