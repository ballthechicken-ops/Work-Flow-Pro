/* =====================================================================
   WorkFlow Pro v9 add-on  (แทนที่ v8-addon.js — ให้ลบบรรทัด v8 ออกจาก index.html)
   1) มุมมองสัปดาห์/วัน = แกนเวลารายชั่วโมง (วางตาม startTime/endTime) + แถบ "ทั้งวัน"
   2) แถบงานคร่อมหลายวัน (startDate → deadline) ในมุมมองเดือน/สัปดาห์
   3) โน้ต / บันทึก / นัดหมาย / เตือนความจำ ที่ไม่ใช่งาน (ตาราง calendar_notes — รัน migration_v9.sql)
   การประหยัดโควต้า Supabase:
   - งานใช้ tasksCache เดิม (ซิงก์ incremental ไม่เกิน 1 ครั้ง/นาทีตอนเข้าหน้า)
   - โน้ตดึงเฉพาะช่วงวันที่เห็น ±1 เดือน ไม่ดึงช่อง body (ดึงตอนเปิดดูรายการเดียว)
     แคช 5 นาที ไม่มี polling ไม่ใช้ Realtime ดึงใหม่เฉพาะตอนเลื่อนออกนอกช่วงที่แคช หรือหลังบันทึก/ลบ
   ===================================================================== */
