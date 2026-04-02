// Supabase Configuration
const SUPABASE_URL = 'https://lonakqiibwcgvuszynii.supabase.co';
const SUPABASE_KEY = 'sb_publishable_e2Zek5Nkv65M7Q5nRVlSSA_bOiLU-o9';
const supabase = (window.supabase || supabase)?.createClient ? (window.supabase || supabase).createClient(SUPABASE_URL, SUPABASE_KEY) : null;

if (!supabase) console.error("Supabase fail to initialize. Check CDN link in index.html");
else console.log("Supabase initialized successfully.");

const fmt = (n)=> n ? n.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : '0.00';
const fmtInt = (n)=> n ? n.toLocaleString('en-IN') : '0';
const generateId = ()=> 'id_' + Math.random().toString(36).substr(2, 9);

const TEMPLATES = {
  Standard: { headers: ['Particulars', 'Qty', 'Unit', 'Rate', 'Amount'], fields: ['area', 'unit', 'rate'] },
  Carpentry: { headers: ['Particulars', 'W', 'H', 'D', 'Area', 'Unit', 'Rate', 'Amount'], fields: ['w', 'h', 'd', 'area', 'unit', 'rate'] },
  Civil: { headers: ['Particulars', 'L', 'B', 'D', 'Qty', 'Unit', 'Rate', 'Amount'], fields: ['w', 'h', 'd', 'area', 'unit', 'rate'] }
};

let DB = { projects: [], activeId: null };

function activeProj(){ 
  const p = DB.projects.find(x=>x.id===DB.activeId);
  if(!p && DB.projects.length > 0) { DB.activeId = DB.projects[0].id; return DB.projects[0]; }
  return p;
}

async function load(){
  try {
    // 1. Try local storage first (for legacy/offline)
    const localData = localStorage.getItem('boq_v2_data');
    if(localData) {
      DB = JSON.parse(localData);
    }

    // 2. If Supabase is available and user is logged in, sync from cloud
    if(supabase){
      const { data: { session } } = await supabase.auth.getSession();
      if(session && session.user){
        const { data, error } = await supabase.from('projects').select('*').eq('user_id', session.user.id);
        if(!error && data.length > 0){
          // Merge or replace local projects with cloud projects
          // For simplicity, we replace for now
          DB.projects = data.map(p => ({
            id: p.id,
            name: p.name,
            client: p.client,
            location: p.location,
            startDate: p.start_date,
            reference: p.reference,
            status: p.status,
            bills: p.data.bills,
            itemsNotIncluded: p.data.itemsNotIncluded
          }));
        }
      }
    }

    if(!DB.projects || DB.projects.length === 0) seed();
    if(!DB.studio) DB.studio = { name: 'ArchLedge', tagline: 'Architectural Studio', address: 'Bangalore, India', email: 'studio@archledge.com' };
    
    render();
  } catch(e) { console.error("Load error:", e); seed(); }
}

async function save(){ 
  // Always save to localStorage for offline resilience
  localStorage.setItem('boq_v2_data', JSON.stringify(DB)); 
  
  // Sync to Supabase if logged in
  if(supabase){
    const { data: { session } } = await supabase.auth.getSession();
    if(session && session.user){
      const p = activeProj();
      if(p){
        const { error } = await supabase.from('projects').upsert({
          id: p.id,
          user_id: session.user.id,
          name: p.name,
          client: p.client,
          location: p.location,
          start_date: p.startDate,
          reference: p.reference,
          status: p.status,
          data: { bills: p.bills, itemsNotIncluded: p.itemsNotIncluded },
          updated_at: new Date()
        });
        if(error) console.error("Supabase Save Error:", error);
      }
    }
  }
  render(); 
}

