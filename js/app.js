/* Application logic */
const DEFAULT_ADMIN_PASSWORD = 'teacher123';
// Provide safe fallbacks when running in non-browser environments (jsdom/node tests)
if (typeof globalThis !== 'undefined' && typeof globalThis.localStorage === 'undefined') {
  (function () {
    let _store = {};
    globalThis.localStorage = {
      getItem: (k) => (_store.hasOwnProperty(k) ? _store[k] : null),
      setItem: (k, v) => { _store[k] = String(v); },
      removeItem: (k) => { delete _store[k]; },
      clear: () => { _store = {}; }
    };
  })();
}
if (typeof globalThis !== 'undefined' && typeof globalThis.FileReader === 'undefined') {
  // minimal FileReader shim for environments that don't provide one
  globalThis.FileReader = function () {
    this.onload = null;
    this.result = null;
    this.readAsDataURL = function (file) {
      if (typeof this.onload === 'function') this.onload({ target: { result: null } });
    };
  };
}
// Ensure bare identifiers exist in vm scope (prevents ReferenceError under jsdom)
var localStorage = (typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined);
var FileReader = (typeof globalThis !== 'undefined' ? globalThis.FileReader : undefined);

let items = JSON.parse(localStorage.getItem('lostItems')) || [];

// API mode detection: set ?api=<baseUrl> (e.g. ?api=http://localhost:3000) or window.APP_CONFIG = { apiBase: 'http://...' }
const API_BASE = (function(){
  try{
    const p = new URLSearchParams(location.search).get('api');
    if(p) return p;
    return (window.APP_CONFIG && window.APP_CONFIG.apiBase) || null;
  }catch(e){ return null; }
})();

function apiEnabled(){ return !!API_BASE; }

async function apiFetch(method, path, body){
  if(!API_BASE) throw new Error('API not configured');
  const url = API_BASE.replace(/\/$/, '') + path;
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
  if(body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if(!res.ok){ const txt = await res.text(); throw new Error(txt || res.statusText); }
  return res;
}

async function apiGetItems(approvedOnly){
  const q = approvedOnly ? '?approved=true' : '';
  const res = await apiFetch('GET', '/api/items' + q);
  return await res.json();
}
async function apiReportItem(item){ const res = await apiFetch('POST', '/api/report', item); return await res.json(); }
async function apiApprove(id){ const res = await apiFetch('POST', `/api/admin/approve/${id}`); return await res.json(); }
async function apiDelete(id){ const res = await apiFetch('POST', `/api/admin/delete/${id}`); return await res.json(); }
async function apiClaim(id){ const res = await apiFetch('POST', `/api/items/claim/${id}`); return await res.json(); }
async function apiAdminLogin(password){ const res = await apiFetch('POST', '/api/admin/login', { password }); return await res.json(); }
async function apiChangePassword(newPassword){ const res = await apiFetch('POST', '/api/admin/change-password', { newPassword }); return await res.json(); }
async function refreshFromServer(){ items = await apiGetItems(); render(); if(document.getElementById('statsTotals')) renderStats(); }

function save() {
  localStorage.setItem('lostItems', JSON.stringify(items));
}

// When reporting, save a timestamp

function getAdminPassword() {
  return localStorage.getItem('adminPassword') || DEFAULT_ADMIN_PASSWORD;
}

function setAdminPassword(p) {
  localStorage.setItem('adminPassword', p);
}

// Expose to window scope for tests
if (typeof window !== 'undefined') {
  window.getAdminPassword = getAdminPassword;
  window.setAdminPassword = setAdminPassword;
  window.save = save;
  window.items = items;
}

/* --- Non-blocking UI helpers --- */
function ensureToastContainer() {
  let c = document.querySelector('.toast-container');
  if (!c) {
    c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}

function showToast(msg, type = 'info', timeout = 3000) {
  const c = ensureToastContainer();
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  c.appendChild(t);
  // allow CSS transition
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 250);
  }, timeout);
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';
    backdrop.innerHTML = `
      <div class="confirm-box" role="dialog" aria-modal="true">
        <div class="confirm-message">${message}</div>
        <div class="confirm-actions">
          <button class="cancelBtn">Cancel</button>
          <button class="confirmBtn danger">Delete</button>
        </div>
      </div>`;

    const cancelBtn = backdrop.querySelector('.cancelBtn');
    const confirmBtn = backdrop.querySelector('.confirmBtn');

    cancelBtn.addEventListener('click', () => {
      backdrop.remove();
      resolve(false);
    });
    confirmBtn.addEventListener('click', () => {
      backdrop.remove();
      resolve(true);
    });

    document.body.appendChild(backdrop);
  });
}