(function () {
'use strict';
if (!window.WF4) { console.warn('[v9] ต้องโหลดหลัง v4–v7 — ข้าม'); return; }

const $ = id => document.getElementById(id);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dt = s => { const [y, m, d] = String(s).substring(0, 10).split('-').map(Number); return new Date(y, m-1, d); };
const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dd = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);
const mn = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const narrow = () => window.innerWidth < 700;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const opts = lsGet('wf9_opts', { notes: true, bars: true });
const V9 = { view: localStorage.getItem('wf8_view') || (narrow() ? 'agenda' : 'month'), anchor: dt(todayStr()), who: '', cat: '', st: '', tAt: 0, lastKey: '', defScroll: 336, pick: null };
const WF9 = window.WF9 = window.WF8 = {};
const PR = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const HH = 48, TTL = 300000;
const KIND = { note: ['📝', 'โน้ต', '#8B5CF6'], event: ['📅', 'นัดหมาย/กิจกรรม', '#0EA5E9'], record: ['📒', 'บันทึก/เหตุการณ์', '#64748B'], reminder: ['⏰', 'เตือนความจำ', '#EC4899'] };
const PALETTE = ['#8B5CF6', '#0EA5E9', '#14B8A6', '#EC4899', '#64748B', '#84CC16'];
const NC = { map: new Map(), ranges: [], pending: {}, off: false, warned: false };

/* ---------- CSS ---------- */
const css = document.createElement('style');
css.textContent = `
.v9-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.v9-nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.v9-title{font-size:1.1rem;font-weight:700;margin-left:6px}
.v9-seg{display:flex;border:1.5px solid var(--border);border-radius:10px;overflow:hidden}
.v9-seg button{padding:7px 14px;background:var(--bg-card);color:var(--text-sub);font-size:.82rem;font-weight:600;min-height:36px}
.v9-seg button.on{background:var(--primary);color:#fff}
.v9-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center}
.v9-filters select{max-width:170px;padding:7px 10px;font-size:.82rem}
.v9-filters label{display:flex;gap:5px;align-items:center;font-size:.8rem;cursor:pointer;color:var(--text-sub)}
.v9-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:.74rem;color:var(--text-sub);margin-bottom:10px;align-items:center}
.v9-dotl{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.v9-month{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--bg-card)}
.v9-dhs{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.v9-dh{background:var(--primary);color:#fff;text-align:center;padding:8px 2px;font-size:.76rem;font-weight:700}
.v9-wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));min-height:104px;border-top:1px solid var(--border);position:relative}
.v9-bg{border-right:1px solid var(--border);cursor:pointer;z-index:0}.v9-bg:hover{background:rgba(20,184,166,.07)}
.v9-bg.other{background:var(--bg);opacity:.6}
.v9-num{position:relative;z-index:1;justify-self:start;display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;margin:3px;border-radius:12px;font-size:.8rem;font-weight:600;cursor:pointer}
.v9-num:hover{background:rgba(20,184,166,.2)}.v9-num.today{background:var(--primary);color:#fff}
.v9-slot{position:relative;z-index:1;min-width:0}
.v9-chip{display:block;font-size:.72rem;line-height:1.35;padding:2px 6px;border-radius:5px;margin:2px 3px 0;color:#fff;background:var(--c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.v9-chip:hover{filter:brightness(1.1)}.v9-chip.done{opacity:.5;text-decoration:line-through}.v9-chip.late{box-shadow:0 0 0 2px var(--danger)}
.v9-chip.note{border:1.5px dashed rgba(255,255,255,.75)}
.v9-chip.cl{border-top-left-radius:0;border-bottom-left-radius:0;margin-left:0}.v9-chip.cr{border-top-right-radius:0;border-bottom-right-radius:0;margin-right:0}
.v9-more{position:relative;z-index:1;font-size:.7rem;color:var(--text-sub);padding:1px 8px;cursor:pointer;font-weight:600}.v9-more:hover{color:var(--primary)}
.v9-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.v9-tg{border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--bg-card)}
.v9-tgrow{display:grid;grid-template-columns:52px repeat(var(--n),minmax(0,1fr))}
.v9-colh{text-align:center;font-size:.76rem;color:var(--text-sub);padding:6px 0;border-left:1px solid var(--border);cursor:pointer}
.v9-colh .v9-num{display:flex;margin:2px auto 0;width:30px;height:30px;font-size:.95rem}
.v9-ad{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:2px 0}
.v9-gut{font-size:.66rem;color:var(--text-sub);padding:4px 4px 0;text-align:right}
.v9-bgad{border-left:1px solid var(--border);cursor:pointer;z-index:0}
.v9-adday{padding:8px 10px;border-bottom:1px solid var(--border)}.v9-adday .v9-gut{text-align:left;margin-bottom:2px}
.v9-tb{max-height:560px;overflow-y:auto}
.v9-hg{position:relative}.v9-hg div{position:relative}.v9-hg span{position:absolute;top:-7px;right:6px;font-size:.66rem;color:var(--text-sub)}
.v9-tcol{position:relative;border-left:1px solid var(--border);cursor:pointer;background-image:linear-gradient(var(--border) 1px,transparent 1px);background-size:100% ${HH}px}
.v9-tcol.today{background-color:rgba(20,184,166,.06)}
.v9-blk{position:absolute;border-radius:6px;padding:2px 5px;font-size:.72rem;line-height:1.3;color:#fff;background:var(--c);overflow:hidden;cursor:pointer;border:1px solid rgba(255,255,255,.6);z-index:1;box-sizing:border-box}
.v9-blk.done{opacity:.5}.v9-blk.late{box-shadow:0 0 0 2px var(--danger)}.v9-blk.note{border-style:dashed}
.v9-blk b{font-weight:700}.v9-blk .m{opacity:.9;font-size:.66rem}
.v9-now{position:absolute;left:0;right:0;height:2px;background:#EF4444;z-index:2;pointer-events:none}
.v9-card{display:block;white-space:normal;padding:6px 8px;margin:6px 0 0}
.v9-ct{font-weight:600;font-size:.82rem;word-break:break-word}.v9-cm{font-size:.7rem;opacity:.92;margin-top:2px}
.v9-dayh{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.v9-ag{margin-bottom:14px}.v9-agh{font-weight:700;font-size:.88rem;padding:6px 2px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between}
.v9-empty{text-align:center;color:var(--text-sub);font-size:.88rem;padding:26px 0}
.v9-sw{display:flex;gap:8px;flex-wrap:wrap}.v9-sw i{width:26px;height:26px;border-radius:50%;cursor:pointer;border:3px solid transparent;display:inline-block}
.v9-sw i.on{border-color:var(--text-main)}.v9-sw i.auto{background:var(--bg);border:2px dashed var(--border);font-style:normal;font-size:.62rem;text-align:center;line-height:22px}
@media(max-width:700px){.v9-chip{font-size:.62rem;padding:1px 4px}.v9-title{font-size:.95rem}.v9-seg button{padding:6px 9px;font-size:.76rem}}
`;
document.head.appendChild(css);

/* ---------- helpers ---------- */
const isLate = t => t.deadline && t.deadline.substring(0, 10) < todayStr() && !['done', 'cancelled'].includes(t.status);
const stKey = t => t.status === 'done' ? 'done' : (isLate(t) ? 'overdue' : 'pending');
const timeOf = t => isValidTime(t.endTime) ? String(t.endTime).slice(0, 5) : '';
const months = () => currentLang === 'th' ? MONTHS_TH : MONTHS_EN;
const dnames = () => currentLang === 'th' ? DAYS_TH : DAYS_EN;
const yr = d => currentLang === 'th' ? d.getFullYear() + 543 : d.getFullYear();
const fmtS = d => `${d.getDate()} ${months()[d.getMonth()].slice(0, currentLang === 'th' ? 5 : 3)}`;
const ownerName = id => id === currentUser.id ? 'ฉัน' : getUserName(id);

/* ---------- โน้ต: ดึงแบบประหยัด ---------- */
function visRange() {
  const a = V9.anchor;
  if (V9.view === 'month') { const f = new Date(a.getFullYear(), a.getMonth(), 1), l = new Date(a.getFullYear(), a.getMonth() + 1, 0); return [ymd(add(f, -f.getDay())), ymd(add(l, 6 - l.getDay()))]; }
  if (V9.view === 'week') { const s = add(a, -a.getDay()); return [ymd(s), ymd(add(s, 6))]; }
  if (V9.view === 'day') return [ymd(a), ymd(a)];
  return [ymd(a), ymd(add(a, 29))];
}
async function ensureNotes(from, to) {
  if (!opts.notes || NC.off || !currentUser) return false;
  const now = Date.now();
  if (NC.ranges.some(r => r.from <= from && r.to >= to && now - r.at < TTL)) return false;
  const a = V9.anchor, wFrom = [from, ymd(new Date(a.getFullYear(), a.getMonth() - 1, 1))].sort()[0], wTo = [to, ymd(new Date(a.getFullYear(), a.getMonth() + 2, 0))].sort().pop();
  const k = wFrom + wTo; if (NC.pending[k]) return NC.pending[k];
  NC.pending[k] = (async () => {
    try {
      const { data, error } = await supabase.from('calendar_notes').select('id, owner_id, title, kind, start_date, end_date, start_time, end_time, color, visibility')
        .lte('start_date', wTo).gte('end_date', wFrom).order('start_date').limit(500);
      if (error) throw error;
      NC.map.forEach((n, id) => { if (n.start_date <= wTo && n.end_date >= wFrom) NC.map.delete(id); });
      (data || []).forEach(n => NC.map.set(n.id, n));
      NC.ranges = NC.ranges.filter(r => !(r.from >= wFrom && r.to <= wTo)).concat({ from: wFrom, to: wTo, at: Date.now() }).slice(-6);
      return true;
    } catch (e) {
      if (/does not exist|schema cache|42P01|PGRST205/i.test((e.code || '') + ' ' + (e.message || ''))) { NC.off = true; if (!NC.warned) { NC.warned = true; toast('ยังใช้โน้ตไม่ได้: ยังไม่ได้รัน migration_v9.sql', 'warning', 6000); } }
      else console.warn('[v9] notes', e);
      return false;
    } finally { delete NC.pending[k]; }
  })();
  return NC.pending[k];
}
const resetNotes = () => { NC.ranges = []; };

/* ---------- รวมรายการ (งาน + โน้ต) ---------- */
function visibleTasks() {
  const uid = currentUser.id;
  return tasksCache.filter(t => t.deadline && t.status !== 'cancelled'
    && (!V9.who || (V9.who === 'me' ? t.assignedTo === uid : t.assignedTo === V9.who))
    && (!V9.cat || t.category === V9.cat) && (!V9.st || stKey(t) === V9.st));
}
const cls = t => (t.status === 'done' ? ' done' : '') + (isLate(t) ? ' late' : '');
function allItems() {
  const items = visibleTasks().map(t => {
    const e = t.deadline.substring(0, 10), sd = t.startDate ? String(t.startDate).substring(0, 10) : '', multi = !!(opts.bars && sd && sd < e);
    return { k: 'task', id: t.id, t, title: t.title, s: multi ? sd : e, e, multi, st: !multi && sd === e && isValidTime(t.startTime) ? String(t.startTime).slice(0, 5) : '', et: multi ? '' : timeOf(t), color: priorityColor(t.priority), pr: PR[t.priority] ?? 9, cls: cls(t) };
  });
  if (opts.notes && !V9.cat && !V9.st) {
    const uid = currentUser.id;
    NC.map.forEach(n => {
      if (V9.who && (V9.who === 'me' ? n.owner_id !== uid : n.owner_id !== V9.who)) return;
      const e = n.end_date || n.start_date, kd = KIND[n.kind] || KIND.note;
      items.push({ k: 'note', id: n.id, n, title: n.title, s: n.start_date, e, multi: e > n.start_date, st: String(n.start_time || '').slice(0, 5), et: String(n.end_time || '').slice(0, 5), color: n.color || kd[2], pr: 5, cls: '' });
    });
  }
  return items;
}
const attr = it => it.k === 'task' ? `data-id="${it.id}"` : `data-note="${it.id}"`;
const pre = it => it.k === 'note' ? (KIND[it.n.kind] || KIND.note)[0] + ' ' : '';
function chip(it, o = {}) {
  const tm = it.st || it.et;
  return `<div class="v9-chip${it.cls}${it.k === 'note' ? ' note' : ''}${o.cl ? ' cl' : ''}${o.cr ? ' cr' : ''}" ${attr(it)} style="--c:${it.color}" title="${esc(it.title)}${it.k === 'note' ? ' · ' + esc(ownerName(it.n.owner_id)) : ' · ' + esc(getUserName(it.t.assignedTo))}">${pre(it)}${tm ? `<b>${tm}</b> ` : ''}${esc(it.title)}</div>`;
}
function card(it) {
  const tm = it.st || it.et, range = it.s !== it.e ? ` · ${fmtS(dt(it.s))}–${fmtS(dt(it.e))}` : '';
  const meta = it.k === 'task' ? `👤 ${esc(getUserName(it.t.assignedTo))} · ${statusLabel(isLate(it.t) ? 'overdue' : it.t.status)} · ⭐${it.t.points}${range}`
    : `${(KIND[it.n.kind] || KIND.note)[1]} · ${it.n.visibility === 'team' ? '👥 ทีม' : '🔒 ส่วนตัว'} · ${esc(ownerName(it.n.owner_id))}${range}`;
  return `<div class="v9-chip v9-card${it.cls}${it.k === 'note' ? ' note' : ''}" ${attr(it)} style="--c:${it.color}"><div class="v9-ct">${pre(it)}${tm ? `<b>${tm}</b> ` : ''}${esc(it.title)}</div><div class="v9-cm">${meta}</div></div>`;
}

/* ---------- จัดช่อง (lane) สำหรับแถบคร่อมวัน ---------- */
function placeSegs(items, ws, n) {
  const we = ymd(add(dt(ws), n - 1));
  const segs = items.filter(it => it.s <= we && it.e >= ws).map(it => ({ it, c0: Math.max(0, dd(ws, it.s)), c1: Math.min(n - 1, dd(ws, it.e)), left: it.s < ws, right: it.e > we }));
  segs.sort((a, b) => (+b.it.multi) - (+a.it.multi) || a.c0 - b.c0 || (b.c1 - b.c0) - (a.c1 - a.c0) || (a.it.st || a.it.et || '99').localeCompare(b.it.st || b.it.et || '99') || a.it.pr - b.it.pr);
  const occ = [];
  segs.forEach(s => { let L = 0; for (;; L++) { occ[L] = occ[L] || []; if (!occ[L].some(r => !(s.c1 < r[0] || s.c0 > r[1]))) break; } occ[L].push([s.c0, s.c1]); s.lane = L; });
  return { segs, nl: occ.length };
}

/* ---------- มุมมองเดือน ---------- */
function viewMonth(items) {
  const a = V9.anchor, y = a.getFullYear(), m = a.getMonth(), first = new Date(y, m, 1), dim = new Date(y, m + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + dim) / 7), max = narrow() ? 2 : 3, start = add(first, -first.getDay()), today = todayStr();
  let h = `<div class="v9-dhs">${dnames().map(d => `<div class="v9-dh">${d}</div>`).join('')}</div>`;
  for (let w = 0; w < weeks; w++) {
    const ws = ymd(add(start, w * 7)), { segs } = placeSegs(items, ws, 7), hid = Array(7).fill(0); let g = '';
    for (let c = 0; c < 7; c++) {
      const d = add(start, w * 7 + c), ds = ymd(d);
      g += `<div class="v9-bg${d.getMonth() !== m ? ' other' : ''}" data-date="${ds}" style="grid-column:${c + 1};grid-row:1/${max + 3}"></div><div class="v9-num${ds === today ? ' today' : ''}" data-day="${ds}" style="grid-column:${c + 1};grid-row:1">${d.getDate()}</div>`;
    }
    segs.forEach(s => {
      if (s.lane >= max) { for (let c = s.c0; c <= s.c1; c++) hid[c]++; return; }
      g += `<div class="v9-slot" style="grid-column:${s.c0 + 1}/span ${s.c1 - s.c0 + 1};grid-row:${s.lane + 2}">${chip(s.it, { cl: s.left, cr: s.right })}</div>`;
    });
    hid.forEach((n, c) => { if (n) g += `<div class="v9-more" data-more="${ymd(add(start, w * 7 + c))}" style="grid-column:${c + 1};grid-row:${max + 2}">+${n} อีก</div>`; });
    h += `<div class="v9-wk" style="grid-template-rows:auto repeat(${max},auto) 1fr">${g}</div>`;
  }
  return `<div class="v9-month">${h}</div>`;
}

