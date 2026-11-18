// เข้าสู่ระบบ (Google Apps Script): ใส่อีเมล → รับรหัส 6 หลักทางอีเมล → ยืนยัน
import { conf, saveConf } from '../config.js';
import { gasBackend } from '../backends/gas.js';
import { esc, icon, openModal, setBusy, toast } from '../ui.js';
import { introBackdrop } from './intro.js';

const R = globalThis.PTRules;
/** 1.0.15 แบบลงทะเบียนขอสิทธิ์ (หลังยืนยันอีเมลแล้ว) */
const SCOPES = ['ทั้งโครงการ', 'งานโยธา/โครงสร้าง', 'งานสถาปัตยกรรม', 'งานระบบไฟฟ้า', 'งานระบบประปาและสุขาภิบาล', 'งานระบบปรับอากาศ/เครื่องกล', 'งานสำรวจ', 'ความปลอดภัย (จป.)', 'งานเอกสาร/ธุรการโครงการ'];
function regFormHTML(email, name, requests, projects) {
  const roles = Object.entries(R.ACCESS_ROLES);
  const st = (requests || []).slice(-5).reverse();
  return `<form id="lg-3" novalidate hidden>
    <div class="login-reg-head">${icon('users')}<div><b>ลงทะเบียนขอสิทธิ์ใช้ระบบ</b><span>อีเมล <b>${esc(email)}</b> ยืนยันแล้ว แต่ยังไม่มีสิทธิ์ — กรอกข้อมูลเพื่อขอสิทธิ์</span></div></div>
    ${st.length ? `<ul class="login-reqs">${st.map((x) => `<li><span class="tag ${x.status === 'approved' ? 'tag-ok' : x.status === 'rejected' ? 'tag-bad' : ''}">${esc(R.ACCESS_STATUS[x.status] || x.status)}</span> ${esc(x.roleLabel)}${x.projectName ? ` · ${esc(x.projectName)}` : ''}${x.reason ? `<small class="muted"> — ${esc(x.reason)}</small>` : ''}</li>`).join('')}</ul>` : ''}
    <label class="field"><span>ชื่อ-นามสกุล</span><input name="name" value="${esc(name)}" maxlength="120" required autocomplete="name"></label>
    <fieldset class="field login-roles"><legend>ตำแหน่งที่ขอ</legend>
      ${roles.map(([k, r], i) => `<label class="check"><input type="radio" name="role" value="${k}"${i === 0 ? ' checked' : ''}><span><b>${esc(r.label)}</b><small>${esc(r.desc)} · อนุมัติโดย${r.by === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ควบคุมงานที่สร้างโครงการ'}</small></span></label>`).join('')}
    </fieldset>
    <div id="lg-proj" hidden>
      ${(projects || []).length ? `<label class="field"><span>โครงการที่ขอเข้าร่วม</span><select name="projectId" required><option value="">— เลือกโครงการ —</option>${projects.map((p) => `<option value="${esc(p.id)}">${esc(p.code ? `${p.code} — ${p.name}` : p.name)}</option>`).join('')}</select></label>`
        : '<label class="field"><span>รหัสโครงการ <small class="muted">ขอจากผู้ควบคุมงานของโครงการ</small></span><input name="projectCode" maxlength="60" placeholder="เช่น CN-69-014"></label>'}
      <label class="field"><span>ขอบเขตงานที่รับผิดชอบ <small class="muted">เลือกหรือพิมพ์เอง</small></span><input name="scope" list="lg-scopes" maxlength="200" placeholder="เช่น งานระบบไฟฟ้า"><datalist id="lg-scopes">${SCOPES.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
    </div>
    <label class="field"><span>หน่วยงาน/บริษัท</span><input name="org" maxlength="200" autocomplete="organization" placeholder="เช่น กฟผ. กอง… หรือ บริษัท … จำกัด"></label>
    <label class="field"><span>โทรศัพท์ <small class="muted">(ไม่บังคับ)</small></span><input name="phone" maxlength="30" inputmode="tel" autocomplete="tel"></label>
    <label class="field"><span>หมายเหตุถึงผู้อนุมัติ <small class="muted">(ไม่บังคับ)</small></span><textarea name="note" rows="2" maxlength="1000"></textarea></label>
    <button class="btn btn-primary btn-block" type="submit">${icon('send')}ส่งคำขอสิทธิ์</button>
    <p class="hint">ได้รับสิทธิ์เฉพาะอีเมลที่ยืนยันแล้วนี้ — ผู้อนุมัติจะได้รับอีเมลแจ้ง และระบบจะแจ้งผลกลับทางอีเมล</p>
  </form>
  <div id="lg-4" hidden class="login-done"></div>`;
}

let open = null;

/** เปิดหน้าต่างเข้าสู่ระบบ — คืน Promise ที่สำเร็จเมื่อเข้าสู่ระบบแล้ว */
export function openLogin({ reason = '' } = {}) {
  if (open) return open;
  open = new Promise((resolve) => {
    let done = false;
    const dropBg = introBackdrop();
    const m = openModal({
      title: 'เข้าสู่ระบบ',
      size: 'sm',
      dismissable: false,
      onClose: () => {
        dropBg();
        if (done) return;
        clearInterval(timer);
        open = null;
        window.dispatchEvent(new Event('pt:login-cancel'));
      },
      body: `<div class="login" id="lg">
        <div class="login-head">${icon('lock')}<div><b>ยืนยันตัวตนด้วยอีเมล</b><span>ระบบใช้อีเมลเพื่อรู้ว่าคุณมีสิทธิ์อะไรในแต่ละโครงการ ไม่ต้องมีรหัสผ่าน</span></div></div>
        ${reason ? `<p class="notice notice-warn">${esc(reason)}</p>` : ''}
        <form id="lg-1" novalidate>
          <label class="field"><span>อีเมลของคุณ</span><input type="email" name="email" value="${esc(conf.email)}" placeholder="name@egat.co.th" autocomplete="email" required autofocus></label>
          <label class="field"><span>ชื่อที่แสดง <small class="muted">(ครั้งแรกเท่านั้น)</small></span><input name="name" value="${esc(conf.user)}" placeholder="เช่น นายสมชาย ใจดี" autocomplete="name"></label>
          <button class="btn btn-primary btn-block" type="submit">${icon('mail')}ส่งรหัสเข้าสู่ระบบทางอีเมล</button>
        </form>
        <form id="lg-2" novalidate hidden>
          <p class="login-sent">ส่งรหัส 6 หลักไปที่ <b id="lg-to"></b> แล้ว<br><small class="muted">ตรวจในกล่องจดหมาย (หรือจดหมายขยะ) รหัสใช้ได้ 10 นาที</small></p>
          <label class="field"><span>รหัสยืนยัน</span><input class="otp" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required></label>
          <button class="btn btn-primary btn-block" type="submit">${icon('check')}เข้าสู่ระบบ</button>
          <div class="login-links"><button type="button" class="btn btn-ghost btn-sm" data-act="back">${icon('chevL')}เปลี่ยนอีเมล</button><button type="button" class="btn btn-ghost btn-sm" data-act="resend">ส่งรหัสอีกครั้ง</button></div>
        </form>
        <div id="lg-reg"></div>
        <p class="hint login-foot">${icon('database')}เชื่อมต่อกับ Google Drive ของทีม · <a class="link" href="#/settings" data-act="settings">เปลี่ยนการเชื่อมต่อ</a></p>
      </div>`,
    });
    const f1 = m.el.querySelector('#lg-1');
    const f2 = m.el.querySelector('#lg-2');
    let email = '';
    let cooldown = 0;
    var timer = null; // eslint-disable-line no-var
    const resendBtn = m.el.querySelector('[data-act="resend"]');
    const tick = () => {
      cooldown--;
      resendBtn.disabled = cooldown > 0;
      resendBtn.textContent = cooldown > 0 ? `ส่งรหัสอีกครั้ง (${cooldown})` : 'ส่งรหัสอีกครั้ง';
      if (cooldown <= 0) clearInterval(timer);
    };
    const send = async (btn) => {
      setBusy(btn, true, 'กำลังส่งรหัส…');
      try {
        const sent = await gasBackend.requestOtp(email);
        m.el.querySelector('#lg-to').textContent = email;
        const regNote = m.el.querySelector('.login-sent .reg-note');
        if (regNote) regNote.remove();
        if (sent?.register) m.el.querySelector('.login-sent').insertAdjacentHTML('beforeend', '<br><small class="reg-note">อีเมลนี้ยังไม่มีสิทธิ์ใช้ระบบ — ยืนยันรหัสแล้วกรอกแบบขอสิทธิ์</small>');
        f1.hidden = true; f2.hidden = false;
        f2.elements.code.value = '';
        f2.elements.code.focus();
        cooldown = 60; clearInterval(timer); timer = setInterval(tick, 1000); tick();
      } catch (e) {
        toast(e.message, 'bad', 8000);
      } finally { setBusy(btn, false); }
    };
    f1.addEventListener('submit', (e) => {
      e.preventDefault();
      email = f1.elements.email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('อีเมลไม่ถูกต้อง', 'bad'); f1.elements.email.focus(); return; }
      conf.email = email;
      if (f1.elements.name.value.trim()) conf.user = f1.elements.name.value.trim();
      saveConf();
      send(f1.querySelector('[type="submit"]'));
    });
    resendBtn.addEventListener('click', () => send(resendBtn));
    m.el.querySelector('[data-act="back"]').addEventListener('click', () => { f2.hidden = true; f1.hidden = false; f1.elements.email.focus(); });
    const code = f2.elements.code;
    code.addEventListener('input', () => {
      code.value = code.value.replace(/\D/g, '').slice(0, 6);
      if (code.value.length === 6) f2.requestSubmit();
    });
    f2.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (code.value.length !== 6) { toast('กรอกรหัส 6 หลัก', 'bad'); return; }
      const btn = f2.querySelector('[type="submit"]');
      setBusy(btn, true, 'กำลังตรวจรหัส…');
      try {
        const r = await gasBackend.verifyOtp(email, code.value, f1.elements.name.value.trim());
        clearInterval(timer);
        if (r.register) { showRegister(r); return; }
        done = true;
        m.close();
        open = null;
        toast(`ยินดีต้อนรับ ${r.me?.name || email}`);
        resolve(r);
      } catch (ex) {
        toast(ex.message, 'bad', 7000);
        setBusy(btn, false);
        if (ex.code === 'otp_expired') { f2.hidden = true; f1.hidden = false; }
        else { code.value = ''; code.focus(); }
      }
    });
    m.el.querySelector('[data-act="settings"]').addEventListener('click', () => { clearInterval(timer); done = true; m.close(); open = null; });
    // ---------- 1.0.15 ลงทะเบียนขอสิทธิ์ ----------
    function showRegister(r) {
      const box = m.el.querySelector('#lg-reg');
      box.innerHTML = regFormHTML(r.email, f1.elements.name.value.trim() || conf.user || '', r.requests, r.projects);
      f2.hidden = true;
      const f3 = box.querySelector('#lg-3');
      f3.hidden = false;
      const proj = box.querySelector('#lg-proj');
      const sync = () => {
        const role = f3.querySelector('[name="role"]:checked')?.value;
        proj.hidden = !(R.ACCESS_ROLES[role] && R.ACCESS_ROLES[role].by === 'owner');
      };
      f3.addEventListener('change', sync);
      sync();
      f3.elements.name.focus();
      f3.addEventListener('submit', async (e) => {
        e.preventDefault();
        const role = f3.querySelector('[name="role"]:checked')?.value || '';
        const pick = f3.elements.projectId, codeIn = f3.elements.projectCode;
        const req = {
          role, name: f3.elements.name.value.trim(), org: f3.elements.org.value.trim(), phone: f3.elements.phone.value.trim(), note: f3.elements.note.value.trim(),
          projectId: proj.hidden || !pick ? '' : pick.value, projectCode: proj.hidden || !codeIn ? '' : codeIn.value.trim(), scope: proj.hidden ? '' : f3.elements.scope.value.trim(),
        };
        if (!req.name) { toast('กรุณาระบุชื่อ-นามสกุล', 'bad'); f3.elements.name.focus(); return; }
        if (!proj.hidden && !req.projectId && !req.projectCode) { toast('กรุณาเลือกโครงการที่ขอเข้าร่วม', 'bad'); (pick || codeIn).focus(); return; }
        const btn = f3.querySelector('[type="submit"]');
        setBusy(btn, true, 'กำลังส่งคำขอ…');
        try {
          const res = await gasBackend.requestAccess(r.ticket, req);
          const by = R.ACCESS_ROLES[role]?.by === 'admin' ? 'ผู้ดูแลระบบ' : `ผู้ควบคุมงานที่สร้างโครงการ ${res.project || ''}`.trim();
          f3.hidden = true;
          const done4 = box.querySelector('#lg-4');
          done4.hidden = false;
          done4.innerHTML = `<p class="notice notice-ok">${icon('check')}<span><b>ส่งคำขอแล้ว</b> — รอ${esc(by)}อนุมัติ${res.notified ? ' (แจ้งทางอีเมลแล้ว)' : ''} เมื่ออนุมัติแล้วระบบจะส่งอีเมลแจ้ง จากนั้นเข้าสู่ระบบด้วยอีเมลนี้ได้เลย</span></p><button type="button" class="btn btn-block" data-act="reg-close">ปิด</button>`;
          done4.querySelector('[data-act="reg-close"]').addEventListener('click', () => { m.close(); });
          done4.querySelector('[data-act="reg-close"]').focus();
        } catch (ex) {
          toast(ex.message, 'bad', 8000);
          setBusy(btn, false);
          if (ex.code === 'otp_expired') { box.innerHTML = ''; f1.hidden = false; }
        }
      });
    }
  });
  return open;
}
