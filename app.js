// The browser renders forms. Java owns reports, matching and contact permissions.
const CAT = {Wallet:'Accessories',Keys:'Accessories',Bag:'Accessories','ID card':'Documents',Earphones:'Electronics',Charger:'Electronics',Phone:'Electronics',Bottle:'Other'};
const NAMES = [...Object.keys(CAT),'Other'];
const LOCS = ['LHC','AB1','AB2','AB3','Old Mess','Football Ground','Library','Other'];
const TAGS = ['Black','White','Blue','Red','Brown','Leather','Case','Sticker'];
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'});
const fmt = d => d.split('-').reverse().join('/');
const timeLabel = item => item.timeFrom ? ' · ' + esc(item.timeFrom) + (item.timeTo && item.timeTo !== item.timeFrom ? '–' + esc(item.timeTo) : '') : '';

let user = null, domain = 'muj.manipal.edu', page = 'login', photo = '', current = null, lostReports = [], foundReports = [], matches = [], busy = false, photoLoading = false, renderVersion = 0, adminData = null, adminTab = 'found', facultyTab = 'found';
const navHistory = [];
const app = document.getElementById('app');
const val = id => document.getElementById(id)?.value.trim() || '';
const selected = group => [...document.querySelectorAll(`[data-g="${group}"].on`)].map(b=>b.dataset.v);
const error = message => {const e=document.getElementById('er'); if(e) e.textContent=message;};