/* ---------- แกนเวลา (สัปดาห์ / วัน) ---------- */
function layoutDay(list) {
  list.sort((x, y) => x.a - y.a || y.b - x.b);
  const out = []; let cl = [], end = 0;
  const flush = () => { if (!cl.length) return; const cols = []; cl.forEach(c => { let i = 0; while (cols[i] > c.a) i++; cols[i] = c.b; c.col = i; }); cl.forEach(c => c.n = cols.length); out.push(...cl); cl = []; };
  list.forEach(c => { if (cl.length && c.a >= end) { flush(); end = 0; } cl.push(c); end = Math.max(end, c.b); });
  flush(); return out;
}
function spanOf(it) {
  let a, b;
  if (it.st && it.et && it.et > it.st) { a = mn(it.st); b = mn(it.et); }
  else if (it.et) { b = mn(it.et); a = Math.max(0, b - 30); b = Math.max(b, a + 30); }
  else { a = mn(it.st); b = Math.min(1440, a + 60); }
  return [a, b];
}
function viewTG(days, items) {
  const n = days.length, today = todayStr(), ws = days[0], we = days[n - 1];
  const inR = items.filter(it => it.s <= we && it.e >= ws);
  const allday = inR.filter(it => it.multi || !(it.st || it.et)), timed = inR.filter(it => !it.multi && (it.st || it.et));
  const head = `<div class="v9-tgrow" style="--n:${n}"><div></div>${days.map(ds => { const d = dt(ds); return `<div class="v9-colh" data-day="${ds}">${dnames()[d.getDay()]}<div class="v9-num${ds === today ? ' today' : ''}">${d.getDate()}</div></div>`; }).join('')}</div>`;
  let ad = '';
  if (n > 1) {
    const { segs, nl } = placeSegs(allday, ws, n), L = Math.max(1, nl);
    ad = `<div class="v9-tgrow v9-ad" style="--n:${n};grid-template-rows:repeat(${L},auto)"><div class="v9-gut" style="grid-row:1/${L + 1}">ทั้งวัน</div>`
      + days.map((ds, c) => `<div class="v9-bgad" data-date="${ds}" style="grid-column:${c + 2};grid-row:1/${L + 1}"></div>`).join('')
      + segs.map(s => `<div class="v9-slot" style="grid-column:${s.c0 + 2}/span ${s.c1 - s.c0 + 1};grid-row:${s.lane + 1}">${chip(s.it, { cl: s.left, cr: s.right })}</div>`).join('') + '</div>';
  } else if (allday.length) ad = `<div class="v9-adday"><div class="v9-gut">ทั้งวัน</div>${allday.map(card).join('')}</div>`;
  let earliest = 1440;
  const cols = days.map(ds => {
    const list = timed.filter(it => it.s === ds).map(it => { const [a, b] = spanOf(it); earliest = Math.min(earliest, a); return { it, a, b }; });
    const blocks = layoutDay(list).map(c => {
      const it = c.it, top = c.a * HH / 60, hgt = Math.max((c.b - c.a) * HH / 60, 22), tm = (it.st || '') + (it.st && it.et ? '–' : '') + (!it.st ? it.et : it.et);
      return `<div class="v9-blk${it.cls}${it.k === 'note' ? ' note' : ''}" ${attr(it)} style="--c:${it.color};top:${top}px;height:${hgt}px;left:calc(${c.col} * 100% / ${c.n} + 1px);width:calc(100% / ${c.n} - 3px)" title="${esc(it.title)}">
        <b>${pre(it)}${tm}</b> ${esc(it.title)}${hgt > 40 ? `<div class="m">${it.k === 'task' ? esc(getUserName(it.t.assignedTo)) : esc(ownerName(it.n.owner_id))}</div>` : ''}</div>`;
    }).join('');
    const now = ds === today ? `<div class="v9-now" style="top:${(new Date().getHours() * 60 + new Date().getMinutes()) * HH / 60}px"></div>` : '';
    return `<div class="v9-tcol${ds === today ? ' today' : ''}" data-date="${ds}" style="height:${24 * HH}px">${blocks}${now}</div>`;
  }).join('');
  V9.defScroll = earliest < 1440 ? Math.max(0, earliest - 60) * HH / 60 : 7 * HH;
  const gut = `<div class="v9-hg" style="height:${24 * HH}px">${[...Array(24)].map((_, h) => `<div style="height:${HH}px"><span>${h ? String(h).padStart(2, '0') + ':00' : ''}</span></div>`).join('')}</div>`;
  return `<div class="v9-scroll"><div class="v9-tg" style="min-width:${n > 1 ? 760 : 0}px">${head}${ad}<div class="v9-tb" id="v9-tb"><div class="v9-tgrow" style="--n:${n}">${gut}${cols}</div></div></div></div>`;
}
const viewWeek = items => { const s = add(V9.anchor, -V9.anchor.getDay()); return viewTG([...Array(7)].map((_, i) => ymd(add(s, i))), items); };
function viewDay(items) {
  const ds = ymd(V9.anchor), label = V9.anchor.toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `<div class="v9-dayh"><strong>${label}</strong><button class="btn btn-primary btn-sm" data-create="${ds}">➕ สร้าง</button></div>${viewTG([ds], items)}`;
}

