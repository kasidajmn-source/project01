/*
 * กรอกแบบฟอร์มบนเว็บ (1.0.13) — โหลดในหน้าต่างแบบฟอร์มที่ forms.js เปิด
 * คลิกช่องเพื่อพิมพ์ · คลิกวันที่เพื่อเลือกจากปฏิทิน · ติ๊กช่องสี่เหลี่ยม · ใส่รูป · จำที่กรอกไว้ในเครื่องนี้
 * แล้วกด "บันทึก PDF / พิมพ์" (เลือกปลายทาง "บันทึกเป็น PDF" ในหน้าต่างพิมพ์)
 * ไฟล์นี้เป็นสคริปต์ธรรมดา (ไม่ใช่ module) และไม่พึ่งโค้ดอื่นของระบบ
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
  var DRAFT_PREFIX = 'pt.fd.';
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
  /** วันนี้ตามเวลาประเทศไทย */
  function today() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function num(t) { var v = parseFloat(String(t || '').replace(/,/g, '')); return isFinite(v) ? v : 0; }
  function fmtNum(v) { return (Math.round(v * 100) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
  function all(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function txt(el) { return String(el.innerText != null && el.isContentEditable ? el.innerText : el.textContent).replace(/ /g, ' ').replace(/\n+$/, ''); }

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
  function fields() { return all('[data-f]'); }
  function dates() { return all('[data-date]'); }
  function checks() { return all('[data-ck]'); }
  function photos() { return all('[data-photo]'); }

  function norm(el) {
    var t = (el.textContent || '').replace(/ /g, ' ');
    if (!t.trim() && el.innerHTML !== '') el.innerHTML = '';
    el.classList.toggle('has', !!t.trim());
  }
  function setup() {
    fields().forEach(function (el) {
      el.setAttribute('contenteditable', PLAIN ? 'plaintext-only' : 'true');
      el.setAttribute('spellcheck', 'false');
      if (!el.getAttribute('aria-label')) {
        var lab = el.getAttribute('data-l');
        if (lab) el.setAttribute('aria-label', lab);
      }
      norm(el);
    });
    dates().forEach(function (el) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
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

  // ---------- วันที่ ----------
  var dp = doc.createElement('input');
  dp.type = 'date';
  dp.className = 'fd-input';
  dp.tabIndex = -1;
  dp.setAttribute('aria-label', 'เลือกวันที่');
  body.appendChild(dp);
  var curDate = null;
  function addDays(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    var t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
    return t.toISOString().slice(0, 10);
  }
  function showDate(el, iso) {
    el.setAttribute('data-date', iso || '');
    el.textContent = iso ? fmtDate(iso, el.getAttribute('data-fmt')) : '';
    el.classList.toggle('has', !!iso);
  }
  function setDate(el, iso) {
    showDate(el, iso);
    // วันที่ที่ผูกกัน (เช่น Daily Request = วันถัดจาก Daily Report) เลื่อนตาม เว้นแต่ผู้ใช้เลือกเองแล้ว
    if (el.getAttribute('data-follow')) el.setAttribute('data-touched', '1');
    var id = el.getAttribute('data-id');
    if (id) {
      all('[data-follow^="' + id + ':"]').forEach(function (f) {
        if (f.getAttribute('data-touched') === '1') return;
        var n = +(f.getAttribute('data-follow').split(':')[1] || 0);
        showDate(f, iso ? addDays(iso, n) : '');
      });
    }
    changed();
  }
  function openPicker(el) {
    curDate = el;
    var r = el.getBoundingClientRect();
    dp.style.left = Math.max(0, r.left + win.scrollX) + 'px';
    dp.style.top = (r.bottom + win.scrollY) + 'px';
    dp.value = el.getAttribute('data-date') || today();
    dp.classList.remove('vis');
    try {
      if (typeof dp.showPicker !== 'function') throw new Error('no picker');
      dp.showPicker();
    } catch (e) {
      dp.classList.add('vis');
      dp.focus();
    }
  }
  function pickChanged() {
    if (!curDate) return;
    setDate(curDate, dp.value || '');
  }
  dp.addEventListener('change', pickChanged);
  dp.addEventListener('input', pickChanged);
  dp.addEventListener('blur', function () { dp.classList.remove('vis'); });
  dp.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.key === 'Escape') { dp.classList.remove('vis'); if (curDate) curDate.focus(); }
  });

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
  var fileIn = doc.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = 'image/*';
  fileIn.className = 'ph-input';
  fileIn.tabIndex = -1;
  body.appendChild(fileIn);
  var curPhoto = null;
  function setPhoto(cell, src) {
    var img = cell.querySelector('img');
    if (!src) { if (img) img.remove(); cell.classList.remove('has-img'); return; }
    if (!img) { img = doc.createElement('img'); img.alt = ''; cell.insertBefore(img, cell.firstChild); }
    img.src = src;
    cell.classList.add('has-img');
  }
  /** ย่อรูปให้ด้านยาวไม่เกิน 1600 px ก่อนใส่ในแบบฟอร์ม (ไฟล์ PDF ไม่ใหญ่เกินไป) */
  function readImage(file, cell) {
    if (!file || !/^image\//.test(file.type || '')) { say('เลือกได้เฉพาะไฟล์รูปภาพ'); return; }
    var url = URL.createObjectURL(file);
    var im = new Image();
    im.onload = function () {
      try {
        var s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
        var c = doc.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s);
        c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        setPhoto(cell, c.toDataURL('image/jpeg', 0.85));
      } catch (e) {
        setPhoto(cell, url);
        return;
      }
      URL.revokeObjectURL(url);
    };
    im.onerror = function () { URL.revokeObjectURL(url); say('เปิดรูปนี้ไม่ได้ ลองไฟล์ JPG หรือ PNG'); };
    im.src = url;
  }
  fileIn.addEventListener('change', function () {
    if (curPhoto && fileIn.files && fileIn.files[0]) readImage(fileIn.files[0], curPhoto);
    fileIn.value = '';
  });

  // ---------- ร่างที่กรอกไว้ (จำในเครื่องนี้) ----------
  function counts() { return [fields().length, dates().length, checks().length].join(','); }
  function snapshot() {
    return {
      n: counts(),
      v: fields().map(txt),
      d: dates().map(function (x) { return x.getAttribute('data-date') || ''; }),
      c: checks().map(function (x) { return x.textContent.trim() ? 1 : 0; }),
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
  function restore() {
    if (!KEY) return false;
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || s.n !== counts()) return false;
    fields().forEach(function (el, i) {
      var v = s.v[i] == null ? '' : String(s.v[i]);
      if (txt(el) !== v) el.textContent = v;
      norm(el);
    });
    dates().forEach(function (el, i) {
      var v = s.d[i] || '';
      el.setAttribute('data-date', v);
      el.textContent = v ? fmtDate(v, el.getAttribute('data-fmt')) : '';
      el.classList.toggle('has', !!v);
    });
    checks().forEach(function (el, i) {
      el.textContent = s.c[i] ? '✓' : '';
      el.setAttribute('aria-checked', s.c[i] ? 'true' : 'false');
    });
    return s.at || true;
  }
  function say(t) { if (msg) msg.textContent = t; }

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
    try { if (KEY) localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    wrap.innerHTML = original;
    body.classList.remove('of-long');
    if (body.getAttribute('data-long') === '1') body.classList.add('of-long');
    dirty = false;
    resetBtn.hidden = true;
    setup();
    say('กลับไปใช้ข้อมูลจากระบบแล้ว');
    win.dispatchEvent(new CustomEvent('pt-form-reset'));
  }

  // ---------- เหตุการณ์ ----------
  doc.addEventListener('input', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-f]');
    if (!el) return;
    norm(el);
    changed();
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
    var f = t.closest('[data-f]');
    if (f && ev.key === 'Enter' && !ev.shiftKey && !f.classList.contains('multi') && !ev.isComposing) {
      // Enter = ไปช่องถัดไป (Shift+Enter = ขึ้นบรรทัดใหม่ในช่องเดิม)
      ev.preventDefault();
      var list = fields(), i = list.indexOf(f);
      if (list[i + 1]) focusEnd(list[i + 1]);
      return;
    }
    var d = t.closest('[data-date]');
    if (d && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openPicker(d); return; }
    if (d && (ev.key === 'Delete' || ev.key === 'Backspace')) { ev.preventDefault(); setDate(d, ''); return; }
    var c = t.closest('[data-ck]');
    if (c && (ev.key === ' ' || ev.key === 'Enter')) { ev.preventDefault(); toggle(c); return; }
    var p = t.closest('[data-photo]');
    if (p && !t.closest('[data-f]') && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); curPhoto = p; fileIn.click(); }
  });
  function focusEnd(el) {
    el.focus();
    try {
      var r = doc.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      var s = win.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (e) { /* ignore */ }
  }
  doc.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t.closest) return;
    var b = t.closest('[data-pt]');
    if (b && b.tagName === 'BUTTON') {
      var a = b.getAttribute('data-pt');
      if (a === 'print') printNow();
      else if (a === 'close') win.close();
      else if (a === 'reset') reset();
      else if (a === 'preview') {
        var on = body.classList.toggle('preview');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.textContent = on ? 'กลับไปกรอก' : 'ดูแบบพิมพ์';
      }
      return;
    }
    var d = t.closest('[data-date]');
    if (d) { openPicker(d); return; }
    var c = t.closest('[data-ck]');
    if (c) { toggle(c); return; }
    var x = t.closest('.ph-x');
    var p = t.closest('[data-photo]');
    if (x && p) { setPhoto(p, ''); changed(); return; }
    if (p && !t.closest('[data-f]')) { curPhoto = p; fileIn.click(); }
  });
  doc.addEventListener('dragover', function (ev) {
    if (ev.target.closest && ev.target.closest('[data-photo]')) { ev.preventDefault(); }
  });
  doc.addEventListener('drop', function (ev) {
    var p = ev.target.closest && ev.target.closest('[data-photo]');
    if (!p) return;
    ev.preventDefault();
    var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (f) readImage(f, p);
  });

  function printNow() {
    if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();
    dp.classList.remove('vis');
    if (saveTimer) { clearTimeout(saveTimer); save(); }
    win.print();
  }
  win.addEventListener('beforeprint', function () {
    if (doc.activeElement && doc.activeElement.blur) doc.activeElement.blur();
    dp.classList.remove('vis');
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
    say('กรอกต่อจากที่บันทึกไว้ในเครื่องนี้' + (typeof at === 'number' ? ' (' + clock(at) + ')' : '') + ' — กด "ล้างที่กรอก" เพื่อเริ่มจากข้อมูลในระบบ');
  } else if (msg) {
    say(hint);
  }
  // ฟอนต์โหลดเสร็จทีหลัง (ขนาดตัวอักษรเปลี่ยน) → ตรวจว่าล้นหน้าอีกครั้ง
  win.addEventListener('load', fit);
  try { if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(fit); } catch (e) { /* ignore */ }
  // ให้หน้าที่เปิดแบบฟอร์มรู้ว่าพร้อมแล้ว (ใส่รูปจากระบบต่อได้)
  win.ptForm = { setPhoto: function (i, src) { var c = photos()[i]; if (c && !c.classList.contains('has-img')) setPhoto(c, src); }, today: today, fmtDate: fmtDate, dirty: function () { return dirty; } };
  win.dispatchEvent(new CustomEvent('pt-form-ready'));
})();
