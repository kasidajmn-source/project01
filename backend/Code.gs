/**
 * ระบบติดตามโครงการ — Backend (Google Apps Script) เวอร์ชัน 1.0.5
 * ---------------------------------------------------------------
 * ทำหน้าที่เป็น API ให้หน้าเว็บบน GitHub Pages
 *  - ข้อมูล (โครงการ, BOQ, บันทึกความคืบหน้า, รายชื่อไฟล์, เรื่องขออนุมัติ) เก็บใน Google Sheet
 *  - ไฟล์เอกสารเก็บใน Google Drive แยกโฟลเดอร์ตามโครงการ > หมวดเอกสาร
 *  - ผู้ใช้เข้าสู่ระบบด้วยอีเมล + รหัสยืนยัน 6 หลักที่ส่งทางอีเมล (ไม่ต้องมีบัญชี Google)
 *  - ตรวจสิทธิ์ทุกคำสั่งตามบทบาทในโครงการ และส่งอีเมลแจ้งเตือนผู้เกี่ยวข้อง
 *
 * วิธีติดตั้ง (ดูรายละเอียดใน README.md)
 *  1) สร้าง Google Sheet ใหม่ > ส่วนขยาย > Apps Script > วางโค้ดนี้แทนของเดิม
 *  2) (ไม่บังคับ) ใส่ลิงก์หรือ ID โฟลเดอร์ Google Drive ใน CONFIG.ROOT_FOLDER_ID
 *     และใส่ลิงก์หน้าเว็บ (GitHub Pages) ใน CONFIG.APP_URL เพื่อให้ลิงก์ในอีเมลถูกต้อง
 *  3) เลือกฟังก์ชัน setup แล้วกด "เรียกใช้" > อนุญาตสิทธิ์ > ดูรหัสเข้าใช้งานใน "บันทึกการดำเนินการ"
 *  4) ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > เว็บแอป
 *     ดำเนินการในฐานะ: ฉัน / ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน
 *  5) นำ URL ที่ลงท้ายด้วย /exec และรหัสเข้าใช้งาน ไปใส่ในหน้า "ตั้งค่า" ของเว็บ
 *
 * อัปเดตจากเวอร์ชันก่อน: วางโค้ดนี้แทนของเดิม > รัน setup อีกครั้ง (สร้างชีตใหม่ อนุญาตสิทธิ์ และตั้งเวลาส่งอีเมลอัตโนมัติ)
 *  > จัดการการทำให้ใช้งานได้ > แก้ไข > เวอร์ชันใหม่ (URL เดิมใช้ต่อได้)
 *
 * อีเมลอัตโนมัติ (1.0.5): ตัวตั้งเวลา hourlyJobs ทำงานทุกชั่วโมง แล้วส่งตามเวลาที่ผู้ดูแลตั้งในหน้า "ตั้งค่า > อีเมลอัตโนมัติ"
 *  - เตือนงานค้าง (ผู้พิจารณา / ผู้รับจ้าง / ประชุมพรุ่งนี้ / งานจากการประชุมที่เลยกำหนด)  ทุกวัน 08:00 น.
 *  - รายงานประจำวัน 17:00 น. · รายงานประจำสัปดาห์ ทุกวันศุกร์ 17:00 น. · รายงานประจำเดือน วันที่ 1 ของเดือน
 */

var CONFIG = {
  // ลิงก์หรือ ID โฟลเดอร์ Google Drive ที่ใช้เก็บไฟล์ทุกโครงการ (เว้นว่าง = ให้ setup สร้างให้)
  ROOT_FOLDER_ID: '',
  // รหัสเข้าใช้งานของทีม (เว้นว่าง = ให้ setup สร้างให้ และเก็บใน Script Properties)
  ACCESS_KEY: '',
  // true = ตั้งไฟล์ที่อัปโหลดเป็น "ทุกคนที่มีลิงก์ดูได้" (ไม่แนะนำสำหรับเอกสารภายใน)
  LINK_SHARING: false,
  // ขนาดไฟล์สูงสุดต่อการอัปโหลดผ่านเว็บ (MB) — Apps Script รับข้อมูลได้ราว 50 MB ต่อคำขอ
  MAX_UPLOAD_MB: 25,

  // ---------- ผู้ใช้ สิทธิ์ และอีเมล (1.0.1) ----------
  // อีเมลผู้ดูแลระบบเพิ่มเติม คั่นด้วยจุลภาค (เจ้าของสคริปต์เป็นผู้ดูแลระบบเสมอ)
  ADMIN_EMAILS: '',
  // ลิงก์หน้าเว็บของระบบ เช่น https://ชื่อ.github.io/project-tracker/ (ใช้ในลิงก์ของอีเมล)
  APP_URL: '',
  // ส่งอีเมลแจ้งเตือนเรื่องขออนุมัติ/ความคืบหน้า (รหัสเข้าสู่ระบบส่งเสมอ)
  SEND_EMAIL: true,
  // แชร์โฟลเดอร์โครงการใน Google Drive ให้สมาชิก (ดูอย่างเดียว) เพื่อให้เปิดไฟล์ได้
  SHARE_DRIVE_WITH_MEMBERS: true,
  // อายุการเข้าสู่ระบบ (วัน)
  SESSION_DAYS: 30,
  // ชื่อผู้ส่งในอีเมล
  MAIL_SENDER_NAME: 'ระบบติดตามโครงการ',
  // เวลาส่งอีเมลเตือนงานค้างรายวัน (ชั่วโมง 0–23) — ค่าเริ่มต้น ถ้าผู้ดูแลยังไม่ได้ตั้งในหน้า "ตั้งค่า"
  REMINDER_HOUR: 8,
  // เว้นโควตาอีเมลไว้สำหรับการแจ้งเตือนเรื่องขออนุมัติ (รายงานอัตโนมัติจะไม่ใช้โควตาส่วนนี้)
  MAIL_RESERVE: 15,
};

var VERSION = '1.0.5';
var LIBRARY_FOLDER = 'คลังแบบฟอร์มและระเบียบ';
var DAILY_FILE_CATEGORY = 'รูปถ่ายความคืบหน้า';
var SUB_FILE_CATEGORY = 'เอกสารแนบเรื่องขออนุมัติ';
var CHAT_FILE_CATEGORY = 'ไฟล์จากห้องสนทนา';

var SCHEMA = {
  Projects: ['id', 'code', 'name', 'type', 'tags', 'status', 'owner', 'manager', 'contractor', 'contractNo', 'location',
    'startDate', 'endDate', 'contractValue', 'description', 'progressMethod', 'priceBasis', 'allowOver', 'planMode',
    'planPoints', 'docCategories', 'folderId', 'folderUrl', 'createdBy', 'createdAt', 'updatedAt',
    'ownerEmail', 'ownerName', 'ownerRole', 'members', 'rolePerms', 'workflow', 'slaWarnDays', 'slaLateDays', 'ownerSeat'],
  BOQ: ['id', 'projectId', 'group', 'no', 'desc', 'unit', 'qty', 'mat', 'labor', 'weight', 'order', 'ps', 'pe'],
  Updates: ['id', 'projectId', 'date', 'week', 'entries', 'manualPct', 'note', 'issues', 'createdBy', 'createdAt', 'updatedAt', 'createdByEmail'],
  Files: ['id', 'projectId', 'category', 'name', 'mime', 'size', 'driveId', 'url', 'note', 'updateId', 'uploadedBy', 'uploadedAt', 'subId', 'uploadedByEmail'],
  Submissions: ['id', 'projectId', 'no', 'rev', 'category', 'title', 'detail', 'requiredId', 'files', 'submittedBy', 'submittedByName',
    'submittedAt', 'status', 'currentStep', 'stepStartedAt', 'steps', 'history', 'closedAt', 'updatedAt', 'vote'],
  Required: ['id', 'projectId', 'title', 'category', 'dueType', 'dueDays', 'dueDate', 'note', 'order'],
  Messages: ['id', 'projectId', 'channel', 'refId', 'by', 'byName', 'at', 'text', 'files', 'deleted', 'editedAt'],
  Meetings: ['id', 'projectId', 'audience', 'title', 'startAt', 'durationMin', 'place', 'link', 'attendees', 'agenda', 'minutes', 'actions',
    'status', 'createdBy', 'createdByName', 'createdAt', 'updatedAt', 'updatedBy', 'updatedByName'],
  Daily: ['id', 'projectId', 'date', 'weather', 'workHours', 'manpower', 'equipment', 'work', 'materials', 'stoppage', 'safety', 'instructions',
    'files', 'createdBy', 'createdByEmail', 'createdAt', 'updatedAt'],
  Library: ['id', 'title', 'kind', 'workType', 'category', 'uses', 'version', 'effective', 'note', 'url', 'file', 'active', 'order', 'audience',
    'updatedBy', 'updatedAt', 'createdAt'],
  Settings: ['key', 'value'],
  Users: ['email', 'name', 'lastLoginAt', 'createdAt'],
  MailLog: ['at', 'to', 'subject', 'event', 'projectId', 'ok', 'error'],
};
var JSON_FIELDS = {
  Projects: ['tags', 'planPoints', 'docCategories', 'members', 'rolePerms', 'workflow'],
  Updates: ['entries'], Settings: ['value'], Submissions: ['files', 'steps', 'history', 'vote'],
  Messages: ['files'], Meetings: ['attendees', 'actions'],
  Daily: ['weather', 'manpower', 'equipment', 'stoppage', 'files'], Library: ['uses', 'file'],
};
var NUM_FIELDS = {
  Projects: ['contractValue', 'slaWarnDays', 'slaLateDays'], BOQ: ['qty', 'mat', 'labor', 'weight', 'order', 'ps', 'pe'],
  Updates: ['week', 'manualPct'], Files: ['size'], Submissions: ['no', 'rev', 'currentStep'], Required: ['dueDays', 'order'],
  Meetings: ['durationMin'], Library: ['order'],
};
var BOOL_FIELDS = { Projects: ['allowOver'], MailLog: ['ok'], Messages: ['deleted'], Library: ['active'] };
var DATE_FIELDS = { Projects: ['startDate', 'endDate'], Updates: ['date'], Required: ['dueDate'], Daily: ['date'], Library: ['effective'] };
// ตารางที่ไม่มีคอลัมน์ id (ใช้คีย์อื่น)
var KEY_FIELD = { Settings: 'key', Users: 'email' };

// คำสั่งที่เรียกได้โดยยังไม่เข้าสู่ระบบ และคำสั่งที่ไม่ต้องล็อก
var PUBLIC_ACTIONS = ['ping', 'requestOtp', 'verifyOtp'];
var READ_ONLY = ['ping', 'getAll', 'requestOtp'];
// ฟิลด์ที่เฉพาะเจ้าของโครงการเปลี่ยนได้
var OWNER_FIELDS = ['ownerRole', 'ownerSeat', 'members', 'rolePerms', 'workflow', 'slaWarnDays', 'slaLateDays'];

function R_() { return globalThis.PTRules; }

// =============================================================
// จุดเข้า Web app
// =============================================================
function doGet() {
  return json_({ ok: true, data: { app: 'project-tracker', version: VERSION, message: 'API พร้อมใช้งาน — เปิดหน้าเว็บของระบบเพื่อใช้งาน' } });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' });
  }
  var key = accessKey_();
  if (key && body.key !== key) {
    return json_({ ok: false, code: 'auth', error: 'รหัสเข้าใช้งานไม่ถูกต้อง — ตรวจสอบรหัสในหน้าตั้งค่า' });
  }
  var fn = ACTIONS[body.action];
  if (!fn) return json_({ ok: false, error: 'ไม่รู้จักคำสั่ง: ' + body.action });

  var lock = null;
  try {
    if (READ_ONLY.indexOf(body.action) < 0) {
      lock = LockService.getScriptLock();
      lock.waitLock(30000);
    }
    var ctx = { me: null, settings: null };
    if (PUBLIC_ACTIONS.indexOf(body.action) < 0) {
      var sess = session_(body.token);
      if (!sess) return json_({ ok: false, code: 'login', error: 'กรุณาเข้าสู่ระบบด้วยอีเมลของคุณ' });
      ctx.settings = readSettings_();
      ctx.me = userCtx_(sess.email, sess.name, ctx.settings);
      rememberAppUrl_(body.appUrl);
    }
    var data = fn(body, ctx);
    return json_({ ok: true, data: data });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, code: (err && err.code) || '', error: String((err && err.message) || err) });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(msg, code) {
  var e = new Error(msg);
  e.code = code || '';
  throw e;
}
function forbid_(msg) { fail_(msg || 'คุณไม่มีสิทธิ์ทำรายการนี้ในโครงการนี้', 'forbidden'); }
function need_(p, me, perm, msg) { if (!R_().can(p, me, perm)) forbid_(msg); }
function nowIso_() { return new Date().toISOString(); }

