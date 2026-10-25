#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WorkFlow Pro — ตัวแพตช์ index.html / v4-addon.js / v5-addon.js (กลุ่ม 1 ทั้งหมด)

วิธีใช้:   python3 patch_all.py  <โฟลเดอร์ที่มีไฟล์ต้นฉบับ>
ผลลัพธ์:   ไฟล์ใหม่อยู่ใน <โฟลเดอร์>/patched/  (ไฟล์ต้นฉบับไม่ถูกแตะ)
ความปลอดภัย: ตรวจทุกจุดก่อน ถ้ามีจุดไหนหาไม่เจอ/จำนวนไม่ตรง จะ "ไม่เขียนไฟล์ใดเลย" แล้วบอกว่าจุดไหนพลาด
"""
import re, sys, os

# ---------------------------------------------------------------- helpers
def S(old, new, n=1):            # แทนข้อความตรงตัว (n = จำนวนครั้งที่ต้องเจอพอดี, None = เจออย่างน้อย 1 แล้วแทนทั้งหมด)
    return dict(kind='s', old=old, new=new, n=n)
def R(pattern, new, n=1, flags=re.S):   # แทนด้วย regex
    return dict(kind='r', old=pattern, new=new, n=n, flags=flags)

ESC = lambda x: f"esc({x})"

# ================================================================ index.html
INDEX = [
 # --- โครงเอกสาร / head -----------------------------------------
 R(r'<!--\s*force redeploy\s*-->\s*<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- force redeploy -->'),
 S('width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no', 'width=device-width, initial-scale=1.0'),
 S('<link rel="apple-touch-icon" href="icon.svg" />', '<link rel="apple-touch-icon" href="icon-192.png" />'),
 R(r'[ \t]*<script src="https://cdnjs\.cloudflare\.com/ajax/libs/html2canvas/[^"]*"></script>\r?\n', ''),
 R(r'[ \t]*<script src="https://cdnjs\.cloudflare\.com/ajax/libs/jspdf/[^"]*"></script>\r?\n', ''),
 S('<script src="V4-addon.js?v=1"></script>', '<script src="v4-addon.js?v=2"></script>'),
 S('<script src="v5-addon.js?v=1"></script>',
   '<script src="v5-addon.js?v=2"></script>\n<script src="v6-addon.js?v=1"></script>\n'
   "<script>if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {})); }</script>"),
 S('NEW v3.0', 'NEW v6.0'),

 # --- toast (ไม่ให้ HTML ใน msg ทำงาน) + ตัวช่วย esc ---------------
 S("el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;",
   "const safeMsg = String(msg ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n  el.innerHTML = `<span>${icons[type]}</span><span>${safeMsg}</span>`;"),
 S("const isManager = () => currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Manager');",
   "const isManager = () => currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Manager');\n"
   "/* v6: ตัวช่วยความปลอดภัย + วันที่ท้องถิ่น */\n"
   "const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;' }[c]));\n"
   "const safeUrl = u => /^https:\\/\\//i.test(String(u || '')) ? String(u) : '#';\n"
   "function localDayOf(iso) {\n"
   "  if (!iso) return '';\n"
   "  const d = new Date(String(iso).replace(' ', 'T'));\n"
   "  if (isNaN(d)) return String(iso).substring(0, 10);\n"
   "  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;\n"
   "}"),

 # --- modal: ไม่ปลดการเลื่อนหน้าถ้ายังมี modal อื่นเปิดอยู่ ------------
 S("function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }",
   "function closeModal(id) { document.getElementById(id).classList.remove('open'); if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = ''; }"),
 S("{ e.target.classList.remove('open'); document.body.style.overflow = ''; } });",
   "{ closeModal(e.target.id); } });"),

 # --- avatarHtml ทั้งฟังก์ชัน ---------------------------------------
 R(r"function avatarHtml\(id, size\) \{.*?\r?\n\}",
   "function avatarHtml(id, size) {\n"
   "  size = size || 28;\n"
   "  const u = usersCache.find(x => x.id == id);\n"
   "  const raw = u ? String(u.fullName || '?').charAt(0).toUpperCase() : '?';\n"
   "  const initial = /[<>&\"'\\\\`]/.test(raw) ? '?' : raw;\n"
   "  const box = `width:${size}px;height:${size}px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.42)}px;font-weight:700;flex-shrink:0;`;\n"
   "  if (u && u.avatar && isValidImage(u.avatar)) return `<img src=\"${esc(u.avatar)}\" style=\"width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid var(--border);\" onerror=\"this.outerHTML='<div style=\\\\'${box}\\\\'>${initial}</div>'\" />`;\n"
   "  return `<div style=\"${box}\">${initial}</div>`;\n"
   "}"),

 # --- เลย์เอาต์ / โปรไฟล์ -------------------------------------------
 S('<div class="user-name" id="sb-name">${currentUser.fullName}</div>', '<div class="user-name" id="sb-name">${esc(currentUser.fullName)}</div>'),
 S('src="${currentUser.avatar}"', 'src="${esc(currentUser.avatar)}"', None),
 S(': currentUser.fullName.charAt(0).toUpperCase()}', ': esc(currentUser.fullName.charAt(0).toUpperCase())}', None),
 S("${t('greeting')}, ${currentUser.fullName}! 👋</div>", "${t('greeting')}, ${esc(currentUser.fullName)}! 👋</div>"),
 S('id="profile-fullname">${currentUser.fullName}</div>', 'id="profile-fullname">${esc(currentUser.fullName)}</div>'),
 S("id=\"profile-position\">${currentUser.position || '—'} · ${currentUser.department || '—'}</div>",
   "id=\"profile-position\">${esc(currentUser.position || '—')} · ${esc(currentUser.department || '—')}</div>"),
 S('value="${currentUser.fullName}"', 'value="${esc(currentUser.fullName)}"'),
 S("value=\"${currentUser.position || ''}\"", "value=\"${esc(currentUser.position || '')}\""),
 S("value=\"${currentUser.phone || ''}\"", "value=\"${esc(currentUser.phone || '')}\""),
 S('แม้ไม่ได้เปิดแท็บ WorkFlow Pro อยู่ตรงหน้า — ใช้ได้ดีบนคอมพิวเตอร์และ Android ส่วน iPhone ต้อง "เพิ่มไปหน้าจอโฮม" ก่อนถึงจะรองรับ',
   'ขณะที่ยังเปิดแอปค้างไว้ในแท็บหรือพื้นหลัง (ยังไม่รองรับการแจ้งเตือนตอนปิดแอปทั้งหมด) — บน iPhone ต้อง "เพิ่มไปหน้าจอโฮม" ก่อน'),

 # --- dropdown -------------------------------------------------------
 S('<option value="${c.name}">${c.name}</option>', '<option value="${esc(c.name)}">${esc(c.name)}</option>'),
 S("<option value=\"${u.id}\">${u.fullName}${u.position ? ' ('+u.position+')' : ''}</option>",
   "<option value=\"${u.id}\">${esc(u.fullName)}${u.position ? ' ('+esc(u.position)+')' : ''}</option>"),
 S("<span>${u.fullName}${u.position ? ' ('+u.position+')' : ''}</span>", "<span>${esc(u.fullName)}${u.position ? ' ('+esc(u.position)+')' : ''}</span>"),
 S('data-points="${u.points||0}">${u.fullName} (${u.points||0} pts)</option>', 'data-points="${u.points||0}">${esc(u.fullName)} (${u.points||0} pts)</option>'),
 S('<option value="${u.id}">${u.fullName}</option>', '<option value="${u.id}">${esc(u.fullName)}</option>'),

 # --- dashboard ------------------------------------------------------
 S('font-size:.9rem">${tk.title}</div></div>', 'font-size:.9rem">${esc(tk.title)}</div></div>'),
 S('font-size:.87rem;">${m.fullName}</div>', 'font-size:.87rem;">${esc(m.fullName)}</div>'),
 S('text-overflow:ellipsis">${tk.title}</div><div style="font-size:.76rem;color:var(--text-sub)">${getUserName(tk.assignedTo)}',
   'text-overflow:ellipsis">${esc(tk.title)}</div><div style="font-size:.76rem;color:var(--text-sub)">${esc(getUserName(tk.assignedTo))}'),
 S('font-size:.87rem;">${c.name}</div>', 'font-size:.87rem;">${esc(c.name)}</div>'),
 S('const recentTasks = tasks.slice(-8).reverse().map(', 'const recentTasks = [...tasks].sort((a,b) => b.id - a.id).slice(0,8).map('),
 S('const recentTasks = tasksArr.slice(-8).reverse().map(', 'const recentTasks = [...tasksArr].sort((a,b) => b.id - a.id).slice(0,8).map('),

 # --- วันที่ UTC → เวลาท้องถิ่น --------------------------------------
 S('t.completedAt.substring(0,10) <= t.deadline', 'localDayOf(t.completedAt) <= t.deadline', None),
 S('const completedAt = tk.completedAt ? tk.completedAt.substring(0,10) : today;', 'const completedAt = tk.completedAt ? localDayOf(tk.completedAt) : today;'),
 S("document.getElementById('pdf-date-to').value = now.toISOString().split('T')[0];", "document.getElementById('pdf-date-to').value = todayStr();"),

 # --- รายงาน: นับเกินกำหนด/รอดำเนินการถูกต้อง ------------------------
 S("pending: tasks.filter(t=>t.status==='pending').length,",
   "pending: tasks.filter(t=>t.status==='pending' && !(t.deadline && t.deadline < todayStr())).length,"),
 S("overdue: tasks.filter(t=>t.status==='overdue').length,",
   "overdue: tasks.filter(t=>t.deadline && t.deadline < todayStr() && !['done','cancelled','rejected'].includes(t.status)).length,"),

 # --- donut: สีตามธีม ------------------------------------------------
 S("ctx.arc(cx,cy,r*0.58,0,2*Math.PI); ctx.fillStyle='#fff';",
   "ctx.arc(cx,cy,r*0.58,0,2*Math.PI); ctx.fillStyle=(getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim()||'#fff');"),
 S("ctx.fillStyle='#1E293B'; ctx.font='bold 16px Sarabun';",
   "ctx.fillStyle=(getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim()||'#1E293B'); ctx.font='bold 16px Sarabun';"),

 # --- งาน ------------------------------------------------------------
 S("margin-right:6px;\">${tk.taskCode}</span>` : ''}${tk.title}", "margin-right:6px;\">${esc(tk.taskCode)}</span>` : ''}${esc(tk.title)}"),
 S('<span>📂 ${tk.category}</span><span>👤 ${getUserName(tk.assignedTo)}</span>', '<span>📂 ${esc(tk.category)}</span><span>👤 ${esc(getUserName(tk.assignedTo))}</span>'),
 S('<span class="adv-tag">${d.label(f[d.key])}<button', '<span class="adv-tag">${esc(d.label(f[d.key]))}<button'),

 # --- รายละเอียดงาน --------------------------------------------------
 S("opacity:.75;margin-bottom:4px;\">${tk.taskCode}</div>` : ''}${tk.title}</div>", "opacity:.75;margin-bottom:4px;\">${esc(tk.taskCode)}</div>` : ''}${esc(tk.title)}</div>"),
 S("<span class=\"detail-value\">${tk.category||'—'}</span>", "<span class=\"detail-value\">${esc(tk.category||'—')}</span>"),
 S('${avatarHtml(tk.assignedTo,24)}${getUserName(tk.assignedTo)}</span>', '${avatarHtml(tk.assignedTo,24)}${esc(getUserName(tk.assignedTo))}</span>'),
 S('${avatarHtml(tk.createdBy,24)}${getUserName(tk.createdBy)}</span>', '${avatarHtml(tk.createdBy,24)}${esc(getUserName(tk.createdBy))}</span>'),
 S("<span class=\"fc-name\">${f.name||'ไฟล์แนบ'}</span>", "<span class=\"fc-name\">${esc(f.name||'ไฟล์แนบ')}</span>"),
 S("<a href=\"${f.url}\" target=\"_blank\" rel=\"noopener\" download=\"${f.name||''}\"", "<a href=\"${esc(safeUrl(f.url))}\" target=\"_blank\" rel=\"noopener\" download=\"${esc(f.name||'')}\""),
 S('<div class="detail-desc-box">${tk.desc}</div>', '<div class="detail-desc-box">${esc(tk.desc)}</div>'),
 S('<img src="${src}"', '<img src="${esc(src)}"', 2),
 S('<div class="detail-timeline-sub">${ev.sub}</div>', '<div class="detail-timeline-sub">${esc(ev.sub)}</div>'),
 S('font-size:.88rem;">${tk.title}</div><div style="font-size:.76rem;color:var(--text-sub);">${getUserName(tk.assignedTo)}</div>',
   'font-size:.88rem;">${esc(tk.title)}</div><div style="font-size:.76rem;color:var(--text-sub);">${esc(getUserName(tk.assignedTo))}</div>'),
 S('<span class="fc-name">${f.name}</span><button type="button" class="fc-remove"', '<span class="fc-name">${esc(f.name)}</span><button type="button" class="fc-remove"'),
 S('<span>📂 ${c.name}</span>', '<span>📂 ${esc(c.name)}</span>'),

 # --- KPI / ผู้ใช้ / องค์กร / ตัดคะแนน / รายงาน / Audit --------------
 S('<div style="font-weight:700">🎁 ${r.name} ', '<div style="font-weight:700">🎁 ${esc(r.name)} '),
 S("margin-top:3px\">${r.detail||''}</div>", "margin-top:3px\">${esc(r.detail||'')}</div>"),
 S('`${t(\'lb.employee\')} #${i+1}`:u.fullName}', '`${t(\'lb.employee\')} #${i+1}`:esc(u.fullName)}'),
 S("font-size:.76rem;color:var(--text-sub)\">${u.department||'—'}</div></div>", "font-size:.76rem;color:var(--text-sub)\">${esc(u.department||'—')}</div></div>"),
 S('<strong>${u.fullName}</strong>${u.isActive===false?', '<strong>${esc(u.fullName)}</strong>${u.isActive===false?'),
 S("font-size:.82rem\">${u.username||'-'}</code>", "font-size:.82rem\">${esc(u.username||'-')}</code>"),
 S("<td>${u.position||'—'}</td><td>${u.department||'—'}</td>", "<td>${esc(u.position||'—')}</td><td>${esc(u.department||'—')}</td>"),
 S("<td>${u.phone||'—'}</td>", "<td>${esc(u.phone||'—')}</td>"),
 S("<div style=\"font-weight:700\">${u.fullName}</div><div style=\"font-size:.78rem;color:var(--text-sub)\">${u.position||'—'} · ${u.department||'—'}</div>",
   "<div style=\"font-weight:700\">${esc(u.fullName)}</div><div style=\"font-size:.78rem;color:var(--text-sub)\">${esc(u.position||'—')} · ${esc(u.department||'—')}</div>"),
 S('<td><strong>${d.userName}</strong></td><td>${d.adminName}</td>', '<td><strong>${esc(d.userName)}</strong></td><td>${esc(d.adminName)}</td>'),
 S('<span class="badge badge-orange">${d.category}</span>', '<span class="badge badge-orange">${esc(d.category)}</span>'),
 S('title="${d.reason}">${d.reason}</td>', 'title="${esc(d.reason)}">${esc(d.reason)}</td>'),
 S('<td><strong>${tk.title}</strong></td><td>${tk.category}</td>', '<td><strong>${esc(tk.title)}</strong></td><td>${esc(tk.category)}</td>'),
 S('<td>${tk.assigned_to}</td>', '<td>${esc(tk.assigned_to)}</td>'),
 S("<td>${tk.approved_by||'-'}</td>", "<td>${esc(tk.approved_by||'-')}</td>"),
 S('<td>${getUserName(r.userId)}</td>', '<td>${esc(getUserName(r.userId))}</td>'),
 S('<div style="font-weight:600">${l.action} — ${l.target}</div>', '<div style="font-weight:600">${esc(l.action)} — ${esc(l.target)}</div>'),
 S('โดย: ${getUserName(l.userId)}', 'โดย: ${esc(getUserName(l.userId))}'),
 S('<em>${l.prev}</em>', '<em>${esc(l.prev)}</em>'),
 S('<em>${l.next}</em>', '<em>${esc(l.next)}</em>'),

 # --- แจ้งเตือน -------------------------------------------------------
 S("' urgent':''}\">${n.title}</div>", "' urgent':''}\">${esc(n.title)}</div>"),
 S('<div class="notif-sub">${n.sub}</div>', '<div class="notif-sub">${esc(n.sub)}</div>'),
 S('font-size:.88rem;color:var(--danger);">${n.title}</div>', 'font-size:.88rem;color:var(--danger);">${esc(n.title)}</div>'),
 S('white-space:pre-line;margin-top:2px;">${n.sub}</div>', 'white-space:pre-line;margin-top:2px;">${esc(n.sub)}</div>'),

 # --- PDF -------------------------------------------------------------
 S("<strong style=\"font-size:14px;color:#0F172A;\">'+tk.title+'</strong>", "<strong style=\"font-size:14px;color:#0F172A;\">'+esc(tk.title)+'</strong>"),
 S("color:#64748B;\">'+cleanDesc+'</div>'", "color:#64748B;\">'+esc(cleanDesc)+'</div>'"),
 S("border-radius:4px;\">'+rejectNote+'</div>'", "border-radius:4px;\">'+esc(rejectNote)+'</div>'"),
 S("<div style=\"font-weight:600;\">'+getUserName(tk.assignedTo)+'</div>", "<div style=\"font-weight:600;\">'+esc(getUserName(tk.assignedTo))+'</div>"),
 S("(สร้างโดย: '+getUserName(tk.createdBy)+')", "(สร้างโดย: '+esc(getUserName(tk.createdBy))+')"),
 S("<img src=\"'+beforeImgs[b]+'\"", "<img src=\"'+esc(beforeImgs[b])+'\""),
 S("<img src=\"'+doneImgs[d]+'\"", "<img src=\"'+esc(doneImgs[d])+'\""),

 # --- ลดการดึงข้อมูลเกินจำเป็น ---------------------------------------
 S("const { data, error } = await supabase.from('users').select('*'); if (error) throw error;",
   "const { data, error } = await supabase.from('users').select('id, username, full_name, position, department, role, manager_id, phone, points, language_pref, avatar, is_active'); if (error) throw error;", 2),
 R(r"for \(const r of rewards\) \{\s*try \{\s*const \{ data: prog \} = await supabase\.rpc\('reward_progress', \{ p_reward_id: r\.id, p_user_id: currentUser\.id \}\);\s*r\.myProgress = prog \|\| 0;\s*\} catch\(e\) \{ r\.myProgress = 0; \}\s*\}",
   "await Promise.all(rewards.map(async r => {\n"
   "        try {\n"
   "          const { data: prog } = await supabase.rpc('reward_progress', { p_reward_id: r.id, p_user_id: currentUser.id });\n"
   "          r.myProgress = prog || 0;\n"
   "        } catch(e) { r.myProgress = 0; }\n"
   "      }));"),
]

# ================================================================ v4-addon.js
V4 = [
 R(r"[ \t]*else if \(subs\.length && r\.id\) await saveSubs\(r\.id, subs\);\r?\n", ''),   # ต้องทำก่อนข้อถัดไป
 S("if (action === 'UPDATE_TASK') await saveSubs(payload.id, subs);",
   "try {\n        if (action === 'UPDATE_TASK') await saveSubs(payload.id, subs);\n        else if (subs.length && r.id) await saveSubs(r.id, subs);\n      } catch (e) { toast('บันทึกงานแล้ว แต่บันทึกรายการย่อยไม่สำเร็จ: ' + e.message, 'warning', 6000); }"),
 S("const subs = (action === 'CREATE_TASK' || action === 'UPDATE_TASK') ? V4.pendingSubs : null;",
   "const subs = (action === 'CREATE_TASK' || action === 'UPDATE_TASK') ? V4.pendingSubs : null;\n  if (subs) V4.pendingSubs = null;   // v6: ใช้ครั้งเดียว กันไปติดกับงานอื่น (เช่น งานซ้ำที่สร้างอัตโนมัติ)"),
 S("el.querySelectorAll('.kb-card').forEach(c => {", "if (window.WF_KB_V5) return;   // v6: ถ้ามี v5 ให้ v5 ผูก event เอง ไม่วาด/ผูกซ้ำ\n  el.querySelectorAll('.kb-card').forEach(c => {"),
]

# ================================================================ v5-addon.js
V5 = [
 S("const WF5 = window.WF5 = {};", "const WF5 = window.WF5 = {};\nwindow.WF_KB_V5 = true;"),
 S("board.innerHTML = board.innerHTML;", "/* v6: ไม่ต้อง re-render ซ้ำแล้ว (v4 ไม่ผูก handler เมื่อมี v5) */"),
 S("d.started = true; d.card.classList.add('dragging'); document.body.classList.add('v5-dragging');",
   "d.started = true; d.card.classList.add('dragging'); document.body.classList.add('v5-dragging');\n  document.addEventListener('touchmove', blockTouch, { passive: false });"),
 S("d.ghost.remove(); d.card.classList.remove('dragging'); document.body.classList.remove('v5-dragging');",
   "d.ghost.remove(); d.card.classList.remove('dragging'); document.body.classList.remove('v5-dragging');\n  document.removeEventListener('touchmove', blockTouch);"),
 S("document.addEventListener('touchmove', e => { if (V5.drag && V5.drag.started && e.cancelable) e.preventDefault(); }, { passive: false });",
   "const blockTouch = e => { if (e.cancelable) e.preventDefault(); };   // v6: ผูกเฉพาะตอนลากจริง"),
 S("if (GO[k] && !(k === 's' && false)) navigate(GO[k]);", "if (GO[k]) navigate(GO[k]);"),
]

# ---------------------------------------------------------------- engine
def apply(text, patches, label):
    errors, log = [], []
    for i, p in enumerate(patches, 1):
        if p['kind'] == 's':
            c = text.count(p['old'])
            exp = p['n']
            if c == 0 or (exp is not None and c != exp):
                errors.append(f"[{label} #{i}] พบ {c} จุด (คาดหวัง {exp if exp is not None else '≥1'}) : {p['old'][:90]!r}")
                continue
            text = text.replace(p['old'], p['new']); log.append((i, c))
        else:
            rx = re.compile(p['old'], p['flags'])
            ms = rx.findall(text)
            if not ms or (p['n'] is not None and len(ms) != p['n']):
                errors.append(f"[{label} #{i}] regex พบ {len(ms)} จุด (คาดหวัง {p['n']}) : {p['old'][:90]!r}")
                continue
            text = rx.sub(lambda m, new=p['new']: new, text); log.append((i, len(ms)))
    return text, errors, log

def find(folder, *names):
    low = {f.lower(): f for f in os.listdir(folder)}
    for n in names:
        if n.lower() in low: return os.path.join(folder, low[n.lower()])
    return None

def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else '.'
    jobs = [('index.html', INDEX, 'index.html'), ('v4-addon.js', V4, 'v4-addon.js'), ('v5-addon.js', V5, 'v5-addon.js')]
    results, all_err = {}, []
    for name, patches, out in jobs:
        path = find(folder, name)
        if not path:
            all_err.append(f"ไม่พบไฟล์ {name} ในโฟลเดอร์ {folder}"); continue
        with open(path, 'r', encoding='utf-8', newline='') as f: text = f.read()
        new, err, log = apply(text, patches, name)
        all_err += err; results[out] = new
        print(f"✔ {name}: ตรวจ {len(patches)} จุด, แพตช์สำเร็จ {len(log)} จุด" if not err else f"✘ {name}: มี {len(err)} จุดที่ไม่ผ่าน")
    if all_err:
        print('\n❌ ยกเลิก — ไม่ได้เขียนไฟล์ใด ๆ  (ไฟล์ของคุณอาจไม่ใช่เวอร์ชันเดียวกับที่ผมตรวจ หรือเคยแก้ไปแล้วบางส่วน)')
        for e in all_err: print('   ', e)
        sys.exit(1)
    outdir = os.path.join(folder, 'patched'); os.makedirs(outdir, exist_ok=True)
    for out, text in results.items():
        with open(os.path.join(outdir, out), 'w', encoding='utf-8', newline='') as f: f.write(text)
    print(f"\n✅ เสร็จ — ไฟล์ใหม่อยู่ที่ {outdir}/ (ไฟล์เดิมไม่ถูกแตะ)")

if __name__ == '__main__':
    main()
