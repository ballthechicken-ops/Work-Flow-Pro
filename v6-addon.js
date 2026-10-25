/* =====================================================================
   WorkFlow Pro v6.0 add-on  (โหลดหลัง v5-addon.js)
   - ฟอร์มสร้าง/แก้ไขงาน = การ์ดกลางจอ + 4 แท็บ (ID ของ input เดิมทุกตัวไม่เปลี่ยน)
   - เมนูซ้าย: หุบ/ขยายทั้งแถบ + หุบ/ขยายรายหมวด + จัดหมวดใหม่
   - โมดัลอื่นบนคอมเป็นการ์ดกลางจอ | donut/dark mode แก้เพิ่ม
   - ลบ <script src="v6-addon.js"> = กลับเป็นหน้าตาเดิม (ข้อมูลไม่เกี่ยว)
   ===================================================================== */
(function () {
'use strict';
if (!window.WF4) { console.warn('[v6] ไม่พบ v4-addon.js — ข้าม v6'); return; }

const $ = id => document.getElementById(id);
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return null; };
const WF6 = window.WF6 = {};

/* ============================================================
   0) CSS
   ============================================================ */
const css = document.createElement('style');
css.textContent = `
/* ---------- โมดัลบนคอม = การ์ดกลางจอ ---------- */
@media (min-width:901px){
  .modal-overlay{align-items:center;padding:24px}
  .modal{border-radius:20px;max-width:600px;width:100%;max-height:90vh;box-shadow:0 24px 70px rgba(15,36,96,.35);animation:popIn .28s cubic-bezier(.34,1.56,.64,1)}
  #modal-user .modal{max-width:700px}
  #modal-task .modal{max-width:780px}
}
/* ---------- ฟอร์มงาน: คอลัมน์ + ส่วนหัว/ท้ายตรึง ---------- */
#modal-task .modal{display:flex;flex-direction:column;overflow:hidden}
#modal-task .modal-header{position:static;flex-shrink:0}
#modal-task .modal-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
#modal-task .modal-footer{flex-shrink:0;background:var(--bg-card)}
@media (min-width:901px){#modal-task .modal-body{min-height:380px}}
.v6-tabs{display:flex;gap:2px;padding:0 12px;border-bottom:1px solid var(--border);background:var(--bg-card);overflow-x:auto;flex-shrink:0;scrollbar-width:none}
.v6-tabs::-webkit-scrollbar{display:none}
.v6-tab{display:inline-flex;align-items:center;gap:6px;padding:11px 14px;background:none;color:var(--text-sub);font-size:.86rem;font-weight:600;border-bottom:3px solid transparent;white-space:nowrap;min-height:46px;transition:color .15s}
.v6-tab:hover{color:var(--primary)}
.v6-tab.on{color:var(--primary);border-bottom-color:var(--primary)}
.v6-err{display:none;width:8px;height:8px;border-radius:50%;background:var(--danger)}
.v6-tab.bad .v6-err{display:inline-block}
.v6-pane{display:none}
.v6-pane.on{display:block;animation:fadeIn .2s ease}
/* ---------- เมนูซ้าย: หมวดหุบ/ขยายได้ ---------- */
.v6-grp-h{width:100%;display:flex;align-items:center;gap:10px;padding:14px 18px 6px;background:none;color:rgba(255,255,255,.5);font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:left}
.v6-grp-h:hover{color:#fff}
.v6-gi{font-size:.9rem;width:22px;text-align:center;flex-shrink:0}
.v6-gl{flex:1}
.v6-car{font-size:.8rem;transition:transform .2s}
.v6-grp.collapsed .v6-car{transform:rotate(-90deg)}
.v6-grp.collapsed .v6-gb{display:none}
.v6-grp.has-active .v6-grp-h{color:var(--cyan)}
.v6-dot{display:none;width:8px;height:8px;border-radius:50%;background:var(--danger);flex-shrink:0}
.v6-grp.collapsed .v6-dot.on{display:inline-block}
#v6-sb-btn{display:none;font-weight:800}
#sidebar{transition:transform var(--transition),width .2s ease}
#content{transition:margin-left .2s ease}
@media (min-width:901px){
  #v6-sb-btn{display:flex}
  body.v6-collapsed{--sidebar-w:72px}
  body.v6-collapsed .sidebar-header{justify-content:center;padding:20px 8px 16px}
  body.v6-collapsed .sidebar-header>div:last-child{display:none}
  body.v6-collapsed .v6-grp-h{display:none}
  body.v6-collapsed .v6-gb{display:block!important}
  body.v6-collapsed .v6-grp+.v6-grp{border-top:1px solid rgba(255,255,255,.12);margin-top:6px;padding-top:6px}
  body.v6-collapsed .nav-item{justify-content:center;padding:12px 0}
  body.v6-collapsed .nav-item>span:not(.nav-icon):not(.nav-badge){display:none}
  body.v6-collapsed .nav-item .nav-badge{position:absolute;top:5px;right:10px;margin:0;font-size:.6rem;padding:1px 5px}
  body.v6-collapsed .sidebar-footer{padding:12px 8px}
  body.v6-collapsed .user-info{justify-content:center}
  body.v6-collapsed .user-info>div:last-child{display:none}
  body.v6-collapsed .btn-logout span:last-child{display:none}
}
/* ---------- Dark mode: จุดที่ v4 ครอบไม่ถึง ---------- */
[data-theme="dark"] .file-chip,[data-theme="dark"] .adv-tag,[data-theme="dark"] .badge-blue,[data-theme="dark"] .badge-navy{background:#12263d;color:#7DD3FC;border-color:#233152}
[data-theme="dark"] .badge-green{background:#0f2a1e;color:#4ADE80}
[data-theme="dark"] .badge-red{background:#2a1517;color:#FCA5A5}
[data-theme="dark"] .badge-orange{background:#2b1d0e;color:#FDBA74}
[data-theme="dark"] .badge-cancel{background:#1c2a44;color:#CBD5E1}
[data-theme="dark"] .btn-danger{background:#2a1517;border-color:#5b1f24;color:#FCA5A5}
[data-theme="dark"] .btn-warning{background:#2b1d0e;border-color:#5b4217;color:#FCD34D}
[data-theme="dark"] .deduction-warning,[data-theme="dark"] .points-hint-box{background:#2b1d0e;border-color:#5b4217;color:#FCD34D}
[data-theme="dark"] .help-tip{background:#0f2a1e;border-color:#14532d;color:#86EFAC}
[data-theme="dark"] .cal-event.task{background:#0f2a1e;color:#86EFAC}
[data-theme="dark"] .cal-event.shift{background:#12263d;color:#7DD3FC}
[data-theme="dark"] .paste-zone:hover,[data-theme="dark"] .paste-zone.drag-over{background:#12263d}
[data-theme="dark"] .modal-footer,[data-theme="dark"] .detail-action-bar{background:var(--bg-card)}
[data-theme="dark"] .v6-tab.on{color:var(--primary-light);border-bottom-color:var(--primary-light)}
[data-theme="dark"] .v6-tab:hover{color:var(--primary-light)}
`;
document.head.appendChild(css);

/* ============================================================
   1) ฟอร์มงาน: 4 แท็บ
   ============================================================ */
const TABS = [['📝', 'ข้อมูลหลัก'], ['📅', 'กำหนดการ'], ['☑', 'รายการย่อย'], ['📎', 'ไฟล์ / รูป']];
let bar = null, panes = [], tabNow = 0, showErr = false;

function setTab(i) {
  if (!bar) return;
  tabNow = i;
  bar.querySelectorAll('.v6-tab').forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; });
  panes.forEach((p, k) => p.classList.toggle('on', k === i));
  const body = document.querySelector('#modal-task .modal-body'); if (body) body.scrollTop = 0;
}
WF6.tab = setTab;

