(()=>{
const $=id=>document.getElementById(id);
async function userApi(path,options={}){const res=await birdlogFetch(path,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Request failed');return data;}
async function initUser(){
  try{
    const d=await userApi('/api/user/me');
    const u=d.user;
    window.BIRDLOG_CURRENT_USER_ID=u.id;
    if($('currentUserName'))$('currentUserName').textContent=u.username||'Account';
    if($('accountFullName'))$('accountFullName').textContent=u.full_name||u.username||'Account';
    if($('accountEmail'))$('accountEmail').textContent=u.email||'';
    if($('accountUsername'))$('accountUsername').textContent=u.username?('@'+u.username):'';
    if($('accountPageAvatar'))$('accountPageAvatar').textContent=(u.username||u.full_name||'B').slice(0,1).toUpperCase();
    window.BIRDLOG_CURRENT_USER_DATA=u;
    window.BIRDLOG_CURRENT_USER_ID=u.id;
    // Tell app.js that the authenticated user is known before rendering
    // account-specific community content.
    window.dispatchEvent(new CustomEvent('birdlog-user-ready',{detail:{user:u}}));
  }catch(_e){
    window.location.href=window.birdlogFrontendUrl('/login');
  }
}
$('accountBtn')?.addEventListener('click',()=>document.querySelector('.nav-btn[data-tab="account"]')?.click());
window.addEventListener('birdlog-account-tab',()=>{
  const u = window.BIRDLOG_CURRENT_USER_DATA;
  if(u && $('accountPageAvatar')) $('accountPageAvatar').textContent=(u.username||u.full_name||'B').slice(0,1).toUpperCase();
});
$('logoutAccountBtn')?.addEventListener('click',async()=>{try{await userApi('/api/user/logout',{method:'POST'});}catch(_e){}window.location.href=window.birdlogFrontendUrl('/login');});
$('switchAccountBtn')?.addEventListener('click',async()=>{try{await userApi('/api/user/switch',{method:'POST'});}catch(_e){}window.location.href=window.birdlogFrontendUrl('/login');});
initUser();
})();
