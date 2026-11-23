/* =====================================================================
   WorkFlow Pro v8 add-on  (โหลดหลัง v7-addon.js)
   ปฏิทินแบบ Google Calendar: มุมมอง เดือน / สัปดาห์ / วัน / รายการ
   - แถบงานสีตามความเร่งด่วนในช่องวัน (+N อีก) กดเพื่อเปิดรายละเอียด
   - กดช่องว่างของวัน = สร้างงานโดยตั้งกำหนดส่งเป็นวันนั้น (มือถือ: ไปมุมมองวัน)
   - กรองตามพนักงาน (หัวหน้า) / ประเภทงาน / สถานะ
   - ใช้ tasksCache เดิม ไม่เพิ่มตาราง ไม่เพิ่ม Egress (ซิงก์แบบ incremental ตอนเข้าหน้า)
   ลบ <script src="v8-addon.js"> = กลับเป็นปฏิทินเดิม
   ===================================================================== */
(function () {
'use strict';
if (!window.WF4) { console.warn('[v8] ต้องโหลดหลัง v4–v7 — ข้าม'); return; }

const $ = id => document.getElementById(id);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dt = s => { const [y, m, d] = String(s).substring(0, 10).split('-').map(Number); return new Date(y, m-1, d); };
const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const coarse = () => window.matchMedia && matchMedia('(pointer:coarse)').matches;
const narrow = () => window.innerWidth < 700;
let saved = null; try { saved = localStorage.getItem('wf8_view'); } catch (e) {}
const V8 = { view: saved || (narrow() ? 'agenda' : 'month'), anchor: dt(todayStr()), who: '', cat: '', st: '' };
const WF8 = window.WF8 = {};
const PR = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/* ---------- CSS ---------- */
const css = document.createElement('style');
css.textContent = `
.v8-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.v8-nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.v8-title{font-size:1.1rem;font-weight:700;margin-left:6px}
.v8-seg{display:flex;border:1.5px solid var(--border);border-radius:10px;overflow:hidden}
.v8-seg button{padding:7px 14px;background:var(--bg-card);color:var(--text-sub);font-size:.82rem;font-weight:600;min-height:36px}
.v8-seg button.on{background:var(--primary);color:#fff}
.v8-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.v8-filters select{max-width:180px;padding:7px 10px;font-size:.82rem}
.v8-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:.74rem;color:var(--text-sub);margin-bottom:10px;align-items:center}
.v8-dotl{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.v8-month{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.v8-dh{background:var(--primary);color:#fff;text-align:center;padding:8px 2px;font-size:.76rem;font-weight:700}
.v8-cell{background:var(--bg-card);min-height:112px;padding:4px;cursor:pointer;min-width:0}
.v8-cell:hover{background:rgba(20,184,166,.07)}
.v8-cell.other{background:var(--bg);opacity:.6}
.v8-num{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;border-radius:12px;font-size:.8rem;font-weight:600;cursor:pointer}
.v8-num:hover{background:rgba(20,184,166,.2)}
.v8-num.today{background:var(--primary);color:#fff}
.v8-chip{display:block;font-size:.72rem;line-height:1.35;padding:2px 6px;border-radius:5px;margin-top:2px;color:#fff;background:var(--c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.v8-chip:hover{filter:brightness(1.1)}
.v8-chip.done{opacity:.5;text-decoration:line-through}
.v8-chip.late{box-shadow:0 0 0 2px var(--danger)}
.v8-more{font-size:.7rem;color:var(--text-sub);padding:1px 6px;cursor:pointer;font-weight:600}
.v8-more:hover{color:var(--primary)}
.v8-wk{overflow-x:auto;-webkit-overflow-scrolling:touch}
.v8-wkgrid{display:grid;grid-template-columns:repeat(7,minmax(130px,1fr));gap:1px;background:var(--border);border:1px solid var(--border);border-radius:12px;overflow:hidden;min-width:910px}
.v8-col{background:var(--bg-card);min-height:300px;padding:6px;cursor:pointer}
.v8-col.today{background:rgba(20,184,166,.07)}
.v8-colh{text-align:center;font-size:.76rem;color:var(--text-sub);margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border);cursor:pointer}
.v8-colh .v8-num{display:flex;margin:2px auto 0;width:30px;height:30px;font-size:.95rem}
.v8-card{white-space:normal;padding:6px 8px;margin-top:6px}
.v8-ct{font-weight:600;font-size:.8rem;word-break:break-word}
.v8-cm{font-size:.7rem;opacity:.9;margin-top:2px}
.v8-dayh{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.v8-ag{margin-bottom:14px}
.v8-agh{font-weight:700;font-size:.88rem;padding:6px 2px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between}
.v8-empty{text-align:center;color:var(--text-sub);font-size:.88rem;padding:26px 0}
@media(max-width:700px){.v8-cell{min-height:70px;padding:2px}.v8-chip{font-size:.62rem;padding:1px 4px}.v8-title{font-size:.95rem}.v8-seg button{padding:6px 9px;font-size:.76rem}}
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

function visible() {
  const uid = currentUser.id;
  return tasksCache.filter(t => t.deadline && t.status !== 'cancelled'
    && (!V8.who || (V8.who === 'me' ? t.assignedTo === uid : t.assignedTo === V8.who))
    && (!V8.cat || t.category === V8.cat)
    && (!V8.st || stKey(t) === V8.st));
}
function groupByDate(list) {
  const m = {};
  list.forEach(t => { (m[t.deadline.substring(0, 10)] = m[t.deadline.substring(0, 10)] || []).push(t); });
  Object.values(m).forEach(a => a.sort((x, y) => (timeOf(x) || '99').localeCompare(timeOf(y) || '99') || (PR[x.priority] ?? 9) - (PR[y.priority] ?? 9)));
  return m;
}
const cls = t => (t.status === 'done' ? ' done' : '') + (isLate(t) ? ' late' : '');
function chip(t) {
  const tm = timeOf(t);
  return `<div class="v8-chip${cls(t)}" data-id="${t.id}" style="--c:${priorityColor(t.priority)}" title="${esc(t.title)} · ${esc(getUserName(t.assignedTo))}">${tm ? `<b>${tm}</b> ` : ''}${esc(t.title)}</div>`;
}
function card(t) {
  const tm = timeOf(t);
  return `<div class="v8-chip v8-card${cls(t)}" data-id="${t.id}" style="--c:${priorityColor(t.priority)}"><div class="v8-ct">${tm ? `<b>${tm}</b> ` : ''}${esc(t.title)}</div>
    <div class="v8-cm">👤 ${esc(getUserName(t.assignedTo))} · ${statusLabel(isLate(t) ? 'overdue' : t.status)} · ⭐${t.points}</div></div>`;
}

/* ---------- views ---------- */
function viewMonth(map) {
  const a = V8.anchor, y = a.getFullYear(), m = a.getMonth(), today = todayStr();
  const first = new Date(y, m, 1), dim = new Date(y, m + 1, 0).getDate(), weeks = Math.ceil((first.getDay() + dim) / 7);
  const max = narrow() ? 2 : 3, start = add(first, -first.getDay());
  let h = dnames().map(d => `<div class="v8-dh">${d}</div>`).join('');
  for (let i = 0; i < weeks * 7; i++) {
    const d = add(start, i), ds = ymd(d), list = map[ds] || [];
    h += `<div class="v8-cell${d.getMonth() !== m ? ' other' : ''}" data-date="${ds}"><div class="v8-num${ds === today ? ' today' : ''}" data-day="${ds}">${d.getDate()}</div>
      ${list.slice(0, max).map(chip).join('')}${list.length > max ? `<div class="v8-more" data-more="${ds}">+${list.length - max} อีก</div>` : ''}</div>`;
  }
  return `<div class="v8-month">${h}</div>`;
}
function viewWeek(map) {
  const s = add(V8.anchor, -V8.anchor.getDay()), today = todayStr();
  let h = '';
  for (let i = 0; i < 7; i++) {
    const d = add(s, i), ds = ymd(d), list = map[ds] || [];
    h += `<div class="v8-col${ds === today ? ' today' : ''}" data-date="${ds}"><div class="v8-colh" data-day="${ds}">${dnames()[d.getDay()]}<div class="v8-num${ds === today ? ' today' : ''}">${d.getDate()}</div></div>${list.map(card).join('')}</div>`;
  }
  return `<div class="v8-wk"><div class="v8-wkgrid">${h}</div></div>`;
}
function viewDay(map) {
  const ds = ymd(V8.anchor), list = map[ds] || [];
  const label = V8.anchor.toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `<div class="v8-dayh"><strong>${label}</strong><button class="btn btn-primary btn-sm" data-create="${ds}">➕ สร้างงานวันนี้</button></div>
    ${list.length ? list.map(card).join('') : '<div class="v8-empty">ไม่มีงานครบกำหนดในวันนี้ 🎉</div>'}`;
}
function viewAgenda(all) {
  const today = todayStr(), from = ymd(V8.anchor), to = ymd(add(V8.anchor, 29));
  let h = '';
  if (from <= today && today <= to) {
    const late = all.filter(isLate).sort((a, b) => a.deadline.localeCompare(b.deadline));
    if (late.length) h += `<div class="v8-ag"><div class="v8-agh"><span>🔴 เกินกำหนด</span><span style="color:var(--text-sub)">${late.length}</span></div>${late.map(card).join('')}</div>`;
  }
  const map = groupByDate(all.filter(t => { const d = t.deadline.substring(0, 10); return d >= from && d <= to && !(d < today && isLate(t)); }));
  Object.keys(map).sort().forEach(ds => {
    const d = dt(ds), lab = d.toLocaleDateString(currentLang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    h += `<div class="v8-ag"><div class="v8-agh"><span>${ds === today ? '📍 วันนี้ · ' : ''}${lab}</span><span style="color:var(--text-sub)">${map[ds].length}</span></div>${map[ds].map(card).join('')}</div>`;
  });
  return h || '<div class="v8-empty">ไม่มีงานในช่วง 30 วันนี้ 🎉</div>';
}

/* ---------- render ---------- */
function title() {
  const a = V8.anchor;
  if (V8.view === 'month') return `${months()[a.getMonth()]} ${yr(a)}`;
  if (V8.view === 'week') { const s = add(a, -a.getDay()), e = add(s, 6); return `${fmtS(s)} – ${fmtS(e)} ${yr(e)}`; }
  if (V8.view === 'day') return `${fmtS(a)} ${yr(a)}`;
  return `${fmtS(a)} – ${fmtS(add(a, 29))} ${yr(add(a, 29))}`;
}
function fillFilters() {
  const w = $('v8-who'), c = $('v8-cat');
  if (w) {
    if (!isManager()) w.style.display = 'none';
    else { w.innerHTML = '<option value="">👥 ทุกคน</option><option value="me">👤 ของฉัน</option>' + getTeamUsers().filter(u => u.id !== currentUser.id && u.isActive !== false).map(u => `<option value="${u.id}">${esc(u.fullName)}</option>`).join(''); w.value = V8.who; }
  }
  if (c) { c.innerHTML = '<option value="">📂 ทุกประเภท</option>' + categoriesCache.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join(''); c.value = V8.cat; }
  const s = $('v8-st'); if (s) s.value = V8.st;
}
function render() {
  const body = $('v8-body'); if (!body || !currentUser) return;
  fillFilters();
  $('v8-title').textContent = title();
  document.querySelectorAll('#v8-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === V8.view));
  const all = visible(), map = groupByDate(all);
  body.innerHTML = V8.view === 'month' ? viewMonth(map) : V8.view === 'week' ? viewWeek(map) : V8.view === 'day' ? viewDay(map) : viewAgenda(all);
}
window.renderTaskCalendar = render;
window.changeCalMonth = dir => {
  const a = V8.anchor;
  V8.anchor = V8.view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : add(a, dir * (V8.view === 'week' ? 7 : V8.view === 'day' ? 1 : 30));
  render();
};
window.loadCalendarPage = async function () {
  try { const r = await callAPI('GET_TASKS'); tasksCache = r.data || tasksCache; } catch (e) { toast(e.message, 'error'); }
  render();
};

/* ---------- actions ---------- */
WF8.today = () => { V8.anchor = dt(todayStr()); render(); };
WF8.setView = v => {
  const t = dt(todayStr());
  if (V8.anchor.getFullYear() === t.getFullYear() && V8.anchor.getMonth() === t.getMonth()) V8.anchor = t;
  V8.view = v; try { localStorage.setItem('wf8_view', v); } catch (e) {} render();
};
WF8.filter = () => { V8.who = $('v8-who')?.value || ''; V8.cat = $('v8-cat')?.value || ''; V8.st = $('v8-st')?.value || ''; render(); };
WF8.goDay = ds => { V8.anchor = dt(ds); V8.view = 'day'; render(); };
WF8.create = ds => {
  openNewTaskModal();
  const dl = $('task-deadline'), sd = $('task-start-date');
  if (dl) { dl.value = ds; dl.dispatchEvent(new Event('change', { bubbles: true })); }
  if (sd && ds < todayStr()) sd.value = ds;
};

function bind(body) {
  body.addEventListener('click', e => {
    const c = e.target.closest('.v8-chip[data-id]'); if (c) return viewTaskDetail(+c.dataset.id);
    const mo = e.target.closest('[data-more]'); if (mo) return WF8.goDay(mo.dataset.more);
    const dy = e.target.closest('[data-day]'); if (dy) return WF8.goDay(dy.dataset.day);
    const cr = e.target.closest('[data-create]'); if (cr) return WF8.create(cr.dataset.create);
    const cell = e.target.closest('[data-date]'); if (cell) return coarse() ? WF8.goDay(cell.dataset.date) : WF8.create(cell.dataset.date);
  });
}
function inject() {
  const pg = $('page-calendar'); if (!pg) return;
  const sub = pg.querySelector('.page-sub'); if (sub) sub.textContent = 'ดูงานตามกำหนดส่ง · กดช่องว่างของวันเพื่อสร้างงาน';
  const box = pg.querySelector('.card-body'); if (!box) return;
  const seg = [['month', 'เดือน'], ['week', 'สัปดาห์'], ['day', 'วัน'], ['agenda', 'รายการ']];
  box.innerHTML = `
    <div class="v8-bar"><div class="v8-nav"><button class="btn btn-secondary btn-sm" onclick="WF8.today()">วันนี้</button>
      <button class="btn btn-secondary btn-sm" onclick="changeCalMonth(-1)">◀</button><button class="btn btn-secondary btn-sm" onclick="changeCalMonth(1)">▶</button><div class="v8-title" id="v8-title"></div></div>
      <div class="v8-seg" id="v8-seg">${seg.map(s => `<button type="button" data-v="${s[0]}" onclick="WF8.setView('${s[0]}')">${s[1]}</button>`).join('')}</div></div>
    <div class="v8-filters"><select class="select-field" id="v8-who" onchange="WF8.filter()"></select><select class="select-field" id="v8-cat" onchange="WF8.filter()"></select>
      <select class="select-field" id="v8-st" onchange="WF8.filter()"><option value="">⚪ ทุกสถานะ</option><option value="pending">⏳ รอดำเนินการ</option><option value="overdue">🔴 เกินกำหนด</option><option value="done">✅ เสร็จสิ้น</option></select></div>
    <div class="v8-legend"><span><i class="v8-dotl" style="background:#EF4444"></i>วิกฤต</span><span><i class="v8-dotl" style="background:#F59E0B"></i>สูง</span><span><i class="v8-dotl" style="background:#3B82F6"></i>กลาง</span><span><i class="v8-dotl" style="background:#10B981"></i>ต่ำ</span>
      <span style="opacity:.6;text-decoration:line-through">เสร็จแล้ว</span><span><i class="v8-dotl" style="background:#999;box-shadow:0 0 0 2px var(--danger)"></i>เกินกำหนด</span></div>
    <div id="v8-body"></div>`;
  bind($('v8-body'));
}
const _bl = window.buildLayout;
window.buildLayout = function () { _bl.apply(this, arguments); try { inject(); } catch (e) { console.warn('[v8] inject', e); } };
if (currentUser && $('page-calendar')) { inject(); if (currentPage === 'calendar') render(); }

if (typeof PAGE_HELP !== 'undefined') {
  PAGE_HELP.calendar = { intro: 'ปฏิทินแสดงงานตามวันกำหนดส่ง (แบบ Google Calendar)',
    items: ['สลับมุมมอง เดือน / สัปดาห์ / วัน / รายการ ได้ที่ปุ่มมุมขวาบน ปุ่ม "วันนี้" กลับมาวันปัจจุบัน ◀ ▶ เลื่อนตามมุมมอง (คีย์ [ ] ใช้ได้)',
      'แถบงานสีตามความเร่งด่วน: แดง=วิกฤต ส้ม=สูง น้ำเงิน=กลาง เขียว=ต่ำ จางขีดฆ่า=เสร็จแล้ว กรอบแดง=เกินกำหนด กดแถบเพื่อเปิดรายละเอียด',
      'ช่องวันที่มีงานมากจะแสดง "+N อีก" กดเพื่อดูทั้งหมดในมุมมองวัน',
      'บนคอม: กดช่องว่างของวันเพื่อสร้างงานใหม่ (ตั้งกำหนดส่งเป็นวันนั้นให้) บนมือถือ: แตะวันแล้วกด "➕ สร้างงานวันนี้"',
      'กรองตามพนักงาน (หัวหน้า/Admin) ประเภทงาน และสถานะได้ ส่วนมุมมอง "รายการ" จะรวมงานเกินกำหนดไว้ด้านบน'],
    tip: 'บนมือถือระบบเลือกมุมมอง "รายการ" ให้เป็นค่าเริ่มต้น และจำมุมมองล่าสุดที่คุณเลือกไว้' };
}
console.log('%cWorkFlow Pro v8 add-on loaded', 'color:#0F766E;font-weight:bold');
})();