// =============================================================
// คำสั่งของ API
// =============================================================
var ACTIONS = {
  ping: function () {
    return { version: VERSION, time: nowIso_(), maxUploadMB: CONFIG.MAX_UPLOAD_MB, auth: 'otp' };
  },

  // ---------- เข้าสู่ระบบ ----------
  requestOtp: function (b) {
    var R = R_();
    var email = R.norm(b.email);
    if (!R.validEmail(email)) fail_('อีเมลไม่ถูกต้อง');
    var settings = readSettings_();
    if (!loginAllowed_(email, settings)) {
      fail_('อีเมลนี้ยังไม่ได้รับสิทธิ์เข้าใช้ระบบ — ให้เจ้าของโครงการเพิ่มอีเมลของคุณเป็นสมาชิกก่อน', 'not_member');
    }
    var cache = CacheService.getScriptCache();
    var rlKey = 'otprl_' + hash_(email).slice(0, 32);
    var count = +(cache.get(rlKey) || 0);
    if (count >= 5) fail_('ขอรหัสบ่อยเกินไป กรุณารอประมาณ 1 ชั่วโมงแล้วลองใหม่', 'rate');
    var all = +(cache.get('otprl_all') || 0);
    if (all >= 120) fail_('ระบบได้รับคำขอรหัสจำนวนมาก กรุณาลองใหม่ภายหลัง', 'rate');
    var code = otpCode_();
    cache.put('otp_' + hash_(email).slice(0, 32), JSON.stringify({ h: hash_(email + '|' + code), tries: 0 }), 600);
    cache.put(rlKey, String(count + 1), 3600);
    cache.put('otprl_all', String(all + 1), 3600);
    MailApp.sendEmail({
      to: email,
      subject: 'รหัสเข้าสู่ระบบติดตามโครงการ: ' + code,
      htmlBody: '<div style="font-family:Tahoma,Arial,sans-serif;font-size:14px;color:#172238;line-height:1.6">' +
        '<p>รหัสสำหรับเข้าสู่ระบบติดตามโครงการของคุณคือ</p>' +
        '<p style="font-size:30px;letter-spacing:8px;font-weight:bold;margin:8px 0 16px">' + code + '</p>' +
        '<p style="color:#737D90">รหัสใช้ได้ภายใน 10 นาที หากคุณไม่ได้ขอรหัสนี้ ไม่ต้องดำเนินการใดๆ</p></div>',
      body: 'รหัสเข้าสู่ระบบติดตามโครงการ: ' + code + ' (ใช้ได้ภายใน 10 นาที)',
      name: CONFIG.MAIL_SENDER_NAME,
    });
    return { sent: true, email: email };
  },

  verifyOtp: function (b) {
    var R = R_();
    var email = R.norm(b.email);
    var code = String(b.code || '').replace(/\D/g, '');
    var cache = CacheService.getScriptCache();
    var ck = 'otp_' + hash_(email).slice(0, 32);
    var raw = cache.get(ck);
    if (!raw) fail_('รหัสหมดอายุหรือยังไม่ได้ขอรหัส — กด "ส่งรหัสอีกครั้ง"', 'otp_expired');
    var o = JSON.parse(raw);
    if (o.h !== hash_(email + '|' + code)) {
      o.tries = (o.tries || 0) + 1;
      if (o.tries >= 5) { cache.remove(ck); fail_('ใส่รหัสผิดหลายครั้ง — กด "ส่งรหัสอีกครั้ง" เพื่อขอรหัสใหม่', 'otp_expired'); }
      cache.put(ck, JSON.stringify(o), 600);
      fail_('รหัสไม่ถูกต้อง (เหลือโอกาสอีก ' + (5 - o.tries) + ' ครั้ง)', 'otp_wrong');
    }
    cache.remove(ck);
    var settings = readSettings_();
    var user = findUser_(email);
    var name = String(b.name || '').trim() || (user && user.name) || nameFromProjects_(email) || email.split('@')[0];
    var now = nowIso_();
    upsertKey_('Users', 'email', { email: email, name: name, lastLoginAt: now, createdAt: user ? user.createdAt : now });
    var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    var props = PropertiesService.getScriptProperties();
    props.setProperty('sess_' + hash_(token), JSON.stringify({ email: email, name: name, exp: Date.now() + CONFIG.SESSION_DAYS * 864e5 }));
    cleanSessions_();
    return { token: token, me: userCtx_(email, name, settings) };
  },

  logout: function (b) {
    if (b.token) PropertiesService.getScriptProperties().deleteProperty('sess_' + hash_(b.token));
    return { ok: true };
  },

  /** เปลี่ยนชื่อที่แสดงของผู้ใช้ */
  updateMe: function (b, ctx) {
    var name = String(b.name || '').trim();
    if (!name) fail_('กรุณาระบุชื่อ');
    var props = PropertiesService.getScriptProperties();
    var k = 'sess_' + hash_(b.token);
    var s = JSON.parse(props.getProperty(k));
    s.name = name;
    props.setProperty(k, JSON.stringify(s));
    var u = findUser_(ctx.me.email) || { email: ctx.me.email, createdAt: nowIso_() };
    u.name = name;
    upsertKey_('Users', 'email', u);
    return userCtx_(ctx.me.email, name, ctx.settings);
  },

  // ---------- อ่านข้อมูล (เฉพาะโครงการที่มีสิทธิ์) ----------
  getAll: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var projects = readTable_('Projects').filter(function (p) { return R.canView(p, me); });
    var ids = {};
    var byId = {};
    projects.forEach(function (p) { ids[p.id] = true; byId[p.id] = p; });
    var pick = function (t) { return readTable_(t).filter(function (r) { return ids[r.projectId]; }); };
    return {
      projects: projects,
      boq: pick('BOQ'),
      updates: pick('Updates'),
      files: pick('Files'),
      subs: pick('Submissions'),
      reqs: pick('Required'),
      msgs: chatFor_(me, readTable_('Messages'), null),
      meetings: meetingsFor_(me),
      daily: readTable_('Daily').filter(function (d) { var p = byId[d.projectId]; return p && R.canSeeDaily(p, me); }),
      library: readTable_('Library').filter(function (it) { return R.canSeeLibrary(it, me, projects); }),
      settings: ctx.settings,
      meta: {
        rootFolderUrl: me.isAdmin ? safeRootUrl_() : '', maxUploadMB: CONFIG.MAX_UPLOAD_MB, version: VERSION,
        me: me, auth: 'otp', mailQuota: me.isAdmin ? mailQuota_() : null, sendEmail: CONFIG.SEND_EMAIL,
        jobs: me.isAdmin ? jobStatus_() : null,
      },
    };
  },

  // ---------- โครงการ ----------
  saveProject: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var p = b.project || {};
    var old = p.id ? findById_('Projects', p.id) : null;
    var owner = true;
    if (old) {
      owner = R.isOwner(old, me);
      if (!owner && !R.can(old, me, 'editProject')) forbid_('คุณไม่มีสิทธิ์แก้ไขข้อมูลโครงการนี้');
      // เปลี่ยนเจ้าของได้ทางคำสั่ง transferOwner เท่านั้น
      p.ownerEmail = old.ownerEmail || '';
      p.ownerName = old.ownerName || '';
      if (!owner) OWNER_FIELDS.forEach(function (k) { p[k] = old[k]; });
      // โฟลเดอร์ Drive: เฉพาะผู้ดูแลระบบเปลี่ยนไปใช้โฟลเดอร์อื่นได้ (กันการชี้ไปโฟลเดอร์ของโครงการอื่น/โฟลเดอร์ส่วนตัวของบัญชีที่ติดตั้ง)
      if (!me.isAdmin) { p.folderId = old.folderId; p.folderUrl = old.folderUrl; }
      p.createdBy = old.createdBy; p.createdAt = old.createdAt;
    } else {
      if (!me.canCreate) forbid_('บัญชีนี้ยังไม่ได้รับสิทธิ์สร้างโครงการ — ติดต่อผู้ดูแลระบบ');
      p.ownerEmail = me.email;
      p.ownerName = me.name;
      if (!me.isAdmin) { p.folderId = ''; p.folderUrl = ''; }
      if (p.id && !/^[\w-]{4,60}$/.test(p.id)) p.id = '';
    }
    if (owner) {
      p.ownerRole = R.OWNER_ACTS[p.ownerRole] ? p.ownerRole : 'supervisor';
      p.ownerSeat = p.ownerRole === 'committee' ? seat_(p.ownerSeat) : '';
      p.members = cleanMembers_(p.members, p.ownerEmail);
      p.rolePerms = cleanRolePerms_(p.rolePerms);
      p.workflow = cleanWorkflow_(p.workflow);
      p.slaWarnDays = p.slaWarnDays === '' || p.slaWarnDays == null ? '' : Math.max(1, num_(p.slaWarnDays));
      p.slaLateDays = p.slaLateDays === '' || p.slaLateDays == null ? '' : Math.max(1, num_(p.slaLateDays));
    }
    var saved = saveProject_(p, me.name);
    var mail = null;
    if (owner) mail = afterMembersChanged_(old, saved, me, b, ctx);
    if (mail) saved._mail = mail;
    return saved;
  },

  transferOwner: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var p = requireProject_(b.projectId);
    need_(p, me, 'transferOwner', 'เฉพาะเจ้าของโครงการหรือผู้ดูแลระบบเท่านั้นที่โอนความเป็นเจ้าของได้');
    var e = R.norm(b.email);
    if (!R.validEmail(e)) fail_('อีเมลไม่ถูกต้อง');
    var target = (p.members || []).filter(function (m) { return R.norm(m.email) === e; })[0];
    var members = (p.members || []).filter(function (m) { return R.norm(m.email) !== e; });
    if (p.ownerEmail && R.norm(p.ownerEmail) !== e) {
      members.push({ email: R.norm(p.ownerEmail), name: p.ownerName || '', role: 'supervisor', notify: 'all' });
    }
    p.ownerEmail = e;
    p.ownerName = (target && target.name) || ((findUser_(e) || {}).name) || '';
    p.members = members;
    var saved = saveProject_(p, me.name);
    shareFolder_(saved, [e], []);
    var msg = R.inviteEmail(saved, { email: e, role: 'owner', name: saved.ownerName }, me, appUrl_(b, ctx.settings), 'gas');
    sendMails_([Object.assign({ to: [e], kind: 'invite', event: 'owner' }, msg)], { projectId: saved.id, replyTo: me.email });
    return saved;
  },

  deleteProject: function (b, ctx) {
    if (!b.id) fail_('ไม่ได้ระบุโครงการ');
    var p = requireProject_(b.id);
    need_(p, ctx.me, 'deleteProject', 'เฉพาะเจ้าของโครงการหรือผู้ดูแลระบบเท่านั้นที่ลบโครงการได้');
    deleteWhere_('Projects', function (r) { return r.id === b.id; });
    ['BOQ', 'Updates', 'Files', 'Submissions', 'Required', 'Messages', 'Meetings', 'Daily'].forEach(function (t) {
      deleteWhere_(t, function (r) { return r.projectId === b.id; });
    });
    return { id: b.id };
  },

  // ---------- BOQ และแผนงาน ----------
  saveBoq: function (b, ctx) {
    if (!b.projectId) fail_('ไม่ได้ระบุโครงการ');
    var p = requireProject_(b.projectId);
    need_(p, ctx.me, 'editBoq', 'คุณไม่มีสิทธิ์แก้ไข BOQ และแผนงานของโครงการนี้');
    // รหัสรายการที่เป็นของโครงการอื่น ห้ามนำมาใช้ซ้ำ
    var foreign = {};
    readTable_('BOQ').forEach(function (r) { if (r.projectId !== b.projectId) foreign[r.id] = true; });
    var items = (b.items || []).map(function (it, i) {
      var ps = num_(it.ps), pe = num_(it.pe);
      return {
        id: it.id && !foreign[it.id] && /^[\w-]{1,60}$/.test(it.id) ? it.id : newId_('B'), projectId: b.projectId, group: it.group || '', no: it.no || '', desc: it.desc || '',
        unit: it.unit || '', qty: num_(it.qty), mat: num_(it.mat), labor: num_(it.labor),
        weight: it.weight === '' || it.weight == null ? '' : num_(it.weight), order: i + 1,
        ps: ps > 0 ? Math.round(ps) : '', pe: pe > 0 ? Math.round(pe) : '',
      };
    });
    replaceWhere_('BOQ', function (r) { return r.projectId === b.projectId; }, items);
    return items;
  },

  // ---------- บันทึกความคืบหน้า ----------
  saveUpdate: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var u = b.update || {};
    if (!u.projectId) fail_('ไม่ได้ระบุโครงการ');
    if (!u.date) fail_('ไม่ได้ระบุวันที่');
    var p = requireProject_(u.projectId);
    need_(p, me, 'recordProgress', 'คุณไม่มีสิทธิ์บันทึกความคืบหน้าของโครงการนี้');
    var now = nowIso_();
    var old = u.id ? findById_('Updates', u.id) : null;
    if (old && old.projectId !== p.id) forbid_();
    var rec = {
      id: u.id || newId_('U'), projectId: u.projectId, date: u.date, week: u.week === '' ? '' : num_(u.week),
      entries: u.entries || {}, manualPct: u.manualPct === '' || u.manualPct == null ? '' : num_(u.manualPct),
      note: u.note || '', issues: u.issues || '',
      createdBy: old ? old.createdBy : me.name, createdByEmail: old ? (old.createdByEmail || '') : me.email,
      createdAt: old ? old.createdAt : now, updatedAt: now,
    };
    upsert_('Updates', rec);
    if (b.notify) {
      var rc = R.recipients(p, 'progress', null, me.email);
      if (rc.info.length) {
        var m = R.progressEmail(p, rec, me, appUrl_(b, ctx.settings), b.summary || {});
        rec._mail = sendMails_([Object.assign({ to: rc.info, kind: 'info', event: 'progress' }, m)], { projectId: p.id, replyTo: me.email });
      }
    }
    return rec;
  },

  deleteUpdate: function (b, ctx) {
    var u = findById_('Updates', b.id);
    if (u) need_(requireProject_(u.projectId), ctx.me, 'recordProgress', 'คุณไม่มีสิทธิ์ลบบันทึกความคืบหน้าของโครงการนี้');
    deleteWhere_('Updates', function (r) { return r.id === b.id; });
    return { id: b.id };
  },

  // ---------- ไฟล์ ----------
  uploadFile: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var p = requireProject_(b.projectId);
    if (b.dailyId) {
      // รูปถ่าย/ไฟล์แนบของรายงานประจำวัน: ใช้สิทธิ์บันทึกความคืบหน้า
      if (!/^[\w-]{4,60}$/.test(String(b.dailyId))) fail_('รหัสรายงานไม่ถูกต้อง');
      need_(p, me, 'recordProgress', 'คุณไม่มีสิทธิ์แนบไฟล์ในรายงานประจำวันของโครงการนี้');
      b.updateId = b.dailyId; b.subId = ''; b.chat = ''; b.category = b.category || DAILY_FILE_CATEGORY;
    }
    if (b.chat) {
      // ไฟล์ที่แนบในห้องสนทนา/ห้องประชุม: ใช้สิทธิ์ส่งข้อความของห้องนั้น
      var mref = b.chat === 'meeting' ? findById_('Meetings', b.refId) : null;
      if (!R.canPostChannel(b.chat, p, me, mref)) forbid_('คุณไม่มีสิทธิ์แนบไฟล์ในห้องนี้');
      b.subId = ''; b.updateId = ''; b.category = CHAT_FILE_CATEGORY;
    } else if (b.subId) {
      if (!(R.can(p, me, 'submit') || R.can(p, me, 'approve') || R.isOwner(p, me))) forbid_('คุณไม่มีสิทธิ์แนบไฟล์ในเรื่องขออนุมัติของโครงการนี้');
      var sref = findById_('Submissions', b.subId);
      if (sref && (sref.projectId !== p.id || !R.canView(p, me))) forbid_();
      if (!/^[\w-]{4,60}$/.test(String(b.subId))) fail_('รหัสเรื่องไม่ถูกต้อง');
    } else if (!(b.updateId && R.can(p, me, 'recordProgress'))) need_(p, me, 'uploadDocs', 'คุณไม่มีสิทธิ์อัปโหลดเอกสารในคลังของโครงการนี้');
    if (!b.base64) fail_('ไม่มีข้อมูลไฟล์');
    var bytes = Utilities.base64Decode(b.base64);
    if (bytes.length > CONFIG.MAX_UPLOAD_MB * 1048576) fail_('ไฟล์ใหญ่เกิน ' + CONFIG.MAX_UPLOAD_MB + ' MB');
    // ไฟล์แนบของเรื่องขออนุมัติเก็บในหมวดเฉพาะเสมอ
    var category = b.subId ? SUB_FILE_CATEGORY : (b.category || 'อื่นๆ');
    var folder = categoryFolder_(p, category);
    var blob = Utilities.newBlob(bytes, b.mime || 'application/octet-stream', b.name || 'ไฟล์');
    var file = folder.createFile(blob);
    if (b.note) file.setDescription(b.note);
    if (CONFIG.LINK_SHARING) {
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* โดเมนอาจไม่อนุญาต */ }
    }
    // รหัสไฟล์เดิมใช้ต่อได้เฉพาะตอนผู้ดูแลย้ายข้อมูลจากโหมดทดลอง (ให้เรื่องขออนุมัติอ้างถึงไฟล์ได้ถูกต้อง)
    var id = b.fileId && me.isAdmin && /^[\w-]{4,60}$/.test(b.fileId) && !findById_('Files', b.fileId) ? b.fileId : newId_('F');
    var rec = {
      id: id, projectId: p.id, category: category, name: file.getName(), mime: file.getMimeType(),
      size: file.getSize(), driveId: file.getId(), url: file.getUrl(), note: b.note || '', updateId: b.updateId || '',
      subId: b.subId || '', uploadedBy: me.name, uploadedByEmail: me.email, uploadedAt: nowIso_(),
    };
    upsert_('Files', rec);
    return rec;
  },

  addLink: function (b, ctx) {
    var p = requireProject_(b.projectId);
    need_(p, ctx.me, 'uploadDocs', 'คุณไม่มีสิทธิ์เพิ่มเอกสารในคลังของโครงการนี้');
    if (!/^https?:\/\//i.test(b.url || '')) fail_('ลิงก์ไม่ถูกต้อง');
    var rec = {
      id: newId_('F'), projectId: b.projectId, category: b.category || 'อื่นๆ', name: b.name || b.url, mime: 'link',
      size: 0, driveId: '', url: b.url, note: b.note || '', updateId: '', subId: '',
      uploadedBy: ctx.me.name, uploadedByEmail: ctx.me.email, uploadedAt: nowIso_(),
    };
    upsert_('Files', rec);
    return rec;
  },

  updateFile: function (b, ctx) {
    var rec = findById_('Files', b.id);
    if (!rec) fail_('ไม่พบไฟล์');
    var p = requireProject_(rec.projectId);
    canEditFile_(rec, p, ctx.me);
    var ch = b.changes || {};
    if (rec.driveId) {
      try {
        var file = DriveApp.getFileById(rec.driveId);
        if (ch.name && ch.name !== rec.name) file.setName(ch.name);
        if (ch.category && ch.category !== rec.category) file.moveTo(categoryFolder_(p, ch.category));
        if (ch.note != null) file.setDescription(ch.note);
      } catch (e) {
        fail_('แก้ไขไฟล์ใน Drive ไม่ได้: ' + e.message);
      }
    }
    ['name', 'category', 'note'].forEach(function (k) { if (ch[k] != null) rec[k] = ch[k]; });
    upsert_('Files', rec);
    return rec;
  },

  deleteFile: function (b, ctx) {
    var rec = findById_('Files', b.id);
    if (!rec) return { id: b.id };
    canEditFile_(rec, requireProject_(rec.projectId), ctx.me);
    if (rec.driveId) {
      try { DriveApp.getFileById(rec.driveId).setTrashed(true); } catch (e) { /* ไฟล์อาจถูกลบไปแล้ว */ }
    }
    deleteWhere_('Files', function (r) { return r.id === b.id; });
    return { id: b.id };
  },

  /** เพิ่มไฟล์ที่ถูกวางไว้ในโฟลเดอร์ Drive ของโครงการโดยตรง (เช่น ไฟล์ใหญ่) เข้าระบบ */
  scanDrive: function (b, ctx) {
    var p = requireProject_(b.projectId);
    need_(p, ctx.me, 'uploadDocs', 'คุณไม่มีสิทธิ์จัดการคลังเอกสารของโครงการนี้');
    var root = projectFolder_(p);
    var known = {};
    readTable_('Files').forEach(function (f) { if (f.driveId) known[f.driveId] = true; });
    var added = [];
    // ชื่อโฟลเดอร์หมวดถูกแทน / ด้วย - ตอนสร้าง จึงจับคู่กลับเป็นชื่อหมวดเดิม
    var catByFolder = {};
    (p.docCategories || []).forEach(function (c) { catByFolder[String(c).replace(/[\\/]/g, '-')] = c; });
    var walk = function (folder, category, depth) {
      var files = folder.getFiles();
      while (files.hasNext()) {
        var f = files.next();
        if (known[f.getId()] || f.isTrashed()) continue;
        added.push({
          id: newId_('F'), projectId: p.id, category: category, name: f.getName(), mime: f.getMimeType(),
          size: f.getSize(), driveId: f.getId(), url: f.getUrl(), note: f.getDescription() || '', updateId: '', subId: '',
          uploadedBy: ctx.me.name + ' (ดึงจาก Drive)', uploadedByEmail: ctx.me.email, uploadedAt: (f.getDateCreated() || new Date()).toISOString(),
        });
        known[f.getId()] = true;
      }
      if (depth > 3) return;
      var subs = folder.getFolders();
      while (subs.hasNext()) {
        var s = subs.next();
        walk(s, depth === 0 ? (catByFolder[s.getName()] || s.getName()) : category, depth + 1);
      }
    };
    walk(root, 'อื่นๆ', 0);
    if (added.length) appendRows_('Files', added);
    return added;
  },

  // ---------- เรื่องขออนุมัติ / แจ้งปัญหา ----------
  createSubmission: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var p = requireProject_(b.projectId);
    var input = b.input || {};
    var id = b.id && /^[\w-]{4,60}$/.test(b.id) && !findById_('Submissions', b.id) ? b.id : newId_('S');
    var files = ownFiles_(input.files, p.id, b.id || id);
    if (input.requiredId) {
      var req = findById_('Required', input.requiredId);
      if (!req || req.projectId !== p.id) input.requiredId = '';
    }
    var out = R.createSubmission(p, {
      id: id, category: input.category, title: input.title, detail: input.detail, requiredId: input.requiredId, files: files,
      vote: input.vote || null,
    }, me, nowIso_(), readTable_('Submissions'));
    upsert_('Submissions', out.sub);
    var mail = notifySub_(p, out.event, out.sub, me, b, ctx);
    return { sub: out.sub, event: out.event, mail: mail };
  },

  /** b.op = approve | reject | resubmit | cancel | comment | openVote | vote | closeVote */
  actSubmission: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var cur = findById_('Submissions', b.id);
    if (!cur) fail_('ไม่พบเรื่องนี้ (อาจถูกลบไปแล้ว)');
    var p = requireProject_(cur.projectId);
    if (!R.canView(p, me)) forbid_();
    var files = ownFiles_(b.files, p.id, cur.id);
    var out = R.act(cur, p, me, b.op, {
      comment: b.comment, changes: b.changes || { comment: b.comment }, files: files, option: b.option, vote: b.vote || null,
    }, nowIso_());
    upsert_('Submissions', out.sub);
    var mail = notifySub_(p, out.event, out.sub, me, b, ctx);
    return { sub: out.sub, event: out.event, mail: mail };
  },

  // ---------- ห้องสนทนา / ประชุม (1.0.4) ----------
  postMessage: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var m = b.message || {};
    var meeting = m.channel === 'meeting' ? findById_('Meetings', m.refId) : null;
    if (m.channel === 'meeting' && !meeting) fail_('ไม่พบการประชุมนี้');
    var pid = m.channel === 'dept' ? '' : (meeting ? meeting.projectId : m.projectId);
    var p = pid ? requireProject_(pid) : null;
    var files = p ? ownFiles_(m.files, p.id, '') : [];
    var id = m.id && /^[\w-]{4,60}$/.test(m.id) && !findById_('Messages', m.id) ? m.id : newId_('M');
    var msg = R.newMessage({ id: id, channel: m.channel, text: m.text, files: files }, p, me, nowIso_(), meeting);
    appendRows_('Messages', [msg]);
    return msg;
  },
  deleteMessage: function (b, ctx) {
    var R = R_();
    var msg = findById_('Messages', b.id);
    if (!msg) return { id: b.id };
    if (!R.canDeleteMessage(msg, ctx.me)) forbid_('ลบได้เฉพาะข้อความของตนเอง');
    msg.deleted = true; msg.text = ''; msg.files = []; msg.editedAt = nowIso_();
    upsert_('Messages', msg);
    return msg;
  },
  /** ข้อความและการประชุมที่เปลี่ยนตั้งแต่ since (ใช้ดึงข้อความใหม่เป็นระยะ) */
  chatSince: function (b, ctx) {
    var since = String(b.since || '');
    var msgs = readTable_('Messages').filter(function (m) { return !since || String(m.at) > since || String(m.editedAt || '') > since; });
    return { msgs: chatFor_(ctx.me, msgs, null), meetings: meetingsFor_(ctx.me), at: nowIso_() };
  },
  saveMeeting: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var input = b.meeting || {};
    var old = input.id ? findById_('Meetings', input.id) : null;
    var audience = old ? old.audience : input.audience;
    var pid = audience === 'dept' ? '' : (old ? old.projectId : input.projectId);
    var p = pid ? requireProject_(pid) : null;
    if (audience !== 'dept' && !p) fail_('ไม่ได้ระบุโครงการ');
    if (!old) input.id = newId_('G');
    var m = R.cleanMeeting(input, p, me, nowIso_(), old);
    upsert_('Meetings', m);
    var mail = null;
    var kind = b.notify === 'minutes' ? 'minutes' : b.notify ? (!old ? 'invite' : m.status === 'cancelled' && old.status !== 'cancelled' ? 'cancel' : 'update') : '';
    if (kind) {
      var to = m.attendees.filter(function (e) { return e !== me.email; });
      if (to.length) {
        var msg = R.meetingEmail(kind, m, p, me, appUrl_(b, ctx.settings));
        mail = sendMails_([Object.assign({ to: to, kind: 'action', event: 'meeting-' + kind }, msg)], { projectId: pid, replyTo: me.email });
      }
    }
    if (mail) m._mail = mail;
    return m;
  },
  toggleAction: function (b, ctx) {
    var R = R_();
    var m = findById_('Meetings', b.id);
    if (!m) fail_('ไม่พบการประชุมนี้');
    var p = m.projectId ? requireProject_(m.projectId) : null;
    var out = R.toggleAction(m, p, ctx.me, b.actionId, !!b.done, nowIso_());
    upsert_('Meetings', out);
    return out;
  },

  // ---------- รายงานประจำวัน (1.0.5) ----------
  saveDaily: function (b, ctx) {
    var R = R_();
    var input = b.daily || {};
    var p = requireProject_(input.projectId);
    var all = readTable_('Daily');
    var old = input.id ? all.filter(function (x) { return x.id === input.id; })[0] : null;
    if (old && old.projectId !== p.id) forbid_();
    var same = all.filter(function (x) { return x.projectId === p.id && x.date === input.date && (!old || x.id !== old.id); })[0];
    if (same) fail_('มีรายงานประจำวันของวันที่นี้แล้ว — เปิดรายงานเดิมเพื่อแก้ไข', 'conflict');
    if (!old) input.id = /^D[\w-]{3,60}$/.test(String(input.id || '')) && !all.some(function (x) { return x.id === input.id; }) ? input.id : newId_('D');
    var files = (input.files || []).filter(function (id) {
      var f = findById_('Files', id);
      return f && f.projectId === p.id;
    });
    var d = R.cleanDaily(Object.assign({}, input, { files: files }), p, ctx.me, nowIso_(), old);
    upsert_('Daily', d);
    if (b.notify) {
      var to = R.reportRecipients(p, 'daily', true).filter(function (e) { return e !== ctx.me.email; });
      if (to.length) {
        var m = R.dailyReportEmail({ p: p, daily: d, subs: readTable_('Submissions').filter(function (s) { return s.projectId === p.id; }), reqs: readTable_('Required').filter(function (r) { return r.projectId === p.id; }),
          settings: ctx.settings, today: d.date, nowIso: nowIso_(), appUrl: appUrl_(b, ctx.settings) });
        d._mail = sendMails_([Object.assign({ to: to, kind: 'report', event: 'report-daily' }, m)], { projectId: p.id, replyTo: ctx.me.email });
      }
    }
    return d;
  },
  deleteDaily: function (b, ctx) {
    var d = findById_('Daily', b.id);
    if (!d) return { id: b.id };
    need_(requireProject_(d.projectId), ctx.me, 'recordProgress', 'คุณไม่มีสิทธิ์ลบรายงานประจำวันของโครงการนี้');
    deleteWhere_('Daily', function (r) { return r.id === b.id; });
    return { id: b.id };
  },

  // ---------- คลังแบบฟอร์มและระเบียบ (ผู้ดูแลระบบ) ----------
  uploadLibraryFile: function (b, ctx) {
    if (!ctx.me.isAdmin) forbid_('เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการคลังแบบฟอร์มได้');
    if (!b.base64) fail_('ไม่มีข้อมูลไฟล์');
    var bytes = Utilities.base64Decode(b.base64);
    if (bytes.length > CONFIG.MAX_UPLOAD_MB * 1048576) fail_('ไฟล์ใหญ่เกิน ' + CONFIG.MAX_UPLOAD_MB + ' MB');
    var root = rootFolder_();
    var it = root.getFoldersByName(LIBRARY_FOLDER);
    var folder = it.hasNext() ? it.next() : root.createFolder(LIBRARY_FOLDER);
    var file = folder.createFile(Utilities.newBlob(bytes, b.mime || 'application/octet-stream', b.name || 'ไฟล์'));
    // แบบฟอร์มกลางต้องเปิดได้ทุกคนในระบบ (รวมผู้รับจ้าง) จึงแชร์แบบมีลิงก์ดูได้ — ถ้าโดเมนไม่อนุญาต ผู้ดูแลแชร์โฟลเดอร์เองได้
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* โดเมนอาจไม่อนุญาต */ }
    return { name: file.getName(), mime: file.getMimeType(), size: file.getSize(), driveId: file.getId(), url: file.getUrl() };
  },
  saveLibrary: function (b, ctx) {
    var R = R_();
    var input = b.item || {};
    var old = input.id ? findById_('Library', input.id) : null;
    if (!old) input.id = newId_('L');
    var rec = R.cleanLibrary(input, ctx.me, nowIso_(), old);
    upsert_('Library', rec);
    return rec;
  },
  deleteLibrary: function (b, ctx) {
    if (!ctx.me.isAdmin) forbid_('เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการคลังแบบฟอร์มได้');
    var it = findById_('Library', b.id);
    if (it && it.file && it.file.driveId) { try { DriveApp.getFileById(it.file.driveId).setTrashed(true); } catch (e) { /* ignore */ } }
    deleteWhere_('Library', function (r) { return r.id === b.id; });
    return { id: b.id };
  },

  // ---------- อีเมลรายงานและงานตามเวลา ----------
  /** ดูตัวอย่าง/ส่งรายงานทันที — kind: reminders | daily | weekly | monthly ; projectId (daily/weekly) ; date */
  report: function (b, ctx) {
    var R = R_();
    var me = ctx.me;
    var kind = String(b.kind || '');
    if (['reminders', 'daily', 'weekly', 'monthly'].indexOf(kind) < 0) fail_('ไม่รู้จักรายงาน: ' + kind);
    var local = localNow_();
    var date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : local.date;
    var p = b.projectId ? requireProject_(b.projectId) : null;
    if (kind === 'reminders' || (!p && kind !== 'monthly')) { if (!me.isAdmin) forbid_('เฉพาะผู้ดูแลระบบเท่านั้นที่สั่งส่งอีเมลของทุกโครงการได้'); }
    else if (kind === 'monthly') { if (!(me.isAdmin || me.isExec || (p && R.isOwner(p, me)))) forbid_('เฉพาะผู้ดูแลระบบ ผู้บริหาร หรือเจ้าของโครงการเท่านั้น'); }
    else if (!(R.can(p, me, 'recordProgress') || R.isOwner(p, me) || me.isAdmin)) forbid_('เฉพาะเจ้าของโครงการและผู้ควบคุมงานเท่านั้นที่ส่งรายงานของโครงการนี้ได้');
    var msgs = planFor_(kind, { date: date, projectId: p ? p.id : '', settings: ctx.settings, appUrl: appUrl_(b, ctx.settings), month: b.month });
    if (!b.send) return { msgs: msgs, date: date };
    var res = runMsgs_(msgs, false);
    // ส่งทุกโครงการด้วยมือ = ถือว่าส่งของวันนี้/เดือนนี้แล้ว (ตัวตั้งเวลาจะไม่ส่งซ้ำ)
    var month = /^\d{4}-\d{2}$/.test(String(b.month || '')) ? b.month : R.prevMonth(date);
    if (!p && (kind === 'monthly' ? month === R.prevMonth(local.date) : date === local.date)) markJob_(kind, kind === 'monthly' ? month : date, res, me.email);
    return res;
  },
  /** ตัวตั้งเวลา: op = status | install (ผู้ดูแลระบบ) */
  jobs: function (b, ctx) {
    if (!ctx.me.isAdmin) forbid_('เฉพาะผู้ดูแลระบบเท่านั้น');
    if (b.op === 'install') installTriggers();
    return jobStatus_();
  },

  saveRequired: function (b, ctx) {
    var R = R_();
    var p = requireProject_(b.projectId);
    need_(p, ctx.me, 'manageRequired', 'คุณไม่มีสิทธิ์กำหนดรายการเอกสารที่ต้องส่ง');
    var items = (b.items || []).map(function (r, i) {
      return {
        id: r.id || newId_('Q'), projectId: p.id, title: String(r.title || '').trim(), category: String(r.category || ''),
        dueType: R.DUE_TYPES[r.dueType] ? r.dueType : 'afterStart', dueDays: Math.max(0, Math.round(num_(r.dueDays))),
        dueDate: r.dueType === 'date' ? String(r.dueDate || '') : '', note: String(r.note || '').trim(), order: i + 1,
      };
    }).filter(function (r) { return r.title; });
    replaceWhere_('Required', function (r) { return r.projectId === p.id; }, items);
    return items;
  },

  // ---------- ตั้งค่ากลาง (ผู้ดูแลระบบ) ----------
  saveSettings: function (b, ctx) {
    if (!ctx.me.isAdmin) forbid_('เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยนการตั้งค่ากลางได้');
    var s = b.settings || {};
    var rows = Object.keys(s).map(function (k) { return { key: k, value: s[k] }; });
    replaceWhere_('Settings', function () { return true; }, rows);
    return readSettings_();
  },

  /** นำเข้าข้อมูลทั้งชุด (ย้ายจากโหมดทดลอง / กู้คืนไฟล์สำรอง) — ผู้ดูแลระบบเท่านั้น */
  importAll: function (b, ctx) {
    if (!ctx.me.isAdmin) forbid_('เฉพาะผู้ดูแลระบบเท่านั้นที่นำเข้าข้อมูลได้');
    var d = b.data || {};
    var ids = {};
    var existing = {};
    readTable_('Projects').forEach(function (p) { existing[p.id] = p; });
    (d.projects || []).forEach(function (p) {
      var old = existing[p.id];
      var rec = Object.assign({}, p, { folderId: old ? old.folderId : '', folderUrl: old ? old.folderUrl : '' });
      if (!rec.ownerEmail && !old) { rec.ownerEmail = ctx.me.email; rec.ownerName = ctx.me.name; }
      var saved = saveProject_(rec, p.createdBy || ctx.me.name);
      ids[p.id] = saved.id;
    });
    mergeById_('BOQ', d.boq || []);
    mergeById_('Updates', d.updates || []);
    mergeById_('Files', (d.files || []).filter(function (f) { return f.driveId || f.mime === 'link'; }));
    mergeById_('Submissions', d.subs || []);
    mergeById_('Required', d.reqs || []);
    mergeById_('Messages', (d.msgs || []).filter(function (m) { return !m.projectId || ids[m.projectId] || existing[m.projectId]; }));
    mergeById_('Meetings', (d.meetings || []).filter(function (m) { return !m.projectId || ids[m.projectId] || existing[m.projectId]; }));
    mergeById_('Daily', (d.daily || []).filter(function (x) { return ids[x.projectId] || existing[x.projectId]; }));
    mergeById_('Library', (d.library || []).filter(function (x) { return x.url || (x.file && x.file.driveId); }));
    if (d.settings && Object.keys(d.settings).length) ACTIONS.saveSettings({ settings: Object.assign(readSettings_(), d.settings) }, ctx);
    return { projectIds: ids };
  },
};

