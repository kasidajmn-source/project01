// ความเคลื่อนไหวทุกโครงการ: สร้างจากข้อมูลที่มีอยู่ (เรื่องขออนุมัติ ความคืบหน้า เอกสาร ประชุม ห้องสนทนา)
import { store } from '../store.js';
import { esc, icon, fmt, emptyState } from '../ui.js';
import { pageHead } from './common.js';

const R = globalThis.PTRules;
const st = { pid: '', type: '', days: 14 };
const TYPES = { '': 'ทุกประเภท', sub: 'เรื่องขออนุมัติ', update: 'ความคืบหน้า', file: 'เอกสาร', meeting: 'ประชุม', chat: 'ห้องสนทนา' };
const dayOf = (iso) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const timeOf = (iso) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

export function renderActivity(el) {
  const me = store.me;
  const projects = store.visibleProjects();
  if (st.pid && !projects.some((p) => p.id === st.pid)) st.pid = '';
  const all = store.activity({ pid: st.pid, days: st.days }).filter((x) => !st.type || x.type === st.type);
  let lastDay = '';
  const rows = all.slice(0, 400).map((x) => {
    const day = dayOf(x.at);
    const head = day !== lastDay ? `<li class="ac-day">${esc(fmt.date(day))}</li>` : '';
    lastDay = day;
    return `${head}<li class="ac-item ${x.tone ? `ac-${x.tone}` : ''}"><a href="${esc(x.href)}">
      <span class="ac-ic">${icon(x.icon)}</span>
      <span class="ac-body"><span>${x.p ? `<span class="tag">${esc(x.p.code || x.p.name)}</span> ` : '<span class="tag">แผนก</span> '}<b>${esc(x.who || '')}</b> ${esc(x.text)}</span>
        ${x.extra ? `<small class="${x.type === 'update' ? 'ac-issue' : 'muted'}">${x.type === 'update' ? `${icon('alert')}ปัญหา: ` : ''}${esc(x.extra)}</small>` : ''}</span>
      <span class="ac-time">${esc(timeOf(x.at))}</span></a></li>`;
  }).join('');
  el.innerHTML = `
  ${pageHead('ความเคลื่อนไหวทุกโครงการ', me.isDept || me.isExec || me.isAdmin ? 'ทุกโครงการในแผนก — ใช้ติดตามและเรียนรู้จากโครงการอื่น' : 'เฉพาะโครงการที่คุณเป็นสมาชิก')}
  <div class="filters">
    <select id="ac-p" aria-label="โครงการ"><option value="">ทุกโครงการ (${projects.length})</option>${projects.map((p) => `<option value="${esc(p.id)}" ${st.pid === p.id ? 'selected' : ''}>${esc(p.code ? `${p.code} ${p.name}` : p.name)}</option>`).join('')}</select>
    <select id="ac-t" aria-label="ประเภท">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${st.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select id="ac-d" aria-label="ช่วงเวลา">${[7, 14, 30, 90].map((d) => `<option value="${d}" ${st.days === d ? 'selected' : ''}>${d} วันล่าสุด</option>`).join('')}</select>
    <span class="muted">${all.length} รายการ</span>
  </div>
  <section class="panel">${rows ? `<ul class="ac-list">${rows}</ul>` : emptyState({ ic: 'chart', title: 'ยังไม่มีความเคลื่อนไหวในช่วงนี้', text: 'ลองขยายช่วงเวลา หรือเลือกทุกโครงการ' })}</section>`;
  const on = (id, k, num) => el.querySelector(id).addEventListener('change', (e) => { st[k] = num ? +e.target.value : e.target.value; renderActivity(el); });
  on('#ac-p', 'pid'); on('#ac-t', 'type'); on('#ac-d', 'days', true);
  void R;
}