function problems() {
  const p = [false, false, false, false];
  if (!($('task-title')?.value || '').trim()) p[0] = true;
  if (!$('task-deadline')?.value && $('task-source')?.value === 'assigned') p[1] = true;
  return p;
}
function refreshDots() {
  if (!bar) return;
  const p = showErr ? problems() : [false, false, false, false];
  bar.querySelectorAll('.v6-tab').forEach((b, i) => b.classList.toggle('bad', p[i]));
}

function buildTaskTabs() {
  const modal = document.querySelector('#modal-task .modal'), body = modal && modal.querySelector('.modal-body');
  if (!body || body.dataset.v6) return;
  const grp = id => $(id)?.closest('.input-group');
  const ptsG = grp('task-points'), srcG = $('group-task-source'), asgG = $('group-task-assign');
  const oldRow = ptsG && ptsG.closest('.input-row');

  const rowPts = document.createElement('div'); rowPts.className = 'input-row'; if (ptsG) rowPts.appendChild(ptsG);
  const rowSrc = document.createElement('div'); rowSrc.className = 'input-row';
  [srcG, asgG].filter(Boolean).forEach(e => rowSrc.appendChild(e));
  if (oldRow && !oldRow.children.length) oldRow.remove();

  const tplBtn = body.querySelector('button[onclick*="openTemplates"]');
  const sets = [
    [grp('task-title'), grp('task-desc'), $('task-category')?.closest('.input-row'), rowPts],
    [rowSrc, $('task-start-date')?.closest('.input-row'), $('task-deadline')?.closest('.input-row'), $('v5-rec-group')],
    [tplBtn && tplBtn.parentElement, $('v4-sub-list')?.closest('.input-group')],
    [grp('task-link'), grp('task-image-file')]
  ];
  panes = sets.map((items, i) => {
    const p = document.createElement('div'); p.className = 'v6-pane'; p.dataset.i = i; p.setAttribute('role', 'tabpanel');
    items.filter(Boolean).forEach(e => p.appendChild(e)); return p;
  });
  // องค์ประกอบที่ไม่รู้จัก (เช่น ที่ addon อื่นเพิ่มมา) ให้ไปอยู่แท็บแรก ไม่ให้หาย
  [...body.children].forEach(c => { if (c.id !== 'task-edit-id') panes[0].appendChild(c); });
  panes.forEach(p => body.appendChild(p));

  bar = document.createElement('div'); bar.className = 'v6-tabs'; bar.setAttribute('role', 'tablist');
  bar.innerHTML = TABS.map((t, i) => `<button type="button" class="v6-tab" role="tab" data-i="${i}"><span>${t[0]}</span><span>${t[1]}</span><i class="v6-err" title="ยังกรอกไม่ครบ"></i></button>`).join('');
  bar.addEventListener('click', e => { const b = e.target.closest('.v6-tab'); if (b) setTab(+b.dataset.i); });
  bar.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = (tabNow + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length; setTab(n); bar.children[n].focus();
  });
  modal.insertBefore(bar, body);
  body.dataset.v6 = '1';
  body.addEventListener('input', refreshDots); body.addEventListener('change', refreshDots);
  setTab(0);
}

