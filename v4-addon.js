/* =====================================================================
   WorkFlow Pro v4.0 add-on  (โหลดหลัง script หลักของ index.html)
   - ครอบ (wrap) ฟังก์ชันเดิม ไม่แก้ของเดิม  | ลบ <script src="v4-addon.js"> = กลับเป็นระบบเดิม
   ===================================================================== */
(function () {
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const addDays = n => { const d = new Date(); d.setDate(d.getDate()+n); return ymd(d); };
const localDay = iso => iso ? ymd(new Date(iso)) : '';
const nl2br = s => esc(s).replace(/\n/g, '<br>');

const V4 = {
  tasks: { map: new Map(), rows: null, maxUpd: null, fullAt: 0 },
  cache: {}, noSub: false, pendingSubs: null, subsEdit: [],
  tpl: null, tplAt: 0, view: localStorage.getItem('wf_task_view') || 'list', detailId: null
};
const WF4 = window.WF4 = {};

/* ============================================================
   1) DARK MODE
   ============================================================ */
const DARK_CSS = `
[data-theme="dark"]{--bg:#0B1220;--bg-card:#111B2E;--text-main:#E2E8F0;--text-sub:#94A3B8;--text-light:#64748B;--border:#233152;--shadow:0 4px 24px rgba(0,0,0,.4);--shadow-card:0 2px 12px rgba(0,0,0,.35)}
[data-theme="dark"] body{background:var(--bg);color:var(--text-main)}
[data-theme="dark"] #topbar,[data-theme="dark"] .card,[data-theme="dark"] .modal,[data-theme="dark"] .modal-header,[data-theme="dark"] .login-card,
[data-theme="dark"] .stat-card,[data-theme="dark"] .task-card,[data-theme="dark"] .org-node,[data-theme="dark"] .cat-item,[data-theme="dark"] #bottom-nav,
[data-theme="dark"] #notif-panel,[data-theme="dark"] .adv-filter-bar,[data-theme="dark"] .filter-chip,[data-theme="dark"] .cal-day,[data-theme="dark"] .notif-tab.active{background:var(--bg-card)!important;color:var(--text-main)}
[data-theme="dark"] .form-input,[data-theme="dark"] .input-field,[data-theme="dark"] .select-field,[data-theme="dark"] .adv-filter-select{background:#0D1626;color:var(--text-main);border-color:var(--border)}
[data-theme="dark"] .filter-chip.active{background:var(--primary)!important;color:#fff}
[data-theme="dark"] th,[data-theme="dark"] .notif-tabs,[data-theme="dark"] #notif-footer,[data-theme="dark"] .cal-day.other-month,[data-theme="dark"] .cal-day.weekend{background:#0D1626!important}
[data-theme="dark"] tr:hover td{background:#16233b}
[data-theme="dark"] .topbar-btn,[data-theme="dark"] .lang-switch,[data-theme="dark"] #menu-toggle,[data-theme="dark"] .modal-close{background:#0D1626;color:var(--text-main);border-color:var(--border)}
[data-theme="dark"] .btn-secondary{background:#16233b;color:#99F6E4;border-color:#233152}
[data-theme="dark"] .cal-day.today,[data-theme="dark"] .cal-day:hover,[data-theme="dark"] .notif-item.unread{background:#12263d!important}
[data-theme="dark"] .notif-item:hover,[data-theme="dark"] .urgent-alert-item,[data-theme="dark"] .report-summary-card,[data-theme="dark"] .detail-desc-box{background:#0D1626}
[data-theme="dark"] [style*="background:#EFF6FF"],[data-theme="dark"] [style*="background:#ECFDF5"],[data-theme="dark"] [style*="background:#FFF7ED"]{background:#12263d!important;color:var(--text-main)!important}
[data-theme="dark"] [style*="background:#FEF2F2"]{background:#2a1517!important}
[data-theme="dark"] .login-hint{background:#12263d;border-color:var(--border)}
[data-theme="dark"] .badge-gray{background:#1c2a44}
[data-theme="dark"] .progress-bar-bg{background:#1c2a44}
/* ---------- v4 components ---------- */
#v4-fab{display:none;position:fixed;right:18px;bottom:24px;width:52px;height:52px;border-radius:50%;background:var(--primary);color:#fff;font-size:1.4rem;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(15,118,110,.45);z-index:140}
body:has(#main-app.active) #v4-fab{display:flex}
@media(max-width:900px){#v4-fab{bottom:calc(78px + env(safe-area-inset-bottom,0px));right:14px}}
.kb-wrap{display:grid;grid-template-columns:repeat(4,minmax(260px,1fr));gap:12px;overflow-x:auto;padding-bottom:12px;-webkit-overflow-scrolling:touch}
.kb-col{background:var(--bg);border:1.5px dashed var(--border);border-radius:14px;padding:10px;min-height:220px;transition:background .15s}
.kb-col.over{background:rgba(20,184,166,.12);border-color:var(--primary-light)}
.kb-head{font-weight:700;font-size:.88rem;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.kb-count{font-size:.72rem;padding:2px 9px;border-radius:12px;color:#fff}
.kb-card{background:var(--bg-card);border:1px solid var(--border);border-left:4px solid #94A3B8;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:grab;box-shadow:var(--shadow-card)}
.kb-card.dragging{opacity:.4}
.kb-title{font-weight:600;font-size:.88rem;margin-bottom:6px;word-break:break-word}
.kb-meta{font-size:.74rem;color:var(--text-sub);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.kb-act{margin-top:8px;display:flex;gap:6px}
#v4-cmd,#v4-qa-ov{display:none;position:fixed;inset:0;background:rgba(15,36,96,.45);backdrop-filter:blur(3px);z-index:3000;align-items:flex-start;justify-content:center;padding:12vh 14px 0}
#v4-cmd.open,#v4-qa-ov.open{display:flex}
.v4-box{background:var(--bg-card);color:var(--text-main);border:1px solid var(--border);border-radius:16px;width:100%;max-width:560px;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden}
.v4-box input.v4-in{width:100%;border:none;border-bottom:1px solid var(--border);padding:16px 18px;font-size:1rem;background:transparent;color:var(--text-main)}
.v4-list{max-height:52vh;overflow-y:auto}
.v4-item{display:flex;gap:10px;align-items:center;padding:10px 18px;cursor:pointer;font-size:.9rem}
.v4-item.sel,.v4-item:hover{background:rgba(20,184,166,.14)}
.v4-grp{padding:8px 18px 2px;font-size:.68rem;font-weight:700;letter-spacing:.08em;color:var(--text-light);text-transform:uppercase}
.v4-chip{display:inline-block;padding:3px 10px;border-radius:14px;background:rgba(20,184,166,.15);color:var(--primary);font-size:.76rem;font-weight:600;margin:3px 4px 0 0}
.v4-st{display:flex;gap:8px;align-items:center;padding:6px 2px;font-size:.88rem;cursor:pointer}
.v4-st.done span{text-decoration:line-through;color:var(--text-light)}
.v4-st input{width:17px;height:17px;flex-shrink:0}
.v4-sub-row{display:flex;gap:6px;margin-bottom:6px}
.v4-badge-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.v4-badge{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center;box-shadow:var(--shadow-card)}
.v4-badge.locked .v4-bi{filter:grayscale(1);opacity:.35}
.v4-bi{font-size:2.4rem;margin-bottom:6px}
.v4-cm{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)}
.v4-ext-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px}
@media(max-width:700px){.kb-wrap{grid-template-columns:repeat(4,80vw)}}
`;
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('wf_theme', t);
  const b = $('v4-theme-btn'); if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0B1220' : '#0F766E');
  if (window.Chart) { Chart.defaults.color = t === 'dark' ? '#CBD5E1' : '#666'; Chart.defaults.borderColor = t === 'dark' ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'; }
  try {
    if (typeof currentUser !== 'undefined' && currentUser && currentPage === 'dashboard') {
      const tab = document.querySelector('[data-dashtab].active')?.dataset.dashtab;
      if (tab === 'trend') renderMonthlyTrendChart(); else if (tab === 'category') renderCategoryChart(); else if (tab === 'compare') renderCompareChart();
    }
  } catch (e) {}
}
WF4.toggleTheme = () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');

/* ============================================================
   2) DATA LAYER — Incremental sync + cache (ลด Egress)
   ============================================================ */
const COLS = 'id, task_code, title, description, category, priority, points, assigned_to, created_by, start_date, start_time, deadline, end_time, status, source, completed_at, approved_by, approved_at, updated_at';
const mapT = r => { const t = mapTask(r); t.subtasks = Array.isArray(r.subtasks) ? r.subtasks : []; return t; };

async function getTasks(force) {
  const S = V4.tasks, now = Date.now();
  const full = force || !S.rows || !S.maxUpd || now - S.fullAt > 10 * 60 * 1000;
  const cols = V4.noSub ? COLS : COLS + ', subtasks';
  let rows = [];
  for (let p = 0; p < 10; p++) {
    let q = supabase.from('tasks').select(cols);
    if (!full) q = q.gte('updated_at', new Date(S.maxUpd).toISOString());
    const { data, error } = await q.order('id', { ascending: true }).range(p*1000, p*1000+999);
    if (error) {
      if (!V4.noSub && /subtasks/i.test(error.message || '')) { V4.noSub = true; return getTasks(force); }
      throw error;
    }
    rows = rows.concat(data || []);
    if (!data || data.length < 1000) break;
  }
  if (full) { S.map = new Map(); S.maxUpd = null; S.fullAt = now; }
  rows.forEach(r => { S.map.set(r.id, mapT(r)); if (r.updated_at && (!S.maxUpd || r.updated_at > S.maxUpd)) S.maxUpd = r.updated_at; });
  S.rows = [...S.map.values()].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') || b.id - a.id);
  return { success: true, data: S.rows.slice() };
}

async function dashBundle(payload) {
  const tasks = (await getTasks()).data;
  const sel = payload.targetUserId || 'self';
  const uid = sel === 'self' ? currentUser.id : sel;
  const subset = sel === 'team' ? tasks : tasks.filter(t => t.assignedTo === uid);
  const local = _computeLocalDashboardStats(subset);
  if (!(sel === 'team' && isManager())) local.teamOverview = null;
  const { data: me } = await supabase.from('users').select('points').eq('id', currentUser.id).single();
  return { success: true, dashboard: { ...local, points: me?.points || 0 }, tasks };
}

const TTL = { GET_USERS: 90e3, GET_ORG: 90e3, GET_CATEGORIES: 300e3 };
const KEY = { GET_USERS: 'users', GET_ORG: 'users', GET_CATEGORIES: 'cats' };
const INVAL = {
  users: ['CREATE_USER','UPDATE_USER','SET_MANAGERS','DEDUCT_POINTS','APPROVE_TASK','UPDATE_TASK_STATUS','UPDATE_AVATAR','UPDATE_PROFILE','TAKE_SNAPSHOT'],
  cats: ['CREATE_CATEGORY','DELETE_CATEGORY']
};
function resetAll() { V4.tasks = { map: new Map(), rows: null, maxUpd: null, fullAt: 0 }; V4.cache = {}; V4.tpl = null; }

async function saveSubs(id, subs) {
  if (V4.noSub) return;
  const cur = V4.tasks.map.get(id);
  if (cur && JSON.stringify(cur.subtasks) === JSON.stringify(subs)) return;
  const { error } = await supabase.from('tasks').update({ subtasks: subs }).eq('id', id);
  if (error) throw error;
}

const _origDispatch = window._dispatchAPI;
window._dispatchAPI = async function (action, payload = {}) {
  if (action === 'LOGIN' || action === 'LOGOUT') resetAll();
  const k = KEY[action];
  if (k) {
    const c = V4.cache[k];
    if (c && Date.now() - c.at < TTL[action]) return { success: true, data: c.data.slice() };
    const r = await _origDispatch(action, payload);
    if (r && r.success) V4.cache[k] = { at: Date.now(), data: (r.data || []).slice() };
    return r;
  }
  if (action === 'GET_TASKS') return getTasks(payload.force);
  if (action === 'GET_DASHBOARD_BUNDLE') return dashBundle(payload);
  const subs = (action === 'CREATE_TASK' || action === 'UPDATE_TASK') ? V4.pendingSubs : null;
  if (subs) V4.pendingSubs = null;   // v6: ใช้ครั้งเดียว กันไปติดกับงานอื่น (เช่น งานซ้ำที่สร้างอัตโนมัติ)
  const r = await _origDispatch(action, payload);
  if (r && r.success) {
    for (const [key, list] of Object.entries(INVAL)) if (list.includes(action)) delete V4.cache[key];
    if (action === 'DELETE_TASK') { V4.tasks.map.delete(payload.id); V4.tasks.rows = (V4.tasks.rows || []).filter(t => t.id !== payload.id); }
    if (subs) {
      try {
        if (action === 'UPDATE_TASK') await saveSubs(payload.id, subs);
        else if (subs.length && r.id) await saveSubs(r.id, subs);
      } catch (e) { toast('บันทึกงานแล้ว แต่บันทึกรายการย่อยไม่สำเร็จ: ' + e.message, 'warning', 6000); }
    }
  }
  return r;
};

/* Leaderboard ใช้ cache แทนยิง GET_USERS ซ้ำ (ผ่าน wrapper ข้างบนอยู่แล้ว) — ไม่ต้องแก้เพิ่ม */

/* ============================================================
   3) COMMAND PALETTE (Ctrl/⌘ + K)
   ============================================================ */
let cmdSel = 0, cmdItems = [];
function paletteBuild(q) {
  const ql = q.trim().toLowerCase(), out = [];
  const pages = [['dashboard','📊','แดชบอร์ด'],['tasks','✅','สั่งงาน / บันทึกงาน'],['calendar','📅','ปฏิทินงาน'],['kpi','🏆','KPI & รางวัล'],['badges','🎖️','เหรียญรางวัล'],['extensions','📆','คำขอเลื่อนกำหนดส่ง'],['salary','💰','คำนวณเงินเดือน'],['profile','👤','โปรไฟล์']];
  if (isManager()) pages.push(['org','🏢','โครงสร้างองค์กร'], ['deductions','⚠️','ประวัติตัดคะแนน']);
  if (isAdmin()) pages.push(['users','👥','จัดการผู้ใช้'], ['reports','📈','รายงาน'], ['audit','🔍','Audit Log']);
  const acts = [
    ['➕','สร้างงานใหม่', () => openNewTaskModal()], ['⚡','Quick Add (พิมพ์ประโยคสร้างงาน)', () => WF4.openQuick('')],
    ['📑','สร้างงานจากแม่แบบ', () => { openNewTaskModal(); WF4.openTemplates(); }],
    ['🗂','สลับมุมมอง รายการ/Kanban', () => { navigate('tasks'); WF4.toggleView(); }],
    ['🌙','สลับธีม สว่าง/มืด', () => WF4.toggleTheme()], ['🚪','ออกจากระบบ', () => logout()]
  ];
  const m = s => !ql || s.toLowerCase().includes(ql);
  const g1 = pages.filter(p => m(p[2]) || m(p[0])).map(p => ({ icon: p[1], text: p[2], run: () => navigate(p[0]) }));
  const g2 = acts.filter(a => m(a[1])).map(a => ({ icon: a[0], text: a[1], run: a[2] }));
  const g3 = ql ? tasksCache.filter(t => (t.title + ' ' + (t.taskCode || '') + ' ' + (t.category || '')).toLowerCase().includes(ql)).slice(0, 8)
    .map(t => ({ icon: '📋', text: `${t.taskCode ? t.taskCode + ' · ' : ''}${t.title}`, sub: `${getUserName(t.assignedTo)} · ${fmtDate(t.deadline)}`, run: () => { navigate('tasks'); setTimeout(() => viewTaskDetail(t.id), 200); } })) : [];
  const g4 = ql ? usersCache.filter(u => (u.fullName + ' ' + (u.username || '') + ' ' + (u.position || '')).toLowerCase().includes(ql)).slice(0, 5)
    .map(u => ({ icon: '👤', text: u.fullName, sub: u.position || u.department || '', run: () => { navigate('tasks'); taskFilter = 'all'; _populateAdvFilterDropdowns(); const a = $('af-assignee'); if (a) { a.value = u.id; renderTaskList(); } } })) : [];
  if (g3.length) out.push({ grp: 'งาน' }, ...g3);
  if (g4.length) out.push({ grp: 'พนักงาน (กรองงาน)' }, ...g4);
  if (g1.length) out.push({ grp: 'ไปที่หน้า' }, ...g1);
  if (g2.length) out.push({ grp: 'คำสั่ง' }, ...g2);
  if (q.trim()) out.push({ grp: 'Quick Add' }, { icon: '⚡', text: `สร้างงาน: "${q.trim()}"`, run: () => WF4.openQuick(q.trim()) });
  return out;
}
function paletteRender() {
  const q = $('v4-cmd-in').value; const items = paletteBuild(q);
  cmdItems = items.filter(i => !i.grp); if (cmdSel >= cmdItems.length) cmdSel = 0;
  let idx = -1;
  $('v4-cmd-list').innerHTML = items.map(i => {
    if (i.grp) return `<div class="v4-grp">${i.grp}</div>`;
    idx++; return `<div class="v4-item ${idx === cmdSel ? 'sel' : ''}" data-i="${idx}"><span>${i.icon}</span><div style="flex:1;min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(i.text)}</div>${i.sub ? `<div style="font-size:.74rem;color:var(--text-sub)">${esc(i.sub)}</div>` : ''}</div></div>`;
  }).join('') || '<div class="v4-item" style="color:var(--text-sub)">ไม่พบผลลัพธ์</div>';
  $('v4-cmd-list').querySelectorAll('.v4-item[data-i]').forEach(el => el.onclick = () => paletteRun(+el.dataset.i));
}
function paletteRun(i) { const it = cmdItems[i]; if (!it) return; WF4.closeCmd(); setTimeout(() => it.run(), 30); }
WF4.openCmd = () => { if (typeof currentUser === 'undefined' || !currentUser) return; $('v4-cmd').classList.add('open'); $('v4-cmd-in').value = ''; cmdSel = 0; paletteRender(); setTimeout(() => $('v4-cmd-in').focus(), 30); };
WF4.closeCmd = () => $('v4-cmd').classList.remove('open');

/* ============================================================
   4) QUICK ADD — พิมพ์ภาษาธรรมชาติ
   ============================================================ */
const PRI = { critical:'Critical', 'วิกฤต':'Critical', 'ด่วนมาก':'Critical', high:'High', 'สูง':'High', 'ด่วน':'High', medium:'Medium', 'กลาง':'Medium', low:'Low', 'ต่ำ':'Low' };
const DAYW = { 'วันนี้':0, today:0, 'พรุ่งนี้':1, tomorrow:1, 'มะรืน':2, 'มะรืนนี้':2 };
const WD = { 'อาทิตย์':0,'จันทร์':1,'อังคาร':2,'พุธ':3,'พฤหัส':4,'พฤหัสบดี':4,'ศุกร์':5,'เสาร์':6, sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6 };
const TIME_RE = /^(\d{1,2})[:.](\d{2})(?:น\.?)?$/;
const okTime = m => m && +m[1] < 24 && +m[2] < 60 ? `${String(m[1]).padStart(2,'0')}:${m[2]}` : null;
function parseQuick(text) {
  const o = { title:'', priority:null, deadline:null, startTime:null, endTime:null, points:null, assignee:null, assigneeId:null, category:null };
  const T = text.trim().split(/\s+/).filter(Boolean), rest = []; let m;
  for (let i = 0; i < T.length; i++) {
    const w = T[i], lw = w.toLowerCase().replace(/^!/, ''), nx = (T[i+1] || '').toLowerCase();
    if (PRI[lw]) { o.priority = PRI[lw]; continue; }
    if (DAYW[lw] !== undefined) { o.deadline = addDays(DAYW[lw]); continue; }
    if (lw === 'อีก' && /^\d+$/.test(nx) && /^(วัน|days?)$/.test((T[i+2] || '').toLowerCase())) { o.deadline = addDays(+nx); i += 2; continue; }
    if ((m = lw.match(/^(\d+)(วัน|d)$/))) { o.deadline = addDays(+m[1]); continue; }
    if (lw === 'สัปดาห์' && nx === 'หน้า') { o.deadline = addDays(7); i++; continue; }
    if (lw === 'สัปดาห์หน้า' || lw === 'nextweek') { o.deadline = addDays(7); continue; }
    if (lw === 'สิ้นเดือน' || lw === 'eom') { const d = new Date(); o.deadline = ymd(new Date(d.getFullYear(), d.getMonth()+1, 0)); continue; }
    const wdn = lw.replace(/^วัน/, '');
    if (WD[wdn] !== undefined) { const tgt = WD[wdn]; let diff = (tgt - new Date().getDay() + 7) % 7; if (!diff) diff = 7; o.deadline = addDays(diff); continue; }
    if ((m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {
      let y = m[3] ? +m[3] : new Date().getFullYear(); if (y > 2400) y -= 543; if (y < 100) y += 2000;
      const d = new Date(y, +m[2]-1, +m[1]); if (d.getMonth() === +m[2]-1) { o.deadline = ymd(d); continue; }
    }
    if ((lw === 'ก่อน' || lw === 'เริ่ม') && (m = TIME_RE.exec(T[i+1] || '')) && okTime(m)) { o[lw === 'เริ่ม' ? 'startTime' : 'endTime'] = okTime(m); i++; continue; }
    if ((m = TIME_RE.exec(w)) && okTime(m)) { o.endTime = okTime(m); continue; }
    if ((m = lw.match(/^(\d+)(pt|pts|คะแนน)$/))) { o.points = +m[1]; continue; }
    if (/^\d+$/.test(lw) && /^(pt|pts|คะแนน)$/.test(nx)) { o.points = +lw; i++; continue; }
    if (w.startsWith('@') && w.length > 1) { const q = w.slice(1).toLowerCase(); const u = usersCache.find(u => ((u.fullName || '') + ' ' + (u.username || '')).toLowerCase().includes(q)); if (u) { o.assignee = u.fullName; o.assigneeId = u.id; continue; } }
    if (w.startsWith('#') && w.length > 1) { const q = w.slice(1).toLowerCase(); const c = categoriesCache.find(c => c.name.toLowerCase().includes(q)); if (c) { o.category = c.name; continue; } }
    rest.push(w);
  }
  o.title = rest.join(' '); return o;
}
function quickPreview() {
  const p = parseQuick($('v4-qa-in').value); const chips = [];
  if (p.title) chips.push(`📝 ${esc(p.title)}`); if (p.priority) chips.push(`⚡ ${p.priority}`);
  if (p.deadline) chips.push(`📅 ${fmtDate(p.deadline)}`); if (p.startTime) chips.push(`⏰ เริ่ม ${p.startTime}`); if (p.endTime) chips.push(`🔚 ${p.endTime}`);
  if (p.points) chips.push(`⭐ ${p.points} pt`); if (p.assignee) chips.push(`👤 ${esc(p.assignee)}`); if (p.category) chips.push(`📂 ${esc(p.category)}`);
  $('v4-qa-prev').innerHTML = chips.map(c => `<span class="v4-chip">${c}</span>`).join('') || '<span style="color:var(--text-sub);font-size:.8rem">พิมพ์ชื่องาน แล้วตามด้วย วัน/ความเร่งด่วน เช่น "ส่งรายงาน พรุ่งนี้ high 17:00 @สมชาย #ประชุม 20pt"</span>';
}
WF4.openQuick = txt => { $('v4-qa-ov').classList.add('open'); $('v4-qa-in').value = txt || ''; quickPreview(); setTimeout(() => $('v4-qa-in').focus(), 30); };
WF4.closeQuick = () => $('v4-qa-ov').classList.remove('open');
WF4.submitQuick = () => {
  const p = parseQuick($('v4-qa-in').value); if (!p.title) return toast('กรุณาพิมพ์ชื่องาน', 'warning');
  WF4.closeQuick(); openNewTaskModal();
  $('task-title').value = p.title;
  if (p.priority) $('task-priority').value = p.priority;
  if (p.deadline) $('task-deadline').value = p.deadline;
  if (p.startTime) $('task-start-time').value = p.startTime;
  if (p.endTime) $('task-end-time').value = p.endTime;
  if (p.points && isManager()) $('task-points').value = p.points;
  if (p.category && [...$('task-category').options].some(o => o.value === p.category)) $('task-category').value = p.category;
  if (p.assigneeId) { const a = $('task-assign'); if (a && [...a.options].some(o => o.value === p.assigneeId)) { a.value = p.assigneeId; a.onchange && a.onchange.call(a); } }
  toast('แปลงข้อความเป็นฟอร์มแล้ว ตรวจสอบแล้วกดบันทึกได้เลย', 'info');
};

/* ============================================================
   5) KANBAN + ปรับการ์ดงาน + Export Excel (หน้า Tasks)
   ============================================================ */
function filteredTasks() {
  let tasks = [...tasksCache]; const today = todayStr();
  const search = ($('task-search')?.value || '').toLowerCase().trim(); const f = _getAdvFilterValues();
  if (taskFilter === 'self') tasks = tasks.filter(t => t.source === 'self');
  else if (taskFilter === 'pending_approval') tasks = tasks.filter(t => t.status === 'done' && !t.approvedAt);
  else if (taskFilter === 'overdue') tasks = tasks.filter(t => t.deadline && t.deadline < today && !['done','cancelled','rejected'].includes(t.status));
  else if (taskFilter !== 'all') tasks = tasks.filter(t => t.status === taskFilter);
  if (search) tasks = tasks.filter(t => t.title.toLowerCase().includes(search) || (t.desc || '').toLowerCase().includes(search) || getUserName(t.assignedTo).toLowerCase().includes(search) || (t.category || '').toLowerCase().includes(search));
  if (f.category) tasks = tasks.filter(t => t.category === f.category);
  if (f.assignee) tasks = tasks.filter(t => t.assignedTo == f.assignee);
  if (f.priority) tasks = tasks.filter(t => t.priority === f.priority);
  if (f.dateFrom) tasks = tasks.filter(t => (t.deadline || t.startDate || '') >= f.dateFrom);
  if (f.dateTo) tasks = tasks.filter(t => (t.deadline || t.startDate || '') <= f.dateTo);
  if (f.source) tasks = tasks.filter(t => t.source === f.source);
  return tasks;
}
const colOf = (t, today) => t.status === 'cancelled' ? null : t.status === 'done' ? 'done' : t.status === 'rejected' ? 'rejected' : (t.deadline && t.deadline < today ? 'overdue' : 'pending');
function renderKanban() {
  const el = $('kanban-board'); if (!el) return; const today = todayStr();
  const cols = [{ k:'pending', t:'📥 รอดำเนินการ', c:'#64748B' }, { k:'overdue', t:'🔴 เกินกำหนด', c:'#DC2626' }, { k:'rejected', t:'↩️ ตีกลับ', c:'#D97706' }, { k:'done', t:'✅ เสร็จสิ้น', c:'#16A34A' }];
  const g = { pending:[], overdue:[], rejected:[], done:[] };
  filteredTasks().forEach(t => { const c = colOf(t, today); if (c) g[c].push(t); });
  ['pending','overdue','rejected'].forEach(k => g[k].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')));
  g.done.sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  const card = (t, k) => {
    const s = t.subtasks || [], sd = s.filter(x => x.d).length;
    const drag = k !== 'done' && canManageTaskFE(t);
    return `<div class="kb-card" data-id="${t.id}" ${drag ? 'draggable="true"' : ''} style="border-left-color:${priorityColor(t.priority)}">
      <div class="kb-title">${t.taskCode ? `<span style="font-family:monospace;font-size:.7rem;color:var(--text-sub)">${esc(t.taskCode)}</span> ` : ''}${esc(t.title)}</div>
      <div class="kb-meta">${avatarHtml(t.assignedTo, 20)}<span>${esc(getUserName(t.assignedTo))}</span><span>📅 ${fmtDate(t.deadline)}</span><span>⭐${t.points}</span>${s.length ? `<span>☑ ${sd}/${s.length}</span>` : ''}</div>
      ${(k !== 'done' && drag) ? `<div class="kb-act"><button class="btn btn-success btn-sm" data-act="done">✅ ส่งงาน</button></div>` : ''}
      ${(k === 'done' && isManager() && !t.approvedAt) ? `<div class="kb-act"><button class="btn btn-warning btn-sm" data-act="approve">👍 อนุมัติ</button></div>` : ''}</div>`;
  };
  el.innerHTML = `<div class="kb-wrap">${cols.map(c => {
    const list = c.k === 'done' ? g.done.slice(0, 20) : g[c.k];
    return `<div class="kb-col" data-k="${c.k}"><div class="kb-head"><span>${c.t}</span><span class="kb-count" style="background:${c.c}">${g[c.k].length}</span></div>${list.map(t => card(t, c.k)).join('') || '<div style="text-align:center;color:var(--text-light);font-size:.8rem;padding:20px 0">—</div>'}${c.k === 'done' && g.done.length > 20 ? '<div style="text-align:center;font-size:.74rem;color:var(--text-sub)">แสดง 20 งานล่าสุด</div>' : ''}</div>`;
  }).join('')}</div>`;
  if (window.WF_KB_V5) return;   // v6: ถ้ามี v5 ให้ v5 ผูก event เอง ไม่วาด/ผูกซ้ำ
  el.querySelectorAll('.kb-card').forEach(c => {
    c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('dragging'); });
    c.addEventListener('dragend', () => c.classList.remove('dragging'));
    c.addEventListener('click', e => { if (!e.target.closest('[data-act]')) viewTaskDetail(+c.dataset.id); });
  });
  el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const id = +b.closest('.kb-card').dataset.id; b.dataset.act === 'done' ? markDone(id) : approveTask(id); }));
  el.querySelectorAll('.kb-col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('over');
      const id = +e.dataTransfer.getData('text/plain'), tk = tasksCache.find(x => x.id === id); if (!tk) return;
      if (col.dataset.k === 'done') { if (colOf(tk, todayStr()) !== 'done' && canManageTaskFE(tk)) { markDone(id); toast('แนบรูปหลักฐาน (ถ้ามี) แล้วกด "ส่งงาน" เพื่อยืนยัน', 'info'); } }
      else toast('ลากย้ายได้เฉพาะไปคอลัมน์ "เสร็จสิ้น" (สถานะอื่นระบบกำหนดให้อัตโนมัติ)', 'info');
    });
  });
}
function applyView() {
  const kb = V4.view === 'kanban'; const list = $('task-list'), pg = $('task-pagination'), board = $('kanban-board'), btn = $('v4-view-btn');
  if (list) list.style.display = kb ? 'none' : ''; if (pg) pg.style.display = kb ? 'none' : ''; if (board) board.style.display = kb ? '' : 'none';
  if (btn) btn.textContent = kb ? '📋' : '🗂'; if (kb) renderKanban();
}
WF4.toggleView = () => { V4.view = V4.view === 'kanban' ? 'list' : 'kanban'; localStorage.setItem('wf_task_view', V4.view); applyView(); };
function decorateCards() {
  document.querySelectorAll('#task-list .task-card').forEach(card => {
    const m = /viewTaskDetail\((\d+)\)/.exec(card.innerHTML); if (!m) return;
    const t = tasksCache.find(x => x.id == m[1]); if (!t || !t.subtasks || !t.subtasks.length) return;
    const meta = card.querySelector('.task-card-meta'); if (!meta) return;
    const d = t.subtasks.filter(x => x.d).length;
    meta.insertAdjacentHTML('beforeend', `<span>☑ ${d}/${t.subtasks.length}</span>`);
  });
}
const _render = window.renderTaskList;
window.renderTaskList = function () { _render(); decorateCards(); applyView(); };