function render(list = items) {
  const ul = document.getElementById('itemList');
  if (!ul) return;
  ul.innerHTML = '';
  list.forEach((i) => {
    if (!i.approved || i.resolved) return;
    const origIndex = items.indexOf(i);
    ul.insertAdjacentHTML('beforeend',
      `<li>
        <strong>${i.name}</strong> (${i.category})
        ${i.photo ? `<img src="${i.photo}" class="item-photo">` : ''}
        <p>${i.desc}</p>
        <em>${i.location}</em><br>
        <button class="claimBtn" data-idx="${origIndex}" data-id="${i.id || ''}">Claim Item</button>
      </li>`);
  });

  // attach claim handlers
  ul.querySelectorAll('.claimBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const idx = Number(btn.dataset.idx);
      if (apiEnabled() && id) {
        try { await apiClaim(id); await refreshFromServer(); showToast('Item claimed.', 'success'); } catch (e){ showToast('Claim failed: '+e.message, 'error'); }
      } else {
        claim(idx);
      }
    });
  });
}

if(apiEnabled()){ refreshFromServer().catch(()=>{ render(); }); } else { render(); }

async function claim(x) {
  // x may be an index (local mode) or an id string (server mode)
  if (apiEnabled() && typeof x === 'string'){
    try{ await apiClaim(x); await refreshFromServer(); showToast('Item claimed.', 'success'); }catch(e){ showToast('Claim failed: '+e.message, 'error'); }
    return;
  }
  if (typeof x !== 'number' || !items[x]) return showToast('Item not found.', 'error');
  if (items[x].resolved) return showToast('Item already claimed.', 'info');
  items[x].resolved = true; save(); render(); showToast('Item claimed.', 'success');
}

/* --- Quick sidebar toggle --- */
(function(){
  function openSidebar(){
    const sb = document.getElementById('quickSidebar');
    if(!sb) return;
    sb.classList.add('open');
    sb.setAttribute('aria-hidden','false');
  }
  function closeSidebar(){
    const sb = document.getElementById('quickSidebar');
    if(!sb) return;
    sb.classList.remove('open');
    sb.setAttribute('aria-hidden','true');
  }
  const btn = document.getElementById('hamburgerBtn');
  if(btn){
    btn.addEventListener('click', ()=>{
      const sb = document.getElementById('quickSidebar');
      if(sb && sb.classList.contains('open')) closeSidebar(); else openSidebar();
    });
  }
  // close when clicking outside sidebar
  document.addEventListener('click', (ev)=>{
    const sb = document.getElementById('quickSidebar');
    if(!sb || !sb.classList.contains('open')) return;
    const target = ev.target;
    if(target.closest && !target.closest('.sidebar') && !target.closest('.hamburger')) closeSidebar();
  });
  // close on Escape
  document.addEventListener('keydown', (ev)=>{ if(ev.key==='Escape') closeSidebar(); });
})();

/* --- Demo button handlers (sidebar) --- */
(function(){
  const toastBtn = document.getElementById('demoToastBtn');
  const confirmBtn = document.getElementById('demoConfirmBtn');
  if(toastBtn){
    toastBtn.addEventListener('click', ()=> showToast('This is a demo toast', 'info'));
  }
  if(confirmBtn){
    confirmBtn.addEventListener('click', async ()=>{
      const ok = await showConfirm('This is a demo confirm. Proceed?');
      if(ok) showToast('Confirmed', 'success'); else showToast('Cancelled', 'info');
    });
  }
})();