async function api(path, data) {
  const response = await fetch('/api/'+path, {method:data ? 'POST':'GET', credentials:'same-origin', headers:data ? {'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'LostFound'}:{}, body:data ? new URLSearchParams(data):undefined});
  const result = await response.json();
  if (!response.ok) {
    if(response.status===401 && user){ user=null; current=null; lostReports=[]; foundReports=[]; matches=[]; render('login'); }
    throw new Error(result.error || 'Something went wrong. Please try again.');
  }
  return result;
}

const chips = (group, list, multi=false) => `<div class="chips">${list.map(v=>`<button type="button" class="chip" aria-pressed="false" data-g="${group}" data-v="${esc(v)}" ${multi?'data-multi="1"':''}>${esc(v)}</button>`).join('')}</div>`;

let theme = 'light';
try { theme = localStorage.getItem('lost-found-theme') || 'light'; } catch {}
function applyTheme(next) {
  theme = next === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('lost-found-theme', theme); } catch {}
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.textContent = theme === 'dark' ? '☀ Light mode' : '☾ Dark mode';
    toggle.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
  }
}
applyTheme(theme);

const header = (back) => {
  const isPrivileged = user && (user.isAdmin || user.isFaculty);
  return `<header class="top">
    <div style="display:flex;align-items:center;gap:12px">
      ${back ? `<button type="button" class="link" data-action="go-back">← Back</button>` : ''}
      <span class="brand" style="cursor:pointer" data-page="${isPrivileged ? (page==='faculty'?'faculty':(page==='admin'?'admin':'home')) : 'home'}">FindIt</span>
    </div>
    <div class="top-actions">
      ${user ? `
        ${isPrivileged ? `
          <div class="role-switcher">
            <button type="button" class="nav-pill ${page==='home'?'active':''}" data-page="home">Student View</button>
            <button type="button" class="nav-pill ${page==='faculty'?'active':''}" data-page="faculty">Faculty Desk</button>
            ${user.isAdmin ? `<button type="button" class="nav-pill ${page==='admin'?'active':''}" data-page="admin">Admin Console</button>` : ''}
          </div>
        ` : ''}
        ${user.isVerifiedMs ? '<span class="badge-ms">✓ Microsoft 365</span>' : ''}
        ${user.isFaculty && !user.isAdmin ? '<span class="badge-faculty">Faculty</span>' : ''}
        ${user.isAdmin ? '<span class="badge-admin">Admin</span>' : ''}
        <button type="button" class="link" data-action="logout">Sign out</button>
      ` : ''}
      <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Switch mode">${theme==='dark'?'☀ Light':'☾ Dark'}</button>
    </div>
  </header>`;
};

const photoBox = () => `<label class="photo" id="pb"><span id="photo-label">Choose a photo · JPG or PNG</span><input type="file" accept="image/jpeg,image/png" id="photo" aria-label="Choose an item photo"></label><p class="mute" style="margin-top:6px;font-size:12px">Camera & gallery supported (up to 10 MB). AI verifies real physical objects.</p>`;

function compressImage(file, maxDimension = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let width = img.width, height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not load image file.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

function reportForm(kind) {
 const found=kind==='found';
 return `${header(true)}<p class="eyebrow">${found?'Help it find its way back':'Let’s find it'}</p><h1>${found?'What did you find?':'What did you lose?'}</h1><p class="mute" style="margin-top:10px">A few details are all we need.</p>
 <form id="report-form">
 ${found?`<div class="field"><span>Photo · required</span>${photoBox()}</div>`:''}
 <div class="field"><span>Item</span>${chips('name',NAMES)}<input id="other-name" class="hide" aria-label="Other item name" placeholder="Item name" maxlength="60" style="margin-top:10px"><select id="other-category" class="hide" aria-label="Item category" style="margin-top:10px"><option>Accessories</option><option>Electronics</option><option>Documents</option><option>Other</option></select></div>
 <div class="field"><span>${found?'Where did you find it?':'Where did you last see it?'}</span>${chips('location',LOCS)}<input id="other-location" class="hide" aria-label="Other location" placeholder="Add a location" maxlength="80" style="margin-top:10px"></div>
 <label class="field"><span>When</span><input type="date" id="date" required value="${today()}" max="${today()}"></label>
 <div class="field"><span>Time · optional</span><div class="row"><label><span>At / from</span><input id="time-from" type="time" aria-label="At or from time"></label><label><span>Until</span><input id="time-to" type="time" aria-label="Until time"></label></div><p class="mute" style="margin-top:6px">Enter one time, or a range on the selected date. Leave blank if unsure. Times are in IST.</p></div>
 <div class="field"><span>Details · pick tags or add your own</span>${chips('tag',TAGS,true)}<div class="row" style="margin-top:10px"><input id="custom-tag" maxlength="35" placeholder="e.g. blue keyring" aria-label="Custom tag"><button type="button" class="chip" id="add-tag">Add</button></div></div>
 ${found?'<label class="field"><span>Your contact number</span><input id="phone" type="tel" autocomplete="tel" maxlength="25" required placeholder="10-digit mobile number"></label><p class="mute" style="margin-top:6px">Shared only after you approve an ownership claim.</p>':`<div class="field"><span>Photo · optional</span>${photoBox()}</div>`}
 <div id="er" class="err" role="alert"></div><button class="btn" type="submit">${found?'Post found item':'Save & see matches'}</button></form>
 ${found?foundHistory():lostHistory()}`;
}

function lostHistory(){return `<section class="section"><h2>Your lost reports</h2>${lostReports.length?lostReports.map(l=>`<div class="report"><h3>${esc(l.name)}</h3><p class="mute">${esc(l.location)} · ${fmt(l.date)}${timeLabel(l)}</p><button class="link" data-lost="${l.id}">View possible matches →</button></div>`).join(''):'<p class="mute" style="margin-top:10px">Your reports will appear here.</p>'}</section>`;}

function foundHistory(){return `<section class="section"><h2>Your found reports</h2><button class="link" data-refresh-inbox="1">Refresh requests ↻</button>${foundReports.length?foundReports.map(f=>`<article class="report"><h3>${esc(f.name)}${f.claimed?' · Returned':''}</h3><p class="mute">${esc(f.location)} · ${fmt(f.date)}${timeLabel(f)}</p>${f.requests.length?f.requests.map(r=>`<div class="notice"><strong>${esc(r.name)}</strong><p style="margin-top:6px;white-space:pre-wrap">${esc(r.proof)}</p><p style="margin-top:6px">Reported loss: ${esc(r.lost.location)} · ${fmt(r.lost.date)}${timeLabel(r.lost)}<br>${esc(r.lost.description)}</p>${r.lost.photo?`<img src="${esc(r.lost.photo)}" alt="Owner’s reference photo" style="width:100%;max-height:160px;object-fit:contain;margin-top:8px">`:''}${r.status==='pending'&&!f.claimed?`<div class="row"><button class="btn" data-review="${r.id}" data-decision="approved">Approve</button><button class="btn ghost" data-review="${r.id}" data-decision="rejected">Decline</button></div>`:`<p class="status">${esc(r.status)}</p>`}</div>`).join(''):'<p class="mute" style="margin-top:10px">No ownership requests yet.</p>'}${!f.claimed&&f.requests.some(r=>r.status==='approved')?`<button class="btn ghost" data-returned="${f.id}">Confirm item handed back</button>`:''}</article>`).join(''):'<p class="mute">Your reports and ownership requests will appear here.</p>'}</section>`;}

function renderFacultyTab() {
  if (!adminData) return '<p class="mute">Loading campus records...</p>';
  if (facultyTab === 'found') {
    return adminData.found.length ? adminData.found.map(f => `
      <article class="report" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <h3>${esc(f.name)} ${f.claimed ? '<span class="pill">Returned to Owner</span>' : '<span class="pill" style="background:#e0f2fe;color:#0369a1">In Custody</span>'}</h3>
            <p class="mute">${esc(f.location)} · ${fmt(f.date)}${timeLabel(f)}</p>
            <p style="font-size:13px;margin-top:4px">Finder: <strong>${esc(f.reporterName)}</strong> (${esc(f.reporterId)}) · ${esc(f.reporterEmail)}</p>
            ${f.phone ? `<p style="font-size:13px;color:var(--mute)">Contact: ${esc(f.phone)}</p>` : ''}
          </div>
          ${f.photo ? `<img src="${esc(f.photo)}" alt="Found item" style="width:64px;height:64px;object-fit:cover;border-radius:8px">` : ''}
        </div>
        ${!f.claimed ? `<div class="row" style="margin-top:12px"><button class="btn ghost" data-faculty-resolve="${f.id}">Hand Over to Student</button></div>` : ''}
      </article>
    `).join('') : '<p class="mute">No found items registered yet.</p>';
  }
  if (facultyTab === 'claims') {
    return adminData.requests.length ? adminData.requests.map(r => `
      <article class="report" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <h3>Claim on ${esc(r.itemName)} <span class="pill">${esc(r.status)}</span></h3>
            <p style="font-size:13px;margin-top:4px">Claimant: <strong>${esc(r.claimantName)}</strong> (${esc(r.claimantEmail)})</p>
            <p style="font-size:13px">Finder: <strong>${esc(r.finderName)}</strong> (${esc(r.finderEmail)})</p>
            <div class="notice" style="margin-top:8px"><strong>Proof submitted by student:</strong><p style="margin-top:4px">${esc(r.proof)}</p></div>
          </div>
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn" data-faculty-resolve="${r.foundId}">Verify & Hand Over to Student</button>
        </div>
      </article>
    `).join('') : '<p class="mute">No pending claims filed by students.</p>';
  }
  return adminData.lost.length ? adminData.lost.map(l => `
    <article class="report" style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h3>${esc(l.name)} <span class="pill">Student Lost Report</span></h3>
          <p class="mute">${esc(l.location)} · ${fmt(l.date)}${timeLabel(l)}</p>
          <p style="font-size:13px;margin-top:4px">Student: <strong>${esc(l.reporterName)}</strong> (${esc(l.reporterId)}) · ${esc(l.reporterEmail)}</p>
          <p class="tags">${esc(l.description || 'No tags specified')}</p>
        </div>
        ${l.photo ? `<img src="${esc(l.photo)}" alt="Lost item" style="width:64px;height:64px;object-fit:cover;border-radius:8px">` : ''}
      </div>
    </article>
  `).join('') : '<p class="mute">No lost items reported by students.</p>';
}

function renderAdminTab() {
  if (!adminData) return '<p class="mute">Loading records...</p>';
  if (adminTab === 'found') {
    return adminData.found.length ? adminData.found.map(f => `
      <article class="report" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <h3>${esc(f.name)} ${f.claimed ? '<span class="pill">Returned</span>' : '<span class="pill" style="background:#e0f2fe;color:#0369a1">Active Found</span>'}</h3>
            <p class="mute">${esc(f.location)} · ${fmt(f.date)}${timeLabel(f)}</p>
            <p style="font-size:13px;margin-top:4px">Reported by: <strong>${esc(f.reporterName)}</strong> (${esc(f.reporterId)}) · ${esc(f.reporterEmail)}</p>
            ${f.phone ? `<p style="font-size:13px;color:var(--mute)">Contact: ${esc(f.phone)}</p>` : ''}
          </div>
          ${f.photo ? `<img src="${esc(f.photo)}" alt="Found item" style="width:64px;height:64px;object-fit:cover;border-radius:8px">` : ''}
        </div>
        <div class="row" style="margin-top:12px">
          ${!f.claimed ? `<button class="btn ghost" data-admin-resolve="${f.id}">Mark Returned</button>` : ''}
          <button class="danger-btn" data-admin-del="found" data-id="${f.id}">Delete Report</button>
        </div>
      </article>
    `).join('') : '<p class="mute">No found items reported yet.</p>';
  }
  if (adminTab === 'lost') {
    return adminData.lost.length ? adminData.lost.map(l => `
      <article class="report" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <h3>${esc(l.name)} <span class="pill">Lost Item</span></h3>
            <p class="mute">${esc(l.location)} · ${fmt(l.date)}${timeLabel(l)}</p>
            <p style="font-size:13px;margin-top:4px">Reported by: <strong>${esc(l.reporterName)}</strong> (${esc(l.reporterId)}) · ${esc(l.reporterEmail)}</p>
            <p class="tags">${esc(l.description || 'No tags')}</p>
          </div>
          ${l.photo ? `<img src="${esc(l.photo)}" alt="Lost item" style="width:64px;height:64px;object-fit:cover;border-radius:8px">` : ''}
        </div>
        <div style="margin-top:12px">
          <button class="danger-btn" data-admin-del="lost" data-id="${l.id}">Delete Report</button>
        </div>
      </article>
    `).join('') : '<p class="mute">No lost items reported yet.</p>';
  }
  return adminData.requests.length ? adminData.requests.map(r => `
    <article class="report" style="margin-top:12px">
      <h3>Claim on ${esc(r.itemName)} <span class="pill">${esc(r.status)}</span></h3>
      <p style="font-size:13px;margin-top:4px">Claimant: <strong>${esc(r.claimantName)}</strong> (${esc(r.claimantEmail)})</p>
      <p style="font-size:13px">Finder: <strong>${esc(r.finderName)}</strong> (${esc(r.finderEmail)})</p>
      <div class="notice" style="margin-top:8px"><strong>Proof submitted:</strong><p style="margin-top:4px">${esc(r.proof)}</p></div>
    </article>
  `).join('') : '<p class="mute">No claims filed yet.</p>';
}

const views = {
 login:()=>`
  ${header()}
  <div class="login-hero">
    <p class="eyebrow">Manipal University Jaipur · Campus Lost & Found</p>
    <h1>A little help.<br>A familiar thing back.</h1>
    <p class="mute" style="margin-top:14px;font-size:16px">Lost or found something on campus? Sign in with your official university credentials to report items, match with finders, and reclaim possessions.</p>
    
    <button type="button" class="btn-ms-main" id="btn-ms-login">
      <svg width="22" height="22" viewBox="0 0 21 21" fill="none"><path d="M1 1h9v9H1z" fill="#F25022"/><path d="M11 1h9v9h-9z" fill="#7FBA00"/><path d="M1 11h9v9H1z" fill="#00A4EF"/><path d="M11 11h9v9h-9z" fill="#FFB900"/></svg>
      <span>Sign in with Microsoft 365</span>
    </button>

    <div class="notice" style="margin-top:24px;text-align:left">
      <strong>Official MUJ Authentication:</strong> All students and faculty members log in using your official <code>@${esc(domain)}</code> Microsoft account.
    </div>

    <div class="portal-entry">
      <span>Staff & Admin Portals:</span>
      <button type="button" class="link" id="btn-faculty-portal">Faculty Desk →</button>
      <span>·</span>
      <button type="button" class="link" id="btn-admin-portal">Campus Administration →</button>
    </div>
    <div id="er" class="err" role="alert"></div>
  </div>`,

 facultyLogin:()=>`
  ${header(true)}
  <p class="eyebrow">Manipal University Jaipur · Faculty Portal</p>
  <h1>Faculty & Staff Sign In</h1>
  <p class="mute" style="margin-top:10px">Sign in with your faculty credentials to manage classroom and lab lost & found items.</p>
  <form id="faculty-login-form" style="margin-top:24px">
    <label class="field"><span>Full Name</span><input id="fac-name" autocomplete="name" placeholder="Prof. / Dr. / Staff Name" required></label>
    <label class="field"><span>Faculty / Staff ID</span><input id="fac-id" placeholder="e.g. FAC1042" required></label>
    <label class="field"><span>Official Faculty Email</span><input id="fac-email" type="email" autocomplete="email" placeholder="faculty@${esc(domain)}" required></label>
    <div class="err" id="er" role="alert"></div>
    <button class="btn" type="submit">Sign In to Faculty Desk</button>
  </form>
  <p class="mute" style="margin-top:20px;font-size:13px">Or use the <button type="button" class="link" id="btn-ms-login-alt">Microsoft 365 Sign In</button> and select Faculty Account.</p>`,

 adminLogin:()=>`
  ${header(true)}
  <p class="eyebrow">Manipal University Jaipur · Campus Security & Admin</p>
  <h1>Campus Administration</h1>
  <p class="mute" style="margin-top:10px">Authorized central administrators only. Access moderation controls and full campus audit trails.</p>
  <form id="admin-login-form" style="margin-top:24px">
    <label class="field"><span>Administrator Email</span><input id="admin-email" type="email" autocomplete="email" placeholder="admin@${esc(domain)}" required></label>
    <label class="field"><span>Admin Passcode</span><input id="admin-passcode" type="password" placeholder="Enter security passcode" required></label>
    <div class="err" id="er" role="alert"></div>
    <button class="btn" type="submit">Log in to Admin Console</button>
  </form>
  <p class="mute" style="margin-top:20px;font-size:13px">Default passcode is <code>admin123</code> or set via <code>ADMIN_PASSCODE</code> on server.</p>`,

 faculty:()=>`
  ${header()}
  <div class="banner-switch">
    <span>Looking for your personal items?</span>
    <button type="button" class="link" data-page="home">Switch to Student View →</button>
  </div>
  <p class="eyebrow">Faculty & Staff Lost & Found Desk</p>
  <h1>Faculty Portal</h1>
  <p class="mute" style="margin-top:6px">Manage items recovered in classrooms, laboratories, or turned in to department offices.</p>
  
  <div class="stats-grid">
    <div class="stat-card"><div class="num">${adminData?.found?.length ?? 0}</div><div class="lbl">Items in Custody</div></div>
    <div class="stat-card"><div class="num">${adminData?.requests?.length ?? 0}</div><div class="lbl">Pending Claims</div></div>
    <div class="stat-card"><div class="num">${adminData?.stats?.totalReturned ?? 0}</div><div class="lbl">Handed Over</div></div>
    <div class="stat-card"><div class="num">${adminData?.lost?.length ?? 0}</div><div class="lbl">Student Requests</div></div>
  </div>

  <div class="admin-tabs">
    <button type="button" class="tab-btn ${facultyTab==='found'?'on':''}" data-faculty-tab="found">Found Items (${adminData?.found?.length ?? 0})</button>
    <button type="button" class="tab-btn ${facultyTab==='claims'?'on':''}" data-faculty-tab="claims">Student Claims (${adminData?.requests?.length ?? 0})</button>
    <button type="button" class="tab-btn ${facultyTab==='lost'?'on':''}" data-faculty-tab="lost">Active Lost Reports (${adminData?.lost?.length ?? 0})</button>
  </div>
  <div class="admin-content">
    ${renderFacultyTab()}
  </div>
  <div id="er" class="err" role="alert"></div>
  <button class="btn" data-page="found" style="max-width:280px;margin-top:24px">+ Report Found Item from Lab/Class</button>`,

 admin:()=>`
  ${header()}
  <div class="banner-switch">
    <span>Central Campus Administration Active</span>
    <div style="display:flex;gap:12px">
      <button type="button" class="link" data-page="faculty">Faculty Desk</button>
      <button type="button" class="link" data-page="home">Student View</button>
    </div>
  </div>
  <p class="eyebrow">Campus Security & Moderation Console</p>
  <h1>Admin Dashboard</h1>
  <p class="mute" style="margin-top:6px">Review system metrics, delete invalid/spam reports, and moderate campus disputes.</p>
  <div class="stats-grid">
    <div class="stat-card"><div class="num">${adminData?.stats?.totalLost ?? 0}</div><div class="lbl">Lost Items</div></div>
    <div class="stat-card"><div class="num">${adminData?.stats?.totalFound ?? 0}</div><div class="lbl">Found Items</div></div>
    <div class="stat-card"><div class="num">${adminData?.stats?.totalReturned ?? 0}</div><div class="lbl">Returned</div></div>
    <div class="stat-card"><div class="num">${adminData?.stats?.totalClaims ?? 0}</div><div class="lbl">Active Claims</div></div>
  </div>
  <div class="admin-tabs">
    <button type="button" class="tab-btn ${adminTab==='found'?'on':''}" data-tab="found">Found Items (${adminData?.found?.length ?? 0})</button>
    <button type="button" class="tab-btn ${adminTab==='lost'?'on':''}" data-tab="lost">Lost Items (${adminData?.lost?.length ?? 0})</button>
    <button type="button" class="tab-btn ${adminTab==='claims'?'on':''}" data-tab="claims">Claims & Audits (${adminData?.requests?.length ?? 0})</button>
  </div>
  <div class="admin-content">
    ${renderAdminTab()}
  </div>
  <div id="er" class="err" role="alert"></div>
  <button class="btn ghost" data-page="home" style="margin-top:24px">Switch to Student View</button>`,

 home:()=>`
  ${header()}
  <p class="eyebrow">Your campus, looking out for you</p>
  <h1>Hi, ${esc(user.name.split(' ')[0])}.<br>What happened?</h1>
  <div class="cards">
    <button class="card a" data-page="lost">
      <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M17 17l6 6"/></svg>
      <h2>I lost something</h2>
      <p>Report your item and see possible matches.</p>
    </button>
    <button class="card b" data-page="found">
      <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h20v14H4zM9 8V5h10v3"/></svg>
      <h2>I found something</h2>
      <p>Add a photo, pick a few tags, help someone out.</p>
    </button>
  </div>
  <div class="home-links">
    <button class="link" data-page="inbox">My found reports · ${foundReports.reduce((n,f)=>n+f.requests.filter(r=>r.status==='pending'&&!f.claimed).length,0)} pending requests →</button>
    <button class="link" data-page="lost">My lost reports (${lostReports.length}) →</button>
    ${user?.isFaculty ? '<button class="link" data-page="faculty" style="font-weight:600;color:var(--ac)">Faculty Desk Portal →</button>' : ''}
    ${user?.isAdmin ? '<button class="link" data-page="admin" style="font-weight:600;color:var(--ac)">Admin Console →</button>' : ''}
  </div>
  <p class="foot">Only your reports. Only relevant matches.</p>
  <div id="er" class="err" role="alert"></div>`,

 lost:()=>reportForm('lost'),
 found:()=>reportForm('found'),
 inbox:()=>`${header(true)}<p class="eyebrow">Reports & ownership requests</p><h1>Your found items</h1><p class="mute" style="margin-top:12px">Review identifying details before approving. Approval shares your contact number with that student.</p>${foundHistory()}<button class="btn ghost" data-page="found">Report another found item</button><div id="er" class="err" role="alert"></div>`,
 posted:()=>`${header()}<p class="eyebrow">Found report saved</p><h1>Posted. Thank you.</h1><p class="mute" style="margin-top:14px">You may have made someone’s day a little easier. Review ownership requests under “I found something” before sharing your number.</p><button class="btn" data-page="found">View my found reports</button><button class="btn ghost" data-page="home">Back to home</button><div id="er" class="err" role="alert"></div>`,
 matches:()=>`${header(true)}<p class="eyebrow">Your lost report #${current.id}</p><h1>Possible matches</h1><p class="mute" style="margin-top:10px">${esc(current.name)} · ${esc(current.location)} · ${fmt(current.date)}${timeLabel(current)}</p><button class="link" data-refresh="1">Refresh matches ↻</button>${matches.length?matches.map(f=>`<article class="m"><div class="th">${f.photo?`<img src="${esc(f.photo)}" alt="Found ${esc(f.name)}">`:esc(f.name[0])}</div><div style="flex:1;min-width:0"><h3>${esc(f.name)} <span class="pill">${f.score}%</span></h3><p class="mute">${esc(f.location)} · ${fmt(f.date)}${timeLabel(f)}</p><p class="tags">${esc(f.description)}</p>${f.status==='own'?'<p class="status">Your found report (You reported this)</p><p class="mute" style="font-size:13px;margin-top:6px">Self-claiming is disabled. To test claiming ownership, sign in with a different student account (e.g. in a private/incognito window).</p>':f.status==='approved'?`<p class="status">Finder approved your ownership claim</p><a class="link" href="tel:${esc(f.phone.replace(/[^+0-9]/g,''))}">Call finder: ${esc(f.phone)}</a>`:f.status==='pending'?'<p class="lock">Ownership claim sent. Waiting for the finder to review.</p>':f.status==='rejected'?'<p class="lock">The finder declined this ownership claim.</p>':`<p class="lock">Contact stays private until the finder approves.</p><button class="btn" data-request="${f.id}">Claim ownership</button>`}</div></article>`).join(''):'<div class="empty">No possible matches yet.<br>Your report is saved. Check back here later.</div>'}<div id="er" class="err" role="alert"></div><details><summary>How Java compares your report</summary><p style="margin-top:8px">Item name: 40 points. Category, location and date: 20 each. Matches scoring 50 or more appear here. Times are shown to help you compare; they do not change this score. This score is a simple rule, not proof of ownership.</p></details><button class="btn ghost" data-page="lost">My lost reports</button>`
};

function render(next){
  page=next;renderVersion++;photo='';photoLoading=false;app.dataset.page=next;
  app.innerHTML=views[next]();
  const content=document.createElement('div');content.className='page-content';
  while(app.children.length>1)content.appendChild(app.children[1]);
  app.appendChild(content);window.scrollTo(0,0);
}

async function navigate(next){
  if (page && page !== next && !['matches', 'posted'].includes(page)) {
    navHistory.push(page);
    if (navHistory.length > 10) navHistory.shift();
  }
  if(next==='lost') lostReports=await api('lost');
  if(next==='found'||next==='inbox') foundReports=await api('found');
  if(next==='home'){ [foundReports,lostReports]=await Promise.all([api('found'),api('lost')]); }
  if(next==='matches') matches=await api('matches?lostId='+current.id);
  if(next==='admin'||next==='faculty') adminData=await api('admin/overview');
  render(next);
}

function goBack() {
  const prev = navHistory.pop();
  if (prev && prev !== page) {
    navigate(prev);
  } else {
    navigate(user?.isFaculty ? 'faculty' : (user?.isAdmin ? 'admin' : 'home'));
  }
}

async function run(button, action){
  if(busy)return;busy=true;if(button)button.disabled=true;error('');
  try{await action();}catch(e){error(e.message);}finally{busy=false;if(button)button.disabled=false;}
}

function addTag(){
  const input=document.getElementById('custom-tag'),v=input.value.trim();if(!v)return;
  const existing=[...document.querySelectorAll('[data-g="tag"]')].find(b=>b.dataset.v.toLowerCase()===v.toLowerCase());
  if(existing){existing.classList.add('on');existing.setAttribute('aria-pressed','true');}
  else{const b=document.createElement('button');b.type='button';b.className='chip on';b.dataset.g='tag';b.dataset.v=v;b.dataset.multi='1';b.setAttribute('aria-pressed','true');b.textContent=v;document.querySelector('[data-g="tag"]').parentNode.appendChild(b);}
  input.value='';
}

function openMicrosoftVerification() {
  let isFacultyType = false;
  const dialog = document.createElement('dialog');
  dialog.className = 'ms-dialog';
  dialog.innerHTML = `
    <div class="ms-container">
      <div class="ms-header">
        <svg width="24" height="24" viewBox="0 0 21 21" fill="none"><path d="M1 1h9v9H1z" fill="#F25022"/><path d="M11 1h9v9h-9z" fill="#7FBA00"/><path d="M1 11h9v9H1z" fill="#00A4EF"/><path d="M11 11h9v9h-9z" fill="#FFB900"/></svg>
        <span>Microsoft 365</span>
      </div>
      <h2 style="font-size:18px;font-weight:600">Sign in to Manipal University Jaipur</h2>
      <p class="mute" style="font-size:13px;margin-top:4px">Select your university account type:</p>
      
      <div class="ms-types">
        <button type="button" class="ms-type-btn active" id="btn-type-student">🎓 Student Account</button>
        <button type="button" class="ms-type-btn" id="btn-type-faculty">👨‍🏫 Faculty / Staff</button>
      </div>

      <form id="ms-verify-form">
        <label class="field">
          <span>Full Name</span>
          <input id="ms-name" maxlength="80" required placeholder="Your full name">
        </label>
        
        <label class="field" id="label-ms-id">
          <span id="title-ms-id">10-Digit Registration Number</span>
          <input id="ms-id" inputmode="numeric" pattern="[0-9]{10}" minlength="10" maxlength="10" placeholder="e.g. 2309001234" required>
        </label>
        
        <label class="field">
          <span id="title-ms-email">University Microsoft Email</span>
          <input id="ms-email" type="email" autocomplete="email" placeholder="username@${esc(domain)}" required>
        </label>

        <label class="field">
          <span>Microsoft Password / SSO PIN</span>
          <input id="ms-pwd" type="password" placeholder="••••••••" required>
        </label>

        <div id="ms-err" class="err" role="alert" style="margin-top:10px"></div>

        <button class="btn-ms-submit" type="submit">Sign In</button>
        <button class="btn ghost" type="button" id="cancel-ms" style="width:100%;margin-top:8px">Cancel</button>
      </form>
      <p class="mute" style="font-size:11px;margin-top:16px;text-align:center">Protected by Microsoft 365 Single Sign-On · Manipal University Jaipur</p>
    </div>`;

  document.body.appendChild(dialog);
  dialog.showModal();

  const btnStudent = dialog.querySelector('#btn-type-student');
  const btnFaculty = dialog.querySelector('#btn-type-faculty');
  const titleId = dialog.querySelector('#title-ms-id');
  const inputId = dialog.querySelector('#ms-id');

  btnStudent.onclick = () => {
    isFacultyType = false;
    btnStudent.classList.add('active');
    btnFaculty.classList.remove('active');
    titleId.textContent = '10-Digit Registration Number';
    inputId.setAttribute('pattern', '[0-9]{10}');
    inputId.setAttribute('minlength', '10');
    inputId.setAttribute('maxlength', '10');
    inputId.placeholder = 'e.g. 2309001234';
  };

  btnFaculty.onclick = () => {
    isFacultyType = true;
    btnFaculty.classList.add('active');
    btnStudent.classList.remove('active');
    titleId.textContent = 'Faculty / Staff ID';
    inputId.removeAttribute('pattern');
    inputId.removeAttribute('minlength');
    inputId.setAttribute('maxlength', '25');
    inputId.placeholder = 'e.g. FAC1042';
  };

  const close = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector('#cancel-ms').onclick = close;

  dialog.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const btn = dialog.querySelector('.btn-ms-submit');
    btn.disabled = true;
    try {
      const email = dialog.querySelector('#ms-email').value.trim();
      const studentId = dialog.querySelector('#ms-id').value.trim();
      const name = dialog.querySelector('#ms-name').value.trim();
      await api('verify-ms', { email });
      user = await api('login', { name, studentId, email, role: isFacultyType ? 'faculty' : 'student' });
      user.isVerifiedMs = true;
      close();
      if (user.isFaculty) await navigate('faculty');
      else await navigate('home');
    } catch (err) {
      dialog.querySelector('#ms-err').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  };
}

document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='theme-toggle'){applyTheme(theme==='dark'?'light':'dark');return;}
 if(b.id==='btn-ms-login'||b.id==='btn-ms-login-alt'){openMicrosoftVerification();return;}
 if(b.id==='btn-faculty-portal'){render('facultyLogin');return;}
 if(b.id==='btn-admin-portal'){render('adminLogin');return;}
 if(b.dataset.action==='go-back'){goBack();return;}
 if(b.dataset.tab){adminTab=b.dataset.tab;render('admin');return;}
 if(b.dataset.facultyTab){facultyTab=b.dataset.facultyTab;render('faculty');return;}
 if(b.dataset.facultyResolve){
   await api('admin/resolve',{id:b.dataset.facultyResolve});
   await navigate('faculty');
   return;
 }
 if(b.dataset.adminDel){
   if(confirm('Are you sure you want to delete this report from the database?')){
     await api('admin/delete',{type:b.dataset.adminDel,id:b.dataset.id});
     await navigate('admin');
   }
   return;
 }
 if(b.dataset.adminResolve){
   await api('admin/resolve',{id:b.dataset.adminResolve});
   await navigate('admin');
   return;
 }
 if(b.dataset.g){if(b.dataset.multi)b.classList.toggle('on');else{document.querySelectorAll(`[data-g="${b.dataset.g}"]`).forEach(c=>{c.classList.remove('on');c.setAttribute('aria-pressed','false');});b.classList.add('on');}b.setAttribute('aria-pressed',b.classList.contains('on'));if(b.dataset.g==='name'){['other-name','other-category'].forEach(id=>document.getElementById(id).classList.toggle('hide',b.dataset.v!=='Other'));}if(b.dataset.g==='location')document.getElementById('other-location').classList.toggle('hide',b.dataset.v!=='Other');return;}
 if(b.id==='add-tag'){addTag();return;}
 if(b.dataset.request){openRequest(Number(b.dataset.request),b);return;}
 if(b.dataset.page) return run(b,()=>navigate(b.dataset.page));
 if(b.dataset.action==='logout') return run(b,async()=>{await api('logout',{});user=null;current=null;lostReports=[];foundReports=[];matches=[];navHistory.length=0;render('login');});
 if(b.dataset.lost)return run(b,async()=>{current=lostReports.find(l=>l.id===Number(b.dataset.lost));await navigate('matches');});
 if(b.dataset.refreshInbox)return run(b,()=>navigate(page==='inbox'?'inbox':'found'));
 if(b.dataset.refresh)return run(b,()=>navigate('matches'));
 if(b.dataset.review)return run(b,async()=>{await api('review',{requestId:b.dataset.review,decision:b.dataset.decision});await navigate(page==='inbox'?'inbox':'found');});
 if(b.dataset.returned)return run(b,async()=>{await api('returned',{foundId:b.dataset.returned});await navigate(page==='inbox'?'inbox':'found');});
});