/* ---------- Excel ---------- */
function loadXLSX() {
  return new Promise((res, rej) => {
    if (window.XLSX) return res();
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = res; s.onerror = () => rej(new Error('โหลดไลบรารี Excel ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต')); document.head.appendChild(s);
  });
}
async function writeXLSX(sheets, name) {
  await loadXLSX(); const wb = XLSX.utils.book_new();
  sheets.forEach(sh => { const ws = XLSX.utils.json_to_sheet(sh.rows); const keys = Object.keys(sh.rows[0] || { A: 1 });
    ws['!cols'] = keys.map(k => ({ wch: Math.min(40, Math.max(k.length + 2, ...sh.rows.slice(0, 50).map(r => String(r[k] ?? '').length + 2))) })); XLSX.utils.book_append_sheet(wb, ws, sh.name); });
  XLSX.writeFile(wb, name);
}
const stTH = (t, today) => t.status === 'done' ? 'เสร็จสิ้น' : t.status === 'cancelled' ? 'ยกเลิก' : t.status === 'rejected' ? 'ถูกตีกลับ' : (t.deadline && t.deadline < today ? 'เกินกำหนด' : 'รอดำเนินการ');
WF4.exportTasksXLSX = async () => {
  const tasks = filteredTasks(); if (!tasks.length) return toast('ไม่มีงานให้ Export (ตามตัวกรองปัจจุบัน)', 'warning');
  showLoading();
  try {
    const today = todayStr();
    const rows = tasks.map((t, i) => ({ '#': i+1, 'รหัส': t.taskCode, 'ชื่องาน': t.title, 'ประเภท': t.category, 'ความเร่งด่วน': t.priority, 'สถานะ': stTH(t, today), 'ผู้รับผิดชอบ': getUserName(t.assignedTo), 'สร้างโดย': getUserName(t.createdBy), 'ที่มา': t.source === 'self' ? 'บันทึกเอง' : 'มอบหมาย', 'วันเริ่ม': t.startDate, 'กำหนดส่ง': t.deadline, 'เวลาเริ่ม': t.startTime, 'เวลาสิ้นสุด': t.endTime, 'คะแนน': t.points, 'รายการย่อย': (t.subtasks || []).length ? `${t.subtasks.filter(x => x.d).length}/${t.subtasks.length}` : '', 'เสร็จเมื่อ': t.completedAt ? fmtDateTime(t.completedAt) : '', 'อนุมัติเมื่อ': t.approvedAt ? fmtDateTime(t.approvedAt) : '' }));
    const by = {}; tasks.forEach(t => { const n = getUserName(t.assignedTo); const b = by[n] = by[n] || { 'พนักงาน': n, 'ทั้งหมด': 0, 'เสร็จสิ้น': 0, 'รอดำเนินการ': 0, 'เกินกำหนด': 0, 'คะแนนที่ได้': 0 }; b['ทั้งหมด']++; const s = stTH(t, today); if (b[s] !== undefined) b[s]++; if (t.status === 'done') b['คะแนนที่ได้'] += t.points || 0; });
    await writeXLSX([{ name: 'รายการงาน', rows }, { name: 'สรุปรายคน', rows: Object.values(by) }], `WorkFlow_Tasks_${todayStr()}.xlsx`);
    toast('Export Excel เรียบร้อย ✅', 'success');
  } catch (e) { toast(e.message, 'error'); } finally { hideLoading(); }
};
WF4.exportReportXLSX = async () => {
  if (!lastReportData) await loadReport(); if (!lastReportData) return;
  showLoading();
  try {
    const { tasks, summary, dateFrom, dateTo } = lastReportData;
    const rows = tasks.map((t, i) => ({ '#': i+1, 'ชื่องาน': t.title, 'ประเภท': t.category, 'ความเร่งด่วน': t.priority, 'สถานะ': t.status, 'ที่มา': t.source, 'ผู้รับผิดชอบ': t.assigned_to, 'สร้างโดย': t.created_by, 'วันเริ่ม': t.start_date, 'กำหนดส่ง': t.deadline, 'เวลาเริ่ม': t.start_time, 'เวลาสิ้นสุด': t.end_time, 'คะแนน': t.points, 'เสร็จเมื่อ': t.completed_at, 'อนุมัติโดย': t.approved_by, 'อนุมัติเมื่อ': t.approved_at }));
    const sum = [{ 'ช่วงวันที่': `${dateFrom} ถึง ${dateTo}`, 'ทั้งหมด': summary.total, 'เสร็จสิ้น': summary.done, 'รอดำเนินการ': summary.pending, 'เกินกำหนด': summary.overdue, 'ยกเลิก': summary.cancelled, 'ตีกลับ': summary.rejected, 'บันทึกเอง': summary.selfLog, 'คะแนนรวม': summary.totalPoints }];
    await writeXLSX([{ name: 'สรุป', rows: sum }, { name: 'รายการงาน', rows }], `WorkFlow_Report_${dateFrom}_${dateTo}.xlsx`);
    toast('Export Excel เรียบร้อย ✅', 'success');
  } catch (e) { toast(e.message, 'error'); } finally { hideLoading(); }
};