// =============================================================
// ผู้ใช้และการเข้าสู่ระบบ
// =============================================================
function hash_(s) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return raw.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

function otpCode_() {
  var hex = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var n = parseInt(hex.slice(0, 12), 16) % 1000000;
  return ('000000' + n).slice(-6);
}

function session_(token) {
  if (!token || String(token).length < 20) return null;
  var props = PropertiesService.getScriptProperties();
  var k = 'sess_' + hash_(token);
  var raw = props.getProperty(k);
  if (!raw) return null;
  var s;
  try { s = JSON.parse(raw); } catch (e) { return null; }
  if (!s.exp || s.exp < Date.now()) { props.deleteProperty(k); return null; }
  // ต่ออายุเมื่อใช้งานเกินครึ่งอายุแล้ว
  if (s.exp - Date.now() < CONFIG.SESSION_DAYS * 864e5 / 2) {
    s.exp = Date.now() + CONFIG.SESSION_DAYS * 864e5;
    props.setProperty(k, JSON.stringify(s));
  }
  return s;
}

function cleanSessions_() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('sess_') !== 0) return;
    try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

function scriptOwner_() {
  var e = prop_('OWNER_EMAIL');
  if (!e) {
    try { e = Session.getEffectiveUser().getEmail(); } catch (x) { e = ''; }
    if (e) setProp_('OWNER_EMAIL', e);
  }
  return R_().norm(e);
}