const s = document.getElementById('searchInput');
const c = document.getElementById('categoryFilter');
if (s && c) {
  const f = () => render(items.filter(i => (!c.value || i.category === c.value) && (i.name.toLowerCase().includes(s.value.toLowerCase()) || i.desc.toLowerCase().includes(s.value.toLowerCase()))));
  s.addEventListener('input', f);
  c.addEventListener('change', f);
}

const form = document.getElementById('reportForm');
if (form) {
  const itemNameEl = document.getElementById('itemName');
  const itemDescEl = document.getElementById('itemDesc');
  const itemCategoryEl = document.getElementById('itemCategory');
  const itemLocationEl = document.getElementById('itemLocation');
  const itemPhotoEl = document.getElementById('itemPhoto');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = new FileReader();
    const file = itemPhotoEl && itemPhotoEl.files && itemPhotoEl.files[0];
    r.onload = () => add(r.result);
    (file ? r.readAsDataURL(file) : add(null));

    function add(p) {
      const newItem = {
        name: itemNameEl.value,
        desc: itemDescEl.value,
        location: itemLocationEl.value,
        category: itemCategoryEl.value,
        photo: p,
        approved: false,
        resolved: false,
        createdAt: new Date().toISOString()
      };
      if(apiEnabled()){
        apiReportItem(newItem).then(()=>{ showToast('Submitted for approval.', 'success'); form.reset(); refreshFromServer(); }).catch(e=> showToast('Submit failed: '+e.message,'error'));
      } else {
        items.push(newItem);
        save(); showToast('Submitted for approval.', 'success'); form.reset();
      }
    }
  });
}