/* ============================================================
   6) SUBTASKS — ตัวแก้ไขในฟอร์ม + เช็คลิสต์ในรายละเอียด
   ============================================================ */
function subsRender() {
  const el = $('v4-sub-list'); if (!el) return;
  el.innerHTML = V4.subsEdit.map((s, i) => `<div class="v4-sub-row"><input type="text" class="input-field" value="${esc(s.t)}" maxlength="100" oninput="WF4.subSet(${i},this.value)" /><button type="button" class="btn btn-danger btn-sm" onclick="WF4.subDel(${i})">✕</button></div>`).join('');
}
WF4.subSet = (i, v) => { if (V4.subsEdit[i]) V4.subsEdit[i].t = v; };
WF4.subDel = i => { V4.subsEdit.splice(i, 1); subsRender(); };
WF4.subAdd = () => { if (V4.subsEdit.length >= 20) return toast('เพิ่มรายการย่อยได้สูงสุด 20 รายการ', 'warning'); V4.subsEdit.push({ t: '', d: false }); subsRender(); const ins = $('v4-sub-list').querySelectorAll('input'); ins[ins.length-1]?.focus(); };
const setSubs = arr => { V4.subsEdit = (arr || []).map(x => ({ t: x.t, d: !!x.d })); subsRender(); };
const cleanSubs = () => V4.subsEdit.map(x => ({ t: String(x.t || '').trim().slice(0, 100), d: !!x.d })).filter(x => x.t);