// เปิดฟอร์มทุกครั้ง → กลับแท็บแรก / ตอนบันทึกแล้วขาดข้อมูล → พาไปแท็บที่มีปัญหา
['openNewTaskModal', 'editTask', 'duplicateTask'].forEach(name => {
  const orig = window[name]; if (typeof orig !== 'function') return;
  window[name] = function () { showErr = false; setTab(0); const r = orig.apply(this, arguments); refreshDots(); return r; };
});
const _save6 = window.saveTask;
if (typeof _save6 === 'function') window.saveTask = async function () {
  showErr = true; const p = problems(); refreshDots();
  const f = p.indexOf(true); if (f >= 0) setTab(f);
  return _save6.apply(this, arguments);
};

/* ============================================================
   2) เมนูซ้าย: จัดหมวด + หุบ/ขยาย
   ============================================================ */
const GROUPS = [
  { k: 'main',  ic: '📌', th: 'งานของฉัน',        en: 'My Work' },
  { k: 'perf',  ic: '🏆', th: 'ผลงานและรางวัล',   en: 'Performance' },
  { k: 'team',  ic: '👥', th: 'ทีม',              en: 'Team' },
  { k: 'admin', ic: '⚙️', th: 'ผู้ดูแลระบบ',      en: 'Admin' },
  { k: 'tools', ic: '🧰', th: 'เครื่องมือ',        en: 'Tools' }
];
const SIG = { '@rec': 'WF5.openRec', '@cmd': 'WF4.openCmd', '@keys': 'WF5.openKeys' };
let navObs = null;

