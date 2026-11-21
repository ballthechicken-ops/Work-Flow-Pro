/* =====================================================================
   WorkFlow Pro v7 add-on  (โหลดหลัง v6-addon.js)
   1) กันปิดฟอร์มเพราะเผลอจิ้มพื้นที่ว่าง / Esc (ถามยืนยันถ้ามีข้อมูลค้าง)
   2) แจ้งเตือนคอมเมนต์ใหม่ (ดึงตอนสร้างแจ้งเตือน + Realtime ถ้าเปิดไว้)
   3) บันทึกแบบร่างอัตโนมัติ + กู้คืนเมื่อเปิดฟอร์มใหม่
   4) แก้ไฟล์แนบหายตอนแก้ไขงาน
   5) หัวหน้าลบ/ยกเลิกงาน "บันทึกเอง" ของลูกทีมได้ (ต้องรัน migration_v7.sql)
   ลบ <script src="v7-addon.js"> = กลับเป็น v6
   ===================================================================== */
(function () {
'use strict';
if (!window.WF4) { console.warn('[v7] ต้องโหลดหลัง v4–v6 — ข้าม'); return; }

const $ = id => document.getElementById(id);
const me = () => currentUser && currentUser.id;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };
const WF7 = window.WF7 = {};
const V7 = { base: null, force: false, timer: 0, attPromise: null, attTouched: false, attFail: false, banner: false, ch: null, rtTimer: 0, lastNotif: 0 };

/* ---------- โมดัลที่ห้ามปิดด้วยการจิ้มพื้นที่ว่าง ---------- */
const PROTECT = new Set(['modal-task', 'modal-mark-done', 'modal-user', 'modal-reward', 'modal-deduct', 'modal-reject', 'modal-approve-points', 'v4-tpl-modal', 'v4-ext-modal']);

const css = document.createElement('style');
css.textContent = `
@keyframes v7shake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.modal.v7-shake{animation:v7shake .35s ease}
#v7-draft-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#FFF7ED;border:1.5px solid #FDE68A;color:#92400E;border-radius:10px;padding:10px 14px;font-size:.84rem;margin-bottom:14px}
[data-theme="dark"] #v7-draft-bar{background:#2b1d0e;border-color:#5b4217;color:#FCD34D}
`;
document.head.appendChild(css);

/* ============================================================
   1) กันปิดโดยไม่ตั้งใจ
   ============================================================ */
document.addEventListener('click', e => {
  const t = e.target;
  if (t.classList && t.classList.contains('modal-overlay') && t.classList.contains('open') && PROTECT.has(t.id)) {
    e.stopImmediatePropagation();                       // ไม่ให้ตัวปิดอัตโนมัติของเดิมทำงาน
    const m = t.querySelector('.modal'); if (m) { m.classList.remove('v7-shake'); void m.offsetWidth; m.classList.add('v7-shake'); }
  }
}, true);

const _close = window.closeModal;
window.closeModal = function (id) {
  if (id === 'modal-task' && !V7.force && isOpen() && isDirty()) {
    saveDraftNow();
    if (!confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการปิดฟอร์มหรือไม่?\n(ระบบเก็บแบบร่างไว้ให้แล้ว เปิดฟอร์มใหม่จะกู้คืนได้)')) return;
  }
  return _close.apply(this, arguments);
};

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !isOpen()) return;
  if ($('v4-cmd')?.classList.contains('open') || $('v4-qa-ov')?.classList.contains('open')) return;
  const top = [...document.querySelectorAll('.modal-overlay.open')].pop();
  if (!top || top.id !== 'modal-task') return;
  e.stopImmediatePropagation(); e.preventDefault();
  window.closeModal('modal-task');
}, true);

window.addEventListener('beforeunload', e => { if (isOpen() && isDirty()) { saveDraftNow(); e.preventDefault(); e.returnValue = ''; } });

/* ============================================================
   3) แบบร่างอัตโนมัติ
   ============================================================ */
