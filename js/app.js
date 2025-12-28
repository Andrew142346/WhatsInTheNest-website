/* Application logic */
const DEFAULT_ADMIN_PASSWORD = 'teacher123';

const DEFAULT_LOCATIONS = [
  'New Gym',
  'Old Gym',
  "Bay's Locker Room",
  'Girls Locker Room',
  'High School Hallway',
  'Elementary Hallway',
  'Music Room',
  'Science Room',
  'Art Room',
  'Lunch Room',
  'Teacher Work Room',
  'First Grade Room',
  'Second Grade Room',
  'Third Grade Room',
  'Fourth Grade Room',
  'Fifth Grade Room',
  'Sixth Grade Room',
  'Pre-K Room',
  'Kindergarten Room',
  'History Room',
  'English Room',
  'Computer Room',
  'Math Room',
  'Other'
];

let items = JSON.parse(localStorage.getItem('lostItems')) || [];

function getLocations() {
  const stored = localStorage.getItem('customLocations');
  if (!stored) {
    localStorage.setItem('customLocations', JSON.stringify(DEFAULT_LOCATIONS));
    return DEFAULT_LOCATIONS.slice();
  }
  return JSON.parse(stored);
}

function saveLocations(locations) {
  localStorage.setItem('customLocations', JSON.stringify(locations));
}

function addLocation(locationName) {
  const locations = getLocations();
  const trimmed = locationName.trim();
  if (!trimmed) return false;
  if (locations.includes(trimmed)) {
    showToast('Location already exists', 'error');
    return false;
  }
  locations.push(trimmed);
  locations.sort();
  saveLocations(locations);
  return true;
}

function removeLocation(locationName) {
  const locations = getLocations();
  const index = locations.indexOf(locationName);
  if (index > -1) {
    locations.splice(index, 1);
    saveLocations(locations);
    return true;
  }
  return false;
}

// Session-based admin login (persists across pages, resets when tab/window closes)
function isAdminLoggedIn() {
  return sessionStorage.getItem('adminLoggedIn') === 'true';
}

function setAdminLoggedIn() {
  sessionStorage.setItem('adminLoggedIn', 'true');
  showAdminLinks();
}

function showAdminLinks() {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = 'block';
  });
}

function hideAdminLinks() {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = 'none';
  });
}

/* --- Hamburger Menu --- */
(function() {
  const hamburger = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');
  
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      sidebar.classList.toggle('open');
    });
    
    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !hamburger.contains(e.target) && sidebar.classList.contains('open')) {
        hamburger.classList.remove('open');
        sidebar.classList.remove('open');
      }
    });
    
    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        hamburger.classList.remove('open');
        sidebar.classList.remove('open');
      }
    });
  }
})();

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
    // Don't show if not approved, already resolved, or has a pending claim request
    if (!i.approved || i.resolved || i.claimRequested) return;
    const origIndex = items.indexOf(i);
    ul.insertAdjacentHTML('beforeend',
      `<li>
        <strong>${i.name}</strong> (${i.category})
        ${i.photo ? `<img src="${i.photo}" class="item-photo">` : ''}
        <p>${i.desc}</p>
        <em>${i.location}</em><br>
        <button class="inquireBtn" data-idx="${origIndex}" data-id="${i.id || ''}">Inquire</button>
        <button class="claimBtn" data-idx="${origIndex}" data-id="${i.id || ''}">Claim Item</button>
      </li>`);
  });

  // attach claim handlers
  ul.querySelectorAll('.claimBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const idx = Number(btn.dataset.idx);
      
      // Prompt for claimer name
      const claimerName = prompt('Please enter your name to claim this item:');
      if (!claimerName || claimerName.trim() === '') {
        showToast('Name is required to claim an item.', 'error');
        return;
      }
      
      if (apiEnabled() && id) {
        try { await apiClaim(id); await refreshFromServer(); showToast('Claim request submitted for approval.', 'success'); } catch (e){ showToast('Claim failed: '+e.message, 'error'); }
      } else {
        claim(idx, claimerName.trim());
      }
    });
  });
  
  // attach inquire handlers
  ul.querySelectorAll('.inquireBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const idx = Number(btn.dataset.idx);
      
      // Prompt for inquirer name
      const inquirerName = prompt('Please enter your name and contact info:');
      if (!inquirerName || inquirerName.trim() === '') {
        showToast('Name is required to inquire about an item.', 'error');
        return;
      }
      
      if (apiEnabled() && id) {
        showToast('API inquire not yet implemented', 'error');
      } else {
        inquire(idx, inquirerName.trim());
      }
    });
  });
}

