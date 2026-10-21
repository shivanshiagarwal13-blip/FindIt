// The browser renders forms. Java owns reports, matching and contact permissions.
const CAT = {Wallet:'Accessories',Keys:'Accessories',Bag:'Accessories','ID card':'Documents',Earphones:'Electronics',Charger:'Electronics',Phone:'Electronics',Bottle:'Other'};
const NAMES = [...Object.keys(CAT),'Other'];
const LOCS = ['LHC','AB1','AB2','AB3','Old Mess','Football Ground','Library','Other'];
const TAGS = ['Black','White','Blue','Red','Brown','Leather','Case','Sticker'];
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'});
const fmt = d => d.split('-').reverse().join('/');
const timeLabel = item => item.timeFrom ? ' · ' + esc(item.timeFrom) + (item.timeTo && item.timeTo !== item.timeFrom ? '–' + esc(item.timeTo) : '') : '';

let user = null, domain = 'muj.manipal.edu', page = 'login', photo = '', current = null, lostReports = [], foundReports = [], matches = [], busy = false, photoLoading = false, renderVersion = 0;
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
// Remember the user's theme choice independently of their login session.
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
const header = back => `<header class="top">${back?`<button class="link" data-page="home">← Back</button>`:'<span class="brand">FindIt</span>'}<div class="top-actions"><button type="button" class="theme-toggle" id="theme-toggle" aria-label="Switch to ${theme==='dark'?'light':'dark'} mode">${theme==='dark'?'☀ Light mode':'☾ Dark mode'}</button>${user?'<button class="link" data-action="logout">Sign out</button>':''}</div></header>`;
const photoBox = () => `<label class="photo" id="pb"><span id="photo-label">Choose a photo · JPG or PNG</span><input type="file" accept="image/jpeg,image/png" id="photo" aria-label="Choose an item photo"></label><p class="mute" style="margin-top:6px;font-size:12px">Up to 1 MB. Avoid showing personal information.</p>`;
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
 ${found?'<label class="field"><span>Your contact number</span><input id="phone" type="tel" autocomplete="tel" maxlength="25" required placeholder="10-digit mobile number"></label><p class="mute" style="margin-top:6px">Shared only after you approve an ownership request.</p>':`<div class="field"><span>Photo · optional</span>${photoBox()}</div>`}
 <div id="er" class="err" role="alert"></div><button class="btn" type="submit">${found?'Post found item':'Save & see matches'}</button></form>
 ${found?foundHistory():lostHistory()}`;
}
function lostHistory(){return `<section class="section"><h2>Your lost reports</h2>${lostReports.length?lostReports.map(l=>`<div class="report"><h3>${esc(l.name)}</h3><p class="mute">${esc(l.location)} · ${fmt(l.date)}${timeLabel(l)}</p><button class="link" data-lost="${l.id}">View possible matches →</button></div>`).join(''):'<p class="mute" style="margin-top:10px">Your reports will appear here.</p>'}</section>`;}
function foundHistory(){return `<section class="section"><h2>Your found reports</h2><button class="link" data-refresh-inbox="1">Refresh requests ↻</button>${foundReports.length?foundReports.map(f=>`<article class="report"><h3>${esc(f.name)}${f.claimed?' · Returned':''}</h3><p class="mute">${esc(f.location)} · ${fmt(f.date)}${timeLabel(f)}</p>${f.requests.length?f.requests.map(r=>`<div class="notice"><strong>${esc(r.name)}</strong><p style="margin-top:6px;white-space:pre-wrap">${esc(r.proof)}</p><p style="margin-top:6px">Reported loss: ${esc(r.lost.location)} · ${fmt(r.lost.date)}${timeLabel(r.lost)}<br>${esc(r.lost.description)}</p>${r.lost.photo?`<img src="${esc(r.lost.photo)}" alt="Owner’s reference photo" style="width:100%;max-height:160px;object-fit:contain;margin-top:8px">`:''}${r.status==='pending'&&!f.claimed?`<div class="row"><button class="btn" data-review="${r.id}" data-decision="approved">Approve</button><button class="btn ghost" data-review="${r.id}" data-decision="rejected">Decline</button></div>`:`<p class="status">${esc(r.status)}</p>`}</div>`).join(''):'<p class="mute" style="margin-top:10px">No ownership requests yet.</p>'}${!f.claimed&&f.requests.some(r=>r.status==='approved')?`<button class="btn ghost" data-returned="${f.id}">Confirm item handed back</button>`:''}</article>`).join(''):'<p class="mute">Your reports and ownership requests will appear here.</p>'}</section>`;}
const views = {
 login:()=>`${header()}<p class="eyebrow">Manipal University Jaipur · student project</p><h1>A little help.<br>A familiar thing back.</h1><p class="mute" style="margin-top:14px">Lost something on campus? Start here.</p><form id="login-form">
 <label class="field"><span>Full name</span><input id="name" autocomplete="name" maxlength="80" required></label>
 <label class="field"><span>Registration number</span><input id="student-id" autocomplete="username" inputmode="numeric" pattern="[0-9]{10}" minlength="10" maxlength="10" placeholder="10-digit registration number" required></label>
 <label class="field"><span>College email</span><input id="email" type="email" autocomplete="email" placeholder="name@${esc(domain)}" required></label>
 <div class="err" id="er" role="alert"></div><button class="btn" type="submit">Continue</button></form><div class="notice">Sign in with your registration number and college email. Email ownership is not verified. Reports and requests are saved for your next visit.</div>`,
 home:()=>`${header()}<p class="eyebrow">Your campus, looking out for you</p><h1>Hi, ${esc(user.name.split(' ')[0])}.<br>What happened?</h1><div class="cards"><button class="card a" data-page="lost"><svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M17 17l6 6"/></svg><h2>I lost something</h2><p>Report your item and see possible matches.</p></button><button class="card b" data-page="found"><svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h20v14H4zM9 8V5h10v3"/></svg><h2>I found something</h2><p>Add a photo, pick a few tags, help someone out.</p></button></div><div class="home-links"><button class="link" data-page="inbox">My found reports · ${foundReports.reduce((n,f)=>n+f.requests.filter(r=>r.status==='pending'&&!f.claimed).length,0)} pending requests →</button><button class="link" data-page="lost">My lost reports (${lostReports.length}) →</button></div><p class="foot">Only your reports. Only relevant matches.</p><div id="er" class="err" role="alert"></div>`,
 lost:()=>reportForm('lost'), found:()=>reportForm('found'),
 inbox:()=>`${header(true)}<p class="eyebrow">Reports & ownership requests</p><h1>Your found items</h1><p class="mute" style="margin-top:12px">Review the identifying details before approving. Approval shares your contact number with that student.</p>${foundHistory()}<button class="btn ghost" data-page="found">Report another found item</button><div id="er" class="err" role="alert"></div>`,
 posted:()=>`${header()}<p class="eyebrow">Found report saved</p><h1>Posted. Thank you.</h1><p class="mute" style="margin-top:14px">You may have made someone’s day a little easier. Review ownership requests under “I found something” before sharing your number.</p><button class="btn" data-page="found">View my found reports</button><button class="btn ghost" data-page="home">Back to home</button><div id="er" class="err" role="alert"></div>`,
  matches:()=>`${header(true)}<p class="eyebrow">Your lost report #${current.id}</p><h1>Possible matches</h1><p class="mute" style="margin-top:10px">${esc(current.name)} · ${esc(current.location)} · ${fmt(current.date)}${timeLabel(current)}</p><button class="link" data-refresh="1">Refresh matches ↻</button>${matches.length?matches.map(f=>`<article class="m"><div class="th">${f.photo?`<img src="${esc(f.photo)}" alt="Found ${esc(f.name)}">`:esc(f.name[0])}</div><div style="flex:1;min-width:0"><h3>${esc(f.name)} <span class="pill">${f.score}%</span></h3><p class="mute">${esc(f.location)} · ${fmt(f.date)}${timeLabel(f)}</p><p class="tags">${esc(f.description)}</p>${f.status==='own'?'<p class="status">Your found report (You reported this)</p><p class="mute" style="font-size:13px;margin-top:6px">Self-claiming is disabled. To test claiming ownership, sign in with a different student account (e.g. in a private/incognito window).</p>':f.status==='approved'?`<p class="status">Finder approved your ownership claim</p><a class="link" href="tel:${esc(f.phone.replace(/[^+0-9]/g,''))}">Call finder: ${esc(f.phone)}</a>`:f.status==='pending'?'<p class="lock">Ownership claim sent. Waiting for the finder to review.</p>':f.status==='rejected'?'<p class="lock">The finder declined this ownership claim.</p>':`<p class="lock">Contact stays private until the finder approves.</p><button class="btn" data-request="${f.id}">Claim ownership</button>`}</div></article>`).join(''):'<div class="empty">No possible matches yet.<br>Your report is saved. Check back here later.</div>'}<div id="er" class="err" role="alert"></div><details><summary>How Java compares your report</summary><p style="margin-top:8px">Item name: 40 points. Category, location and date: 20 each. Matches scoring 50 or more appear here. Times are shown to help you compare; they do not change this score. This score is a simple rule, not proof of ownership.</p></details><button class="btn ghost" data-page="lost">My lost reports</button>`
};
function render(next){page=next;renderVersion++;photo='';photoLoading=false;app.dataset.page=next;app.innerHTML=views[next]();const content=document.createElement('div');content.className='page-content';while(app.children.length>1)content.appendChild(app.children[1]);app.appendChild(content);window.scrollTo(0,0);}
async function navigate(next){if(next==='lost')lostReports=await api('lost');if(next==='found'||next==='inbox')foundReports=await api('found');if(next==='home'){[foundReports,lostReports]=await Promise.all([api('found'),api('lost')]);}if(next==='matches')matches=await api('matches?lostId='+current.id);render(next);}
async function run(button, action){if(busy)return;busy=true;if(button)button.disabled=true;error('');try{await action();}catch(e){error(e.message);}finally{busy=false;if(button)button.disabled=false;}}
function addTag(){const input=document.getElementById('custom-tag'),v=input.value.trim();if(!v)return;const existing=[...document.querySelectorAll('[data-g="tag"]')].find(b=>b.dataset.v.toLowerCase()===v.toLowerCase());if(existing){existing.classList.add('on');existing.setAttribute('aria-pressed','true');}else{const b=document.createElement('button');b.type='button';b.className='chip on';b.dataset.g='tag';b.dataset.v=v;b.dataset.multi='1';b.setAttribute('aria-pressed','true');b.textContent=v;document.querySelector('[data-g="tag"]').parentNode.appendChild(b);}input.value='';}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='theme-toggle'){applyTheme(theme==='dark'?'light':'dark');return;}
 if(b.dataset.g){if(b.dataset.multi)b.classList.toggle('on');else{document.querySelectorAll(`[data-g="${b.dataset.g}"]`).forEach(c=>{c.classList.remove('on');c.setAttribute('aria-pressed','false');});b.classList.add('on');}b.setAttribute('aria-pressed',b.classList.contains('on'));if(b.dataset.g==='name'){['other-name','other-category'].forEach(id=>document.getElementById(id).classList.toggle('hide',b.dataset.v!=='Other'));}if(b.dataset.g==='location')document.getElementById('other-location').classList.toggle('hide',b.dataset.v!=='Other');return;}
 if(b.id==='add-tag'){addTag();return;}
 if(b.dataset.request){openRequest(Number(b.dataset.request),b);return;}
 if(b.dataset.page) return run(b,()=>navigate(b.dataset.page));
 if(b.dataset.action==='logout') return run(b,async()=>{await api('logout',{});user=null;current=null;lostReports=[];foundReports=[];matches=[];render('login');});
 if(b.dataset.lost)return run(b,async()=>{current=lostReports.find(l=>l.id===Number(b.dataset.lost));await navigate('matches');});
 if(b.dataset.refreshInbox)return run(b,()=>navigate(page==='inbox'?'inbox':'found'));
 if(b.dataset.refresh)return run(b,()=>navigate('matches'));
 if(b.dataset.review)return run(b,async()=>{await api('review',{requestId:b.dataset.review,decision:b.dataset.decision});await navigate(page==='inbox'?'inbox':'found');});
 if(b.dataset.returned)return run(b,async()=>{await api('returned',{foundId:b.dataset.returned});await navigate(page==='inbox'?'inbox':'found');});
});
document.addEventListener('submit',e=>{
 if(!['login-form','report-form'].includes(e.target.id))return;e.preventDefault();
 run(e.submitter,async()=>{
  if(e.target.id==='login-form'){user=await api('login',{name:val('name'),studentId:val('student-id'),email:val('email')});await navigate('home');return;}
  if(photoLoading)throw new Error('Please wait for the photo to finish loading.');
  const n=selected('name')[0],l=selected('location')[0];if(!n||!l)throw new Error('Choose an item and a location.');
  addTag();
  const data={name:n==='Other'?val('other-name'):n,category:n==='Other'?val('other-category'):CAT[n],location:l==='Other'?val('other-location'):l,date:val('date'),timeFrom:val('time-from'),timeTo:val('time-to'),description:selected('tag').join(', '),photo};
  if(page==='found'){
    data.phone=val('phone');await api('found',data);await navigate('inbox');
    const notice=document.createElement('p');notice.className='status';notice.setAttribute('role','status');notice.textContent='Found item saved. It is listed below.';
    const history=document.querySelector('.section');history.prepend(notice);history.scrollIntoView({block:'start'});
  }
  else{current=await api('lost',data);await navigate('matches');}
 });
});
document.addEventListener('keydown',e=>{if(e.target.id==='custom-tag'&&e.key==='Enter'){e.preventDefault();addTag();}});
document.addEventListener('change',e=>{
 if(e.target.id!=='photo')return;const file=e.target.files[0];if(!file)return;
 if(!['image/jpeg','image/png'].includes(file.type)||file.size>1000000){e.target.value='';error('Choose a JPG or PNG smaller than 1 MB.');return;}
 const version=renderVersion;photoLoading=true;const reader=new FileReader();
 reader.onload=()=>{if(version!==renderVersion)return;photo=reader.result;photoLoading=false;document.getElementById('photo-label').innerHTML=`<img src="${esc(photo)}" alt="Selected item photo">`;error('');};
 reader.onerror=()=>{if(version!==renderVersion)return;photoLoading=false;error('Could not read that photo. Try another file.');};reader.readAsDataURL(file);
});
function openRequest(foundId,opener){
 const dialog=document.createElement('dialog');dialog.className='sheet';dialog.style.cssText='border:0;max-width:none;max-height:none;width:100%;height:100%;margin:0;padding:0;color:var(--ink)';
 dialog.innerHTML=`<div><h2 id="request-title">Claim ownership</h2><p class="mute" style="margin-top:10px">Describe a detail only you would know (e.g. what’s inside, hidden marks, or engraving). The finder reviews your claim before sharing contact details.</p><form id="request-form"><label class="field"><span>Your identifying detail</span><textarea id="proof" minlength="10" maxlength="500" rows="4" required placeholder="Enter private details to prove ownership (min 10 characters)..."></textarea></label><p id="request-error" class="err" role="alert"></p><button class="btn" type="submit">Submit ownership claim</button><button class="btn ghost" type="button" id="cancel-request">Cancel</button></form></div>`;
 document.body.appendChild(dialog);dialog.showModal();
 const close=()=>{dialog.close();dialog.remove();opener.focus();};dialog.querySelector('#cancel-request').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await api('requests',{lostId:current.id,foundId,proof:dialog.querySelector('#proof').value});close();await navigate('matches');}catch(err){if(dialog.isConnected)dialog.querySelector('#request-error').textContent=err.message;else error(err.message);}finally{b.disabled=false;}};
}
(async()=>{try{const config=await api('config');domain=config.domain;try{user=await api('me');}catch{}if(user)await navigate('home');else render('login');}catch{app.innerHTML='<h1>Start the Java server</h1><p class="notice">Run javac *.java, then java WebServer from the project folder. Open http://localhost:8080 to use the connected website.</p>';}})();