const FIELDS = ['task-title', 'task-desc', 'task-category', 'task-priority', 'task-points', 'task-source', 'task-start-date', 'task-start-time', 'task-deadline', 'task-end-time', 'task-assign', 'v5-rec-sel'];
const isOpen = () => !!$('modal-task')?.classList.contains('open');
const key = () => `wf7_draft_${me()}_${$('task-edit-id')?.value || 'new'}`;
function snap() {
  const o = {}; FIELDS.forEach(id => { const el = $(id); if (el) o[id] = el.value; });
  o.subs = [...document.querySelectorAll('#v4-sub-list input')].map(i => i.value);
  o.files = JSON.parse(JSON.stringify(tempTaskFiles || []));
  o.imgs = (tempTaskImages || []).slice();
  return o;
}
const isDirty = () => !!V7.base && JSON.stringify(snap()) !== JSON.stringify(V7.base);
function saveDraftNow() {
  if (!me() || !isOpen()) return;
  if (isDirty()) lsSet(key(), { t: Date.now(), s: snap() });
  else if (!V7.banner) lsDel(key());
}
function sched() {
  if (!isOpen()) return;
  if (V7.banner) hideBanner();                          // เริ่มพิมพ์ใหม่ = ทิ้งแบบร่างเก่า
  clearTimeout(V7.timer); V7.timer = setTimeout(saveDraftNow, 700);
}
function hideBanner() { $('v7-draft-bar')?.remove(); V7.banner = false; }
function showBanner(d) {
  hideBanner();
  const body = document.querySelector('#modal-task .modal-body'); if (!body) return;
  const when = new Date(d.t).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  body.insertAdjacentHTML('afterbegin', `<div id="v7-draft-bar"><span style="flex:1;min-width:180px">📝 พบแบบร่างที่ยังไม่ได้บันทึก (${when})</span><button type="button" class="btn btn-warning btn-sm" onclick="WF7.restore()">กู้คืน</button><button type="button" class="btn btn-secondary btn-sm" onclick="WF7.discard()">ทิ้ง</button></div>`);
  V7.banner = true;
}
function checkDraft() {
  const d = lsGet(key()); if (!d) return;
  if (Date.now() - d.t > 7 * 864e5 || JSON.stringify(d.s) === JSON.stringify(V7.base)) { lsDel(key()); return; }
  showBanner(d);
}
WF7.discard = () => { lsDel(key()); hideBanner(); };
WF7.restore = async () => {
  const d = lsGet(key()); if (!d) return hideBanner();
  if (V7.attPromise) await V7.attPromise;
  const s = d.s, set = (id, v) => { const el = $(id); if (el && v !== undefined) el.value = v; };
  set('task-assign', s['task-assign']);
  FIELDS.filter(f => f !== 'task-assign').forEach(f => set(f, s[f]));
  ['task-deadline', 'v5-rec-sel'].forEach(id => $(id)?.dispatchEvent(new Event('change', { bubbles: true })));
  while (document.querySelector('#v4-sub-list input')) WF4.subDel(0);
  (s.subs || []).forEach((txt, i) => { WF4.subAdd(); WF4.subSet(i, txt); });
  document.querySelectorAll('#v4-sub-list input').forEach((inp, i) => { inp.value = s.subs[i] || ''; });
  tempTaskFiles = s.files || []; _renderFileChips();
  if ($('task-edit-id').value) V7.attTouched = true;
  $('file-upload-status').textContent = tempTaskFiles.length ? `✅ แนบไฟล์แล้ว ${tempTaskFiles.length} ไฟล์` : '';
  clearTaskImage(); (s.imgs || []).forEach(u => { tempTaskImages.push(u); _appendCapturePreview(u, 'task-image-preview'); });
  hideBanner(); toast('กู้คืนแบบร่างแล้ว', 'success');
};
['input', 'change'].forEach(ev => $('modal-task').addEventListener(ev, sched));
$('modal-task').addEventListener('click', e => { if (e.target.closest('[onclick*="subAdd"],[onclick*="subDel"],.fc-remove')) setTimeout(sched, 30); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveDraftNow();
  else if (me() && Date.now() - V7.lastNotif > 120000) refreshNotifs();
});
window.addEventListener('pagehide', saveDraftNow);

/* ============================================================
   4) ไฟล์แนบหายตอนแก้ไข
   สาเหตุ: GET_TASKS ไม่ดึง link_attachment (ประหยัด Egress) → ฟอร์มแก้ไขเห็นไฟล์เป็นว่าง
   แล้ว UPDATE_TASK เขียนทับ link_attachment = '' ทุกครั้งที่กดบันทึก
   ============================================================ */