if(apiEnabled()){ refreshFromServer().catch(()=>{ render(); }); } else { render(); }

async function claim(x, claimerName) {
  // x may be an index (local mode) or an id string (server mode)
  if (apiEnabled() && typeof x === 'string'){
    try{ await apiClaim(x); await refreshFromServer(); showToast('Claim request submitted for approval.', 'success'); }catch(e){ showToast('Claim failed: '+e.message, 'error'); }
    return;
  }
  if (typeof x !== 'number' || !items[x]) return showToast('Item not found.', 'error');
  if (items[x].resolved) return showToast('Item already claimed.', 'info');
  if (items[x].claimRequested) return showToast('Claim request already pending.', 'info');
  
  items[x].claimRequested = true;
  items[x].claimerName = claimerName;
  items[x].claimRequestedAt = new Date().toISOString();
  save(); 
  render(); 
  showToast('Claim request submitted for approval.', 'success');
}

function inquire(idx, inquirerInfo) {
  if (typeof idx !== 'number' || !items[idx]) return showToast('Item not found.', 'error');
  if (items[idx].resolved) return showToast('Item already claimed.', 'info');
  if (items[idx].claimRequested) return showToast('Item has pending claim request.', 'info');
  
  // Add inquiry to item
  if (!items[idx].inquiries) items[idx].inquiries = [];
  items[idx].inquiries.push({
    inquirerInfo: inquirerInfo,
    inquiredAt: new Date().toISOString()
  });
  
  save();
  showToast('Inquiry submitted to admin.', 'success');
}



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
  
  // Populate location datalist
  const locationDatalist = document.getElementById('locationOptions');
  if (locationDatalist) {
    const locations = getLocations();
    locationDatalist.innerHTML = '';
    locations.forEach(loc => {
      const option = document.createElement('option');
      option.value = loc;
      locationDatalist.appendChild(option);
    });
  }

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

// Admin page login modal
const adminLoginModal = document.getElementById('adminLoginModal');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminContent = document.getElementById('adminContent');