function layoutFor() {
  const mgr = isManager();
  return {
    main:  ['dashboard', 'tasks', 'calendar', '@rec'].concat(mgr ? [] : ['extensions']),   // พนักงานทั่วไปต้องเข้าถึง "คำขอของฉัน" ได้
    perf:  ['kpi', 'badges', 'salary'],
    team:  mgr ? ['extensions', 'org', 'deductions'] : [],
    admin: ['users', 'reports', 'audit'],
    tools: ['@cmd', '@keys', 'profile']
  };
}
function findItem(items, key) {
  if (key[0] === '@') return items.find(n => (n.getAttribute('onclick') || '').includes(SIG[key]));
  return items.find(n => n.dataset.page === key);
}
function updateDots() {
  document.querySelectorAll('#sidebar .v6-grp').forEach(g => {
    const has = [...g.querySelectorAll('.nav-badge')].some(b => b.style.display !== 'none' && (parseInt(b.textContent) || 0) > 0);
    g.querySelector('.v6-dot')?.classList.toggle('on', has);
    g.classList.toggle('has-active', !!g.querySelector('.nav-item.active'));
  });
}
WF6.toggleGroup = k => {
  const el = document.querySelector(`#sidebar .v6-grp[data-g="${k}"]`); if (!el) return;
  const c = el.classList.toggle('collapsed');
  const st = store('wf6_nav') || {}; st[k] = c ? 1 : 0; store('wf6_nav', st);
  el.querySelector('.v6-grp-h').setAttribute('aria-expanded', String(!c)); updateDots();
};
function regroupNav() {
  const nav = document.querySelector('#sidebar .sidebar-nav'); if (!nav) return;
  const items = [...nav.querySelectorAll('.nav-item')], used = new Set(), lay = layoutFor(), st = store('wf6_nav') || {};
  const lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en' : 'th';
  const frag = document.createDocumentFragment();
  GROUPS.forEach(g => {
    const nodes = (lay[g.k] || []).map(k => findItem(items, k)).filter(Boolean);
    nodes.forEach(n => used.add(n));
    if (g.k === 'tools') items.filter(n => !used.has(n)).forEach(n => { nodes.push(n); used.add(n); });   // ไม่ให้เมนูแปลกปลอมหาย
    if (!nodes.length) return;
    const box = document.createElement('div'); box.className = 'v6-grp' + (st[g.k] ? ' collapsed' : ''); box.dataset.g = g.k;
    box.innerHTML = `<button type="button" class="v6-grp-h" aria-expanded="${!st[g.k]}"><span class="v6-gi">${g.ic}</span><span class="v6-gl">${g[lang]}</span><i class="v6-dot"></i><span class="v6-car">▾</span></button><div class="v6-gb"></div>`;
    box.querySelector('.v6-grp-h').addEventListener('click', () => WF6.toggleGroup(g.k));
    const gb = box.querySelector('.v6-gb');
    nodes.forEach(n => { const lab = n.querySelector('span:not(.nav-icon):not(.nav-badge)'); if (lab) n.title = lab.textContent.trim(); gb.appendChild(n); });
    frag.appendChild(box);
  });
  nav.innerHTML = ''; nav.appendChild(frag);
  if (navObs) navObs.disconnect();
  navObs = new MutationObserver(updateDots);
  nav.querySelectorAll('.nav-badge').forEach(b => navObs.observe(b, { attributes: true, attributeFilter: ['style'], childList: true, characterData: true, subtree: true }));
  updateDots();
}
WF6.toggleSidebar = () => {
  const c = document.body.classList.toggle('v6-collapsed'); store('wf6_sb', c ? 1 : 0);
  const b = $('v6-sb-btn'); if (b) b.textContent = c ? '»' : '«';
  setTimeout(() => window.dispatchEvent(new Event('resize')), 260);      // ให้กราฟปรับขนาดตาม
};

const _bl6 = window.buildLayout;
window.buildLayout = function () {
  _bl6();
  try { regroupNav(); } catch (e) { console.warn('[v6] regroupNav', e); }
  document.querySelectorAll('.sidebar-header .version-badge').forEach(b => { b.textContent = 'v6.0'; });
};
const _nav6 = window.navigate;
window.navigate = function (p) { _nav6(p); updateDots(); };

/* ============================================================
   3) Donut chart ตามธีม (วาดใหม่เมื่อสลับ สว่าง/มืด)
   ============================================================ */
let lastStats = null;
const _dd = window.drawDonut;
if (typeof _dd === 'function') {
  window.drawDonut = function (s) { lastStats = s; return _dd.apply(this, arguments); };
  new MutationObserver(() => { if (lastStats && $('donut-canvas')) { try { _dd(lastStats); } catch (e) {} } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/* ============================================================
   4) BOOTSTRAP
   ============================================================ */
buildTaskTabs();
const mt = $('menu-toggle');
if (mt) mt.insertAdjacentHTML('afterend', '<button class="topbar-btn" id="v6-sb-btn" onclick="WF6.toggleSidebar()" title="หุบ/ขยายเมนูด้านข้าง" aria-label="หุบหรือขยายเมนูด้านข้าง">«</button>');
if (store('wf6_sb')) { document.body.classList.add('v6-collapsed'); const b = $('v6-sb-btn'); if (b) b.textContent = '»'; }
document.querySelectorAll('.login-logo .version-badge').forEach(b => { b.textContent = 'NEW v6.0'; });

// คำอธิบายใน "?"
(function () {
  if (typeof PAGE_HELP === 'undefined') return;
  const add = (k, items) => { const h = PAGE_HELP[k]; if (!h || h._v6) return; h.items.push(...items); h._v6 = 1; };
  add('tasks', ['🗂 ฟอร์มสร้าง/แก้ไขงานแบ่งเป็น 4 แท็บ: ข้อมูลหลัก / กำหนดการ / รายการย่อย / ไฟล์-รูป ถ้ากรอกไม่ครบจะมีจุดแดงที่แท็บนั้นและพาไปให้เอง']);
  add('dashboard', ['« ปุ่มมุมบนซ้าย (บนคอม) หุบเมนูข้างเหลือแค่ไอคอน กดอีกครั้งเพื่อขยาย และกดหัวข้อหมวดในเมนูเพื่อหุบ/ขยายรายหมวด (จำค่าไว้ในเครื่อง) หมวดที่หุบอยู่แต่มีงานค้าง/คำขอรออนุมัติจะมีจุดแดงเตือน']);
})();

console.log('%cWorkFlow Pro v6 add-on loaded', 'color:#0F766E;font-weight:bold');
})();