document.addEventListener('submit',e=>{
 if(!['faculty-login-form','report-form','admin-login-form'].includes(e.target.id))return;e.preventDefault();
 run(e.submitter,async()=>{
  if(e.target.id==='admin-login-form'){
    user=await api('admin/login',{email:val('admin-email'),passcode:val('admin-passcode')});
    await navigate('admin');
    return;
  }
  if(e.target.id==='faculty-login-form'){
    user=await api('faculty/login',{name:val('fac-name'),facultyId:val('fac-id'),email:val('fac-email')});
    await navigate('faculty');
    return;
  }
  if(photoLoading)throw new Error('Please wait for the photo to finish processing.');
  const n=selected('name')[0],l=selected('location')[0];if(!n||!l)throw new Error('Choose an item and a location.');
  addTag();
  const data={name:n==='Other'?val('other-name'):n,category:n==='Other'?val('other-category'):CAT[n],location:l==='Other'?val('other-location'):l,date:val('date'),timeFrom:val('time-from'),timeTo:val('time-to'),description:selected('tag').join(', '),photo};
  if(page==='found'){
    data.phone=val('phone');await api('found',data);await navigate('inbox');
    const notice=document.createElement('p');notice.className='status';notice.setAttribute('role','status');notice.textContent='Found item saved and verified. It is listed below.';
    const history=document.querySelector('.section');history.prepend(notice);history.scrollIntoView({block:'start'});
  }
  else{current=await api('lost',data);await navigate('matches');}
 });
});