/** ข้อมูลผู้ใช้สำหรับตรวจสิทธิ์: { email, name, isAdmin, isExec, canCreate } */
function userCtx_(email, name, settings) {
  var R = R_();
  email = R.norm(email);
  settings = settings || {};
  var owner = scriptOwner_();
  var isAdmin = (!!owner && email === owner) || R.listHas(CONFIG.ADMIN_EMAILS, email) || R.listHas(settings.admins, email);
  var me = { email: email, name: name || email, isAdmin: !!isAdmin, isExec: R.listHas(settings.executives, email) };
  me.isDept = R.isDept(settings, me);
  me.canCreate = R.canCreateProject(settings, me);
  return me;
}

/** ใครเข้าสู่ระบบได้: ผู้ดูแล ผู้บริหาร ผู้สร้างโครงการได้ และสมาชิกของโครงการใดก็ได้ */
function loginAllowed_(email, settings) {
  var R = R_();
  var me = userCtx_(email, '', settings);
  if (me.isAdmin || me.isExec || me.isDept) return true;
  var creators = R.parseList(settings.projectCreators);
  if (!creators.length || R.listHas(creators, email)) return true;
  return readTable_('Projects').some(function (p) { return !!R.roleOf(p, email); });
}

function findUser_(email) {
  var e = R_().norm(email);
  var rows = readTable_('Users');
  for (var i = 0; i < rows.length; i++) if (R_().norm(rows[i].email) === e) return rows[i];
  return null;
}