function seed(){
  const p = {
    id: generateId(), name: 'Studio Interior Project', client: 'ArchLedge Designs', location: 'Bangalore',
    startDate: new Date(), reference: 'QPRO-2026-001', status: 'Active', itemsNotIncluded: ['Structural repairs', 'External plumbing'],
    bills: [
      { id: generateId(), name: 'CARPENTRY WORKS', type: 'Carpentry', sections: [
        { title: 'WORKSTATION AREA', items: [
          { particulars: '1350mm x 600 mm x600mm(depth) vanity with PU finish', w: 1.35, h: 0.6, d: 0.15, area: 0.81, unit: 'sqm', rate: 40000, amount: 32400 },
          { particulars: '1350mm x 1560mm - 6mm thk mirror with ply backing', w: 1.35, h: 1.56, d: 0, area: 2.106, unit: 'sqm', rate: 15000, amount: 31590 }
        ]}
      ]},
      { id: generateId(), name: 'ELECTRICAL FIXTURES', type: 'Standard', sections: [
        { title: 'LIGHTING', items: [
          { particulars: 'LED Warm White Strip Light 5m Roll', area: 10, unit: 'rolls', rate: 1200, amount: 12000 },
          { particulars: 'Recessed Downlighter 12W', area: 24, unit: 'nos', rate: 850, amount: 20400 }
        ]}
      ]}
    ]
  };
  DB.projects = [p];
  DB.activeId = p.id;
  DB.studio = { name: 'ArchLedge', tagline: 'Architectural Studio', address: 'Bangalore, India', email: 'studio@archledge.com' };
  save();
}