if (adminLoginModal && adminLoginForm && adminContent) {
  const adminListEl = document.getElementById('adminList');
  
  // Show modal if not logged in
  if (!isAdminLoggedIn()) {
    adminLoginModal.style.display = 'flex';
  } else {
    adminContent.style.display = 'block';
    showAdminLinks();
  }
  
  adminLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const adminLoginPass = document.getElementById('adminLoginPass');
    if (!adminLoginPass) return;
    
    if (apiEnabled()){
      apiAdminLogin(adminLoginPass.value).then(()=>{
        setAdminLoggedIn();
        adminLoginModal.style.display = 'none';
        adminContent.style.display = 'block';
        refreshFromServer().then(()=> { populateAdminList(); populateClaimRequestsList(); populateClaimedList(); }).catch(()=>{});
      }).catch(()=> showToast('Wrong password', 'error'));
      return;
    }
    
    if (adminLoginPass.value !== getAdminPassword()) { 
      showToast('Wrong password', 'error'); 
      return; 
    }
    
    setAdminLoggedIn();
    adminLoginModal.style.display = 'none';
    adminContent.style.display = 'block';
    showAdminLinks();

    function populateAdminList(searchTerm = ''){
      if (!adminListEl) return;
      adminListEl.innerHTML = '';
      items.forEach((i) => {
        const idx = items.indexOf(i);
        // skip approved items, resolved items, and items with pending claim requests
        if (i.approved || i.resolved || i.claimRequested) return;
        
        // Apply search filter
        if (searchTerm && !i.name.toLowerCase().includes(searchTerm) && 
            !i.desc.toLowerCase().includes(searchTerm) && 
            !i.category.toLowerCase().includes(searchTerm) &&
            !i.location.toLowerCase().includes(searchTerm)) return;
        
        const idAttr = i.id ? `data-id="${i.id}"` : `data-idx="${idx}"`;
        adminListEl.insertAdjacentHTML('beforeend',
          `<li ${idAttr} data-idx="${idx}">${i.name}
            <button class="approveBtn" ${idAttr}>Approve</button>
            <button class="deleteBtn" ${idAttr}>Delete</button>
          </li>`);
      });
      if (adminListEl.children.length === 0) {
        adminListEl.innerHTML = '<li><em>No pending items</em></li>';
      }
    }
    
    function populateInquiriesList(searchTerm = ''){
      const inquiriesListEl = document.getElementById('inquiriesList');
      if (!inquiriesListEl) return;
      inquiriesListEl.innerHTML = '';
      
      const itemsWithInquiries = [];
      items.forEach((i) => {
        if (!i.inquiries || i.inquiries.length === 0) return;
        if (i.resolved) return; // Don't show inquiries for claimed items
        
        // Apply search filter
        if (searchTerm && !i.name.toLowerCase().includes(searchTerm) && 
            !i.desc.toLowerCase().includes(searchTerm) && 
            !i.category.toLowerCase().includes(searchTerm) &&
            !i.location.toLowerCase().includes(searchTerm)) return;
        
        itemsWithInquiries.push(i);
      });
      
      if (itemsWithInquiries.length === 0) {
        inquiriesListEl.innerHTML = '<li><em>No inquiries</em></li>';
        return;
      }
      
      itemsWithInquiries.forEach((i) => {
        const idx = items.indexOf(i);
        const idAttr = i.id ? `data-id="${i.id}"` : `data-idx="${idx}"`;
        const inquiriesCount = i.inquiries.length;
        const latestInquiry = i.inquiries[i.inquiries.length - 1];
        inquiriesListEl.insertAdjacentHTML('beforeend',
          `<li ${idAttr} data-idx="${idx}">
            <strong>${i.name}</strong> - ${i.category}<br>
            <em>${inquiriesCount} inquir${inquiriesCount === 1 ? 'y' : 'ies'}</em><br>
            <button class="viewInquiriesBtn" ${idAttr}>View Inquiries</button>
            <button class="clearInquiriesBtn" ${idAttr}>Clear All</button>
          </li>`);
      });
      
      // Attach view inquiries handlers
      function showInquiriesModal(item) {
        if (!item || !item.inquiries || item.inquiries.length === 0) return;

        // Remove any existing inquiries modal to avoid duplicates
        const existing = document.getElementById('inquiriesModal');
        if (existing && existing.parentNode) {
          existing.parentNode.removeChild(existing);
        }

        const overlay = document.createElement('div');
        overlay.id = 'inquiriesModal';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '10000';

        const dialog = document.createElement('div');
        dialog.style.backgroundColor = '#fff';
        dialog.style.borderRadius = '4px';
        dialog.style.maxWidth = '600px';
        dialog.style.width = '90%';
        dialog.style.maxHeight = '80vh';
        dialog.style.overflowY = 'auto';
        dialog.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        dialog.style.padding = '16px 20px';

        const title = document.createElement('h2');
        title.textContent = `Inquiries for "${item.name}"`;
        title.style.marginTop = '0';

        const list = document.createElement('ol');
        list.style.paddingLeft = '20px';

        item.inquiries.forEach((inq, index) => {
          const li = document.createElement('li');
          const date = inq.inquiredAt ? new Date(inq.inquiredAt).toLocaleString() : '';
          const info = document.createElement('div');
          info.textContent = inq.inquirerInfo || '';
          const meta = document.createElement('div');
          meta.style.fontSize = '0.85em';
          meta.style.color = '#666';
          meta.textContent = date ? `(${date})` : '';
          li.appendChild(info);
          li.appendChild(meta);
          list.appendChild(li);
        });

        const footer = document.createElement('div');
        footer.style.textAlign = 'right';
        footer.style.marginTop = '16px';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
          document.removeEventListener('keydown', onKeyDown);
        });

        footer.appendChild(closeBtn);
        dialog.appendChild(title);
        dialog.appendChild(list);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);

        function onKeyDown(e) {
          if (e.key === 'Escape') {
            if (overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
            document.removeEventListener('keydown', onKeyDown);
          }
        }

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            if (overlay.parentNode) {
              overlay.parentNode.removeChild(overlay);
            }
            document.removeEventListener('keydown', onKeyDown);
          }
        });

        document.body.appendChild(overlay);
        document.addEventListener('keydown', onKeyDown);
      }

      inquiriesListEl.querySelectorAll('.viewInquiriesBtn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          if (!items[idx] || !items[idx].inquiries) return;

          showInquiriesModal(items[idx]);
        });
      });
      
      // Attach clear inquiries handlers
      inquiriesListEl.querySelectorAll('.clearInquiriesBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = Number(btn.dataset.idx);
          const ok = await showConfirm('Clear all inquiries for this item?');
          if (!ok) return;
          
          if (items[idx]) {
            items[idx].inquiries = [];
            save();
            populateInquiriesList(searchTerm);
            showToast('Inquiries cleared', 'success');
          }
        });
      });
    }
    
    function populateClaimedList(searchTerm = ''){
      const claimedListEl = document.getElementById('claimedList');
      if (!claimedListEl) return;
      claimedListEl.innerHTML = '';
      const claimedItems = items.filter(i => {
        if (!i.resolved) return false;
        
        // Apply search filter
        if (searchTerm && !i.name.toLowerCase().includes(searchTerm) && 
            !i.desc.toLowerCase().includes(searchTerm) && 
            !i.category.toLowerCase().includes(searchTerm) &&
            !i.location.toLowerCase().includes(searchTerm) &&
            !(i.claimerName && i.claimerName.toLowerCase().includes(searchTerm))) return false;
        
        return true;
      });
      
      if (claimedItems.length === 0) {
        claimedListEl.innerHTML = '<li><em>No claimed items</em></li>';
        return;
      }
      claimedItems.forEach((i) => {
        const idx = items.indexOf(i);
        const idAttr = i.id ? `data-id="${i.id}"` : `data-idx="${idx}"`;
        const claimedDate = i.claimedAt ? ` (claimed ${new Date(i.claimedAt).toLocaleDateString()})` : '';
        const claimerInfo = i.claimerName ? ` by ${i.claimerName}` : '';
        claimedListEl.insertAdjacentHTML('beforeend',
          `<li ${idAttr} data-idx="${idx}">
            <strong>${i.name}</strong> - ${i.category}${claimerInfo}${claimedDate}
            <button class="deleteClaimedBtn" ${idAttr}>Delete</button>
          </li>`);
      });
      
      // attach delete handlers for claimed items
      claimedListEl.querySelectorAll('.deleteClaimedBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const idx = Number(btn.dataset.idx);
          const ok = await showConfirm('Delete this claimed item?');
          if (!ok) return;
          if(apiEnabled() && id){ 
            try{ await apiDelete(id); await refreshFromServer(); populateClaimedList(); showToast('Deleted', 'success'); }
            catch(e){ showToast('Delete failed: '+e.message,'error'); }
          } else { 
            items.splice(idx, 1); save(); populateClaimedList(); showToast('Deleted', 'success'); 
          }
        });
      });
    }
    
    function populateClaimRequestsList(searchTerm = ''){
      const claimRequestsListEl = document.getElementById('claimRequestsList');
      if (!claimRequestsListEl) return;
      claimRequestsListEl.innerHTML = '';
      const claimRequests = items.filter(i => {
        if (!i.claimRequested || i.resolved) return false;
        
        // Apply search filter
        if (searchTerm && !i.name.toLowerCase().includes(searchTerm) && 
            !i.desc.toLowerCase().includes(searchTerm) && 
            !i.category.toLowerCase().includes(searchTerm) &&
            !i.location.toLowerCase().includes(searchTerm) &&
            !(i.claimerName && i.claimerName.toLowerCase().includes(searchTerm))) return false;
        
        return true;
      });
      
      if (claimRequests.length === 0) {
        claimRequestsListEl.innerHTML = '<li><em>No pending claim requests</em></li>';
        return;
      }
      claimRequests.forEach((i) => {
        const idx = items.indexOf(i);
        const idAttr = i.id ? `data-id="${i.id}"` : `data-idx="${idx}"`;
        const requestDate = i.claimRequestedAt ? ` (requested ${new Date(i.claimRequestedAt).toLocaleDateString()})` : '';
        claimRequestsListEl.insertAdjacentHTML('beforeend',
          `<li ${idAttr} data-idx="${idx}">
            <strong>${i.name}</strong> - ${i.category}<br>
            <em>Requested by: ${i.claimerName}${requestDate}</em><br>
            <button class="approveClaimBtn" ${idAttr}>Approve Claim</button>
            <button class="rejectClaimBtn" ${idAttr}>Reject Claim</button>
          </li>`);
      });
      
      // attach approve claim handlers
      claimRequestsListEl.querySelectorAll('.approveClaimBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const idx = Number(btn.dataset.idx);
          if(apiEnabled() && id){ 
            showToast('API claim approval not yet implemented', 'error');
          } else { 
            items[idx].resolved = true;
            items[idx].claimedAt = new Date().toISOString();
            items[idx].claimRequested = false;
            save(); 
            populateAdminList();
            populateClaimRequestsList();
            populateClaimedList();
            showToast(`Item approved for ${items[idx].claimerName}`, 'success'); 
          }
        });
      });
      
      // attach reject claim handlers
      claimRequestsListEl.querySelectorAll('.rejectClaimBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const idx = Number(btn.dataset.idx);
          const ok = await showConfirm('Reject this claim request?');
          if (!ok) return;
          if(apiEnabled() && id){ 
            showToast('API claim rejection not yet implemented', 'error');
          } else { 
            items[idx].claimRequested = false;
            items[idx].claimerName = null;
            items[idx].claimRequestedAt = null;
            save(); 
            populateAdminList();
            populateClaimRequestsList();
            render();
            showToast('Claim request rejected', 'success'); 
          }
        });
      });
    }
    
    populateAdminList();
    populateInquiriesList();
    populateClaimRequestsList();
    populateClaimedList();
    
    // Setup section toggles
    const togglePendingItems = document.getElementById('togglePendingItems');
    const pendingItemsSection = document.getElementById('pendingItemsSection');
    if (togglePendingItems && pendingItemsSection) {
      togglePendingItems.addEventListener('click', () => {
        if (pendingItemsSection.style.display === 'none') {
          pendingItemsSection.style.display = 'block';
          togglePendingItems.textContent = 'Pending Items (New Submissions) ▲';
        } else {
          pendingItemsSection.style.display = 'none';
          togglePendingItems.textContent = 'Pending Items (New Submissions) ▼';
        }
      });
    }
    
    const toggleInquiries = document.getElementById('toggleInquiries');
    const inquiriesSection = document.getElementById('inquiriesSection');
    if (toggleInquiries && inquiriesSection) {
      toggleInquiries.addEventListener('click', () => {
        if (inquiriesSection.style.display === 'none') {
          inquiriesSection.style.display = 'block';
          toggleInquiries.textContent = 'Inquiries ▲';
        } else {
          inquiriesSection.style.display = 'none';
          toggleInquiries.textContent = 'Inquiries ▼';
        }
      });
    }
    
    const toggleClaimRequests = document.getElementById('toggleClaimRequests');
    const claimRequestsSection = document.getElementById('claimRequestsSection');
    if (toggleClaimRequests && claimRequestsSection) {
      toggleClaimRequests.addEventListener('click', () => {
        if (claimRequestsSection.style.display === 'none') {
          claimRequestsSection.style.display = 'block';
          toggleClaimRequests.textContent = 'Pending Claim Requests ▲';
        } else {
          claimRequestsSection.style.display = 'none';
          toggleClaimRequests.textContent = 'Pending Claim Requests ▼';
        }
      });
    }
    
    const toggleClaimedItems = document.getElementById('toggleClaimedItems');
    const claimedItemsSection = document.getElementById('claimedItemsSection');
    if (toggleClaimedItems && claimedItemsSection) {
      toggleClaimedItems.addEventListener('click', () => {
        if (claimedItemsSection.style.display === 'none') {
          claimedItemsSection.style.display = 'block';
          toggleClaimedItems.textContent = 'Claimed Items ▲';
        } else {
          claimedItemsSection.style.display = 'none';
          toggleClaimedItems.textContent = 'Claimed Items ▼';
        }
      });
    }
    
    // Setup individual search bars
    const pendingItemsSearch = document.getElementById('pendingItemsSearch');
    if (pendingItemsSearch) {
      pendingItemsSearch.addEventListener('input', () => {
        populateAdminList(pendingItemsSearch.value.toLowerCase());
      });
    }
    
    const inquiriesSearch = document.getElementById('inquiriesSearch');
    if (inquiriesSearch) {
      inquiriesSearch.addEventListener('input', () => {
        populateInquiriesList(inquiriesSearch.value.toLowerCase());
      });
    }
    
    const claimRequestsSearch = document.getElementById('claimRequestsSearch');
    if (claimRequestsSearch) {
      claimRequestsSearch.addEventListener('input', () => {
        populateClaimRequestsList(claimRequestsSearch.value.toLowerCase());
      });
    }
    
    const claimedItemsSearch = document.getElementById('claimedItemsSearch');
    if (claimedItemsSearch) {
      claimedItemsSearch.addEventListener('input', () => {
        populateClaimedList(claimedItemsSearch.value.toLowerCase());
      });
    }

    // attach admin handlers
    adminListEl.querySelectorAll('.approveBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const idx = Number(btn.dataset.idx);
        if(apiEnabled() && id){ try{ await apiApprove(id); await refreshFromServer(); populateClaimRequestsList(); populateClaimedList(); showToast('Approved', 'success'); }catch(e){ showToast('Approve failed: '+e.message,'error'); } }
        else { items[idx].approved = true; save(); populateAdminList(); populateClaimRequestsList(); populateClaimedList(); showToast('Approved', 'success'); }
      });
    });
    adminListEl.querySelectorAll('.deleteBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const idx = Number(btn.dataset.idx);
        const ok = await showConfirm('Delete this item?');
        if (!ok) return;
        if(apiEnabled() && id){ try{ await apiDelete(id); await refreshFromServer(); populateClaimRequestsList(); populateClaimedList(); showToast('Deleted', 'success'); }catch(e){ showToast('Delete failed: '+e.message,'error'); } }
        else { items.splice(idx, 1); save(); populateAdminList(); populateClaimRequestsList(); populateClaimedList(); showToast('Deleted', 'success'); }
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
const settingsLoginModal = document.getElementById('settingsLoginModal');
const settingsLoginForm = document.getElementById('settingsLoginForm');
const settingsContent = document.getElementById('settingsContent');

if(settingsLoginModal && settingsLoginForm && settingsContent){
  // Show modal if not logged in
  if (!isAdminLoggedIn()) {
    settingsLoginModal.style.display = 'flex';
  } else {
    settingsContent.style.display = 'block';
    showAdminLinks();
  }
  
  settingsLoginForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const settingsLoginPass = document.getElementById('settingsLoginPass');
    if(!settingsLoginPass) return;
    
    if(apiEnabled()){
      apiAdminLogin(settingsLoginPass.value).then(()=>{ 
        setAdminLoggedIn();
        settingsLoginModal.style.display = 'none';
        settingsContent.style.display = 'block';
      }).catch(()=> showToast('Wrong password', 'error'));
      return;
    }
    
    if(settingsLoginPass.value !== getAdminPassword()) return showToast('Wrong password', 'error');
    setAdminLoggedIn();
    settingsLoginModal.style.display = 'none';
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
    
    // Location management handlers
    function populateLocationsList() {
      const locationsList = document.getElementById('locationsList');
      if (!locationsList) return;
      
      const locations = getLocations();
      locationsList.innerHTML = '';
      
      locations.forEach(loc => {
        const li = document.createElement('li');
        li.style.padding = '8px';
        li.style.borderBottom = '1px solid #ddd';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        
        const span = document.createElement('span');
        span.textContent = loc;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'danger';
        deleteBtn.style.padding = '4px 12px';
        deleteBtn.style.fontSize = '0.9rem';
        deleteBtn.addEventListener('click', async () => {
          const ok = await showConfirm(`Delete location "${loc}"?`);
          if (!ok) return;
          
          if (removeLocation(loc)) {
            showToast('Location deleted', 'success');
            populateLocationsList();
          } else {
            showToast('Failed to delete location', 'error');
          }
        });
        
        li.appendChild(span);
        li.appendChild(deleteBtn);
        locationsList.appendChild(li);
      });
    }
    
    const addLocationBtn = document.getElementById('addLocationBtn');
    const newLocationInput = document.getElementById('newLocationInput');
    if (addLocationBtn && newLocationInput) {
      populateLocationsList();
      
      addLocationBtn.addEventListener('click', () => {
        const locationName = newLocationInput.value;
        if (addLocation(locationName)) {
          showToast('Location added', 'success');
          newLocationInput.value = '';
          populateLocationsList();
        }
      });
      
      newLocationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addLocationBtn.click();
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

// Stats page login modal
const statsLoginModal = document.getElementById('statsLoginModal');
const statsLoginForm = document.getElementById('statsLoginForm');
const statsMain = document.querySelector('#statsSummary');

if(statsLoginModal && statsLoginForm) {
  // Show modal if not logged in
  if (!isAdminLoggedIn()) {
    statsLoginModal.style.display = 'flex';
    if(statsMain) statsMain.parentElement.style.display = 'none';
  } else {
    showAdminLinks();
    if(document.getElementById('statsTotals')) renderStats();
  }
  
  statsLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const statsLoginPass = document.getElementById('statsLoginPass');
    if (!statsLoginPass) return;
    
    if (apiEnabled()){
      apiAdminLogin(statsLoginPass.value).then(()=>{
        setAdminLoggedIn();
        statsLoginModal.style.display = 'none';
        if(statsMain) statsMain.parentElement.style.display = 'block';
        if(document.getElementById('statsTotals')) renderStats();
      }).catch(()=> showToast('Wrong password', 'error'));
      return;
    }
    
    if (statsLoginPass.value !== getAdminPassword()) { 
      showToast('Wrong password', 'error'); 
      return; 
    }
    
    setAdminLoggedIn();
    statsLoginModal.style.display = 'none';
    if(statsMain) statsMain.parentElement.style.display = 'block';
    showAdminLinks();
    if(document.getElementById('statsTotals')) renderStats();
  });
} else if(document.getElementById('statsTotals') && isAdminLoggedIn()) {
  renderStats();
}
