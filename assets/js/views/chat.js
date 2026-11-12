// หน้าสนทนา: รายชื่อห้อง (ห้องแผนก / ห้องของแต่ละโครงการ) + ห้องที่เลือก + ทางลัดไปประชุมและความเคลื่อนไหว
import { store } from '../store.js';
import { esc, icon, emptyState } from '../ui.js';
import { pageHead } from './common.js';
import { mountRoom, lastPreview } from './room.js';
import { renderProjectMeetings } from './meetings.js';

const R = globalThis.PTRules;

function listHTML(chs, active) {
  const item = (c) => {
    const n = store.unreadOf(c.key);
    return `<a class="ch-item ${c.key === active ? 'is-on' : ''}" href="#/chat/${encodeURIComponent(c.key)}">
      <span class="ch-ic ch-${c.channel}">${icon(c.channel === 'dept' ? 'users' : c.channel === 'internal' ? 'lock' : 'message')}</span>
      <span class="ch-txt"><b>${esc(c.label)}</b><small>${esc(c.sub)}${c.canPost ? '' : ' · อ่านอย่างเดียว'}</small><small class="ch-last">${esc(lastPreview(c.key))}</small></span>
      ${n ? `<em class="ch-badge">${n > 99 ? '99+' : n}</em>` : ''}
    </a>`;
  };
  const dept = chs.filter((c) => c.channel === 'dept');
  const mine = chs.filter((c) => c.channel !== 'dept' && c.mine);
  const others = chs.filter((c) => c.channel !== 'dept' && !c.mine);
  const upcoming = store.meetingsVisible().filter((m) => m.status === 'scheduled' && m.startAt >= new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16)).length;
  return `
    <nav class="ch-quick">
      <a class="ch-item" href="#/activity"><span class="ch-ic">${icon('chart')}</span><span class="ch-txt"><b>ความเคลื่อนไหวทุกโครงการ</b><small>ส่งเรื่อง อนุมัติ ความคืบหน้า เอกสาร ประชุม</small></span></a>
      <a class="ch-item" href="#/meetings"><span class="ch-ic">${icon('calendar')}</span><span class="ch-txt"><b>ประชุม</b><small>${upcoming ? `นัดที่กำลังจะถึง ${upcoming} ครั้ง` : 'นัดประชุม วาระ บันทึก และงานที่มอบหมาย'}</small></span></a>
    </nav>
    ${dept.length ? `<h3 class="ch-h">แผนก</h3>${dept.map(item).join('')}` : ''}
    ${mine.length ? `<h3 class="ch-h">โครงการของฉัน</h3>${mine.map(item).join('')}` : ''}
    ${others.length ? `<h3 class="ch-h">โครงการอื่นในแผนก <small>อ่านอย่างเดียว</small></h3>${others.map(item).join('')}` : ''}`;
}

export function renderChat(el, rawKey = '') {
  const me = store.me;
  if (store.legacy) {
    el.innerHTML = `${pageHead('สนทนา')}<section class="panel">${emptyState({ ic: 'message', title: 'ต้องอัปเดตระบบหลังบ้านก่อน', text: 'ห้องสนทนาต้องใช้ Code.gs เวอร์ชัน 1.0.4 ขึ้นไป' })}</section>`;
    return;
  }
  if (!me.email) {
    el.innerHTML = `${pageHead('สนทนา')}<section class="panel">${emptyState({ ic: 'user', title: 'ยังไม่ได้ระบุอีเมลของคุณ', text: 'ระบบใช้อีเมลเพื่อรู้ว่าคุณอยู่ในห้องใดบ้าง', actions: '<a class="btn btn-primary" href="#/settings">ตั้งค่าอีเมลของฉัน</a>' })}</section>`;
    return;
  }
  const chs = store.channels();
  const key = decodeURIComponent(rawKey || '');
  const wide = window.matchMedia('(min-width: 901px)').matches;
  const active = chs.find((c) => c.key === key) || (wide ? chs[0] : null);
  if (!chs.length) {
    el.innerHTML = `${pageHead('สนทนา')}<section class="panel">${emptyState({ ic: 'message', title: 'ยังไม่มีห้องสนทนาของคุณ', text: 'ห้องของโครงการจะปรากฏเมื่อคุณเป็นสมาชิกโครงการ · ห้องแผนกสำหรับผู้ที่ผู้ดูแลระบบกำหนดเป็นสมาชิกแผนก' })}</section>`;
    return;
  }
  el.innerHTML = `
  ${pageHead('สนทนา', 'คุยงานภายในแผนกและในแต่ละโครงการ — ข้อความเก็บเป็นบันทึกของโครงการ')}
  <div class="chat-hub ${active && key ? 'has-room' : ''}">
    <aside class="panel ch-list">${listHTML(chs, active?.key)}</aside>
    <section class="panel ch-room">
      ${active ? `<header class="ch-head">
        <a class="icon-btn ch-back" href="#/chat" aria-label="กลับไปรายชื่อห้อง">${icon('chevL')}</a>
        <div><h2>${esc(active.channel === 'dept' ? active.label : `${active.label} · ${active.sub}`)}</h2>
          <small class="muted">${esc(active.project ? active.project.name : '')}${active.project ? ' · ' : ''}${esc(R.CHANNELS[active.channel].desc)}</small></div>
        ${active.project ? `<a class="btn btn-sm" href="#/p/${encodeURIComponent(active.pid)}">${icon('external')}เปิดโครงการ</a>` : ''}
      </header>
      <div id="room"></div>` : emptyState({ ic: 'message', title: 'เลือกห้องสนทนา', text: 'เลือกห้องจากรายการ' })}
    </section>
  </div>`;
  if (active) mountRoom(el.querySelector('#room'), { key: active.key, channel: active.channel, pid: active.pid });
}

/** แท็บ "สนทนาและประชุม" ในหน้าโครงการ — sub: '' (ห้องโครงการ) | internal | meetings */
export function renderProjectChat(el, ctx, sub = '') {
  const { p } = ctx;
  const me = store.me;
  const pid = encodeURIComponent(p.id);
  const canInternal = R.canReadChannel('internal', p, me);
  const tab = sub === 'internal' && canInternal ? 'internal' : sub === 'meetings' ? 'meetings' : 'project';
  const pill = (k, label, ic, href, n) => `<a href="${href}" class="${tab === k ? 'is-on' : ''}">${icon(ic)}${label}${n ? `<em>${n}</em>` : ''}</a>`;
  el.innerHTML = `
  <nav class="subtabs">
    ${pill('project', 'ห้องโครงการ', 'message', `#/p/${pid}/chat`, store.unreadOf(`project:${p.id}`))}
    ${canInternal ? pill('internal', 'ภายใน กฟผ.', 'lock', `#/p/${pid}/chat/internal`, store.unreadOf(`internal:${p.id}`)) : ''}
    ${pill('meetings', 'ประชุม', 'calendar', `#/p/${pid}/chat/meetings`, 0)}
  </nav>
  ${tab === 'meetings' ? '<div id="pm"></div>' : `<section class="panel">
    <p class="hint">${icon(tab === 'internal' ? 'lock' : 'users')}${esc(R.CHANNELS[tab].desc)}</p>
    <div id="room"></div></section>`}`;
  if (tab === 'meetings') renderProjectMeetings(el.querySelector('#pm'), p);
  else mountRoom(el.querySelector('#room'), { key: `${tab}:${p.id}`, channel: tab, pid: p.id });
}