function render(){
  const h = location.hash || '#dashboard';
  const view = h.replace('#','') || 'dashboard';
  console.log("Navigating to:", view);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const activeEl = document.getElementById(view);
  if(activeEl) activeEl.classList.add('active'); else document.getElementById('dashboard').classList.add('active');
  document.querySelectorAll('#sidebar nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === h));

  if(view === 'dashboard') ui_dash();
  else if(view === 'projects') ui_proj();
  else if(view === 'editor') ui_edit();
  else if(view === 'print') ui_print();
  else if(view === 'settings') ui_settings();
}

function ui_dash(){
  let totalVal = 0;
  let catCnt = 0;
  DB.projects.forEach(p => {
    catCnt += p.bills.length;
    p.bills.forEach(b => b.sections.forEach(s => s.items.forEach(i => totalVal += i.amount)));
  });
  const grid = document.getElementById('kpi-grid');
  if(!grid) return;
  grid.innerHTML = `
    <div class="kpi-card"><strong>Active Value</strong><div class="value">₹${fmtInt(totalVal)}</div></div>
    <div class="kpi-card"><strong>Projects</strong><div class="value">${DB.projects.length}</div></div>
    <div class="kpi-card"><strong>Total Categories</strong><div class="value">${catCnt}</div></div>
    <div class="kpi-card"><strong>Studio Status</strong><div class="value">Live</div></div>
  `;
}

function ui_proj(){
  const tbody = document.querySelector('#projects-table tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  DB.projects.forEach((p, idx)=>{
    const pVal = calcProjectTotal(p);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${idx+1}</td><td><strong>${p.name}</strong></td><td>${p.client}</td><td>${p.location}</td><td style="font-family:var(--font-mono)">₹${fmtInt(pVal)}</td><td>
      <button class="btn btn-outline btn-sm" onclick="goEdit('${p.id}')">Open Editor</button>
      <button class="btn btn-outline btn-sm" onclick="goPrint('${p.id}')">View / Print</button>
      <button class="btn btn-outline btn-sm" onclick="askDeleteProj('${p.id}')" style="color:var(--danger)">x</button>
    </td>`;
    tbody.appendChild(tr);
  });
}
function goEdit(id){ DB.activeId = id; location.hash = '#editor'; save(); }
function askDeleteProj(id){ 
  openConfirm("Delete Project", "This will permanently remove the project and all its bills.", () => {
    DB.projects = DB.projects.filter(p=>p.id!==id);
    if(DB.activeId === id) DB.activeId = (DB.projects.length > 0 ? DB.projects[0].id : null);
    save(); toast('Project deleted');
  });
}
function goPrint(id){ DB.activeId = id; location.hash = '#print'; save(); }

function calcProjectTotal(p){
  let t = 0; p.bills.forEach(b => b.sections.forEach(s => s.items.forEach(i => t += i.amount)));
  return t;
}

function ui_edit(){
  const p = activeProj();
  const c = document.getElementById('editor-content');
  const t = document.getElementById('editor-title');
  const a = document.getElementById('editor-actions');
  if(!p){ 
    c.innerHTML = '<p style="padding:40px; text-align:center;">Select a project to begin.</p>';
    if(t) t.innerText = 'BOQ Editor';
    if(a) a.innerHTML = '';
    return;
  }
  if(t) t.innerText = p.name;
  if(a) a.innerHTML = `
    <button class="btn btn-outline" onclick="goPrint('${p.id}')">View Summary / Print</button>
    <button class="btn btn-primary" onclick="openBillModal()">+ Add New Category / Bill</button>
  `;
  
  let html = '';
  p.bills.forEach((bill, b_idx) => {
    const tmpl = bill.type === 'Custom' ? { headers: bill.customHeaders } : (TEMPLATES[bill.type] || TEMPLATES.Standard);
    html += `<div style="margin-bottom:60px; background:var(--card); border:1px solid var(--border); border-radius:8px; padding:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="font-family:var(--font-headings); font-size:24px;">${bill.name} <span style="font-size:12px; color:var(--muted); font-weight:400;">(${bill.type} Type)</span></h2>
        <div style="display:flex; gap:10px;">
          <button class="btn btn-outline btn-sm" onclick="addSection('${b_idx}')">+ Add Section</button>
          <button class="btn btn-outline btn-sm" onclick="delBill('${b_idx}')" style="color:var(--danger)">Remove Category</button>
        </div>
      </div>
      <table class="boq-table" style="width:100%">
        <thead>
          <tr style="background:#f9f8f4;">
            <th>No</th>
            ${tmpl.headers.map(h => `<th ${h==='Particulars'?'style="width:40%"':''}>${h}</th>`).join('')}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>`;

    bill.sections.forEach((sec, s_idx) => {
      html += `<tr><td colspan="${tmpl.headers.length + 1}" class="section-header" onclick="editSec('${b_idx}','${s_idx}')">${sec.title}</td><td style="border:1px solid var(--border)"><button class="btn-danger-text btn-sm" style="border:none; cursor:pointer;" onclick="delSec('${b_idx}','${s_idx}')">x</button></td></tr>`;
      sec.items.forEach((item, i_idx) => {
        html += `<tr>
          <td>${i_idx+1}</td>
          <td style="text-align:left; padding:8px">${item.particulars}</td>`;
        if(bill.type === 'Carpentry' || bill.type === 'Civil'){
          html += `<td>${item.w}</td><td>${item.h}</td><td>${item.d}</td>`;
        }
        html += `<td>${fmt(item.area)}</td>
          <td>${item.unit}</td>
          <td>${fmtInt(item.rate)}</td>
          <td style="font-weight:700">₹${fmtInt(item.amount)}</td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="openItemModal('${b_idx}','${s_idx}','${i_idx}')">Edit</button>
            <button class="btn-danger-text btn-sm" style="border:none; cursor:pointer;" onclick="delItem('${b_idx}','${s_idx}','${i_idx}')">x</button>
          </td>
        </tr>`;
      });
      html += `<tr><td colspan="${tmpl.headers.length + 2}" style="padding:10px; background:rgba(196, 150, 58, 0.03);"><button class="btn btn-outline btn-sm" onclick="openItemModal('${b_idx}','${s_idx}')">+ Add Item to ${sec.title}</button></td></tr>`;
    });
    html += `</tbody></table></div>`;
  });
  c.innerHTML = html;
}

function openBillModal(){ document.getElementById('bill-modal-backdrop').style.display = 'flex'; }
function closeBillModal(){ document.getElementById('bill-modal-backdrop').style.display = 'none'; }
function createNewBill(){
  const n = document.getElementById('new-bill-name').value;
  const t = document.getElementById('new-bill-type').value;
  if(!n) return toast('Category Name required', 'error');
  const p = activeProj();
  if(!p) return;
  let ch = null;
  if(t === 'Custom'){
    const hstr = document.getElementById('custom-headers-input').value;
    if(!hstr) return toast('Please specify custom headers', 'error');
    ch = hstr.split(',').map(s=>s.trim());
  }
  p.bills.push({ id:generateId(), name:n, type:t, sections:[], customHeaders: ch });
  closeBillModal(); save(); toast('Category added');
}
function delBill(b){ 
  openConfirm("Remove Category", "Are you sure you want to remove this whole category?", () => {
    activeProj().bills.splice(b,1); save(); toast('Category removed');
  });
}
function addSection(b){ 
  openPrompt("Add New Section", "Section Name", "New Section", (val) => {
    const p = activeProj();
    if(p && p.bills[b]) { p.bills[b].sections.push({title:val, items:[]}); save(); toast('Section added'); }
  });
}
function delSec(b, s){ 
  openConfirm("Delete Section", "This will remove all items in this section.", () => {
    activeProj().bills[b].sections.splice(s,1); save(); toast('Section deleted');
  });
}
function delItem(b, s, i){ activeProj().bills[b].sections[s].items.splice(i,1); save(); toast('Item removed'); }

function openPrompt(title, label, def, cb){
  document.getElementById('prompt-title').innerText = title;
  document.getElementById('prompt-label').innerText = label;
  document.getElementById('prompt-input').value = def;
  document.getElementById('prompt-modal-backdrop').style.display = 'flex';
  document.getElementById('prompt-confirm-btn').onclick = () => { cb(document.getElementById('prompt-input').value); closePrompt(); };
}
function closePrompt(){ document.getElementById('prompt-modal-backdrop').style.display = 'none'; }
function openConfirm(title, msg, cb){
  document.getElementById('confirm-title').innerText = title;
  document.getElementById('confirm-msg').innerText = msg;
  document.getElementById('confirm-modal-backdrop').style.display = 'flex';
  document.getElementById('confirm-yes-btn').onclick = () => { cb(); closeConfirm(); };
}
function closeConfirm(){ document.getElementById('confirm-modal-backdrop').style.display = 'none'; }
function editSec(b, s){ 
  const p = activeProj();
  openPrompt("Rename Section", "New Title", p.bills[b].sections[s].title, (val) => {
    p.bills[b].sections[s].title = val; save(); toast('Section renamed');
  });
}

function openItemModal(b, s, i = null){
  const bill = activeProj().bills[b];
  document.getElementById('modal-item-indices').value = `${b}|${s}|${i!==null ? i : ''}`;
  const dimBox = document.getElementById('fields-dimensional');
  if(bill.type === 'Carpentry'){
    dimBox.style.display = 'flex';
    document.getElementById('label-dim1').innerText = 'W (m)';
    document.getElementById('label-dim2').innerText = 'H (m)';
    document.getElementById('label-dim3').innerText = 'D (m)';
    document.getElementById('label-qty').innerText = 'Area (sqm)';
  } else if(bill.type === 'Civil'){
    dimBox.style.display = 'flex';
    document.getElementById('label-dim1').innerText = 'L (m)';
    document.getElementById('label-dim2').innerText = 'B (m)';
    document.getElementById('label-dim3').innerText = 'D (m)';
    document.getElementById('label-qty').innerText = 'Quantity';
  } else {
    dimBox.style.display = 'none';
    document.getElementById('label-qty').innerText = 'Quantity';
  }
  if(i !== null){
    const item = bill.sections[s].items[i];
    document.getElementById('item-particulars').value = item.particulars;
    document.getElementById('item-w').value = item.w || 0;
    document.getElementById('item-h').value = item.h || 0;
    document.getElementById('item-d').value = item.d || 0;
    document.getElementById('item-area').value = item.area;
    document.getElementById('item-unit').value = item.unit;
    document.getElementById('item-rate').value = item.rate;
    document.getElementById('item-amount').value = item.amount;
  } else {
    document.getElementById('item-particulars').value = '';
    document.getElementById('item-w').value = 0; document.getElementById('item-h').value = 0; document.getElementById('item-d').value = 0;
    document.getElementById('item-area').value = 0; document.getElementById('item-unit').value = 'sqm';
    document.getElementById('item-rate').value = 0; document.getElementById('item-amount').value = 0;
  }
  document.getElementById('item-modal-backdrop').style.display = 'flex';
}
function closeItemModal(){ document.getElementById('item-modal-backdrop').style.display = 'none'; }
function itemCalc(){
  try {
    const w = parseFloat(document.getElementById('item-w').value) || 0;
    const h = parseFloat(document.getElementById('item-h').value) || 0;
    const d = parseFloat(document.getElementById('item-d').value) || 0;
    const rate = parseFloat(document.getElementById('item-rate').value) || 0;
    const indicesStr = document.getElementById('modal-item-indices').value;
    if(!indicesStr) return;
    const [b] = indicesStr.split('|').map(Number);
    const p = activeProj();
    const type = p.bills[b].type;
    let area = parseFloat(document.getElementById('item-area').value) || 0;
    if((type === 'Carpentry' || type === 'Civil') && w > 0 && h > 0){
      area = w * h;
      if(type === 'Civil' && d > 0) area = w * h * d;
      document.getElementById('item-area').value = area.toFixed(3);
    }
    document.getElementById('item-amount').value = (area * rate).toFixed(2);
  } catch(e) { console.error("Calc error:", e); }
}
function saveItem(){
  const [b, s, i_str] = document.getElementById('modal-item-indices').value.split('|');
  const b_idx = parseInt(b), s_idx = parseInt(s);
  const itm = {
    particulars: document.getElementById('item-particulars').value,
    w: parseFloat(document.getElementById('item-w').value) || 0,
    h: parseFloat(document.getElementById('item-h').value) || 0,
    d: parseFloat(document.getElementById('item-d').value) || 0,
    area: parseFloat(document.getElementById('item-area').value) || 0,
    unit: document.getElementById('item-unit').value,
    rate: parseFloat(document.getElementById('item-rate').value) || 0,
    amount: parseFloat(document.getElementById('item-amount').value) || 0
  };
  const p = activeProj();
  const sections = p.bills[b_idx].sections;
  if(i_str !== '') sections[s_idx].items[parseInt(i_str)] = itm;
  else sections[s_idx].items.push(itm);
  closeItemModal(); save(); toast('Entry saved');
}

function ui_print(){
  const p = activeProj();
  const st = DB.studio || { name: 'ARCHLEDGE', tagline: 'Architectural Studio', address: 'Bangalore, India', email: 'studio@archledge.com' };
  const c = document.getElementById('print-content'); if(!p){ c.innerHTML = '<p>No project selected.</p>'; return; }
  let html = `<div style="padding:40px; color:#000;">
    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-family:var(--font-headings); font-size:28px; font-weight:700; color:#1a1710; letter-spacing:1px;">${st.name.toUpperCase()}</div>
      <div style="font-size:10px; color:#6B6862; letter-spacing:3px; margin-top:5px; text-transform:uppercase;">${st.tagline} | ${st.address} | ${st.email}</div>
    </div>
    <div style="border-bottom:4px double #1A1710; padding-bottom:5px; margin-bottom:40px;"></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:40px; font-size:13px;">
      <div><strong>PROJECT:</strong> ${p.name.toUpperCase()}<br/><strong>CLIENT:</strong> ${p.client.toUpperCase()}</div>
      <div style="text-align:right;"><strong>DATE:</strong> ${new Date().toLocaleDateString()}<br/><strong>LOCATION:</strong> ${p.location.toUpperCase()}</div>
    </div>`;
  p.bills.forEach(bill => {
    const tmpl = bill.type === 'Custom' ? { headers: bill.customHeaders } : (TEMPLATES[bill.type] || TEMPLATES.Standard);
    let bTotal = 0;
    html += `<h2 style="border-bottom:2px solid #000; color:#000; font-size:14px; padding:8px 0; margin-bottom:15px; font-family:var(--font-ui); text-transform:uppercase;">${bill.name} (${bill.type})</h2>
      <table style="width:100%; border:1px solid #000; border-collapse:collapse; margin-bottom:30px; font-size:11px;">
        <thead><tr style="background:#f0f0f0;"><th style="border:1px solid #000;">SL</th>${tmpl.headers.map(h => `<th style="border:1px solid #000; padding:8px;">${h}</th>`).join('')}</tr></thead><tbody>`;
    bill.sections.forEach(sec => {
      html += `<tr><td colspan="${tmpl.headers.length + 1}" style="background:#eee; text-align:left; font-weight:700; border:1px solid #000; padding:5px 10px;">${sec.title}</td></tr>`;
      sec.items.forEach((item, idx) => {
        bTotal += item.amount;
        html += `<tr><td style="border:1px solid #000; text-align:center;">${idx+1}</td><td style="border:1px solid #000; text-align:left; padding:5px;">${item.particulars}</td>`;
        if(bill.type === 'Carpentry' || bill.type === 'Civil') html += `<td style="border:1px solid #000; text-align:center;">${item.w}</td><td style="border:1px solid #000; text-align:center;">${item.h}</td><td style="border:1px solid #000; text-align:center;">${item.d}</td>`;
        html += `<td style="border:1px solid #000; text-align:center;">${fmt(item.area)}</td><td style="border:1px solid #000; text-align:center;">${item.unit}</td><td style="border:1px solid #000; text-align:center;">${fmtInt(item.rate)}</td><td style="border:1px solid #000; text-align:center; font-weight:700;">${fmtInt(item.amount)}</td></tr>`;
      });
    });
    html += `<tr style="background:#eee;"><td colspan="${tmpl.headers.length}" style="text-align:right; border:1px solid #000; padding:8px; font-weight:700;">Sub-Total</td><td style="border:1px solid #000; text-align:center; font-weight:700;">₹${fmtInt(bTotal)}</td></tr></tbody></table>`;
  });
  c.innerHTML = html + `</div>`;
}

function toast(m, t='success'){ const c=document.createElement('div'); c.className=`toast ${t}`; c.innerText=m; document.getElementById('toast-container').appendChild(c); setTimeout(()=>c.remove(), 3000); }

function addProject(e){ 
  e.preventDefault(); 
  try {
    const p = { 
      id: generateId(), 
      name: document.getElementById('pname').value, 
      client: document.getElementById('pclient').value, 
      location: document.getElementById('ploc').value, 
      startDate: new Date(),
      reference: document.getElementById('pref').value || 'REF-'+Date.now(), 
      status: 'Active', bills: [], itemsNotIncluded: [] 
    }; 
    DB.projects.push(p); save(); location.hash = '#projects'; toast('Project Registered');
  } catch(err) { console.error(err); alert("Fail to register project."); }
}

function ui_settings(){
  document.getElementById('studio-name').value = DB.studio.name;
  document.getElementById('studio-tagline').value = DB.studio.tagline;
  document.getElementById('studio-address').value = DB.studio.address;
  document.getElementById('studio-email').value = DB.studio.email;
}
function saveStudio(){
  DB.studio = {
    name: document.getElementById('studio-name').value,
    tagline: document.getElementById('studio-tagline').value,
    address: document.getElementById('studio-address').value,
    email: document.getElementById('studio-email').value
  };
  save(); toast('Studio branding updated');
}

function initIcons(){
  if(window.lucide) lucide.createIcons();
}

function triggerPrint() {
  const currentHash = window.location.hash;
  if (window.location.protocol === 'file:') {
    history.replaceState(null, null, window.location.pathname + window.location.search);
  }
  window.print();
  if (window.location.protocol === 'file:') {
    history.replaceState(null, null, currentHash);
  }
}

window.onhashchange = ()=>{ render(); initIcons(); };
window.onload = ()=>{ 
  load(); 
  initIcons();
  if(supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      updateAuthUI(session);
      if(event === 'SIGNED_IN') load();
    });
  }
};
document.getElementById('new-project-btn').onclick = ()=>{ location.hash = '#new-project'; };

// AUTH LOGIC
let authMode = 'login';
function openAuthModal(){ document.getElementById('auth-modal-backdrop').style.display = 'flex'; }
function closeAuthModal(){ document.getElementById('auth-modal-backdrop').style.display = 'none'; }
function toggleAuthMode(){
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('auth-title').innerText = authMode === 'login' ? 'Welcome Back' : 'Create Account';
  document.getElementById('auth-submit-btn').innerText = authMode === 'login' ? 'Sign In' : 'Join ArchLedge';
  document.getElementById('auth-toggle-btn').innerText = authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In";
}

async function handleAuth(e){
  e.preventDefault();
  if(!supabase) return toast('Supabase not configured', 'error');
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-pass').value;
  
  let result;
  if(authMode === 'login'){
    result = await supabase.auth.signInWithPassword({ email, password });
  } else {
    result = await supabase.auth.signUp({ email, password });
  }

  if(result.error) toast(result.error.message, 'error');
  else {
    toast(authMode === 'login' ? 'Signed in!' : 'Check your email for confirmation!');
    closeAuthModal();
  }
}

async function signOut(e){
  e.preventDefault();
  await supabase.auth.signOut();
  DB.projects = [];
  seed();
  toast('Signed out');
}

function updateAuthUI(session){
  const user = session?.user;
  document.getElementById('auth-nav').style.display = user ? 'none' : 'block';
  document.getElementById('user-profile').style.display = user ? 'flex' : 'none';
  if(user){
    document.getElementById('user-email').innerText = user.email;
    document.getElementById('user-avatar').innerText = user.email[0].toUpperCase();
  }
}
