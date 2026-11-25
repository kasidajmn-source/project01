// แท็บตั้งค่าโครงการ: ข้อมูลทั่วไป วิธีคำนวณ แผนงาน หมวดเอกสาร โฟลเดอร์เก็บไฟล์
import { store } from '../store.js';
import { METHODS, PRICE_BASIS, PLAN_MODES, planSeries, num, hasPlan } from '../calc.js';
import { esc, icon, toast, confirmBox, setBusy, guard, emptyState, safeUrl } from '../ui.js';
import { projectFieldsHTML, bindDateSync, readProjectFields, validateProject, rememberType } from './project-form.js';
import { mountSCurve } from '../charts.js';
import { openSignMaker } from '../sign.js';

const R = globalThis.PTRules;

export function renderProjectSettings(el, ctx) {
  const { p } = ctx;
  if (!store.can(p, 'editProject') && !store.can(p, 'deleteProject')) {
    el.innerHTML = `<section class="panel">${emptyState({ ic: 'lock', title: 'คุณไม่มีสิทธิ์แก้ไขการตั้งค่าโครงการนี้', text: 'เจ้าของโครงการหรือผู้ควบคุมงานเป็นผู้แก้ไขข้อมูลโครงการ' })}</section>`;
    return;
  }
  if (!store.can(p, 'editProject')) {
    el.innerHTML = `<section class="panel danger-zone"><header class="panel-head"><h2>ลบโครงการ</h2></header>
      <p>คุณเป็นผู้ดูแลระบบ จึงลบโครงการนี้ได้ แต่แก้ไขข้อมูลโครงการไม่ได้</p>
      <button type="button" class="btn btn-danger" data-act="delete">${icon('trash')}ลบโครงการนี้</button></section>`;
    bindDelete(el, p);
    return;
  }
  const d = { ...p, planPoints: [...(p.planPoints || [])], docCategories: [...(p.docCategories || [])], installments: (p.installments || []).map((x) => ({ ...x })) };
  const instOld = store.mode === 'gas' && store.serverOutdated('1.0.17');

  el.innerHTML = `
  <form class="settings" id="ps" novalidate>
    <section class="panel">
      <header class="panel-head"><h2>ข้อมูลโครงการ</h2><button type="button" class="btn btn-sm" data-act="sign" title="ป้ายแสดงรายละเอียดงานก่อสร้าง — ไฟล์ขนาดจริงส่งร้านทำป้าย">${icon('image')}ป้ายโครงการ</button></header>
      ${projectFieldsHTML(d, { full: true })}
    </section>

    <section class="panel">
      <header class="panel-head"><h2>คิดความคืบหน้าจากอะไร</h2></header>
      <div class="opt-cards">${Object.entries(METHODS).map(([k, m]) => `
        <label class="opt"><input type="radio" name="progressMethod" value="${k}" ${(d.progressMethod || 'boq_value') === k ? 'checked' : ''}>
          <span><b>${m.label}</b><small>${m.desc}</small></span></label>`).join('')}
      </div>
      <div class="form-grid" id="boq-opts">
        <label class="field"><span>ราคาที่ใช้ถ่วงน้ำหนัก</span>
          <select name="priceBasis">${Object.entries(PRICE_BASIS).map(([k, v]) => `<option value="${k}" ${(d.priceBasis || 'total') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <small class="hint">ใช้กับวิธี "มูลค่างานตาม BOQ"</small></label>
        <label class="check check-block"><input type="checkbox" name="allowOver" ${d.allowOver ? 'checked' : ''}>
          <span>นับปริมาณที่ทำเกิน BOQ<small>ปกติระบบนับสูงสุด 100% ต่อรายการ เปิดตัวเลือกนี้เมื่อมีงานเพิ่มที่ต้องการให้สะท้อนในเปอร์เซ็นต์</small></span></label>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head"><h2>แผนงาน (เส้นอ้างอิงใน S-Curve)</h2></header>
      <div class="opt-cards">${Object.entries(PLAN_MODES).map(([k, m]) => `
        <label class="opt"><input type="radio" name="planMode" value="${k}" ${(d.planMode || 'scurve') === k ? 'checked' : ''}>
          <span><b>${m.label}</b><small>${m.desc}</small></span></label>`).join('')}
      </div>
      <div id="pp-box"></div>
      <div id="pp-chart" class="pp-chart"></div>
    </section>

    <section class="panel" id="inst-panel">
      <header class="panel-head"><h2>งวดงานและแผนการเบิกจ่าย</h2></header>
      ${instOld ? `<p class="notice notice-warn">${icon('alert')}<span>Code.gs ยังเป็นเวอร์ชัน ${esc(store.meta.version || 'เก่า')} — ต้องอัปเดต Code.gs เป็น 1.0.17 ก่อน จึงจะบันทึกงวดงานได้</span></p>` : ''}
      <p class="hint">ใช้ในใบส่งงวดงาน (F-04-03-09): ราคาต่องวด = มูลค่าสัญญา × ร้อยละการเบิก (ว่าง = เท่ากับร้อยละของงาน) · วันที่ = วันที่ผลงานต้องถึงเกณฑ์ของงวด</p>
      <div id="inst-box"></div>
    </section>

    <section class="panel">
      <header class="panel-head"><h2>หมวดเอกสารของโครงการ</h2></header>
      <ul class="catedit" id="cats"></ul>
      <div class="row-actions"><input id="newcat" placeholder="ชื่อหมวดใหม่" aria-label="ชื่อหมวดใหม่"><button type="button" class="btn" data-act="addcat">${icon('plus')}เพิ่มหมวด</button></div>
      <p class="hint">เปลี่ยนชื่อหมวดที่มีไฟล์อยู่แล้ว ไฟล์เดิมจะยังแสดงในชื่อหมวดเดิมจนกว่าจะย้าย</p>
    </section>

    <section class="panel">
      <header class="panel-head"><h2>โฟลเดอร์เก็บไฟล์ (${esc(store.fileHost)})</h2></header>
      ${store.cloud ? `
        ${safeUrl(p.folderUrl) ? `<p><a class="link" href="${esc(safeUrl(p.folderUrl))}" target="_blank" rel="noopener noreferrer">${icon('folder')}เปิดโฟลเดอร์ของโครงการใน ${esc(store.fileHost)}</a></p>` : ''}
        ${store.mode === 'gas' && !store.me.isAdmin ? `<p class="hint">${icon('lock')}การเปลี่ยนไปใช้โฟลเดอร์อื่นทำได้เฉพาะผู้ดูแลระบบ</p>` : `
        <label class="field"><span>เปลี่ยนไปใช้โฟลเดอร์อื่น (วางลิงก์โฟลเดอร์${store.backend.id === 'gas' ? ' หรือ ID' : ''} ใน ${esc(store.fileHost)})</span>
          <input name="folderId" value="" placeholder="${store.backend.id === 'gas' ? 'https://drive.google.com/drive/folders/…' : 'https://องค์กร.sharepoint.com/:f:/s/ไซต์/…'}"></label>
        <p class="hint">เว้นว่างไว้เพื่อใช้โฟลเดอร์เดิม ถ้าเปลี่ยน ${store.backend.id === 'gas' ? 'บัญชีที่ติดตั้งระบบ' : 'ทุกคนในทีม'}ต้องมีสิทธิ์แก้ไขโฟลเดอร์นั้น ไฟล์เดิมจะยังอยู่ที่โฟลเดอร์เก่า</p>`}`
        : '<p class="muted">โหมดทดลองเก็บไฟล์ในเบราว์เซอร์ เชื่อมต่อ Google Drive, SharePoint หรือ OneDrive ที่หน้า <a class="link" href="#/settings">ตั้งค่า</a> เพื่อเก็บไฟล์ออนไลน์</p>'}
    </section>

    ${store.can(p, 'deleteProject') ? `<section class="panel danger-zone">
      <header class="panel-head"><h2>ลบโครงการ</h2></header>
      <p>ลบโครงการ รายการ BOQ บันทึกความคืบหน้า และรายชื่อไฟล์ออกจากระบบ ${store.cloud ? `ไฟล์ใน ${esc(store.fileHost)} จะยังอยู่ในโฟลเดอร์เดิม` : 'ไฟล์ที่เก็บในเบราว์เซอร์จะถูกลบด้วย'}</p>
      <button type="button" class="btn btn-danger" data-act="delete">${icon('trash')}ลบโครงการนี้</button>
    </section>` : ''}

    <div class="save-bar"><span class="muted" id="dirty-note"></span><button class="btn btn-primary" type="submit" data-act="save">${icon('check')}บันทึกการตั้งค่า</button></div>
  </form>`;

  const form = el.querySelector('#ps');
  bindDateSync(form);
  const markDirty = () => { guard.dirty = true; el.querySelector('#dirty-note').textContent = 'มีการแก้ไขที่ยังไม่บันทึก'; };
  form.addEventListener('input', markDirty);

  const boqOpts = el.querySelector('#boq-opts');
  const syncMethod = () => { boqOpts.hidden = ['manual', 'time'].includes(form.elements.progressMethod.value); };
  form.querySelectorAll('[name="progressMethod"]').forEach((r) => r.addEventListener('change', syncMethod));
  syncMethod();

  // ---------- แผนงาน ----------
  const drawPlan = () => {
    const box = el.querySelector('#pp-box');
    const mode = form.elements.planMode.value;
    if (mode === 'custom') {
      if (!d.planPoints.length) d.planPoints.push({ date: form.elements.endDate.value || '', pct: 100 });
      box.innerHTML = `<table class="pp"><thead><tr><th>วันที่</th><th class="r">% ตามแผน (สะสม)</th><th></th></tr></thead>
        <tbody>${d.planPoints.map((pt, i) => `<tr>
          <td><input type="date" data-pi="${i}" data-pf="date" value="${esc(pt.date)}"></td>
          <td class="r"><input data-pi="${i}" data-pf="pct" value="${esc(pt.pct)}" inputmode="decimal"></td>
          <td><button type="button" class="icon-btn danger" data-prm="${i}" aria-label="ลบจุด">${icon('trash')}</button></td></tr>`).join('')}</tbody></table>
        <div class="row-actions"><button type="button" class="btn btn-sm" data-act="addpt">${icon('plus')}เพิ่มจุดแผนงาน</button></div>
        <p class="hint">กรอกจากแผนงานในสัญญา เช่น สิ้นเดือนแรก 8% สิ้นเดือนที่สอง 20% … ระบบเริ่มที่ 0% ณ วันเริ่มสัญญาให้อัตโนมัติ</p>`;
      box.querySelectorAll('[data-pi]').forEach((inp) => inp.addEventListener('change', () => {
        d.planPoints[+inp.dataset.pi][inp.dataset.pf] = inp.dataset.pf === 'pct' ? num(inp.value) : inp.value;
        drawChart();
      }));
      box.querySelectorAll('[data-prm]').forEach((b) => b.addEventListener('click', () => { d.planPoints.splice(+b.dataset.prm, 1); markDirty(); drawPlan(); }));
      box.querySelector('[data-act="addpt"]').addEventListener('click', () => { d.planPoints.push({ date: '', pct: '' }); markDirty(); drawPlan(); });
    } else if (mode === 'boq') {
      const n = store.boqOf(p.id).filter(hasPlan).length;
      box.innerHTML = n
        ? `<p class="hint">${icon('calendar')}ใช้แผนงานของ ${n} รายการ BOQ ที่กำหนดวันไว้แล้ว — แก้ไขได้ที่ <a class="link" href="#/p/${encodeURIComponent(p.id)}/boq/plan">BOQ › แผนงาน</a></p>`
        : `<div class="notice notice-warn">${icon('alert')}<div><b>ยังไม่ได้กำหนดแผนงานรายรายการ</b><span>ระบบจะใช้ S-Curve อัตโนมัติไปก่อน กำหนดวันเริ่ม–วันจบของแต่ละรายการได้ที่ <a class="link" href="#/p/${encodeURIComponent(p.id)}/boq/plan">BOQ › แผนงาน</a></span></div></div>`;
    } else box.innerHTML = '';
    drawChart();
  };
  const drawChart = () => {
    const tmp = { ...d, planMode: form.elements.planMode.value, startDate: form.elements.startDate.value, endDate: form.elements.endDate.value };
    mountSCurve(el.querySelector('#pp-chart'), { plan: planSeries(tmp, 60, store.boqOf(p.id)), actual: [], start: tmp.startDate, end: tmp.endDate, height: 180, compact: true });
  };
  form.querySelectorAll('[name="planMode"]').forEach((r) => r.addEventListener('change', drawPlan));
  form.elements.startDate.addEventListener('change', drawChart);
  form.elements.endDate.addEventListener('change', drawChart);
  drawPlan();

  // ---------- 1.0.17 งวดงาน ----------
  const money = (v) => (+v || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const drawInst = () => {
    const box = el.querySelector('#inst-box');
    const cv = num(form.elements.contractValue?.value ?? d.contractValue);
    const rows = d.installments;
    const payOf = (x) => (x.payPct !== '' && x.payPct != null ? num(x.payPct) : num(x.workPct));
    const sumW = rows.reduce((a, x) => a + num(x.workPct), 0);
    const sumP = rows.reduce((a, x) => a + payOf(x), 0);
    let acc = 0;
    box.innerHTML = `${rows.length ? `<div class="table-wrap"><table class="pp inst"><thead><tr><th>งวดที่</th><th>รายละเอียดงานของงวด</th><th class="r">ร้อยละของงาน</th><th class="r">ร้อยละการเบิก</th><th>วันที่ผลงานถึงเกณฑ์</th><th class="r">ราคาต่องวด (บาท)</th><th class="r">ราคางานสะสม</th><th></th></tr></thead>
      <tbody>${rows.map((x, i) => { const amt = (cv * payOf(x)) / 100; acc += amt; return `<tr>
        <td class="c num">${i + 1}</td>
        <td><input data-ii="${i}" data-if="desc" value="${esc(x.desc || '')}" maxlength="300" placeholder="เช่น งานฐานรากและตอม่อแล้วเสร็จ" aria-label="รายละเอียดงานงวดที่ ${i + 1}"></td>
        <td class="r"><input data-ii="${i}" data-if="workPct" value="${esc(x.workPct ?? '')}" inputmode="decimal" aria-label="ร้อยละของงาน งวดที่ ${i + 1}"></td>
        <td class="r"><input data-ii="${i}" data-if="payPct" value="${esc(x.payPct ?? '')}" inputmode="decimal" placeholder="${esc(x.workPct ?? '')}" aria-label="ร้อยละการเบิก งวดที่ ${i + 1}"></td>
        <td><input type="date" data-ii="${i}" data-if="due" value="${esc(x.due || '')}" aria-label="วันที่ผลงานถึงเกณฑ์ งวดที่ ${i + 1}"></td>
        <td class="r num">${cv ? money(amt) : '–'}</td><td class="r num">${cv ? money(acc) : '–'}</td>
        <td><button type="button" class="icon-btn danger" data-irm="${i}" aria-label="ลบงวดที่ ${i + 1}">${icon('trash')}</button></td></tr>`; }).join('')}</tbody>
      <tfoot><tr><td></td><td class="r">รวม</td><td class="r num ${Math.abs(sumW - 100) > 0.01 ? 'is-bad' : ''}">${sumW.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%</td><td class="r num ${Math.abs(sumP - 100) > 0.01 ? 'is-bad' : ''}">${sumP.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%</td><td></td><td class="r num">${cv ? money(acc) : ''}</td><td></td><td></td></tr></tfoot></table></div>
      ${Math.abs(sumW - 100) > 0.01 || Math.abs(sumP - 100) > 0.01 ? `<p class="hint is-bad">${icon('alert')}ร้อยละรวมควรเท่ากับ 100%</p>` : ''}` : '<p class="muted small">ยังไม่มีงวดงาน — เพิ่มตามงวดในสัญญา</p>'}
      <div class="row-actions"><button type="button" class="btn btn-sm" data-act="addinst"${rows.length >= R.INSTALL_MAX ? ' disabled' : ''}>${icon('plus')}เพิ่มงวด</button>
        ${!rows.length ? `<label class="field field-inline"><span>หรือแบ่งเท่ากัน</span><select data-act="splitinst"><option value="">— จำนวนงวด —</option>${[2, 3, 4, 5, 6, 8, 10, 12].map((n) => `<option value="${n}">${n} งวด</option>`).join('')}</select></label>` : ''}</div>`;
  };
  el.querySelector('#inst-box').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.act === 'splitinst' && +t.value) {
      const n = +t.value;
      const each = Math.floor((100 / n) * 100) / 100;
      d.installments = Array.from({ length: n }, (_, i) => ({ desc: '', workPct: i === n - 1 ? Math.round((100 - each * (n - 1)) * 100) / 100 : each, payPct: '', due: '' }));
      markDirty(); drawInst(); return;
    }
    if (t.dataset.ii == null) return;
    d.installments[+t.dataset.ii][t.dataset.if] = t.value.trim();
    markDirty(); drawInst();
    el.querySelector(`[data-ii="${t.dataset.ii}"][data-if="${t.dataset.if}"]`)?.focus();
  });
  el.querySelector('#inst-box').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-irm]');
    if (rm) { d.installments.splice(+rm.dataset.irm, 1); markDirty(); drawInst(); return; }
    if (e.target.closest('[data-act="addinst"]')) {
      d.installments.push({ desc: '', workPct: '', payPct: '', due: '' });
      markDirty(); drawInst();
      el.querySelector(`[data-ii="${d.installments.length - 1}"][data-if="desc"]`)?.focus();
    }
  });
  form.elements.contractValue?.addEventListener('change', drawInst);
  drawInst();
  el.querySelector('[data-act="sign"]').addEventListener('click', () => openSignMaker(store.project(p.id) || p));

  // ---------- หมวดเอกสาร ----------
  const drawCats = () => {
    const ul = el.querySelector('#cats');
    ul.innerHTML = d.docCategories.map((c, i) => `<li>
      ${icon('folder')}<input value="${esc(c)}" data-ci="${i}" aria-label="ชื่อหมวด">
      <button type="button" class="icon-btn" data-cmv="${i}" data-dir="-1" aria-label="เลื่อนขึ้น">${icon('arrowUp')}</button>
      <button type="button" class="icon-btn" data-cmv="${i}" data-dir="1" aria-label="เลื่อนลง">${icon('arrowDown')}</button>
      <button type="button" class="icon-btn danger" data-crm="${i}" aria-label="ลบหมวด">${icon('trash')}</button></li>`).join('');
    ul.querySelectorAll('[data-ci]').forEach((inp) => inp.addEventListener('input', () => { d.docCategories[+inp.dataset.ci] = inp.value.trim(); }));
    ul.querySelectorAll('[data-crm]').forEach((b) => b.addEventListener('click', () => {
      const name = d.docCategories[+b.dataset.crm];
      const n = store.filesOf(p.id).filter((f) => f.category === name).length;
      if (n) toast(`หมวด "${name}" มีไฟล์อยู่ ${n} ไฟล์ — ไฟล์จะยังแสดงอยู่ในรายการ`, 'info', 5000);
      d.docCategories.splice(+b.dataset.crm, 1); markDirty(); drawCats();
    }));
    ul.querySelectorAll('[data-cmv]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.cmv, j = i + +b.dataset.dir;
      if (j < 0 || j >= d.docCategories.length) return;
      [d.docCategories[i], d.docCategories[j]] = [d.docCategories[j], d.docCategories[i]];
      markDirty(); drawCats();
    }));
  };
  drawCats();
  const addCat = () => {
    const inp = el.querySelector('#newcat');
    const v = inp.value.trim();
    if (!v) return;
    if (d.docCategories.includes(v)) { toast('มีหมวดนี้อยู่แล้ว', 'bad'); return; }
    d.docCategories.push(v); inp.value = ''; markDirty(); drawCats();
  };
  el.querySelector('[data-act="addcat"]').addEventListener('click', addCat);
  el.querySelector('#newcat').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } });

  // ---------- ลบ ----------
  bindDelete(el, p);

  // ---------- บันทึก ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = readProjectFields(form, d);
    out.progressMethod = form.elements.progressMethod.value;
    out.priceBasis = form.elements.priceBasis.value;
    out.allowOver = form.elements.allowOver.checked;
    out.planMode = form.elements.planMode.value;
    out.planPoints = out.planMode === 'custom' ? d.planPoints.filter((x) => x.date && x.pct !== '').map((x) => ({ date: x.date, pct: num(x.pct) })) : d.planPoints;
    out.docCategories = [...new Set(d.docCategories.filter(Boolean))];
    out.installments = R.cleanInstallments(d.installments);
    if (form.elements.folderId && form.elements.folderId.value.trim()) out.folderId = form.elements.folderId.value.trim();
    const err = validateProject(out);
    if (err) { toast(err, 'bad'); return; }
    if (out.planMode === 'custom' && !out.planPoints.length) { toast('เพิ่มจุดแผนงานอย่างน้อย 1 จุด', 'bad'); return; }
    if (out.progressMethod === 'boq_weight' && !store.boqOf(p.id).some((i) => num(i.weight) > 0)) {
      toast('ยังไม่ได้กำหนดน้ำหนักงานใน BOQ — ระบบจะใช้มูลค่างานแทนจนกว่าจะกำหนด', 'info', 6000);
    }
    const btn = el.querySelector('[data-act="save"]');
    setBusy(btn, true, 'กำลังบันทึก…');
    try {
      await store.saveProject(out);
      await rememberType(out.type);
      guard.dirty = false;
      toast('บันทึกการตั้งค่าแล้ว');
      ctx.rerender();
    } catch (ex) { toast(ex.message, 'bad', 6000); setBusy(btn, false); }
  });
}

function bindDelete(el, p) {
  el.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
    const nSubs = store.subsOf(p.id).length;
    if (!(await confirmBox({ title: 'ลบโครงการ', message: `ลบ "${esc(p.name)}" และข้อมูลทั้งหมดของโครงการ${nSubs ? ` รวมเรื่องขออนุมัติ ${nSubs} เรื่อง` : ''}? การลบนี้ย้อนกลับไม่ได้`, ok: 'ลบโครงการ', danger: true }))) return;
    try { await store.deleteProject(p.id); guard.dirty = false; toast('ลบโครงการแล้ว'); location.hash = '#/projects'; }
    catch (e) { toast(e.message, 'bad'); }
  });
}