async function loadAtt(id) {
  const st = $('file-upload-status'); V7.attFail = false;
  try {
    if (st) { st.textContent = '⏳ กำลังโหลดไฟล์แนบเดิม...'; st.style.color = 'var(--warning)'; }
    const r = await callAPI('GET_TASK_ATTACHMENTS', { id });
    if (String($('task-edit-id').value) !== String(id)) return;
    tempTaskFiles = parseAttachments(r.data || ''); _renderFileChips();
    if (V7.base) V7.base.files = JSON.parse(JSON.stringify(tempTaskFiles));
    if (st) { st.textContent = tempTaskFiles.length ? `✅ มีไฟล์แนบ ${tempTaskFiles.length} ไฟล์` : ''; st.style.color = 'var(--success)'; }
  } catch (e) {
    V7.attFail = true;
    if (st) { st.textContent = '⚠️ โหลดไฟล์แนบเดิมไม่สำเร็จ (ไฟล์เดิมจะไม่ถูกลบ)'; st.style.color = 'var(--danger)'; }
  }
}
['openNewTaskModal', 'editTask', 'duplicateTask'].forEach(n => {
  const o = window[n];
  window[n] = function () {
    const r = o.apply(this, arguments);
    hideBanner(); V7.attTouched = false; V7.attPromise = n === 'editTask' ? loadAtt(arguments[0]) : null;
    setTimeout(() => { V7.base = snap(); checkDraft(); }, 120);
    return r;
  };
});
const _hfu = window.handleFileUpload;
window.handleFileUpload = async function (input) {
  if (V7.attPromise) await V7.attPromise;
  if (V7.attFail && $('task-edit-id').value) { await loadAtt($('task-edit-id').value); if (V7.attFail) { input.value = ''; return toast('โหลดไฟล์แนบเดิมไม่ได้ จึงยังแก้ไฟล์แนบไม่ได้ ลองใหม่อีกครั้ง', 'warning'); } }
  V7.attTouched = true; await _hfu.call(this, input); sched();
};
const _rtf = window.removeTaskFile;
window.removeTaskFile = function (i) { if (V7.attFail) return toast('โหลดไฟล์แนบเดิมไม่ได้ จึงยังลบไม่ได้', 'warning'); V7.attTouched = true; _rtf.apply(this, arguments); sched(); };

const _save = window.saveTask;
window.saveTask = async function () {
  const k = key(); V7.force = true;
  try { if (V7.attPromise) await V7.attPromise; return await _save.apply(this, arguments); }
  finally { V7.force = false; if (!isOpen()) lsDel(k); }
};

/* ============================================================
   5) หัวหน้าลบ/ยกเลิกงาน "บันทึกเอง"
   ============================================================ */
const canRemoveSelf = tk => tk.source === 'self' && isManager() &&
  (isAdmin() || tk.assignedTo === me() || tk.createdBy === me() || hasManager(usersCache.find(u => u.id === tk.assignedTo) || {}, me()));
const mkBtn = (cls, label, mode, id) => `<button class="btn ${cls} btn-sm" data-v7="${mode}" onclick="WF7.removeSelf(${id},'${mode}')">${label}</button>`;
WF7.removeSelf = async (id, mode) => {
  const tk = tasksCache.find(x => x.id == id); if (!tk) return;
  if (!confirm(mode === 'delete' ? `ลบงาน "${tk.title}" ถาวร?` : `ยกเลิกงาน "${tk.title}"?`)) return;
  showLoading();
  try {
    await callAPI('REMOVE_SELF_TASK', { id: tk.id, mode });
    closeModal('modal-task-detail'); toast(mode === 'delete' ? 'ลบงานแล้ว' : 'ยกเลิกงานแล้ว', 'success');
    tasksCache = (await callAPI('GET_TASKS', { force: true })).data || []; await refreshCurrentPage();
  } catch (e) { toast(e.message + ' (ลืมรัน migration_v7.sql?)', 'error', 6000); } finally { hideLoading(); }
};
const _rtl = window.renderTaskList;
window.renderTaskList = function () {
  _rtl.apply(this, arguments);
  document.querySelectorAll('#task-list .task-card').forEach(card => {
    const m = /viewTaskDetail\((\d+)\)/.exec(card.innerHTML); if (!m) return;
    const tk = tasksCache.find(x => x.id == m[1]); if (!tk || !canRemoveSelf(tk) || tk.approvedAt) return;
    const box = card.querySelector('.task-actions'); if (!box) return;
    let h = '';
    if (!card.querySelector('[onclick^="deleteTask("]')) h += mkBtn('btn-danger', '🗑', 'delete', tk.id);
    if (['done', 'rejected'].includes(tk.status) && !card.querySelector('[onclick^="cancelTask("]')) h += mkBtn('btn-warning', '❌', 'cancel', tk.id);
    if (h) box.insertAdjacentHTML('beforeend', h);
  });
};
const _dispatch = window._dispatchAPI;
window._dispatchAPI = async function (action, payload = {}) {
  if (action === 'REMOVE_SELF_TASK') {
    const { error } = await supabase.rpc('manager_remove_self_task', { p_task_id: payload.id, p_mode: payload.mode });
    if (error) throw error; return { success: true };
  }
  if (action === 'UPDATE_TASK' && !V7.attTouched && payload && 'link' in payload) delete payload.link;   // ไม่แตะไฟล์แนบถ้าไม่ได้แก้
  return _dispatch.call(this, action, payload);
};