document.addEventListener('keydown',e=>{if(e.target.id==='custom-tag'&&e.key==='Enter'){e.preventDefault();addTag();}});

document.addEventListener('change',async e=>{
 if(e.target.id!=='photo')return;const file=e.target.files[0];if(!file)return;
 if(!['image/jpeg','image/png'].includes(file.type)||file.size>10000000){e.target.value='';error('Choose a JPG or PNG smaller than 10 MB.');return;}
 const version=renderVersion;photoLoading=true;
 document.getElementById('photo-label').innerHTML=`<span>Processing & optimizing photo...</span>`;
 try {
   const compressed = await compressImage(file, 1600, 0.82);
   if(version!==renderVersion)return;
   photo = compressed;
   photoLoading = false;
   document.getElementById('photo-label').innerHTML=`<img src="${esc(photo)}" alt="Selected item photo">`;
   error('');
 } catch(err) {
   if(version!==renderVersion)return;
   photoLoading=false;
   error(err.message || 'Could not process that photo. Try another file.');
 }
});

function openRequest(foundId,opener){
 const dialog=document.createElement('dialog');dialog.className='sheet';dialog.style.cssText='border:0;max-width:none;max-height:none;width:100%;height:100%;margin:0;padding:0;color:var(--ink)';
 dialog.innerHTML=`<div><h2 id="request-title">Claim ownership</h2><p class="mute" style="margin-top:10px">Describe a detail only you would know (e.g. what’s inside, hidden marks, or engraving). The finder reviews your claim before sharing contact details.</p><form id="request-form"><label class="field"><span>Your identifying detail</span><textarea id="proof" minlength="10" maxlength="500" rows="4" required placeholder="Enter private details to prove ownership (min 10 characters)..."></textarea></label><p id="request-error" class="err" role="alert"></p><button class="btn" type="submit">Submit ownership claim</button><button class="btn ghost" type="button" id="cancel-request">Cancel</button></form></div>`;
 document.body.appendChild(dialog);dialog.showModal();
 const close=()=>{dialog.close();dialog.remove();opener.focus();};dialog.querySelector('#cancel-request').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await api('requests',{lostId:current.id,foundId,proof:dialog.querySelector('#proof').value});close();await navigate('matches');}catch(err){if(dialog.isConnected)dialog.querySelector('#request-error').textContent=err.message;else error(err.message);}finally{b.disabled=false;}};
}

(async()=>{
  try{
    const config=await api('config');
    domain=config.domain;
    try{user=await api('me');}catch{}
    if(user){
      if(user.isAdmin) await navigate('admin');
      else if(user.isFaculty) await navigate('faculty');
      else await navigate('home');
    } else render('login');
  }catch{
    app.innerHTML='<h1>Start the Java server</h1><p class="notice">Run javac *.java, then java WebServer from the project folder. Open http://localhost:8080 to use the connected website.</p>';
  }
})();