// คลังแบบฟอร์มและระเบียบ (1.0.5): มาตรฐานกลางของหน่วยงาน — ทุกโครงการใช้ชุดเดียวกัน
// - แบบฟอร์มในระบบ (PT-F01…F06) พิมพ์ได้ทันที กรอกข้อมูลโครงการให้อัตโนมัติ
// - เอกสารที่ผู้ดูแลระบบอัปโหลด/ใส่ลิงก์ แยกตามประเภท ประเภทงาน และงานที่ใช้ (แสดงตามจุดใช้งานในแต่ละหน้า)
import { store } from '../store.js';
import { esc, fmt, icon, emptyState, toast, confirmBox, openModal, setBusy, fileBadge } from '../ui.js';
import { pageHead } from './common.js';
import { FORMS, openForm } from '../forms.js';
import { preview } from './tab-docs.js';

const R = globalThis.PTRules;
const st = { kind: '', q: '', work: '' };
const KIND_IC = { form: 'clipboard', regulation: 'shield', standard: 'book', manual: 'book', checklist: 'list' };

/** ชุดอ้างอิงเริ่มต้น (ลิงก์หน้าหลักของหน่วยงานที่ออกกฎหมาย/มาตรฐาน — ผู้ดูแลควรอัปโหลดไฟล์ฉบับที่หน่วยงานใช้จริงเพิ่ม) */
const STARTER = [
  { title: 'กฎหมาย ระเบียบ และหนังสือเวียนด้านการจัดซื้อจัดจ้าง (กรมบัญชีกลาง)', kind: 'regulation', url: 'https://www.gprocurement.go.th/', uses: ['all'], note: 'พ.ร.บ. การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ระเบียบกระทรวงการคลังฯ พ.ศ. 2560 และหนังสือเวียนที่เกี่ยวข้อง — ตรวจฉบับแก้ไขล่าสุดก่อนใช้' },
  { title: 'ราชกิจจานุเบกษา — ตรวจสอบกฎหมายและประกาศฉบับล่าสุด', kind: 'regulation', url: 'https://ratchakitcha.soc.go.th/', uses: ['all'] },
  { title: 'มาตรฐานและคู่มือวิศวกรรม (วิศวกรรมสถานแห่งประเทศไทยฯ)', kind: 'standard', url: 'https://eit.or.th/', uses: ['all'], note: 'เช่น มาตรฐานงานคอนกรีต โครงสร้างเหล็ก งานระบบ' },
  { title: 'สภาวิศวกร — ข้อบังคับและจรรยาบรรณวิชาชีพ', kind: 'regulation', url: 'https://www.coe.or.th/', uses: ['all'] },
];

export function libItemHTML(it, { admin = false, compact = false } = {}) {
  const uses = (it.uses || ['all']).filter((u) => u !== 'all').map((u) => `<span class="tag tag-ghost">${esc(R.LIB_USE[u] || u)}</span>`).join('');
  const meta = [
    it.version ? `ฉบับ ${esc(it.version)}` : '',
    it.effective ? `มีผล ${fmt.date(it.effective)}` : '',
    it.workType ? esc(it.workType) : '',
    it.category ? `หมวด: ${esc(it.category)}` : '',
  ].filter(Boolean).join(' <span class="sep"></span> ');
  const badge = it.file ? fileBadge({ name: it.file.name, mime: it.file.mime }) : `<span class="fbadge fb-link">${icon('link')}</span>`;
  return `<li class="lib-item ${it.active === false ? 'is-off' : ''}" data-id="${esc(it.id)}">
    ${compact ? `<span class="lib-ic">${icon(KIND_IC[it.kind] || 'file')}</span>` : badge}
    <button class="f-name" data-open="${esc(it.id)}"><b>${esc(it.title)}</b>${!compact && (meta || it.note) ? `<small>${meta}${meta && it.note ? '<br>' : ''}${esc(it.note || '')}</small>` : ''}</button>
    ${!compact ? `<span class="lib-tags"><span class="tag">${esc(R.LIB_KINDS[it.kind] || it.kind)}</span>${uses}${it.audience === 'internal' ? `<span class="tag tag-ghost" title="ผู้รับจ้างไม่เห็นรายการนี้">${icon('lock')}เฉพาะเจ้าหน้าที่</span>` : ''}${it.active === false ? '<span class="tag tag-ghost">ปิดใช้</span>' : ''}</span>` : ''}
    <span class="row-tools">
      <button class="icon-btn" data-open="${esc(it.id)}" title="${it.file ? 'เปิดดู' : 'เปิดลิงก์'}" aria-label="เปิด">${icon(it.file ? 'eye' : 'external')}</button>
      ${admin ? `<button class="icon-btn" data-edit="${esc(it.id)}" title="แก้ไข" aria-label="แก้ไข">${icon('edit')}</button>
      <button class="icon-btn danger" data-del="${esc(it.id)}" title="ลบ" aria-label="ลบ">${icon('trash')}</button>` : ''}
    </span>
  </li>`;
}