/* ---------- รายการ (Agenda) ---------- */
function viewAgenda(items) {
  const today = todayStr(), [from, to] = visRange(); let h = '';
  const late = items.filter(it => it.k === 'task' && isLate(it.t)).sort((a, b) => a.e.localeCompare(b.e));
  if (from <= today && today <= to && late.length) h += `<div class="v9-ag"><div class="v9-agh"><span>🔴 เกินกำหนด</span><span style="color:var(--text-sub)">${late.length}</span></div>${late.map(card).join('')}</div>`;
  const map = {};
  items.forEach(it => { if (it.k === 'task' && isLate(it.t)) return; const d = it.k === 'task' ? it.e : (it.s < from ? from : it.s); if (d >= from && d <= to) (map[d] = map[d] || []).push(it); });
  Object.keys(map).sort().forEach(ds => {
    map[ds].sort((a, b) => (a.st || a.et || '99').localeCompare(b.st || b.et || '99') || a.pr - b.pr);
    const lab = dt(ds).toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    h += `<div class="v9-ag"><div class="v9-agh"><span>${ds === today ? '📍 วันนี้ · ' : ''}${lab}</span><span style="color:var(--text-sub)">${map[ds].length}</span></div>${map[ds].map(card).join('')}</div>`;
  });
  return h || '<div class="v9-empty">ไม่มีรายการในช่วง 30 วันนี้ 🎉</div>';
}

