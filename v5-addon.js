/* =====================================================================
   WorkFlow Pro v5.0 add-on  (โหลดหลัง V4-addon.js)
   - ครอบ (wrap) ฟังก์ชันเดิมเหมือน v4  | ลบ <script src="v5-addon.js"> = กลับเป็น v4
   สิ่งที่เพิ่ม: ความสำเร็จ 49 รายการ + ระดับขั้น 20 ระดับ + โปรไฟล์
                Kanban ลากแล้วอัปเดตทันที (เมาส์+มือถือ) | Quick Add ฉลาดขึ้น + งานซ้ำ
                ภาระงานทีม | เจาะลึก (RPC) | คีย์ลัด | คำอธิบายใน "?" ครบ
   ===================================================================== */
(function () {
'use strict';
if (!window.WF4) { console.warn('[v5] ไม่พบ V4-addon.js — ข้าม v5'); return; }

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateOf = s => { const [y,m,d] = String(s).substring(0,10).split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (n, from) => { const d = from ? new Date(from) : new Date(); d.setDate(d.getDate()+n); return ymd(d); };
const isoDt = iso => { if (!iso) return null; const d = new Date(String(iso).replace(' ','T')); return isNaN(d) ? null : d; };
const isoDate = iso => { const d = isoDt(iso); return d ? ymd(d) : ''; };
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return null; };
const me = () => currentUser && currentUser.id;
const DAYN = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

const WF5 = window.WF5 = {};
const V5 = { ach: null, achAt: 0, achDb: true, achFilter: 'all', charts: {}, ins: {}, insScope: null, insDays: 90,
  wlOpen: new Set(), rec: { wd: null, dom: null }, recRows: [], drag: null, noClick: 0, busy: new Set(), recLast: 0, gWait: false, gTimer: 0, qaItems: [] };

/* ============================================================
   0) CSS
   ============================================================ */
const st = document.createElement('style');
st.textContent = `
.v5-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px;margin-bottom:14px}
.v5-kpi{background:var(--bg);border-radius:12px;padding:12px 8px;text-align:center}
.v5-kv{font-size:1.35rem;font-weight:800;line-height:1.2}.v5-kl{font-size:.73rem;color:var(--text-sub);margin-top:3px}
.v5-ach{border-width:2px}.v5-ach.t0{border-color:#CD7F32}.v5-ach.t1{border-color:#9CA3AF}.v5-ach.t2{border-color:#EAB308}.v5-ach.t3{border-color:#22D3EE}.v5-ach.t4{border-color:#A855F7;box-shadow:0 0 0 3px rgba(168,85,247,.18)}
.v5-ach.locked{border-color:var(--border);box-shadow:none}
.v5-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.v5-chip{padding:6px 14px;border-radius:20px;border:1.5px solid var(--border);background:var(--bg-card);color:var(--text-main);font-size:.8rem;font-weight:600;cursor:pointer}
.v5-chip.on{background:var(--primary);color:#fff;border-color:var(--primary)}
.v5-bar{display:flex;height:12px;border-radius:8px;overflow:hidden;background:var(--bg)}
.v5-wl{padding:12px 16px;border-bottom:1px solid var(--border)}
.v5-wl-head{display:flex;align-items:center;gap:10px;cursor:pointer;flex-wrap:wrap}
.v5-strip{display:flex;gap:3px}.v5-sq{width:19px;height:19px;border-radius:5px;font-size:.62rem;font-weight:700;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text-sub)}
.v5-hm{display:grid;grid-template-columns:34px repeat(24,minmax(14px,1fr));gap:2px;min-width:580px;font-size:.62rem;color:var(--text-sub)}
.v5-hm i{display:block;height:20px;border-radius:3px;background:var(--bg)}
.v5-kbd{display:inline-block;min-width:24px;text-align:center;padding:2px 8px;border-radius:6px;border:1px solid var(--border);border-bottom-width:2px;background:var(--bg);font-family:monospace;font-size:.8rem;font-weight:700;margin-right:3px}
.v5-keyrow{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--border);font-size:.86rem}
body.v5-dragging{user-select:none;-webkit-user-select:none;cursor:grabbing}
.kb-card{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
.kb-card:not([data-can]){cursor:pointer}
@keyframes v5flash{0%{box-shadow:0 0 0 0 rgba(22,163,74,.75)}100%{box-shadow:0 0 0 16px rgba(22,163,74,0)}}
.v5-flash{animation:v5flash .9s ease 1}
#page-dashboard .notif-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch}
#page-dashboard .notif-tab{white-space:nowrap;min-width:max-content;padding:9px 14px}
@media(max-width:700px){#v5-keys-btn{display:none}}
`;
document.head.appendChild(st);

/* ============================================================
   1) ระดับขั้น 20 ระดับ (แทนของเดิม 11 ระดับ)
   ============================================================ */
const RANKS = [
  [0,'🥚','มือใหม่หัดเดิน'],[100,'🐣','รุกกี้ป้ายแดง'],[200,'🌱','นักเรียนฝึกหัด'],[350,'⚒️','ช่างฝีมือมือใหม่'],[500,'🛡️','เซฟตี้อัศวิน'],
  [700,'⚔️','นักรบผู้ตื่นรู้'],[1000,'🦺','พาลาดินผู้พิทักษ์'],[1300,'🔰','ผู้เชี่ยวชาญสนาม'],[1600,'🦅','จอมเวทย์ตาเหยี่ยว'],[2000,'🌟','ดาวแห่งทีมงาน'],
  [2500,'💎','เพชรแห่งองค์กร'],[3100,'🏅','ผู้พิชิตเป้าหมาย'],[3800,'🚀','นักขับเคลื่อนงาน'],[4600,'🔥','เปลวไฟแห่งความมุ่งมั่น'],[5500,'🧠','ปรมาจารย์วางแผน'],
  [6500,'🏰','ผู้พิทักษ์ปราการ'],[7800,'🐉','มังกรแห่งผลงาน'],[9500,'👑','ราชาแห่งทีม'],[12000,'⚡','ตำนานแห่งองค์กร'],[15000,'🌌','อมตะแห่งจักรวาลงาน']
];
const rankOf = p => { let i = 0; RANKS.forEach((r, k) => { if (p >= r[0]) i = k; }); return i; };

// ปิด popup เลื่อนขั้นของเดิม (ใช้ชุดแรงค์เก่า) แล้วใช้ของ v5 แทน
window._checkRankCelebration = function () {};

function refreshRankUI() {
  const sc = $('kpi-score'); if (!sc || !currentUser) return;
  const pts = parseInt(String(sc.textContent).replace(/,/g, '')) || 0;
  const i = rankOf(pts), cur = RANKS[i], nx = RANKS[i+1];
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set('rank-icon', cur[1]); set('rank-name', cur[2]); set('rank-sub', nx ? `Rank ${i+1} / ${RANKS.length}` : `Rank ${i+1} MAX`);
  if (nx) {
    const pct = Math.min(100, Math.round((pts - cur[0]) / (nx[0] - cur[0]) * 100));
    set('kpi-target-label', `Next: ${nx[2]}`); set('kpi-min-label', cur[0]); set('kpi-max-label', nx[0]); set('kpi-pct', pct + '%');
    if ($('kpi-bar')) $('kpi-bar').style.width = pct + '%';
    if ($('kpi-status-msg')) $('kpi-status-msg').innerHTML = `อีก <strong style="color:var(--danger)">${nx[0] - pts} EXP</strong> จะได้เลื่อนขั้นเป็น <strong>${esc(nx[2])}</strong> 🚀`;
  } else {
    set('kpi-target-label', 'MAX LEVEL'); set('kpi-pct', 'MAX'); if ($('kpi-bar')) $('kpi-bar').style.width = '100%';
    if ($('kpi-status-msg')) $('kpi-status-msg').innerHTML = `🎉 คุณคือ <strong>${esc(cur[2])}</strong> จุดสูงสุดแล้ว!`;
  }
  const key = 'wf5_rank_' + me(), last = store(key);
  if (last !== null && i > last) showCelebration('เลื่อนขั้นแล้ว! 🎊', `ยินดีด้วย! คุณเลื่อนขั้นเป็น "${cur[2]}" แล้ว สะสมได้ ${pts} EXP`, cur[1]);
  store(key, i);
}

/* ============================================================
   2) ความสำเร็จ (คำนวณจาก tasksCache ในเครื่อง = ไม่กินโควต้า)
   ============================================================ */
const TIERS = ['🥉','🥈','🥇','💠','👑'];
const CAT = { volume: ['🎯','ปริมาณงาน'], time: ['⏱️','ความตรงเวลา'], habit: ['🔥','วินัย/ความสม่ำเสมอ'], skill: ['🛡️','ทักษะ'], rank: ['🏅','ระดับขั้น'] };
const ACH = [];
function fam(id, cat, icons, names, desc, key, targets) {
  targets.forEach((t, i) => ACH.push({ id: id + t, cat, icon: icons[i] || icons[icons.length-1], name: names[i] || names[names.length-1], desc: desc(t), key, target: t, tier: Math.min(i, 4) }));
}
fam('done','volume',['🎯','🔟','🏁','💯','🏆','🎖️','👑'],['งานแรกสำเร็จ','มือทำงาน','เดินหน้าเต็มสูบ','ตัวแม่งานหนัก','ตำนานแห่งงาน','เครื่องจักรไร้เหนื่อย','ราชาแห่งการปิดงาน'],n=>`ส่งงานเสร็จครบ ${n} งาน`,'done',[1,10,25,50,100,250,500]);
fam('pts','volume',['⭐','🌟','💫','✨','🌠'],['EXP 500','EXP 1,000','EXP 2,500','EXP 5,000','EXP 10,000'],n=>`สะสมคะแนนครบ ${n.toLocaleString()}`,'pts',[500,1000,2500,5000,10000]);
fam('streak','time',['⏱️','🔥','⚡','🚄','☄️'],['ตรงเวลาต่อเนื่อง','ไฟลุก','ไร้ที่ติ','เวลาคือชีวิต','เทพแห่งเดดไลน์'],n=>`ส่งตรงเวลาติดต่อกัน ${n} งาน`,'streak',[3,5,10,20,30]);
fam('early','time',['🌅','🌄','🌞'],['นักส่งก่อนเวลา','ล่วงหน้าเสมอ','เร็วกว่าเวลา'],n=>`ส่งก่อนกำหนดอย่างน้อย 1 วัน ${n} งาน`,'early',[5,20,50]);
fam('same','time',['🏎️'],['งานไวไฟ'],n=>`ปิดงานภายในวันเดียวกับที่เริ่ม ${n} งาน`,'same',[10]);
ACH.push({ id:'perfect', cat:'time', icon:'👑', name:'ตรงเวลา 100%', desc:'ส่งตรงเวลาทุกงาน (ขั้นต่ำ 10 งานมอบหมาย)', key:'perfect', target:1, tier:4 });
ACH.push({ id:'rate95', cat:'time', icon:'🎯', name:'แม่นยำระดับมืออาชีพ', desc:'อัตราตรงเวลา ≥ 95% (ขั้นต่ำ 20 งานมอบหมาย)', key:'rate95', target:1, tier:3 });
fam('days','habit',['📆','🗓️','🔁','🏃'],['สามวันติด','ห้าวันติด','สัปดาห์ทอง','สองสัปดาห์ไม่มีหยุด'],n=>`ส่งงานติดต่อกัน ${n} วัน (นับวันปฏิทิน)`,'dayStreak',[3,5,7,14]);
ACH.push({ id:'clean7', cat:'habit', icon:'🧹', name:'ไร้งานค้าง 7 วัน', desc:'ไม่มีงานเกินกำหนดเลยตลอด 7 วันล่าสุด', key:'clean7', target:1, tier:1 });
ACH.push({ id:'clean30', cat:'habit', icon:'🧼', name:'ไร้งานค้าง 30 วัน', desc:'ไม่มีงานเกินกำหนดเลยตลอด 30 วันล่าสุด', key:'clean30', target:1, tier:3 });
fam('night','habit',['🦉'],['นกฮูกกลางคืน'],n=>`ส่งงานช่วง 20:00–05:00 จำนวน ${n} งาน`,'night',[5]);
fam('morn','habit',['🐓'],['ตื่นเช้าเก็บงาน'],n=>`ส่งงานช่วง 05:00–08:00 จำนวน ${n} งาน`,'morn',[5]);
fam('wknd','habit',['🏖️'],['นักรบวันหยุด'],n=>`ส่งงานวันเสาร์-อาทิตย์ ${n} งาน`,'wknd',[5]);
fam('busy','habit',['🔨','💥'],['วันแห่งพลัง','วันสุดโหด'],n=>`ปิดงานให้ได้ ${n} งานภายใน 1 วัน`,'maxPerDay',[5,10]);
fam('crit','skill',['🛡️','🧯','🚒','🦸'],['นักดับเพลิงฝึกหัด','นักดับเพลิง','หัวหน้าหน่วยดับเพลิง','ฮีโร่วิกฤต'],n=>`ปิดงาน Critical สำเร็จ ${n} งาน`,'crit',[1,3,10,25]);
fam('self','skill',['✍️','📒','📚'],['นักบันทึก','จดทุกอย่าง','บรรณารักษ์งาน'],n=>`บันทึกงานเองที่เสร็จแล้ว ${n} งาน`,'self',[10,30,100]);
fam('cats','skill',['🧭','🌐'],['นักสำรวจ','รอบด้าน'],n=>`ปิดงานครบ ${n} ประเภท`,'cats',[3,6]);
fam('subs','skill',['☑️','✅'],['เช็คลิสต์เมสเตอร์','ราชาเช็คลิสต์'],n=>`ติ๊กรายการย่อยครบ ${n} รายการ`,'subs',[25,100]);
fam('rank','rank',['🛡️','🌟','🏅','🌌'],['ก้าวสู่แรงค์ 5','ก้าวสู่แรงค์ 10','ก้าวสู่แรงค์ 15','ถึงจุดสูงสุด'],n=>`เลื่อนขั้นถึงแรงค์ ${n}`,'rankNo',[5,10,15,20]);

function myStats() {
  const uid = me(), today = todayStr();
  const mine = tasksCache.filter(t => t.assignedTo === uid);
  const doneAll = mine.filter(t => t.status === 'done');
  const done = doneAll.filter(t => t.completedAt);
  const S = { done: doneAll.length };
  const ad = done.filter(t => t.source === 'assigned' && t.deadline).sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
  const onT = t => isoDate(t.completedAt) <= t.deadline;
  let mx = 0, run = 0; ad.forEach(t => { if (onT(t)) { run++; mx = Math.max(mx, run); } else run = 0; });
  S.streak = mx; S.streakNow = run; S.assignedDone = ad.length; S.onTimeN = ad.filter(onT).length;
  S.onTimeRate = ad.length ? Math.round(S.onTimeN / ad.length * 100) : null;
  S.perfect = (ad.length >= 10 && S.onTimeN === ad.length) ? 1 : 0;
  S.rate95 = (ad.length >= 20 && S.onTimeRate >= 95) ? 1 : 0;
  S.early = ad.filter(t => isoDate(t.completedAt) < t.deadline).length;
  S.crit = done.filter(t => t.priority === 'Critical').length;
  S.self = done.filter(t => t.source === 'self').length;
  S.cats = new Set(done.map(t => t.category).filter(Boolean)).size;
  const perDay = {}; let night = 0, morn = 0, wknd = 0, same = 0, subs = 0, cs = 0, cn = 0;
  done.forEach(t => {
    const d = isoDt(t.completedAt); if (!d) return; const k = ymd(d); perDay[k] = (perDay[k] || 0) + 1;
    const h = d.getHours(); if (h >= 20 || h < 5) night++; else if (h >= 5 && h < 8) morn++;
    const w = d.getDay(); if (w === 0 || w === 6) wknd++;
    if (t.startDate) { if (k === t.startDate) same++; const df = Math.round((dateOf(k) - dateOf(t.startDate)) / 86400000); if (df >= 0) { cs += df; cn++; } }
  });
  mine.forEach(t => (t.subtasks || []).forEach(s => { if (s.d) subs++; }));
  Object.assign(S, { night, morn, wknd, same, subs, avgClose: cn ? +(cs / cn).toFixed(1) : null, maxPerDay: Math.max(0, ...Object.values(perDay)) });
  const days = Object.keys(perDay).sort(); let best = 0, r2 = 0, prev = null;
  days.forEach(k => { r2 = (prev && Math.round((dateOf(k) - dateOf(prev)) / 86400000) === 1) ? r2 + 1 : 1; best = Math.max(best, r2); prev = k; });
  let cur = 0, cursor = perDay[today] ? today : (perDay[addDays(-1)] ? addDays(-1) : null);
  while (cursor && perDay[cursor]) { cur++; cursor = addDays(-1, dateOf(cursor)); }
  S.dayStreak = best; S.dayStreakNow = cur;
  const overdueNow = mine.some(t => t.deadline && t.deadline < today && !['done','cancelled'].includes(t.status));
  const late = t => t.deadline && (t.status === 'done' ? (t.completedAt && isoDate(t.completedAt) > t.deadline) : t.deadline < today);
  const clean = n => { if (overdueNow) return 0; const f = addDays(-n); const r = mine.filter(t => t.deadline && t.deadline >= f && t.deadline <= today && t.status !== 'cancelled'); return r.length && !r.some(late) ? 1 : 0; };
  S.clean7 = clean(7); S.clean30 = clean(30);
  S.open = mine.filter(t => !['done','cancelled'].includes(t.status)).length;
  S.overdue = mine.filter(t => t.deadline && t.deadline < today && !['done','cancelled'].includes(t.status)).length;
  S.pts = Math.max((usersCache.find(u => u.id === uid) || {}).points || 0, currentUser.points || 0);
  S.rank = rankOf(S.pts); S.rankNo = S.rank + 1;
  const mon = new Date(); mon.setHours(0,0,0,0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  S.weekly = []; for (let i = 7; i >= 0; i--) { const s = new Date(mon); s.setDate(s.getDate() - 7*i); const e = new Date(s); e.setDate(e.getDate() + 7); S.weekly.push(done.filter(t => { const d = isoDt(t.completedAt); return d && d >= s && d < e; }).length); }
  return S;
}
function evalAch() {
  const S = myStats(), saved = V5.ach || new Map();
  const list = ACH.map(a => { const v = S[a.key] || 0, live = v >= a.target, at = saved.get(a.id); return { ...a, cur: Math.min(v, a.target), live, at, ok: live || !!at }; });
  return { S, list };
}
async function loadSavedAch() {
  if (V5.ach && Date.now() - V5.achAt < 600000) return;
  const m = new Map(Object.entries(store('wf5_ach_' + me()) || {}));
  try {
    const { data, error } = await supabase.from('user_achievements').select('ach_id, unlocked_at').eq('user_id', me()).limit(200);
    if (error) throw error; (data || []).forEach(r => m.set(r.ach_id, r.unlocked_at)); V5.achDb = true;
  } catch (e) { V5.achDb = false; }
  V5.ach = m; V5.achAt = Date.now();
}
async function checkAch() {
  if (!currentUser) return;
  try {
    await loadSavedAch();
    const fresh = evalAch().list.filter(a => a.live && !V5.ach.has(a.id)); if (!fresh.length) return;
    const now = new Date().toISOString(), initKey = 'wf5_ach_init_' + me(), first = !store(initKey);
    fresh.forEach(a => V5.ach.set(a.id, now));
    const loc = {}; V5.ach.forEach((v, k) => loc[k] = v); store('wf5_ach_' + me(), loc); store(initKey, 1);
    if (V5.achDb) { try { await supabase.from('user_achievements').upsert(fresh.map(a => ({ user_id: me(), ach_id: a.id, unlocked_at: now })), { onConflict: 'user_id,ach_id', ignoreDuplicates: true }); } catch (e) {} }
    if (first && fresh.length > 3) return;                 // ผู้ใช้เดิมครั้งแรก: บันทึกย้อนหลังเงียบ ๆ ไม่เด้งพลุรัว
    const a = fresh.slice().sort((x, y) => y.tier - x.tier)[0], extra = fresh.length > 1 ? ` (และอีก ${fresh.length - 1} รายการ)` : '';
    if ($('modal-celebrate')?.classList.contains('open')) toast(`🏅 ปลดล็อก: ${esc(a.name)}${extra}`, 'success', 5000);
    else showCelebration(`ปลดล็อกความสำเร็จ! ${a.icon}`, `"${a.name}" — ${a.desc}${extra}`, a.icon);
  } catch (e) { console.warn('[v5] checkAch', e); }
}
function achCard(a) {
  const pct = Math.round(a.cur / a.target * 100);
  return `<div class="v4-badge v5-ach t${a.tier} ${a.ok ? '' : 'locked'}"><div class="v4-bi">${a.icon}</div><div style="font-weight:700">${esc(a.name)}</div>
    <div style="font-size:.78rem;color:var(--text-sub);margin:4px 0 10px">${esc(a.desc)}</div>
    ${a.ok ? `<span class="badge badge-green">${TIERS[a.tier]} ปลดล็อก${a.at ? ' · ' + fmtDate(a.at) : ''}</span>`
      : `<div class="progress-bar-bg" style="height:7px"><div class="progress-bar-fill" style="width:${pct}%"></div></div><div style="font-size:.72rem;color:var(--text-sub);margin-top:4px">${a.cur.toLocaleString()} / ${a.target.toLocaleString()}</div>`}</div>`;
}
function renderAchPage() {
  const el = $('badges-body'); if (!el) return;
  const { S, list } = evalAch(), un = list.filter(a => a.ok).length, f = V5.achFilter;
  const shown = list.filter(a => f === 'all' || a.cat === f).sort((a, b) => (b.ok - a.ok) || (b.ok ? String(b.at || '').localeCompare(String(a.at || '')) : (b.cur / b.target) - (a.cur / a.target)));
  const tc = [0,1,2,3,4].map(t => list.filter(a => a.ok && a.tier === t).length);
  el.innerHTML = `<div class="card"><div class="card-body" style="display:flex;gap:22px;flex-wrap:wrap;align-items:center">
    <div style="font-size:2.4rem">🏅</div><div><div style="font-size:.82rem;color:var(--text-sub)">ปลดล็อกแล้ว</div><div style="font-size:1.8rem;font-weight:900;color:var(--primary)">${un}/${list.length}</div></div>
    <div><div style="font-size:.82rem;color:var(--text-sub)">ตรงเวลาติดต่อกัน (ตอนนี้ / สูงสุด)</div><div style="font-size:1.3rem;font-weight:800;color:var(--warning)">🔥 ${S.streakNow} / ${S.streak}</div></div>
    <div style="font-size:.9rem">${TIERS.map((t, i) => `${t} <strong>${tc[i]}</strong>`).join(' &nbsp; ')}</div></div></div>
    <div class="v5-chips"><button class="v5-chip ${f === 'all' ? 'on' : ''}" onclick="WF5.achFilter('all')">ทั้งหมด (${list.length})</button>
    ${Object.entries(CAT).map(([k, v]) => `<button class="v5-chip ${f === k ? 'on' : ''}" onclick="WF5.achFilter('${k}')">${v[0]} ${v[1]} (${list.filter(a => a.cat === k).length})</button>`).join('')}</div>
    <div class="v4-badge-grid">${shown.map(achCard).join('')}</div>`;
}
WF5.achFilter = k => { V5.achFilter = k; renderAchPage(); };

async function renderProfileAch() {
  const host = $('v5-profile-ach'); if (!host) return;
  if (!V5.ach) await loadSavedAch();
  const { S, list } = evalAch(), i = S.rank, cur = RANKS[i], nx = RANKS[i+1];
  const pct = nx ? Math.min(100, Math.round((S.pts - cur[0]) / (nx[0] - cur[0]) * 100)) : 100;
  const unl = list.filter(a => a.ok).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')) || b.tier - a.tier);
  const goals = list.filter(a => !a.ok).sort((a, b) => (b.cur / b.target) - (a.cur / a.target)).slice(0, 3);
  const mx = Math.max(1, ...S.weekly);
  const spark = S.weekly.map((n, k) => `<div title="${n} งาน" style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px"><div style="font-size:.64rem;color:var(--text-sub)">${n}</div><div style="width:100%;max-width:26px;height:${Math.max(4, Math.round(n / mx * 54))}px;background:var(--primary);opacity:${k === 7 ? 1 : .6};border-radius:5px 5px 2px 2px"></div></div>`).join('');
  const kp = (v, l, c) => `<div class="v5-kpi"><div class="v5-kv" style="color:${c}">${v}</div><div class="v5-kl">${l}</div></div>`;
  host.innerHTML = `<div class="card"><div class="card-header"><span>🏅 ความสำเร็จของฉัน</span><button class="btn btn-secondary btn-sm" onclick="navigate('badges')">ดูทั้งหมด (${unl.length}/${list.length}) →</button></div><div class="card-body">
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:16px"><div style="font-size:3rem">${cur[1]}</div>
      <div style="flex:1;min-width:200px"><div style="font-weight:800;font-size:1.15rem;color:var(--primary)">${esc(cur[2])}</div><div style="font-size:.78rem;color:var(--text-sub)">แรงค์ ${i+1} / ${RANKS.length} · ${S.pts.toLocaleString()} EXP</div>
      <div class="progress-bar-bg" style="height:9px;margin-top:8px"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      <div style="font-size:.76rem;color:var(--text-sub)">${nx ? `อีก ${(nx[0] - S.pts).toLocaleString()} EXP → ${nx[1]} ${esc(nx[2])}` : 'ถึงระดับสูงสุดแล้ว 🎉'}</div></div></div>
    <div class="v5-kpis">${kp(S.done, 'งานที่ทำเสร็จ', 'var(--success)')}${kp(S.onTimeRate == null ? '—' : S.onTimeRate + '%', 'อัตราตรงเวลา', 'var(--secondary)')}${kp('🔥 ' + S.streakNow + '/' + S.streak, 'ตรงเวลาต่อเนื่อง', 'var(--warning)')}${kp(S.dayStreakNow + ' วัน', 'ส่งงานติดวัน', 'var(--primary)')}${kp(S.avgClose == null ? '—' : S.avgClose + ' วัน', 'เวลาปิดงานเฉลี่ย', 'var(--text-main)')}${kp(S.open + (S.overdue ? ` <small style="color:var(--danger)">(เกิน ${S.overdue})</small>` : ''), 'งานค้าง', 'var(--text-main)')}</div>
    <div style="font-size:.78rem;color:var(--text-sub);margin-bottom:4px">📈 งานที่เสร็จรายสัปดาห์ (8 สัปดาห์ล่าสุด)</div><div style="display:flex;gap:6px;align-items:flex-end;height:80px;margin-bottom:16px">${spark}</div>
    <div style="font-weight:700;font-size:.88rem;margin-bottom:8px">🏆 ล่าสุดที่ปลดล็อก</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${unl.slice(0, 8).map(a => `<span class="v4-chip" title="${esc(a.desc)}">${a.icon} ${esc(a.name)}</span>`).join('') || '<span style="color:var(--text-sub);font-size:.85rem">ยังไม่มี — ส่งงานชิ้นแรกเพื่อเริ่มสะสม!</span>'}</div>
    ${goals.length ? `<div style="font-weight:700;font-size:.88rem;margin-bottom:8px">🎯 เป้าหมายถัดไป</div>${goals.map(a => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="font-size:1.4rem">${a.icon}</span><div style="flex:1;min-width:0"><div style="font-size:.84rem;font-weight:600">${esc(a.name)} <span style="color:var(--text-sub);font-weight:400">· ${esc(a.desc)}</span></div><div class="progress-bar-bg" style="height:6px;margin:4px 0 0"><div class="progress-bar-fill" style="width:${Math.round(a.cur / a.target * 100)}%"></div></div></div><span style="font-size:.74rem;color:var(--text-sub)">${a.cur}/${a.target}</span></div>`).join('')}` : ''}
    <details style="margin-top:12px"><summary style="cursor:pointer;font-size:.82rem;color:var(--text-sub)">ดูแรงค์ทั้งหมด (${RANKS.length} ระดับ)</summary><div style="margin-top:8px">${RANKS.map((r, k) => `<div style="display:flex;gap:10px;padding:5px 8px;border-radius:8px;font-size:.84rem;${k === i ? 'background:rgba(20,184,166,.15);font-weight:700' : ''}${k > i ? ';opacity:.55' : ''}"><span>${r[1]}</span><span style="flex:1">${k + 1}. ${esc(r[2])}</span><span style="color:var(--text-sub)">${r[0].toLocaleString()}+ EXP</span></div>`).join('')}</div></details>
  </div></div>`;
}

/* ============================================================
   3) KANBAN — ลากแล้วอัปเดตทันที (Optimistic UI) รองรับเมาส์ + มือถือ (กดค้าง)
   ============================================================ */
function flash(id) { document.querySelector(`#kanban-board .kb-card[data-id="${id}"]`)?.classList.add('v5-flash'); }
async function quickDone(id) {
  const tk = tasksCache.find(x => x.id == id);
  if (!tk || !canManageTaskFE(tk) || V5.busy.has(tk.id)) return;
  V5.busy.add(tk.id);
  const prev = { status: tk.status, completedAt: tk.completedAt };
  tk.status = 'done'; tk.completedAt = new Date().toISOString();       // อัปเดตหน้าจอทันที
  renderTaskList(); flash(tk.id); toast('✅ ส่งงานแล้ว: ' + esc(String(tk.title).slice(0, 40)), 'success');
  try { await callAPI('UPDATE_TASK_STATUS', { id: tk.id, status: 'done' }); checkAch(); }
  catch (e) { tk.status = prev.status; tk.completedAt = prev.completedAt; renderTaskList(); toast('ส่งงานไม่สำเร็จ (คืนสถานะเดิมแล้ว): ' + esc(e.message), 'error'); }
  finally { V5.busy.delete(tk.id); }
}
function dropCard(d, k) {
  if (!k || k === d.src) return;
  if (d.can === 'done' && k === 'done') return quickDone(d.id);
  if (d.can === 'reject' && k === 'rejected') return openRejectModal(d.id);
  toast(d.can === 'done' ? 'ลากไปวางที่คอลัมน์ "เสร็จสิ้น" เพื่อส่งงาน (สถานะอื่นระบบกำหนดให้อัตโนมัติ)' : 'หัวหน้าลากไปที่ "ตีกลับ" เพื่อตีกลับงาน หรือกดปุ่ม 👍 เพื่ออนุมัติ', 'info');
}
function startDrag() {
  const d = V5.drag, r = d.card.getBoundingClientRect(); d.dx = d.x - r.left; d.dy = d.y - r.top;
  const g = d.card.cloneNode(true); g.className = 'kb-card v5-ghost';
  Object.assign(g.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', zIndex: 5000, pointerEvents: 'none', opacity: .92, transform: 'rotate(2deg)', boxShadow: '0 12px 30px rgba(0,0,0,.3)', margin: 0 });
  document.body.appendChild(g); d.ghost = g; d.started = true; d.card.classList.add('dragging'); document.body.classList.add('v5-dragging');
  if (navigator.vibrate) navigator.vibrate(15);
}
function onDown(e) {
  if (e.button > 0) return;
  const card = e.target.closest('.kb-card'); if (!card || e.target.closest('[data-act]') || !card.dataset.can) return;
  const d = V5.drag = { card, id: +card.dataset.id, can: card.dataset.can, src: card.closest('.kb-col').dataset.k, x: e.clientX, y: e.clientY, pid: e.pointerId, touch: e.pointerType === 'touch', started: false, ghost: null, t: null };
  if (d.touch) d.t = setTimeout(() => { if (V5.drag === d && !d.started) startDrag(); }, 260);   // มือถือ: กดค้างก่อนลาก (ไม่รบกวนการเลื่อนหน้า)
}
document.addEventListener('pointermove', e => {
  const d = V5.drag; if (!d || e.pointerId !== d.pid) return;
  if (!d.started) {
    const mv = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (d.touch) { if (mv > 10) { clearTimeout(d.t); V5.drag = null; } return; }
    if (mv > 5) startDrag(); else return;
  }
  d.ghost.style.left = (e.clientX - d.dx) + 'px'; d.ghost.style.top = (e.clientY - d.dy) + 'px';
  const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('.kb-col'), need = d.can === 'done' ? 'done' : 'rejected';
  document.querySelectorAll('.kb-col.over').forEach(c => { if (c !== col) c.classList.remove('over'); });
  if (col && col.dataset.k === need && col.dataset.k !== d.src) col.classList.add('over');
  const w = document.querySelector('#kanban-board .kb-wrap');
  if (w) { if (e.clientX < 50) w.scrollLeft -= 14; else if (e.clientX > innerWidth - 50) w.scrollLeft += 14; }
});
const endDrag = e => {
  const d = V5.drag; if (!d || e.pointerId !== d.pid) return;
  clearTimeout(d.t); V5.drag = null; if (!d.started) return;
  V5.noClick = Date.now();
  const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('.kb-col');
  d.ghost.remove(); d.card.classList.remove('dragging'); document.body.classList.remove('v5-dragging');
  document.querySelectorAll('.kb-col.over').forEach(c => c.classList.remove('over'));
  if (e.type !== 'pointercancel') dropCard(d, col && col.dataset.k);
};
document.addEventListener('pointerup', endDrag); document.addEventListener('pointercancel', endDrag);
document.addEventListener('touchmove', e => { if (V5.drag && V5.drag.started && e.cancelable) e.preventDefault(); }, { passive: false });

function enhanceKanban() {
  const board = $('kanban-board'); if (!board || board.style.display === 'none') return;
  const old = board.querySelector('.kb-wrap'); if (!old) return;
  const sl = old.scrollLeft;
  board.innerHTML = board.innerHTML;                               // ล้าง handler HTML5-drag เดิมของ v4 (ใช้ไม่ได้บนมือถือ/ไม่อัปเดตทันที)
  const w = board.querySelector('.kb-wrap'); if (w) w.scrollLeft = sl;
  board.querySelectorAll('.kb-card').forEach(c => {
    const col = c.closest('.kb-col').dataset.k, can = c.getAttribute('draggable') === 'true'; c.removeAttribute('draggable');
    if (can) c.dataset.can = 'done'; else if (col === 'done' && isManager() && c.querySelector('[data-act="approve"]')) c.dataset.can = 'reject';
  });
  if (!board.dataset.v5) {
    board.dataset.v5 = '1';
    board.addEventListener('pointerdown', onDown);
    board.addEventListener('click', e => {
      if (Date.now() - V5.noClick < 350) return;
      const card = e.target.closest('.kb-card'); if (!card) return; const id = +card.dataset.id, b = e.target.closest('[data-act]');
      if (b) { e.stopPropagation(); b.dataset.act === 'done' ? markDone(id) : approveTask(id); return; }
      viewTaskDetail(id);
    });
  }
}
const _rtl5 = window.renderTaskList;
window.renderTaskList = function () { _rtl5(); enhanceKanban(); };

/* ============================================================
   4) QUICK ADD ฉลาดขึ้น + งานซ้ำ (Recurring)
   ============================================================ */
const PRI = { critical:'Critical','วิกฤต':'Critical','ด่วนมาก':'Critical', high:'High','สูง':'High','ด่วน':'High', medium:'Medium','กลาง':'Medium', low:'Low','ต่ำ':'Low' };
const DAYW = { 'วันนี้':0, today:0, 'พรุ่งนี้':1, tomorrow:1, 'มะรืน':2, 'มะรืนนี้':2 };
const WD = { 'อาทิตย์':0,'จันทร์':1,'อังคาร':2,'พุธ':3,'พฤหัส':4,'พฤหัสบดี':4,'ศุกร์':5,'เสาร์':6, sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6 };
const TIME_RE = /^(\d{1,2})[:.](\d{2})(?:น\.?)?$/;
const okTime = m => m && +m[1] < 24 && +m[2] < 60 ? `${String(m[1]).padStart(2,'0')}:${m[2]}` : null;

// ---- ความถี่การใช้งาน (เก็บในเครื่อง ไม่ใช้ DB) ----
const FKEY = () => 'wf5_freq_' + me();
const freq = () => store(FKEY()) || { u: {}, c: {}, kw: {} };
const words = t => { const s = String(t).toLowerCase(); try { if (window.Intl && Intl.Segmenter) return [...new Intl.Segmenter('th', { granularity: 'word' }).segment(s)].filter(x => x.isWordLike).map(x => x.segment).filter(w => w.length >= 2); } catch (e) {} return s.split(/\s+/).filter(w => w.length >= 2); };
function learn(o) {
  const f = freq();
  if (o.assign && o.assign !== me()) f.u[o.assign] = (f.u[o.assign] || 0) + 1;
  if (o.cat) { f.c[o.cat] = (f.c[o.cat] || 0) + 1; words(o.title || '').slice(0, 8).forEach(w => { f.kw[w] = f.kw[w] || {}; f.kw[w][o.cat] = (f.kw[w][o.cat] || 0) + 1; }); }
  const ks = Object.keys(f.kw); if (ks.length > 300) ks.slice(0, ks.length - 300).forEach(k => delete f.kw[k]);
  store(FKEY(), f);
}
function guessCat(title) {
  const f = freq(), score = {};
  words(title).forEach(w => Object.entries(f.kw[w] || {}).forEach(([c, n]) => score[c] = (score[c] || 0) + n));
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 && categoriesCache.some(c => c.name === best[0]) ? best[0] : null;
}
const findUser = q => { const ql = q.toLowerCase(), f = freq();
  return getTeamUsers().filter(u => u.isActive !== false && ((u.fullName || '') + ' ' + (u.username || '')).toLowerCase().includes(ql))
    .sort((a, b) => ((b.username || '').toLowerCase() === ql) - ((a.username || '').toLowerCase() === ql) || (f.u[b.id] || 0) - (f.u[a.id] || 0))[0]; };
const findCat = q => { const ql = q.toLowerCase(), f = freq();
  return categoriesCache.filter(c => c.name.toLowerCase().replace(/\s+/g, '').includes(ql)).sort((a, b) => (f.c[b.name] || 0) - (f.c[a.name] || 0))[0]; };

// ---- กติกางานซ้ำ ----
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
function recMatch(r, d) { const w = d.getDay(); switch (r.freq) { case 'daily': return true; case 'weekdays': return w > 0 && w < 6; case 'weekly': return w === r.wd; case 'monthly': return d.getDate() === Math.min(r.dom, dim(d.getFullYear(), d.getMonth())); } return false; }
function recFirst(r, from) { const d = new Date(from); d.setHours(0,0,0,0); for (let i = 0; i < 400; i++) { if (recMatch(r, d)) return d; d.setDate(d.getDate() + 1); } return d; }
function recNext(r, after) { const d = new Date(after); d.setHours(0,0,0,0); d.setDate(d.getDate() + 1); return recFirst(r, d); }
const recText = r => r.freq === 'daily' ? 'ทุกวัน' : r.freq === 'weekdays' ? 'ทุกวันทำงาน (จ.–ศ.)' : r.freq === 'weekly' ? `ทุกวัน${DAYN[r.wd]}` : `ทุกเดือน วันที่ ${r.dom}`;
function extractRec(text) {
  let s = text, m, rec = null;
  const cut = re => { const mm = s.match(re); if (mm) s = s.replace(re, ' '); return mm; };
  if (cut(/ทุก\s*วัน\s*ทำงาน|จันทร์\s*[-–]\s*ศุกร์|weekdays?\b/i)) rec = { freq: 'weekdays' };
  else if ((m = cut(/ทุก\s*(?:วัน\s*)?(จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์)|ทุก\s*วัน\s*(อาทิตย์)/))) rec = { freq: 'weekly', wd: WD[m[1] || m[2]] };
  else if ((m = cut(/every\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*/i))) rec = { freq: 'weekly', wd: WD[m[1].toLowerCase()] };
  else if ((m = cut(/ทุก\s*(?:เดือน\s*)?วันที่\s*(\d{1,2})/))) rec = { freq: 'monthly', dom: Math.min(31, Math.max(1, +m[1])) };
  else if (cut(/ทุก\s*เดือน|monthly/i)) rec = { freq: 'monthly' };
  else if (cut(/ทุก\s*(?:สัปดาห์|อาทิตย์)|weekly/i)) rec = { freq: 'weekly' };
  else if (cut(/ทุก\s*วัน|every\s*day|daily/i)) rec = { freq: 'daily' };
  return { rec, text: s };
}
function parseQuick5(raw) {
  const { rec, text } = extractRec(raw);
  const o = { title: '', priority: null, deadline: null, startTime: null, endTime: null, points: null, assignee: null, assigneeId: null, category: null, catGuess: false, rec };
  const T = text.trim().split(/\s+/).filter(Boolean), rest = []; let m;
  for (let i = 0; i < T.length; i++) {
    const w = T[i], lw = w.toLowerCase().replace(/^!/, ''), nx = (T[i+1] || '').toLowerCase();
    if (PRI[lw]) { o.priority = PRI[lw]; continue; }
    if (DAYW[lw] !== undefined) { o.deadline = addDays(DAYW[lw]); continue; }
    if (lw === 'อีก' && /^\d+$/.test(nx) && /^(วัน|days?)$/.test((T[i+2] || '').toLowerCase())) { o.deadline = addDays(+nx); i += 2; continue; }
    if ((m = lw.match(/^(\d+)(วัน|d)$/))) { o.deadline = addDays(+m[1]); continue; }
    if (lw === 'สัปดาห์' && nx === 'หน้า') { o.deadline = addDays(7); i++; continue; }
    if (lw === 'สัปดาห์หน้า' || lw === 'nextweek') { o.deadline = addDays(7); continue; }
    if (lw === 'สิ้นเดือน' || lw === 'eom') { const d = new Date(); o.deadline = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); continue; }
    const wdn = lw.replace(/^วัน/, '');
    if (WD[wdn] !== undefined) { let diff = (WD[wdn] - new Date().getDay() + 7) % 7; if (!diff) diff = 7; o.deadline = addDays(diff); continue; }
    if ((m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) {
      let y = m[3] ? +m[3] : new Date().getFullYear(); if (y > 2400) y -= 543; if (y < 100) y += 2000;
      const d = new Date(y, +m[2] - 1, +m[1]); if (d.getMonth() === +m[2] - 1) { o.deadline = ymd(d); continue; }
    }
    if ((lw === 'ก่อน' || lw === 'เริ่ม') && (m = TIME_RE.exec(T[i+1] || '')) && okTime(m)) { o[lw === 'เริ่ม' ? 'startTime' : 'endTime'] = okTime(m); i++; continue; }
    if ((m = TIME_RE.exec(w)) && okTime(m)) { o.endTime = okTime(m); continue; }
    if ((m = lw.match(/^(\d+)(pt|pts|คะแนน)$/))) { o.points = +m[1]; continue; }
    if (/^\d+$/.test(lw) && /^(pt|pts|คะแนน)$/.test(nx)) { o.points = +lw; i++; continue; }
    if (w.startsWith('@') && w.length > 1) { const u = findUser(w.slice(1)); if (u) { o.assignee = u.fullName; o.assigneeId = u.id; continue; } }
    if (w.startsWith('#') && w.length > 1) { const c = findCat(w.slice(1)); if (c) { o.category = c.name; continue; } }
    rest.push(w);
  }
  o.title = rest.join(' ');
  if (!o.category && o.title) { const g = guessCat(o.title); if (g) { o.category = g; o.catGuess = true; } }
  if (rec) {
    const base = o.deadline ? dateOf(o.deadline) : new Date();
    if (rec.freq === 'weekly' && rec.wd == null) rec.wd = base.getDay();
    if (rec.freq === 'monthly' && rec.dom == null) rec.dom = base.getDate();
    if (!o.deadline) o.deadline = ymd(recFirst(rec, new Date()));
  }
  return o;
}
function qaPreview() {
  const p = parseQuick5($('v4-qa-in').value), ch = [];
  if (p.title) ch.push('📝 ' + esc(p.title)); if (p.priority) ch.push('⚡ ' + p.priority);
  if (p.deadline) ch.push('📅 ' + fmtDate(p.deadline)); if (p.startTime) ch.push('⏰ เริ่ม ' + p.startTime); if (p.endTime) ch.push('🔚 ' + p.endTime);
  if (p.points) ch.push('⭐ ' + p.points + ' pt'); if (p.assignee) ch.push('👤 ' + esc(p.assignee));
  if (p.category) ch.push('📂 ' + esc(p.category) + (p.catGuess ? ' (เดาให้)' : '')); if (p.rec) ch.push('🔁 ' + esc(recText(p.rec)));
  $('v4-qa-prev').innerHTML = ch.map(c => `<span class="v4-chip">${c}</span>`).join('') || '<span style="color:var(--text-sub);font-size:.8rem">ตัวอย่าง: "ตรวจเช็คเครื่องจักร ทุกวันจันทร์ @สมชาย #ซ่อมบำรุง 20pt" หรือ "ส่งรายงาน พรุ่งนี้ high 17:00"</span>';
}
function qaSuggest() {
  const inp = $('v4-qa-in'), box = $('v5-qa-sug'); if (!inp || !box) return;
  const v = inp.value, last = (v.match(/(\S*)$/) || ['', ''])[1], f = freq(); let items = [], replace = false;
  if (last.startsWith('@')) { replace = true; const q = last.slice(1).toLowerCase();
    items = getTeamUsers().filter(u => u.isActive !== false && (!q || ((u.fullName || '') + ' ' + (u.username || '')).toLowerCase().includes(q))).sort((a, b) => (f.u[b.id] || 0) - (f.u[a.id] || 0)).slice(0, 6)
      .map(u => ({ tok: '@' + (u.username || String(u.fullName).split(' ')[0]), label: '👤 ' + u.fullName })); }
  else if (last.startsWith('#')) { replace = true; const q = last.slice(1).toLowerCase().replace(/\s+/g, '');
    items = categoriesCache.filter(c => !q || c.name.toLowerCase().replace(/\s+/g, '').includes(q)).sort((a, b) => (f.c[b.name] || 0) - (f.c[a.name] || 0)).slice(0, 6)
      .map(c => ({ tok: '#' + c.name.replace(/\s+/g, ''), label: '📂 ' + c.name })); }
  else {
    items = getTeamUsers().filter(u => f.u[u.id] > 0).sort((a, b) => f.u[b.id] - f.u[a.id]).slice(0, 3).map(u => ({ tok: '@' + (u.username || String(u.fullName).split(' ')[0]), label: '👤 ' + u.fullName }))
      .concat(categoriesCache.filter(c => f.c[c.name] > 0).sort((a, b) => f.c[b.name] - f.c[a.name]).slice(0, 3).map(c => ({ tok: '#' + c.name.replace(/\s+/g, ''), label: '📂 ' + c.name })))
      .concat([{ tok: 'ทุกวันจันทร์', label: '🔁 ทุกวันจันทร์' }, { tok: 'ทุกวันทำงาน', label: '🔁 ทุกวันทำงาน' }, { tok: 'ทุกเดือน', label: '🔁 ทุกเดือน' }]);
  }
  V5.qaItems = items.map(i => ({ ...i, replace }));
  box.innerHTML = items.length ? `<div style="font-size:.7rem;color:var(--text-light);margin-bottom:2px">${replace ? 'เลือกเพื่อเติมอัตโนมัติ' : 'ใช้บ่อย / ทางลัด'}</div>` + items.map((it, k) => `<span class="v4-chip" style="cursor:pointer;background:rgba(100,116,139,.13);color:var(--text-main)" onclick="WF5.qaPick(${k})">${esc(it.label)}</span>`).join('') : '';
}
WF5.qaPick = k => {
  const it = V5.qaItems[k], inp = $('v4-qa-in'); if (!it) return;
  inp.value = it.replace ? inp.value.replace(/\S*$/, '') + it.tok + ' ' : (inp.value.replace(/\s*$/, ' ') + it.tok + ' ').replace(/^\s+/, '');
  inp.focus(); qaPreview(); qaSuggest();
};
const _oq5 = WF4.openQuick; WF4.openQuick = txt => { _oq5(txt); qaPreview(); qaSuggest(); };
WF4.submitQuick = () => {
  const p = parseQuick5($('v4-qa-in').value); if (!p.title) return toast('กรุณาพิมพ์ชื่องาน', 'warning');
  WF4.closeQuick(); openNewTaskModal();
  $('task-title').value = p.title;
  if (p.priority) $('task-priority').value = p.priority;
  if (p.deadline) $('task-deadline').value = p.deadline;
  if (p.startTime) $('task-start-time').value = p.startTime;
  if (p.endTime) $('task-end-time').value = p.endTime;
  if (p.points && isManager()) $('task-points').value = p.points;
  if (p.category && [...$('task-category').options].some(o => o.value === p.category)) $('task-category').value = p.category;
  if (p.assigneeId) { const a = $('task-assign'); if (a && [...a.options].some(o => o.value === p.assigneeId)) { a.value = p.assigneeId; a.onchange && a.onchange.call(a); } }
  if (p.rec) { V5.rec = { wd: p.rec.wd ?? null, dom: p.rec.dom ?? null }; $('v5-rec-sel').value = p.rec.freq; WF5.recChange(); }
  toast(p.rec ? `แปลงเป็นฟอร์มแล้ว 🔁 ${recText(p.rec)} — ตรวจสอบแล้วกดบันทึก` : 'แปลงข้อความเป็นฟอร์มแล้ว ตรวจสอบแล้วกดบันทึกได้เลย', 'info');
};

// ---- ช่องเลือก "ทำซ้ำ" ในฟอร์มงาน ----
const baseDate = () => { const dl = $('task-deadline').value; const d = dl ? dateOf(dl) : new Date(); d.setHours(0,0,0,0); return d; };
function buildRule(f) { const b = baseDate(), r = { freq: f }; if (f === 'weekly') r.wd = V5.rec.wd ?? b.getDay(); if (f === 'monthly') r.dom = V5.rec.dom ?? b.getDate(); return r; }
WF5.recChange = () => {
  const sel = $('v5-rec-sel'), note = $('v5-rec-note'); if (!sel || !note) return;
  if (!sel.value) { note.textContent = ''; return; }
  const r = buildRule(sel.value);
  note.innerHTML = `🔁 <strong>${esc(recText(r))}</strong> — บันทึกงานนี้ 1 งานตอนนี้ แล้วระบบจะสร้างรอบถัดไปให้เอง (เริ่ม ${fmtDate(ymd(recNext(r, baseDate())))}) • งานรอบใหม่จะถูกสร้างเมื่อคุณเปิดแอป`;
};
WF5.recManual = () => { V5.rec = { wd: null, dom: null }; WF5.recChange(); };
const _ont5 = window.openNewTaskModal;
window.openNewTaskModal = function () { _ont5(); V5.rec = { wd: null, dom: null }; $('v5-rec-sel').value = ''; $('v5-rec-group').style.display = ''; WF5.recChange(); };
const _et5 = window.editTask;
window.editTask = function (id) { _et5(id); $('v5-rec-group').style.display = 'none'; };
const _st5 = window.saveTask;
window.saveTask = async function () {
  const editId = $('task-edit-id').value;
  const snap = { assign: $('task-assign')?.value, cat: $('task-category')?.value, title: $('task-title').value.trim() };
  const recSel = !editId ? $('v5-rec-sel').value : '';
  let ruleRow = null;
  if (recSel) {
    const r = buildRule(recSel), subs = [...document.querySelectorAll('#v4-sub-list input')].map(i => i.value.trim()).filter(Boolean).map(t => ({ t: t.slice(0, 100), d: false }));
    ruleRow = { owner_id: me(), name: snap.title.slice(0, 120), freq: r.freq, weekday: r.wd ?? null, month_day: r.dom ?? null, next_due: ymd(recNext(r, baseDate())), lead_days: 1,
      data: { title: snap.title, desc: $('task-desc').value, category: snap.cat, priority: $('task-priority').value, points: isManager() ? (parseInt($('task-points').value) || 0) : 0,
        startTime: $('task-start-time').value, endTime: $('task-end-time').value, assignedTo: snap.assign || me(), source: $('task-source').value, subtasks: subs } };
  }
  await _st5();
  if ($('modal-task').classList.contains('open')) return;           // บันทึกไม่ผ่าน (ฟอร์มยังเปิดอยู่)
  learn(snap);
  if (ruleRow) {
    try { const { error } = await supabase.from('recurring_tasks').insert(ruleRow); if (error) throw error; toast(`🔁 ตั้งงานซ้ำแล้ว — รอบถัดไป ${fmtDate(ruleRow.next_due)}`, 'success', 5000); }
    catch (e) { toast('บันทึกงานแล้ว แต่ตั้งงานซ้ำไม่สำเร็จ: ' + esc(e.message) + ' (ลืมรัน migration_v5.sql?)', 'warning', 7000); }
  }
};

// ---- สร้างงานซ้ำอัตโนมัติ (ทำฝั่งผู้ใช้ตอนเปิดแอป ใช้ RPC create_task เดิม) ----
async function runRecurring() {
  if (!currentUser) return; V5.recLast = Date.now();
  try {
    const { data, error } = await supabase.from('recurring_tasks').select('id, data, freq, weekday, month_day, next_due, lead_days').eq('owner_id', me()).eq('active', true).lte('next_due', addDays(3)).limit(30);
    if (error) return;                                                // ยังไม่ได้รัน migration → เงียบไว้
    const today = todayStr(); let made = 0;
    for (const r of (data || [])) {
      if (r.next_due > addDays(r.lead_days ?? 1)) continue;
      const rule = { freq: r.freq, wd: r.weekday, dom: r.month_day };
      const dl = r.next_due < today ? today : r.next_due;
      const nxt = ymd(recNext(rule, dateOf(dl)));
      const { data: claimed, error: ce } = await supabase.from('recurring_tasks').update({ next_due: nxt, last_created: today }).eq('id', r.id).eq('next_due', r.next_due).select('id');
      if (ce || !claimed || !claimed.length) continue;                // อีกเครื่องสร้างไปแล้ว กันงานซ้ำ
      const d = r.data || {};
      try {
        const res = await callAPI('CREATE_TASK', { title: d.title, desc: d.desc || '', category: d.category, priority: d.priority || 'Medium', points: d.points || 0, source: d.source || 'assigned', assignedTo: d.assignedTo || me(), startDate: today, startTime: d.startTime || '', deadline: dl, endTime: d.endTime || '', link: '', imageData: '', imageData2: '', imageData3: '' });
        if (d.subtasks && d.subtasks.length && res.id) await supabase.from('tasks').update({ subtasks: d.subtasks.map(s => ({ t: s.t, d: false })) }).eq('id', res.id);
        made++;
      } catch (e) { console.warn('[v5] create recurring failed', e); await supabase.from('recurring_tasks').update({ next_due: r.next_due }).eq('id', r.id); }
    }
    if (made) { toast(`🔁 สร้างงานซ้ำอัตโนมัติ ${made} งาน`, 'success', 5000); notifBuilt = false; await refreshCurrentPage(); }
  } catch (e) { console.warn('[v5] runRecurring', e); }
}
WF5.openRec = async () => {
  openModal('v5-rec-modal'); const el = $('v5-rec-list'); el.innerHTML = '<div style="padding:12px;color:var(--text-sub)">กำลังโหลด...</div>';
  try {
    const { data, error } = await supabase.from('recurring_tasks').select('id, name, data, freq, weekday, month_day, next_due, active').eq('owner_id', me()).order('id', { ascending: false }).limit(50);
    if (error) throw error;
    el.innerHTML = (data || []).map(r => `<div class="cat-item" style="${r.active ? '' : 'opacity:.55'}"><div style="flex:1;min-width:0"><strong>${esc(r.name)}</strong><div style="font-size:.76rem;color:var(--text-sub)">🔁 ${esc(recText({ freq: r.freq, wd: r.weekday, dom: r.month_day }))} · รอบถัดไป ${fmtDate(r.next_due)} · 👤 ${esc(getUserName(r.data && r.data.assignedTo))}</div></div>
      <button class="btn btn-secondary btn-sm" onclick="WF5.recToggle(${r.id},${!r.active})">${r.active ? '⏸' : '▶'}</button><button class="btn btn-danger btn-sm" style="margin-left:6px" onclick="WF5.recDel(${r.id})">🗑</button></div>`).join('')
      || '<div class="empty-state" style="padding:20px"><p>ยังไม่มีงานซ้ำ — ตอนสร้างงานให้เลือก "ทำซ้ำอัตโนมัติ" หรือพิมพ์ใน Quick Add เช่น "ตรวจเครื่อง ทุกวันจันทร์"</p></div>';
  } catch (e) { el.innerHTML = `<div class="empty-state"><p>${esc(e.message)}<br><small>(ถ้าเพิ่งติดตั้ง ให้ตรวจว่ารัน migration_v5.sql แล้ว)</small></p></div>`; }
};
WF5.recToggle = async (id, active) => { const { error } = await supabase.from('recurring_tasks').update({ active }).eq('id', id); if (error) return toast(esc(error.message), 'error'); WF5.openRec(); };
WF5.recDel = async id => { if (!confirm('ลบงานซ้ำนี้? (งานที่สร้างไปแล้วจะไม่ถูกลบ)')) return; const { error } = await supabase.from('recurring_tasks').delete().eq('id', id); if (error) return toast(esc(error.message), 'error'); WF5.openRec(); };

/* ============================================================
   5) TEAM WORKLOAD (คำนวณจาก tasksCache ไม่ยิง DB เพิ่ม)
   ============================================================ */
function renderWorkload() {
  const el = $('dashtab-workload'); if (!el) return;
  const today = todayStr(), soon = addDays(3), members = getTeamUsers().filter(u => u.isActive !== false);
  const rows = members.map(u => {
    const ts = tasksCache.filter(t => t.assignedTo === u.id && !['done','cancelled'].includes(t.status));
    const over = ts.filter(t => t.deadline && t.deadline < today).length, sn = ts.filter(t => t.deadline && t.deadline >= today && t.deadline <= soon).length;
    return { u, ts, over, sn, later: ts.length - over - sn, pts: ts.reduce((s, t) => s + (t.points || 0), 0), score: over * 2 + sn * 1.5 + (ts.length - over - sn),
      strip: [...Array(7)].map((_, i) => ts.filter(t => t.deadline === addDays(i)).length) };
  }).sort((a, b) => b.score - a.score);
  const avg = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0, maxC = Math.max(1, ...rows.map(r => r.ts.length));
  const lvl = r => r.score === 0 ? ['ว่าง', '#16A34A'] : r.score < avg * .6 ? ['เบา', '#16A34A'] : r.score < avg * 1.3 ? ['สมดุล', '#0891B2'] : r.score < avg * 1.8 ? ['หนัก', '#D97706'] : ['ล้นมือ', '#DC2626'];
  const hi = rows[0], lo = rows[rows.length - 1];
  const tip = (rows.length > 1 && hi.score > avg * 1.5 && lo.score <= avg) ? `💡 <strong>${esc(hi.u.fullName)}</strong> งานหนักกว่าเฉลี่ย — พิจารณาย้ายบางงานให้ <strong>${esc(lo.u.fullName)}</strong> (กดชื่อเพื่อดูงานและย้าย)` : '✅ การกระจายงานค่อนข้างสมดุล';
  el.innerHTML = `<div class="card"><div class="card-header"><span>⚖️ ภาระงานทีม (งานที่ยังไม่เสร็จ)</span><button class="btn btn-secondary btn-sm" onclick="WF5.refreshTeam()">↻ โหลดข้อมูลใหม่</button></div>
    <div style="padding:12px 20px;font-size:.84rem;background:var(--bg)">${tip}<div style="font-size:.74rem;color:var(--text-sub);margin-top:4px">คะแนนภาระ = เกินกำหนด×2 + ครบใน 3 วัน×1.5 + อื่นๆ×1 · ช่อง 7 วันแสดงจำนวนงานที่ครบกำหนดในแต่ละวัน (วันนี้ → +6)</div></div>
    ${rows.map(r => { const [lt, lc] = lvl(r), open = V5.wlOpen.has(r.u.id), others = members.filter(m => m.id !== r.u.id);
      return `<div class="v5-wl"><div class="v5-wl-head" onclick="WF5.wlToggle('${r.u.id}')">${avatarHtml(r.u.id, 32)}
        <div style="flex:1;min-width:150px"><div style="font-weight:700;font-size:.9rem">${esc(r.u.fullName)} <span style="font-size:.7rem;font-weight:700;color:#fff;background:${lc};padding:2px 8px;border-radius:10px">${lt}</span></div>
          <div class="v5-bar" style="margin-top:6px"><div style="width:${r.over / maxC * 100}%;background:#DC2626"></div><div style="width:${r.sn / maxC * 100}%;background:#F59E0B"></div><div style="width:${r.later / maxC * 100}%;background:#94A3B8"></div></div></div>
        <div style="font-size:.76rem;color:var(--text-sub);min-width:130px">🔴 ${r.over} · 🟠 ${r.sn} · ⚪ ${r.later}<br>รวม ${r.ts.length} งาน · ⭐ ${r.pts} pt</div>
        <div class="v5-strip">${r.strip.map(n => `<div class="v5-sq" style="${n ? `background:rgba(15,118,110,${Math.min(1, .25 + n * .25)});color:#fff` : ''}">${n || ''}</div>`).join('')}</div><span style="color:var(--text-sub)">${open ? '▲' : '▼'}</span></div>
        ${open ? `<div style="margin-top:10px;padding-left:6px">${r.ts.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).slice(0, 12).map(t => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px dashed var(--border);flex-wrap:wrap">
          <span style="width:8px;height:8px;border-radius:50%;background:${priorityColor(t.priority)}"></span><span style="flex:1;min-width:140px;font-size:.84rem;cursor:pointer" onclick="navigate('tasks');setTimeout(()=>viewTaskDetail(${t.id}),200)">${esc(t.title)}</span>
          <span style="font-size:.74rem;color:${t.deadline && t.deadline < today ? 'var(--danger)' : 'var(--text-sub)'}">📅 ${fmtDate(t.deadline)}</span>
          <select class="adv-filter-select" style="width:150px" onchange="WF5.reassign(${t.id},this.value)"><option value="">ย้ายให้…</option>${others.map(m => `<option value="${m.id}">${esc(m.fullName)}</option>`).join('')}</select></div>`).join('') || '<div style="font-size:.82rem;color:var(--text-sub)">ไม่มีงานค้าง 🎉</div>'}
          ${r.ts.length > 12 ? `<div style="font-size:.76rem;color:var(--text-sub)">แสดง 12 จาก ${r.ts.length} งาน</div>` : ''}<button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="WF5.filterAssignee('${r.u.id}')">🔍 ดูงานทั้งหมดของคนนี้</button></div>` : ''}</div>`; }).join('') || '<div class="empty-state"><p>ไม่มีสมาชิกในทีม</p></div>'}</div>`;
}
WF5.wlToggle = id => { V5.wlOpen.has(id) ? V5.wlOpen.delete(id) : V5.wlOpen.add(id); renderWorkload(); };
WF5.refreshTeam = async () => { showLoading(); try { const r = await callAPI('GET_TASKS'); tasksCache = r.data || tasksCache; renderWorkload(); } catch (e) { toast(esc(e.message), 'error'); } finally { hideLoading(); } };
WF5.reassign = async (id, uid) => {
  if (!uid) return; const tk = tasksCache.find(x => x.id == id); if (!tk) return;
  if (!confirm(`ย้ายงาน "${tk.title}" ให้ ${getUserName(uid)}?`)) return renderWorkload();
  showLoading();
  try { await callAPI('UPDATE_TASK', { id: tk.id, assignedTo: uid }); tk.assignedTo = uid; toast('ย้ายงานแล้ว ✅', 'success'); }
  catch (e) { toast(esc(e.message), 'error'); } finally { hideLoading(); renderWorkload(); }
};
WF5.filterAssignee = id => { navigate('tasks'); taskFilter = 'all'; _populateAdvFilterDropdowns(); const a = $('af-assignee'); if (a) { a.value = id; renderTaskList(); } };

/* ============================================================
   6) เจาะลึก (RPC dashboard_insights + fallback คำนวณในเครื่อง)
   ============================================================ */
function localInsight(scope, days) {
  const today = todayStr(), from = Date.now() - days * 86400000, from84 = Date.now() - 84 * 86400000;
  const ts = scope === 'me' ? tasksCache.filter(t => t.assignedTo === me()) : tasksCache.slice();
  const deptOf = t => (usersCache.find(u => u.id === t.assignedTo) || {}).department || 'ไม่ระบุแผนก';
  const cd = t => { if (!t.startDate) return null; const k = isoDate(t.completedAt); return k ? Math.max(0, Math.round((dateOf(k) - dateOf(t.startDate)) / 86400000)) : null; };
  const avg = a => { a = a.filter(x => x != null); return a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : null; };
  const open = ts.filter(t => !['done','cancelled'].includes(t.status)), over = open.filter(t => t.deadline && t.deadline < today);
  const dn = ts.filter(t => t.status === 'done' && t.completedAt && isoDt(t.completedAt) >= from), ad = dn.filter(t => t.source === 'assigned' && t.deadline);
  const dp = {}, D = n => dp[n] || (dp[n] = { dept: n, open: 0, overdue: 0, done: 0, _c: [] });
  open.forEach(t => D(deptOf(t)).open++); over.forEach(t => D(deptOf(t)).overdue++); dn.forEach(t => { const x = D(deptOf(t)); x.done++; x._c.push(cd(t)); });
  const ct = {}; dn.forEach(t => { const n = t.category || 'ไม่ระบุ'; ct[n] = ct[n] || { category: n, done: 0, _c: [] }; ct[n].done++; ct[n]._c.push(cd(t)); });
  const hm = {}; dn.forEach(t => { const d = isoDt(t.completedAt), k = d.getDay() + '_' + d.getHours(); hm[k] = (hm[k] || 0) + 1; });
  const wk = {}; ts.filter(t => t.status === 'done' && t.completedAt && isoDt(t.completedAt) >= from84).forEach(t => { const d = isoDt(t.completedAt); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const k = ymd(d); wk[k] = (wk[k] || 0) + 1; });
  return { summary: { done: dn.length, open: open.length, overdue: over.length, avg_close_days: avg(dn.map(cd)), on_time_rate: ad.length ? Math.round(ad.filter(t => isoDate(t.completedAt) <= t.deadline).length / ad.length * 100) : null },
    by_dept: Object.values(dp).map(x => ({ dept: x.dept, open: x.open, overdue: x.overdue, done: x.done, avg_close_days: avg(x._c) })).sort((a, b) => b.open - a.open),
    by_category: Object.values(ct).map(x => ({ category: x.category, done: x.done, avg_close_days: avg(x._c) })).sort((a, b) => b.done - a.done).slice(0, 8),
    heatmap: Object.entries(hm).map(([k, n]) => { const [dow, hr] = k.split('_'); return { dow: +dow, hr: +hr, n }; }),
    weekly: Object.entries(wk).map(([w, done]) => ({ w, done })) };
}
function insightHtml(c) {
  const d = c.data || {}, s = d.summary || {}, dept = d.by_dept || [], cat = d.by_category || [];
  const kp = (v, l, col) => `<div class="v5-kpi"><div class="v5-kv" style="color:${col}">${v}</div><div class="v5-kl">${l}</div></div>`;
  const dmax = Math.max(1, ...dept.map(x => +x.open || 0)), cmax = Math.max(1, ...cat.map(x => +x.done || 0));
  const grid = {}; let mx = 0, peak = null;
  (d.heatmap || []).forEach(h => { grid[h.dow + '_' + h.hr] = h.n; if (h.n > mx) { mx = h.n; peak = h; } });
  const order = [1, 2, 3, 4, 5, 6, 0], lab = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const hm = `<div style="overflow-x:auto"><div class="v5-hm"><span></span>${[...Array(24)].map((_, h) => `<span style="text-align:center">${h % 3 === 0 ? h : ''}</span>`).join('')}
    ${order.map(dw => `<span style="line-height:20px">${lab[dw]}</span>` + [...Array(24)].map((_, h) => { const n = grid[dw + '_' + h] || 0; return `<i title="${lab[dw]} ${String(h).padStart(2, '0')}:00 — ${n} งาน" style="${n ? `background:rgba(15,118,110,${(.18 + .82 * n / mx).toFixed(2)})` : ''}"></i>`; }).join('')).join('')}</div></div>`;
  return `${c.src === 'local' ? `<div class="deduction-warning">⚠️ ยังดึงจากฐานข้อมูลไม่ได้ (${esc(c.err || '')}) — แสดงผลจากข้อมูลที่โหลดในเครื่องแทน ตรวจว่ารัน migration_v5.sql แล้ว</div>` : ''}
    <div class="v5-kpis">${kp(s.done ?? 0, 'งานเสร็จ (ช่วงที่เลือก)', 'var(--success)')}${kp(s.avg_close_days == null ? '—' : s.avg_close_days + ' วัน', 'เวลาปิดงานเฉลี่ย', 'var(--secondary)')}${kp(s.on_time_rate == null ? '—' : s.on_time_rate + '%', 'ส่งตรงเวลา', 'var(--primary)')}${kp(s.open ?? 0, 'งานค้างตอนนี้', 'var(--text-main)')}${kp(s.overdue ?? 0, 'เกินกำหนด', 'var(--danger)')}</div>
    <div style="font-weight:700;font-size:.9rem;margin:6px 0">📈 งานที่เสร็จรายสัปดาห์ (12 สัปดาห์ล่าสุด)</div><div style="position:relative;height:200px;margin-bottom:18px"><canvas id="v5-ins-week"></canvas></div>
    <div class="grid-2"><div><div style="font-weight:700;font-size:.9rem;margin-bottom:8px">🏢 งานค้างตามแผนก</div>${dept.map(x => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:.82rem"><strong>${esc(x.dept)}</strong><span style="color:var(--text-sub)">ค้าง ${x.open} · เกิน ${x.overdue} · เสร็จ ${x.done}${x.avg_close_days != null ? ' · เฉลี่ย ' + x.avg_close_days + ' วัน' : ''}</span></div>
        <div class="v5-bar" style="margin-top:4px"><div style="width:${(x.overdue / dmax) * 100}%;background:#DC2626"></div><div style="width:${((x.open - x.overdue) / dmax) * 100}%;background:#94A3B8"></div></div></div>`).join('') || '<div style="color:var(--text-sub);font-size:.84rem">ไม่มีข้อมูล</div>'}</div>
      <div><div style="font-weight:700;font-size:.9rem;margin-bottom:8px">📂 ประเภทงาน: จำนวนที่เสร็จ / เวลาปิดเฉลี่ย</div>${cat.map(x => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:.82rem"><strong>${esc(x.category)}</strong><span style="color:var(--text-sub)">${x.done} งาน${x.avg_close_days != null ? ' · ' + x.avg_close_days + ' วัน' : ''}</span></div>
        <div class="v5-bar" style="margin-top:4px"><div style="width:${(x.done / cmax) * 100}%;background:var(--primary)"></div></div></div>`).join('') || '<div style="color:var(--text-sub);font-size:.84rem">ไม่มีข้อมูล</div>'}</div></div>
    <div style="font-weight:700;font-size:.9rem;margin:14px 0 4px">🔥 Heatmap: ช่วงวัน-เวลาที่ปิดงานบ่อย</div>${peak ? `<div style="font-size:.78rem;color:var(--text-sub);margin-bottom:6px">ช่วงที่ปิดงานมากสุด: วัน${DAYN[peak.dow]} ${String(peak.hr).padStart(2, '0')}:00 (${peak.n} งาน)</div>` : ''}${hm}`;
}
async function renderInsight(force) {
  const el = $('dashtab-insight'); if (!el) return;
  const mgr = isManager(), scope = mgr ? (V5.insScope || 'team') : 'me', days = V5.insDays, key = scope + days;
  el.innerHTML = `<div class="card"><div class="card-header"><span>🔬 วิเคราะห์เชิงลึก</span><div style="display:flex;gap:8px;flex-wrap:wrap">
    ${mgr ? `<select class="select-field" id="v5-ins-scope" onchange="WF5.insSet()" style="padding:6px 10px;font-size:.82rem;max-width:150px"><option value="team" ${scope === 'team' ? 'selected' : ''}>👥 ทั้งทีม</option><option value="me" ${scope === 'me' ? 'selected' : ''}>👤 ของฉัน</option></select>` : ''}
    <select class="select-field" id="v5-ins-days" onchange="WF5.insSet()" style="padding:6px 10px;font-size:.82rem;max-width:140px">${[30, 90, 180].map(n => `<option value="${n}" ${days === n ? 'selected' : ''}>${n} วันล่าสุด</option>`).join('')}</select>
    <button class="btn btn-secondary btn-sm" onclick="WF5.insSet(true)">↻</button></div></div><div class="card-body" id="v5-ins-body"><div style="color:var(--text-sub)">กำลังคำนวณ...</div></div></div>`;
  let c = V5.ins[key];
  if (!c || force || Date.now() - c.at > 600000) {
    try { const { data, error } = await supabase.rpc('dashboard_insights', { p_days: days, p_user: scope === 'me' ? me() : null }); if (error) throw error; c = { at: Date.now(), data: data || {}, src: 'rpc' }; }
    catch (e) { c = { at: Date.now(), data: localInsight(scope, days), src: 'local', err: e.message }; }
    V5.ins[key] = c;
  }
  const body = $('v5-ins-body'); if (!body) return;
  body.innerHTML = insightHtml(c);
  const mon = new Date(); mon.setHours(0,0,0,0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const map = {}; ((c.data || {}).weekly || []).forEach(r => map[String(r.w).slice(0, 10)] = +r.done);
  const labels = [], vals = []; for (let i = 11; i >= 0; i--) { const d = new Date(mon); d.setDate(d.getDate() - 7 * i); const k = ymd(d); labels.push(k.slice(8, 10) + '/' + k.slice(5, 7)); vals.push(map[k] || 0); }
  const cv = $('v5-ins-week');
  if (cv && window.Chart) { if (V5.charts.week) V5.charts.week.destroy(); V5.charts.week = new Chart(cv, { type: 'bar', data: { labels, datasets: [{ label: 'งานที่เสร็จ', data: vals, backgroundColor: '#0F766E', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } }); }
}
WF5.insSet = force => { const s = $('v5-ins-scope'), d = $('v5-ins-days'); if (s) V5.insScope = s.value; if (d) V5.insDays = +d.value; renderInsight(force === true); };

const _sdt5 = window.switchDashTab;
window.switchDashTab = function (tab, el) { _sdt5(tab, el); if (tab === 'workload') renderWorkload(); else if (tab === 'insight') renderInsight(); };

/* ============================================================
   7) คีย์ลัด
   ============================================================ */
const KEYS = [['N','สร้างงานใหม่'],['Q','Quick Add (พิมพ์ประโยคสร้างงาน)'],['/','ไปหน้างานและค้นหา'],['Ctrl/⌘ + K','ค้นหาด่วน / คำสั่ง'],['V','สลับมุมมอง รายการ ↔ Kanban'],['F','เปิด/ปิดตัวกรองเพิ่มเติม (หน้างาน)'],['1 – 8','เลือกตัวกรองสถานะ (หน้างาน)'],
  ['[  ]','เดือนก่อน / ถัดไป (หน้าปฏิทิน)'],['T','สลับโหมดมืด/สว่าง'],['R','รีเฟรชหน้านี้'],['G แล้ว D','ไป แดชบอร์ด'],['G แล้ว T','ไป งาน'],['G แล้ว C','ไป ปฏิทิน'],['G แล้ว K','ไป KPI'],['G แล้ว B','ไป ความสำเร็จ'],
  ['G แล้ว E','ไป คำขอเลื่อน'],['G แล้ว P','ไป โปรไฟล์'],['G แล้ว S','ไป เงินเดือน'],['G แล้ว W','ภาระงานทีม (หัวหน้า)'],['G แล้ว I','เจาะลึก'],['G แล้ว R','จัดการงานซ้ำ'],['Ctrl/⌘ + Enter','บันทึก/ยืนยันในฟอร์มที่เปิดอยู่'],['Esc','ปิดหน้าต่าง'],['?','แสดงรายการคีย์ลัดนี้']];
WF5.openKeys = () => openModal('v5-keys-modal');
const GO = { d: 'dashboard', t: 'tasks', c: 'calendar', k: 'kpi', b: 'badges', e: 'extensions', p: 'profile', s: 'salary' };
document.addEventListener('keydown', e => {
  if (!currentUser || !$('main-app')?.classList.contains('active')) return;
  const tg = e.target, typing = tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable);
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const m = [['modal-task','saveTask'],['modal-mark-done','confirmMarkDone'],['modal-approve-points','confirmApproveWithPoints'],['modal-reject','confirmRejectTask'],['modal-reward','saveReward'],['modal-user','saveUser'],['modal-deduct','confirmDeduct']].find(x => $(x[0])?.classList.contains('open'));
    if (m) { e.preventDefault(); window[m[1]](); } return;
  }
  if (e.key === 'Escape') {
    if ($('v4-cmd')?.classList.contains('open') || $('v4-qa-ov')?.classList.contains('open')) return;
    if ($('modal-celebrate')?.classList.contains('open')) return closeCelebration();
    const ov = [...document.querySelectorAll('.modal-overlay.open')].pop(); if (ov) return closeModal(ov.id);
    if ($('notif-panel')?.classList.contains('open')) closeNotifPanel(); return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('.modal-overlay.open, #v4-cmd.open, #v4-qa-ov.open, #notif-panel.open')) return;
  const c = e.code;                                                  // ใช้ e.code → ใช้ได้แม้เปิดคีย์บอร์ดภาษาไทย
  if (V5.gWait) {
    V5.gWait = false; clearTimeout(V5.gTimer); e.preventDefault();
    const k = c.replace('Key', '').toLowerCase();
    if (GO[k] && !(k === 's' && false)) navigate(GO[k]);
    else if (k === 'w' && isManager()) { navigate('dashboard'); setTimeout(() => document.querySelector('[data-dashtab="workload"]')?.click(), 60); }
    else if (k === 'i') { navigate('dashboard'); setTimeout(() => document.querySelector('[data-dashtab="insight"]')?.click(), 60); }
    else if (k === 'r') WF5.openRec();
    else if (k === 'o' && isManager()) navigate('org');
    else if (k === 'u' && isAdmin()) navigate('users');
    return;
  }
  if (c === 'Slash' && e.shiftKey) { e.preventDefault(); return WF5.openKeys(); }
  if (e.shiftKey) return;
  if (c === 'KeyN') { e.preventDefault(); openNewTaskModal(); }
  else if (c === 'KeyQ') { e.preventDefault(); WF4.openQuick(''); }
  else if (c === 'Slash') { e.preventDefault(); navigate('tasks'); setTimeout(() => $('task-search')?.focus(), 150); }
  else if (c === 'KeyT') WF4.toggleTheme();
  else if (c === 'KeyV') { if (currentPage !== 'tasks') navigate('tasks'); WF4.toggleView(); }
  else if (c === 'KeyR') { refreshCurrentPage(); toast('รีเฟรชแล้ว', 'info', 1200); }
  else if (c === 'KeyF' && currentPage === 'tasks') { e.preventDefault(); toggleAdvFilter(); }
  else if (c === 'KeyG') { e.preventDefault(); V5.gWait = true; clearTimeout(V5.gTimer); V5.gTimer = setTimeout(() => V5.gWait = false, 1300); toast('G → ต่อด้วย D T C K B E P S W I R', 'info', 1300); }
  else if (/^Digit[1-8]$/.test(c) && currentPage === 'tasks') document.querySelectorAll('#page-tasks .filter-chip')[+c.slice(5) - 1]?.click();
  else if ((c === 'BracketLeft' || c === 'BracketRight') && currentPage === 'calendar') changeCalMonth(c === 'BracketLeft' ? -1 : 1);
});

/* ============================================================
   8) Wrap ฟังก์ชันเดิม + inject UI
   ============================================================ */
Object.assign(i18n.th, { 'nav.badges': 'ความสำเร็จ', 'page.badges': 'ความสำเร็จ' });
Object.assign(i18n.en, { 'nav.badges': 'Achievements', 'page.badges': 'Achievements' });

const _ld5 = window.loadDashboard;
window.loadDashboard = async function () { await _ld5(); try { refreshRankUI(); checkAch(); } catch (e) {} };
const _nav5 = window.navigate;
window.navigate = function (p) { _nav5(p); if (p === 'profile') { renderProfileAch(); checkAch(); } else if (p === 'badges') { renderAchPage(); checkAch(); } };
const _lid5 = window.loadInitialData;
window.loadInitialData = async function () { V5.ach = null; V5.ins = {}; V5.wlOpen.clear(); await _lid5(); setTimeout(runRecurring, 1500); };
document.addEventListener('visibilitychange', () => { if (!document.hidden && currentUser && Date.now() - V5.recLast > 2 * 3600000) runRecurring(); });

const _bl5 = window.buildLayout;
window.buildLayout = function () { _bl5(); injectUI5(); };
function injectUI5() {
  document.querySelectorAll('.version-badge').forEach(b => { b.textContent = b.closest('.login-logo') ? 'NEW v5.0' : 'v5.0'; });
  const ext = document.querySelector('.sidebar-nav .nav-item[data-page="extensions"]') || document.querySelector('.sidebar-nav .nav-item[data-page="kpi"]');
  if (ext) ext.insertAdjacentHTML('afterend', `<div class="nav-item" onclick="WF5.openRec()"><span class="nav-icon">🔁</span><span>งานซ้ำอัตโนมัติ</span></div><div class="nav-item" onclick="WF5.openKeys()"><span class="nav-icon">⌨️</span><span>คีย์ลัด (?)</span></div>`);
  const bt = document.querySelector('#page-badges .page-title'); if (bt) bt.textContent = '🏅 ' + t('nav.badges');
  const bs = document.querySelector('#page-badges .page-sub'); if (bs) bs.textContent = 'ความสำเร็จ 49 รายการ 5 หมวด — ปลดล็อกจากผลงานจริง เก็บถาวร ไม่รีเซ็ต';
  const hero = document.querySelector('#page-profile .profile-hero'); if (hero && !$('v5-profile-ach')) hero.insertAdjacentHTML('afterend', '<div id="v5-profile-ach"></div>');
  const tabs = document.querySelector('#page-dashboard .notif-tabs');
  if (tabs && !tabs.querySelector('[data-dashtab="insight"]')) {
    tabs.insertAdjacentHTML('beforeend', `${isManager() ? '<button class="notif-tab" data-dashtab="workload" onclick="switchDashTab(\'workload\',this)">⚖️ ภาระงานทีม</button>' : ''}<button class="notif-tab" data-dashtab="insight" onclick="switchDashTab('insight',this)">🔬 เจาะลึก</button>`);
    $('page-dashboard').insertAdjacentHTML('beforeend', '<div class="dash-tab-panel" id="dashtab-workload" style="display:none"></div><div class="dash-tab-panel" id="dashtab-insight" style="display:none"></div>');
  }
  const vb = $('v4-view-btn'); if (vb) vb.insertAdjacentHTML('beforebegin', '<button class="btn btn-secondary" onclick="WF5.openRec()" title="งานซ้ำอัตโนมัติ">🔁</button>');
}

/* ---------- คำอธิบายใน "?" ---------- */
function extendHelp() {
  const add = (k, items, tip) => { const h = PAGE_HELP[k]; if (!h || h._v5) return; h.items.push(...items); h._v5 = 1; if (tip) h.tip = (h.tip ? h.tip + ' | ' : '') + tip; };
  add('dashboard', [
    '🎮 ระดับขั้น (EXP) ตอนนี้มี 20 ระดับ ตั้งแต่ "มือใหม่หัดเดิน" ถึง "อมตะแห่งจักรวาลงาน" (ดูรายการเต็มได้ที่หน้าโปรไฟล์)',
    '⚖️ แท็บ "ภาระงานทีม" (หัวหน้า/Admin): แถบสีแดง=เกินกำหนด ส้ม=ครบใน 3 วัน เทา=อื่นๆ ช่องเล็ก 7 ช่อง=จำนวนงานที่ครบกำหนดแต่ละวัน กดชื่อเพื่อดูงานและเลือก "ย้ายให้…" เพื่อกระจายงาน',
    '🔬 แท็บ "เจาะลึก": เวลาปิดงานเฉลี่ย อัตราตรงเวลา งานค้างตามแผนก กราฟรายสัปดาห์ และ Heatmap ช่วงเวลาที่ปิดงาน (คำนวณในฐานข้อมูล ประหยัดโควต้า และแคช 10 นาที)',
    '⌨️ กด ? เพื่อดูคีย์ลัดทั้งหมด เช่น N=สร้างงาน Q=Quick Add G แล้ว W=ภาระงานทีม'
  ]);
  add('tasks', [
    '🗂 Kanban: ลากการ์ดไปคอลัมน์ "เสร็จสิ้น" แล้ว<strong>อัปเดตทันที</strong> (ถ้าบันทึกไม่สำเร็จจะคืนสถานะเดิมให้) บนมือถือให้ "กดการ์ดค้างไว้" ครู่หนึ่งแล้วลาก หัวหน้าลากงานที่ส่งแล้วไป "ตีกลับ" ได้',
    '🔁 งานซ้ำ: ในฟอร์มสร้างงานเลือก "ทำซ้ำอัตโนมัติ" (ทุกวัน/วันทำงาน/สัปดาห์/เดือน) หรือพิมพ์ใน Quick Add เช่น "ตรวจเช็คเครื่อง ทุกวันจันทร์" จัดการ/หยุดชั่วคราว/ลบได้ที่ปุ่ม 🔁 งานรอบใหม่จะถูกสร้างเมื่อผู้ตั้งเปิดแอป (ล่วงหน้า 1 วัน)',
    '⚡ Quick Add ฉลาดขึ้น: พิมพ์ @ หรือ # จะมีรายการแนะนำเรียงตามที่คุณใช้บ่อย, ระบบเดาหมวดงานจากชื่องานที่เคยสร้าง (ติดป้าย "เดาให้"), รองรับ "ทุกวัน / ทุกวันทำงาน / ทุกวันศุกร์ / ทุกเดือน / ทุกวันที่ 15"',
    '⌨️ คีย์ลัดหน้านี้: N สร้างงาน, / ค้นหา, V สลับมุมมอง, F ตัวกรอง, 1–8 เลือกสถานะ, Ctrl+Enter บันทึกฟอร์ม'
  ]);
  add('profile', [
    '🏅 การ์ด "ความสำเร็จของฉัน": แรงค์ปัจจุบัน/ความคืบหน้า สถิติผลงาน (อัตราตรงเวลา, ส่งงานติดต่อกัน, เวลาปิดงานเฉลี่ย) กราฟ 8 สัปดาห์ เหรียญล่าสุด และเป้าหมายถัดไป',
    'กด "ดูแรงค์ทั้งหมด" เพื่อดูเงื่อนไข EXP ของทั้ง 20 ระดับ'
  ], 'ความสำเร็จที่ปลดล็อกแล้วถูกบันทึกถาวร ไม่หายแม้สถิติเปลี่ยนภายหลัง');
  PAGE_HELP.badges = { intro: 'ความสำเร็จ (Achievement) 49 รายการ แบ่ง 5 หมวด ปลดล็อกจากข้อมูลงานจริงของคุณ',
    items: ['หมวด: ปริมาณงาน / ความตรงเวลา / วินัย / ทักษะ / ระดับขั้น กดชิปด้านบนเพื่อกรอง',
      'เหรียญมี 5 ระดับ 🥉🥈🥇💠👑 ยิ่งยากยิ่งระดับสูง และมีแถบความคืบหน้าบอกว่าเหลืออีกเท่าไร',
      '"ตรงเวลาติดต่อกัน" นับเฉพาะงานมอบหมายที่มีกำหนดส่ง เรียงตามเวลาที่ส่งจริง ส่วน "ส่งงานติดต่อกัน (วัน)" นับวันปฏิทิน',
      'ปลดล็อกใหม่จะมีพลุฉลอง และบันทึกถาวรในบัญชีของคุณ (ใช้ได้ทุกอุปกรณ์)',
      'คำนวณจากข้อมูลที่โหลดไว้แล้ว ไม่ใช้โควต้าฐานข้อมูลเพิ่ม'], tip: 'ดูสรุปความสำเร็จได้ที่หน้าโปรไฟล์ด้วย' };
}

/* ============================================================
   9) BOOTSTRAP — สร้าง DOM ครั้งเดียว
   ============================================================ */
document.body.insertAdjacentHTML('beforeend', `
<div class="modal-overlay modal-center" id="v5-rec-modal"><div class="modal" style="max-width:520px"><div class="modal-header"><div class="modal-title">🔁 งานซ้ำอัตโนมัติของฉัน</div><button class="modal-close" onclick="closeModal('v5-rec-modal')">✕</button></div>
  <div class="modal-body"><div style="font-size:.8rem;color:var(--text-sub);margin-bottom:12px">ระบบสร้างงานรอบถัดไปให้เองเมื่อคุณเปิดแอป (ล่วงหน้า 1 วัน) เพิ่มได้จากฟอร์มสร้างงาน หรือ Quick Add เช่น "ตรวจเครื่อง ทุกวันจันทร์"</div><div id="v5-rec-list" style="max-height:50vh;overflow-y:auto"></div></div></div></div>
<div class="modal-overlay modal-center" id="v5-keys-modal"><div class="modal" style="max-width:480px"><div class="modal-header"><div class="modal-title">⌨️ คีย์ลัด</div><button class="modal-close" onclick="closeModal('v5-keys-modal')">✕</button></div>
  <div class="modal-body">${KEYS.map(k => `<div class="v5-keyrow"><span>${esc(k[1])}</span><span>${k[0].split(' ').map(x => /^(แล้ว|\+)$/.test(x) ? x : `<span class="v5-kbd">${esc(x)}</span>`).join(' ')}</span></div>`).join('')}
  <div style="font-size:.76rem;color:var(--text-sub);margin-top:10px">คีย์ตัวอักษรใช้ได้แม้เปิดคีย์บอร์ดภาษาไทย • ไม่ทำงานขณะพิมพ์ในช่องกรอกข้อมูล</div></div></div></div>`);

// ช่องเลือกงานซ้ำในฟอร์ม (modal-task เป็น DOM ถาวร)
const anchor = ($('v4-sub-list') && $('v4-sub-list').closest('.input-group')) || $('task-link').closest('.input-group');
anchor.insertAdjacentHTML('beforebegin', `<div class="input-group" id="v5-rec-group"><label class="input-label">🔁 ทำซ้ำอัตโนมัติ</label>
  <select class="select-field" id="v5-rec-sel" onchange="WF5.recManual()"><option value="">ไม่ทำซ้ำ</option><option value="daily">ทุกวัน</option><option value="weekdays">ทุกวันทำงาน (จ.–ศ.)</option><option value="weekly">ทุกสัปดาห์ (ตามวันที่กำหนดส่ง)</option><option value="monthly">ทุกเดือน (ตามวันที่ของกำหนดส่ง)</option></select>
  <div id="v5-rec-note" style="font-size:.78rem;color:var(--text-sub);margin-top:6px"></div></div>`);
$('task-deadline').addEventListener('change', () => WF5.recChange());

// ช่องแนะนำใน Quick Add
$('v4-qa-prev').insertAdjacentHTML('afterend', '<div id="v5-qa-sug" style="padding:0 18px 8px;display:flex;flex-wrap:wrap;gap:2px;align-items:center"></div>');
$('v4-qa-in').addEventListener('input', () => { qaPreview(); qaSuggest(); });

document.querySelector('.topbar-actions').insertAdjacentHTML('afterbegin', '<button class="topbar-btn" id="v5-keys-btn" onclick="WF5.openKeys()" title="คีย์ลัด (?)">⌨️</button>');
document.querySelectorAll('.version-badge').forEach(b => { b.textContent = 'NEW v5.0'; });

extendHelp();
console.log('%cWorkFlow Pro v5 add-on loaded', 'color:#0F766E;font-weight:bold');
})();