export function openLibItem(it) {
  if (!it) return;
  if (it.file && (it.file.driveId || it.file.localBlob)) preview({ ...it.file, id: it.file.id || it.id, note: it.note || '' });
  else if (/^https?:\/\//i.test(it.url || '')) window.open(it.url, '_blank', 'noopener');
}

/**
 * กล่อง "แบบฟอร์มและระเบียบที่เกี่ยวข้อง" สำหรับวางในหน้าต่างๆ
 * use: sub | daily | weekly | meeting | required | handover ; forms: [[kind, label, ctx]] แบบฟอร์มในระบบที่พิมพ์ได้จากจุดนี้
 */
export function libraryBox({ use, category = '', workType = '', forms = [], title = 'แบบฟอร์มและระเบียบที่เกี่ยวข้อง' }) {
  const items = store.libraryFor(use, category, workType).filter((x) => !(x.uses || []).includes('all') || (x.uses || []).length > 1 || x.kind === 'form').slice(0, 8);
  if (!items.length && !forms.length) return '';
  return `<section class="panel lib-box" data-libbox>
    <h3 class="lib-box-h">${icon('book')}${esc(title)}</h3>
    ${forms.length ? `<div class="lib-forms-mini">${forms.map(([k, label], i) => `<button type="button" class="lf-row" data-form="${i}" title="พิมพ์ ${esc(FORMS[k].title)}">${icon('print')}<span>${esc(label || FORMS[k].title)}</span> <small class="muted">${FORMS[k].code}</small></button>`).join('')}</div>` : ''}
    ${items.length ? `<ul class="flist lib-list compact">${items.map((it) => libItemHTML(it, { compact: true })).join('')}</ul>` : ''}
    <a class="link small" href="#/library">${icon('chevR')}ดูคลังแบบฟอร์มและระเบียบทั้งหมด</a>
  </section>`;
}
/** ผูกปุ่มของ libraryBox (เรียกหลังใส่ HTML) */
export function bindLibraryBox(root, forms = []) {
  root.querySelectorAll('[data-libbox] [data-form]').forEach((b) => b.addEventListener('click', () => {
    const [k, , ctx] = forms[+b.dataset.form];
    openForm(k, typeof ctx === 'function' ? ctx() : ctx || {});
  }));
  root.querySelectorAll('[data-libbox] [data-open]').forEach((b) => b.addEventListener('click', () => openLibItem(store.data.library.find((x) => x.id === b.dataset.open))));
}

export function renderLibrary(el) {
  const me = store.me;
  const admin = me.isAdmin && !store.legacy;
  const all = store.libraryItems();
  const works = [...new Set([...(store.settings.projectTypes || []), ...all.map((x) => x.workType).filter(Boolean)])];
  const projects = store.visibleProjects().filter((p) => p.status !== 'cancelled');
  const upgrade = store.mode === 'sharepoint' && (store.meta.upgrade || []).includes('library');
  const outdated = store.serverOutdated('1.0.5');

  el.innerHTML = `
  ${pageHead('แบบฟอร์มและระเบียบ', 'มาตรฐานกลางของหน่วยงาน — ทุกโครงการใช้แบบฟอร์มและระเบียบชุดเดียวกัน และแสดงตามจุดที่ใช้งานในแต่ละหน้า', admin ? `<button class="btn btn-primary" data-act="add">${icon('plus')}เพิ่มเอกสาร</button>` : '')}
  ${outdated ? `<p class="notice notice-warn">${icon('alert')}<span>Code.gs ยังเป็นเวอร์ชัน ${esc(store.meta.version || 'เก่า')} — คลังเอกสารต้องใช้ Code.gs 1.0.5 (แบบฟอร์มในระบบด้านล่างใช้ได้ทันที)</span></p>` : ''}
  ${upgrade ? `<p class="notice notice-warn">${icon('alert')}<span>ไซต์ SharePoint ยังไม่มีรายการ PT_Library — ผู้ดูแลกด "อัปเดตโครงสร้างข้อมูลในไซต์" ที่หน้าตั้งค่าก่อนเพิ่มเอกสาร</span></p>` : ''}
  <section class="panel">
    <div class="panel-head"><h2>${icon('print')}แบบฟอร์มมาตรฐานในระบบ</h2>
      <label class="field field-inline lib-proj"><span>กรอกข้อมูลจากโครงการ</span><select id="lb-p"><option value="">— แบบเปล่า —</option>${projects.map((p) => `<option value="${esc(p.id)}">${esc(p.code ? `${p.code} ${p.name}` : p.name)}</option>`).join('')}</select></label>
    </div>
    <div class="lib-forms">${Object.entries(FORMS).map(([k, f]) => `
      <button type="button" class="lib-form" data-print="${k}" title="พิมพ์ ${esc(f.code)} ${esc(f.title)}">
        <span class="lf-head"><span class="lib-code">${f.code}</span><b>${esc(f.title)}</b></span>
        <span class="lf-use">${esc(f.use)}</span>
        <span class="lf-foot"><small class="muted">ใช้ที่: ${esc(f.where)}</small><span class="lf-go">${icon('print')}พิมพ์</span></span>
      </button>`).join('')}</div>
    <p class="hint">แบบฟอร์มเหล่านี้เปิดได้จากจุดที่ใช้งานด้วย เช่น หน้าเรื่องขออนุมัติ (พิมพ์พร้อมผลการพิจารณา) รายงานประจำวัน และหน้าการประชุม</p>
  </section>
  <section class="panel">
    <div class="toolbar">
      <div class="chips" role="tablist">${[['', 'ทั้งหมด'], ...Object.entries(R.LIB_KINDS)].map(([k, l]) => `<button class="chip-btn ${st.kind === k ? 'is-on' : ''}" data-kind="${k}">${esc(l)} <em>${all.filter((x) => !k || x.kind === k).length}</em></button>`).join('')}</div>
      <label class="search">${icon('search')}<input type="search" id="lb-q" placeholder="ค้นหาชื่อหรือหมายเหตุ" value="${esc(st.q)}" aria-label="ค้นหาเอกสาร"></label>
      ${works.length ? `<select id="lb-w" aria-label="ประเภทงาน"><option value="">ทุกประเภทงาน</option>${works.map((w) => `<option ${st.work === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select>` : ''}
    </div>
    <div id="lb-list"></div>
  </section>`;

  const list = el.querySelector('#lb-list');
  const draw = () => {
    const q = st.q.trim().toLowerCase();
    const shown = all.filter((x) => (!st.kind || x.kind === st.kind) && (!st.work || !x.workType || x.workType === st.work)
      && (!q || `${x.title} ${x.note || ''} ${x.category || ''}`.toLowerCase().includes(q)));
    if (!shown.length) {
      list.innerHTML = all.length
        ? emptyState({ ic: 'search', title: 'ไม่พบเอกสารที่ค้นหา' })
        : emptyState({
          ic: 'book', title: 'ยังไม่มีเอกสารในคลัง',
          text: admin ? 'อัปโหลดแบบฟอร์ม (Word/Excel/PDF) ระเบียบ มาตรฐาน และคู่มือที่หน่วยงานใช้ หรือใส่ลิงก์ไปยังเอกสารต้นฉบับ แล้วเลือกว่าใช้กับงานใด ระบบจะแสดงในหน้าที่เกี่ยวข้องของทุกโครงการ'
            : 'ผู้ดูแลระบบจะเพิ่มแบบฟอร์มและระเบียบที่ใช้ร่วมกันทุกโครงการ',
          actions: admin ? `<button class="btn btn-primary" data-act="add">${icon('plus')}เพิ่มเอกสาร</button><button class="btn" data-act="starter">${icon('link')}เพิ่มลิงก์อ้างอิงเริ่มต้น</button>` : '',
        });
      bindAdd();
      return;
    }
    const groups = Object.keys(R.LIB_KINDS).filter((k) => shown.some((x) => x.kind === k));
    list.innerHTML = groups.map((k) => `<h3 class="lib-group">${icon(KIND_IC[k])}${esc(R.LIB_KINDS[k])}</h3>
      <ul class="flist lib-list">${shown.filter((x) => x.kind === k).map((it) => libItemHTML(it, { admin })).join('')}</ul>`).join('');
    list.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openLibItem(all.find((x) => x.id === b.dataset.open))));
    list.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openLibraryForm(all.find((x) => x.id === b.dataset.edit), () => renderLibrary(el))));
    list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const it = all.find((x) => x.id === b.dataset.del);
      if (!(await confirmBox({ title: 'ลบเอกสารออกจากคลัง', message: `ลบ "${esc(it.title)}"? ${it.file ? 'ไฟล์ที่อัปโหลดจะถูกลบด้วย' : ''}`, ok: 'ลบ', danger: true }))) return;
      try { await store.deleteLibrary(it.id); toast('ลบแล้ว'); renderLibrary(el); } catch (ex) { toast(ex.message, 'bad'); }
    }));
  };
  function bindAdd() {
    el.querySelectorAll('[data-act="add"]').forEach((b) => { b.onclick = () => openLibraryForm(null, () => renderLibrary(el)); });
    el.querySelectorAll('[data-act="starter"]').forEach((b) => {
      b.onclick = async () => {
        setBusy(b, true, 'กำลังเพิ่ม…');
        try {
          for (const [i, s] of STARTER.entries()) await store.saveLibrary({ ...s, order: i + 1 });
          toast(`เพิ่มลิงก์อ้างอิง ${STARTER.length} รายการแล้ว — อัปโหลดแบบฟอร์มของหน่วยงานเพิ่มได้ที่ "เพิ่มเอกสาร"`, 'ok', 6000);
          renderLibrary(el);
        } catch (ex) { toast(ex.message, 'bad', 6000); setBusy(b, false); }
      };
    });
  }
  draw();
  bindAdd();
  el.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { st.kind = b.dataset.kind; el.querySelectorAll('[data-kind]').forEach((x) => x.classList.toggle('is-on', x === b)); draw(); }));
  el.querySelector('#lb-q').addEventListener('input', (e) => { st.q = e.target.value; draw(); });
  el.querySelector('#lb-w')?.addEventListener('change', (e) => { st.work = e.target.value; draw(); });
  el.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => {
    const p = store.project(el.querySelector('#lb-p').value) || null;
    const k = b.dataset.print;
    const today = store.thaiNow().date;
    openForm(k, { p, daily: p && (k === 'daily' || k === 'instruction') ? store.dailyAt(p.id, today) : null, date: today, to: today });
  }));
}

/** ฟอร์มเพิ่ม/แก้ไขเอกสารในคลัง (ผู้ดูแลระบบ) */
export function openLibraryForm(it, done) {
  const cats = [...new Set((store.visibleProjects().flatMap((p) => R.workflows(p).map((w) => w.name))).concat(R.DEFAULT_WORKFLOWS.map((w) => w.name)))];
  const works = store.settings.projectTypes || [];
  const uses = it?.uses || ['all'];
  const m = openModal({
    title: it ? 'แก้ไขเอกสารในคลัง' : 'เพิ่มเอกสารในคลังแบบฟอร์มและระเบียบ', size: 'lg',
    body: `<form class="form" id="lf"><div class="form-grid">
      <label class="field span-2"><span>ชื่อเอกสาร</span><input name="title" value="${esc(it?.title || '')}" required maxlength="200" placeholder="เช่น แบบฟอร์มขออนุมัติวัสดุ (ฉบับ กฟผ.)"></label>
      <label class="field"><span>ประเภท</span><select name="kind">${Object.entries(R.LIB_KINDS).map(([k, l]) => `<option value="${k}" ${it?.kind === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="field"><span>ประเภทงาน <small class="muted">(เว้นว่าง = ทุกประเภท)</small></span><select name="workType"><option value="">ทุกประเภทงาน</option>${works.map((w) => `<option ${it?.workType === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></label>
      <div class="field span-2"><span>ใช้กับงาน <small class="muted">— แสดงเป็นลิงก์ในหน้าที่เกี่ยวข้องของทุกโครงการ</small></span>
        <div class="checks">${Object.entries(R.LIB_USE).map(([k, l]) => `<label class="check"><input type="checkbox" name="uses" value="${k}" ${uses.includes(k) ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div></div>
      <label class="field"><span>หมวดเรื่องขออนุมัติ <small class="muted">(เฉพาะเมื่อใช้กับเรื่องขออนุมัติ)</small></span><select name="category"><option value="">ทุกหมวด</option>${cats.map((c) => `<option ${it?.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="field"><span>ผู้เห็นเอกสาร</span><select name="audience"><option value="all">ทุกคนในระบบ (รวมผู้รับจ้าง)</option><option value="internal" ${it?.audience === 'internal' ? 'selected' : ''}>เฉพาะเจ้าหน้าที่ (ไม่แสดงต่อผู้รับจ้าง)</option></select></label>
      <label class="field"><span>ฉบับ/ครั้งที่แก้ไข</span><input name="version" value="${esc(it?.version || '')}" maxlength="40" placeholder="เช่น Rev.2 / 2568"></label>
      <label class="field"><span>วันที่มีผลบังคับใช้</span><input type="date" name="effective" value="${esc(it?.effective || '')}"></label>
      <label class="field span-2"><span>หมายเหตุ</span><textarea name="note" rows="2" maxlength="1000" placeholder="เช่น ใช้แทนฉบับเดิม / ข้อที่เกี่ยวข้อง">${esc(it?.note || '')}</textarea></label>
      <div class="field span-2"><span>ไฟล์หรือลิงก์</span>
        ${it?.file ? `<p class="small">ไฟล์ปัจจุบัน: <b>${esc(it.file.name)}</b> (${fmt.size(it.file.size)}) — เลือกไฟล์ใหม่เพื่อแทนที่</p>` : ''}
        <label class="drop drop-sm" id="lf-drop">${icon('upload')}<b id="lf-fn">เลือกไฟล์ (Word, Excel, PDF …)</b><input type="file" hidden name="file"></label>
        <input name="url" value="${esc(it?.url || '')}" placeholder="หรือวางลิงก์ https://… (เช่น ไฟล์ใน SharePoint/Google Drive ของหน่วยงาน)" style="margin-top:8px">
      </div>
      <label class="check span-2"><input type="checkbox" name="active" ${it?.active === false ? '' : 'checked'}>เปิดใช้งาน (ปิดเพื่อเก็บฉบับเก่าไว้แต่ไม่แสดงต่อผู้ใช้)</label>
    </div></form>`,
    footer: `<button class="btn" data-close>ยกเลิก</button><button class="btn btn-primary" data-go>${icon('check')}บันทึก</button>`,
  });
  const form = m.el.querySelector('#lf');
  form.elements.file.addEventListener('change', () => { m.el.querySelector('#lf-fn').textContent = form.elements.file.files[0]?.name || 'เลือกไฟล์'; });
  const go = m.el.querySelector('[data-go]');
  go.addEventListener('click', async () => {
    const f = form.elements;
    const file = f.file.files[0] || null;
    const input = {
      ...(it || {}), title: f.title.value.trim(), kind: f.kind.value, workType: f.workType.value, category: f.category.value,
      uses: [...form.querySelectorAll('[name="uses"]:checked')].map((x) => x.value), audience: f.audience.value,
      version: f.version.value.trim(), effective: f.effective.value, note: f.note.value.trim(), url: f.url.value.trim(), active: f.active.checked,
    };
    if (!input.title) { toast('กรุณาระบุชื่อเอกสาร', 'bad'); f.title.focus(); return; }
    if (!file && !input.url && !it?.file) { toast('กรุณาแนบไฟล์หรือใส่ลิงก์', 'bad'); return; }
    setBusy(go, true, file ? 'กำลังอัปโหลด…' : 'กำลังบันทึก…');
    try {
      await store.saveLibrary(input, file);
      m.close(); toast('บันทึกเอกสารในคลังแล้ว'); done?.();
    } catch (ex) { toast(ex.message, 'bad', 6000); setBusy(go, false); }
  });
}
