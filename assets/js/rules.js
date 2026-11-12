/*
 * กฎกลางของระบบ: บทบาท สิทธิ์ ขั้นตอนอนุมัติ การแจ้งเตือน และรูปแบบอีเมล
 * ไฟล์นี้ใช้ร่วมกัน 2 ที่ (แก้ที่เดียวแล้วคัดลอกให้ตรงกัน):
 *   1) หน้าเว็บ  — โหลดผ่าน <script src="assets/js/rules.js"> ใช้งานผ่าน globalThis.PTRules
 *   2) Apps Script — ส่วนท้ายของ backend/Code.gs (ระหว่างบรรทัด RULES BEGIN / RULES END)
 * เขียนแบบ JavaScript ทั่วไป (ไม่ใช้ import/export) เพื่อให้รันได้ทั้งสองที่
 */
(function (root) {
  'use strict';

  var DAY = 864e5;

  var ROLES = {
    owner: { label: 'เจ้าของโครงการ', desc: 'ผู้สร้างโครงการ ทำได้ทุกอย่าง และเป็นผู้เดียวที่แต่งตั้งหรือถอดถอนสมาชิกได้' },
    supervisor: { label: 'ผู้ควบคุมงาน', desc: 'ตรวจสอบและอนุมัติเอกสารของผู้รับจ้าง บันทึกความคืบหน้า ดูแล BOQ และแผนงาน' },
    committee: { label: 'คณะกรรมการตรวจรับ', desc: 'พิจารณาเรื่องที่ต้องผ่านคณะกรรมการ เช่น การส่งมอบงานงวด' },
    contractor: { label: 'ผู้รับจ้าง', desc: 'ส่งเอกสารขออนุมัติ แจ้งปัญหา และติดตามผลการพิจารณา' },
    head: { label: 'หัวหน้า/ผู้บริหาร', desc: 'ดูข้อมูลได้อย่างเดียว รับอีเมลเมื่อมีผลการพิจารณาหรือมีการอัปเดตความคืบหน้า' },
    viewer: { label: 'ผู้ติดตาม', desc: 'ดูข้อมูลได้อย่างเดียว' },
  };
  var MEMBER_ROLES = ['supervisor', 'committee', 'contractor', 'head', 'viewer'];
  // ลำดับในคณะกรรมการ: 1..n = กรรมการลำดับที่ n, 0 = ประธานกรรมการ (พิจารณาเป็นคนสุดท้าย)
  var MAX_SEAT = 9;
  function seatLabel(seat) {
    if (seat == null || seat === '') return '';
    return +seat === 0 ? 'ประธานกรรมการ' : 'กรรมการลำดับที่ ' + (+seat);
  }
  function seatStepLabel(seat) { var l = seatLabel(seat); return /\d$/.test(l) ? l + ' พิจารณา' : l + 'พิจารณา'; }
  /** ลำดับการพิจารณา: กรรมการลำดับ 1, 2, 3 … แล้วจึงประธานกรรมการ */
  function seatOrder(seat) { return +seat === 0 ? 1000 : +seat; }
  // วิธีพิจารณาในแต่ละขั้น
  var STEP_MODES = {
    any: 'คนใดคนหนึ่งในบทบาทนี้พิจารณาได้',
    seq: 'ทุกคนพิจารณาเรียงตามลำดับ (กรรมการลำดับ 1 → 2 → 3 … → ประธานกรรมการ)',
  };
  // เจ้าของโครงการทำหน้าที่ใดในงาน (ใช้หาผู้พิจารณาแต่ละขั้น)
  var OWNER_ACTS = { supervisor: 'ผู้ควบคุมงาน', committee: 'คณะกรรมการตรวจรับ', head: 'หัวหน้า/ผู้บริหาร', none: 'ไม่ร่วมพิจารณา (พิจารณาแทนได้เมื่อจำเป็น)' };

  var PERMS = {
    editProject: 'แก้ไขข้อมูลและตั้งค่าโครงการ',
    editBoq: 'แก้ไข BOQ และแผนงาน',
    recordProgress: 'บันทึกความคืบหน้า',
    uploadDocs: 'อัปโหลด/จัดการคลังเอกสาร',
    submit: 'ส่งเรื่องขออนุมัติ/แจ้งปัญหา',
    approve: 'พิจารณาอนุมัติ/ตีกลับ',
    manageRequired: 'กำหนดรายการเอกสารที่ต้องส่ง',
  };
  var PERM_KEYS = Object.keys(PERMS);

  var DEFAULT_ROLE_PERMS = {
    supervisor: ['editProject', 'editBoq', 'recordProgress', 'uploadDocs', 'submit', 'approve', 'manageRequired'],
    committee: ['submit', 'approve'],
    contractor: ['submit'],
    head: [],
    viewer: [],
  };

  var NOTIFY = {
    all: 'ทุกเรื่องในโครงการ',
    decisions: 'เฉพาะผลการพิจารณาและการอัปเดตความคืบหน้า',
    mine: 'เฉพาะเรื่องที่ตนส่งหรือต้องพิจารณา',
    none: 'ไม่รับอีเมลแจ้งเพื่อทราบ',
  };
  var DEFAULT_NOTIFY = { owner: 'all', supervisor: 'all', committee: 'mine', contractor: 'mine', head: 'decisions', viewer: 'none' };

  // หมวดเรื่องขออนุมัติ และขั้นตอนพิจารณาเริ่มต้น (ปรับได้ในแต่ละโครงการ)
  var DEFAULT_WORKFLOWS = [
    { name: 'ขออนุมัติวัสดุ/อุปกรณ์', steps: [{ role: 'supervisor', days: 7, mode: 'any' }, { role: 'committee', days: 3, mode: 'seq' }] },
    { name: 'ขออนุมัติแบบ (Shop Drawing)', steps: [{ role: 'supervisor', days: 7, mode: 'any' }, { role: 'committee', days: 3, mode: 'seq' }] },
    { name: 'ขออนุมัติแผนงาน/วิธีการทำงาน', steps: [{ role: 'supervisor', days: 7, mode: 'any' }, { role: 'committee', days: 3, mode: 'seq' }] },
    { name: 'แจ้งปัญหา/อุปสรรค', steps: [{ role: 'supervisor', days: 3, mode: 'any' }] },
    { name: 'ขอขยายเวลา/เปลี่ยนแปลงงาน', steps: [{ role: 'supervisor', days: 7, mode: 'any' }, { role: 'committee', days: 5, mode: 'seq' }] },
    { name: 'ส่งมอบงาน/ขอตรวจรับงวดงาน', steps: [{ role: 'supervisor', days: 3, mode: 'any' }, { role: 'committee', days: 2, mode: 'seq' }] },
    { name: 'อื่นๆ', steps: [{ role: 'supervisor', days: 7, mode: 'any' }] },
  ];

  // รายการเอกสารที่ผู้รับจ้างต้องส่งตามสัญญา (แม่แบบ ปรับแก้ได้)
  var REQUIRED_TEMPLATE = [
    { title: 'แผนการทำงาน (Work Schedule)', category: 'ขออนุมัติแผนงาน/วิธีการทำงาน', dueType: 'afterStart', dueDays: 15 },
    { title: 'รายชื่อวิศวกรและผู้ควบคุมงานของผู้รับจ้าง พร้อมใบอนุญาต', category: 'อื่นๆ', dueType: 'afterStart', dueDays: 7 },
    { title: 'แผนความปลอดภัยในการทำงาน (Safety Plan)', category: 'ขออนุมัติแผนงาน/วิธีการทำงาน', dueType: 'afterStart', dueDays: 15 },
    { title: 'แบบขยายรายละเอียด (Shop Drawing)', category: 'ขออนุมัติแบบ (Shop Drawing)', dueType: 'afterStart', dueDays: 30 },
    { title: 'รายการวัสดุและผลิตภัณฑ์ที่ใช้ (Material Submittal)', category: 'ขออนุมัติวัสดุ/อุปกรณ์', dueType: 'afterStart', dueDays: 30 },
    { title: 'แบบก่อสร้างจริง (As-built Drawing)', category: 'ส่งมอบงาน/ขอตรวจรับงวดงาน', dueType: 'afterEnd', dueDays: 30 },
  ];

  var DUE_TYPES = {
    afterStart: 'ภายใน {n} วันหลังเริ่มสัญญา',
    beforeEnd: 'ก่อนสิ้นสุดสัญญา {n} วัน',
    afterEnd: 'ภายใน {n} วันหลังสิ้นสุดสัญญา',
    date: 'ภายในวันที่กำหนด',
  };

  var SUB_STATUS = {
    pending: { label: 'รอพิจารณา', tone: 'warn' },
    approved: { label: 'ผ่าน', tone: 'ok' },
    rejected: { label: 'ไม่ผ่าน', tone: 'bad' },
    cancelled: { label: 'ยกเลิก', tone: 'muted' },
  };

  var ACTIONS = {
    submit: 'ส่งเรื่อง',
    resubmit: 'แก้ไขและส่งใหม่',
    approve: 'ผ่าน',
    reject: 'ไม่ผ่าน',
    comment: 'แสดงความเห็น',
    cancel: 'ยกเลิกเรื่อง',
    openVote: 'เปิดโหวต',
    vote: 'โหวต',
    closeVote: 'ปิดโหวต',
  };

  // ---------- ตัวช่วยทั่วไป ----------
  function norm(e) { return String(e || '').trim().toLowerCase(); }
  function uniq(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) { var v = norm(arr[i]); if (v && !seen[v]) { seen[v] = 1; out.push(v); } }
    return out;
  }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()); }
  /** รายการอีเมลหรือโดเมน (เช่น @egat.co.th) */
  function listHas(list, email) {
    var e = norm(email);
    if (!e) return false;
    var items = Array.isArray(list) ? list : String(list || '').split(/[\s,;]+/);
    for (var i = 0; i < items.length; i++) {
      var x = norm(items[i]);
      if (!x) continue;
      if (x.charAt(0) === '@' ? e.slice(-x.length) === x : e === x) return true;
    }
    return false;
  }
  function parseList(v) {
    return (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map(norm).filter(Boolean);
  }
  function pad3(n) { var s = String(n); while (s.length < 3) s = '0' + s; return s; }
  function subNo(sub) { return '#' + pad3(sub.no || 0); }
  function toDate(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  }
  function isoDate(d) {
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }
  function addDaysIso(iso, n) { var d = toDate(iso); d.setDate(d.getDate() + n); return isoDate(d); }
  function daysBetween(a, b) { return Math.round((toDate(b) - toDate(a)) / DAY); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /** ตัดข้อความยาวเกิน (กันข้อมูลล้นช่องของ Google Sheet ที่เก็บได้ราว 50,000 ตัวอักษร) */
  var MAX_TITLE = 200, MAX_DETAIL = 8000, MAX_COMMENT = 3000;
  function cut(s, n) { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n) : s; }
  /** ข้อผิดพลาดพร้อมรหัส: forbidden = ไม่มีสิทธิ์, invalid = ข้อมูลไม่ถูกต้อง */
  function fail(msg, code) { var e = new Error(msg); e.code = code; return e; }

  // ---------- สมาชิกและสิทธิ์ ----------
  function seatValue(v) {
    if (v === '' || v == null || !isFinite(+v)) return null;
    var n = Math.round(+v);
    return n >= 0 && n <= MAX_SEAT ? n : null;
  }
  /**
   * สมาชิกทั้งหมดรวมเจ้าของ: [{email, name, role, notify, seat}]
   * seat ใช้กับคณะกรรมการ (และเจ้าของที่ทำหน้าที่กรรมการ) — ผู้ที่ยังไม่ได้กำหนดลำดับ จะได้ลำดับว่างถัดไปตามลำดับในรายชื่อ
   */
  function members(p) {
    var out = [];
    if (p && p.ownerEmail) out.push({ email: norm(p.ownerEmail), name: p.ownerName || '', role: 'owner', notify: p.ownerNotify || 'all', seat: null });
    var ms = (p && p.members) || [];
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (!m || !m.email || norm(m.email) === norm(p.ownerEmail)) continue;
      out.push({ email: norm(m.email), name: m.name || '', role: m.role || 'viewer', notify: m.notify || DEFAULT_NOTIFY[m.role] || 'mine', seat: m.role === 'committee' ? seatValue(m.seat) : null });
    }
    // ลำดับกรรมการ
    var ownerCommittee = p && OWNER_ACTS[p.ownerRole] && p.ownerRole === 'committee';
    var taken = {}, j, x;
    for (j = 0; j < out.length; j++) {
      x = out[j];
      if (x.role === 'owner') { if (ownerCommittee) x.seat = seatValue(p.ownerSeat); else continue; }
      if (x.role !== 'committee' && x.role !== 'owner') continue;
      if (x.seat != null) { if (taken[x.seat]) x.seat = null; else taken[x.seat] = 1; }
    }
    for (j = 0; j < out.length; j++) {
      x = out[j];
      var inCommittee = x.role === 'committee' || (x.role === 'owner' && ownerCommittee);
      if (!inCommittee || x.seat != null) continue;
      var s = 0;
      while (taken[s]) s++;
      x.seat = s; taken[s] = 1;
    }
    return out;
  }
  /** คณะกรรมการเรียงตามลำดับพิจารณา (กรรมการลำดับ 1, 2, 3 … ประธานกรรมการเป็นคนสุดท้าย) — เฉพาะผู้มีสิทธิ์พิจารณา ไม่นับ excludeEmail */
  function committeeSeats(p, excludeEmail) {
    var ex = norm(excludeEmail);
    return members(p).filter(function (m) {
      if (m.seat == null || m.email === ex) return false;
      return m.role === 'owner' || permsOf(p, m.role).indexOf('approve') >= 0;
    }).sort(function (a, b) { return seatOrder(a.seat) - seatOrder(b.seat); });
  }
  function seatOf(p, email) {
    var e = norm(email), all = members(p);
    for (var i = 0; i < all.length; i++) if (all[i].email === e) return all[i].seat;
    return null;
  }
  function roleOf(p, email) {
    var e = norm(email);
    if (!p || !e) return null;
    if (norm(p.ownerEmail) === e) return 'owner';
    var ms = p.members || [];
    for (var i = 0; i < ms.length; i++) if (norm(ms[i].email) === e) return ms[i].role || 'viewer';
    return null;
  }
  function memberName(p, email) {
    var e = norm(email);
    var all = members(p);
    for (var i = 0; i < all.length; i++) if (all[i].email === e) return all[i].name || e;
    return e;
  }
  function permsOf(p, role) {
    if (role === 'owner') return PERM_KEYS.slice();
    var custom = p && p.rolePerms && p.rolePerms[role];
    return Array.isArray(custom) ? custom.slice() : (DEFAULT_ROLE_PERMS[role] || []).slice();
  }
  /** เจ้าของโครงการ — โครงการเก่าที่ยังไม่มีเจ้าของ ให้ผู้ดูแลระบบทำหน้าที่แทน */
  function isOwner(p, user) {
    if (!p || !user) return false;
    if (!p.ownerEmail) return !!user.isAdmin;
    return norm(p.ownerEmail) === norm(user.email);
  }
  function canView(p, user) {
    if (!p || !user) return false;
    return !!(user.isAdmin || user.isExec || user.isDept || roleOf(p, user.email) || isOwner(p, user));
  }
  /** user = { email, isAdmin, isExec } ; perm = คีย์ใน PERMS หรือ 'view' | 'manageMembers' | 'deleteProject' */
  function can(p, user, perm) {
    if (!p || !user) return false;
    if (perm === 'manageMembers') return isOwner(p, user);
    if (perm === 'deleteProject' || perm === 'transferOwner') return isOwner(p, user) || !!user.isAdmin;
    if (perm === 'view') return canView(p, user);
    if (isOwner(p, user)) return true;
    var role = roleOf(p, user.email);
    if (!role) return !!user.isAdmin && perm !== 'submit' && perm !== 'approve';
    if (permsOf(p, role).indexOf(perm) >= 0) return true;
    return !!user.isAdmin && perm !== 'submit' && perm !== 'approve';
  }
  function canCreateProject(settings, user) {
    if (!user || !user.email) return false;
    if (user.isAdmin) return true;
    var list = parseList(settings && settings.projectCreators);
    return !list.length || listHas(list, user.email);
  }

  // ---------- ขั้นตอนอนุมัติ ----------
  function workflows(p) {
    return (p && Array.isArray(p.workflow) && p.workflow.length) ? p.workflow : DEFAULT_WORKFLOWS;
  }
  function workflowFor(p, category) {
    var wfs = workflows(p);
    for (var i = 0; i < wfs.length; i++) if (wfs[i].name === category) return wfs[i];
    return wfs[wfs.length - 1] || DEFAULT_WORKFLOWS[DEFAULT_WORKFLOWS.length - 1];
  }
  function stepMode(step) {
    if (!step) return 'any';
    if (step.mode === 'any' || step.mode === 'seq') return step.role === 'committee' ? step.mode : 'any';
    return step.role === 'committee' ? 'seq' : 'any';
  }
  function stepLabel(step) {
    if (!step) return '';
    if (step.label) return step.label;
    if (step.seat != null && step.seat !== '') return seatStepLabel(step.seat);
    return ((ROLES[step.role] || {}).label || step.role) + 'พิจารณา';
  }
  /** บทบาทในงานของเจ้าของโครงการ (ค่าเริ่มต้น: ผู้ควบคุมงาน) — ใช้หาผู้พิจารณา */
  function ownerActsAs(p) { return (p && OWNER_ACTS[p.ownerRole]) ? p.ownerRole : 'supervisor'; }
  /** ผู้มีสิทธิ์พิจารณาขั้นนี้: สมาชิกบทบาทนั้นที่มีสิทธิ์ approve (ไม่นับผู้ส่ง) — ถ้าไม่มี ให้เจ้าของโครงการ */
  function approversFor(p, step, submitterEmail) {
    if (!step) return [];
    var sub = norm(submitterEmail);
    var list = [];
    var all = members(p);
    var acts = ownerActsAs(p);
    if (step.seat != null && step.seat !== '') {
      // ขั้นที่ผูกกับลำดับกรรมการ: เฉพาะผู้ที่อยู่ในลำดับนั้น — ไม่มีผู้ใดอยู่ในลำดับนั้นแล้ว ให้เจ้าของโครงการพิจารณาแทน
      var seated = committeeSeats(p, sub).filter(function (m) { return m.seat === +step.seat; }).map(function (m) { return m.email; });
      if (seated.length) return seated;
      return p.ownerEmail && norm(p.ownerEmail) !== sub ? [norm(p.ownerEmail)] : [];
    }
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      if (m.role === 'owner') { if (step.role === 'owner' || acts === step.role) list.push(m.email); continue; }
      if (m.role !== step.role) continue;
      if (permsOf(p, m.role).indexOf('approve') < 0) continue;
      list.push(m.email);
    }
    var others = list.filter(function (e) { return e !== sub; });
    if (others.length) return others;
    if (p.ownerEmail && norm(p.ownerEmail) !== sub) return [norm(p.ownerEmail)];
    return list.length ? list : (p.ownerEmail ? [norm(p.ownerEmail)] : []);
  }
  function currentApprovers(sub, p) {
    if (!sub || sub.status !== 'pending') return [];
    var step = (sub.steps || [])[sub.currentStep || 0];
    return approversFor(p, step, sub.submittedBy);
  }
  function currentStep(sub) { return sub ? (sub.steps || [])[sub.currentStep || 0] || null : null; }
  function canDecide(sub, p, user) {
    if (!sub || sub.status !== 'pending' || !user) return false;
    if (currentApprovers(sub, p).indexOf(norm(user.email)) >= 0) return true;
    // ขั้นของกรรมการแต่ละลำดับ: เฉพาะกรรมการในลำดับนั้นเท่านั้น (เจ้าของพิจารณาแทนไม่ได้ เว้นแต่ไม่มีผู้ใดอยู่ในลำดับนั้น)
    var step = currentStep(sub);
    if (step && step.seat != null && step.seat !== '') return false;
    return isOwner(p, user) && norm(user.email) !== norm(sub.submittedBy);
  }
  function canComment(sub, p, user) {
    if (!sub || !canView(p, user)) return false;
    var r = roleOf(p, user.email);
    return norm(user.email) === norm(sub.submittedBy) || isOwner(p, user) ||
      (r && (permsOf(p, r).indexOf('submit') >= 0 || permsOf(p, r).indexOf('approve') >= 0));
  }
  function canResubmit(sub, p, user) {
    return !!sub && sub.status === 'rejected' && !!user && norm(user.email) === norm(sub.submittedBy) && can(p, user, 'submit');
  }
  function canCancel(sub, p, user) {
    return !!sub && sub.status === 'pending' && !!user && (norm(user.email) === norm(sub.submittedBy) || isOwner(p, user));
  }

  /** คัดลอกขั้นตอนพิจารณาไว้ในเรื่อง — ขั้นคณะกรรมการแบบเรียงลำดับ แตกเป็นขั้นละ 1 คนตามลำดับกรรมการ */
  function snapshotSteps(p, category, submitterEmail) {
    var wf = workflowFor(p, category);
    var out = [];
    (wf.steps || []).forEach(function (s) {
      var base = { role: s.role, days: +s.days || 7, status: 'waiting', by: '', byName: '', at: '', comment: '' };
      if (s.role === 'committee' && stepMode(s) === 'seq') {
        var seats = committeeSeats(p, submitterEmail);
        if (seats.length) {
          seats.forEach(function (m) {
            out.push(Object.assign({}, base, { seat: m.seat, label: seatStepLabel(m.seat), mode: 'seq' }));
          });
          return;
        }
      }
      out.push(Object.assign({}, base, { label: stepLabel(s), mode: stepMode(s) }));
    });
    return out;
  }

  function hist(actor, action, extra) {
    return Object.assign({ at: extra.at, by: norm(actor.email), byName: actor.name || '', action: action }, extra);
  }

  function nextNo(subs, pid) {
    var max = 0;
    for (var i = 0; i < (subs || []).length; i++) if (subs[i].projectId === pid && +subs[i].no > max) max = +subs[i].no;
    return max + 1;
  }

  /** สร้างเรื่องใหม่ — input: { id, category, title, detail, requiredId, files } */
  function createSubmission(p, input, actor, nowIso, existing) {
    if (!can(p, actor, 'submit')) throw fail('คุณไม่มีสิทธิ์ส่งเรื่องในโครงการนี้', 'forbidden');
    var title = cut(input.title, MAX_TITLE);
    if (!title) throw fail('กรุณาระบุชื่อเรื่อง', 'invalid');
    var steps = snapshotSteps(p, input.category, actor.email);
    if (!steps.length) throw fail('หมวดเรื่องนี้ยังไม่มีขั้นตอนพิจารณา', 'invalid');
    var files0 = (input.files || []).slice();
    var vote = input.vote ? cleanVote(input.vote, files0, actor, nowIso) : null;
    steps[0].status = 'current';
    steps[0].startedAt = nowIso;
    var sub = {
      id: input.id, projectId: p.id, no: nextNo(existing, p.id), rev: 1,
      category: workflowFor(p, input.category).name, title: title, detail: cut(input.detail, MAX_DETAIL),
      requiredId: input.requiredId || '', files: (input.files || []).slice(),
      submittedBy: norm(actor.email), submittedByName: actor.name || '', submittedAt: nowIso,
      status: 'pending', currentStep: 0, stepStartedAt: nowIso, steps: steps, updatedAt: nowIso,
      history: [],
    };
    if (vote) sub.vote = vote;
    sub.history.push(hist(actor, 'submit', { at: nowIso, step: 0, comment: '', files: sub.files.slice(), rev: 1 }));
    return { sub: sub, event: 'submitted' };
  }

  /** พิจารณา: decision = 'approve' | 'reject' */
  function decide(subIn, p, actor, decision, comment, nowIso, files) {
    var sub = clone(subIn);
    if (!canDecide(sub, p, actor)) throw fail('เรื่องนี้ไม่ได้รอการพิจารณาจากคุณ', 'forbidden');
    comment = cut(comment, MAX_COMMENT);
    if (decision === 'reject' && !comment) throw fail('กรุณาระบุเหตุผลที่ไม่ผ่าน', 'invalid');
    if (decision !== 'approve' && decision !== 'reject') throw fail('ผลการพิจารณาไม่ถูกต้อง', 'invalid');
    var i = sub.currentStep || 0;
    var step = sub.steps[i];
    if (decision === 'approve' && sub.vote && sub.vote.status === 'open' && (step.role === 'committee' || i === sub.steps.length - 1)) {
      throw fail('ยังมีการโหวตเลือกรูปแบบที่ยังไม่ได้ข้อยุติ — ต้องโหวตให้ครบหรือปิดโหวตก่อนจึงจะอนุมัติขั้นนี้ได้', 'invalid');
    }
    step.status = decision === 'approve' ? 'approved' : 'rejected';
    step.by = norm(actor.email); step.byName = actor.name || ''; step.at = nowIso; step.comment = comment;
    sub.history.push(hist(actor, decision, { at: nowIso, step: i, comment: comment, files: (files || []).slice() }));
    if (files && files.length) sub.files = (sub.files || []).concat(files);
    var event;
    if (decision === 'reject') { sub.status = 'rejected'; event = 'rejected'; }
    else if (i + 1 < sub.steps.length) {
      sub.currentStep = i + 1;
      sub.stepStartedAt = nowIso;
      sub.steps[i + 1].status = 'current';
      sub.steps[i + 1].startedAt = nowIso;
      event = 'advanced';
    } else { sub.status = 'approved'; event = 'approved'; }
    sub.closedAt = sub.status === 'pending' ? '' : nowIso;
    sub.updatedAt = nowIso;
    return { sub: sub, event: event };
  }

  function resubmit(subIn, p, actor, changes, nowIso, files) {
    var sub = clone(subIn);
    if (!canResubmit(sub, p, actor)) throw fail('ส่งใหม่ได้เฉพาะผู้ส่งเรื่อง เมื่อเรื่องไม่ผ่านการพิจารณา', 'forbidden');
    changes = changes || {};
    if (changes.title != null && String(changes.title).trim()) sub.title = cut(changes.title, MAX_TITLE);
    if (changes.detail != null) sub.detail = cut(changes.detail, MAX_DETAIL);
    sub.rev = (+sub.rev || 1) + 1;
    sub.steps = snapshotSteps(p, sub.category, sub.submittedBy);
    if (files && files.length) sub.files = (sub.files || []).concat(files);
    if (changes.vote) sub.vote = cleanVote(changes.vote, sub.files || [], actor, nowIso);
    else if (sub.vote) { sub.vote.status = 'open'; sub.vote.ballots = []; sub.vote.result = ''; sub.vote.closedAt = ''; sub.vote.closedBy = ''; sub.vote.closeReason = ''; }
    sub.steps[0].status = 'current';
    sub.steps[0].startedAt = nowIso;
    sub.currentStep = 0;
    sub.stepStartedAt = nowIso;
    sub.status = 'pending';
    sub.closedAt = '';
    sub.history.push(hist(actor, 'resubmit', { at: nowIso, step: 0, comment: cut(changes.comment, MAX_COMMENT), files: (files || []).slice(), rev: sub.rev }));
    sub.updatedAt = nowIso;
    return { sub: sub, event: 'resubmitted' };
  }

  function cancelSub(subIn, p, actor, comment, nowIso) {
    var sub = clone(subIn);
    if (!canCancel(sub, p, actor)) throw fail('ยกเลิกได้เฉพาะผู้ส่งเรื่องขณะรอพิจารณา', 'forbidden');
    sub.status = 'cancelled';
    sub.closedAt = nowIso;
    sub.history.push(hist(actor, 'cancel', { at: nowIso, step: sub.currentStep || 0, comment: cut(comment, MAX_COMMENT) }));
    sub.updatedAt = nowIso;
    return { sub: sub, event: 'cancelled' };
  }

  function commentSub(subIn, p, actor, text, nowIso, files) {
    var sub = clone(subIn);
    if (!canComment(sub, p, actor)) throw fail('คุณไม่มีสิทธิ์แสดงความเห็นในเรื่องนี้', 'forbidden');
    text = cut(text, MAX_COMMENT);
    if (!text && !(files && files.length)) throw fail('กรุณาพิมพ์ความเห็น', 'invalid');
    if (files && files.length) sub.files = (sub.files || []).concat(files);
    sub.history.push(hist(actor, 'comment', { at: nowIso, step: sub.currentStep || 0, comment: text, files: (files || []).slice() }));
    sub.updatedAt = nowIso;
    return { sub: sub, event: 'commented' };
  }

  /** ทำรายการกับเรื่อง: action = approve | reject | resubmit | cancel | comment */
  function act(sub, p, actor, action, opts, nowIso) {
    opts = opts || {};
    if (action === 'approve' || action === 'reject') return decide(sub, p, actor, action, opts.comment, nowIso, opts.files);
    if (action === 'resubmit') return resubmit(sub, p, actor, opts.changes || { comment: opts.comment }, nowIso, opts.files);
    if (action === 'cancel') return cancelSub(sub, p, actor, opts.comment, nowIso);
    if (action === 'comment') return commentSub(sub, p, actor, opts.comment, nowIso, opts.files);
    if (action === 'openVote') return openVote(sub, p, actor, opts.vote, nowIso, opts.files);
    if (action === 'vote') return castVote(sub, p, actor, opts.option, opts.comment, nowIso);
    if (action === 'closeVote') return closeVote(sub, p, actor, opts.option, opts.comment, nowIso);
    throw fail('ไม่รู้จักคำสั่ง ' + action, 'invalid');
  }

  // ---------- โหวตเลือกรูปแบบ/สี (คณะกรรมการตัดสิน เมื่อแบบไม่ได้กำหนดไว้) ----------
  var VOTE_STATUS = { open: 'กำลังโหวต', closed: 'ได้ข้อยุติแล้ว' };
  /** ตรวจและจัดรูปข้อมูลโหวต: { question, options:[{label, detail, fileId}] } */
  function cleanVote(v, allowedFiles, actor, nowIso) {
    v = v || {};
    var seen = {}, opts = [];
    var src = Array.isArray(v.options) ? v.options : [];
    for (var i = 0; i < src.length && opts.length < 12; i++) {
      var o = src[i] || {};
      var label = cut(o.label, 120);
      if (!label || seen[label.toLowerCase()]) continue;
      seen[label.toLowerCase()] = 1;
      var fid = String(o.fileId || '');
      opts.push({ id: 'o' + (opts.length + 1), label: label, detail: cut(o.detail, 500), fileId: fid && (allowedFiles || []).indexOf(fid) >= 0 ? fid : '' });
    }
    if (opts.length < 2) throw fail('การโหวตต้องมีตัวเลือกอย่างน้อย 2 แบบ (ชื่อไม่ซ้ำกัน)', 'invalid');
    return {
      question: cut(v.question, 200) || 'เลือกรูปแบบ/สีที่จะใช้', options: opts, status: 'open',
      openedBy: norm(actor.email), openedByName: actor.name || '', openedAt: nowIso,
      ballots: [], result: '', closedAt: '', closedBy: '', closedByName: '', closeReason: '',
    };
  }
  /** ผู้มีสิทธิ์โหวต: คณะกรรมการทุกลำดับ (ไม่นับผู้ส่งเรื่อง) — ถ้าไม่มีคณะกรรมการ ให้เจ้าของโครงการ */
  function voters(p, sub) {
    var list = committeeSeats(p, sub && sub.submittedBy).map(function (m) { return m.email; });
    if (list.length) return list;
    return p && p.ownerEmail && norm(p.ownerEmail) !== norm(sub && sub.submittedBy) ? [norm(p.ownerEmail)] : [];
  }
  /** ประธานกรรมการ (ผู้ชี้ขาดเมื่อคะแนนเท่ากัน) — ถ้าไม่มีประธาน ให้เจ้าของโครงการ */
  function voteChair(p, sub) {
    var chair = committeeSeats(p, sub && sub.submittedBy).filter(function (m) { return m.seat === 0; })[0];
    return chair ? chair.email : (p && p.ownerEmail ? norm(p.ownerEmail) : '');
  }
  function optionLabel(vote, id) {
    var o = (vote && vote.options || []).filter(function (x) { return x.id === id; })[0];
    return o ? o.label : '';
  }
  /** นับคะแนน: { counts:{id:n}, total, eligible, leaders:[id], missing:[email] } — นับเฉพาะผู้มีสิทธิ์โหวตปัจจุบัน */
  function tally(sub, p) {
    var v = sub && sub.vote;
    var res = { counts: {}, total: 0, eligible: 0, leaders: [], missing: [], top: 0 };
    if (!v) return res;
    var elig = voters(p, sub);
    res.eligible = elig.length;
    (v.options || []).forEach(function (o) { res.counts[o.id] = 0; });
    var voted = {};
    (v.ballots || []).forEach(function (b) {
      if (elig.indexOf(b.by) < 0 || res.counts[b.option] == null) return;
      res.counts[b.option]++; res.total++; voted[b.by] = 1;
    });
    res.missing = elig.filter(function (e) { return !voted[e]; });
    for (var id in res.counts) if (res.counts[id] > res.top) res.top = res.counts[id];
    if (res.top > 0) for (var k in res.counts) if (res.counts[k] === res.top) res.leaders.push(k);
    return res;
  }
  function ballotOf(sub, email) {
    var e = norm(email);
    return ((sub && sub.vote && sub.vote.ballots) || []).filter(function (b) { return b.by === e; })[0] || null;
  }
  function canVote(sub, p, user) {
    return !!(sub && user && sub.status === 'pending' && sub.vote && sub.vote.status === 'open' && voters(p, sub).indexOf(norm(user.email)) >= 0);
  }
  function canOpenVote(sub, p, user) {
    if (!sub || !user || sub.status !== 'pending' || (sub.vote && sub.vote.status === 'open')) return false;
    var e = norm(user.email);
    if (e === norm(sub.submittedBy) && can(p, user, 'submit')) return true;
    if (isOwner(p, user)) return true;
    var r = roleOf(p, e);
    return !!r && r !== 'contractor' && permsOf(p, r).indexOf('approve') >= 0;
  }
  /** ปิดโหวต: ประธานกรรมการ หรือเจ้าของโครงการ */
  function canCloseVote(sub, p, user) {
    if (!sub || !user || sub.status !== 'pending' || !sub.vote || sub.vote.status !== 'open') return false;
    var e = norm(user.email);
    return e === voteChair(p, sub) || (isOwner(p, user) && e !== norm(sub.submittedBy));
  }
  function finishVote(sub, actor, optionId, reason, nowIso) {
    sub.vote.status = 'closed';
    sub.vote.result = optionId;
    sub.vote.closedAt = nowIso;
    sub.vote.closedBy = actor ? norm(actor.email) : '';
    sub.vote.closedByName = actor ? actor.name || '' : '';
    sub.vote.closeReason = reason;
  }
  function openVote(subIn, p, actor, v, nowIso, files) {
    var sub = clone(subIn);
    if (!canOpenVote(sub, p, actor)) throw fail('คุณไม่มีสิทธิ์เปิดโหวตในเรื่องนี้ หรือมีการโหวตที่ยังเปิดอยู่', 'forbidden');
    if (files && files.length) sub.files = (sub.files || []).concat(files);
    sub.vote = cleanVote(v, sub.files || [], actor, nowIso);
    sub.history.push(hist(actor, 'openVote', { at: nowIso, step: sub.currentStep || 0, comment: sub.vote.question, files: (files || []).slice() }));
    sub.updatedAt = nowIso;
    return { sub: sub, event: 'voteOpened' };
  }
  function castVote(subIn, p, actor, optionId, comment, nowIso) {
    var sub = clone(subIn);
    if (!canVote(sub, p, actor)) throw fail('คุณไม่มีสิทธิ์โหวตในเรื่องนี้ หรือการโหวตปิดแล้ว', 'forbidden');
    if (!optionLabel(sub.vote, optionId)) throw fail('กรุณาเลือกตัวเลือกที่จะโหวต', 'invalid');
    var e = norm(actor.email);
    sub.vote.ballots = (sub.vote.ballots || []).filter(function (b) { return b.by !== e; });
    sub.vote.ballots.push({ by: e, byName: actor.name || '', seat: seatOf(p, e), option: optionId, at: nowIso, comment: cut(comment, 500) });
    sub.history.push(hist(actor, 'vote', { at: nowIso, step: sub.currentStep || 0, comment: 'เลือก "' + optionLabel(sub.vote, optionId) + '"' + (comment ? ' — ' + cut(comment, 500) : '') }));
    sub.updatedAt = nowIso;
    var t = tally(sub, p);
    var event = 'voted';
    if (!t.missing.length) {
      if (t.leaders.length === 1) { finishVote(sub, null, t.leaders[0], 'majority', nowIso); event = 'voteClosed'; }
      else {
        // คะแนนเท่ากัน: ใช้เสียงของประธานกรรมการชี้ขาด
        var chairBallot = ballotOf(sub, voteChair(p, sub));
        if (chairBallot && t.leaders.indexOf(chairBallot.option) >= 0) { finishVote(sub, null, chairBallot.option, 'chair', nowIso); event = 'voteClosed'; }
        else event = 'voteTie';
      }
    }
    return { sub: sub, event: event };
  }
  /** ปิดโหวตก่อนครบ หรือชี้ขาดเมื่อคะแนนเท่ากัน: ผลคือคะแนนสูงสุด ถ้าเท่ากันต้องระบุ option */
  function closeVote(subIn, p, actor, optionId, comment, nowIso) {
    var sub = clone(subIn);
    if (!canCloseVote(sub, p, actor)) throw fail('ปิดโหวตได้เฉพาะประธานกรรมการหรือเจ้าของโครงการ', 'forbidden');
    var t = tally(sub, p);
    if (!t.total) throw fail('ยังไม่มีผู้โหวต — ปิดโหวตไม่ได้', 'invalid');
    var pick = '';
    if (t.leaders.length === 1) pick = t.leaders[0];
    else {
      if (!optionId || t.leaders.indexOf(optionId) < 0) throw fail('คะแนนเท่ากัน — กรุณาเลือกแบบที่ชี้ขาดจากตัวเลือกที่ได้คะแนนสูงสุด', 'invalid');
      pick = optionId;
    }
    finishVote(sub, actor, pick, t.leaders.length > 1 ? 'casting' : 'manual', nowIso);
    sub.history.push(hist(actor, 'closeVote', { at: nowIso, step: sub.currentStep || 0, comment: 'ผลโหวต: "' + optionLabel(sub.vote, pick) + '"' + (comment ? ' — ' + cut(comment, 500) : '') }));
    sub.updatedAt = nowIso;
    return { sub: sub, event: 'voteClosed' };
  }

  // ---------- ระยะเวลาพิจารณา (SLA) ----------
  function slaSettings(p, settings) {
    var warn = +(p && p.slaWarnDays) || +(settings && settings.slaWarnDays) || 7;
    var late = +(p && p.slaLateDays) || +(settings && settings.slaLateDays) || 14;
    return { warn: warn, late: Math.max(late, warn) };
  }
  /** สถานะเวลาของเรื่องที่รอพิจารณา: อายุ (วัน) นับจากวันที่ได้รับในขั้นปัจจุบัน */
  function subSla(sub, p, settings, nowIso) {
    var res = { age: 0, totalAge: 0, dueAt: '', dueDays: 0, overdue: 0, left: 0, tone: 'ok' };
    if (!sub) return res;
    var now = new Date(nowIso || new Date().toISOString());
    res.totalAge = Math.max(0, (now - new Date(sub.submittedAt)) / DAY);
    if (sub.status !== 'pending') { res.tone = 'done'; return res; }
    var step = (sub.steps || [])[sub.currentStep || 0] || {};
    var start = new Date(sub.stepStartedAt || sub.submittedAt);
    res.age = Math.max(0, (now - start) / DAY);
    res.dueDays = +step.days || 0;
    if (res.dueDays) {
      var due = new Date(start.getTime() + res.dueDays * DAY);
      res.dueAt = due.toISOString();
      res.left = (due - now) / DAY;
      res.overdue = Math.max(0, -res.left);
    }
    var s = slaSettings(p, settings);
    res.tone = res.age >= s.late ? 'late' : res.age >= s.warn ? 'warn' : (res.overdue > 0 ? 'warn' : 'ok');
    return res;
  }

  // ---------- เอกสารที่ต้องส่ง ----------
  function reqDueText(req) {
    var t = DUE_TYPES[req.dueType] || DUE_TYPES.afterStart;
    return t.replace('{n}', String(+req.dueDays || 0));
  }
  function reqDueDate(req, p) {
    if (req.dueType === 'date') return req.dueDate || '';
    var n = +req.dueDays || 0;
    if (req.dueType === 'beforeEnd') return p.endDate ? addDaysIso(p.endDate, -n) : '';
    if (req.dueType === 'afterEnd') return p.endDate ? addDaysIso(p.endDate, n) : '';
    return p.startDate ? addDaysIso(p.startDate, n) : '';
  }
  /** สถานะเอกสารที่ต้องส่ง เทียบกับเรื่องที่ส่งมา (เรื่องที่อ้างถึงรายการนี้) */
  function reqStatus(req, p, subs, todayIso) {
    var due = reqDueDate(req, p);
    var linked = (subs || []).filter(function (s) { return s.requiredId === req.id && s.status !== 'cancelled'; })
      .sort(function (a, b) { return String(a.submittedAt).localeCompare(String(b.submittedAt)); });
    var first = linked[0] || null;
    var last = linked[linked.length - 1] || null;
    var res = { due: due, sub: last, firstAt: first ? first.submittedAt : '', state: 'none', lateDays: 0, overdueDays: 0, leftDays: null, tone: 'muted' };
    if (first && due) res.lateDays = Math.max(0, daysBetween(due, first.submittedAt.slice(0, 10)));
    if (last) res.state = last.status;
    if (res.state === 'approved') { res.tone = 'ok'; return res; }
    if (due) {
      res.leftDays = daysBetween(todayIso, due);
      if (res.state === 'none' || res.state === 'rejected') {
        if (res.leftDays < 0) { res.overdueDays = -res.leftDays; res.tone = 'bad'; }
        else if (res.leftDays <= 7) res.tone = 'warn';
      } else res.tone = 'warn';
    }
    return res;
  }

  // ---------- การแจ้งเตือน ----------
  function levelOf(m) { return m.notify || DEFAULT_NOTIFY[m.role] || 'mine'; }

  /** ผู้รับอีเมล: action = ต้องดำเนินการ, info = เพื่อทราบ */
  function recipients(p, event, sub, actorEmail) {
    var actor = norm(actorEmail);
    var action = [], info = [];
    var all = members(p);
    var byLevel = function (levels) { return all.filter(function (m) { return levels.indexOf(levelOf(m)) >= 0; }).map(function (m) { return m.email; }); };
    var deciders = sub ? (sub.history || []).filter(function (h) { return h.action === 'approve' || h.action === 'reject'; }).map(function (h) { return h.by; }) : [];
    switch (event) {
      case 'submitted':
      case 'resubmitted':
        action = currentApprovers(sub, p);
        info = byLevel(['all']);
        break;
      case 'advanced':
        action = currentApprovers(sub, p);
        info = [sub.submittedBy].concat(byLevel(['all', 'decisions']), deciders);
        break;
      case 'approved':
      case 'rejected':
        // ผลการพิจารณาแจ้งผู้รับจ้างทุกคนในโครงการ (ผู้แทนบริษัทเดียวกัน) ยกเว้นผู้ที่ปิดการแจ้งเตือน
        info = [sub.submittedBy].concat(byLevel(['all', 'decisions']), deciders,
          all.filter(function (m) { return m.role === 'contractor'; }).map(function (m) { return m.email; }));
        break;
      case 'commented':
        info = [sub.submittedBy].concat(currentApprovers(sub, p), byLevel(['all']), deciders);
        break;
      case 'cancelled':
        info = currentApprovers(subWithStatus(sub, 'pending'), p).concat(byLevel(['all']));
        break;
      case 'progress':
        info = byLevel(['all', 'decisions']);
        break;
      case 'voteOpened':
        action = tally(sub, p).missing;
        info = [sub.submittedBy].concat(byLevel(['all']));
        break;
      case 'voteTie':
        action = [voteChair(p, sub)];
        break;
      case 'voteClosed':
        action = currentApprovers(sub, p);
        info = [sub.submittedBy].concat(voters(p, sub), byLevel(['all', 'decisions']));
        break;
      default:
        break;
    }
    action = uniq(action).filter(function (e) { return e !== actor; });
    var none = all.filter(function (m) { return levelOf(m) === 'none'; }).map(function (m) { return m.email; });
    var mustTell = sub ? [norm(sub.submittedBy)] : [];
    info = uniq(info).filter(function (e) {
      return e !== actor && action.indexOf(e) < 0 && (none.indexOf(e) < 0 || mustTell.indexOf(e) >= 0);
    });
    return { action: action, info: info };
  }
  function subWithStatus(sub, status) { var s = clone(sub); s.status = status; return s; }

  // ---------- อีเมล ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  /** วันที่และเวลาแบบไทย (เวลาประเทศไทย UTC+7) */
  function thaiDateTime(iso, withTime) {
    if (!iso) return '–';
    var d = new Date(iso);
    if (isNaN(d)) return '–';
    var hasTime = withTime !== false && String(iso).length > 10;
    var t = hasTime ? new Date(d.getTime() + 7 * 3600e3) : d;
    var day = hasTime ? t.getUTCDate() : t.getDate();
    var mon = hasTime ? t.getUTCMonth() : t.getMonth();
    var yr = (hasTime ? t.getUTCFullYear() : t.getFullYear()) + 543;
    var s = day + ' ' + THAI_MONTHS[mon] + ' ' + String(yr).slice(-2);
    if (hasTime) {
      var hh = t.getUTCHours(), mm = t.getUTCMinutes();
      s += ' ' + (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + ' น.';
    }
    return s;
  }
  function appLink(appUrl, p, sub) {
    if (!appUrl) return '';
    var base = String(appUrl).split('#')[0];
    return base + '#/p/' + encodeURIComponent(p.id) + (sub ? '/subs/' + encodeURIComponent(sub.id) : '');
  }
  function layout(title, lead, rows, body, link, linkLabel) {
    var rowHtml = rows.map(function (r) {
      return '<tr><td style="padding:4px 12px 4px 0;color:#737D90;white-space:nowrap;vertical-align:top">' + esc(r[0]) + '</td><td style="padding:4px 0;color:#172238">' + r[1] + '</td></tr>';
    }).join('');
    return '<div style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.6;color:#172238;max-width:620px">' +
      '<div style="border-left:4px solid #F2A900;padding:4px 0 4px 14px;margin-bottom:14px"><div style="font-size:12px;color:#737D90">ระบบติดตามโครงการ</div>' +
      '<div style="font-size:18px;font-weight:bold">' + esc(title) + '</div></div>' +
      (lead ? '<p style="margin:0 0 12px">' + lead + '</p>' : '') +
      '<table style="border-collapse:collapse;margin:0 0 12px">' + rowHtml + '</table>' +
      (body || '') +
      (link ? '<p style="margin:18px 0"><a href="' + esc(link) + '" style="background:#172238;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">' + esc(linkLabel || 'เปิดในระบบ') + '</a></p>' : '') +
      '<p style="font-size:12px;color:#737D90;margin-top:20px">อีเมลนี้ส่งอัตโนมัติจากระบบติดตามโครงการ ปรับการรับอีเมลได้ที่เจ้าของโครงการ</p></div>';
  }

  var VERB = {
    submit: 'ส่งเรื่องเข้ามา',
    resubmit: 'แก้ไขและส่งเรื่องใหม่',
    approve: 'พิจารณาให้ผ่าน',
    reject: 'พิจารณาว่าไม่ผ่าน',
    comment: 'แสดงความเห็น',
    cancel: 'ยกเลิกเรื่อง',
    openVote: 'เปิดให้คณะกรรมการโหวตเลือกรูปแบบ',
    vote: 'โหวต',
    closeVote: 'ปิดโหวต',
  };

  var EVENT_TEXT = {
    submitted: { action: 'มีเรื่องรอคุณพิจารณา', info: 'มีเรื่องใหม่ส่งเข้ามา' },
    resubmitted: { action: 'มีเรื่องแก้ไขส่งใหม่ รอคุณพิจารณา', info: 'มีเรื่องแก้ไขส่งใหม่' },
    advanced: { action: 'มีเรื่องรอคุณพิจารณา (ผ่านขั้นก่อนหน้าแล้ว)', info: 'เรื่องผ่านการพิจารณาขั้นที่' },
    approved: { action: 'ผลการพิจารณา: ผ่าน', info: 'ผลการพิจารณา: ผ่าน' },
    rejected: { action: 'ผลการพิจารณา: ไม่ผ่าน', info: 'ผลการพิจารณา: ไม่ผ่าน' },
    commented: { action: 'มีความเห็นใหม่', info: 'มีความเห็นใหม่' },
    cancelled: { action: 'เรื่องถูกยกเลิก', info: 'เรื่องถูกยกเลิก' },
    voteOpened: { action: 'ขอให้โหวตเลือกรูปแบบ', info: 'เปิดโหวตเลือกรูปแบบ' },
    voteTie: { action: 'ผลโหวตเท่ากัน รอประธานชี้ขาด', info: 'ผลโหวตเท่ากัน' },
    voteClosed: { action: 'ได้ผลโหวตแล้ว — ดำเนินการพิจารณาต่อได้', info: 'ผลโหวตเลือกรูปแบบ' },
  };
  function voteHtml(sub, p) {
    var v = sub.vote;
    if (!v) return '';
    var t = tally(sub, p);
    var items = (v.options || []).map(function (o) {
      var win = v.status === 'closed' && v.result === o.id;
      return '<li style="margin:2px 0">' + (win ? '<b>✔ ' : '') + esc(o.label) + (win ? '</b>' : '') +
        (o.detail ? ' <span style="color:#737D90">— ' + esc(o.detail) + '</span>' : '') +
        ' <span style="color:#737D90">(' + (t.counts[o.id] || 0) + ' เสียง)</span></li>';
    }).join('');
    return '<p style="margin:10px 0 4px"><b>' + esc(v.question) + '</b> <span style="color:#737D90">— โหวตแล้ว ' + t.total + '/' + t.eligible + ' คน</span></p>' +
      '<ul style="margin:0 0 8px;padding-left:20px">' + items + '</ul>';
  }

  function isVoteEv(ev) { return ev === 'voteOpened' || ev === 'voteTie' || ev === 'voteClosed'; }
  /** อีเมลแจ้งเรื่องอนุมัติ — kind: 'action' | 'info' */
  function subEmail(event, p, sub, actor, kind, appUrl, settings) {
    var t = EVENT_TEXT[event] || { action: event, info: event };
    var step = (sub.steps || [])[sub.currentStep || 0] || {};
    var last = (sub.history || [])[sub.history.length - 1] || {};
    var head = t[kind] || t.info;
    if (event === 'voteClosed' && sub.vote) head = (kind === 'action' ? t.action : 'ผลโหวต') + ': ' + optionLabel(sub.vote, sub.vote.result);
    if (event === 'advanced' && kind === 'info') head = 'ผ่านขั้น "' + ((sub.steps[(sub.currentStep || 1) - 1] || {}).label || '') + '" แล้ว';
    var code = p.code ? '[' + p.code + '] ' : '';
    var subject = code + head + ' — ' + subNo(sub) + ' ' + sub.title;
    var sla = subSla(sub, p, settings, last.at || sub.updatedAt);
    var actorName = actor.name || actor.email;
    var actorRole = (ROLES[roleOf(p, actor.email)] || {}).label || '';
    var rows = [
      ['โครงการ', esc(p.name)],
      ['เรื่อง', esc(subNo(sub) + ' ' + sub.title) + (sub.rev > 1 ? ' (ครั้งที่ ' + sub.rev + ')' : '')],
      ['หมวด', esc(sub.category)],
      ['ผู้ส่ง', esc(sub.submittedByName || sub.submittedBy)],
      ['ได้รับเมื่อ', esc(thaiDateTime(sub.stepStartedAt || sub.submittedAt))],
    ];
    if (sub.status === 'pending') {
      rows.push(['ขั้นตอนปัจจุบัน', esc('ขั้นที่ ' + ((sub.currentStep || 0) + 1) + '/' + sub.steps.length + ' ' + (step.label || ''))]);
      if (sla.dueAt) rows.push(['ต้องพิจารณาภายใน', esc(step.days + ' วัน (ภายใน ' + thaiDateTime(sla.dueAt) + ')')]);
    } else {
      rows.push(['สถานะ', '<b>' + esc((SUB_STATUS[sub.status] || {}).label || sub.status) + '</b>']);
    }
    var body = '';
    if (event === 'submitted' || event === 'resubmitted') {
      if (sub.detail) body += '<div style="background:#F0F2EE;padding:10px 14px;border-radius:6px;white-space:pre-wrap">' + esc(sub.detail) + '</div>';
    } else if (last.comment && !isVoteEv(event)) {
      body += '<p style="margin:0 0 4px;color:#737D90">' + (last.action === 'reject' ? 'เหตุผลที่ไม่ผ่าน' : 'ความเห็น') + ' — ' + esc(actorName) + (actorRole ? ' (' + esc(actorRole) + ')' : '') + '</p>' +
        '<div style="background:' + (last.action === 'reject' ? '#FBE6E3' : '#F0F2EE') + ';padding:10px 14px;border-radius:6px;white-space:pre-wrap">' + esc(last.comment) + '</div>';
    }
    var isVote = event === 'voteOpened' || event === 'voteTie' || event === 'voteClosed';
    if (isVote || ((event === 'submitted' || event === 'resubmitted') && sub.vote)) body += voteHtml(sub, p);
    var nFiles = (last.files || []).length;
    if (nFiles) body += '<p style="color:#737D90">แนบไฟล์ ' + nFiles + ' ไฟล์ — เปิดดูในระบบ</p>';
    var who = '<b>' + esc(actorName) + '</b>' + (actorRole ? ' (' + esc(actorRole) + ')' : '');
    var lead;
    if (event === 'voteOpened') lead = kind === 'action' ? who + ' เปิดให้คณะกรรมการโหวตเลือกรูปแบบ — กรุณาเข้าระบบเพื่อเลือกแบบที่เห็นสมควร' : who + ' เปิดให้คณะกรรมการโหวตเลือกรูปแบบ';
    else if (event === 'voteTie') lead = 'กรรมการโหวตครบแล้วแต่คะแนนเท่ากัน — กรุณาเข้าระบบเพื่อชี้ขาด';
    else if (event === 'voteClosed') lead = 'การโหวตได้ข้อยุติแล้ว: <b>' + esc(optionLabel(sub.vote, sub.vote && sub.vote.result)) + '</b>' + (kind === 'action' ? ' — กรุณาพิจารณาเรื่องนี้ต่อในระบบ' : '');
    else lead = kind === 'action'
      ? who + ' ' + esc(VERB[last.action] || 'ส่งเรื่องเข้ามา') + ' — กรุณาพิจารณา <b>ผ่าน</b> หรือ <b>ไม่ผ่าน</b> พร้อมระบุเหตุผลในระบบ'
      : who + ' ' + esc(VERB[last.action] || '');
    var html = layout(head, lead, rows, body, appLink(appUrl, p, sub), event === 'voteOpened' && kind === 'action' ? 'เปิดเพื่อโหวต' : kind === 'action' ? 'เปิดเพื่อพิจารณา' : 'ดูรายละเอียด');
    return { subject: subject, html: html };
  }

  /** อีเมลทั้งหมดของเหตุการณ์หนึ่ง: [{ to, kind, event, subject, html }] — ส่งเรื่องที่มีโหวต แจ้งกรรมการให้โหวตด้วย */
  function mailPlan(p, event, sub, actor, appUrl, settings) {
    var out = [];
    var rc = recipients(p, event, sub, actor.email);
    var mk = function (to, kind, ev) {
      var m = subEmail(ev, p, sub, actor, kind, appUrl, settings);
      return { to: to, kind: kind, event: ev, subject: m.subject, html: m.html };
    };
    if (rc.action.length) out.push(mk(rc.action, 'action', event));
    if (rc.info.length) out.push(mk(rc.info, 'info', event));
    if ((event === 'submitted' || event === 'resubmitted') && sub && sub.vote && sub.vote.status === 'open') {
      var extra = recipients(p, 'voteOpened', sub, actor.email).action.filter(function (e) { return rc.action.indexOf(e) < 0; });
      if (extra.length) out.push(mk(extra, 'action', 'voteOpened'));
    }
    return out;
  }

  function progressEmail(p, update, actor, appUrl, info) {
    info = info || {};
    var code = p.code ? '[' + p.code + '] ' : '';
    var pct = function (r) { return r == null ? '–' : (r * 100).toFixed(1) + '%'; };
    var rows = [
      ['โครงการ', esc(p.name)],
      ['วันที่บันทึก', esc(thaiDateTime(update.date, false)) + (update.week ? ' (สัปดาห์ที่ ' + esc(update.week) + ')' : '')],
      ['ผลงานสะสม', '<b>' + esc(pct(info.actual)) + '</b>' + (info.plan != null ? ' — แผน ' + esc(pct(info.plan)) : '')],
      ['ผู้บันทึก', esc(actor.name || actor.email)],
    ];
    var body = '';
    if (update.note) body += '<p style="margin:0 0 4px;color:#737D90">ผลการดำเนินงาน</p><div style="background:#F0F2EE;padding:10px 14px;border-radius:6px;white-space:pre-wrap">' + esc(update.note) + '</div>';
    if (update.issues) body += '<p style="margin:10px 0 4px;color:#B86E00">ปัญหาและอุปสรรค</p><div style="background:#FCEFD8;padding:10px 14px;border-radius:6px;white-space:pre-wrap">' + esc(update.issues) + '</div>';
    return {
      subject: code + 'อัปเดตความคืบหน้า ' + pct(info.actual) + ' — ' + p.name,
      html: layout('อัปเดตความคืบหน้าโครงการ', '', rows, body, appLink(appUrl, p), 'ดูโครงการ'),
    };
  }

  function inviteEmail(p, member, actor, appUrl, mode) {
    var role = ROLES[member.role] || {};
    var how = mode === 'gas' ? 'เปิดลิงก์ด้านล่าง แล้วเข้าสู่ระบบด้วยอีเมลนี้ (ระบบจะส่งรหัสยืนยัน 6 หลักให้ทางอีเมล)'
      : (mode === 'sharepoint' || mode === 'onedrive') ? 'เปิดลิงก์ด้านล่าง แล้วลงชื่อเข้าใช้ด้วยบัญชี Microsoft ของคุณ (ต้องเป็นบัญชีของอีเมลนี้)' : 'เปิดลิงก์ด้านล่างเพื่อเข้าใช้งาน';
    return {
      subject: (p.code ? '[' + p.code + '] ' : '') + 'คุณได้รับแต่งตั้งเป็น' + (role.label || member.role) + ' — ' + p.name,
      html: layout('แต่งตั้งเป็น' + (role.label || member.role), esc(actor.name || actor.email) + ' แต่งตั้งคุณเป็นสมาชิกของโครงการ',
        [['โครงการ', esc(p.name)], ['บทบาท', '<b>' + esc(role.label || member.role) + '</b>'], ['สิทธิ์', esc(role.desc || '')]],
        '<p>' + esc(how) + '</p>', appLink(appUrl, p), 'เปิดโครงการ'),
    };
  }

  function reminderEmail(p, pendingSubs, dueReqs, appUrl, settings, nowIso, toFix) {
    var rows = [['โครงการ', esc(p.name)]];
    var body = '';
    if ((toFix || []).length) {
      body += '<p style="margin:8px 0 4px"><b>เรื่องที่ไม่ผ่านการพิจารณา รอแก้ไขส่งใหม่</b></p><ul style="margin:0;padding-left:20px">' + toFix.map(function (s) {
        var last = (s.history || []).filter(function (h) { return h.action === 'reject'; }).pop() || {};
        return '<li>' + esc(subNo(s) + ' ' + s.title) + ' — ตีกลับเมื่อ ' + esc(thaiDateTime(s.closedAt, false)) + (last.comment ? '<br><span style="color:#737D90">เหตุผล: ' + esc(cut(last.comment, 300)) + '</span>' : '') + '</li>';
      }).join('') + '</ul><p style="margin:4px 0 0;color:#737D90;font-size:13px">แก้ไขแล้วกด "ส่งใหม่" ในเรื่องเดิม หรือกด "ยกเลิกเรื่อง" หากไม่ดำเนินการต่อ</p>';
    }
    if (pendingSubs.length) {
      body += '<p style="margin:8px 0 4px"><b>เรื่องที่รอพิจารณานาน</b></p><ul style="margin:0;padding-left:20px">' + pendingSubs.map(function (s) {
        var sla = subSla(s, p, settings, nowIso);
        return '<li>' + esc(subNo(s) + ' ' + s.title) + ' — ค้าง ' + Math.floor(sla.age) + ' วัน' + (sla.overdue >= 1 ? ' (เกินกำหนด ' + Math.floor(sla.overdue) + ' วัน)' : sla.overdue > 0 ? ' (เกินกำหนดแล้ว)' : '') + '</li>';
      }).join('') + '</ul>';
    }
    if (dueReqs.length) {
      body += '<p style="margin:12px 0 4px"><b>เอกสารที่ต้องส่ง</b></p><ul style="margin:0;padding-left:20px">' + dueReqs.map(function (r) {
        return '<li>' + esc(r.req.title) + ' — ' + (r.st.overdueDays ? 'เลยกำหนด ' + r.st.overdueDays + ' วัน' : 'ครบกำหนด ' + esc(thaiDateTime(r.st.due, false))) + '</li>';
      }).join('') + '</ul>';
    }
    return {
      subject: (p.code ? '[' + p.code + '] ' : '') + 'เตือน: มีงานค้างในโครงการ ' + p.name,
      html: layout('สรุปงานค้าง', '', rows, body, appLink(appUrl, p), 'เปิดโครงการ'),
    };
  }


  // ---------- สมาชิกแผนก ห้องสนทนา และการประชุม (1.0.4) ----------
  /** สมาชิกแผนก (ผู้ดูแลระบบกำหนดเป็นรายชื่ออีเมล): ดูทุกโครงการได้แบบอ่านอย่างเดียว คุยในห้องแผนก และอ่านห้องสนทนาของโครงการอื่น */
  function isDept(settings, user) {
    if (!user || !user.email) return false;
    var list = parseList(settings && settings.deptMembers).filter(function (x) { return x.charAt(0) !== '@'; });
    return list.indexOf(norm(user.email)) >= 0;
  }
  var CHANNELS = {
    dept: { label: 'ห้องแผนก', desc: 'คุยกันภายในแผนก — เฉพาะสมาชิกแผนก ผู้บริหาร และผู้ดูแลระบบ' },
    project: { label: 'ห้องโครงการ', desc: 'สมาชิกโครงการทุกคน รวมผู้รับจ้าง' },
    internal: { label: 'ภายใน กฟผ.', desc: 'สมาชิกโครงการที่ไม่ใช่ผู้รับจ้าง (สมาชิกแผนกอ่านได้)' },
    meeting: { label: 'ห้องประชุม', desc: 'ความเห็นต่อการประชุมครั้งนั้น' },
  };
  var AUDIENCES = { project: 'ประชุมโครงการ (รวมผู้รับจ้าง)', internal: 'ประชุมภายใน กฟผ. (ไม่รวมผู้รับจ้าง)', dept: 'ประชุมแผนก' };
  var MEETING_STATUS = { scheduled: 'นัดแล้ว', done: 'ประชุมแล้ว', cancelled: 'ยกเลิก' };
  var MAX_MSG = 2000;
  function deptAccess(user) { return !!(user && (user.isDept || user.isAdmin || user.isExec)); }
  function isAttendee(m, user) { return !!(m && user && (m.attendees || []).map(norm).indexOf(norm(user.email)) >= 0); }
  function insider(p, user) {
    if (!p || !user) return false;
    if (isOwner(p, user)) return true;
    var r = roleOf(p, user.email);
    return !!r && r !== 'contractor';
  }
  function canSeeMeeting(m, p, user) {
    if (!m || !user) return false;
    if (isAttendee(m, user) || norm(m.createdBy) === norm(user.email)) return true;
    if (m.audience === 'dept') return deptAccess(user);
    if (!p || !canView(p, user)) return false;
    if (m.audience === 'internal') return roleOf(p, user.email) !== 'contractor';
    return true;
  }
  /** อ่านห้องได้หรือไม่: ch = dept | project | internal | meeting */
  function canReadChannel(ch, p, user, meeting) {
    if (!user || !user.email) return false;
    if (ch === 'dept') return deptAccess(user);
    if (ch === 'meeting') return canSeeMeeting(meeting, p, user);
    if (!p || !canView(p, user)) return false;
    if (ch === 'internal') return roleOf(p, user.email) !== 'contractor';
    return ch === 'project';
  }
  /** ส่งข้อความได้หรือไม่ — สมาชิกแผนก/ผู้บริหารอ่านห้องของโครงการอื่นได้อย่างเดียว */
  function canPostChannel(ch, p, user, meeting) {
    if (!canReadChannel(ch, p, user, meeting)) return false;
    if (ch === 'dept') return true;
    if (ch === 'meeting') return isAttendee(meeting, user) || norm(meeting.createdBy) === norm(user.email) || canPostChannel(meeting.audience, p, user);
    if (user.isAdmin) return true;
    if (ch === 'internal') return insider(p, user);
    return isOwner(p, user) || !!roleOf(p, user.email);
  }
  function canCreateMeeting(audience, p, user) {
    if (!user || !user.email || !AUDIENCES[audience]) return false;
    if (audience === 'dept') return !!(user.isDept || user.isAdmin || user.isExec);
    if (!p) return false;
    if (user.isAdmin || isOwner(p, user)) return true;
    var r = roleOf(p, user.email);
    return !!r && r !== 'contractor' && r !== 'viewer';
  }
  function canEditMeeting(m, p, user) {
    if (!m || !user || !user.email) return false;
    if (norm(m.createdBy) === norm(user.email) || user.isAdmin) return true;
    if (m.audience === 'dept') return false;
    return !!p && (isOwner(p, user) || can(p, user, 'editProject'));
  }
  function canToggleAction(m, p, user, action) {
    return canEditMeeting(m, p, user) || (!!action && !!user && norm(action.owner) === norm(user.email));
  }
  /** ข้อความใหม่ — input: { id, projectId, channel, refId, text, files } */
  function newMessage(input, p, actor, nowIso, meeting) {
    var ch = input.channel;
    if (!CHANNELS[ch]) throw fail('ไม่รู้จักห้องสนทนานี้', 'invalid');
    if (!canPostChannel(ch, p, actor, meeting)) throw fail('คุณอ่านห้องนี้ได้อย่างเดียว — พิมพ์ได้เฉพาะสมาชิกของห้อง', 'forbidden');
    var text = cut(input.text, MAX_MSG);
    var files = (input.files || []).slice(0, 10);
    if (!text && !files.length) throw fail('กรุณาพิมพ์ข้อความ', 'invalid');
    return {
      id: input.id, projectId: ch === 'dept' ? '' : (meeting ? meeting.projectId || '' : (p ? p.id : '')),
      channel: ch, refId: ch === 'meeting' ? meeting.id : '',
      by: norm(actor.email), byName: actor.name || '', at: nowIso, text: text, files: files, deleted: false, editedAt: '',
    };
  }
  function canDeleteMessage(msg, user) { return !!msg && !!user && !msg.deleted && (norm(msg.by) === norm(user.email) || !!user.isAdmin); }
  function validLocalDT(v) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v || '')); }
  /** ตรวจและจัดรูปการประชุม — existing = ฉบับเดิม (แก้ไข) */
  function cleanMeeting(input, p, actor, nowIso, existing) {
    input = input || {};
    var audience = existing ? existing.audience : input.audience;
    if (!AUDIENCES[audience]) throw fail('กรุณาเลือกประเภทการประชุม', 'invalid');
    if (existing ? !canEditMeeting(existing, p, actor) : !canCreateMeeting(audience, p, actor)) throw fail('คุณไม่มีสิทธิ์นัดหรือแก้ไขการประชุมนี้', 'forbidden');
    var title = cut(input.title, 200);
    if (!title) throw fail('กรุณาระบุหัวข้อการประชุม', 'invalid');
    if (!validLocalDT(input.startAt)) throw fail('กรุณาระบุวันและเวลาประชุม', 'invalid');
    var link = cut(input.link, 500);
    if (link && !/^https?:\/\/\S+$/i.test(link)) throw fail('ลิงก์ประชุมออนไลน์ต้องขึ้นต้นด้วย https://', 'invalid');
    var seen = {}, attendees = [];
    (Array.isArray(input.attendees) ? input.attendees : parseList(input.attendees)).forEach(function (e) {
      e = norm(e);
      if (!e || seen[e]) return;
      if (!validEmail(e)) throw fail('อีเมลผู้เข้าประชุม "' + e + '" ไม่ถูกต้อง', 'invalid');
      if (audience !== 'project' && p && roleOf(p, e) === 'contractor') throw fail(e + ' เป็นผู้รับจ้าง — เชิญได้เฉพาะ "ประชุมโครงการ"', 'invalid');
      seen[e] = 1; attendees.push(e);
    });
    if (attendees.length > 80) throw fail('ผู้เข้าประชุมได้ไม่เกิน 80 คน', 'invalid');
    var acts = (input.actions || []).slice(0, 60).map(function (a, i) {
      var owner = norm(a.owner);
      return {
        id: a.id || ('A' + (i + 1) + '-' + Date.parse(nowIso).toString(36)), text: cut(a.text, 300), owner: validEmail(owner) ? owner : '',
        due: /^\d{4}-\d{2}-\d{2}$/.test(String(a.due || '')) ? a.due : '', done: !!a.done, doneAt: a.done ? (a.doneAt || nowIso) : '',
      };
    }).filter(function (a) { return a.text; });
    var status = MEETING_STATUS[input.status] ? input.status : (existing ? existing.status : 'scheduled');
    return {
      id: existing ? existing.id : input.id, projectId: audience === 'dept' ? '' : (p ? p.id : ''), audience: audience,
      title: title, startAt: input.startAt, durationMin: Math.min(600, Math.max(15, Math.round(+input.durationMin || 60))),
      place: cut(input.place, 200), link: link, attendees: attendees, agenda: cut(input.agenda, 4000),
      minutes: cut(input.minutes, 20000), actions: acts, status: status,
      createdBy: existing ? existing.createdBy : norm(actor.email), createdByName: existing ? existing.createdByName : (actor.name || ''),
      createdAt: existing ? existing.createdAt : nowIso, updatedAt: nowIso, updatedBy: norm(actor.email), updatedByName: actor.name || '',
    };
  }
  /** สลับสถานะงานที่มอบหมาย (ผู้รับผิดชอบงานนั้นกดเองได้) */
  function toggleAction(m, p, actor, actionId, done, nowIso) {
    var out = clone(m);
    var a = (out.actions || []).filter(function (x) { return x.id === actionId; })[0];
    if (!a) throw fail('ไม่พบงานที่มอบหมายนี้', 'invalid');
    if (!canToggleAction(m, p, actor, a)) throw fail('เฉพาะผู้รับผิดชอบงานหรือผู้จัดการประชุมเท่านั้น', 'forbidden');
    a.done = !!done; a.doneAt = done ? nowIso : '';
    out.updatedAt = nowIso; out.updatedBy = norm(actor.email); out.updatedByName = actor.name || '';
    return out;
  }
  function meetingWhen(m) {
    if (!validLocalDT(m.startAt)) return '–';
    var d = m.startAt.slice(0, 10), t = m.startAt.slice(11, 16);
    var end = new Date(Date.parse(m.startAt + ':00Z') + (+m.durationMin || 60) * 60000).toISOString().slice(11, 16);
    return thaiDateTime(d, false) + ' เวลา ' + t + '–' + end + ' น.';
  }
  /** อีเมลการประชุม — kind: invite | update | minutes | cancel */
  function meetingEmail(kind, m, p, actor, appUrl) {
    var head = { invite: 'เชิญประชุม', update: 'เปลี่ยนแปลงการประชุม', minutes: 'บันทึกการประชุม', cancel: 'ยกเลิกการประชุม', remind: 'เตือนการประชุมพรุ่งนี้' }[kind] || 'การประชุม';
    var code = p && p.code ? '[' + p.code + '] ' : '';
    var rows = [['เรื่อง', '<b>' + esc(m.title) + '</b>'], ['วันเวลา', esc(meetingWhen(m))]];
    if (p) rows.unshift(['โครงการ', esc(p.name)]);
    if (m.place) rows.push(['สถานที่', esc(m.place)]);
    if (m.link) rows.push(['ประชุมออนไลน์', '<a href="' + esc(m.link) + '">' + esc(m.link) + '</a>']);
    rows.push(['ผู้นัดประชุม', esc(m.createdByName || m.createdBy)]);
    var body = '';
    if (kind !== 'minutes' && m.agenda) body += '<p style="margin:8px 0 4px"><b>วาระการประชุม</b></p><div style="background:#F0F2EE;padding:10px 14px;border-radius:6px;white-space:pre-wrap">' + esc(m.agenda) + '</div>';
    if (kind === 'minutes') {
      if (m.minutes) body += '<p style="margin:8px 0 4px"><b>สรุปการประชุม</b></p><div style="background:#F0F2EE;padding:10px 14px;border-radius:6px;white-space:pre-wrap">' + esc(m.minutes) + '</div>';
      var acts = (m.actions || []);
      if (acts.length) body += '<p style="margin:12px 0 4px"><b>งานที่มอบหมาย</b></p><ul style="margin:0;padding-left:20px">' + acts.map(function (a) {
        return '<li>' + (a.done ? '✔ ' : '') + esc(a.text) + (a.owner ? ' — ' + esc(p ? memberName(p, a.owner) : a.owner) : '') + (a.due ? ' (ภายใน ' + esc(thaiDateTime(a.due, false)) + ')' : '') + '</li>';
      }).join('') + '</ul>';
    }
    var link = appUrl ? String(appUrl).split('#')[0] + '#/meetings/' + encodeURIComponent(m.id) : '';
    return {
      subject: code + head + ': ' + m.title + (kind === 'minutes' ? '' : ' — ' + meetingWhen(m)),
      html: layout(head, kind === 'remind' ? 'คุณมีนัดประชุมในวันพรุ่งนี้' : esc(actor.name || actor.email) + (kind === 'cancel' ? ' ยกเลิกการประชุมนี้' : kind === 'minutes' ? ' ส่งบันทึกการประชุม' : ' เชิญคุณเข้าร่วมประชุม'), rows, body, link, 'เปิดการประชุมในระบบ'),
    };
  }


  // ---------- รายงานประจำวัน คลังแบบฟอร์ม และรายงานทางอีเมล (1.0.5) ----------
  var WEATHER = { clear: 'แจ่มใส', cloudy: 'มีเมฆ', rain: 'ฝนตก', heavy: 'ฝนตกหนัก', storm: 'พายุ' };
  var LIB_KINDS = { form: 'แบบฟอร์ม', regulation: 'กฎหมาย/ระเบียบ', standard: 'มาตรฐานงาน', manual: 'คู่มือ/แนวปฏิบัติ', checklist: 'รายการตรวจสอบ' };
  var LIB_USE = { all: 'ใช้ได้ทุกงาน', sub: 'เรื่องขออนุมัติ', daily: 'รายงานประจำวัน', weekly: 'รายงานประจำสัปดาห์', monthly: 'รายงานประจำเดือน', meeting: 'การประชุม', required: 'เอกสารที่ต้องส่ง', handover: 'ส่งมอบ/ตรวจรับงาน' };
  function rows_(list, keys, max) {
    return (Array.isArray(list) ? list : []).slice(0, max).map(function (r) {
      var o = {};
      keys.forEach(function (k) { o[k] = k === 'count' ? Math.max(0, Math.round(+r[k] || 0)) : cut(r[k], 120); });
      return o;
    }).filter(function (r) { return r[keys[0]]; });
  }
  /** รายงานประจำวันของผู้ควบคุมงาน (ระเบียบฯ ข้อ 178) */
  function cleanDaily(input, p, actor, nowIso, existing) {
    if (!can(p, actor, 'recordProgress')) throw fail('คุณไม่มีสิทธิ์บันทึกรายงานประจำวันของโครงการนี้', 'forbidden');
    input = input || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ''))) throw fail('กรุณาระบุวันที่', 'invalid');
    var w = input.weather || {};
    var st = input.stoppage || {};
    var d = {
      id: existing ? existing.id : input.id, projectId: p.id, date: input.date,
      weather: { am: WEATHER[w.am] ? w.am : '', pm: WEATHER[w.pm] ? w.pm : '' },
      workHours: cut(input.workHours, 40), manpower: rows_(input.manpower, ['trade', 'count'], 40), equipment: rows_(input.equipment, ['name', 'count'], 40),
      work: cut(input.work, 4000), materials: cut(input.materials, 2000),
      stoppage: { stopped: !!st.stopped, hours: Math.max(0, Math.min(24, +st.hours || 0)), reason: cut(st.reason, 500) },
      safety: cut(input.safety, 2000), instructions: cut(input.instructions, 2000), files: (input.files || []).slice(0, 30),
      createdBy: existing ? existing.createdBy : (actor.name || ''), createdByEmail: existing ? existing.createdByEmail : norm(actor.email),
      createdAt: existing ? existing.createdAt : nowIso, updatedAt: nowIso,
    };
    if (!d.work && !d.manpower.length && !d.stoppage.stopped) throw fail('กรุณาบันทึกงานที่ทำ จำนวนคนงาน หรือการหยุดงาน', 'invalid');
    return d;
  }
  function manpowerTotal(d) { return (d && d.manpower || []).reduce(function (a, r) { return a + (+r.count || 0); }, 0); }
  /** รายการในคลังแบบฟอร์ม/ระเบียบ (ผู้ดูแลระบบจัดการ) */
  function cleanLibrary(input, actor, nowIso, existing) {
    if (!actor || !actor.isAdmin) throw fail('เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการคลังแบบฟอร์มได้', 'forbidden');
    input = input || {};
    var title = cut(input.title, 200);
    if (!title) throw fail('กรุณาระบุชื่อเอกสาร', 'invalid');
    var url = cut(input.url, 1000);
    if (url && !/^https?:\/\/\S+$/i.test(url)) throw fail('ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://', 'invalid');
    var file = input.file && typeof input.file === 'object' ? {
      name: cut(input.file.name, 200), mime: cut(input.file.mime, 100), size: +input.file.size || 0,
      driveId: cut(input.file.driveId, 200), spDrive: cut(input.file.spDrive, 200), url: /^https?:\/\//i.test(input.file.url || '') ? cut(input.file.url, 1000) : '',
      localBlob: !!input.file.localBlob, id: cut(input.file.id, 80),
    } : null;
    if (!url && !(file && (file.driveId || file.url || file.localBlob))) throw fail('กรุณาแนบไฟล์หรือใส่ลิงก์', 'invalid');
    var uses = (Array.isArray(input.uses) ? input.uses : []).filter(function (u) { return LIB_USE[u]; });
    return {
      id: existing ? existing.id : input.id, title: title, kind: LIB_KINDS[input.kind] ? input.kind : 'form',
      workType: cut(input.workType, 120), category: cut(input.category, 120), uses: uses.length ? uses : ['all'],
      version: cut(input.version, 40), effective: /^\d{4}-\d{2}-\d{2}$/.test(String(input.effective || '')) ? input.effective : '',
      note: cut(input.note, 1000), url: url, file: file, active: input.active !== false, order: +input.order || 0,
      audience: input.audience === 'internal' ? 'internal' : 'all',
      updatedBy: actor.name || norm(actor.email), updatedAt: nowIso, createdAt: existing ? existing.createdAt : nowIso,
    };
  }
  /** รายการในคลังที่เกี่ยวกับงานนี้ — use: sub | daily | weekly | ... ; category = หมวดเรื่อง (ถ้ามี) */
  function libraryFor(items, use, category, workType) {
    return (items || []).filter(function (it) {
      if (it.active === false) return false;
      var u = it.uses || ['all'];
      if (u.indexOf(use) < 0 && u.indexOf('all') < 0) return false;
      if (it.category && category && it.category !== category) return false;
      if (it.category && !category && use === 'sub') return false;
      if (it.workType && workType && it.workType !== workType) return false;
      return true;
    });
  }

  // --- อีเมลรายงาน ---
  function pctTxt(r) { return r == null || isNaN(r) ? '–' : (r * 100).toFixed(1) + '%'; }
  function statusOf(prog, settings) {
    if (!prog || prog.actual == null || prog.plan == null) return { label: 'ไม่มีข้อมูล', color: '#737D90' };
    var diff = (prog.actual - prog.plan) * 100;
    var watch = settings && settings.watchThreshold != null && settings.watchThreshold !== '' ? +settings.watchThreshold : 2;
    var behind = settings && settings.behindThreshold != null && settings.behindThreshold !== '' ? +settings.behindThreshold : 5;
    if (prog.daysLeft != null && prog.daysLeft < 0 && prog.actual < 0.999) return { label: 'ล่าช้ากว่าแผน', color: '#C23B2E' };
    if (diff >= watch) return { label: 'เร็วกว่าแผน', color: '#1D7A50' };
    if (diff > -watch) return { label: 'ตามแผน', color: '#1D7A50' };
    if (diff > -behind) return { label: 'เฝ้าระวัง', color: '#B86E00' };
    return { label: 'ล่าช้ากว่าแผน', color: '#C23B2E' };
  }
  function box(title, inner) { return '<p style="margin:14px 0 4px"><b>' + esc(title) + '</b></p>' + inner; }
  function ul(items) { return items.length ? '<ul style="margin:0;padding-left:20px">' + items.map(function (x) { return '<li style="margin:2px 0">' + x + '</li>'; }).join('') + '</ul>' : '<p style="margin:0;color:#737D90">— ไม่มี —</p>'; }
  function table(head, rows) {
    return '<table style="border-collapse:collapse;width:100%;font-size:13px">' +
      (head.join('') ? '<tr>' + head.map(function (h) { return '<th style="text-align:left;border-bottom:2px solid #DADED7;padding:4px 6px;color:#46516A">' + esc(h) + '</th>'; }).join('') + '</tr>' : '') +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td style="border-bottom:1px solid #EEE;padding:4px 6px;vertical-align:top">' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
  }
  function pendingLines(p, subs, settings, nowIso) {
    return subs.filter(function (x) { return x.status === 'pending'; }).map(function (x) {
      var st = subSla(x, p, settings, nowIso);
      var who = currentApprovers(x, p).map(function (e) { return memberName(p, e); }).join(', ');
      var color = st.tone === 'late' ? '#C23B2E' : st.tone === 'warn' ? '#B86E00' : '#172238';
      return '<span style="color:' + color + '">' + esc(subNo(x) + ' ' + x.title) + '</span> — ' + esc((x.steps[x.currentStep || 0] || {}).label || '') + ' · ค้าง ' + Math.floor(st.age) + ' วัน' + (who ? ' · ' + esc(who) : '');
    });
  }
  function dailyHtml(d) {
    if (!d) return '';
    var w = [d.weather && WEATHER[d.weather.am] ? 'เช้า: ' + WEATHER[d.weather.am] : '', d.weather && WEATHER[d.weather.pm] ? 'บ่าย: ' + WEATHER[d.weather.pm] : ''].filter(Boolean).join(' · ');
    var rows = [['สภาพอากาศ', esc(w || '–')], ['คนงาน', esc(manpowerTotal(d) + ' คน') + (d.manpower.length ? ' <span style="color:#737D90">(' + esc(d.manpower.map(function (r) { return r.trade + ' ' + r.count; }).join(', ')) + ')</span>' : '')]];
    if (d.equipment.length) rows.push(['เครื่องจักร', esc(d.equipment.map(function (r) { return r.name + ' ' + r.count; }).join(', '))]);
    if (d.stoppage.stopped) rows.push(['หยุดงาน', '<b style="color:#C23B2E">' + esc((d.stoppage.hours ? d.stoppage.hours + ' ชม. ' : '') + (d.stoppage.reason || '')) + '</b>']);
    var html = table(['', ''], rows.map(function (r) { return ['<span style="color:#737D90">' + r[0] + '</span>', r[1]]; }));
    if (d.work) html += box('งานที่ดำเนินการ', '<div style="white-space:pre-wrap">' + esc(d.work) + '</div>');
    if (d.materials) html += box('วัสดุเข้าหน่วยงาน', '<div style="white-space:pre-wrap">' + esc(d.materials) + '</div>');
    if (d.safety) html += box('ความปลอดภัย/อุบัติเหตุ', '<div style="white-space:pre-wrap">' + esc(d.safety) + '</div>');
    if (d.instructions) html += box('ข้อสั่งการ/ข้อแนะนำต่อผู้รับจ้าง', '<div style="white-space:pre-wrap">' + esc(d.instructions) + '</div>');
    if ((d.files || []).length) html += '<p style="color:#737D90">รูปถ่าย/ไฟล์แนบ ' + d.files.length + ' ไฟล์ — เปิดดูในระบบ</p>';
    return html;
  }
  function linkFor(appUrl, p, tail) { return appUrl ? String(appUrl).split('#')[0] + '#/p/' + encodeURIComponent(p.id) + (tail || '') : ''; }
  /** รายงานประจำวัน — c = { p, daily, subs, reqs, settings, today, nowIso, appUrl } */
  function dailyReportEmail(c) {
    var p = c.p, code = p.code ? '[' + p.code + '] ' : '';
    var pend = pendingLines(p, c.subs || [], c.settings, c.nowIso);
    var overdue = (c.reqs || []).map(function (r) { return { r: r, st: reqStatus(r, p, c.subs || [], c.today) }; }).filter(function (x) { return x.st.overdueDays > 0; });
    var body = c.daily ? dailyHtml(c.daily) : '<p style="background:#FCEFD8;padding:10px 14px;border-radius:6px;color:#8A5D00"><b>ยังไม่ได้บันทึกรายงานประจำวันของวันนี้</b> — ผู้ควบคุมงานบันทึกได้ที่แท็บ "บันทึกความคืบหน้า → รายงานประจำวัน"</p>';
    body += box('เรื่องที่รอพิจารณา (' + pend.length + ')', ul(pend));
    if (overdue.length) body += box('เอกสารที่ต้องส่งเลยกำหนด', ul(overdue.map(function (x) { return esc(x.r.title) + ' — เลยกำหนด ' + x.st.overdueDays + ' วัน'; })));
    return {
      subject: code + 'รายงานประจำวัน ' + thaiDateTime(c.today, false) + ' — ' + p.name + (c.daily ? '' : ' (ยังไม่ได้บันทึก)'),
      html: layout('รายงานประจำวัน', '', [['โครงการ', esc(p.name)], ['วันที่', esc(thaiDateTime(c.today, false))], ['ผู้บันทึก', esc(c.daily ? c.daily.createdBy || c.daily.createdByEmail : '–')]], body, linkFor(c.appUrl, p, '/daily'), 'เปิดรายงานประจำวัน'),
    };
  }
  /** รายงานประจำสัปดาห์ — c = { p, progress:{actual, plan, prevActual}, daily:[], subs, reqs, meetings, updates:[], settings, from, to, nowIso, appUrl } */
  function weeklyReportEmail(c) {
    var p = c.p, code = p.code ? '[' + p.code + '] ' : '';
    var inWeek = function (iso) { var d = String(iso || '').slice(0, 10); return d >= c.from && d <= c.to; };
    var prog = c.progress || {};
    var st = statusOf(prog, c.settings);
    var days = (c.daily || []).filter(function (d) { return inWeek(d.date); });
    var stopped = days.filter(function (d) { return d.stoppage && d.stoppage.stopped; });
    var men = days.length ? Math.round(days.reduce(function (a, d) { return a + manpowerTotal(d); }, 0) / days.length) : 0;
    var subs = c.subs || [];
    var got = subs.filter(function (x) { return (x.history || []).some(function (h) { return (h.action === 'submit' || h.action === 'resubmit') && inWeek(h.at); }); });
    var closed = subs.filter(function (x) { return x.status !== 'pending' && inWeek(x.closedAt); });
    var pend = pendingLines(p, subs, c.settings, c.nowIso);
    var reqs = (c.reqs || []).map(function (r) { return { r: r, st: reqStatus(r, p, subs, c.to) }; }).filter(function (x) { return x.st.overdueDays > 0 || (x.st.leftDays != null && x.st.leftDays <= 14 && (x.st.state === 'none' || x.st.state === 'rejected')); });
    var issues = (c.updates || []).filter(function (u) { return inWeek(u.date) && u.issues; }).map(function (u) { return esc(thaiDateTime(u.date, false) + ': ' + u.issues); });
    var rows = [
      ['ผลงานสะสม', '<b>' + esc(pctTxt(prog.actual)) + '</b> — แผน ' + esc(pctTxt(prog.plan)) + ' <span style="color:' + st.color + '">(' + esc(st.label) + ')</span>'],
      ['เพิ่มขึ้นในสัปดาห์', esc(prog.prevActual != null && prog.actual != null ? '+' + ((prog.actual - prog.prevActual) * 100).toFixed(1) + '%' : '–')],
      ['รายงานประจำวัน', esc(days.length + ' วัน · คนงานเฉลี่ย ' + men + ' คน/วัน' + (stopped.length ? ' · หยุดงาน ' + stopped.length + ' วัน' : ''))],
      ['เรื่องขออนุมัติ', esc('รับเข้า ' + got.length + ' · ปิดแล้ว ' + closed.length + ' · ค้างพิจารณา ' + pend.length)],
    ];
    var body = table(['', ''], rows.map(function (r) { return ['<span style="color:#737D90">' + r[0] + '</span>', r[1]]; }));
    if (stopped.length) body += box('การหยุดงาน', ul(stopped.map(function (d) { return esc(thaiDateTime(d.date, false) + ' — ' + (d.stoppage.reason || 'ไม่ระบุสาเหตุ')); })));
    if (issues.length) body += box('ปัญหาและอุปสรรค', ul(issues));
    body += box('เรื่องที่รอพิจารณา', ul(pend));
    if (reqs.length) body += box('เอกสารที่ต้องส่ง (เลยกำหนด/ภายใน 14 วัน)', ul(reqs.map(function (x) { return esc(x.r.title) + ' — ' + (x.st.overdueDays ? '<b style="color:#C23B2E">เลยกำหนด ' + x.st.overdueDays + ' วัน</b>' : 'ครบกำหนด ' + esc(thaiDateTime(x.st.due, false))); })));
    var next = (c.meetings || []).filter(function (m) { return m.status === 'scheduled' && m.startAt.slice(0, 10) > c.to; }).slice(0, 5);
    if (next.length) body += box('ประชุมที่กำลังจะถึง', ul(next.map(function (m) { return esc(m.title + ' — ' + meetingWhen(m)); })));
    return {
      subject: code + 'รายงานประจำสัปดาห์ ' + thaiDateTime(c.from, false) + '–' + thaiDateTime(c.to, false) + ' — ' + p.name + ' (' + pctTxt(prog.actual) + ')',
      html: layout('รายงานประจำสัปดาห์', 'สรุปการปฏิบัติงานของผู้รับจ้างและผลการควบคุมงาน สำหรับคณะกรรมการตรวจรับพัสดุและผู้เกี่ยวข้อง', [['โครงการ', esc(p.name)], ['ช่วงวันที่', esc(thaiDateTime(c.from, false) + ' – ' + thaiDateTime(c.to, false))], ['ผู้รับจ้าง', esc(p.contractor || '–')]], body, linkFor(c.appUrl, p), 'เปิดโครงการ'),
    };
  }
  /** รายงานความคืบหน้าประจำเดือน — c = { rows:[{ p, progress, pending, late, overdueReqs, closed, avgDays, daysLeft }], month:'YYYY-MM', settings, appUrl, title } */
  function monthlyReportEmail(c) {
    var rows = c.rows || [];
    var behind = rows.filter(function (r) { return statusOf(r.progress, c.settings).label === 'ล่าช้ากว่าแผน'; }).length;
    var head = ['โครงการ', 'ผลงาน', 'แผน', 'ต่าง', 'สถานะ', 'เรื่องค้าง', 'ปิดเรื่อง (เฉลี่ยวัน)'];
    var tbl = table(head, rows.map(function (r) {
      var st = statusOf(r.progress, c.settings);
      var diff = r.progress && r.progress.actual != null && r.progress.plan != null ? ((r.progress.actual - r.progress.plan) * 100).toFixed(1) : '–';
      return [
        '<b>' + esc(r.p.code || '') + '</b> ' + esc(r.p.name) + (r.daysLeft != null ? '<br><span style="color:#737D90;font-size:12px">' + (r.daysLeft >= 0 ? 'เหลือ ' + r.daysLeft + ' วัน' : 'เกินสัญญา ' + (-r.daysLeft) + ' วัน') + '</span>' : ''),
        esc(pctTxt(r.progress && r.progress.actual)), esc(pctTxt(r.progress && r.progress.plan)),
        '<span style="color:' + st.color + '">' + esc(diff) + '</span>', '<span style="color:' + st.color + '">' + esc(st.label) + '</span>',
        esc(String(r.pending || 0)) + (r.late ? ' <span style="color:#C23B2E">(แดง ' + r.late + ')</span>' : '') + (r.overdueReqs ? '<br><span style="color:#C23B2E;font-size:12px">เอกสารเลยกำหนด ' + r.overdueReqs + '</span>' : ''),
        esc(String(r.closed || 0)) + (r.avgDays != null ? ' (' + r.avgDays.toFixed(1) + ')' : ''),
      ];
    }));
    var mm = String(c.month || '');
    var monthTxt = mm ? THAI_MONTHS[(+mm.slice(5, 7) || 1) - 1] + ' ' + String(+mm.slice(0, 4) + 543) : '';
    var link = c.appUrl ? String(c.appUrl).split('#')[0] + '#/summary' : '';
    return {
      subject: (c.title || 'รายงานความคืบหน้าประจำเดือน') + ' ' + monthTxt + ' — ' + rows.length + ' โครงการ' + (behind ? ' (ล่าช้า ' + behind + ')' : ''),
      html: layout(c.title || 'รายงานความคืบหน้าประจำเดือน', 'ผลงาน ณ วันที่บันทึกความคืบหน้าล่าสุดของแต่ละโครงการ', [['เดือน', esc(monthTxt)], ['จำนวนโครงการ', esc(rows.length + ' โครงการ' + (behind ? ' · ล่าช้ากว่าแผน ' + behind : ''))]], tbl, link, 'เปิดสรุปผู้บริหาร'),
    };
  }
  /** ผู้รับรายงาน: daily = ระดับ "ทุกเรื่อง" · weekly/monthly = "ทุกเรื่อง" + "ผลการพิจารณา" + คณะกรรมการทุกคน (ระเบียบฯ ข้อ 176/178) */
  function reportRecipients(p, kind, withDaily) {
    var all = members(p);
    return uniq(all.filter(function (m) {
      var lv = levelOf(m);
      if (m.role === 'contractor') return false;
      // ยังไม่ได้บันทึกรายงานประจำวัน = งานที่ต้องทำ จึงเตือนผู้ควบคุมงานและเจ้าของโครงการเสมอ
      if (kind === 'daily' && !withDaily) return m.role === 'supervisor' || m.role === 'owner';
      if (lv === 'none') return false;
      if (kind === 'daily') return lv === 'all';
      return lv === 'all' || lv === 'decisions' || m.role === 'committee';
    }).map(function (m) { return m.email; }));
  }

  /** รายงานประจำวันเป็นบันทึกภายในของผู้ควบคุมงาน — ผู้รับจ้างไม่เห็น */
  function canSeeDaily(p, user) { return canView(p, user) && roleOf(p, user && user.email) !== 'contractor'; }
  /** เอกสาร "เฉพาะเจ้าหน้าที่" ไม่แสดงต่อผู้ที่เป็นผู้รับจ้างอย่างเดียว */
  function canSeeLibrary(item, user, projects) {
    if (!item || !user) return false;
    if (user.isAdmin) return true;
    if (item.active === false) return false;
    if (item.audience !== 'internal') return true;
    if (user.isExec || user.isDept) return true;
    return (projects || []).some(function (p) { return insider(p, user); });
  }
  function projectActive(p, today) {
    if (!p || ['done', 'cancelled', 'paused', 'planning'].indexOf(p.status) >= 0) return false;
    return !p.startDate || p.startDate <= today;
  }
  function dowOf(iso) { return new Date(String(iso).slice(0, 10) + 'T00:00:00Z').getUTCDay(); }
  var WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  /** ค่าตั้งเวลาอีเมลอัตโนมัติ (มีค่าเริ่มต้นเสมอ) */
  function jobSettings(settings) {
    settings = settings || {};
    var hr = function (v, d) { var n = Math.round(+v); return v === '' || v == null || !isFinite(n) || n < 0 || n > 23 ? d : n; };
    var wd = Math.round(+settings.reportWeekday);
    return {
      reminderHour: hr(settings.reminderHour, 8), reportHour: hr(settings.reportHour, 17),
      reportWeekday: settings.reportWeekday === '' || settings.reportWeekday == null || !(wd >= 0 && wd <= 6) ? 5 : wd,
      reminders: settings.autoReminders !== false, daily: settings.reportDaily !== false,
      weekly: settings.reportWeekly !== false, monthly: settings.reportMonthly !== false,
    };
  }
  /** งานที่ถึงเวลาส่ง — local = { date, hour } (เวลาประเทศไทย) ; log = { reminders, daily, weekly, monthly } วันที่/เดือนที่ส่งล่าสุด */
  function dueJobs(settings, local, log) {
    var j = jobSettings(settings);
    log = log || {};
    var out = [];
    var day = +String(local.date).slice(8, 10);
    if (j.reminders && local.hour >= j.reminderHour && log.reminders !== local.date) out.push('reminders');
    if (j.daily && local.hour >= j.reportHour && log.daily !== local.date) out.push('daily');
    if (j.weekly && dowOf(local.date) === j.reportWeekday && local.hour >= j.reportHour && log.weekly !== local.date) out.push('weekly');
    if (j.monthly && day <= 3 && local.hour >= j.reminderHour && log.monthly !== prevMonth(local.date)) out.push('monthly');
    return out;
  }
  function prevMonth(iso) {
    var y = +String(iso).slice(0, 4), m = +String(iso).slice(5, 7) - 1;
    if (m < 1) { m = 12; y--; }
    return y + '-' + (m < 10 ? '0' : '') + m;
  }
  function monthEnd(month) {
    var y = +month.slice(0, 4), m = +month.slice(5, 7);
    var d = new Date(Date.UTC(y, m, 0));
    return d.toISOString().slice(0, 10);
  }
  var MSG = function (to, kind, event, pid, m) { return { to: to, kind: kind, event: event, projectId: pid || '', subject: m.subject, html: m.html }; };

  /**
   * อีเมลเตือนงานค้างประจำวัน (ใช้ทั้ง Apps Script และหน้าเว็บ)
   * c = { projects, subs, reqs, meetings, settings, nowIso, today, appUrl }
   */
  function reminderPlan(c) {
    var out = [];
    var settings = c.settings || {};
    var tomorrow = addDaysIso(c.today, 1);
    (c.projects || []).forEach(function (p) {
      if (p.status === 'done' || p.status === 'cancelled') return;
      var subs = (c.subs || []).filter(function (s) { return s.projectId === p.id; });
      var sla = slaSettings(p, settings);
      // เรื่องค้างพิจารณา: เตือนเมื่อครบ warn วัน, late วัน, เลยกำหนดวันแรก และทุก 7 วันหลังจากนั้น
      var byApprover = {};
      subs.forEach(function (s) {
        if (s.status !== 'pending') return;
        var st = subSla(s, p, settings, c.nowIso);
        var age = Math.floor(st.age);
        var due = st.dueAt && st.overdue > 0 && st.overdue <= 1;
        var hit = age === sla.warn || age === sla.late || (age > sla.late && (age - sla.late) % 7 === 0) || due;
        if (!hit) return;
        currentApprovers(s, p).forEach(function (e) { (byApprover[e] = byApprover[e] || []).push(s); });
      });
      Object.keys(byApprover).forEach(function (e) {
        out.push(MSG([e], 'action', 'reminder', p.id, reminderEmail(p, byApprover[e], [], c.appUrl, settings, c.nowIso)));
      });
      // ผู้รับจ้าง: เอกสารที่ต้องส่ง (ก่อนครบกำหนด 7, 3, 1 วัน วันครบกำหนด เลยกำหนดวันแรก และทุก 7 วัน) + เรื่องที่ถูกตีกลับนาน 7 และ 14 วัน
      var due = [];
      (c.reqs || []).filter(function (r) { return r.projectId === p.id; }).forEach(function (r) {
        var st = reqStatus(r, p, subs, c.today);
        if (!st.due || (st.state !== 'none' && st.state !== 'rejected')) return;
        var hit = [7, 3, 1, 0].indexOf(st.leftDays) >= 0 || st.overdueDays === 1 || (st.overdueDays > 1 && st.overdueDays % 7 === 0);
        if (hit) due.push({ req: r, st: st });
      });
      var contractors = members(p).filter(function (m) { return m.role === 'contractor' && levelOf(m) !== 'none'; }).map(function (m) { return m.email; });
      var fixBy = {};
      subs.forEach(function (s) {
        if (s.status !== 'rejected' || !s.closedAt) return;
        var d = daysBetween(String(s.closedAt).slice(0, 10), c.today);
        if (d === 7 || d === 14) (fixBy[norm(s.submittedBy)] = fixBy[norm(s.submittedBy)] || []).push(s);
      });
      if (due.length && contractors.length) {
        var fixAll = contractors.reduce(function (a, e) { return a.concat(fixBy[e] || []); }, []);
        contractors.forEach(function (e) { delete fixBy[e]; });
        out.push(MSG(contractors, 'action', 'reminder', p.id, reminderEmail(p, [], due, c.appUrl, settings, c.nowIso, fixAll)));
      }
      Object.keys(fixBy).forEach(function (e) {
        out.push(MSG([e], 'action', 'reminder', p.id, reminderEmail(p, [], [], c.appUrl, settings, c.nowIso, fixBy[e])));
      });
    });
    // ประชุมพรุ่งนี้ และงานที่มอบหมายจากการประชุมที่เลยกำหนด
    var byOwner = {};
    (c.meetings || []).forEach(function (m) {
      var p = m.projectId ? (c.projects || []).filter(function (x) { return x.id === m.projectId; })[0] : null;
      if (m.projectId && !p) return;
      if (m.status === 'scheduled' && String(m.startAt).slice(0, 10) === tomorrow && (m.attendees || []).length) {
        out.push(MSG(m.attendees, 'action', 'meeting-remind', m.projectId, meetingEmail('remind', m, p, { name: '', email: '' }, c.appUrl)));
      }
      (m.actions || []).forEach(function (a) {
        if (a.done || !a.due || !a.owner || m.status === 'cancelled') return;
        var late = daysBetween(a.due, c.today);
        if (late === 1 || (late > 1 && late % 7 === 0)) (byOwner[a.owner] = byOwner[a.owner] || []).push({ m: m, a: a, p: p, late: late });
      });
    });
    Object.keys(byOwner).forEach(function (e) {
      var items = byOwner[e];
      var link = c.appUrl ? String(c.appUrl).split('#')[0] + '#/inbox' : '';
      out.push(MSG([e], 'action', 'action-overdue', items[0].m.projectId, {
        subject: 'เตือน: งานจากการประชุมเลยกำหนด ' + items.length + ' รายการ',
        html: layout('งานจากการประชุมที่เลยกำหนด', 'งานที่ได้รับมอบหมายต่อไปนี้ยังไม่ได้ทำเครื่องหมายว่าเสร็จ', [], ul(items.map(function (x) {
          return esc(x.a.text) + ' <span style="color:#737D90">— ' + esc((x.p ? (x.p.code || x.p.name) + ' · ' : '') + x.m.title) + '</span> <b style="color:#C23B2E">เลยกำหนด ' + x.late + ' วัน</b>';
        })), link, 'เปิดงานของฉัน'),
      }));
    });
    return out;
  }

  /** รายงานประจำวัน — c = { projects, daily, subs, reqs, settings, nowIso, today, appUrl } */
  function dailyPlan(c) {
    var out = [];
    var sunday = dowOf(c.today) === 0;
    (c.projects || []).forEach(function (p) {
      if (!projectActive(p, c.today)) return;
      var d = (c.daily || []).filter(function (x) { return x.projectId === p.id && x.date === c.today; })[0] || null;
      if (!d && sunday) return;
      var to = reportRecipients(p, 'daily', !!d).filter(function (e) { return !d || e !== norm(d.createdByEmail); });
      if (!to.length) return;
      var m = dailyReportEmail({ p: p, daily: d, subs: (c.subs || []).filter(function (s) { return s.projectId === p.id; }), reqs: (c.reqs || []).filter(function (r) { return r.projectId === p.id; }), settings: c.settings, today: c.today, nowIso: c.nowIso, appUrl: c.appUrl });
      out.push(MSG(to, d ? 'report' : 'action', d ? 'report-daily' : 'daily-missing', p.id, m));
    });
    return out;
  }

  /** รายงานประจำสัปดาห์ — c เพิ่ม progress: { pid: { actual, plan, prevActual } }, updates, meetings */
  function weeklyPlan(c) {
    var out = [];
    var from = addDaysIso(c.today, -6);
    (c.projects || []).forEach(function (p) {
      if (!projectActive(p, c.today)) return;
      var to = reportRecipients(p, 'weekly');
      if (!to.length) return;
      var by = function (t) { return (c[t] || []).filter(function (x) { return x.projectId === p.id; }); };
      var m = weeklyReportEmail({ p: p, progress: (c.progress || {})[p.id], daily: by('daily'), subs: by('subs'), reqs: by('reqs'), meetings: by('meetings'), updates: by('updates'), settings: c.settings, from: from, to: c.today, nowIso: c.nowIso, appUrl: c.appUrl });
      out.push(MSG(to, 'report', 'report-weekly', p.id, m));
    });
    return out;
  }

  /** แถวสรุปของโครงการในรายงานประจำเดือน */
  function monthRow(p, progress, subs, reqs, settings, month, nowIso) {
    var end = monthEnd(month);
    var mine = subs.filter(function (s) { return s.projectId === p.id; });
    var pending = mine.filter(function (s) { return s.status === 'pending'; });
    var closed = mine.filter(function (s) { return (s.status === 'approved' || s.status === 'rejected') && String(s.closedAt).slice(0, 7) === month; });
    var avg = closed.length ? closed.reduce(function (a, s) { return a + Math.max(0, (new Date(s.closedAt) - new Date(s.submittedAt)) / DAY); }, 0) / closed.length : null;
    return {
      p: p, progress: progress || null, pending: pending.length,
      late: pending.filter(function (s) { return subSla(s, p, settings, nowIso).tone === 'late'; }).length,
      overdueReqs: reqs.filter(function (r) { return r.projectId === p.id && reqStatus(r, p, mine, end).overdueDays > 0; }).length,
      closed: closed.length, avgDays: avg, daysLeft: p.endDate ? daysBetween(end, p.endDate) : null,
    };
  }
  /** รายงานประจำเดือน — c = { projects, subs, reqs, progress (ณ สิ้นเดือน), settings, month, nowIso, appUrl } */
  function monthlyPlan(c) {
    var s = c.settings || {};
    var end = monthEnd(c.month);
    var start = c.month + '-01';
    var projects = (c.projects || []).filter(function (p) {
      if (p.status === 'cancelled' || p.status === 'planning') return false;
      if (p.startDate && p.startDate > end) return false;
      return p.status !== 'done' || String(p.updatedAt || '').slice(0, 10) >= start;
    });
    if (!projects.length) return [];
    var rows = projects.map(function (p) { return monthRow(p, (c.progress || {})[p.id], c.subs || [], c.reqs || [], s, c.month, c.nowIso); })
      .sort(function (a, b) { return String(a.p.code || a.p.name).localeCompare(String(b.p.code || b.p.name)); });
    var emails = function (v) { return parseList(v).filter(function (x) { return x.charAt(0) !== '@' && validEmail(x); }); };
    var dept = uniq(emails(s.admins).concat(emails(s.executives), emails(s.deptMembers), emails(s.reportMonthlyTo)));
    var out = [];
    if (dept.length) out.push(MSG(dept, 'report', 'report-monthly', '', monthlyReportEmail({ rows: rows, month: c.month, settings: s, appUrl: c.appUrl })));
    var byOwner = {};
    rows.forEach(function (r) {
      var o = norm(r.p.ownerEmail);
      if (!o || dept.indexOf(o) >= 0) return;
      (byOwner[o] = byOwner[o] || []).push(r);
    });
    Object.keys(byOwner).forEach(function (o) {
      out.push(MSG([o], 'report', 'report-monthly', byOwner[o].length === 1 ? byOwner[o][0].p.id : '', monthlyReportEmail({ rows: byOwner[o], month: c.month, settings: s, appUrl: c.appUrl, title: 'รายงานความคืบหน้าประจำเดือน (โครงการของคุณ)' })));
    });
    return out;
  }

  root.PTRules = {
    ROLES: ROLES, MEMBER_ROLES: MEMBER_ROLES, OWNER_ACTS: OWNER_ACTS, PERMS: PERMS, PERM_KEYS: PERM_KEYS,
    MAX_SEAT: MAX_SEAT, MAX_TITLE: MAX_TITLE, MAX_DETAIL: MAX_DETAIL, MAX_COMMENT: MAX_COMMENT, STEP_MODES: STEP_MODES, VOTE_STATUS: VOTE_STATUS, seatLabel: seatLabel, seatOf: seatOf, committeeSeats: committeeSeats, stepMode: stepMode,
    voters: voters, voteChair: voteChair, tally: tally, ballotOf: ballotOf, optionLabel: optionLabel,
    canVote: canVote, canOpenVote: canOpenVote, canCloseVote: canCloseVote, cleanVote: cleanVote, currentStep: currentStep,
    DEFAULT_ROLE_PERMS: DEFAULT_ROLE_PERMS, NOTIFY: NOTIFY, DEFAULT_NOTIFY: DEFAULT_NOTIFY,
    DEFAULT_WORKFLOWS: DEFAULT_WORKFLOWS, REQUIRED_TEMPLATE: REQUIRED_TEMPLATE, DUE_TYPES: DUE_TYPES,
    SUB_STATUS: SUB_STATUS, ACTIONS: ACTIONS,
    norm: norm, validEmail: validEmail, listHas: listHas, parseList: parseList, subNo: subNo,
    members: members, roleOf: roleOf, memberName: memberName, permsOf: permsOf, isOwner: isOwner,
    canView: canView, can: can, canCreateProject: canCreateProject,
    workflows: workflows, workflowFor: workflowFor, stepLabel: stepLabel, approversFor: approversFor, ownerActsAs: ownerActsAs,
    currentApprovers: currentApprovers, canDecide: canDecide, canComment: canComment, canResubmit: canResubmit, canCancel: canCancel,
    createSubmission: createSubmission, act: act, nextNo: nextNo,
    slaSettings: slaSettings, subSla: subSla,
    reqDueText: reqDueText, reqDueDate: reqDueDate, reqStatus: reqStatus,
    recipients: recipients, subEmail: subEmail, mailPlan: mailPlan, progressEmail: progressEmail, inviteEmail: inviteEmail, reminderEmail: reminderEmail,
    thaiDateTime: thaiDateTime, esc: esc, addDaysIso: addDaysIso, daysBetween: daysBetween,
    isDept: isDept, CHANNELS: CHANNELS, AUDIENCES: AUDIENCES, MEETING_STATUS: MEETING_STATUS, MAX_MSG: MAX_MSG,
    canReadChannel: canReadChannel, canPostChannel: canPostChannel, canSeeMeeting: canSeeMeeting, canCreateMeeting: canCreateMeeting,
    canEditMeeting: canEditMeeting, canToggleAction: canToggleAction, newMessage: newMessage, canDeleteMessage: canDeleteMessage,
    cleanMeeting: cleanMeeting, toggleAction: toggleAction, meetingWhen: meetingWhen, meetingEmail: meetingEmail, validLocalDT: validLocalDT,
    WEATHER: WEATHER, LIB_KINDS: LIB_KINDS, LIB_USE: LIB_USE, cleanDaily: cleanDaily, manpowerTotal: manpowerTotal, cleanLibrary: cleanLibrary, libraryFor: libraryFor,
    statusOf: statusOf, dailyReportEmail: dailyReportEmail, weeklyReportEmail: weeklyReportEmail, monthlyReportEmail: monthlyReportEmail, reportRecipients: reportRecipients,
    canSeeDaily: canSeeDaily, canSeeLibrary: canSeeLibrary, projectActive: projectActive, WEEKDAYS: WEEKDAYS, jobSettings: jobSettings, dueJobs: dueJobs,
    prevMonth: prevMonth, monthEnd: monthEnd, reminderPlan: reminderPlan, dailyPlan: dailyPlan, weeklyPlan: weeklyPlan, monthRow: monthRow, monthlyPlan: monthlyPlan,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