const _ont = window.openNewTaskModal; window.openNewTaskModal = function () { _ont(); setSubs([]); };
const _et = window.editTask; window.editTask = function (id) { _et(id); const t = tasksCache.find(x => x.id == id); setSubs(t ? t.subtasks : []); };
const _dt = window.duplicateTask; window.duplicateTask = function (id) { _dt(id); const t = tasksCache.find(x => x.id == id); setSubs((t?.subtasks || []).map(x => ({ t: x.t, d: false }))); };
const _st = window.saveTask;
window.saveTask = async function () { V4.pendingSubs = cleanSubs(); try { await _st(); } finally { V4.pendingSubs = null; } };

WF4.toggleSub = async (id, i, checked) => {
  const tk = tasksCache.find(x => x.id == id); if (!tk || !tk.subtasks[i]) return;
  const next = tk.subtasks.map((s, k) => k === i ? { ...s, d: checked } : s);
  try { await saveSubs(id, next); tk.subtasks = next; const m = V4.tasks.map.get(id); if (m) m.subtasks = next; renderSubsDetail(tk); if (currentPage === 'tasks') renderTaskList(); }
  catch (e) { toast('บันทึกไม่สำเร็จ: ' + e.message, 'error'); renderSubsDetail(tk); }
};
function renderSubsDetail(tk) {
  const el = $('v4-sub'); if (!el) return; const s = tk.subtasks || []; if (!s.length) { el.innerHTML = ''; return; }
  const d = s.filter(x => x.d).length, can = canManageTaskFE(tk) && tk.status !== 'cancelled';
  el.innerHTML = `<div class="detail-section"><div class="detail-section-title">☑ รายการย่อย (${d}/${s.length})</div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${Math.round(d / s.length * 100)}%"></div></div>
    <div style="margin-top:8px">${s.map((x, i) => `<label class="v4-st ${x.d ? 'done' : ''}"><input type="checkbox" ${x.d ? 'checked' : ''} ${can ? '' : 'disabled'} onchange="WF4.toggleSub(${tk.id},${i},this.checked)"><span>${esc(x.t)}</span></label>`).join('')}</div></div>`;
}