function nameFromProjects_(email) {
  var R = R_();
  var ps = readTable_('Projects');
  for (var i = 0; i < ps.length; i++) {
    var n = R.memberName(ps[i], email);
    if (n && n !== R.norm(email)) return n;
  }
  return '';
}

// =============================================================
// สมาชิก สิทธิ์ และขั้นตอนพิจารณา
// =============================================================
function cleanMembers_(list, ownerEmail) {
  var R = R_();
  var seen = {};
  var seats = {};
  var out = [];
  (Array.isArray(list) ? list : []).forEach(function (m) {
    var e = R.norm(m && m.email);
    if (!e) return;
    if (!R.validEmail(e)) fail_('อีเมล "' + e + '" ไม่ถูกต้อง');
    if (seen[e] || e === R.norm(ownerEmail)) return;
    seen[e] = true;
    var role = R.MEMBER_ROLES.indexOf(m.role) >= 0 ? m.role : 'viewer';
    var rec = { email: e, name: String(m.name || '').trim().slice(0, 120), role: role, notify: R.NOTIFY[m.notify] ? m.notify : R.DEFAULT_NOTIFY[role] };
    if (role === 'committee') {
      var st = seat_(m.seat);
      if (st !== '' && seats[st]) fail_('ลำดับกรรมการ "' + R.seatLabel(st) + '" ซ้ำกัน');
      if (st !== '') { seats[st] = true; rec.seat = st; }
    }
    out.push(rec);
  });
  return out;
}

/** ลำดับกรรมการ: 0 = ประธานกรรมการ, 1..9 = กรรมการลำดับที่ n — ค่าอื่นคืน '' */
function seat_(v) {
  if (v === '' || v == null || !isFinite(+v)) return '';
  var n = Math.round(+v);
  return n >= 0 && n <= R_().MAX_SEAT ? n : '';
}

function cleanRolePerms_(rp) {
  var R = R_();
  if (!rp || typeof rp !== 'object' || Array.isArray(rp)) return null;
  var out = {};
  R.MEMBER_ROLES.forEach(function (role) {
    if (Array.isArray(rp[role])) out[role] = rp[role].filter(function (k) { return R.PERM_KEYS.indexOf(k) >= 0; });
  });
  return Object.keys(out).length ? out : null;
}

function cleanWorkflow_(wf) {
  var R = R_();
  if (!Array.isArray(wf) || !wf.length) return [];
  var names = {};
  return wf.map(function (c) {
    var name = String((c && c.name) || '').trim().slice(0, 120);
    var steps = ((c && c.steps) || []).filter(function (s) { return s && R.ROLES[s.role]; }).slice(0, 6).map(function (s) {
      return { role: s.role, days: Math.max(1, Math.round(num_(s.days) || 7)), label: String(s.label || '').trim().slice(0, 80), mode: s.role === 'committee' && s.mode === 'any' ? 'any' : (s.role === 'committee' ? 'seq' : 'any') };
    });
    return { name: name, steps: steps };
  }).filter(function (c) {
    if (!c.name || !c.steps.length || names[c.name]) return false;
    names[c.name] = true;
    return true;
  });
}

/** หลังเจ้าของโครงการบันทึกสมาชิก: แชร์โฟลเดอร์ Drive และส่งอีเมลแจ้งการแต่งตั้ง */
function afterMembersChanged_(old, saved, me, b, ctx) {
  var R = R_();
  var before = {};
  R.members(old || {}).forEach(function (m) { before[m.email] = m; });
  var after = R.members(saved);
  var nowSet = {};
  after.forEach(function (m) { nowSet[m.email] = true; });
  var added = after.filter(function (m) { return m.role !== 'owner' && !before[m.email]; });
  var removed = Object.keys(before).filter(function (e) { return !nowSet[e] && before[e].role !== 'owner'; });
  shareFolder_(saved, added.map(function (m) { return m.email; }), removed);
  if (b.invite === false || !added.length) return null;
  var url = appUrl_(b, ctx.settings);
  return sendMails_(added.map(function (m) {
    return Object.assign({ to: [m.email], kind: 'invite', event: 'invite' }, R.inviteEmail(saved, m, me, url, 'gas'));
  }), { projectId: saved.id, replyTo: me.email });
}

function shareFolder_(p, add, remove) {
  if (!CONFIG.SHARE_DRIVE_WITH_MEMBERS || (!add.length && !remove.length)) return;
  var folder;
  try { folder = projectFolder_(p); } catch (e) { return; }
  add.forEach(function (e) { try { folder.addViewer(e); } catch (x) { /* อีเมลที่ไม่ใช่บัญชี Google แชร์ไม่ได้ */ } });
  remove.forEach(function (e) { try { folder.removeViewer(e); } catch (x) { /* ignore */ } });
}

function canEditFile_(rec, p, me) {
  var R = R_();
  if (rec.subId) { if (!R.isOwner(p, me)) forbid_('ไฟล์แนบของเรื่องขออนุมัติเก็บเป็นหลักฐาน — แก้ไขหรือลบได้เฉพาะเจ้าของโครงการ'); return; }
  need_(p, me, 'uploadDocs', 'คุณไม่มีสิทธิ์แก้ไขไฟล์ในคลังของโครงการนี้');
}

/** รับเฉพาะรหัสไฟล์ที่อยู่ในโครงการนี้ และแนบกับเรื่องนี้ */
function ownFiles_(ids, pid, subId) {
  if (!Array.isArray(ids) || !ids.length) return [];
  var byId = {};
  readTable_('Files').forEach(function (f) { byId[f.id] = f; });
  return ids.filter(function (id) { var f = byId[id]; return f && f.projectId === pid && (!f.subId || f.subId === subId); });
}

// =============================================================
// อีเมล
// =============================================================
function appUrl_(b, settings) {
  return CONFIG.APP_URL || (settings && settings.appUrl) || (b && b.appUrl) || prop_('LAST_APP_URL') || '';
}

function rememberAppUrl_(u) {
  if (!u || !/^https?:\/\//.test(u) || CONFIG.APP_URL) return;
  u = String(u).split('#')[0].slice(0, 300);
  if (prop_('LAST_APP_URL') !== u) setProp_('LAST_APP_URL', u);
}

function mailQuota_() {
  try { return MailApp.getRemainingDailyQuota(); } catch (e) { return null; }
}

/** ข้อความที่ผู้ใช้นี้อ่านได้ (ห้องละไม่เกิน 300 ข้อความล่าสุด) */
function chatFor_(me, msgs, unused) {
  var R = R_();
  var projects = {};
  readTable_('Projects').forEach(function (p) { projects[p.id] = p; });
  var meetings = {};
  readTable_('Meetings').forEach(function (m) { meetings[m.id] = m; });
  var per = {};
  var out = msgs.filter(function (m) {
    var p = m.projectId ? projects[m.projectId] : null;
    if (m.projectId && !p) return false;
    return R.canReadChannel(m.channel, p, me, m.channel === 'meeting' ? meetings[m.refId] : null);
  }).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).filter(function (m) {
    var k = m.channel + ':' + (m.refId || m.projectId);
    per[k] = (per[k] || 0) + 1;
    return per[k] <= 300;
  });
  return out.reverse();
}
function meetingsFor_(me) {
  var R = R_();
  var projects = {};
  readTable_('Projects').forEach(function (p) { projects[p.id] = p; });
  return readTable_('Meetings').filter(function (m) {
    var p = m.projectId ? projects[m.projectId] : null;
    if (m.projectId && !p) return false;
    return R.canSeeMeeting(m, p, me);
  });
}

function notifySub_(p, event, sub, me, b, ctx) {
  var msgs = R_().mailPlan(p, event, sub, me, appUrl_(b, ctx.settings), ctx.settings);
  return sendMails_(msgs, { projectId: p.id, replyTo: me.email });
}

function htmlToText_(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<\/td>/gi, '  ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2: $1')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * ส่งอีเมล: ผู้ต้องดำเนินการได้รับฉบับเดียวกัน ส่วนผู้รับเพื่อทราบได้รับแยกรายคน (ไม่เห็นอีเมลกันและกัน)
 * คืน { sent, failed, to: [...] }
 */
function sendMails_(msgs, meta) {
  var res = { sent: 0, failed: 0, to: [], error: '' };
  if (!CONFIG.SEND_EMAIL) { res.disabled = true; return res; }
  var logs = [];
  (msgs || []).forEach(function (m) {
    if (!m || !m.to || !m.to.length) return;
    var batches = m.kind === 'info' ? m.to.map(function (e) { return [e]; }) : [m.to];
    batches.forEach(function (to) {
      var row = { at: nowIso_(), to: to.join(', '), subject: m.subject, event: m.event || '', projectId: (meta && meta.projectId) || '', ok: true, error: '' };
      try {
        var opt = { to: to.join(','), subject: m.subject, htmlBody: m.html, body: htmlToText_(m.html), name: CONFIG.MAIL_SENDER_NAME };
        if (meta && meta.replyTo && R_().validEmail(meta.replyTo)) opt.replyTo = meta.replyTo;
        MailApp.sendEmail(opt);
        res.sent += to.length;
        res.to = res.to.concat(to);
      } catch (e) {
        row.ok = false;
        row.error = String(e.message || e).slice(0, 300);
        res.failed += to.length;
        res.error = row.error;
      }
      logs.push(row);
    });
  });
  try { if (logs.length) appendRows_('MailLog', logs); } catch (e) { /* ignore */ }
  return res;
}

