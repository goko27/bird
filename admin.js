const A = '/api/admin';
const $ = id => document.getElementById(id);
let observations = [];

function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `admin-toast ${type}`;
  el.textContent = msg;
  $('adminToast').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function api(path, opts={}) {
  const res = await birdlogFetch(`${A}${path}`, {
    credentials:'include', ...opts,
    headers:{'Content-Type':'application/json', ...(opts.headers||{})}
  });
  let data={}; try { data=await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function checkSession(){
  try {
    const me=await api('/me');
    $('adminLogin').style.display='none'; $('adminApp').style.display='block';
    $('adminUser').textContent=me.username; await refreshAll();
  } catch { $('adminLogin').style.display='block'; $('adminApp').style.display='none'; }
}
$('loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); $('loginError').textContent='';
  try{
    const d=await api('/login',{method:'POST',body:JSON.stringify({username:$('loginUsername').value,password:$('loginPassword').value})});
    $('adminUser').textContent=d.username; $('adminLogin').style.display='none'; $('adminApp').style.display='block'; await refreshAll();
  }catch(err){$('loginError').textContent=err.message;}
});
$('logoutBtn').onclick=async()=>{await api('/logout',{method:'POST'});location.reload()};

async function refreshAll(){
  await Promise.all([loadStats(),loadObservations(),loadSpecies(),loadDb(),loadUsers(),loadReports(),loadPosts()]);
}
async function loadStats(){const d=await api('/stats');$('statSightings').textContent=d.total_sightings||0;$('statSpecies').textContent=d.unique_species_count||0;$('statLocations').textContent=d.unique_locations_count||0;}
async function loadObservations(){const d=await api('/observations');observations=d.observations||[];renderObservations();}
function renderObservations(){
  if(!observations.length){$('obsTable').innerHTML='<tr><td colspan="6">No observations found.</td></tr>';return;}
  $('obsTable').innerHTML=observations.map(o=>`<tr><td><strong>${esc(o.bird_name)}</strong></td><td>${esc(o.species)}</td><td>${esc(o.obs_date)}</td><td>${esc(o.location||'—')}</td><td>${esc(o.weather||'—')}</td><td><div class="action-row"><button class="admin-btn mini secondary" onclick="editObservation('${esc(o.id)}')">Edit</button><button class="admin-btn mini danger" onclick="deleteObservation('${esc(o.id)}')">Delete</button></div></td></tr>`).join('');
}
window.editObservation=id=>{const o=observations.find(x=>x.id===id);if(!o)return;$('editId').value=o.id;$('editBird').value=o.bird_name||'';$('editSpecies').value=o.species||'';$('editDate').value=o.obs_date||'';$('editWeather').value=o.weather||'';$('editState').value=o.state||'';$('editDistrict').value=o.district||'';$('editLocation').value=o.location||'';$('editNotes').value=o.notes||'';$('editModal').style.display='grid';};
window.deleteObservation=async id=>{if(!confirm('Delete this observation permanently?'))return;try{await api(`/observations/${encodeURIComponent(id)}`,{method:'DELETE'});toast('Observation deleted');await refreshAll();}catch(e){toast(e.message,'error')}};
$('editForm').onsubmit=async e=>{e.preventDefault();const id=$('editId').value;const body={bird_name:$('editBird').value.trim(),species:$('editSpecies').value.trim(),obs_date:$('editDate').value,state:$('editState').value.trim(),district:$('editDistrict').value.trim(),location:$('editLocation').value.trim(),weather:$('editWeather').value.trim(),notes:$('editNotes').value.trim()};try{await api(`/observations/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(body)});$('editModal').style.display='none';toast('Observation updated');await refreshAll();}catch(e){toast(e.message,'error')}};
$('closeEdit').onclick=()=>$('editModal').style.display='none';
$('refreshObsBtn').onclick=()=>loadObservations().catch(e=>toast(e.message,'error'));

async function loadSpecies(){const d=await api('/species');const list=d.species||[];$('speciesAdminList').innerHTML=list.length?list.map(s=>`<div class="species-row"><div><strong>${esc(s.name)}</strong><small>${esc(s.category||'General')}</small></div><button class="admin-btn mini danger" onclick="deleteSpecies('${esc(s.id)}')">Delete</button></div>`).join(''):'<div class="db-panel">No species.</div>';}
$('speciesForm').onsubmit=async e=>{e.preventDefault();try{await api('/species',{method:'POST',body:JSON.stringify({name:$('speciesName').value.trim(),category:$('speciesCategory').value.trim()||'General'})});$('speciesName').value='';toast('Species added');await loadSpecies();await loadStats();}catch(e){toast(e.message,'error')}};
window.deleteSpecies=async id=>{if(!confirm('Delete this species from the catalog?'))return;try{await api(`/species/${encodeURIComponent(id)}`,{method:'DELETE'});toast('Species deleted');await loadSpecies();await loadStats();}catch(e){toast(e.message,'error')}};

async function loadDb(){const d=await api('/db/status');$('statDb').textContent=(d.active_engine||'—').toUpperCase();$('dbStatus').innerHTML=`<div><b>Active:</b> ${esc(d.active_engine)}</div><div>SQLite: <span class="db-ok">${esc(d.sql_status)}</span></div><div>Supabase: <span class="${d.supabase_is_live?'db-ok':'db-bad'}">${esc(d.supabase_status)}</span></div>`;}
async function dbAction(path,body=null,msg='Done'){try{await api(path,{method:'POST',body:body?JSON.stringify(body):undefined});toast(msg);await loadDb();await loadStats();}catch(e){toast(e.message,'error')}}
$('useSqlBtn').onclick=()=>dbAction('/db/switch',{engine:'sql'},'Switched to SQLite');$('useSupabaseBtn').onclick=()=>dbAction('/db/switch',{engine:'supabase'},'Switched to Supabase');$('syncBtn').onclick=()=>dbAction('/db/sync',null,'Databases synchronized');$('initBtn').onclick=()=>dbAction('/db/supabase-init',null,'Supabase initialized');

async function loadUsers(){
  const d=await api('/users'); const users=d.users||[];
  $('usersTable').innerHTML=users.length?users.map(u=>`<tr><td><strong>${esc(u.full_name)}</strong><small>@${esc(u.username)}</small></td><td>${esc(u.email)}</td><td>${u.post_count||0}</td><td><span class="status-pill ${u.is_active?'active':'blocked'}">${u.is_active?'Active':'Blocked'}</span></td><td><div class="action-row"><button class="admin-btn mini secondary" onclick="toggleUser('${esc(u.id)}',${u.is_active?0:1})">${u.is_active?'Block':'Enable'}</button><button class="admin-btn mini danger" onclick="deleteUser('${esc(u.id)}')">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="5">No normal users found.</td></tr>';
}
window.toggleUser=async(id,active)=>{if(!confirm(active?'Enable this account?':'Block this account?'))return;try{await api(`/users/${encodeURIComponent(id)}/status`,{method:'POST',body:JSON.stringify({active:!!active})});toast(active?'User enabled':'User blocked');await loadUsers();}catch(e){toast(e.message,'error')}};
window.deleteUser=async id=>{if(!confirm('Delete this user and their community data permanently? This cannot be undone.'))return;try{await api(`/users/${encodeURIComponent(id)}`,{method:'DELETE'});toast('User deleted');await loadUsers();await loadReports();await loadPosts();}catch(e){toast(e.message,'error')}};

async function loadReports(){
  const d=await api('/reports');const rows=d.reports||[];
  $('reportsTable').innerHTML=rows.length?rows.map(r=>`<tr><td><strong>${esc(r.bird_name||'Unknown post')}</strong><small>@${esc(r.owner_username||'unknown')}</small></td><td>@${esc(r.reporter_username||'unknown')}</td><td>${esc(r.reason)}</td><td>${esc(r.created_at)}</td><td><div class="action-row">${r.post_id?`<button class="admin-btn mini danger" onclick="deletePost('${esc(r.post_id)}')">Delete Post</button>`:''}<button class="admin-btn mini secondary" onclick="dismissReport('${esc(r.id)}')">Dismiss</button></div></td></tr>`).join(''):'<tr><td colspan="5">No reports.</td></tr>';
}
window.dismissReport=async id=>{try{await api(`/reports/${encodeURIComponent(id)}`,{method:'DELETE'});toast('Report dismissed');await loadReports();}catch(e){toast(e.message,'error')}};

async function loadPosts(){
  const d=await api('/posts');const posts=d.posts||[];
  $('postsTable').innerHTML=posts.length?posts.map(p=>`<tr><td><strong>${esc(p.bird_name||'Bird post')}</strong><small>@${esc(p.username||'unknown')} · ${esc(p.location||'')}</small></td><td>${esc(p.species||'—')}</td><td>${p.report_count||0}</td><td><span class="status-pill ${p.hidden?'blocked':'active'}">${p.hidden?'Hidden':'Visible'}</span></td><td><div class="action-row"><button class="admin-btn mini secondary" onclick="togglePost('${esc(p.id)}',${p.hidden?0:1})">${p.hidden?'Restore':'Hide'}</button><button class="admin-btn mini danger" onclick="deletePost('${esc(p.id)}')">Delete</button></div></td></tr>`).join(''):'<tr><td colspan="5">No community posts found.</td></tr>';
}
window.togglePost=async(id,hidden)=>{if(!confirm(hidden?'Hide this post from the community?':'Restore this post to the community?'))return;try{await api(`/posts/${encodeURIComponent(id)}/visibility`,{method:'POST',body:JSON.stringify({hidden:!!hidden})});toast(hidden?'Post hidden':'Post restored');await loadPosts();await loadReports();}catch(e){toast(e.message,'error')}};
window.deletePost=async id=>{if(!confirm('Delete this community post permanently? Likes, comments and reports for this post will also be removed.'))return;try{await api(`/posts/${encodeURIComponent(id)}`,{method:'DELETE'});toast('Post deleted');await loadPosts();await loadReports();}catch(e){toast(e.message,'error')}};

$('refreshUsersBtn').onclick=()=>loadUsers().catch(e=>toast(e.message,'error'));
$('refreshReportsBtn').onclick=()=>loadReports().catch(e=>toast(e.message,'error'));
$('refreshPostsBtn').onclick=()=>loadPosts().catch(e=>toast(e.message,'error'));
checkSession();