/* ============================================================
   7) TEMPLATES
   ============================================================ */
async function loadTemplates(force) {
  if (!force && V4.tpl && Date.now() - V4.tplAt < 300000) return V4.tpl;
  const { data, error } = await supabase.from('task_templates').select('id, owner_id, name, data, is_shared').order('created_at', { ascending: false }).limit(100);
  if (error) throw error; V4.tpl = data || []; V4.tplAt = Date.now(); return V4.tpl;
}
async function renderTemplates() {
  const el = $('v4-tpl-list'); el.innerHTML = '<div style="padding:12px;color:var(--text-sub)">กำลังโหลด...</div>';
  try {
    const list = await loadTemplates();
    el.innerHTML = list.length ? list.map(t => `<div class="cat-item"><div style="flex:1;min-width:0;cursor:pointer" onclick="WF4.useTpl(${t.id})"><strong>${esc(t.name)}</strong> ${t.is_shared ? '<span class="badge badge-blue">แชร์</span>' : ''}<div style="font-size:.76rem;color:var(--text-sub)">${esc(t.data.title || '')}</div></div>
      <button class="btn btn-primary btn-sm" onclick="WF4.useTpl(${t.id})">ใช้</button>${(t.owner_id === currentUser.id || isAdmin()) ? `<button class="btn btn-danger btn-sm" style="margin-left:6px" onclick="WF4.delTpl(${t.id})">🗑</button>` : ''}</div>`).join('')
      : '<div class="empty-state" style="padding:20px"><p>ยังไม่มีแม่แบบ — กรอกฟอร์มงานแล้วกด "บันทึกเป็นแม่แบบ"</p></div>';
  } catch (e) { el.innerHTML = `<div class="empty-state"><p>${esc(e.message)}</p></div>`; }
}
WF4.openTemplates = () => { $('v4-tpl-shared-wrap').style.display = isManager() ? '' : 'none'; $('v4-tpl-name').value = ''; renderTemplates(); openModal('v4-tpl-modal'); };
WF4.useTpl = id => {
  const t = (V4.tpl || []).find(x => x.id === id); if (!t) return; const d = t.data || {};
  if (d.title) $('task-title').value = d.title; $('task-desc').value = d.desc || '';
  if (d.category && [...$('task-category').options].some(o => o.value === d.category)) $('task-category').value = d.category;
  if (d.priority) $('task-priority').value = d.priority; if (d.points && isManager()) $('task-points').value = d.points;
  $('task-start-time').value = d.startTime || ''; $('task-end-time').value = d.endTime || '';
  if (d.dueInDays != null) $('task-deadline').value = addDays(+d.dueInDays);
  setSubs((d.subtasks || []).map(x => ({ t: x.t, d: false })));
  closeModal('v4-tpl-modal'); toast(`ใช้แม่แบบ "${t.name}" แล้ว`, 'success');
};
WF4.saveTpl = async () => {
  const name = $('v4-tpl-name').value.trim(); const title = $('task-title').value.trim();
  if (!name) return toast('กรุณาตั้งชื่อแม่แบบ', 'warning'); if (!title) return toast('กรอกชื่องานในฟอร์มก่อนบันทึกเป็นแม่แบบ', 'warning');
  const dl = $('task-deadline').value; let due = null; if (dl) { due = Math.round((parseLocalDate(dl) - parseLocalDate(todayStr())) / 86400000); if (due < 0) due = null; }
  const data = { title, desc: $('task-desc').value, category: $('task-category').value, priority: $('task-priority').value, points: parseInt($('task-points').value) || 0, startTime: $('task-start-time').value, endTime: $('task-end-time').value, dueInDays: due, subtasks: cleanSubs() };
  showLoading();
  try {
    const { error } = await supabase.from('task_templates').insert({ owner_id: currentUser.id, name, data, is_shared: isManager() && $('v4-tpl-shared').checked });
    if (error) throw error; V4.tpl = null; toast('บันทึกแม่แบบแล้ว ✅', 'success'); $('v4-tpl-name').value = ''; await renderTemplates();
  } catch (e) { toast(e.message, 'error'); } finally { hideLoading(); }
};
WF4.delTpl = async id => {
  if (!confirm('ลบแม่แบบนี้?')) return;
  const { error } = await supabase.from('task_templates').delete().eq('id', id);
  if (error) return toast(error.message, 'error'); V4.tpl = null; renderTemplates();
};

/* ============================================================
   8) COMMENTS + EXTENSION (ในหน้ารายละเอียดงาน)
   ============================================================ */
async function loadComments(tk) {
  const el = $('v4-cmt'); if (!el) return;
  el.innerHTML = `<div class="detail-section"><div class="detail-section-title">💬 ความคิดเห็น</div><div id="v4-cm-list" style="font-size:.85rem;color:var(--text-sub)">กำลังโหลด...</div>
    <div style="display:flex;gap:8px;margin-top:10px"><textarea class="input-field" id="v4-cm-in" rows="2" maxlength="2000" placeholder="เขียนความคิดเห็น..."></textarea><button class="btn btn-primary" onclick="WF4.postComment(${tk.id})">ส่ง</button></div></div>`;
  try {
    const { data, error } = await supabase.from('task_comments').select('id, user_id, body, created_at').eq('task_id', tk.id).order('created_at', { ascending: true }).limit(100);
    if (error) throw error; renderComments(data || []);
  } catch (e) { const l = $('v4-cm-list'); if (l) l.textContent = 'โหลดความคิดเห็นไม่สำเร็จ: ' + e.message; }
}
function renderComments(list) {
  const l = $('v4-cm-list'); if (!l) return;
  l.innerHTML = list.length ? list.map(c => `<div class="v4-cm">${avatarHtml(c.user_id, 28)}<div style="flex:1;min-width:0"><div style="font-size:.78rem"><strong>${esc(getUserName(c.user_id))}</strong> <span style="color:var(--text-light)">${fmtDateTime(c.created_at)}</span>${(c.user_id === currentUser.id || isAdmin()) ? ` <a href="#" style="color:var(--danger)" onclick="WF4.delComment(${c.id});return false">ลบ</a>` : ''}</div><div style="color:var(--text-main);font-size:.88rem;margin-top:2px">${nl2br(c.body)}</div></div></div>`).join('') : '<div style="color:var(--text-light)">ยังไม่มีความคิดเห็น</div>';
  l._data = list;
}
WF4.postComment = async id => {
  const inp = $('v4-cm-in'), body = inp.value.trim(); if (!body) return;
  try {
    const { data, error } = await supabase.from('task_comments').insert({ task_id: id, user_id: currentUser.id, body }).select('id, user_id, body, created_at').single();
    if (error) throw error; inp.value = ''; const l = $('v4-cm-list'); renderComments([...(l._data || []), data]);
  } catch (e) { toast(e.message, 'error'); }
};
WF4.delComment = async cid => {
  if (!confirm('ลบความคิดเห็นนี้?')) return;
  const { error } = await supabase.from('task_comments').delete().eq('id', cid); if (error) return toast(error.message, 'error');
  const l = $('v4-cm-list'); renderComments((l._data || []).filter(c => c.id !== cid));
};