// =============================================================
// อีเมลอัตโนมัติ: เตือนงานค้าง รายงานประจำวัน/สัปดาห์/เดือน (ตั้งเวลาด้วย installTriggers)
// =============================================================
function localNow_() {
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  return { date: Utilities.formatDate(now, tz, 'yyyy-MM-dd'), hour: +Utilities.formatDate(now, tz, 'H') };
}
function jobLog_() { try { return JSON.parse(prop_('JOB_LOG') || '{}') || {}; } catch (e) { return {}; } }
function markJob_(kind, stamp, res, by) {
  var log = jobLog_();
  log[kind] = stamp;
  log[kind + 'At'] = nowIso_();
  log[kind + 'Res'] = { sent: res ? res.sent : 0, failed: res ? res.failed : 0, skipped: res ? res.skipped || 0 : 0, by: by || 'auto' };
  setProp_('JOB_LOG', JSON.stringify(log));
  return log;
}
function jobStatus_() {
  var handlers = [];
  try { handlers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }); } catch (e) { /* ไม่มีสิทธิ์อ่านตัวตั้งเวลา */ }
  return { triggers: handlers, hourly: handlers.indexOf('hourlyJobs') >= 0, legacy: handlers.indexOf('dailyReminders') >= 0, log: jobLog_(), quota: mailQuota_(), now: localNow_() };
}

/** ผลงาน/แผนของแต่ละโครงการ ณ วันที่ (คำนวณด้วย PTCalc ชุดเดียวกับหน้าเว็บ) */
function progressMap_(projects, boq, ups, settings, iso, prevIso) {
  var out = {};
  projects.forEach(function (p) {
    var items = boq.filter(function (x) { return x.projectId === p.id; }).sort(function (a, b) { return (+a.order || 0) - (+b.order || 0); });
    var u = ups.filter(function (x) { return x.projectId === p.id; });
    try {
      var a = PTCalc.analyze(p, items, u, settings, iso);
      out[p.id] = { actual: a.actual, plan: a.plan, daysLeft: a.daysLeft, prevActual: prevIso ? PTCalc.progressAt(p, items, u, prevIso) : null };
    } catch (e) { out[p.id] = null; }
  });
  return out;
}

/** สร้างรายการอีเมลของงาน kind — o = { date, projectId, settings, appUrl, month } */
function planFor_(kind, o) {
  var R = R_();
  var settings = o.settings || readSettings_();
  var projects = readTable_('Projects').filter(function (p) { return !o.projectId || p.id === o.projectId; });
  var ids = {};
  projects.forEach(function (p) { ids[p.id] = true; });
  var of = function (t) { return readTable_(t).filter(function (r) { return !r.projectId || ids[r.projectId]; }); };
  var c = { projects: projects, settings: settings, nowIso: nowIso_(), today: o.date, appUrl: o.appUrl || appUrl_(null, settings) };
  c.subs = of('Submissions');
  c.reqs = of('Required');
  if (kind === 'reminders') {
    c.meetings = readTable_('Meetings').filter(function (m) { return o.projectId ? m.projectId === o.projectId : true; });
    return R.reminderPlan(c);
  }
  if (kind === 'daily') { c.daily = of('Daily'); return R.dailyPlan(c); }
  var boq = of('BOQ');
  var ups = of('Updates');
  if (kind === 'weekly') {
    c.daily = of('Daily'); c.updates = ups; c.meetings = of('Meetings');
    c.progress = progressMap_(projects, boq, ups, settings, o.date, R.addDaysIso(o.date, -7));
    return R.weeklyPlan(c);
  }
  c.month = /^\d{4}-\d{2}$/.test(String(o.month || '')) ? o.month : R.prevMonth(o.date);
  var end = R.monthEnd(c.month);
  c.progress = progressMap_(projects, boq, ups, settings, end, null);
  var msgs = R.monthlyPlan(c);
  if (o.projectId) {
    // ส่งเฉพาะโครงการเดียว: ให้เจ้าของโครงการ
    var p = projects[0];
    msgs = p ? [{ to: [R.norm(p.ownerEmail)].filter(R.validEmail), kind: 'report', event: 'report-monthly', projectId: p.id,
      subject: '', html: '' }] : [];
    if (msgs.length) {
      var m = R.monthlyReportEmail({ rows: [R.monthRow(p, c.progress[p.id], c.subs, c.reqs, settings, c.month, c.nowIso)], month: c.month, settings: settings, appUrl: c.appUrl });
      msgs[0].subject = m.subject; msgs[0].html = m.html;
    }
  }
  return msgs.filter(function (m) { return m.to && m.to.length; });
}

/** ส่งรายการอีเมล — auto = ส่งตามเวลา (เว้นโควตาไว้ให้การแจ้งเตือนเรื่องขออนุมัติ) */
function runMsgs_(msgs, auto) {
  var res = { sent: 0, failed: 0, skipped: 0, error: '' };
  msgs.forEach(function (m) {
    if (auto && m.kind === 'report') {
      var q = mailQuota_();
      if (q != null && q - m.to.length < CONFIG.MAIL_RESERVE) { res.skipped += m.to.length; return; }
    }
    var r = sendMails_([m], { projectId: m.projectId || '' });
    res.sent += r.sent; res.failed += r.failed;
    if (r.error) res.error = r.error;
    if (r.disabled) res.disabled = true;
  });
  return res;
}

/** ตัวตั้งเวลาหลัก (ทุกชั่วโมง): ส่งงานที่ถึงเวลาและยังไม่ได้ส่งของวันนั้น */
function hourlyJobs() {
  var R = R_();
  var settings = readSettings_();
  var local = localNow_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 'busy';
  var due;
  try {
    // จองงานก่อนส่ง (กันส่งซ้ำเมื่อมีตัวตั้งเวลาซ้อน) แล้วปล่อยล็อกให้ผู้ใช้บันทึกข้อมูลได้ระหว่างส่งอีเมล
    due = R.dueJobs(settings, local, jobLog_());
    due.forEach(function (kind) { markJob_(kind, kind === 'monthly' ? R.prevMonth(local.date) : local.date, null, 'auto'); });
  } finally { lock.releaseLock(); }
  var url = appUrl_(null, settings);
  due.forEach(function (kind) {
    var res;
    try {
      res = runMsgs_(planFor_(kind, { date: local.date, settings: settings, appUrl: url }), true);
    } catch (e) {
      res = { sent: 0, failed: 0, skipped: 0, error: String(e.message || e) };
    }
    markJob_(kind, kind === 'monthly' ? R.prevMonth(local.date) : local.date, res, 'auto');
    Logger.log(kind + ': ส่ง ' + res.sent + ' ไม่สำเร็จ ' + res.failed + ' ข้าม (โควตา) ' + res.skipped + (res.error ? ' — ' + res.error : ''));
  });
  return due.join(',') || 'none';
}

/** เตือนงานค้างทันที (เรียกเองได้จากหน้า Apps Script) */
function dailyReminders() {
  var settings = readSettings_();
  var local = localNow_();
  var res = runMsgs_(planFor_('reminders', { date: local.date, settings: settings }), false);
  markJob_('reminders', local.date, res, 'manual');
  Logger.log('ส่งอีเมลเตือนงานค้าง ' + res.sent + ' ฉบับ');
  return res.sent;
}

/** ตั้งเวลาให้ hourlyJobs ทำงานทุกชั่วโมง (setup เรียกให้อัตโนมัติ) — แทนที่ตัวตั้งเวลา dailyReminders ของเวอร์ชันก่อน */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === 'dailyReminders' || h === 'hourlyJobs') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('hourlyJobs').timeBased().everyHours(1).create();
  var j = R_().jobSettings(readSettings_());
  Logger.log('ตั้งเวลาส่งอีเมลอัตโนมัติแล้ว: เตือนงานค้าง ' + j.reminderHour + ':00 น. · รายงานประจำวัน ' + j.reportHour + ':00 น. · รายงานประจำสัปดาห์ วัน' + R_().WEEKDAYS[j.reportWeekday]);
}

// =============================================================
// โครงการและโฟลเดอร์
// =============================================================
function saveProject_(p, user) {
  if (!p.name) fail_('กรุณาระบุชื่อโครงการ');
  var now = nowIso_();
  var old = p.id ? findById_('Projects', p.id) : null;
  var rec = Object.assign({}, p, {
    id: p.id || newId_('P'),
    createdAt: old ? old.createdAt : (p.createdAt || now),
    createdBy: old ? old.createdBy : (p.createdBy || user || ''),
    updatedAt: now,
  });
  delete rec._mail;
  var folder = projectFolder_(rec);
  rec.folderId = folder.getId();
  rec.folderUrl = folder.getUrl();
  upsert_('Projects', rec);
  return rec;
}

function requireProject_(id) {
  var p = findById_('Projects', id);
  if (!p) fail_('ไม่พบโครงการ (อาจถูกลบไปแล้ว)');
  return p;
}

function rootFolder_() {
  var id = extractId_(CONFIG.ROOT_FOLDER_ID) || prop_('ROOT_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) {
      fail_('เปิดโฟลเดอร์หลักใน Google Drive ไม่ได้ — ตรวจสอบ ROOT_FOLDER_ID และสิทธิ์ของบัญชีที่ติดตั้ง');
    }
  }
  var f = DriveApp.createFolder('ระบบติดตามโครงการ - เอกสาร');
  setProp_('ROOT_FOLDER_ID', f.getId());
  return f;
}

function safeRootUrl_() {
  try { return rootFolder_().getUrl(); } catch (e) { return ''; }
}

function projectFolder_(p) {
  var id = extractId_(p.folderId || '');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) {
      fail_('เปิดโฟลเดอร์ Google Drive ของโครงการไม่ได้ — ตรวจสอบลิงก์และสิทธิ์ของบัญชีที่ติดตั้งระบบ');
    }
  }
  var name = ((p.code ? p.code + ' ' : '') + (p.name || 'โครงการ')).replace(/[\\/]/g, '-').slice(0, 120);
  return rootFolder_().createFolder(name);
}

function categoryFolder_(p, category) {
  var parent = projectFolder_(p);
  var name = String(category || 'อื่นๆ').replace(/[\\/]/g, '-');
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// =============================================================
// ฐานข้อมูลบน Google Sheet
// =============================================================
function ss_() {
  var id = prop_('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var a = SpreadsheetApp.getActiveSpreadsheet();
  if (a) { setProp_('SHEET_ID', a.getId()); return a; }
  fail_('ยังไม่ได้ติดตั้งฐานข้อมูล — เปิด Apps Script แล้วรันฟังก์ชัน setup ก่อน');
}

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  var cols = SCHEMA[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#E7EAE5');
    sh.setFrozenRows(1);
    return sh;
  }
  // เพิ่มคอลัมน์ใหม่ที่ยังไม่มี (เมื่ออัปเดตเวอร์ชัน)
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var missing = cols.filter(function (c) { return head.indexOf(c) < 0; });
  if (missing.length) {
    var start = head.filter(String).length + 1;
    sh.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold').setBackground('#E7EAE5');
  }
  return sh;
}

function header_(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
}

function inList_(map, table, field) { return (map[table] || []).indexOf(field) >= 0; }

/** ประวัติของเรื่องที่ยาวมาก: ย่อความเห็นของรายการเก่า (การกระทำ ผู้ทำ และเวลายังอยู่ครบ) ให้พอดีช่องของ Sheet */
function compactHistory_(list) {
  var j = JSON.stringify(list);
  if (j.length <= 45000) return list;
  var out = JSON.parse(j);
  for (var lim = 600; lim >= 0 && JSON.stringify(out).length > 45000; lim = lim > 100 ? lim - 250 : lim - 100) {
    for (var i = 0; i < out.length - 5; i++) {
      var c = String(out[i].comment || '');
      if (c.length > lim) out[i].comment = lim > 0 ? c.slice(0, lim) + '… (ย่อ)' : '(ย่อ)';
    }
  }
  return out;
}

function toCell_(table, field, v) {
  if (v == null) return '';
  if (table === 'Submissions' && field === 'history' && Array.isArray(v)) v = compactHistory_(v);
  if (inList_(JSON_FIELDS, table, field)) {
    var j = JSON.stringify(v);
    if (j.length > 49000) fail_('ข้อมูล "' + field + '" ยาวเกินกว่าที่ Google Sheet เก็บได้ในช่องเดียว');
    return j;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  var s = String(v);
  // กันไม่ให้ Sheets แปลงข้อความที่หน้าตาเหมือนตัวเลข/วันที่ (เช่น ลำดับ "1.10" หรือวันที่) เป็นชนิดอื่น
  if (/^[\d\s.,:\/+\-]+$/.test(s) || /^(true|false)$/i.test(s) || /^[=+\-@]/.test(s) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return "'" + s;
  return s;
}

function fromCell_(table, field, v) {
  if (v instanceof Date) {
    return inList_(DATE_FIELDS, table, field)
      ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : v.toISOString();
  }
  if (inList_(JSON_FIELDS, table, field)) {
    var empty = field === 'entries' || field === 'weather' || field === 'stoppage' ? {} : (field === 'value' || field === 'rolePerms' || field === 'vote' || field === 'file' ? null : []);
    if (v === '' || v == null) return empty;
    try { return JSON.parse(v); } catch (e) { return empty; }
  }
  if (inList_(NUM_FIELDS, table, field)) return v === '' || v == null ? '' : Number(v);
  if (inList_(BOOL_FIELDS, table, field)) return v === true || String(v).toLowerCase() === 'true';
  return v == null ? '' : String(v);
}

function readTable_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var head = header_(sh);
  var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] == null) continue;
    var o = {};
    for (var c = 0; c < head.length; c++) if (head[c]) o[head[c]] = fromCell_(name, head[c], vals[i][c]);
    out.push(o);
  }
  return out;
}