/* ---------- render ---------- */
function title() {
  const a = V9.anchor;
  if (V9.view === 'month') return `${months()[a.getMonth()]} ${yr(a)}`;
  if (V9.view === 'week') { const s = add(a, -a.getDay()), e = add(s, 6); return `${fmtS(s)} – ${fmtS(e)} ${yr(e)}`; }
  if (V9.view === 'day') return `${fmtS(a)} ${yr(a)}`;
  return `${fmtS(a)} – ${fmtS(add(a, 29))} ${yr(add(a, 29))}`;
}
function fillFilters() {
  const w = $('v9-who'), c = $('v9-cat');
  if (w) { if (!isManager()) w.style.display = 'none'; else { w.innerHTML = '<option value="">👥 ทุกคน</option><option value="me">👤 ของฉัน</option>' + getTeamUsers().filter(u => u.id !== currentUser.id && u.isActive !== false).map(u => `<option value="${u.id}">${esc(u.fullName)}</option>`).join(''); w.value = V9.who; } }
  if (c) { c.innerHTML = '<option value="">📂 ทุกประเภท</option>' + categoriesCache.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join(''); c.value = V9.cat; }
  if ($('v9-st')) $('v9-st').value = V9.st;
  if ($('v9-o-notes')) $('v9-o-notes').checked = opts.notes; if ($('v9-o-bars')) $('v9-o-bars').checked = opts.bars;
}
function render(skipFetch) {
  const body = $('v9-body'); if (!body || !currentUser) return;
  fillFilters(); $('v9-title').textContent = title();
  document.querySelectorAll('#v9-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === V9.view));
  const key = V9.view + ymd(V9.anchor), old = $('v9-tb'), prev = old && V9.lastKey === key ? old.scrollTop : null;
  const items = allItems();
  body.innerHTML = V9.view === 'month' ? viewMonth(items) : V9.view === 'week' ? viewWeek(items) : V9.view === 'day' ? viewDay(items) : viewAgenda(items);
  const tb = $('v9-tb'); if (tb) tb.scrollTop = prev != null ? prev : V9.defScroll;
  V9.lastKey = key;
  if (!skipFetch) { const [f, t] = visRange(); ensureNotes(f, t).then(ok => { if (ok) render(true); }); }
}
window.renderTaskCalendar = () => render();
window.changeCalMonth = dir => {
  const a = V9.anchor;
  V9.anchor = V9.view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : add(a, dir * (V9.view === 'week' ? 7 : V9.view === 'day' ? 1 : 30));
  render();
};
window.loadCalendarPage = async function () {
  if (Date.now() - V9.tAt > 60000) {                      // ซิงก์งานแบบ incremental ไม่เกิน 1 ครั้ง/นาที
    try { const r = await callAPI('GET_TASKS'); tasksCache = r.data || tasksCache; V9.tAt = Date.now(); } catch (e) { toast(e.message, 'error'); }
  }
  render();
};

/* ---------- actions ---------- */
WF9.today = () => { V9.anchor = dt(todayStr()); render(); };
WF9.setView = v => { const t = dt(todayStr()); if (V9.anchor.getFullYear() === t.getFullYear() && V9.anchor.getMonth() === t.getMonth()) V9.anchor = t; V9.view = v; try { localStorage.setItem('wf8_view', v); } catch (e) {} render(); };
WF9.filter = () => { V9.who = $('v9-who')?.value || ''; V9.cat = $('v9-cat')?.value || ''; V9.st = $('v9-st')?.value || ''; render(); };
WF9.opt = k => { opts[k] = !!$('v9-o-' + k).checked; lsSet('wf9_opts', opts); render(); };
WF9.goDay = ds => { V9.anchor = dt(ds); V9.view = 'day'; render(); };
WF9.create = (ds, time) => { V9.pick = { ds, time: time || '' }; $('v9-ch-title').textContent = `สร้างวันที่ ${fmtDate(ds)}${time ? ' เวลา ' + time : ''}`; openModal('v9-choose'); };
WF9.pickType = type => {
  const p = V9.pick; closeModal('v9-choose'); if (!p) return;
  setTimeout(() => {
    if (type === 'note') return WF9.noteNew(p.ds, p.time);
    openNewTaskModal();
    const dl = $('task-deadline'), sd = $('task-start-date');
    if (dl) { dl.value = p.ds; dl.dispatchEvent(new Event('change', { bubbles: true })); }
    if (sd && p.ds < todayStr()) sd.value = p.ds;
    if (p.time && $('task-end-time')) $('task-end-time').value = p.time;
  }, 30);
};

/* ---------- โน้ต: ฟอร์ม ---------- */
let noteColor = null;
function setColor(c) { noteColor = c; document.querySelectorAll('#v9-n-colors i').forEach(i => i.classList.toggle('on', (i.dataset.c || '') === (c || ''))); }
function lockNote(ro) { document.querySelectorAll('#v9-note-modal .input-field, #v9-note-modal .select-field').forEach(e => e.disabled = ro); $('v9-n-save').style.display = ro ? 'none' : ''; $('v9-n-colors').style.pointerEvents = ro ? 'none' : ''; }
WF9.noteNew = (ds, time) => {
  const d = ds || ymd(V9.anchor);
  $('v9-n-id').value = ''; $('v9-n-title').value = ''; $('v9-n-body').value = ''; $('v9-n-kind').value = 'note'; $('v9-n-vis').value = 'private';
  $('v9-n-s').value = d; $('v9-n-e').value = d; $('v9-n-st').value = time || ''; $('v9-n-et').value = '';
  $('v9-n-owner').textContent = ''; $('v9-n-del').style.display = 'none'; $('v9-nt-title').textContent = '📝 สร้างโน้ต / บันทึก'; setColor(null); lockNote(false); openModal('v9-note-modal');
};
WF9.noteOpen = async id => {
  const n = NC.map.get(id); if (!n) return;
  if (n.body === undefined) {
    try { const { data, error } = await supabase.from('calendar_notes').select('body').eq('id', id).single(); if (error) throw error; n.body = data.body || ''; }
    catch (e) { return toast('เปิดโน้ตไม่สำเร็จ: ' + e.message, 'error'); }
  }
  const mine = n.owner_id === currentUser.id, canDel = mine || (isAdmin() && n.visibility === 'team');
  $('v9-n-id').value = id; $('v9-n-title').value = n.title; $('v9-n-body').value = n.body || ''; $('v9-n-kind').value = n.kind; $('v9-n-vis').value = n.visibility;
  $('v9-n-s').value = n.start_date; $('v9-n-e').value = n.end_date || n.start_date; $('v9-n-st').value = String(n.start_time || '').slice(0, 5); $('v9-n-et').value = String(n.end_time || '').slice(0, 5);
  $('v9-n-owner').textContent = mine ? '' : `เจ้าของ: ${ownerName(n.owner_id)} (อ่านอย่างเดียว)`;
  $('v9-n-del').style.display = canDel ? '' : 'none'; $('v9-nt-title').textContent = mine ? '📝 แก้ไขโน้ต' : '📝 โน้ต';
  setColor(n.color || null); lockNote(!mine); openModal('v9-note-modal');
};
WF9.noteSave = async () => {
  const id = $('v9-n-id').value, title = $('v9-n-title').value.trim(), s = $('v9-n-s').value, e = $('v9-n-e').value || s, st = $('v9-n-st').value, et = $('v9-n-et').value;
  if (!title) return toast('กรุณาใส่ชื่อเรื่อง', 'warning'); if (!s) return toast('กรุณาเลือกวันที่', 'warning');
  if (e < s) return toast('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม', 'warning'); if (s === e && st && et && et <= st) return toast('เวลาสิ้นสุดต้องหลังเวลาเริ่ม', 'warning');
  const row = { title, body: $('v9-n-body').value.trim() || null, kind: $('v9-n-kind').value, visibility: $('v9-n-vis').value, start_date: s, end_date: e, start_time: st || null, end_time: et || null, color: noteColor };
  showLoading();
  try {
    const q = id ? supabase.from('calendar_notes').update({ ...row, updated_at: new Date().toISOString() }).eq('id', +id) : supabase.from('calendar_notes').insert({ ...row, owner_id: currentUser.id });
    const { error } = await q; if (error) throw error;
    closeModal('v9-note-modal'); toast('บันทึกโน้ตแล้ว ✅', 'success'); resetNotes(); NC.map.delete(+id); render();
  } catch (err) { toast(/does not exist|schema cache|PGRST205/i.test(err.message || '') ? 'ยังไม่ได้รัน migration_v9.sql' : err.message, 'error', 6000); } finally { hideLoading(); }
};
WF9.noteDel = async () => {
  const id = +$('v9-n-id').value; if (!id || !confirm('ลบโน้ตนี้?')) return; showLoading();
  try { const { error } = await supabase.from('calendar_notes').delete().eq('id', id); if (error) throw error; closeModal('v9-note-modal'); NC.map.delete(id); resetNotes(); toast('ลบโน้ตแล้ว', 'info'); render(); }
  catch (e) { toast(e.message, 'error'); } finally { hideLoading(); }
};

/* ---------- ผูก event + สร้าง UI ---------- */
function bind(body) {
  body.addEventListener('click', e => {
    const c = e.target.closest('[data-id]'); if (c) return viewTaskDetail(+c.dataset.id);
    const n = e.target.closest('[data-note]'); if (n) return WF9.noteOpen(+n.dataset.note);
    const mo = e.target.closest('[data-more]'); if (mo) return WF9.goDay(mo.dataset.more);
    const dy = e.target.closest('[data-day]'); if (dy) return WF9.goDay(dy.dataset.day);
    const cr = e.target.closest('[data-create]'); if (cr) return WF9.create(cr.dataset.create);
    const col = e.target.closest('.v9-tcol');
    if (col) { const r = col.getBoundingClientRect(), m = Math.max(0, Math.min(1410, Math.floor((e.clientY - r.top) / HH * 2) * 30)); return WF9.create(col.dataset.date, `${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 ? '30' : '00'}`); }
    const cell = e.target.closest('[data-date]'); if (cell) return (window.matchMedia && matchMedia('(pointer:coarse)').matches) ? WF9.goDay(cell.dataset.date) : WF9.create(cell.dataset.date);
  });
}
function inject() {
  const pg = $('page-calendar'); if (!pg) return;
  const sub = pg.querySelector('.page-sub'); if (sub) sub.textContent = 'งานตามกำหนดส่ง + โน้ต/บันทึก/นัดหมาย · กดช่องว่างเพื่อสร้าง';
  const box = pg.querySelector('.card-body'); if (!box) return;
  const seg = [['month', 'เดือน'], ['week', 'สัปดาห์'], ['day', 'วัน'], ['agenda', 'รายการ']];
  box.innerHTML = `
    <div class="v9-bar"><div class="v9-nav"><button class="btn btn-secondary btn-sm" onclick="WF9.today()">วันนี้</button>
      <button class="btn btn-secondary btn-sm" onclick="changeCalMonth(-1)">◀</button><button class="btn btn-secondary btn-sm" onclick="changeCalMonth(1)">▶</button><div class="v9-title" id="v9-title"></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" onclick="WF9.noteNew()">📝 โน้ต</button>
      <div class="v9-seg" id="v9-seg">${seg.map(s => `<button type="button" data-v="${s[0]}" onclick="WF9.setView('${s[0]}')">${s[1]}</button>`).join('')}</div></div></div>
    <div class="v9-filters"><select class="select-field" id="v9-who" onchange="WF9.filter()"></select><select class="select-field" id="v9-cat" onchange="WF9.filter()"></select>
      <select class="select-field" id="v9-st" onchange="WF9.filter()"><option value="">⚪ ทุกสถานะ</option><option value="pending">⏳ รอดำเนินการ</option><option value="overdue">🔴 เกินกำหนด</option><option value="done">✅ เสร็จสิ้น</option></select>
      <label><input type="checkbox" id="v9-o-notes" onchange="WF9.opt('notes')"> 📝 โน้ต</label><label><input type="checkbox" id="v9-o-bars" onchange="WF9.opt('bars')"> ↔ แถบช่วงเวลา</label></div>
    <div class="v9-legend"><span><i class="v9-dotl" style="background:#EF4444"></i>วิกฤต</span><span><i class="v9-dotl" style="background:#F59E0B"></i>สูง</span><span><i class="v9-dotl" style="background:#3B82F6"></i>กลาง</span><span><i class="v9-dotl" style="background:#10B981"></i>ต่ำ</span>
      <span style="opacity:.6;text-decoration:line-through">เสร็จแล้ว</span><span><i class="v9-dotl" style="background:#999;box-shadow:0 0 0 2px var(--danger)"></i>เกินกำหนด</span><span><i class="v9-dotl" style="background:#8B5CF6;border:1.5px dashed #fff"></i>โน้ต</span></div>
    <div id="v9-body"></div>`;
  bind($('v9-body'));
}
const _bl = window.buildLayout;
window.buildLayout = function () { _bl.apply(this, arguments); try { inject(); } catch (e) { console.warn('[v9] inject', e); } };

document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay modal-center" id="v9-choose"><div class="modal" style="max-width:340px"><div class="modal-header"><div class="modal-title" id="v9-ch-title">สร้าง</div><button class="modal-close" onclick="closeModal('v9-choose')">✕</button></div>
  <div class="modal-body" style="display:flex;flex-direction:column;gap:10px"><button class="btn btn-primary" style="justify-content:center" onclick="WF9.pickType('task')">📋 งานใหม่</button><button class="btn btn-secondary" style="justify-content:center" onclick="WF9.pickType('note')">📝 โน้ต / บันทึก / นัดหมาย</button></div></div></div>
<div class="modal-overlay modal-center" id="v9-note-modal"><div class="modal" style="max-width:500px"><div class="modal-header"><div class="modal-title" id="v9-nt-title">📝 โน้ต</div><button class="modal-close" onclick="closeModal('v9-note-modal')">✕</button></div>
  <div class="modal-body"><input type="hidden" id="v9-n-id" />
    <div class="input-group"><label class="input-label">ชื่อเรื่อง *</label><input type="text" class="input-field" id="v9-n-title" maxlength="120" /></div>
    <div class="input-row"><div class="input-group"><label class="input-label">ประเภท</label><select class="select-field" id="v9-n-kind">${Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v[0]} ${v[1]}</option>`).join('')}</select></div>
      <div class="input-group"><label class="input-label">ใครเห็นได้</label><select class="select-field" id="v9-n-vis"><option value="private">🔒 ส่วนตัว (เห็นคนเดียว)</option><option value="team">👥 ทีม (หัวหน้า/ลูกทีมที่ผูกกับคุณ)</option></select></div></div>
    <div class="input-row"><div class="input-group"><label class="input-label">วันที่เริ่ม</label><input type="date" class="input-field" id="v9-n-s" /></div><div class="input-group"><label class="input-label">วันที่สิ้นสุด</label><input type="date" class="input-field" id="v9-n-e" /></div></div>
    <div class="input-row"><div class="input-group"><label class="input-label">เวลาเริ่ม</label><input type="time" class="input-field" id="v9-n-st" /></div><div class="input-group"><label class="input-label">เวลาสิ้นสุด</label><input type="time" class="input-field" id="v9-n-et" /></div></div>
    <div class="input-group"><label class="input-label">สี</label><div class="v9-sw" id="v9-n-colors"><i class="auto" data-c="" title="ตามประเภท">auto</i>${PALETTE.map(c => `<i data-c="${c}" style="background:${c}"></i>`).join('')}</div></div>
    <div class="input-group"><label class="input-label">รายละเอียด</label><textarea class="input-field" id="v9-n-body" rows="3" maxlength="2000"></textarea></div>
    <div id="v9-n-owner" style="font-size:.8rem;color:var(--text-sub)"></div></div>
  <div class="modal-footer"><button class="btn btn-danger" id="v9-n-del" onclick="WF9.noteDel()" style="margin-right:auto">🗑 ลบ</button><button class="btn btn-secondary" onclick="closeModal('v9-note-modal')">ปิด</button><button class="btn btn-primary" id="v9-n-save" onclick="WF9.noteSave()">💾 บันทึก</button></div></div></div>`);