const EXT_BADGE = { pending: ['badge-orange', '⏳ รออนุมัติ'], approved: ['badge-green', '✅ อนุมัติแล้ว'], rejected: ['badge-red', '❌ ไม่อนุมัติ'], cancelled: ['badge-cancel', 'ยกเลิก'] };
async function loadExtDetail(tk) {
  const el = $('v4-ext'); if (!el) return;
  try {
    const { data, error } = await supabase.from('task_extension_requests').select('id, requested_by, current_deadline, requested_deadline, reason, status, decision_note, created_at').eq('task_id', tk.id).order('created_at', { ascending: false }).limit(3);
    if (error) throw error; const list = data || [];
    const hasPending = list.some(r => r.status === 'pending');
    const canAsk = tk.assignedTo === currentUser.id && !['done', 'cancelled'].includes(tk.status) && !hasPending;
    if (!list.length && !canAsk) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="detail-section"><div class="detail-section-title">📆 ขอเลื่อนกำหนดส่ง</div>
      ${list.map(r => { const b = EXT_BADGE[r.status];
        return `<div class="v4-ext-card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span style="font-size:.85rem">${fmtDate(r.current_deadline)} → <strong>${fmtDate(r.requested_deadline)}</strong> โดย ${esc(getUserName(r.requested_by))}</span><span class="badge ${b[0]}">${b[1]}</span></div>
        ${r.reason ? `<div style="font-size:.8rem;color:var(--text-sub);margin-top:4px">เหตุผล: ${esc(r.reason)}</div>` : ''}${r.decision_note ? `<div style="font-size:.8rem;color:var(--text-sub)">หมายเหตุหัวหน้า: ${esc(r.decision_note)}</div>` : ''}
        ${(r.status === 'pending' && isManager() && r.requested_by !== currentUser.id) ? `<div style="margin-top:8px;display:flex;gap:6px"><button class="btn btn-success btn-sm" onclick="WF4.decide(${r.id},true,true)">✅ อนุมัติ</button><button class="btn btn-danger btn-sm" onclick="WF4.decide(${r.id},false,true)">❌ ไม่อนุมัติ</button></div>` : ''}</div>`; }).join('')}
      ${canAsk ? `<button class="btn btn-secondary btn-sm" onclick="WF4.openExt(${tk.id})">📆 ขอเลื่อนกำหนดส่ง</button>` : ''}</div>`;
  } catch (e) { el.innerHTML = ''; }
}
WF4.openExt = id => {
  const tk = tasksCache.find(x => x.id == id); if (!tk) return;
  $('v4-ext-id').value = id; $('v4-ext-title').textContent = tk.title; $('v4-ext-cur').textContent = fmtDate(tk.deadline);
  $('v4-ext-date').value = ''; $('v4-ext-reason').value = ''; closeModal('modal-task-detail'); openModal('v4-ext-modal');
};
WF4.submitExt = async () => {
  const id = +$('v4-ext-id').value, nd = $('v4-ext-date').value, reason = $('v4-ext-reason').value.trim();
  if (!nd) return toast('เลือกวันที่ต้องการเลื่อนไป', 'warning'); if (!reason) return toast('กรุณาระบุเหตุผล', 'warning');
  showLoading();
  try { const { error } = await supabase.rpc('request_extension', { p_task_id: id, p_new_deadline: nd, p_reason: reason }); if (error) throw error;
    toast('ส่งคำขอเลื่อนกำหนดส่งแล้ว ✅', 'success'); closeModal('v4-ext-modal'); V4.extAt = 0; if (currentPage === 'extensions') loadExtensionsPage(); }
  catch (e) { toast(e.message, 'error'); } finally { hideLoading(); }
};
WF4.decide = async (id, approve, fromDetail) => {
  let note = null; if (!approve) { note = prompt('เหตุผลที่ไม่อนุมัติ (ไม่บังคับ):'); if (note === null) return; }
  else if (!confirm('อนุมัติและเลื่อนกำหนดส่งตามคำขอนี้?')) return;
  showLoading();
  try { const { error } = await supabase.rpc('decide_extension', { p_request_id: id, p_approve: approve, p_note: note || null }); if (error) throw error;
    toast(approve ? 'อนุมัติแล้ว กำหนดส่งถูกเลื่อนให้ ✅' : 'บันทึกการไม่อนุมัติแล้ว', 'success');
    await callAPI('GET_TASKS'); if (fromDetail) closeModal('modal-task-detail'); notifBuilt = false; loadExtensionsPage(); if (currentPage === 'tasks') renderTaskList(); }
  catch (e) { toast(e.message, 'error'); } finally { hideLoading(); }
};
WF4.cancelExt = async id => {
  if (!confirm('ยกเลิกคำขอนี้?')) return;
  const { error } = await supabase.rpc('cancel_extension', { p_request_id: id }); if (error) return toast(error.message, 'error'); loadExtensionsPage();
};

const _vtd = window.viewTaskDetail;
window.viewTaskDetail = async function (id) {
  await _vtd(id);
  const tk = tasksCache.find(x => x.id == id); const body = $('task-detail-body');
  if (!tk || !body || !$('modal-task-detail').classList.contains('open')) return;
  body.insertAdjacentHTML('beforeend', '<div id="v4-sub"></div><div id="v4-ext"></div><div id="v4-cmt"></div>');
  renderSubsDetail(tk); loadExtDetail(tk); loadComments(tk);
};

/* ============================================================
   9) หน้า "คำขอเลื่อน" และ "เหรียญรางวัล"
   ============================================================ */
async function loadExtensionsPage() {
  const el = $('ext-body'); if (!el) return; el.innerHTML = '<div class="empty-state"><p>กำลังโหลด...</p></div>';
  try {
    const { data, error } = await supabase.from('task_extension_requests').select('id, task_id, requested_by, current_deadline, requested_deadline, reason, status, decision_note, created_at, tasks(title, task_code)').order('created_at', { ascending: false }).limit(100);
    if (error) throw error; const rows = data || [], me = currentUser.id;
    const toApprove = rows.filter(r => r.status === 'pending' && r.requested_by !== me), mine = rows.filter(r => r.requested_by === me), hist = rows.filter(r => r.requested_by !== me && r.status !== 'pending').slice(0, 20);
    const card = (r, mode) => { const b = EXT_BADGE[r.status];
      return `<div class="v4-ext-card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div style="font-weight:700;cursor:pointer" onclick="navigate('tasks');setTimeout(()=>viewTaskDetail(${r.task_id}),200)">${esc(r.tasks?.title || 'งาน #' + r.task_id)}</div><span class="badge ${b[0]}">${b[1]}</span></div>
      <div style="font-size:.82rem;color:var(--text-sub);margin-top:4px">${esc(getUserName(r.requested_by))} · ${fmtDate(r.current_deadline)} → <strong>${fmtDate(r.requested_deadline)}</strong> · ขอเมื่อ ${fmtDateTime(r.created_at)}</div>
      ${r.reason ? `<div style="font-size:.84rem;margin-top:6px">💬 ${esc(r.reason)}</div>` : ''}${r.decision_note ? `<div style="font-size:.8rem;color:var(--text-sub);margin-top:4px">หมายเหตุหัวหน้า: ${esc(r.decision_note)}</div>` : ''}
      ${mode === 'approve' ? `<div style="margin-top:10px;display:flex;gap:6px"><button class="btn btn-success btn-sm" onclick="WF4.decide(${r.id},true)">✅ อนุมัติ</button><button class="btn btn-danger btn-sm" onclick="WF4.decide(${r.id},false)">❌ ไม่อนุมัติ</button></div>` : ''}
      ${(mode === 'mine' && r.status === 'pending') ? `<div style="margin-top:10px"><button class="btn btn-warning btn-sm" onclick="WF4.cancelExt(${r.id})">ยกเลิกคำขอ</button></div>` : ''}</div>`; };
    const sec = (t, list, mode, empty) => `<div class="card"><div class="card-header">${t}</div><div class="card-body">${list.length ? list.map(r => card(r, mode)).join('') : `<div style="color:var(--text-sub);font-size:.88rem">${empty}</div>`}</div></div>`;
    el.innerHTML = (isManager() ? sec(`📥 รออนุมัติจากทีม (${toApprove.length})`, toApprove, 'approve', 'ไม่มีคำขอที่รออนุมัติ 🎉') : '')
      + sec('📤 คำขอของฉัน', mine, 'mine', 'คุณยังไม่เคยขอเลื่อนกำหนดส่ง (ขอได้จากหน้ารายละเอียดงาน)')
      + (isManager() ? sec('🕘 ประวัติที่ดำเนินการแล้ว', hist, 'none', 'ยังไม่มีประวัติ') : '');
    const nb = $('nav-badge-ext'); if (nb) { nb.textContent = toApprove.length; nb.style.display = toApprove.length ? '' : 'none'; }
  } catch (e) { el.innerHTML = `<div class="empty-state"><p>${esc(e.message)}<br><small>(ถ้าเพิ่งติดตั้ง ให้ตรวจว่ารัน migration_v4.sql แล้ว)</small></p></div>`; }
}

function computeBadges() {
  const me = currentUser.id, today = todayStr();
  const mine = tasksCache.filter(t => t.assignedTo === me), done = mine.filter(t => t.status === 'done');
  const ad = done.filter(t => t.source === 'assigned' && t.deadline && t.completedAt).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const onTime = t => localDay(t.completedAt) <= t.deadline;
  let mx = 0, cur = 0; ad.forEach(t => { if (onTime(t)) { cur++; mx = Math.max(mx, cur); } else cur = 0; });
  const early = ad.filter(t => localDay(t.completedAt) < t.deadline).length, onN = ad.filter(onTime).length;
  const seven = addDays(-7);
  const late = t => t.deadline && (t.status === 'done' ? (t.completedAt && localDay(t.completedAt) > t.deadline) : t.deadline < today);
  const overdueNow = mine.some(t => t.deadline && t.deadline < today && !['done', 'cancelled'].includes(t.status));
  const recent = mine.filter(t => t.deadline && t.deadline >= seven && t.deadline <= today && t.status !== 'cancelled');
  const clean = !overdueNow && recent.length > 0 && !recent.some(late);
  const pts = Math.max((usersCache.find(u => u.id === me) || {}).points || 0, currentUser.points || 0);
  const B = (id, icon, name, desc, c, t) => ({ id, icon, name, desc, cur: Math.min(c, t), target: t });
  return [
    B('first', '🎯', 'งานแรกสำเร็จ', 'ส่งงานเสร็จครบ 1 งาน', done.length, 1),
    B('d10', '🔟', 'มือทำงาน', 'ส่งงานเสร็จครบ 10 งาน', done.length, 10),
    B('d50', '💯', 'ตัวแม่งานหนัก', 'ส่งงานเสร็จครบ 50 งาน', done.length, 50),
    B('s5', '🔥', 'ไฟลุก', 'ส่งตรงเวลาติดต่อกัน 5 งาน', mx, 5),
    B('s10', '⏱️', 'ตรงเวลาเป็นเลิศ', 'ส่งตรงเวลาติดต่อกัน 10 งาน', mx, 10),
    B('clean7', '🧹', 'ไร้งานค้าง 7 วัน', 'ไม่มีงานเกินกำหนดเลยตลอด 7 วันล่าสุด', clean ? 1 : 0, 1),
    B('early5', '🌅', 'นักส่งก่อนเวลา', 'ส่งงานก่อนกำหนดอย่างน้อย 1 วัน 5 งาน', early, 5),
    B('perfect', '👑', 'ตรงเวลา 100%', 'ส่งตรงเวลาทุกงาน (ขั้นต่ำ 10 งานมอบหมาย)', (ad.length >= 10 && onN === ad.length) ? 1 : 0, 1),
    B('crit3', '🛡️', 'นักดับเพลิง', 'ปิดงาน Critical สำเร็จ 3 งาน', done.filter(t => t.priority === 'Critical').length, 3),
    B('self10', '✍️', 'นักบันทึก', 'บันทึกงานเองที่เสร็จแล้ว 10 งาน', done.filter(t => t.source === 'self').length, 10),
    B('p500', '⭐', 'EXP 500', 'สะสมคะแนนครบ 500', pts, 500),
    B('p1000', '🌟', 'EXP 1,000', 'สะสมคะแนนครบ 1,000', pts, 1000)
  ].concat([{ _streak: mx, _cur: cur }]);
}
function loadBadgesPage() {
  const el = $('badges-body'); if (!el) return; const all = computeBadges(), meta = all.pop(), un = all.filter(b => b.cur >= b.target).length;
  el.innerHTML = `<div class="card"><div class="card-body" style="display:flex;gap:20px;flex-wrap:wrap;align-items:center"><div style="font-size:2.4rem">🎖️</div><div><div style="font-size:.82rem;color:var(--text-sub)">ปลดล็อกแล้ว</div><div style="font-size:1.8rem;font-weight:900;color:var(--primary)">${un}/${all.length}</div></div><div><div style="font-size:.82rem;color:var(--text-sub)">ส่งตรงเวลาติดต่อกัน (ปัจจุบัน / สูงสุด)</div><div style="font-size:1.4rem;font-weight:800;color:var(--warning)">🔥 ${meta._cur} / ${meta._streak}</div></div></div></div>
  <div class="v4-badge-grid">${all.map(b => { const ok = b.cur >= b.target; return `<div class="v4-badge ${ok ? '' : 'locked'}"><div class="v4-bi">${b.icon}</div><div style="font-weight:700">${b.name}</div><div style="font-size:.78rem;color:var(--text-sub);margin:4px 0 10px">${b.desc}</div>${ok ? '<span class="badge badge-green">✅ ปลดล็อกแล้ว</span>' : `<div class="progress-bar-bg" style="height:7px"><div class="progress-bar-fill" style="width:${Math.round(b.cur / b.target * 100)}%"></div></div><div style="font-size:.72rem;color:var(--text-sub);margin-top:4px">${b.cur.toLocaleString()} / ${b.target.toLocaleString()}</div>`}</div>`; }).join('')}</div>`;
}
function checkBadgeUnlocks() {
  const key = 'wf_badges_' + currentUser.id, all = computeBadges(); all.pop(); const un = all.filter(b => b.cur >= b.target).map(b => b.id), raw = localStorage.getItem(key);
  if (raw === null) { localStorage.setItem(key, JSON.stringify(un)); return; }
  const old = JSON.parse(raw), nw = un.filter(i => !old.includes(i)); if (!nw.length) return;
  localStorage.setItem(key, JSON.stringify([...new Set([...old, ...un])])); const b = all.find(x => x.id === nw[0]);
  showCelebration(`ปลดล็อกเหรียญใหม่! ${b.icon}`, `"${b.name}" — ${b.desc}${nw.length > 1 ? ` (และอีก ${nw.length - 1} เหรียญ)` : ''}`, b.icon);
}
const _ld = window.loadDashboard; window.loadDashboard = async function () { await _ld(); try { checkBadgeUnlocks(); } catch (e) {} };

/* ---------- แจ้งเตือนคำขอเลื่อน (ต่อท้าย buildNotifications เดิม 1 query เล็กๆ) ---------- */
const _bn = window.buildNotifications;
window.buildNotifications = async function () {
  await _bn();
  try {
    const { data } = await supabase.from('task_extension_requests').select('id, task_id, requested_by, requested_deadline, status, decided_at').order('created_at', { ascending: false }).limit(40);
    const add = [], me = currentUser.id, since = Date.now() - 3 * 86400000;
    (data || []).forEach(r => {
      const tt = (tasksCache.find(t => t.id === r.task_id) || {}).title || ('งาน #' + r.task_id);
      if (r.status === 'pending' && r.requested_by !== me) add.push({ id: 'ext_' + r.id, type: 'task', urgent: false, icon: '📆', iconBg: '#FEF3C7', title: `ขอเลื่อนกำหนดส่ง: ${tt}`, sub: `${getUserName(r.requested_by)} ขอเลื่อนเป็น ${fmtDate(r.requested_deadline)} — แตะเพื่อพิจารณา`, time: todayStr(), action: () => navigate('extensions') });
      else if (r.requested_by === me && ['approved', 'rejected'].includes(r.status) && r.decided_at && new Date(r.decided_at) > since) add.push({ id: 'extd_' + r.id, type: 'task', urgent: false, icon: r.status === 'approved' ? '✅' : '❌', iconBg: r.status === 'approved' ? '#ECFDF5' : '#FEE2E2', title: `คำขอเลื่อน${r.status === 'approved' ? 'ได้รับอนุมัติ' : 'ไม่ได้รับอนุมัติ'}: ${tt}`, sub: 'แตะเพื่อดูรายละเอียด', time: todayStr(), action: () => { navigate('tasks'); setTimeout(() => viewTaskDetail(r.task_id), 250); } });
    });
    const pend = (data || []).filter(r => r.status === 'pending' && r.requested_by !== me).length;
    const nb = $('nav-badge-ext'); if (nb) { nb.textContent = pend; nb.style.display = pend ? '' : 'none'; }
    if (add.length) { notifData = [...notifData, ...add].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)).slice(0, 40); updateNotifBadge(true); }
  } catch (e) { /* ยังไม่ได้รัน migration ก็ไม่ให้ระบบเดิมล้ม */ }
};

/* ============================================================
   10) INJECT UI (เรียกหลัง buildLayout ทุกครั้ง) + i18n + Help
   ============================================================ */
Object.assign(i18n.th, { 'nav.badges': 'เหรียญรางวัล', 'page.badges': 'เหรียญรางวัล', 'nav.extensions': 'คำขอเลื่อนกำหนดส่ง', 'page.extensions': 'คำขอเลื่อนกำหนดส่ง' });
Object.assign(i18n.en, { 'nav.badges': 'Achievements', 'page.badges': 'Achievements', 'nav.extensions': 'Extension Requests', 'page.extensions': 'Extension Requests' });

const _nav = window.navigate;
window.navigate = function (p) { _nav(p); if (p === 'badges') loadBadgesPage(); if (p === 'extensions') loadExtensionsPage(); };

const _bl = window.buildLayout;
window.buildLayout = function () { _bl(); injectUI(); };
function injectUI() {
  const kpi = document.querySelector('.sidebar-nav .nav-item[data-page="kpi"]');
  if (kpi) kpi.insertAdjacentHTML('afterend', `
    <div class="nav-item" onclick="navigate('badges')" data-page="badges"><span class="nav-icon">🎖️</span><span>${t('nav.badges')}</span></div>
    <div class="nav-item" onclick="navigate('extensions')" data-page="extensions"><span class="nav-icon">📆</span><span>${t('nav.extensions')}</span><span class="nav-badge" id="nav-badge-ext" style="display:none">0</span></div>
    <div class="nav-item" onclick="WF4.openCmd()"><span class="nav-icon">🔍</span><span>ค้นหาด่วน (Ctrl+K)</span></div>`);
  $('content').insertAdjacentHTML('beforeend', `
    <div class="page" id="page-badges"><div class="page-header"><div><div class="page-title">🎖️ ${t('nav.badges')}</div><div class="page-sub">ปลดล็อกจากผลงานจริงของคุณ — ไม่รีเซ็ต</div></div></div><div id="badges-body"></div></div>
    <div class="page" id="page-extensions"><div class="page-header"><div><div class="page-title">📆 ${t('nav.extensions')}</div><div class="page-sub">ขอเลื่อนกำหนดส่งงาน และอนุมัติคำขอของทีม</div></div></div><div id="ext-body"></div></div>`);
  const pdf = document.querySelector('#page-tasks button[onclick="openPdfExportModal()"]');
  if (pdf) pdf.insertAdjacentHTML('beforebegin', `<button class="btn btn-secondary" id="v4-view-btn" onclick="WF4.toggleView()" title="สลับมุมมอง รายการ / Kanban">🗂</button><button class="btn btn-secondary" onclick="WF4.exportTasksXLSX()" title="Export Excel">📗</button>`);
  const tl = $('task-list'); if (tl && !$('kanban-board')) tl.insertAdjacentHTML('afterend', '<div id="kanban-board" style="display:none"></div>');
  const csv = document.querySelector('#page-reports button[onclick="exportReportCSV()"]');
  if (csv) csv.insertAdjacentHTML('afterend', `<button class="btn btn-secondary" onclick="WF4.exportReportXLSX()">📗 Export Excel</button>`);
}

/* ---------- Help guide (ปุ่ม ?) ---------- */
function extendHelp() {
  const add = (k, items, tip) => { const h = PAGE_HELP[k]; if (!h || h._v4) return; h.items.push(...items); h._v4 = 1; if (tip) h.tip = (h.tip ? h.tip + ' | ' : '') + tip; };
  add('dashboard', ['🔍 กด Ctrl+K (หรือเมนู "ค้นหาด่วน") เพื่อค้นหางาน/พนักงาน/ข้ามหน้าได้ทันที', '⚡ ปุ่มกลมมุมขวาล่าง = Quick Add พิมพ์ประโยคเดียวสร้างงาน', '🌙/☀️ ปุ่มมุมบนสลับโหมดมืด/สว่าง (จำค่าไว้ในเครื่อง)', '🎖️ ปลดล็อกเหรียญใหม่จะมีพลุฉลองให้อัตโนมัติ']);
  add('tasks', ['🗂 ปุ่มสลับมุมมอง "รายการ ↔ Kanban" — ใน Kanban ลากการ์ดไปคอลัมน์ "เสร็จสิ้น" หรือกดปุ่ม ✅ ส่งงาน (ใช้บนมือถือ) ได้', '☑ รายการย่อย: เพิ่มได้ในฟอร์มสร้าง/แก้ไขงาน (สูงสุด 20 รายการ) แล้วติ๊กความคืบหน้าในหน้ารายละเอียด', '📑 แม่แบบงาน: ในฟอร์มกด "แม่แบบ" เพื่อโหลด/บันทึกงานที่ใช้บ่อย (หัวหน้าเลือกแชร์ให้ทุกคนได้)', '💬 ความคิดเห็น: คุยกันใต้งานได้ในหน้ารายละเอียด', '📆 ขอเลื่อนกำหนดส่ง: ผู้รับผิดชอบกดในหน้ารายละเอียด หัวหน้าอนุมัติ/ไม่อนุมัติ', '📗 ปุ่ม Export Excel ส่งออกตามตัวกรองปัจจุบัน (มีชีตสรุปรายคน)', '⚡ Quick Add ตัวอย่าง: "ส่งรายงาน พรุ่งนี้ high 17:00 @สมชาย #ประชุม 20pt" รองรับ วันนี้/พรุ่งนี้/มะรืน/อีก 3 วัน/วันจันทร์/สัปดาห์หน้า/25/12']);
  add('reports', ['📗 "Export Excel" ได้ไฟล์ .xlsx 2 ชีต (สรุป + รายการงาน)']);
  add('profile', ['🌙 โหมดมืดสลับได้ที่ปุ่มมุมบนของทุกหน้า']);
  PAGE_HELP.badges = { intro: 'เหรียญรางวัล (Achievement) ปลดล็อกจากข้อมูลงานจริงของคุณ', items: ['แต่ละเหรียญมีแถบความคืบหน้าบอกว่าเหลืออีกเท่าไร', 'ตัวอย่าง: ส่งตรงเวลาติด 10 งาน, ไร้งานค้าง 7 วัน, ปิดงาน Critical 3 งาน', '"ส่งตรงเวลาติดต่อกัน" นับเฉพาะงานมอบหมายที่มีกำหนดส่ง เรียงตามเวลาที่ส่งจริง', 'คำนวณจากข้อมูลที่โหลดไว้แล้ว ไม่ใช้โควต้าฐานข้อมูลเพิ่ม'], tip: 'เหรียญที่ปลดล็อกแล้วจะไม่หายไป แม้ภายหลังสถิติเปลี่ยน' };
  PAGE_HELP.extensions = { intro: 'ศูนย์รวมคำขอเลื่อนกำหนดส่งงาน', items: ['พนักงาน: เปิดงาน → กด "📆 ขอเลื่อนกำหนดส่ง" ระบุวันที่ใหม่และเหตุผล (ขอได้ทีละ 1 คำขอต่องาน)', 'หัวหน้า/Admin: เห็นคำขอของทีมในส่วน "รออนุมัติ" กดอนุมัติแล้วกำหนดส่งของงานจะเปลี่ยนให้อัตโนมัติ', 'ผู้ขอยกเลิกคำขอที่ยังรออยู่ได้', 'ทุกการอนุมัติถูกบันทึกใน Audit Log'], tip: 'ถ้าอนุมัติก่อนครบกำหนด งานจะไม่ถูกนับว่าเกินกำหนด/ไม่โดนหักคะแนนล่าช้า' };
}

/* ============================================================
   11) BOOTSTRAP — สร้าง DOM ครั้งเดียวตอนโหลดไฟล์
   ============================================================ */
const style = document.createElement('style'); style.textContent = DARK_CSS; document.head.appendChild(style);
document.body.insertAdjacentHTML('beforeend', `
<button id="v4-fab" onclick="WF4.openQuick('')" title="Quick Add">⚡</button>
<div id="v4-cmd" onclick="if(event.target===this)WF4.closeCmd()"><div class="v4-box"><input class="v4-in" id="v4-cmd-in" placeholder="ค้นหางาน / พนักงาน / หน้า / คำสั่ง...  (Esc ปิด)" autocomplete="off" /><div class="v4-list" id="v4-cmd-list"></div></div></div>
<div id="v4-qa-ov" onclick="if(event.target===this)WF4.closeQuick()"><div class="v4-box"><div style="padding:14px 18px 0;font-weight:700">⚡ Quick Add</div><input class="v4-in" id="v4-qa-in" placeholder="เช่น ส่งรายงาน พรุ่งนี้ high 17:00" autocomplete="off" /><div style="padding:10px 18px" id="v4-qa-prev"></div><div style="padding:0 18px 16px;display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-secondary" onclick="WF4.closeQuick()">ยกเลิก</button><button class="btn btn-primary" onclick="WF4.submitQuick()">เปิดฟอร์ม ↵</button></div></div></div>
<div class="modal-overlay modal-center" id="v4-tpl-modal"><div class="modal" style="max-width:480px"><div class="modal-header"><div class="modal-title">📑 แม่แบบงาน</div><button class="modal-close" onclick="closeModal('v4-tpl-modal')">✕</button></div><div class="modal-body">
  <div id="v4-tpl-list" style="max-height:34vh;overflow-y:auto;margin-bottom:14px"></div>
  <div style="border-top:1px solid var(--border);padding-top:14px"><label class="input-label">💾 บันทึกฟอร์มงานปัจจุบันเป็นแม่แบบ</label><input type="text" class="input-field" id="v4-tpl-name" maxlength="80" placeholder="ชื่อแม่แบบ เช่น ตรวจเช็คเครื่องจักรประจำสัปดาห์" />
  <label id="v4-tpl-shared-wrap" style="display:flex;gap:8px;align-items:center;font-size:.84rem;margin-top:8px"><input type="checkbox" id="v4-tpl-shared" /> แชร์ให้ทุกคนใช้ได้ (หัวหน้า/Admin)</label>
  <button class="btn btn-primary" style="margin-top:10px" onclick="WF4.saveTpl()">💾 บันทึกแม่แบบ</button></div></div></div></div>
<div class="modal-overlay modal-center" id="v4-ext-modal"><div class="modal" style="max-width:440px"><div class="modal-header"><div class="modal-title">📆 ขอเลื่อนกำหนดส่ง</div><button class="modal-close" onclick="closeModal('v4-ext-modal')">✕</button></div><div class="modal-body">
  <input type="hidden" id="v4-ext-id" /><div style="font-weight:700;color:var(--primary);margin-bottom:4px" id="v4-ext-title"></div><div style="font-size:.84rem;color:var(--text-sub);margin-bottom:14px">กำหนดส่งเดิม: <strong id="v4-ext-cur"></strong></div>
  <div class="input-group"><label class="input-label">วันที่ต้องการเลื่อนไป *</label><input type="date" class="input-field" id="v4-ext-date" /></div>
  <div class="input-group"><label class="input-label">เหตุผล *</label><textarea class="input-field" id="v4-ext-reason" rows="3" maxlength="500"></textarea></div></div>
  <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('v4-ext-modal')">ยกเลิก</button><button class="btn btn-primary" onclick="WF4.submitExt()">ส่งคำขอ</button></div></div></div>`);
enhanceAllDateInputs($('v4-ext-modal'));

// แทรกตัวแก้ Subtasks + ปุ่มแม่แบบ ลงในฟอร์มงานเดิม
$('task-link').closest('.input-group').insertAdjacentHTML('beforebegin', `<div class="input-group"><label class="input-label">☑ รายการย่อย (Checklist)</label><div id="v4-sub-list"></div><button type="button" class="btn btn-secondary btn-sm" onclick="WF4.subAdd()">➕ เพิ่มรายการย่อย</button></div>`);
$('task-edit-id').insertAdjacentHTML('afterend', `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button type="button" class="btn btn-secondary btn-sm" onclick="WF4.openTemplates()">📑 แม่แบบงาน (ใช้ / บันทึก)</button></div>`);
document.querySelector('.topbar-actions').insertAdjacentHTML('afterbegin', `<button class="topbar-btn" id="v4-theme-btn" onclick="WF4.toggleTheme()" title="สลับโหมดมืด/สว่าง">🌙</button>`);

$('v4-cmd-in').addEventListener('input', () => { cmdSel = 0; paletteRender(); });
$('v4-cmd-in').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = Math.min(cmdItems.length - 1, cmdSel + 1); paletteRender(); $('v4-cmd-list').querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = Math.max(0, cmdSel - 1); paletteRender(); $('v4-cmd-list').querySelector('.sel')?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter') { e.preventDefault(); paletteRun(cmdSel); }
});
$('v4-qa-in').addEventListener('input', quickPreview);
$('v4-qa-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); WF4.submitQuick(); } });
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('v4-cmd').classList.contains('open') ? WF4.closeCmd() : WF4.openCmd(); }
  else if (e.key === 'Escape') { WF4.closeCmd(); WF4.closeQuick(); }
});

extendHelp();
applyTheme(localStorage.getItem('wf_theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
console.log('%cWorkFlow Pro v4 add-on loaded', 'color:#0F766E;font-weight:bold');
})();