/* ============================================================
   2) แจ้งเตือนคอมเมนต์ใหม่
   ============================================================ */
const seenKey = () => `wf7_cseen_${me()}`;
function markSeen(id) {
  const m = lsGet(seenKey(), {}); m[id] = new Date().toISOString(); lsSet(seenKey(), m);
  notifData = notifData.filter(n => !String(n.id).startsWith(`cmt_${id}_`)); updateNotifBadge();
}
const _vtd = window.viewTaskDetail;
window.viewTaskDetail = async function (id) {
  await _vtd.apply(this, arguments);
  markSeen(id);
  const tk = tasksCache.find(x => x.id == id), box = $('task-detail-actions');
  if (tk && box && $('modal-task-detail').classList.contains('open') && canRemoveSelf(tk) && !tk.approvedAt) {
    box.insertAdjacentHTML('beforeend', mkBtn('btn-danger', '🗑 ลบ', 'delete', tk.id) + (tk.status !== 'cancelled' ? mkBtn('btn-warning', '❌ ยกเลิก', 'cancel', tk.id) : ''));
  }
};
const _bn = window.buildNotifications;
window.buildNotifications = async function () {
  await _bn.apply(this, arguments); V7.lastNotif = Date.now();
  try {
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data, error } = await supabase.from('task_comments').select('id, task_id, user_id, body, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(60);
    if (error) return;
    const uid = me(), seen = lsGet(seenKey(), {}), mine = new Set((data || []).filter(c => c.user_id === uid).map(c => c.task_id)), by = {};
    (data || []).forEach(c => {
      if (c.user_id === uid) return;
      const tk = tasksCache.find(t => t.id === c.task_id); if (!tk) return;
      if (!(tk.assignedTo === uid || tk.createdBy === uid || mine.has(c.task_id))) return;
      if (seen[c.task_id] && c.created_at <= seen[c.task_id]) return;
      (by[c.task_id] = by[c.task_id] || []).push(c);
    });
    const add = Object.entries(by).map(([tid, list]) => {
      const tk = tasksCache.find(t => t.id == tid), last = list[0];
      return { id: `cmt_${tid}_${last.id}`, taskId: +tid, type: 'task', urgent: false, icon: '💬', iconBg: '#E0E7FF',
        title: `ความคิดเห็นใหม่${list.length > 1 ? ` ${list.length} รายการ` : ''}: ${tk.title}`,
        sub: `${getUserName(last.user_id)}: ${String(last.body).slice(0, 80)}`, time: fmtDateTime(last.created_at) };
    });
    if (!add.length) return;
    notifData = [...notifData, ...add].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)).slice(0, 50);
    updateNotifBadge(true);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const nk = `wf7_cn_${uid}`, done = lsGet(nk, []);
      add.filter(n => !done.includes(n.id)).slice(0, 2).forEach(n => { try { const x = new Notification(n.title, { body: n.sub, icon: 'icon.svg', tag: n.id }); x.onclick = () => { window.focus(); handleNotifClick(n.id); x.close(); }; } catch (e) {} });
      lsSet(nk, [...done, ...add.map(n => n.id)].slice(-200));
    }
  } catch (e) { console.warn('[v7] comment notif', e); }
};
async function refreshNotifs() { try { notifBuilt = false; await buildNotifications(); if ($('notif-panel')?.classList.contains('open')) renderNotifList(); } catch (e) {} }

// Realtime (ใช้ได้เมื่อเปิด publication ให้ task_comments — ดู migration_v7.sql) ถ้าไม่เปิดก็ไม่เสียหาย
function startRealtime() {
  if (V7.ch || !currentUser) return;
  try {
    V7.ch = supabase.channel('wf7-comments').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments' }, p => {
      const r = p.new; if (!r || r.user_id === me()) return;
      const tk = tasksCache.find(t => t.id === r.task_id);
      if (tk && (tk.assignedTo === me() || tk.createdBy === me())) toast(`💬 ${getUserName(r.user_id)}: ${String(r.body).slice(0, 50)}`, 'info', 4500);
      clearTimeout(V7.rtTimer); V7.rtTimer = setTimeout(refreshNotifs, 1000);
    }).subscribe();
  } catch (e) {}
}
const _lid = window.loadInitialData;
window.loadInitialData = async function () { await _lid.apply(this, arguments); startRealtime(); };
const _lo = window.logout;
window.logout = async function () { try { if (V7.ch) { supabase.removeChannel(V7.ch); V7.ch = null; } } catch (e) {} return _lo.apply(this, arguments); };
if (currentUser) startRealtime();

console.log('%cWorkFlow Pro v7 add-on loaded', 'color:#0F766E;font-weight:bold');
})();
