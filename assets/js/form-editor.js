/*
 * กรอกแบบฟอร์มบนเว็บ (1.0.13–1.0.14) — โหลดในหน้าต่างแบบฟอร์มที่ forms.js เปิด
 * คลิกช่องเพื่อพิมพ์ (มีคำแนะนำ) · ปฏิทินไทยเลือกวันที่ · ติ๊กช่อง · ใส่รูปและมาร์ค/โน้ตบนรูป · ลงลายมือชื่อ
 * ช่องข้อมูลโครงการที่ผูกกัน (ชื่อผู้รับจ้าง เลขที่สัญญา …) แก้ที่เดียวเปลี่ยนทุกที่ · จำที่กรอกไว้ในเครื่องนี้
 * แล้วกด "บันทึก PDF / พิมพ์" — สคริปต์ธรรมดา (ไม่ใช่ module) ใช้ window.PTAnnotate จาก annotate.js ถ้ามี
 */
(function () {
  'use strict';
  var doc = document;
  var win = window;
  var body = doc.body;
  if (!body || body.getAttribute('data-ed') === '1') return;
  body.setAttribute('data-ed', '1');
  body.classList.add('ed');

  var FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  var DRAFT_PREFIX = 'pt.fd.';
  var SIG_KEY = 'pt.sig';
  var SIG_PREF = 'pt.sig.remember';
  var MAX_DRAFTS = 40;

  function fmtDate(iso, fmt) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '';
    var y = +m[1] + 543, mo = +m[2] - 1, d = +m[3];
    if (fmt === 'long') return d + ' ' + FULL[mo] + ' ' + y;
    if (fmt === 'med') return d + ' ' + SHORT[mo] + ' ' + y;
    if (fmt === 'slash') return d + '/' + (mo + 1) + '/' + y;
    return d + ' ' + SHORT[mo] + ' ' + String(y).slice(-2);
  }
  function iso(y, m, d) { return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10); }
  /** วันนี้ตามเวลาประเทศไทย */
  function today() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function addDays(s, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? iso(+m[1], +m[2] - 1, +m[3] + n) : '';
  }
  function num(t) { var v = parseFloat(String(t || '').replace(/,/g, '')); return isFinite(v) ? v : 0; }
  function fmtNum(v) { return (Math.round(v * 100) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function txt(el) { return String(el.innerText != null && el.isContentEditable ? el.innerText : el.textContent).replace(/ /g, ' ').replace(/\n+$/, ''); }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function mk(tag, attrs, text) {
    var x = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { x.setAttribute(k, attrs[k]); });
    if (text != null) x.textContent = text;
    return x;
  }

  var PLAIN = (function () {
    try { var x = doc.createElement('span'); x.contentEditable = 'plaintext-only'; return x.contentEditable === 'plaintext-only'; } catch (e) { return false; }
  })();

  var wrap = doc.querySelector('.sheets') || body;
  var original = wrap.innerHTML;
  var msg = doc.querySelector('[data-pt="msg"]');
  var hint = msg ? msg.textContent : '';
  var resetBtn = doc.querySelector('[data-pt="reset"]');
  var KEY = body.getAttribute('data-key') ? DRAFT_PREFIX + body.getAttribute('data-key') : '';
  var dirty = false;

  // ---------- ช่องกรอก ----------
  function fields() { return all('.sheets [data-f]'); }
  function dates() { return all('.sheets [data-date]'); }
  function checks() { return all('.sheets [data-ck]'); }
  function photos() { return all('.sheets [data-photo]'); }
  function signs() { return all('.sheets [data-sign]'); }

  function norm(el) {
    var t = (el.textContent || '').replace(/ /g, ' ');
    if (!t.trim() && el.innerHTML !== '') el.innerHTML = '';
    el.classList.toggle('has', !!t.trim());
  }
  function setup() {
    fields().forEach(function (el) {
      el.setAttribute('contenteditable', PLAIN ? 'plaintext-only' : 'true');
      el.setAttribute('spellcheck', 'false');
      if (el.getAttribute('data-sug')) { el.setAttribute('aria-autocomplete', 'list'); }
      var lab = el.getAttribute('data-l');
      if (lab && !el.getAttribute('aria-label')) el.setAttribute('aria-label', lab);
      norm(el);
    });
    dates().forEach(function (el) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-haspopup', 'dialog');
      el.setAttribute('title', 'คลิกเพื่อเลือกวันที่');
      el.classList.toggle('has', !!el.getAttribute('data-date'));
    });
    checks().forEach(function (el) {
      el.tabIndex = 0;
      el.setAttribute('role', 'checkbox');
      el.setAttribute('aria-checked', el.textContent.trim() ? 'true' : 'false');
    });
    photos().forEach(function (el) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'เลือกรูปภาพ');
      el.classList.toggle('has-img', !!(el.querySelector('img') && el.querySelector('img').getAttribute('src')));
    });
    signs().forEach(function (el) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-haspopup', 'menu');
      el.setAttribute('aria-label', 'ลงลายมือชื่อ');
      el.setAttribute('title', 'คลิกเพื่อลงลายมือชื่อ หรือลากรูปลายเซ็นมาวาง');
    });
    recalc();
    fit();
  }

  // ---------- คำนวณ (ผลรวมแถว/คอลัมน์ในตารางคนงาน เครื่องจักร) ----------
  function recalc() {
    all('[data-calc]').forEach(function (c) {
      var row = c.parentNode, s = 0, any = false;
      c.getAttribute('data-calc').split('+').forEach(function (n) {
        var x = row.querySelector('[data-col="' + n + '"]');
        if (x && x !== c && x.textContent.trim()) { any = true; s += num(x.textContent); }
      });
      c.textContent = any ? fmtNum(s) : '';
    });
    all('[data-sum]').forEach(function (t) {
      var k = t.getAttribute('data-sum'), scope = t.closest('table') || doc, s = 0, any = false;
      all('[data-col="' + k + '"]', scope).forEach(function (x) { if (x.textContent.trim()) { any = true; s += num(x.textContent); } });
      t.textContent = any ? fmtNum(s) : '';
    });
  }
  // แบบฟอร์มทางการขนาด A4 หน้าเดียว: กรอกยาวจนล้นกระดาษ → ให้ขึ้นหน้าใหม่แทนการตัดทิ้ง
  function fit() {
    if (!body.classList.contains('official') || body.classList.contains('of-long')) return;
    all('.sheet').some(function (s) {
      if (s.scrollHeight > s.clientHeight + 2) { body.classList.add('of-long'); return true; }
      return false;
    });
  }

  // ---------- ช่องที่ผูกกับข้อมูลโครงการ: แก้ที่หนึ่ง เปลี่ยนทุกที่ในแบบฟอร์ม ----------
  function syncBind(el) {
    var b = el.getAttribute('data-bind');
    if (!b) return;
    var v = txt(el);
    all('.sheets [data-f][data-bind="' + b + '"]').forEach(function (o) {
      if (o !== el && txt(o) !== v) { o.textContent = v; norm(o); }
    });
  }

  // ---------- ปฏิทินไทย (ปิดเมื่อคลิกนอกกรอบ กด Esc หรือเลือกวันแล้ว) ----------
  var cal = null, calFor = null, calView = null;
  function showDate(el, v) {
    el.setAttribute('data-date', v || '');
    el.textContent = v ? fmtDate(v, el.getAttribute('data-fmt')) : '';
    el.classList.toggle('has', !!v);
  }
  function setDate(el, v) {
    showDate(el, v);
    // วันที่ที่ผูกกัน (เช่น Daily Request = วันถัดจาก Daily Report) เลื่อนตาม เว้นแต่ผู้ใช้เลือกเองแล้ว
    if (el.getAttribute('data-follow')) el.setAttribute('data-touched', '1');
    var id = el.getAttribute('data-id');
    if (id) {
      all('[data-follow^="' + id + ':"]').forEach(function (f) {
        if (f.getAttribute('data-touched') === '1') return;
        var n = +(f.getAttribute('data-follow').split(':')[1] || 0);
        showDate(f, v ? addDays(v, n) : '');
      });
    }
    var b = el.getAttribute('data-bind');
    if (b) all('.sheets [data-date][data-bind="' + b + '"]').forEach(function (o) { if (o !== el) showDate(o, v); });
    changed();
  }
  function closeCal(refocus) {
    if (!cal) return;
    cal.remove();
    cal = null;
    doc.removeEventListener('pointerdown', outside, true);
    win.removeEventListener('scroll', onScroll, true);
    win.removeEventListener('resize', onScroll);
    if (refocus && calFor) { try { calFor.focus(); } catch (e) { /* ignore */ } }
    calFor = null;
  }
  function outside(ev) {
    if (cal && !cal.contains(ev.target) && ev.target !== calFor) closeCal(false);
  }
  // เลื่อนหน้า/รูปโหลดเสร็จจนหน้าขยับ → ปฏิทินเลื่อนตามช่องวันที่ (ไม่ปิดเอง)
  function onScroll(ev) {
    if (!cal || (ev && ev.target && ev.target.nodeType === 1 && cal.contains(ev.target))) return;
    if (!calFor || !calFor.isConnected) { closeCal(false); return; }
    place(cal, calFor);
  }
  function place(pop, el) {
    var r = el.getBoundingClientRect();
    var h = pop.offsetHeight || 300, w = pop.offsetWidth || 280;
    var top = r.bottom + 4;
    if (top + h > win.innerHeight - 6 && r.top - h - 4 > 6) top = r.top - h - 4;
    var left = Math.min(Math.max(6, r.left), win.innerWidth - w - 6);
    pop.style.top = Math.max(6, top) + 'px';
    pop.style.left = Math.max(6, left) + 'px';
  }
  function openCal(el) {
    if (cal && calFor === el) { closeCal(true); return; }
    closeCal(false);
    closeSigMenu();
    calFor = el;
    var cur = el.getAttribute('data-date') || today();
    calView = { y: +cur.slice(0, 4), m: +cur.slice(5, 7) - 1 };
    cal = mk('div', { class: 'ptcal', role: 'dialog', 'aria-label': 'เลือกวันที่' });
    body.appendChild(cal);
    drawCal(cur);
    place(cal, el);
    doc.addEventListener('pointerdown', outside, true);
    win.addEventListener('scroll', onScroll, true);
    win.addEventListener('resize', onScroll);
    var focusBtn = cal.querySelector('.is-sel') || cal.querySelector('.is-today') || cal.querySelector('[data-day]');
    if (focusBtn) focusBtn.focus();
  }
  function drawCal(focusIso) {
    var sel = calFor.getAttribute('data-date') || '';
    var t = today();
    var y = calView.y, m = calView.m;
    var first = new Date(Date.UTC(y, m, 1)).getUTCDay();
    var days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    cal.innerHTML = '';
    var h = mk('div', { class: 'ptcal-h' });
    var prev = mk('button', { type: 'button', 'data-nav': '-1', 'aria-label': 'เดือนก่อนหน้า' }, '‹');
    var next = mk('button', { type: 'button', 'data-nav': '1', 'aria-label': 'เดือนถัดไป' }, '›');
    var ms = mk('select', { 'aria-label': 'เดือน' });
    FULL.forEach(function (n, i) { var o = mk('option', { value: String(i) }, n); if (i === m) o.selected = true; ms.appendChild(o); });
    var ys = mk('select', { 'aria-label': 'ปี พ.ศ.' });
    var ty = +t.slice(0, 4);
    for (var yy = Math.min(y, ty) - 10; yy <= Math.max(y, ty) + 5; yy++) { var o = mk('option', { value: String(yy) }, String(yy + 543)); if (yy === y) o.selected = true; ys.appendChild(o); }
    ms.addEventListener('change', function () { calView.m = +ms.value; drawCal(); });
    ys.addEventListener('change', function () { calView.y = +ys.value; drawCal(); });
    h.appendChild(prev); h.appendChild(ms); h.appendChild(ys); h.appendChild(next);
    cal.appendChild(h);
    var g = mk('div', { class: 'ptcal-g', role: 'grid' });
    WD.forEach(function (w) { g.appendChild(mk('span', { class: 'ptcal-wd', 'aria-hidden': 'true' }, w)); });
    for (var i = 0; i < first; i++) g.appendChild(mk('span', { class: 'ptcal-blank' }));
    for (var d = 1; d <= days; d++) {
      var v = iso(y, m, d);
      var b = mk('button', { type: 'button', 'data-day': v, 'aria-label': fmtDate(v, 'long'), tabindex: '-1' }, String(d));
      if (v === sel) { b.classList.add('is-sel'); b.setAttribute('aria-pressed', 'true'); }
      if (v === t) b.classList.add('is-today');
      g.appendChild(b);
    }
    cal.appendChild(g);
    var f = mk('div', { class: 'ptcal-f' });
    f.appendChild(mk('button', { type: 'button', 'data-cal': 'today' }, 'วันนี้'));
    f.appendChild(mk('button', { type: 'button', 'data-cal': 'clear' }, 'ล้าง'));
    f.appendChild(mk('button', { type: 'button', 'data-cal': 'close' }, 'ปิด'));
    cal.appendChild(f);
    var target = (focusIso && cal.querySelector('[data-day="' + focusIso + '"]')) || cal.querySelector('.is-sel') || cal.querySelector('[data-day]');
    if (target) target.tabIndex = 0;
    if (focusIso && target) target.focus();
  }
  function pickDay(v) { var el = calFor; closeCal(true); if (el) setDate(el, v); }
  function calKey(ev) {
    if (!cal) return false;
    if (ev.key === 'Escape') { ev.preventDefault(); closeCal(true); return true; }
    var b = ev.target.closest && ev.target.closest('[data-day]');
    if (!b) return false;
    var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
    if (step) {
      ev.preventDefault();
      var v = addDays(b.getAttribute('data-day'), step);
      calView = { y: +v.slice(0, 4), m: +v.slice(5, 7) - 1 };
      drawCal(v);
      return true;
    }
    if (ev.key === 'PageUp' || ev.key === 'PageDown') {
      ev.preventDefault();
      calView.m += ev.key === 'PageUp' ? -1 : 1;
      if (calView.m < 0) { calView.m = 11; calView.y--; } if (calView.m > 11) { calView.m = 0; calView.y++; }
      drawCal(iso(calView.y, calView.m, Math.min(+b.getAttribute('data-day').slice(8), 28)));
      return true;
    }
    return false;
  }

  // ---------- ช่องติ๊ก ----------
  function toggle(el) {
    var on = !el.textContent.trim();
    var g = el.getAttribute('data-ck');
    if (on && g) {
      var scope = el.closest('[data-ckg]') || el.parentNode;
      all('[data-ck="' + g + '"]', scope).forEach(function (o) { if (o !== el) { o.textContent = ''; o.setAttribute('aria-checked', 'false'); } });
    }
    el.textContent = on ? '✓' : '';
    el.setAttribute('aria-checked', on ? 'true' : 'false');
    changed();
  }

  // ---------- รูปภาพ ----------
  var fileIn = mk('input', { type: 'file', accept: 'image/*', class: 'ph-input', tabindex: '-1', 'aria-hidden': 'true' });
  body.appendChild(fileIn);
  var fileFor = null;
  function setPhoto(cell, src) {
    var img = cell.querySelector('img');
    if (!src) { if (img) img.remove(); cell.classList.remove('has-img'); return; }
    if (!img) { img = mk('img', { alt: '' }); cell.insertBefore(img, cell.firstChild); }
    img.src = src;
    cell.classList.add('has-img');
  }
  /** ย่อรูปให้ด้านยาวไม่เกิน 1600 px ก่อนใส่ในแบบฟอร์ม (ไฟล์ PDF ไม่ใหญ่เกินไป) */
  function shrink(file, done) {
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      var out = url;
      try {
        var s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
        var c = doc.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(url);
      } catch (e) { /* ใช้รูปเดิม */ }
      done(out);
    };
    im.onerror = function () { URL.revokeObjectURL(url); say('เปิดรูปนี้ไม่ได้ ลองไฟล์ JPG หรือ PNG'); };
    im.src = url;
  }
  function readImage(file, cell) {
    if (!file || !/^image\//.test(file.type || '')) { say('เลือกได้เฉพาะไฟล์รูปภาพ'); return; }
    shrink(file, function (src) { setPhoto(cell, src); changed(); });
  }
  function markPhoto(cell) {
    var img = cell.querySelector('img');
    if (!img || !win.PTAnnotate) return;
    win.PTAnnotate.edit(img.src, { doc: doc, title: 'มาร์ค/โน้ตบนรูป' }).then(function (blob) {
      if (!blob) return;
      var r = new FileReader();
      r.onload = function () { setPhoto(cell, r.result); changed(); };
      r.readAsDataURL(blob);
    }).catch(function () { say('รูปนี้มาร์คในหน้านี้ไม่ได้ (รูปจากระบบภายนอก) — เลือกรูปจากเครื่องแล้วมาร์คได้'); });
  }

  // ---------- ลายมือชื่อ ----------
  var sigMenu = null, sigFor = null;
  function savedSig() { var v = load(SIG_KEY); return v && /^data:image\/png;base64,/.test(v) ? v : ''; }
  function remember() { return load(SIG_PREF) === '1'; }
  function putSig(spot, src) {
    var img = spot.querySelector('img');
    if (!src) { if (img) img.remove(); spot.classList.remove('has'); changed(); return; }
    if (!img) { img = mk('img', { class: 'sg-img', alt: 'ลายมือชื่อ' }); spot.appendChild(img); }
    img.src = src;
    spot.classList.add('has');
    changed();
  }
  function useSig(spot, src, rememberIt) {
    putSig(spot, src);
    if (rememberIt) { if (store(SIG_KEY, src)) say('ลงลายมือชื่อแล้ว — จำลายเซ็นไว้ในเครื่องนี้ ใช้ซ้ำหรือลากไปวางช่องอื่นได้'); }
    else say('ลงลายมือชื่อแล้ว');
    drawSigChip();
  }
  function fromImage(file, spot, rememberIt) {
    if (!file || !/^image\//.test(file.type || '')) { say('เลือกได้เฉพาะไฟล์รูปภาพ'); return; }
    if (!win.PTAnnotate) { shrink(file, function (src) { useSig(spot, src, false); }); return; }
    win.PTAnnotate.cleanSignature(file, { doc: doc }).then(function (src) { useSig(spot, src, rememberIt); }).catch(function () { say('เปิดรูปลายเซ็นไม่ได้'); });
  }
  function closeSigMenu() {
    if (!sigMenu) return;
    sigMenu.remove(); sigMenu = null;
    doc.removeEventListener('pointerdown', outSig, true);
    win.removeEventListener('scroll', onSigScroll, true);
  }
  function outSig(ev) { if (sigMenu && !sigMenu.contains(ev.target) && ev.target !== sigFor && !(sigFor && sigFor.contains(ev.target))) closeSigMenu(); }
  function onSigScroll(ev) {
    if (!sigMenu || (ev && ev.target && ev.target.nodeType === 1 && sigMenu.contains(ev.target))) return;
    if (!sigFor || !sigFor.isConnected) { closeSigMenu(); return; }
    place(sigMenu, sigFor);
  }
  var sigFile = mk('input', { type: 'file', accept: 'image/*', class: 'ph-input', tabindex: '-1', 'aria-hidden': 'true' });
  body.appendChild(sigFile);
  sigFile.addEventListener('change', function () {
    var f = sigFile.files && sigFile.files[0];
    var spot = sigFile._spot, rem = sigFile._rem;
    sigFile.value = '';
    if (f && spot) fromImage(f, spot, rem);
  });
  function openSigMenu(spot) {
    if (sigMenu && sigFor === spot) { closeSigMenu(); return; }
    closeSigMenu(); closeCal(false);
    sigFor = spot;
    var saved = savedSig();
    sigMenu = mk('div', { class: 'ptsig', role: 'menu', 'aria-label': 'ลงลายมือชื่อ' });
    var h = mk('div', { class: 'ptsig-h' }, 'ลงลายมือชื่อ');
    sigMenu.appendChild(h);
    if (saved) {
      var u = mk('button', { type: 'button', role: 'menuitem', class: 'ptsig-saved' });
      u.appendChild(mk('img', { src: saved, alt: '' }));
      u.appendChild(mk('span', {}, 'ใช้ลายเซ็นที่จำไว้'));
      u.addEventListener('click', function () { closeSigMenu(); useSig(spot, saved, false); });
      sigMenu.appendChild(u);
    }
    var draw = mk('button', { type: 'button', role: 'menuitem' }, 'วาดลายเซ็น');
    var pick = mk('button', { type: 'button', role: 'menuitem' }, 'เลือกรูปลายเซ็น');
    sigMenu.appendChild(draw); sigMenu.appendChild(pick);
    var has = !!spot.querySelector('img');
    if (has) {
      var rm = mk('button', { type: 'button', role: 'menuitem' }, 'เอาลายเซ็นออก');
      rm.addEventListener('click', function () { closeSigMenu(); putSig(spot, ''); say('เอาลายเซ็นออกแล้ว'); });
      sigMenu.appendChild(rm);
    }
    var lab = mk('label', { class: 'ptsig-rem' });
    var cb = mk('input', { type: 'checkbox' });
    cb.checked = remember();
    cb.addEventListener('change', function () { store(SIG_PREF, cb.checked ? '1' : '0'); });
    lab.appendChild(cb); lab.appendChild(doc.createTextNode(' จำลายเซ็นไว้ในเครื่องนี้ (ใช้ซ้ำ/ลากไปวางได้)'));
    sigMenu.appendChild(lab);
    if (saved) {
      var fg = mk('button', { type: 'button', role: 'menuitem', class: 'ptsig-forget' }, 'ลืมลายเซ็นที่จำไว้');
      fg.addEventListener('click', function () { store(SIG_KEY, null); closeSigMenu(); drawSigChip(); say('ลบลายเซ็นที่จำไว้ในเครื่องนี้แล้ว'); });
      sigMenu.appendChild(fg);
    }
    sigMenu.appendChild(mk('p', { class: 'ptsig-tip' }, 'หรือลากไฟล์รูปลายเซ็นมาวางที่ช่องลงชื่อได้เลย'));
    draw.addEventListener('click', function () {
      closeSigMenu();
      if (!win.PTAnnotate) { say('เครื่องมือวาดลายเซ็นยังโหลดไม่เสร็จ ลองอีกครั้ง'); return; }
      win.PTAnnotate.signature({ doc: doc }).then(function (src) { if (src) useSig(spot, src, cb.checked); });
    });
    pick.addEventListener('click', function () { sigFile._spot = spot; sigFile._rem = cb.checked; closeSigMenu(); sigFile.click(); });
    body.appendChild(sigMenu);
    place(sigMenu, spot);
    doc.addEventListener('pointerdown', outSig, true);
    win.addEventListener('scroll', onSigScroll, true);
    var first = sigMenu.querySelector('button');
    if (first) first.focus();
  }
  /** ลายเซ็นที่จำไว้บนแถบด้านบน — ลากไปวางที่ช่องลงชื่อ */
  var chip = null;
  function drawSigChip() {
    var bar = doc.querySelector('.bar');
    if (!bar) return;
    var saved = savedSig();
    if (!saved || !signs().length) { if (chip) { chip.remove(); chip = null; } return; }
    if (!chip) {
      chip = mk('span', { class: 'sig-chip', draggable: 'true', title: 'ลากลายเซ็นนี้ไปวางที่ช่องลงชื่อ' });
      chip.appendChild(mk('img', { alt: '' }));
      chip.appendChild(mk('span', {}, 'ลากลายเซ็นไปวาง'));
      chip.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/x-pt-sig', '1'); ev.dataTransfer.effectAllowed = 'copy'; });
      var msgEl = doc.querySelector('[data-pt="msg"]');
      bar.insertBefore(chip, msgEl || null);
    }
    chip.querySelector('img').src = saved;
  }

  // ---------- คำแนะนำในช่องกรอก (คำของหน่วยงาน + คำที่โครงการใช้บ่อย) ----------
  var sugBox = null, sugFor = null, sugIdx = -1;
  function sugList(kind) { var s = win.ptSug || {}; return Array.isArray(s[kind]) ? s[kind] : []; }
  function closeSug() { if (sugBox) { sugBox.remove(); sugBox = null; } sugFor = null; sugIdx = -1; }
  function prefixOf(t) { var m = /^(\s*\d+\.\s*)/.exec(t); return m ? m[1] : ''; }
  function showSug(el) {
    var kind = el.getAttribute('data-sug');
    var list = sugList(kind);
    if (!list.length) { closeSug(); return; }
    var t = txt(el), pre = prefixOf(t), q = t.slice(pre.length).trim().toLowerCase();
    var starts = [], has = [];
    list.forEach(function (w) {
      var lw = w.toLowerCase();
      if (q && lw === q) return;
      if (!q || lw.indexOf(q) === 0) starts.push(w); else if (lw.indexOf(q) > 0) has.push(w);
    });
    var items = starts.concat(has).slice(0, 8);
    if (!items.length || (!q && doc.activeElement !== el)) { closeSug(); return; }
    if (!sugBox) { sugBox = mk('ul', { class: 'ptsug', role: 'listbox', 'aria-label': 'คำแนะนำ' }); body.appendChild(sugBox); }
    sugFor = el; sugIdx = -1;
    sugBox.innerHTML = '';
    items.forEach(function (w, i) {
      var li = mk('li', { role: 'option', 'data-i': String(i) }, w);
      li.addEventListener('pointerdown', function (ev) { ev.preventDefault(); acceptSug(w); });
      sugBox.appendChild(li);
    });
    var r = el.getBoundingClientRect();
    sugBox.style.left = Math.max(4, Math.min(r.left, win.innerWidth - 260)) + 'px';
    sugBox.style.top = (r.bottom + 2) + 'px';
    sugBox.style.minWidth = Math.max(160, Math.min(r.width, 360)) + 'px';
  }
  function acceptSug(w) {
    var el = sugFor;
    if (!el) return;
    var pre = prefixOf(txt(el));
    el.textContent = pre + w;
    norm(el); syncBind(el);
    closeSug();
    placeEnd(el);
    changed();
  }
  function moveSug(d) {
    if (!sugBox) return;
    var lis = all('li', sugBox);
    if (!lis.length) return;
    sugIdx = (sugIdx + d + lis.length) % lis.length;
    lis.forEach(function (li, i) { li.classList.toggle('is-on', i === sugIdx); li.setAttribute('aria-selected', i === sugIdx ? 'true' : 'false'); });
  }
  function placeEnd(el) {
    el.focus();
    try {
      var r = doc.createRange(); r.selectNodeContents(el); r.collapse(false);
      var s = win.getSelection(); s.removeAllRanges(); s.addRange(r);
    } catch (e) { /* ignore */ }
  }

  // ---------- ร่างที่กรอกไว้ (จำในเครื่องนี้) ----------
  function counts() { return [fields().length, dates().length, checks().length, signs().length].join(','); }
  // 1.0.16 ข้อมูลจากระบบตอนเปิดหน้า (ก่อนใส่ร่าง) — ใช้แยก "ที่ผู้ใช้แก้" ออกจาก "ข้อมูลที่ระบบเปลี่ยนภายหลัง"
  var BASE = null;
  function baseNow() {
    return {
      v: fields().map(txt),
      d: dates().map(function (x) { return x.getAttribute('data-date') || ''; }),
      c: checks().map(function (x) { return x.textContent.trim() ? 1 : 0; }),
    };
  }
  function snapshot() {
    var sg = signs().map(function (s) { var i = s.querySelector('img'); return i ? i.getAttribute('src') || '' : ''; });
    // ลายเซ็นในร่างรวมไม่เกิน ~400 KB (เครื่องจำร่างได้หลายฉบับ)
    if (sg.join('').length > 400000) sg = sg.map(function () { return ''; });
    return {
      n: counts(),
      v: fields().map(txt),
      d: dates().map(function (x) { return x.getAttribute('data-date') || ''; }),
      c: checks().map(function (x) { return x.textContent.trim() ? 1 : 0; }),
      s: sg,
      b: BASE,
      at: Date.now(),
    };
  }
  function prune() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(DRAFT_PREFIX) === 0) {
        var at = 0;
        try { at = JSON.parse(localStorage.getItem(k)).at || 0; } catch (e) { at = 0; }
        keys.push([k, at]);
      }
    }
    keys.sort(function (a, b) { return b[1] - a[1]; }).slice(MAX_DRAFTS).forEach(function (x) { localStorage.removeItem(x[0]); });
  }
  var saveTimer = 0;
  function save() {
    saveTimer = 0;
    if (!KEY) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot()));
      prune();
      say('บันทึกที่กรอกไว้ในเครื่องนี้แล้ว ' + clock(Date.now()));
    } catch (e) { /* เต็มหรือถูกปิด: ไม่จำร่าง แต่ยังกรอกและพิมพ์ได้ */ }
  }
  function clock(ms) {
    var t = new Date(ms + 7 * 3600e3);
    var hh = t.getUTCHours(), mm = t.getUTCMinutes();
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + ' น.';
  }
  var STALE = 0;
  function restore() {
    BASE = baseNow();
    STALE = 0;
    if (!KEY) return false;
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || typeof s !== 'object') return false;
    // ร่างจากเวอร์ชันก่อน (ยังไม่มีช่องลงชื่อ) ใช้ได้ถ้าช่องอื่นตรงกัน
    var n = String(s.n || '');
    if (n !== counts() && n !== counts().split(',').slice(0, 3).join(',')) {
      // 1.0.16 จำนวนช่องเปลี่ยน (เช่น รายงานมีงานเพิ่ม) → ใช้ข้อมูลล่าสุดของระบบ แต่เก็บลายมือชื่อที่ลงไว้
      var sg0 = Array.isArray(s.s) ? s.s : [];
      if (sg0.length === signs().length) putSigns(sg0);
      STALE = 1;
      return false;
    }
    var v = Array.isArray(s.v) ? s.v : [], d = Array.isArray(s.d) ? s.d : [], c = Array.isArray(s.c) ? s.c : [], sg = Array.isArray(s.s) ? s.s : [];
    // 1.0.16 รวมร่างกับข้อมูลล่าสุดของระบบทีละช่อง (แบบฟอร์มของรายงานในโครงการต้องตรงกับรายงานเสมอ):
    // ช่องที่ระบบเปลี่ยนหลังทำร่าง → ใช้ข้อมูลใหม่ · ช่องที่ผู้ใช้แก้เอง → ใช้ที่แก้ · ร่างรุ่นเก่า (ไม่มีข้อมูลตั้งต้น) → เติมเฉพาะช่องที่ว่าง
    var b = s.b && typeof s.b === 'object' ? s.b : null;
    var bv = b && Array.isArray(b.v) && b.v.length === BASE.v.length ? b.v : null;
    var bd = b && Array.isArray(b.d) && b.d.length === BASE.d.length ? b.d : null;
    var bc = b && Array.isArray(b.c) && b.c.length === BASE.c.length ? b.c : null;
    function pick(cur, was, mine, legacyOk) {
      if (was == null) return legacyOk ? mine : cur;
      if (String(was) !== String(cur)) { if (String(mine) !== String(was)) STALE++; return cur; }
      return mine;
    }
    fields().forEach(function (el, i) {
      var mine = v[i] == null ? '' : String(v[i]);
      var t = pick(BASE.v[i], bv ? bv[i] : null, mine, BASE.v[i] === '');
      if (txt(el) !== t) el.textContent = t;
      norm(el);
    });
    dates().forEach(function (el, i) {
      var mine = /^\d{4}-\d{2}-\d{2}$/.test(String(d[i] || '')) ? d[i] : '';
      showDate(el, pick(BASE.d[i], bd ? bd[i] : null, mine, BASE.d[i] === ''));
    });
    checks().forEach(function (el, i) {
      var on = pick(BASE.c[i], bc ? bc[i] : null, c[i] ? 1 : 0, true);
      el.textContent = on ? '✓' : '';
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    putSigns(sg);
    return s.at || true;
  }
  function putSigns(sg) {
    signs().forEach(function (el, i) {
      var src = String(sg[i] || '');
      if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src)) {
        var img = el.querySelector('img') || el.appendChild(mk('img', { class: 'sg-img', alt: 'ลายมือชื่อ' }));
        img.src = src; el.classList.add('has');
      }
    });
  }
  function say(t) { if (msg) msg.textContent = t; }
  /** 1.0.15 บันทึกหน้าที่กรอก/ลงชื่อแล้วเป็นไฟล์ PDF ในแท็บเอกสารของโครงการ (หน้าเว็บหลักเป็นผู้สร้างไฟล์) */
  var savingDoc = false;
  function saveDoc(btn) {
    if (savingDoc) return;
    if (typeof win.ptSaveDoc !== 'function') { say('เปิดแบบฟอร์มนี้จากรายงานประจำวันในระบบ จึงจะบันทึกเข้าเอกสารได้'); return; }
    savingDoc = true;
    btn.disabled = true;
    var label = btn.textContent;
    btn.textContent = 'กำลังบันทึก…';
    Promise.resolve().then(function () { return win.ptSaveDoc(function (t) { say(t + '…'); }); }).then(function (rec) {
      say('บันทึกไฟล์ "' + ((rec && rec.name) || 'PDF') + '" ในแท็บเอกสารของโครงการแล้ว');
    }, function (e) {
      say('บันทึกเข้าเอกสารไม่สำเร็จ: ' + ((e && e.message) || e));
    }).then(function () { savingDoc = false; btn.disabled = false; btn.textContent = label; });
  }

  function changed() {
    dirty = true;
    if (resetBtn) resetBtn.hidden = false;
    recalc();
    fit();
    if (KEY) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 500);
    }
  }

  var resetArm = 0;
  function reset() {
    if (!resetArm) {
      resetBtn.textContent = 'ยืนยันล้างที่กรอก';
      resetArm = setTimeout(function () { resetArm = 0; resetBtn.textContent = 'ล้างที่กรอก'; }, 4000);
      return;
    }
    clearTimeout(resetArm);
    resetArm = 0;
    resetBtn.textContent = 'ล้างที่กรอก';
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
    store(KEY, null);
    closeCal(false); closeSigMenu(); closeSug();
    wrap.innerHTML = original;
    body.classList.remove('of-long');
    if (body.getAttribute('data-long') === '1') body.classList.add('of-long');
    dirty = false;
    resetBtn.hidden = true;
    setup();
    say('กลับไปใช้ข้อมูลจากระบบแล้ว');
    win.dispatchEvent(new CustomEvent('pt-form-reset'));
  }

  // ---------- เปลี่ยนสัปดาห์ (รายงานประจำสัปดาห์) — หน้าที่เปิดแบบฟอร์มสร้างเนื้อหาใหม่ให้ ----------
  // 1.0.17 ใบส่งงวดงาน: เลือกงวดที่ (ใช้ทางเดียวกับเลือกสัปดาห์)
  var weekSel = doc.querySelector('[data-pt="week"], [data-pt="inst"]');
  if (weekSel) {
    weekSel.addEventListener('change', function () {
      if (typeof win.ptRebuild !== 'function') { say('เปิดแบบฟอร์มนี้ใหม่จากระบบเพื่อเปลี่ยน' + (weekSel.getAttribute('data-pt') === 'inst' ? 'งวด' : 'สัปดาห์')); return; }
      var out;
      try { out = win.ptRebuild({ week: +weekSel.value, inst: +weekSel.value }); } catch (e) { out = null; }
      if (!out || !out.html) { say('ดึงข้อมูลสัปดาห์นี้ไม่ได้ — เปิดแบบฟอร์มใหม่จากระบบ'); return; }
      if (saveTimer) { clearTimeout(saveTimer); save(); }
      closeCal(false); closeSigMenu(); closeSug();
      wrap.innerHTML = out.html;
      original = wrap.innerHTML;
      KEY = out.key ? DRAFT_PREFIX + out.key : KEY;
      body.setAttribute('data-key', out.key || '');
      if (out.title) doc.title = out.title;
      dirty = false;
      if (resetBtn) resetBtn.hidden = true;
      setup();
      var at = restore();
      if (at) { if (resetBtn) resetBtn.hidden = false; recalc(); }
      say(out.msg || ((weekSel.getAttribute('data-pt') === 'inst' ? 'เปลี่ยนเป็นงวดที่ ' : 'เปลี่ยนเป็นสัปดาห์ที่ ') + weekSel.value + ' แล้ว'));
      drawSigChip();
    });
  }

  // ---------- เหตุการณ์ ----------
  doc.addEventListener('input', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-f]');
    if (!el) return;
    norm(el);
    syncBind(el);
    if (el.getAttribute('data-sug')) showSug(el);
    changed();
  });
  doc.addEventListener('focusin', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-f]');
    if (sugFor && el !== sugFor) closeSug();
  });
  doc.addEventListener('paste', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-f]');
    if (!el || PLAIN) return;
    ev.preventDefault();
    var t = (ev.clipboardData || win.clipboardData).getData('text/plain');
    doc.execCommand('insertText', false, t);
  });
  doc.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (!t.closest) return;
    if (calKey(ev)) return;
    if (sigMenu && ev.key === 'Escape') { ev.preventDefault(); var sp = sigFor; closeSigMenu(); if (sp) sp.focus(); return; }
    var f = t.closest('[data-f]');
    if (f && sugBox && sugFor === f) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); moveSug(1); return; }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); moveSug(-1); return; }
      if (ev.key === 'Escape') { ev.preventDefault(); closeSug(); return; }
      if ((ev.key === 'Enter' || ev.key === 'Tab') && sugIdx >= 0 && !ev.isComposing) {
        ev.preventDefault();
        acceptSug(all('li', sugBox)[sugIdx].textContent);
        return;
      }
    }
    if (f && ev.key === 'Enter' && !ev.shiftKey && !f.classList.contains('multi') && !ev.isComposing) {
      // Enter = ไปช่องถัดไป (Shift+Enter = ขึ้นบรรทัดใหม่ในช่องเดิม)
      ev.preventDefault();
      closeSug();
      var list = fields(), i = list.indexOf(f);
      if (list[i + 1]) placeEnd(list[i + 1]);
      return;
    }
    var d = t.closest('[data-date]');
    if (d && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'ArrowDown')) { ev.preventDefault(); openCal(d); return; }
    if (d && (ev.key === 'Delete' || ev.key === 'Backspace')) { ev.preventDefault(); setDate(d, ''); return; }
    var c = t.closest('[data-ck]');
    if (c && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); toggle(c); return; }
    var sgs = t.closest('[data-sign]');
    if (sgs && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openSigMenu(sgs); return; }
    var p = t.closest('[data-photo]');
    if (p && !t.closest('[data-f]') && !t.closest('button') && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); fileFor = p; fileIn.click(); }
  });
  doc.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t.closest) return;
    if (cal && cal.contains(t)) {
      var day = t.closest('[data-day]');
      if (day) { pickDay(day.getAttribute('data-day')); return; }
      var nav = t.closest('[data-nav]');
      if (nav) {
        calView.m += +nav.getAttribute('data-nav');
        if (calView.m < 0) { calView.m = 11; calView.y--; } if (calView.m > 11) { calView.m = 0; calView.y++; }
        drawCal();
        return;
      }
      var a = t.closest('[data-cal]');
      if (a) {
        var act = a.getAttribute('data-cal');
        if (act === 'today') pickDay(today());
        else if (act === 'clear') pickDay('');
        else closeCal(true);
      }
      return;
    }
    var b = t.closest('.bar [data-pt]');
    if (b && b.tagName === 'BUTTON') {
      var ac = b.getAttribute('data-pt');
      if (ac === 'print') printNow();
      else if (ac === 'close') win.close();
      else if (ac === 'reset') reset();
      else if (ac === 'savedoc') saveDoc(b);
      else if (ac === 'preview') {
        var on = body.classList.toggle('preview');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.textContent = on ? 'กลับไปกรอก' : 'ดูแบบพิมพ์';
      }
      return;
    }
    var d = t.closest('[data-date]');
    if (d) { openCal(d); return; }
    var c = t.closest('[data-ck]');
    if (c) { toggle(c); return; }
    var sgs = t.closest('[data-sign]');
    if (sgs) { openSigMenu(sgs); return; }
    var p = t.closest('[data-photo]');
    if (p && t.closest('.ph-x')) { setPhoto(p, ''); changed(); return; }
    if (p && t.closest('.ph-mk')) { markPhoto(p); return; }
    if (p && !t.closest('[data-f]')) { fileFor = p; fileIn.click(); }
  });
  fileIn.addEventListener('change', function () {
    if (fileFor && fileIn.files && fileIn.files[0]) readImage(fileIn.files[0], fileFor);
    fileIn.value = '';
  });
  doc.addEventListener('dragover', function (ev) {
    var tgt = ev.target.closest && (ev.target.closest('[data-photo]') || ev.target.closest('[data-sign]'));
    if (tgt) { ev.preventDefault(); tgt.classList.add('is-over'); }
  });
  doc.addEventListener('dragleave', function (ev) {
    var tgt = ev.target.closest && (ev.target.closest('[data-photo]') || ev.target.closest('[data-sign]'));
    if (tgt) tgt.classList.remove('is-over');
  });
  doc.addEventListener('drop', function (ev) {
    var sgs = ev.target.closest && ev.target.closest('[data-sign]');
    var p = ev.target.closest && ev.target.closest('[data-photo]');
    if (!sgs && !p) return;
    ev.preventDefault();
    (sgs || p).classList.remove('is-over');
    var dt = ev.dataTransfer;
    if (sgs) {
      if (dt && Array.prototype.indexOf.call(dt.types || [], 'text/x-pt-sig') >= 0 && savedSig()) { useSig(sgs, savedSig(), false); return; }
      var sf = dt && dt.files && dt.files[0];
      if (sf) fromImage(sf, sgs, remember());
      return;
    }
    var f = dt && dt.files && dt.files[0];
    if (f) readImage(f, p);
  });

  function printNow() {
    if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();
    closeCal(false); closeSigMenu(); closeSug();
    if (saveTimer) { clearTimeout(saveTimer); save(); }
    win.print();
  }
  win.addEventListener('beforeprint', function () {
    if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();
    closeCal(false); closeSigMenu(); closeSug();
  });
  win.addEventListener('pagehide', function () { if (saveTimer) { clearTimeout(saveTimer); save(); } });

  // ---------- เริ่มต้น ----------
  setup();
  var at = restore();
  if (at) {
    dirty = true;
    if (resetBtn) resetBtn.hidden = false;
    recalc();
    fit();
    if (STALE) say('ข้อมูลรายงานในระบบเปลี่ยนหลังจากที่กรอกไว้ — ใช้ข้อมูลล่าสุดของระบบใน ' + STALE + ' ช่อง ส่วนที่แก้เองช่องอื่นยังอยู่'); else say('กรอกต่อจากที่บันทึกไว้ในเครื่องนี้' + (typeof at === 'number' ? ' (' + clock(at) + ')' : '') + ' — กด "ล้างที่กรอก" เพื่อเริ่มจากข้อมูลในระบบ');
  } else if (msg) {
    say(STALE ? 'ข้อมูลรายงานในระบบเปลี่ยนหลังจากที่กรอกไว้ — แบบฟอร์มใช้ข้อมูลล่าสุดของระบบแล้ว' : hint);
  }
  drawSigChip();
  // ฟอนต์โหลดเสร็จทีหลัง (ขนาดตัวอักษรเปลี่ยน) → ตรวจว่าล้นหน้าอีกครั้ง
  win.addEventListener('load', fit);
  try { if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit); } catch (e) { /* ignore */ }
  // ให้หน้าที่เปิดแบบฟอร์มรู้ว่าพร้อมแล้ว (ใส่รูปจากระบบต่อได้)
  win.ptForm = {
    setPhoto: function (i, src) { var c = photos()[i]; if (c && !c.classList.contains('has-img')) setPhoto(c, src); },
    today: today, fmtDate: fmtDate, dirty: function () { return dirty; },
  };
  win.dispatchEvent(new CustomEvent('pt-form-ready'));
})();