function toRow_(name, head, obj) {
  return head.map(function (h) { return h ? toCell_(name, h, obj[h]) : ''; });
}

function writeAll_(name, objs) {
  var sh = sheet_(name);
  var head = header_(sh);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, head.length).clearContent();
  if (objs.length) sh.getRange(2, 1, objs.length, head.length).setValues(objs.map(function (o) { return toRow_(name, head, o); }));
}

function appendRows_(name, objs) {
  if (!objs.length) return;
  var sh = sheet_(name);
  var head = header_(sh);
  sh.getRange(sh.getLastRow() + 1, 1, objs.length, head.length).setValues(objs.map(function (o) { return toRow_(name, head, o); }));
}

function findById_(name, id) {
  if (!id) return null;
  var rows = readTable_(name);
  for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
  return null;
}

function upsert_(name, obj) { return upsertKey_(name, 'id', obj); }

function upsertKey_(name, key, obj) {
  var sh = sheet_(name);
  var head = header_(sh);
  var col = head.indexOf(key) + 1;
  var last = sh.getLastRow();
  if (last > 1 && col > 0) {
    var ids = sh.getRange(2, col, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(obj[key])) {
        sh.getRange(i + 2, 1, 1, head.length).setValues([toRow_(name, head, obj)]);
        return obj;
      }
    }
  }
  sh.getRange(last + 1, 1, 1, head.length).setValues([toRow_(name, head, obj)]);
  return obj;
}

function deleteWhere_(name, pred) {
  var rows = readTable_(name);
  var keep = rows.filter(function (r) { return !pred(r); });
  if (keep.length !== rows.length) writeAll_(name, keep);
}

function replaceWhere_(name, pred, newRows) {
  var rows = readTable_(name).filter(function (r) { return !pred(r); });
  writeAll_(name, rows.concat(newRows));
}

function mergeById_(name, incoming) {
  if (!incoming.length) return;
  var rows = readTable_(name);
  var idx = {};
  rows.forEach(function (r, i) { idx[r.id] = i; });
  incoming.forEach(function (r) {
    var clean = {};
    SCHEMA[name].forEach(function (k) { if (r[k] !== undefined) clean[k] = r[k]; });
    if (idx[clean.id] != null) rows[idx[clean.id]] = clean; else { idx[clean.id] = rows.length; rows.push(clean); }
  });
  writeAll_(name, rows);
}

function readSettings_() {
  var o = {};
  readTable_('Settings').forEach(function (r) { if (r.key) o[r.key] = r.value; });
  return o;
}

// =============================================================
// ตัวช่วย
// =============================================================
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }
function accessKey_() { return CONFIG.ACCESS_KEY || prop_('ACCESS_KEY') || ''; }
function num_(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
function newId_(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/** รับได้ทั้ง ID และลิงก์ Google Drive */
function extractId_(s) {
  s = String(s || '').trim();
  if (!s) return '';
  var m = s.match(/\/folders\/([\w-]{10,})/) || s.match(/\/d\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1];
  return /^[\w-]{10,}$/.test(s) ? s : '';
}

// =============================================================
// ติดตั้งครั้งแรก / อัปเดตเวอร์ชัน: เลือกฟังก์ชันนี้แล้วกด "เรียกใช้"
// =============================================================
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.create('ระบบติดตามโครงการ - ฐานข้อมูล');
  }
  setProp_('SHEET_ID', ss.getId());
  Object.keys(SCHEMA).forEach(function (n) { sheet_(n); });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);

  var root = rootFolder_();
  if (!accessKey_()) setProp_('ACCESS_KEY', 'PT-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase());
  var owner = '';
  try { owner = Session.getEffectiveUser().getEmail(); if (owner) setProp_('OWNER_EMAIL', owner); } catch (e) { /* ignore */ }
  var trig = 'ตั้งเวลาส่งอีเมลอัตโนมัติแล้ว (เตือนงานค้าง รายงานประจำวัน/สัปดาห์/เดือน)';
  try { installTriggers(); } catch (e) { trig = 'ตั้งเวลาส่งอีเมลอัตโนมัติไม่สำเร็จ (' + e.message + ') — รันฟังก์ชัน installTriggers ภายหลัง'; }
  var quota = mailQuota_();

  var msg = [
    '================ ติดตั้งเรียบร้อย (เวอร์ชัน ' + VERSION + ') ================',
    'ฐานข้อมูล (Google Sheet): ' + ss.getUrl(),
    'โฟลเดอร์เก็บไฟล์ (Google Drive): ' + root.getUrl(),
    'รหัสเข้าใช้งาน (Access key): ' + accessKey_(),
    'ผู้ดูแลระบบ: ' + (owner || '(บัญชีที่ติดตั้ง)') + (CONFIG.ADMIN_EMAILS ? ', ' + CONFIG.ADMIN_EMAILS : ''),
    trig,
    'โควตาอีเมลคงเหลือวันนี้: ' + (quota == null ? '-' : quota),
    '',
    'ขั้นต่อไป: ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > ประเภท: เว็บแอป',
    '  ดำเนินการในฐานะ: ฉัน | ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน',
    'แล้วนำ URL ของเว็บแอป (ลงท้าย /exec) และรหัสเข้าใช้งานไปใส่ในหน้า "ตั้งค่า" ของเว็บ',
    '(ถ้าอัปเดตจากเวอร์ชันเดิม: จัดการการทำให้ใช้งานได้ > แก้ไข > เวอร์ชันใหม่)',
    '==================================================',
  ].join('\n');
  Logger.log(msg);
  return msg;
}

/** เปลี่ยนรหัสเข้าใช้งานใหม่ (เมื่อรหัสหลุด) — ทุกคนต้องใส่รหัสใหม่ */
function resetAccessKey() {
  setProp_('ACCESS_KEY', 'PT-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase());
  Logger.log('รหัสเข้าใช้งานใหม่: ' + accessKey_() + (CONFIG.ACCESS_KEY ? ' (แต่ CONFIG.ACCESS_KEY ในโค้ดยังมีค่า ระบบจะใช้ค่าในโค้ดก่อน)' : ''));
}

/** ให้ทุกคนออกจากระบบ (เช่น เมื่อเครื่องสูญหาย) */
function logoutEveryone() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var n = 0;
  Object.keys(all).forEach(function (k) { if (k.indexOf('sess_') === 0) { props.deleteProperty(k); n++; } });
  Logger.log('ออกจากระบบทั้งหมด ' + n + ' รายการ');
}

