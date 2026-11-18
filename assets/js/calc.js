// การคำนวณความคืบหน้า แผนงาน และสถานะโครงการ
// ค่าเปอร์เซ็นต์ภายในระบบเก็บเป็นสัดส่วน 0–1 (แสดงผลค่อยคูณ 100)

const DAY = 864e5;

export const METHODS = {
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

export const PRICE_BASIS = {
  total: 'ค่าวัสดุ + ค่าแรง',
  material: 'ค่าวัสดุอย่างเดียว',
  labor: 'ค่าแรงอย่างเดียว',
};

export const PLAN_MODES = {
  scurve: { label: 'S-Curve อัตโนมัติ', desc: 'ช่วงแรกและช่วงท้ายงานช้า ช่วงกลางเร่ง ตามลักษณะงานก่อสร้างทั่วไป' },
  linear: { label: 'เส้นตรง', desc: 'ความคืบหน้าตามแผนเพิ่มขึ้นเท่ากันทุกวัน' },
  custom: { label: 'กำหนดจุดแผนงานเอง', desc: 'กรอก % ตามแผนที่วันต่างๆ เช่น จากแผนงานในสัญญา ระบบลากเส้นเชื่อมให้' },
  boq: { label: 'ตามแผนงานรายการ BOQ', desc: 'คำนวณจากวันเริ่ม–วันจบของแต่ละรายการในแท็บแผนงาน ถ่วงน้ำหนักตามมูลค่างาน' },
};

export const STATUS = {
  behind: { label: 'ล่าช้ากว่าแผน', tone: 'bad' },
  watch: { label: 'เฝ้าระวัง', tone: 'warn' },
  nodata: { label: 'รอบันทึกครั้งแรก', tone: 'warn' }, // 1.0.11: เริ่มสัญญาแล้วแต่ยังไม่มีบันทึกความคืบหน้า
  ontrack: { label: 'ตามแผน', tone: 'ok' },
  ahead: { label: 'เร็วกว่าแผน', tone: 'good' },
  notstarted: { label: 'ยังไม่เริ่ม', tone: 'muted' },
  paused: { label: 'หยุดชั่วคราว', tone: 'muted' },
  done: { label: 'แล้วเสร็จ', tone: 'done' },
  cancelled: { label: 'ยกเลิก', tone: 'muted' },
};
export const STATUS_ORDER = ['behind', 'watch', 'nodata', 'ontrack', 'ahead', 'notstarted', 'paused', 'done', 'cancelled'];

// ---------- วันที่ ----------
export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
export function toISO(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function todayISO() { return toISO(new Date()); }
export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/** จำนวนวันจาก a ถึง b (b − a) */
export function diffDays(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / DAY);
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v == null ? '' : v).replace(/[,\s฿]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function timeFraction(p, iso) {
  if (!p.startDate || !p.endDate || !iso) return 0;
  const total = diffDays(p.startDate, p.endDate);
  if (total <= 0) return iso >= p.endDate ? 1 : 0;
  return clamp(diffDays(p.startDate, iso) / total);
}

/** สัปดาห์ที่ของสัญญา: วันที่ 1–7 = สัปดาห์ที่ 1 (รายงานส่งท้ายสัปดาห์) */
export function weekNo(p, iso) {
  if (!p.startDate || !iso) return null;
  const d = diffDays(p.startDate, iso);
  return d < 0 ? null : Math.max(1, Math.ceil(d / 7));
}

// ---------- BOQ ----------
export function unitPrice(it, basis = 'total') {
  const m = num(it.mat), l = num(it.labor);
  return basis === 'material' ? m : basis === 'labor' ? l : m + l;
}
export function amount(it, basis = 'total') {
  return num(it.qty) * unitPrice(it, basis);
}
export function boqTotal(items, basis = 'total') {
  return items.reduce((s, i) => s + amount(i, basis), 0);
}

export function sortUpdates(ups) {
  return [...ups].sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || '')) ||
    String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

/** ปริมาณสะสมของแต่ละรายการ BOQ: { boqId: qty } */
export function cumulative(ups) {
  const m = Object.create(null); // คีย์มาจากข้อมูลผู้ใช้ ห้ามสืบทอดจาก Object
  for (const u of ups) {
    const e = u.entries || {};
    for (const k in e) m[k] = (m[k] || 0) + num(e[k]);
  }
  return m;
}

export function ratio(done, qty, allowOver) {
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

// ---------- 1.0.15 รายการค่าใช้จ่ายตามการเข้างาน (ค่าที่พัก ค่าเดินทาง ฯลฯ) ----------
/** ชื่อรายการที่ระบบถือว่าเป็นค่าใช้จ่ายตามการเข้างาน (เมื่อ auto ว่าง) */
export const OVERHEAD_RE = /ที่พัก|เดินทาง|เบี้ยเลี้ยง|ค่าครองชีพ|ค่าเช่าบ้าน|ค่าพาหนะ|accommodation|travel|lodging|per ?diem/i;
/** รายการนี้คิดความคืบหน้าอัตโนมัติจากการเข้างานหรือไม่ — auto: '' = ดูจากชื่อรายการ · 'attend' = คิดอัตโนมัติ · 'off' = กรอกปริมาณเอง */
export function isAutoItem(it) {
  if (!it) return false;
  if (it.auto === 'attend') return true;
  if (it.auto === 'off') return false;
  return OVERHEAD_RE.test(String(it.desc || ''));
}
/** จำนวนวันที่มีคนเข้างาน ถึงวันที่ iso — att = วันที่ (ISO) เรียงจากน้อยไปมาก */
export function attendDays(att, iso) {
  if (!Array.isArray(att)) return 0;
  let n = 0;
  for (const d of att) { if (iso && d > iso) break; n++; }
  return n;
}
/** สัดส่วนการเข้างานของรายการ: วันที่มีคนเข้างาน ÷ จำนวนวันของรายการ
 *  หน่วย วัน/เดือน/สัปดาห์ → ใช้ปริมาณในหน่วยนั้น · หน่วยอื่น (เหมา งาน เที่ยว ฯลฯ) → ใช้จำนวนวันตามสัญญา
 *  att = null (โครงการไม่ได้ใช้รายงานประจำวัน) → ใช้เวลาที่ผ่านไปของสัญญาแทน */
export function attendFrac(p, it, att, iso) {
  if (!Array.isArray(att)) return iso ? timeFraction(p, iso) : 0;
  const u = String(it.unit || '').trim().toLowerCase();
  const q = num(it.qty);
  let den;
  if (q > 0 && /^(วัน|day)/.test(u)) den = q;
  else if (q > 0 && /^(สัปดาห์|อาทิตย์|week|wk)/.test(u)) den = q * 7;
  else if (q > 0 && /^(เดือน|month|mo)/.test(u)) den = q * 30;
  else den = contractDays(p);
  return den > 0 ? clamp(attendDays(att, iso) / den) : 0;
}

/** ฟังก์ชันสัดส่วนงานที่ทำได้ของแต่ละรายการ (0–1)
 *  รายการค่าใช้จ่ายตามการเข้างาน = ½ × สัดส่วนการเข้างาน + ½ × ความคืบหน้าของงานอื่น (งานอื่นเสร็จครบ = 100%)
 *  ถ้ากรอกปริมาณของรายการนั้นเองมากกว่า ใช้ค่าที่กรอก */
export function itemRatioFn(p, items, cum, att, iso) {
  const ao = !!p.allowOver;
  const base = (i) => ratio(cum[i.id] || 0, i.qty, ao);
  const method = p.progressMethod || 'boq_value';
  if (method === 'manual' || method === 'time' || !items.some(isAutoItem)) return base;
  const others = items.filter((i) => !isAutoItem(i));
  const phys = others.length ? Math.min(1, progressFromCum(p, others, cum, null)) : null;
  const memo = new Map();
  return (i) => {
    const r0 = base(i);
    if (!isAutoItem(i)) return r0;
    if (!memo.has(i)) {
      const a = attendFrac(p, i, att, iso);
      const ph = phys == null ? a : phys;
      memo.set(i, ph >= 0.999 ? 1 : 0.5 * a + 0.5 * ph);
    }
    return Math.max(r0, memo.get(i));
  };
}

/** ความคืบหน้าจากปริมาณสะสม ตามวิธีคำนวณที่ตั้งไว้ในโครงการ
 *  att/iso (1.0.15) = วันที่มีคนเข้างาน และวันที่คำนวณ — ใช้กับรายการค่าใช้จ่ายตามการเข้างาน */
export function progressFromCum(p, items, cum, manual, att, iso) {
  const method = p.progressMethod || 'boq_value';
  const ao = !!p.allowOver;
  if (method === 'manual' || !items.length) {
    return manual == null ? 0 : clamp(manual / 100, 0, ao ? 5 : 1);
  }
  const r = itemRatioFn(p, items, cum, att, iso);
  if (method === 'boq_qty') {
    const valid = items.filter((i) => num(i.qty) > 0);
    if (!valid.length) return 0;
    return valid.reduce((s, i) => s + r(i), 0) / valid.length;
  }
  if (method === 'boq_weight') {
    const tw = items.reduce((s, i) => s + num(i.weight), 0);
    if (tw > 0) return items.reduce((s, i) => s + num(i.weight) * r(i), 0) / tw;
  }
  const basis = p.priceBasis || 'total';
  const tot = boqTotal(items, basis);
  if (tot <= 0) return 0;
  return items.reduce((s, i) => s + amount(i, basis) * r(i), 0) / tot;
}

export function progressAt(p, items, updates, iso, att) {
  if (p.progressMethod === 'time') return timeFraction(p, iso);
  const ups = sortUpdates(updates).filter((u) => !iso || u.date <= iso);
  return progressFromCum(p, items, cumulative(ups), lastManual(ups), att, iso || todayISO());
}

// ---------- แผนงานรายรายการ BOQ (Gantt) ----------
/** วันที่ของสัญญา: วันเริ่มสัญญา = วันที่ 1 */
export function dayOf(p, iso) { return p.startDate && iso ? diffDays(p.startDate, iso) + 1 : null; }
export function dayToIso(p, n) { return p.startDate && n ? addDays(p.startDate, n - 1) : ''; }
export function contractDays(p) { return p.startDate && p.endDate ? diffDays(p.startDate, p.endDate) + 1 : 0; }
export function hasPlan(it) { return num(it.ps) > 0 && num(it.pe) > 0; }
export function hasSchedule(items) { return (items || []).some(hasPlan); }

/** สัดส่วนงานตามแผนของรายการ ณ สิ้นวันที่ iso (null = ยังไม่ได้วางแผน) */
export function itemPlanFrac(p, it, iso) {
  if (!p.startDate || !hasPlan(it)) return null;
  const s = num(it.ps), e = Math.max(num(it.pe), s);
  return clamp((dayOf(p, iso) - s + 1) / (e - s + 1));
}

export function weightFn(p, items) {
  const method = p.progressMethod || 'boq_value';
  const basis = p.priceBasis || 'total';
  if (method === 'boq_weight' && items.some((i) => num(i.weight) > 0)) return (i) => num(i.weight);
  if (method === 'boq_qty') return (i) => (num(i.qty) > 0 ? 1 : 0);
  return (i) => amount(i, basis);
}

/** แผนรวมจากตารางงานรายรายการ (null ถ้าไม่มีรายการที่วางแผน) */
export function schedulePlan(p, items, iso) {
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

export function planAt(p, iso, items = []) {
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

export function planSeries(p, steps = 60, items = []) {
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

/** ผลงานจริงสะสม ณ แต่ละวันที่มีการบันทึก
 *  att (1.0.15) = วันที่มีคนเข้างาน — วันที่เข้างานแต่ไม่มีบันทึกปริมาณ ก็เป็นจุดในกราฟด้วยเมื่อมีรายการค่าใช้จ่ายตามการเข้างาน */
export function actualSeries(p, items, updates, today = todayISO(), att) {
  if (p.progressMethod === 'time') {
    if (!p.startDate || today < p.startDate) return [];
    const end = p.endDate && p.endDate < today ? p.endDate : today;
    return [{ date: p.startDate, v: 0 }, { date: end, v: timeFraction(p, end) }];
  }
  const ups = sortUpdates(updates).filter((u) => u.date);
  const dates = new Set(ups.map((u) => u.date));
  if (Array.isArray(att) && items.some(isAutoItem) && p.progressMethod !== 'manual') {
    for (const d of att) if (d <= today && (!p.startDate || d >= p.startDate)) dates.add(d);
  }
  const out = [];
  const sorted = [...dates].sort();
  if (p.startDate && (!sorted.length || sorted[0] >= p.startDate)) out.push({ date: p.startDate, v: 0 });
  const cum = Object.create(null);
  let manual = null;
  let k = 0;
  for (const d of sorted) {
    while (k < ups.length && ups[k].date <= d) {
      const u = ups[k++];
      for (const key in u.entries || {}) cum[key] = (cum[key] || 0) + num(u.entries[key]);
      if (hasManual(u)) manual = +u.manualPct;
    }
    const v = progressFromCum(p, items, cum, manual, att, d);
    if (out.length && out[out.length - 1].date === d) out[out.length - 1].v = v;
    else out.push({ date: d, v });
  }
  return out;
}

export function groupBreakdown(p, items, cum, today = todayISO(), att) {
  const basis = p.priceBasis || 'total';
  const rf = itemRatioFn(p, items, cum, att, today);
  const map = new Map();
  for (const it of items) {
    const g = it.group || 'ไม่ระบุหมวด';
    if (!map.has(g)) map.set(g, { name: g, amount: 0, earned: 0, count: 0, done: 0, items: [] });
    map.get(g).items.push(it);
    const o = map.get(g);
    const a = amount(it, basis);
    const r = rf(it);
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

/** วิเคราะห์โครงการ ณ วันนี้ — att (1.0.15) = วันที่มีคนเข้างานจากรายงานประจำวัน (null = ไม่ได้ใช้รายงานประจำวัน) */
export function analyze(p, items, updates, S, today = todayISO(), att) {
  const ups = sortUpdates(updates).filter((u) => u.date <= today);
  const cum = cumulative(ups);
  const actual = p.progressMethod === 'time'
    ? timeFraction(p, today)
    : progressFromCum(p, items, cum, lastManual(ups), att, today);
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
  // โครงการที่เพิ่งนำเข้าระบบระหว่างสัญญา: ยังไม่มีบันทึกเลย ไม่ใช่ "ล่าช้า" (ยังไม่รู้ผลงานจริง)
  else if (!last && p.progressMethod !== 'time' && actual <= 0) status = 'nodata';
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
export function portfolio(rows) {
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
