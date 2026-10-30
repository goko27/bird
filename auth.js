(()=>{
const page=document.body.dataset.authPage;
const $=id=>document.getElementById(id);
const msg=$('authMessage');
function showMessage(text,ok=false){if(!msg)return;msg.textContent=text||'';msg.className='auth-message'+(ok?' success':'');}
function bindEyes(){document.querySelectorAll('.eye-btn').forEach(btn=>btn.addEventListener('click',()=>{const input=$(btn.dataset.target);if(!input)return;input.type=input.type==='password'?'text':'password';btn.classList.toggle('active',input.type==='text');btn.setAttribute('aria-label',input.type==='password'?'Show password':'Hide password')}));}
async function api(path,options={}){const res=await birdlogFetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},credentials:'include',...options});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Something went wrong.');return data;}
bindEyes();
if(page==='login'){
  const signupLink=document.querySelector('.switch-line a[href="/signup"]');
  signupLink?.addEventListener('click',e=>{const email=$('loginEmail')?.value.trim();if(email){e.preventDefault();window.location.href='/signup?email='+encodeURIComponent(email);}});
  $('loginForm')?.addEventListener('submit',async e=>{e.preventDefault();showMessage('');const email=$('loginEmail').value.trim();const password=$('loginPassword').value;if(!email||!password){showMessage('Enter your email and password.');return;}const button=e.submitter;button.disabled=true;button.textContent='Signing In…';try{const result=await api('/api/user/login',{method:'POST',body:JSON.stringify({email,password})});if(result.created){showMessage('Account created successfully. Welcome to BirdLog!',true);await new Promise(r=>setTimeout(r,450));}window.location.href=window.birdlogFrontendUrl('/app');}catch(err){showMessage(err.message);button.disabled=false;button.textContent='Sign In';}});
  $('switchLoginBtn')?.addEventListener('click',async()=>{try{await api('/api/user/switch',{method:'POST'})}catch(_e){};showMessage('Ready for another account. Enter the new user email and password.',true);$('loginEmail').value='';$('loginPassword').value='';$('loginEmail').focus();});
}
if(page==='signup'){
  const presetEmail=new URLSearchParams(window.location.search).get('email');
  if(presetEmail && $('signupEmail')) $('signupEmail').value=presetEmail;
  $('signupForm')?.addEventListener('submit',async e=>{e.preventDefault();showMessage('');const body={full_name:$('signupFullName').value.trim(),username:$('signupUsername').value.trim(),email:$('signupEmail').value.trim(),password:$('signupPassword').value,confirm_password:$('signupConfirm').value};if(!Object.values(body).every(Boolean)){showMessage('Please complete all fields.');return;}if(body.password!==body.confirm_password){showMessage('Passwords do not match.');return;}const button=e.submitter;button.disabled=true;button.textContent='Creating Account…';try{await api('/api/user/signup',{method:'POST',body:JSON.stringify(body)});window.location.href=window.birdlogFrontendUrl('/app');}catch(err){showMessage(err.message);button.disabled=false;button.textContent='Sign Up';}});
}
})();