// ===================== CALC BEGIN — คัดลอกจาก assets/js/calc.js (ห้ามแก้ตรงนี้ ให้แก้ที่ calc.js แล้วรัน tools/sync-rules.mjs) =====================
var PTCalc = (function () {
// การคำนวณความคืบหน้า แผนงาน และสถานะโครงการ
// ค่าเปอร์เซ็นต์ภายในระบบเก็บเป็นสัดส่วน 0–1 (แสดงผลค่อยคูณ 100)

const DAY = 864e5;

const METHODS = {
  boq_value: {
    label: 'มูลค่างานตาม BOQ',
    desc: 'ถ่วงน้ำหนักด้วยจำนวนเงินของแต่ละรายการ (ปริมาณ × ราคาต่อหน่วย) วิธีมาตรฐานของงานก่อสร้าง',
  },
  boq_weight: {
    label: 'น้ำหนักงานกำหนดเอง',
    desc: 'ระบุน้ำหนัก (%) ของแต่ละรายการเอง เช่น ตามแผนงานที่ผู้รับจ้างเสนอและได้รับอนุมัติ',
  },
  boq_qty: {
    label: 'จำนวนรายการ (เฉลี่ยเท่ากัน)',
    desc: 'ทุกรายการใน BOQ มีน้ำหนักเท่ากัน เหมาะกับงานที่ราคาไม่สะท้อนปริมาณงาน',
  },
  manual: {
    label: 'กรอกเปอร์เซ็นต์เอง',
    desc: 'ระบุ % ความคืบหน้ารวมเองทุกครั้งที่บันทึก ไม่ต้องใช้ BOQ',
  },
  time: {
    label: 'ตามระยะเวลาสัญญา',
    desc: 'คิดจากจำนวนวันที่ผ่านไปเทียบกับระยะเวลาสัญญา เหมาะกับงานจ้างเหมาบริการรายเดือน',
  },
};

const PRICE_BASIS = {
  total: 'ค่าวัสดุ + ค่าแรง',
  material: 'ค่าวัสดุอย่างเดียว',
  labor: 'ค่าแรงอย่างเดียว',
};

const PLAN_MODES = {
  scurve: { label: 'S-Curve อัตโนมัติ', desc: 'ช่วงแรกและช่วงท้ายงานช้า ช่วงกลางเร่ง ตามลักษณะงานก่อสร้างทั่วไป' },
  linear: { label: 'เส้นตรง', desc: 'ความคืบหน้าตามแผนเพิ่มขึ้นเท่ากันทุกวัน' },
  custom: { label: 'กำหนดจุดแผนงานเอง', desc: 'กรอก % ตามแผนที่วันต่างๆ เช่น จากแผนงานในสัญญา ระบบลากเส้นเชื่อมให้' },
  boq: { label: 'ตามแผนงานรายการ BOQ', desc: 'คำนวณจากวันเริ่ม–วันจบของแต่ละรายการในแท็บแผนงาน ถ่วงน้ำหนักตามมูลค่างาน' },
};

const STATUS = {
  behind: { label: 'ล่าช้ากว่าแผน', tone: 'bad' },
  watch: { label: 'เฝ้าระวัง', tone: 'warn' },
  ontrack: { label: 'ตามแผน', tone: 'ok' },
  ahead: { label: 'เร็วกว่าแผน', tone: 'good' },
  notstarted: { label: 'ยังไม่เริ่ม', tone: 'muted' },
  paused: { label: 'หยุดชั่วคราว', tone: 'muted' },
  done: { label: 'แล้วเสร็จ', tone: 'done' },
  cancelled: { label: 'ยกเลิก', tone: 'muted' },
};
const STATUS_ORDER = ['behind', 'watch', 'ontrack', 'ahead', 'notstarted', 'paused', 'done', 'cancelled'];

// ---------- วันที่ ----------
function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function toISO(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function todayISO() { return toISO(new Date()); }
function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/** จำนวนวันจาก a ถึง b (b − a) */
function diffDays(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / DAY);
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v == null ? '' : v).replace(/[,\s฿]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function timeFraction(p, iso) {
  if (!p.startDate || !p.endDate || !iso) return 0;
  const total = diffDays(p.startDate, p.endDate);
  if (total <= 0) return iso >= p.endDate ? 1 : 0;
  return clamp(diffDays(p.startDate, iso) / total);
}

/** สัปดาห์ที่ของสัญญา: วันที่ 1–7 = สัปดาห์ที่ 1 (รายงานส่งท้ายสัปดาห์) */
function weekNo(p, iso) {
  if (!p.startDate || !iso) return null;
  const d = diffDays(p.startDate, iso);
  return d < 0 ? null : Math.max(1, Math.ceil(d / 7));
}

// ---------- BOQ ----------
function unitPrice(it, basis = 'total') {
  const m = num(it.mat), l = num(it.labor);
  return basis === 'material' ? m : basis === 'labor' ? l : m + l;
}
function amount(it, basis = 'total') {
  return num(it.qty) * unitPrice(it, basis);
}
function boqTotal(items, basis = 'total') {
  return items.reduce((s, i) => s + amount(i, basis), 0);
}

function sortUpdates(ups) {
  return [...ups].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || '')) ||
    String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

/** ปริมาณสะสมของแต่ละรายการ BOQ: { boqId: qty } */
function cumulative(ups) {
  const m = {};
  for (const u of ups) {
    const e = u.entries || {};
    for (const k in e) m[k] = (m[k] || 0) + num(e[k]);
  }
  return m;
}

function ratio(done, qty, allowOver) {
  const q = num(qty);
  if (q <= 0) return 0;
  const r = done / q;
  return allowOver ? Math.max(0, r) : clamp(r);
}

function hasManual(u) {
  return u && u.manualPct !== '' && u.manualPct != null && Number.isFinite(+u.manualPct);
}
function lastManual(ups) {
  for (let i = ups.length - 1; i >= 0; i--) if (hasManual(ups[i])) return +ups[i].manualPct;
  return null;
}

/** ความคืบหน้าจากปริมาณสะสม ตามวิธีคำนวณที่ตั้งไว้ในโครงการ */
function progressFromCum(p, items, cum, manual) {
  const method = p.progressMethod || 'boq_value';
  const ao = !!p.allowOver;
  if (method === 'manual' || !items.length) {
    return manual == null ? 0 : clamp(manual / 100, 0, ao ? 5 : 1);
  }
  if (method === 'boq_qty') {
    const valid = items.filter((i) => num(i.qty) > 0);
    if (!valid.length) return 0;
    return valid.reduce((s, i) => s + ratio(cum[i.id] || 0, i.qty, ao), 0) / valid.length;
  }
  if (method === 'boq_weight') {
    const tw = items.reduce((s, i) => s + num(i.weight), 0);
    if (tw > 0) return items.reduce((s, i) => s + num(i.weight) * ratio(cum[i.id] || 0, i.qty, ao), 0) / tw;
  }
  const basis = p.priceBasis || 'total';
  const tot = boqTotal(items, basis);
  if (tot <= 0) return 0;
  return items.reduce((s, i) => s + amount(i, basis) * ratio(cum[i.id] || 0, i.qty, ao), 0) / tot;
}

function progressAt(p, items, updates, iso) {
  if (p.progressMethod === 'time') return timeFraction(p, iso);
  const ups = sortUpdates(updates).filter((u) => !iso || u.date <= iso);
  return progressFromCum(p, items, cumulative(ups), lastManual(ups));
}

// ---------- แผนงานรายรายการ BOQ (Gantt) ----------
/** วันที่ของสัญญา: วันเริ่มสัญญา = วันที่ 1 */
function dayOf(p, iso) { return p.startDate && iso ? diffDays(p.startDate, iso) + 1 : null; }
function dayToIso(p, n) { return p.startDate && n ? addDays(p.startDate, n - 1) : ''; }
function contractDays(p) { return p.startDate && p.endDate ? diffDays(p.startDate, p.endDate) + 1 : 0; }
function hasPlan(it) { return num(it.ps) > 0 && num(it.pe) > 0; }
function hasSchedule(items) { return (items || []).some(hasPlan); }

/** สัดส่วนงานตามแผนของรายการ ณ สิ้นวันที่ iso (null = ยังไม่ได้วางแผน) */
function itemPlanFrac(p, it, iso) {
  if (!p.startDate || !hasPlan(it)) return null;
  const s = num(it.ps), e = Math.max(num(it.pe), s);
  return clamp((dayOf(p, iso) - s + 1) / (e - s + 1));
}

function weightFn(p, items) {
  const method = p.progressMethod || 'boq_value';
  const basis = p.priceBasis || 'total';
  if (method === 'boq_weight' && items.some((i) => num(i.weight) > 0)) return (i) => num(i.weight);
  if (method === 'boq_qty') return (i) => (num(i.qty) > 0 ? 1 : 0);
  return (i) => amount(i, basis);
}

/** แผนรวมจากตารางงานรายรายการ (null ถ้าไม่มีรายการที่วางแผน) */
function schedulePlan(p, items, iso) {
  const w = weightFn(p, items);
  let tw = 0, tv = 0;
  for (const it of items) {
    const f = itemPlanFrac(p, it, iso);
    if (f == null) continue;
    const wt = w(it);
    tw += wt;
    tv += wt * f;
  }
  return tw > 0 ? tv / tw : null;
}

// ---------- แผนงาน ----------
function planPoints(p) {
  const pts = (p.planPoints || [])
    .filter((x) => x && x.date && x.pct !== '' && x.pct != null)
    .map((x) => ({ date: x.date, v: clamp(num(x.pct) / 100) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (p.startDate && (!pts.length || pts[0].date > p.startDate)) pts.unshift({ date: p.startDate, v: 0 });
  return pts;
}

function planAt(p, iso, items = []) {
  const mode = p.planMode || 'scurve';
  if (mode === 'boq' && items.length) {
    const v = schedulePlan(p, items, iso);
    if (v != null) return v;
  }
  if (mode === 'custom' && (p.planPoints || []).length) {
    const pts = planPoints(p);
    if (iso <= pts[0].date) return pts[0].v;
    for (let i = 1; i < pts.length; i++) {
      if (iso <= pts[i].date) {
        const a = pts[i - 1], b = pts[i];
        const span = diffDays(a.date, b.date) || 1;
        return a.v + (b.v - a.v) * (diffDays(a.date, iso) / span);
      }
    }
    return pts[pts.length - 1].v;
  }
  const t = timeFraction(p, iso);
  return mode === 'linear' ? t : t * t * (3 - 2 * t);
}

function planSeries(p, steps = 60, items = []) {
  if (!p.startDate || !p.endDate) return [];
  const total = diffDays(p.startDate, p.endDate);
  if (total <= 0) return [];
  const dates = new Set();
  for (let i = 0; i <= steps; i++) dates.add(addDays(p.startDate, Math.round((total * i) / steps)));
  if (p.planMode === 'custom') for (const pt of p.planPoints || []) if (pt.date) dates.add(pt.date);
  if (p.planMode === 'boq') {
    for (const it of items) {
      if (!hasPlan(it)) continue;
      dates.add(dayToIso(p, num(it.ps) - 1));
      dates.add(dayToIso(p, Math.max(num(it.pe), num(it.ps))));
    }
  }
  return [...dates].filter((d) => d >= p.startDate).sort().map((date) => ({ date, v: planAt(p, date, items) }));
}

/** ผลงานจริงสะสม ณ แต่ละวันที่มีการบันทึก */
function actualSeries(p, items, updates, today = todayISO()) {
  if (p.progressMethod === 'time') {
    if (!p.startDate || today < p.startDate) return [];
    const end = p.endDate && p.endDate < today ? p.endDate : today;
    return [{ date: p.startDate, v: 0 }, { date: end, v: timeFraction(p, end) }];
  }
  const ups = sortUpdates(updates).filter((u) => u.date);
  const out = [];
  if (p.startDate && (!ups.length || ups[0].date >= p.startDate)) out.push({ date: p.startDate, v: 0 });
  const cum = {};
  let manual = null;
  ups.forEach((u, i) => {
    for (const k in u.entries || {}) cum[k] = (cum[k] || 0) + num(u.entries[k]);
    if (hasManual(u)) manual = +u.manualPct;
    if (i === ups.length - 1 || ups[i + 1].date !== u.date) {
      const v = progressFromCum(p, items, cum, manual);
      if (out.length && out[out.length - 1].date === u.date) out[out.length - 1].v = v;
      else out.push({ date: u.date, v });
    }
  });
  return out;
}

function groupBreakdown(p, items, cum, today = todayISO()) {
  const basis = p.priceBasis || 'total', ao = !!p.allowOver;
  const map = new Map();
  for (const it of items) {
    const g = it.group || 'ไม่ระบุหมวด';
    if (!map.has(g)) map.set(g, { name: g, amount: 0, earned: 0, count: 0, done: 0, items: [] });
    map.get(g).items.push(it);
    const o = map.get(g);
    const a = amount(it, basis);
    const r = ratio(cum[it.id] || 0, it.qty, ao);
    o.amount += a;
    o.earned += a * r;
    o.count++;
    if (r >= 0.999) o.done++;
  }
  return [...map.values()].map((o) => {
    const planned = o.items.filter(hasPlan);
    const ps = planned.length ? Math.min(...planned.map((i) => num(i.ps))) : null;
    const pe = planned.length ? Math.max(...planned.map((i) => Math.max(num(i.pe), num(i.ps)))) : null;
    const { items: _ignored, ...rest } = o;
    return {
      ...rest, pct: o.amount > 0 ? o.earned / o.amount : 0,
      planPct: planned.length ? schedulePlan({ ...p, progressMethod: 'boq_value' }, planned, today) : null,
      ps, pe,
    };
  });
}

/** วิเคราะห์โครงการ ณ วันนี้ */
function analyze(p, items, updates, S, today = todayISO()) {
  const ups = sortUpdates(updates).filter((u) => u.date <= today);
  const cum = cumulative(ups);
  const actual = p.progressMethod === 'time'
    ? timeFraction(p, today)
    : progressFromCum(p, items, cum, lastManual(ups));
  const started = !!p.startDate && today >= p.startDate;
  const planDate = p.endDate && today > p.endDate ? p.endDate : today;
  const plan = started ? planAt(p, planDate, items) : 0;
  const diff = (actual - plan) * 100;
  const last = ups[ups.length - 1] || null;
  const daysLeft = p.endDate ? diffDays(today, p.endDate) : null;
  const totalDays = p.startDate && p.endDate ? diffDays(p.startDate, p.endDate) : null;
  const elapsed = p.startDate ? diffDays(p.startDate, today) : null;
  const total = boqTotal(items, p.priceBasis || 'total');
  const value = num(p.contractValue) || total;
  const earned = value * (p.allowOver ? actual : Math.min(1, actual));
  const watch = num(S && S.watchThreshold != null ? S.watchThreshold : 2), behind = num(S && S.behindThreshold != null ? S.behindThreshold : 5);

  let status;
  if (p.status === 'done') status = 'done';
  else if (p.status === 'cancelled') status = 'cancelled';
  else if (p.status === 'paused') status = 'paused';
  else if (!started) status = 'notstarted';
  else if (daysLeft != null && daysLeft < 0 && actual < 0.999) status = 'behind';
  else if (diff >= watch) status = 'ahead';
  else if (diff > -watch) status = 'ontrack';
  else if (diff > -behind) status = 'watch';
  else status = 'behind';

  const staleDays = last ? diffDays(last.date, today) : (started ? elapsed : null);
  return {
    actual, plan, diff, status, last, cum,
    daysLeft, totalDays, elapsed, started,
    overdue: daysLeft != null && daysLeft < 0 && actual < 0.999 && !['done', 'cancelled'].includes(p.status),
    boqTotal: total, value, earned,
    staleDays, week: weekNo(p, today),
    itemCount: items.length, updateCount: ups.length,
  };
}

/** ภาพรวมหลายโครงการ ถ่วงน้ำหนักด้วยมูลค่าสัญญา */
function portfolio(rows) {
  const live = rows.filter((r) => r.p.status !== 'cancelled');
  let wv = 0, wa = 0, wp = 0, value = 0, earned = 0;
  for (const { a } of live) {
    const w = a.value || 0;
    value += w;
    earned += a.earned;
    if (w > 0) { wv += w; wa += w * Math.min(1, a.actual); wp += w * a.plan; }
  }
  const n = live.length || 1;
  const actual = wv > 0 ? wa / wv : live.reduce((s, r) => s + Math.min(1, r.a.actual), 0) / n;
  const plan = wv > 0 ? wp / wv : live.reduce((s, r) => s + r.a.plan, 0) / n;
  const count = (st) => live.filter((r) => r.a.status === st).length;
  return {
    actual, plan, diff: (actual - plan) * 100, value, earned,
    total: rows.length,
    active: live.filter((r) => r.p.status === 'active').length,
    behind: count('behind'), watch: count('watch'),
    done: count('done'),
  };
}

return { METHODS: METHODS, PRICE_BASIS: PRICE_BASIS, PLAN_MODES: PLAN_MODES, STATUS: STATUS, STATUS_ORDER: STATUS_ORDER, parseISO: parseISO, toISO: toISO, todayISO: todayISO, addDays: addDays, diffDays: diffDays, num: num, timeFraction: timeFraction, weekNo: weekNo, unitPrice: unitPrice, amount: amount, boqTotal: boqTotal, sortUpdates: sortUpdates, cumulative: cumulative, ratio: ratio, progressFromCum: progressFromCum, progressAt: progressAt, dayOf: dayOf, dayToIso: dayToIso, contractDays: contractDays, hasPlan: hasPlan, hasSchedule: hasSchedule, itemPlanFrac: itemPlanFrac, schedulePlan: schedulePlan, planAt: planAt, planSeries: planSeries, actualSeries: actualSeries, groupBreakdown: groupBreakdown, analyze: analyze, portfolio: portfolio };
})();
// ===================== CALC END =====================

// ===================== RULES BEGIN — คัดลอกจาก assets/js/rules.js (ห้ามแก้ตรงนี้ ให้แก้ที่ rules.js แล้วรัน tools/sync-rules.mjs) =====================
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
// ===================== RULES END =====================