enhanceAllDateInputs($('v9-note-modal'));
$('v9-n-colors').addEventListener('click', e => { const i = e.target.closest('i'); if (i) setColor(i.dataset.c || null); });
document.addEventListener('click', e => { if (e.target.id === 'v9-note-modal' && e.target.classList.contains('open')) e.stopImmediatePropagation(); }, true);   // กันปิดเพราะจิ้มพื้นที่ว่าง

if (typeof PAGE_HELP !== 'undefined') {
  PAGE_HELP.calendar = { intro: 'ปฏิทินงานแบบ Google Calendar + โน้ต/บันทึก/นัดหมาย',
    items: ['สลับมุมมอง เดือน / สัปดาห์ / วัน / รายการ ปุ่ม "วันนี้" กลับวันปัจจุบัน ◀ ▶ เลื่อนตามมุมมอง (คีย์ [ ] ใช้ได้)',
      'มุมมองสัปดาห์/วันมีแกนเวลารายชั่วโมง: งานที่ใส่เวลาเริ่ม+สิ้นสุดจะเป็นบล็อกตามช่วงเวลา, ใส่แค่เวลาสิ้นสุดจะเป็นบล็อก 30 นาทีที่จบตรงเวลานั้น, งานที่ไม่มีเวลาอยู่แถบ "ทั้งวัน" เส้นแดงคือเวลาปัจจุบัน',
      'งานที่มีวันเริ่ม < กำหนดส่ง แสดงเป็นแถบคร่อมหลายวัน (ปิดได้ที่ช่อง "แถบช่วงเวลา")',
      'กดช่องว่างของวัน/ช่วงเวลาเพื่อเลือกสร้าง "งาน" หรือ "โน้ต" (ปุ่ม 📝 โน้ต มุมบนก็สร้างได้) บนมือถือแตะวันแล้วกด ➕ สร้าง',
      'โน้ตมี 4 ประเภท: โน้ต / นัดหมาย / บันทึก-เหตุการณ์ / เตือนความจำ เลือกสีได้ ตั้งเป็น 🔒 ส่วนตัว หรือ 👥 ทีม (หัวหน้าและลูกทีมที่ผูกกับคุณเห็น) แก้ไข/ลบได้เฉพาะเจ้าของ (Admin ลบโน้ตทีมได้)',
      'โน้ตไม่ใช่งาน: ไม่มีคะแนน ไม่ขึ้นในรายงาน/แดชบอร์ด การกรองประเภทงาน/สถานะจะซ่อนโน้ต'],
    tip: 'โน้ตถูกดึงเฉพาะช่วงที่เปิดดู (±1 เดือน) และแคช 5 นาที เพื่อประหยัดโควต้า' };
}
console.log('%cWorkFlow Pro v9 add-on loaded', 'color:#0F766E;font-weight:bold');
})();