const af = document.getElementById('adminForm');
if (af) {
  const adminPassEl = document.getElementById('adminPass');
  const adminListEl = document.getElementById('adminList');

  af.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!adminPassEl) return;
    if (apiEnabled()){
      apiAdminLogin(adminPassEl.value).then(()=>{
        // refresh from server and render admin list
        refreshFromServer().then(()=> populateAdminList()).catch(()=>{});
      }).catch(()=> showToast('Wrong password', 'error'));
      return;
    }
    if (adminPassEl.value !== getAdminPassword()) { showToast('Wrong password', 'error'); return; }

    function populateAdminList(){
      if (!adminListEl) return;
      adminListEl.innerHTML = '';
      items.forEach((i) => {
        const idx = items.indexOf(i);
        if (i.approved && !i.resolved) return; // skip already-approved & active items
        const idAttr = i.id ? `data-id="${i.id}"` : `data-idx="${idx}"`;
        adminListEl.insertAdjacentHTML('beforeend',
          `<li ${idAttr} data-idx="${idx}">${i.name}
            <button class="approveBtn" ${idAttr}>Approve</button>
            <button class="deleteBtn" ${idAttr}>Delete</button>
          </li>`);
      });
    }
    populateAdminList();

    // attach admin handlers
    adminListEl.querySelectorAll('.approveBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const idx = Number(btn.dataset.idx);
        if(apiEnabled() && id){ try{ await apiApprove(id); await refreshFromServer(); showToast('Approved', 'success'); }catch(e){ showToast('Approve failed: '+e.message,'error'); } }
        else { items[idx].approved = true; save(); populateAdminList(); showToast('Approved', 'success'); }
      });
    });
    adminListEl.querySelectorAll('.deleteBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const idx = Number(btn.dataset.idx);
        const ok = await showConfirm('Delete this item?');
        if (!ok) return;
        if(apiEnabled() && id){ try{ await apiDelete(id); await refreshFromServer(); showToast('Deleted', 'success'); }catch(e){ showToast('Delete failed: '+e.message,'error'); } }
        else { items.splice(idx, 1); save(); populateAdminList(); showToast('Deleted', 'success'); }
      });
    });

    // reveal password-change UI if present
    const cp = document.getElementById('changePasswordSection');
    if (cp) cp.style.display = 'block';
  });

  // handle password change (works whether UI is present or not)
  const changeBtn = document.getElementById('changePassBtn');
  const newPassEl = document.getElementById('newAdminPass');
  if (changeBtn && newPassEl) {
    changeBtn.addEventListener('click', () => {
      const val = newPassEl.value;
      if (!val) return showToast('Enter a new password.', 'error');
      if(apiEnabled()){
        apiChangePassword(val).then(()=>{ showToast('Admin password updated.', 'success'); newPassEl.value = ''; }).catch(e=> showToast('Password change failed: '+e.message,'error'));
      } else {
        setAdminPassword(val);
        showToast('Admin password updated.', 'success');
        newPassEl.value = '';
      }
    });
  }
}

  /* --- Settings page handlers --- */
  const settingsForm = document.getElementById('settingsAdminForm');
  if(settingsForm){
    const settingsPassEl = document.getElementById('settingsAdminPass');
    const settingsContent = document.getElementById('settingsContent');
    settingsForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      if(apiEnabled()){
        apiAdminLogin(settingsPassEl.value).then(()=>{ settingsContent.style.display = 'block'; }).catch(()=> showToast('Wrong password', 'error'));
        return;
      }
      if(settingsPassEl.value !== getAdminPassword()) return showToast('Wrong password', 'error');
      settingsContent.style.display = 'block';
    });

    const resetBtn = document.getElementById('resetDataBtn');
    if(resetBtn){
      resetBtn.addEventListener('click', async ()=>{
        const ok = await showConfirm('Delete ALL items? This cannot be undone.');
        if(!ok) return;
        if(apiEnabled()){
          try{
            // delete each item by id
            const ids = items.map(i=>i.id).filter(Boolean);
            for(const id of ids){ await apiDelete(id); }
            await refreshFromServer();
            showToast('All items deleted', 'success');
          }catch(e){ showToast('Reset failed: '+e.message, 'error'); }
        } else {
          items = []; save(); showToast('All items deleted', 'success');
        }
      });
    }

    // Settings password change handler
    const settingsChangeBtn = document.getElementById('changePassBtn');
    const settingsNewPassEl = document.getElementById('newAdminPass');
    if(settingsChangeBtn && settingsNewPassEl){
      settingsChangeBtn.addEventListener('click', ()=>{
        const val = settingsNewPassEl.value;
        if(!val) return showToast('Enter a new password.', 'error');
        if(apiEnabled()){
          apiChangePassword(val).then(()=>{ showToast('Admin password updated.', 'success'); settingsNewPassEl.value = ''; }).catch(e=> showToast('Password change failed: '+e.message,'error'));
        } else {
          setAdminPassword(val);
          showToast('Admin password updated.', 'success');
          settingsNewPassEl.value = '';
        }
      });
    }
  }

  /* --- Stats rendering --- */
  function renderStats(){
    const totals = { total: 0, approved: 0, resolved: 0 };
    const byCategory = {};
    const byLocation = {};
    items.forEach(i=>{
      totals.total++;
      if(i.approved) totals.approved++;
      if(i.resolved) totals.resolved++;
      byCategory[i.category] = (byCategory[i.category]||0)+1;
      byLocation[i.location] = (byLocation[i.location]||0)+1;
    });

    const totalsEl = document.getElementById('statsTotals');
    if(totalsEl) totalsEl.innerHTML = `<p>Total reported: ${totals.total}</p><p>Approved: ${totals.approved}</p><p>Resolved: ${totals.resolved}</p>`;

    const catEl = document.getElementById('categoryChart');
    if(catEl){
        // render as an accessible SVG micro-chart
        catEl.innerHTML = '';
        const entries = Object.keys(byCategory).map(k=>[k, byCategory[k]]);
        if(entries.length === 0){ catEl.innerHTML = '<p>No categories yet</p>'; }
        else{
          const max = Math.max(...entries.map(e=>e[1]));
          const maxBar = 300;
          const rowH = 28;
          const width = 100 + maxBar + 60;
          const svgNS = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(svgNS, 'svg');
          svg.setAttribute('viewBox', `0 0 ${width} ${entries.length * rowH}`);
          svg.setAttribute('role','img');
          svg.setAttribute('aria-label','Items by category');
          entries.forEach(([k,v], i)=>{
            const y = i * rowH;
            const w = max ? Math.max(8, Math.round((v / max) * maxBar)) : 8;
            const label = document.createElementNS(svgNS,'text');
            label.setAttribute('x', 0); label.setAttribute('y', y + 16); label.setAttribute('font-size', '12'); label.textContent = k;
            const rect = document.createElementNS(svgNS,'rect');
            rect.setAttribute('class', 'chart-rect');
            rect.setAttribute('x', 100); rect.setAttribute('y', y + 6); rect.setAttribute('width', String(w)); rect.setAttribute('height', '16'); rect.setAttribute('fill','#0077cc'); rect.setAttribute('data-value', String(v)); rect.setAttribute('aria-label', `${k}: ${v}`);
            const titleEl = document.createElementNS(svgNS, 'title');
            titleEl.textContent = `${k}: ${v}`;
            rect.appendChild(titleEl);
            const val = document.createElementNS(svgNS,'text');
            val.setAttribute('x', 100 + w + 8); val.setAttribute('y', y + 16); val.setAttribute('font-size', '12'); val.textContent = String(v);
            svg.appendChild(label); svg.appendChild(rect); svg.appendChild(val);
          });
          catEl.appendChild(svg);
        }
    }

    const locEl = document.getElementById('locationChart');
    if(locEl){
        // render as SVG micro-chart
        locEl.innerHTML = '';
        const entries = Object.keys(byLocation).map(k=>[k, byLocation[k]]);
        if(entries.length === 0){ locEl.innerHTML = '<p>No locations yet</p>'; }
        else{
          const max = Math.max(...entries.map(e=>e[1]));
          const maxBar = 300;
          const rowH = 28;
          const width = 100 + maxBar + 60;
          const svgNS = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(svgNS, 'svg');
          svg.setAttribute('viewBox', `0 0 ${width} ${entries.length * rowH}`);
          svg.setAttribute('role','img');
          svg.setAttribute('aria-label','Items by location');
          entries.forEach(([k,v], i)=>{
            const y = i * rowH;
            const w = max ? Math.max(8, Math.round((v / max) * maxBar)) : 8;
            const label = document.createElementNS(svgNS,'text');
            label.setAttribute('x', 0); label.setAttribute('y', y + 16); label.setAttribute('font-size', '12'); label.textContent = k;
            const rect = document.createElementNS(svgNS,'rect');
            rect.setAttribute('class', 'chart-rect');
            rect.setAttribute('x', 100); rect.setAttribute('y', y + 6); rect.setAttribute('width', String(w)); rect.setAttribute('height', '16'); rect.setAttribute('fill','#2e7d32'); rect.setAttribute('data-value', String(v)); rect.setAttribute('aria-label', `${k}: ${v}`);
            const titleEl = document.createElementNS(svgNS, 'title');
            titleEl.textContent = `${k}: ${v}`;
            rect.appendChild(titleEl);
            const val = document.createElementNS(svgNS,'text');
            val.setAttribute('x', 100 + w + 8); val.setAttribute('y', y + 16); val.setAttribute('font-size', '12'); val.textContent = String(v);
            svg.appendChild(label); svg.appendChild(rect); svg.appendChild(val);
          });
          locEl.appendChild(svg);
        }
    }
  }

  // call renderStats on pages that include stats
  if(document.getElementById('statsTotals')) renderStats();
