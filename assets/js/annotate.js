/*
 * มาร์ค/โน้ตบนรูป และลายมือชื่อ (1.0.14) — ใช้ได้ทั้งในเว็บและในหน้าต่างแบบฟอร์ม
 *   PTAnnotate.edit(src)            → Promise<Blob|null>  วาดเส้น ลูกศร กรอบ วงกลม ข้อความ บนรูป (ไฟล์ JPEG)
 *   PTAnnotate.signature()          → Promise<dataURL|null> วาดลายมือชื่อ (PNG พื้นใส)
 *   PTAnnotate.cleanSignature(src)  → Promise<dataURL>     รูปลายเซ็น → ตัดพื้นขาวออก ตัดขอบ (PNG พื้นใส)
 *   PTAnnotate.annotateFile(file)   → Promise<File>        รูปที่มาร์คแล้วเป็นไฟล์ใหม่ (ชื่อเดิม .jpg) หรือไฟล์เดิมถ้ายกเลิก
 * สคริปต์ธรรมดา (ไม่ใช่ module) ไม่พึ่งโค้ดอื่น — โหลดซ้ำได้
 */
(function (g) {
  'use strict';
  if (g.PTAnnotate) return;
  var MAX = 1600;
  var COLORS = [['#E02424', 'แดง'], ['#F5B400', 'เหลือง'], ['#1D4F91', 'น้ำเงิน'], ['#FFFFFF', 'ขาว'], ['#111111', 'ดำ']];
  var TOOLS = [['pen', 'ปากกา'], ['arrow', 'ลูกศร'], ['rect', 'กรอบ'], ['ellipse', 'วงกลม'], ['text', 'ข้อความ']];
  var CSS = '.pta{position:fixed;inset:0;z-index:2147483000;background:rgba(17,24,39,.86);display:flex;flex-direction:column;font:14px/1.4 Sarabun,"IBM Plex Sans Thai",Tahoma,sans-serif;color:#fff}'
    + '.pta *{box-sizing:border-box}.pta-bar{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;padding:8px 12px;background:#0F1B2D}'
    + '.pta-bar b{font-weight:600;margin-right:6px}.pta-g{display:flex;gap:4px;align-items:center;padding-right:8px;margin-right:2px;border-right:1px solid rgba(255,255,255,.18)}'
    + '.pta button{font:inherit;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);border-radius:4px;padding:6px 10px;cursor:pointer;min-height:34px}'
    + '.pta button:hover{background:rgba(255,255,255,.16)}.pta button:focus-visible{outline:2px solid #F5B400;outline-offset:2px}'
    + '.pta button[aria-pressed="true"]{background:#F5B400;color:#111;border-color:#F5B400;font-weight:600}'
    + '.pta .pta-c{width:30px;min-width:30px;padding:0;border-radius:15px}.pta .pta-c[aria-pressed="true"]{outline:3px solid #fff;outline-offset:1px}'
    + '.pta .pta-ok{background:#fff;color:#1D4F91;font-weight:700;border-color:#fff}.pta .pta-sp{flex:1}'
    + '.pta-st{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto;position:relative}'
    + '.pta canvas{max-width:100%;max-height:100%;background:#fff;touch-action:none;cursor:crosshair;box-shadow:0 4px 24px rgba(0,0,0,.4)}'
    + '.pta-sig canvas{background:#fff;border-radius:4px}.pta-hint{padding:6px 12px 10px;color:#C9D3E3;font-size:13px;text-align:center}'
    + '.pta-txt{position:absolute;z-index:2;font:16px Sarabun,Tahoma,sans-serif;padding:4px 6px;border:2px solid #F5B400;border-radius:3px;min-width:160px;color:#111;background:#fff}'
    + '@media (max-width:640px){.pta-bar{padding:6px}.pta button{padding:5px 8px;min-height:32px}.pta-g{border-right:0}}';

  function style(doc) {
    if (doc.getElementById('pta-css')) return;
    var s = doc.createElement('style');
    s.id = 'pta-css';
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }
  function el(doc, tag, attrs, text) {
    var x = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { x.setAttribute(k, attrs[k]); });
    if (text != null) x.textContent = text;
    return x;
  }
  /** โหลดรูปจาก File/Blob/dataURL/URL */
  function loadImage(src) {
    return new Promise(function (res, rej) {
      var url = src, revoke = false;
      if (typeof Blob !== 'undefined' && src instanceof Blob) { url = URL.createObjectURL(src); revoke = true; }
      var im = new Image();
      im.onload = function () { res({ im: im, done: function () { if (revoke) URL.revokeObjectURL(url); } }); };
      im.onerror = function () { if (revoke) URL.revokeObjectURL(url); rej(new Error('เปิดรูปนี้ไม่ได้')); };
      if (!/^(data:|blob:)/.test(String(url))) im.crossOrigin = 'anonymous';
      im.src = url;
    });
  }
  function overlay(doc, cls) {
    style(doc);
    var o = el(doc, 'div', { class: 'pta ' + (cls || ''), role: 'dialog', 'aria-modal': 'true' });
    doc.body.appendChild(o);
    var prev = doc.activeElement;
    return { o: o, close: function () { o.remove(); if (prev && prev.focus) { try { prev.focus(); } catch (e) { /* ignore */ } } } };
  }
  function btn(doc, label, attrs) {
    var b = el(doc, 'button', Object.assign({ type: 'button' }, attrs || {}), label);
    return b;
  }

  // ---------- มาร์ค/โน้ตบนรูป ----------
  function edit(src, opts) {
    opts = opts || {};
    var doc = opts.doc || g.document;
    return loadImage(src).then(function (L) {
      return new Promise(function (resolve) {
        var im = L.im;
        var s = Math.min(1, MAX / Math.max(im.naturalWidth || 1, im.naturalHeight || 1));
        var W = Math.max(1, Math.round(im.naturalWidth * s)), H = Math.max(1, Math.round(im.naturalHeight * s));
        var ov = overlay(doc, 'pta-ed');
        ov.o.setAttribute('aria-label', 'มาร์คและเขียนโน้ตบนรูป');
        var bar = el(doc, 'div', { class: 'pta-bar' });
        bar.appendChild(el(doc, 'b', {}, opts.title || 'มาร์ค/โน้ตบนรูป'));
        var gt = el(doc, 'div', { class: 'pta-g', role: 'group', 'aria-label': 'เครื่องมือ' });
        var gc = el(doc, 'div', { class: 'pta-g', role: 'group', 'aria-label': 'สี' });
        var gw = el(doc, 'div', { class: 'pta-g', role: 'group', 'aria-label': 'ความหนา' });
        var st = { tool: 'arrow', color: COLORS[0][0], w: 1, shapes: [], cur: null };
        TOOLS.forEach(function (t) {
          var b = btn(doc, t[1], { 'data-tool': t[0], 'aria-pressed': t[0] === st.tool ? 'true' : 'false' });
          b.addEventListener('click', function () { st.tool = t[0]; [].forEach.call(gt.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
          gt.appendChild(b);
        });
        COLORS.forEach(function (c, i) {
          var b = btn(doc, '', { class: 'pta-c', style: 'background:' + c[0], 'aria-label': 'สี' + c[1], 'aria-pressed': i === 0 ? 'true' : 'false' });
          b.addEventListener('click', function () { st.color = c[0]; [].forEach.call(gc.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
          gc.appendChild(b);
        });
        [['บาง', 0.6], ['กลาง', 1], ['หนา', 1.8]].forEach(function (x) {
          var b = btn(doc, x[0], { 'aria-pressed': x[1] === 1 ? 'true' : 'false' });
          b.addEventListener('click', function () { st.w = x[1]; [].forEach.call(gw.children, function (y) { y.setAttribute('aria-pressed', y === b ? 'true' : 'false'); }); });
          gw.appendChild(b);
        });
        var undo = btn(doc, 'ย้อนกลับ'), clear = btn(doc, 'ล้างที่มาร์ค'), cancel = btn(doc, 'ยกเลิก'), ok = btn(doc, 'ใช้รูปนี้', { class: 'pta-ok' });
        bar.appendChild(gt); bar.appendChild(gc); bar.appendChild(gw);
        bar.appendChild(undo); bar.appendChild(clear); bar.appendChild(el(doc, 'span', { class: 'pta-sp' }));
        bar.appendChild(cancel); bar.appendChild(ok);
        var stage = el(doc, 'div', { class: 'pta-st' });
        var cv = el(doc, 'canvas', { width: String(W), height: String(H), 'aria-label': 'รูปสำหรับมาร์ค' });
        stage.appendChild(cv);
        ov.o.appendChild(bar); ov.o.appendChild(stage);
        ov.o.appendChild(el(doc, 'div', { class: 'pta-hint' }, 'ลากบนรูปเพื่อวาด · เครื่องมือข้อความ: คลิกตำแหน่งแล้วพิมพ์ กด Enter · Esc = ยกเลิก'));
        var ctx = cv.getContext('2d');
        var lw = function () { return Math.max(2, Math.round(Math.max(W, H) / 260)) * st.w; };

        function drawShape(c, sh) {
          c.save();
          c.strokeStyle = sh.color; c.fillStyle = sh.color; c.lineWidth = sh.lw; c.lineCap = 'round'; c.lineJoin = 'round';
          if (sh.type === 'pen') {
            c.beginPath();
            sh.pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
            c.stroke();
          } else if (sh.type === 'rect') {
            c.strokeRect(Math.min(sh.x1, sh.x2), Math.min(sh.y1, sh.y2), Math.abs(sh.x2 - sh.x1), Math.abs(sh.y2 - sh.y1));
          } else if (sh.type === 'ellipse') {
            c.beginPath();
            c.ellipse((sh.x1 + sh.x2) / 2, (sh.y1 + sh.y2) / 2, Math.abs(sh.x2 - sh.x1) / 2 || 1, Math.abs(sh.y2 - sh.y1) / 2 || 1, 0, 0, Math.PI * 2);
            c.stroke();
          } else if (sh.type === 'arrow') {
            var a = Math.atan2(sh.y2 - sh.y1, sh.x2 - sh.x1), hl = sh.lw * 4.5;
            c.beginPath(); c.moveTo(sh.x1, sh.y1); c.lineTo(sh.x2, sh.y2); c.stroke();
            c.beginPath(); c.moveTo(sh.x2, sh.y2);
            c.lineTo(sh.x2 - hl * Math.cos(a - 0.45), sh.y2 - hl * Math.sin(a - 0.45));
            c.lineTo(sh.x2 - hl * Math.cos(a + 0.45), sh.y2 - hl * Math.sin(a + 0.45));
            c.closePath(); c.fill();
          } else if (sh.type === 'text') {
            c.font = '600 ' + sh.size + 'px Sarabun, "IBM Plex Sans Thai", Tahoma, sans-serif';
            c.textBaseline = 'top';
            c.lineWidth = Math.max(2, sh.size / 7);
            c.strokeStyle = sh.color === '#FFFFFF' || sh.color === '#F5B400' ? '#111111' : '#FFFFFF';
            String(sh.text).split('\n').forEach(function (ln, i) {
              c.strokeText(ln, sh.x, sh.y + i * sh.size * 1.25);
              c.fillText(ln, sh.x, sh.y + i * sh.size * 1.25);
            });
          }
          c.restore();
        }
        function redraw() {
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(im, 0, 0, W, H);
          st.shapes.forEach(function (sh) { drawShape(ctx, sh); });
          if (st.cur) drawShape(ctx, st.cur);
        }
        redraw();
        function pos(ev) {
          var r = cv.getBoundingClientRect();
          return [(ev.clientX - r.left) * (W / r.width), (ev.clientY - r.top) * (H / r.height)];
        }
        var txtBox = null;
        function textAt(p, ev) {
          if (txtBox) { var old = txtBox; txtBox = null; old.remove(); }
          var r = stage.getBoundingClientRect();
          txtBox = el(doc, 'input', { class: 'pta-txt', type: 'text', 'aria-label': 'ข้อความบนรูป', placeholder: 'พิมพ์ข้อความ แล้วกด Enter', maxlength: '120' });
          txtBox.style.left = (ev.clientX - r.left + stage.scrollLeft) + 'px';
          txtBox.style.top = (ev.clientY - r.top + stage.scrollTop) + 'px';
          stage.appendChild(txtBox);
          setTimeout(function () { txtBox && txtBox.focus(); }, 0);
          var commit = function () {
            if (!txtBox) return;
            // เอาออกจากหน้าแล้วจะเกิด blur ซ้ำ — ล้างตัวแปรก่อน
            var box = txtBox; txtBox = null;
            var t = box.value.trim();
            box.remove();
            if (t) { st.shapes.push({ type: 'text', x: p[0], y: p[1], text: t, color: st.color, size: Math.max(16, Math.round(Math.max(W, H) / 38)) * st.w, lw: 1 }); redraw(); }
          };
          txtBox.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); var box = txtBox; txtBox = null; box.remove(); }
          });
          txtBox.addEventListener('blur', commit);
        }
        cv.addEventListener('pointerdown', function (ev) {
          ev.preventDefault();
          var p = pos(ev);
          if (st.tool === 'text') { textAt(p, ev); return; }
          try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
          st.cur = st.tool === 'pen' ? { type: 'pen', pts: [p], color: st.color, lw: lw() } : { type: st.tool, x1: p[0], y1: p[1], x2: p[0], y2: p[1], color: st.color, lw: lw() };
        });
        cv.addEventListener('pointermove', function (ev) {
          if (!st.cur) return;
          var p = pos(ev);
          if (st.cur.type === 'pen') st.cur.pts.push(p); else { st.cur.x2 = p[0]; st.cur.y2 = p[1]; }
          redraw();
        });
        var end = function () {
          if (!st.cur) return;
          var c = st.cur; st.cur = null;
          var tiny = c.type === 'pen' ? c.pts.length < 2 : Math.abs(c.x2 - c.x1) + Math.abs(c.y2 - c.y1) < 4;
          if (!tiny) st.shapes.push(c);
          redraw();
        };
        cv.addEventListener('pointerup', end);
        cv.addEventListener('pointercancel', end);
        undo.addEventListener('click', function () { st.shapes.pop(); redraw(); });
        clear.addEventListener('click', function () { st.shapes = []; redraw(); });
        var finish = function (val) { doc.removeEventListener('keydown', onKey, true); ov.close(); L.done(); resolve(val); };
        cancel.addEventListener('click', function () { finish(null); });
        ok.addEventListener('click', function () {
          if (txtBox) txtBox.blur();
          redraw();
          try {
            cv.toBlob(function (b) { finish(b); }, 'image/jpeg', 0.88);
          } catch (e) {
            // รูปจากเว็บอื่นที่ไม่อนุญาต → ใช้รูปเดิม
            finish(null);
          }
        });
        function onKey(e) {
          if (e.key === 'Escape' && !txtBox) { e.preventDefault(); e.stopPropagation(); finish(null); }
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.stopPropagation(); st.shapes.pop(); redraw(); }
        }
        doc.addEventListener('keydown', onKey, true);
        ok.focus();
      });
    });
  }

  // ---------- วาดลายมือชื่อ ----------
  function signature(opts) {
    opts = opts || {};
    var doc = opts.doc || g.document;
    return new Promise(function (resolve) {
      var ov = overlay(doc, 'pta-sig');
      ov.o.setAttribute('aria-label', 'วาดลายมือชื่อ');
      var bar = el(doc, 'div', { class: 'pta-bar' });
      bar.appendChild(el(doc, 'b', {}, 'ลงลายมือชื่อ'));
      var gc = el(doc, 'div', { class: 'pta-g', role: 'group', 'aria-label': 'สีหมึก' });
      var ink = '#0B2A6F';
      [['#0B2A6F', 'น้ำเงิน'], ['#111111', 'ดำ']].forEach(function (c, i) {
        var b = btn(doc, '', { class: 'pta-c', style: 'background:' + c[0], 'aria-label': 'หมึก' + c[1], 'aria-pressed': i === 0 ? 'true' : 'false' });
        b.addEventListener('click', function () { ink = c[0]; [].forEach.call(gc.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
        gc.appendChild(b);
      });
      var clear = btn(doc, 'ล้าง'), cancel = btn(doc, 'ยกเลิก'), ok = btn(doc, 'ใช้ลายมือชื่อนี้', { class: 'pta-ok' });
      bar.appendChild(gc); bar.appendChild(clear); bar.appendChild(el(doc, 'span', { class: 'pta-sp' })); bar.appendChild(cancel); bar.appendChild(ok);
      var stage = el(doc, 'div', { class: 'pta-st' });
      var W = 900, H = 320;
      var cv = el(doc, 'canvas', { width: String(W), height: String(H), 'aria-label': 'พื้นที่เซ็นชื่อ' });
      cv.style.width = 'min(92vw, 720px)';
      stage.appendChild(cv);
      ov.o.appendChild(bar); ov.o.appendChild(stage);
      ov.o.appendChild(el(doc, 'div', { class: 'pta-hint' }, 'เซ็นด้วยเมาส์ นิ้ว หรือปากกาในกรอบสีขาว'));
      var c = cv.getContext('2d');
      c.lineCap = 'round'; c.lineJoin = 'round';
      var drawing = false, last = null, inked = false;
      function pos(ev) { var r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * (W / r.width), (ev.clientY - r.top) * (H / r.height)]; }
      cv.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        drawing = true; last = pos(ev);
        c.fillStyle = ink; c.beginPath(); c.arc(last[0], last[1], 2.2, 0, Math.PI * 2); c.fill(); inked = true;
      });
      cv.addEventListener('pointermove', function (ev) {
        if (!drawing) return;
        var p = pos(ev);
        var pr = ev.pressure && ev.pointerType === 'pen' ? ev.pressure : 0.5;
        c.strokeStyle = ink; c.lineWidth = 3 + pr * 3;
        c.beginPath(); c.moveTo(last[0], last[1]);
        c.quadraticCurveTo(last[0], last[1], (last[0] + p[0]) / 2, (last[1] + p[1]) / 2);
        c.lineTo(p[0], p[1]); c.stroke();
        last = p; inked = true;
      });
      var stop = function () { drawing = false; };
      cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
      clear.addEventListener('click', function () { c.clearRect(0, 0, W, H); inked = false; });
      var finish = function (v) { doc.removeEventListener('keydown', onKey, true); ov.close(); resolve(v); };
      cancel.addEventListener('click', function () { finish(null); });
      ok.addEventListener('click', function () { finish(inked ? trim(cv) : null); });
      function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); } }
      doc.addEventListener('keydown', onKey, true);
      cv.focus && cv.focus();
    });
  }
  /** ตัดขอบว่างรอบลายเซ็น */
  function trim(cv) {
    var c = cv.getContext('2d'), W = cv.width, H = cv.height;
    var d = c.getImageData(0, 0, W, H).data, x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    var pad = 6;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    var o = cv.ownerDocument.createElement('canvas');
    o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext('2d').drawImage(cv, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }
  /** รูปลายเซ็น (ถ่าย/สแกน) → พื้นใส: พิกเซลสีอ่อนกลายเป็นโปร่งใส แล้วตัดขอบ */
  function cleanSignature(src, opts) {
    opts = opts || {};
    var doc = opts.doc || g.document;
    return loadImage(src).then(function (L) {
      var im = L.im;
      var s = Math.min(1, 900 / Math.max(im.naturalWidth || 1, im.naturalHeight || 1));
      var cv = doc.createElement('canvas');
      cv.width = Math.max(1, Math.round(im.naturalWidth * s)); cv.height = Math.max(1, Math.round(im.naturalHeight * s));
      var c = cv.getContext('2d');
      c.drawImage(im, 0, 0, cv.width, cv.height);
      L.done();
      var data = c.getImageData(0, 0, cv.width, cv.height), d = data.data;
      for (var i = 0; i < d.length; i += 4) {
        var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (d[i + 3] === 0) continue;
        if (lum > 215) d[i + 3] = 0;
        else if (lum > 160) d[i + 3] = Math.round(d[i + 3] * (215 - lum) / 55);
      }
      c.putImageData(data, 0, 0);
      return trim(cv) || cv.toDataURL('image/png');
    });
  }
  /** มาร์คบนไฟล์รูป แล้วได้ไฟล์ใหม่ (ยกเลิก = ไฟล์เดิม) */
  function annotateFile(file, opts) {
    return edit(file, opts).then(function (blob) {
      if (!blob) return file;
      var name = String(file.name || 'รูป').replace(/\.[^.]+$/, '') + '.jpg';
      try { return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }); } catch (e) { blob.name = name; return blob; }
    });
  }
  g.PTAnnotate = { edit: edit, signature: signature, cleanSignature: cleanSignature, annotateFile: annotateFile, loadImage: loadImage };
})(typeof window !== 'undefined' ? window : this);
