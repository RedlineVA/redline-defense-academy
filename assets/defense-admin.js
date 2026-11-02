'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(c)||0)/100);
const dateTime=v=>v?new Date(v).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'—';
const state={access:'',classes:[],enrollments:[],payments:[],admin:''};
const statusLabels={requested:'Requested',contacted:'Contacted',deposit_pending:'Deposit Pending',confirmed:'Confirmed',cancelled:'Cancelled',attended:'Attended'};
const activeStatuses=['confirmed','attended'];
function message(s,bad=false){const el=$('notice');el.textContent=s;el.className='notice'+(bad?' error':'');setTimeout(()=>el.classList.add('hidden'),5500)}
async function api(method='GET',body,authorized=true){const headers={'Content-Type':'application/json'};if(authorized&&state.access)headers.Authorization='Bearer '+state.access;const r=await fetch('/api/admin-enrollment',{method,headers,body:method==='GET'?undefined:JSON.stringify(body||{})});const d=await r.json().catch(()=>({error:'Invalid response'}));if(!r.ok){const e=Error(d.error||'Request failed');e.status=r.status;throw e}return d}
function hideModal(){$('modalRoot').innerHTML=''}
function modal(title,body){$('modalRoot').innerHTML='<div class="modal" role="dialog" aria-modal="true"><div class="modal-card"><div class="modal-head"><h2>'+esc(title)+'</h2><button class="close" id="closeModal" type="button">×</button></div>'+body+'</div></div>';$('closeModal').onclick=hideModal}
function loggedOut(){state.access='';$('app').classList.add('hidden');$('login').classList.remove('hidden');$('loginPassword').value=''}
function showPage(p){if(!['dashboard','requests','classes','students','deposits'].includes(p))return;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+p));document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===p));$('pageTitle').textContent=p==='requests'?'Seat Requests':p==='classes'?'Classes & Rosters':p==='deposits'?'Deposits & Balances':p[0].toUpperCase()+p.slice(1);$('sidebar').classList.remove('open');history.replaceState(null,'','#'+p)}
function cls(id){return state.classes.find(c=>c.id===id)}
function seats(id){return state.enrollments.filter(e=>e.class_id===id&&activeStatuses.includes(e.status)).length}
function payments(eid){return state.payments.filter(p=>p.enrollment_id===eid).reduce((a,p)=>a+Number(p.amount_cents||0),0)}
function balance(e){return Math.max(0,Number(cls(e.class_id)?.price_cents||0)-payments(e.id))}
function paymentSummary(e){return money(payments(e.id))+' paid · '+money(balance(e))+' due'}
function pill(v){return '<span class="pill '+(activeStatuses.includes(v)?'green':v==='cancelled'?'red':'amber')+'">'+esc(statusLabels[v]||v)+'</span>'}
function empty(cols){return '<tr><td colspan="'+cols+'" class="empty-table muted">No records found.</td></tr>'}
function renderDashboard(){
 const pending=state.enrollments.filter(e=>e.status==='requested'),confirmed=state.enrollments.filter(e=>activeStatuses.includes(e.status)),total=state.payments.reduce((s,p)=>s+Number(p.amount_cents||0),0),due=state.enrollments.filter(e=>e.status!=='cancelled').reduce((s,e)=>s+balance(e),0);
 $('dashStats').innerHTML=[['Pending Requests',pending.length,'red'],['Confirmed Seats',confirmed.length,'blue'],['Payments Recorded',money(total),'green'],['Outstanding Balances',money(due),'amber']].map(x=>'<div class="stat '+x[2]+'"><small>'+x[0]+'</small><b>'+x[1]+'</b></div>').join('');
 $('navPending').textContent=pending.length;
 $('attentionList').innerHTML=pending.slice(0,6).map(e=>'<div class="list-item"><div><b>'+esc(e.full_name)+'</b><div class="muted">'+esc(cls(e.class_id)?.title||'Class')+' · '+dateTime(e.created_at)+'</div></div><button class="btn small" data-request="'+e.id+'">Review</button></div>').join('')||'<div class="empty">No pending requests.</div>';
 $('upcomingList').innerHTML=state.classes.filter(c=>c.active&&new Date(c.starts_at)>=new Date()).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at)).slice(0,6).map(c=>'<div class="list-item"><div><b>'+esc(c.title)+'</b><div class="muted">'+dateTime(c.starts_at)+'</div></div><span class="pill">'+seats(c.id)+(c.capacity?'/'+c.capacity:'')+' seats</span></div>').join('')||'<div class="empty">No upcoming classes published.</div>';
 $('notificationStatus').textContent=state.notificationsConfigured?'Email alerts are connected.':'Owner email alerts are not configured yet; check this dashboard for new requests.';
}
function renderRequests(){const q=$('requestSearch').value.toLowerCase(),s=$('requestStatus').value;const rows=state.enrollments.filter(e=>(!s||e.status===s)&&(!q||[e.full_name,e.email,e.phone,cls(e.class_id)?.title].join(' ').toLowerCase().includes(q)));$('requestRows').innerHTML=rows.map(e=>'<tr><td>'+dateTime(e.created_at)+'</td><td><b>'+esc(e.full_name)+'</b><div class="muted">'+esc(e.email)+'</div><div class="muted">'+esc(e.phone)+'</div></td><td>'+esc(cls(e.class_id)?.title||'—')+'</td><td>'+pill(e.status)+'</td><td>'+esc(paymentSummary(e))+'</td><td><button class="btn small" data-request="'+e.id+'">Open</button></td></tr>').join('')||empty(6)}
function renderClasses(){$('classRows').innerHTML=state.classes.map(c=>'<tr><td><b>'+esc(c.title)+'</b><div class="muted">'+(c.active?'Active':'Archived')+'</div></td><td>'+dateTime(c.starts_at)+'<div class="muted">'+esc(c.location||'TBA')+'</div></td><td>'+money(c.price_cents)+'<div class="muted">Deposit '+money(c.deposit_cents)+'</div></td><td>'+seats(c.id)+' / '+(c.capacity??'No limit')+'</td><td>'+(c.visible?'Published':'Hidden')+'</td><td><button class="btn small" data-class="'+c.id+'">Edit / Roster</button></td></tr>').join('')||empty(6)}
function renderStudents(){const q=$('studentSearch').value.toLowerCase();$('studentRows').innerHTML=state.enrollments.filter(e=>!q||[e.full_name,e.email,e.phone,cls(e.class_id)?.title].join(' ').toLowerCase().includes(q)).map(e=>'<tr><td><b>'+esc(e.full_name)+'</b></td><td>'+esc(e.phone)+'<div class="muted">'+esc(e.email)+'</div></td><td>'+esc(cls(e.class_id)?.title||'—')+'</td><td>'+pill(e.status)+'</td><td>'+esc(paymentSummary(e))+'</td><td><button class="btn small" data-request="'+e.id+'">Details</button></td></tr>').join('')||empty(6)}
function renderDeposits(){const total=state.payments.reduce((s,p)=>s+Number(p.amount_cents||0),0),deposit=state.payments.filter(p=>p.kind==='deposit').reduce((s,p)=>s+Number(p.amount_cents||0),0),due=state.enrollments.filter(e=>e.status!=='cancelled').reduce((s,e)=>s+balance(e),0);$('financeStats').innerHTML=[['Total Recorded',money(total),'green'],['Deposits Recorded',money(deposit),'blue'],['Outstanding Balances',money(due),'amber']].map(x=>'<div class="stat '+x[2]+'"><small>'+x[0]+'</small><b>'+x[1]+'</b></div>').join('');$('paymentRows').innerHTML=state.payments.map(p=>{const e=state.enrollments.find(x=>x.id===p.enrollment_id);return '<tr><td>'+dateTime(p.created_at)+'</td><td>'+esc(e?.full_name||'Unknown')+'</td><td>'+esc(p.kind)+'</td><td>'+esc(p.method)+'</td><td class="'+(p.amount_cents<0?'expense':'income')+'">'+money(p.amount_cents)+'</td><td>'+esc(p.reference||'—')+'</td></tr>'}).join('')||empty(6)}
function render(){renderDashboard();renderRequests();renderClasses();renderStudents();renderDeposits()}
async function reload(){try{$('sync').textContent='Refreshing…';const data=await api();state.classes=data.classes||[];state.enrollments=data.enrollments||[];state.payments=data.payments||[];state.admin=data.admin||'Admin';state.notificationsConfigured=!!data.notificationsConfigured;$('who').textContent=state.admin;render();$('sync').textContent='Updated '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}catch(e){$('sync').textContent='Update failed';if(e.status===401)loggedOut();message(e.message,true);throw e}}
async function run(body){try{await api('POST',body);hideModal();await reload();message('Saved.')}catch(e){message(e.message,true)}}
function showRequest(id){const e=state.enrollments.find(x=>x.id===id);if(!e)return;const c=cls(e.class_id);const options=Object.entries(statusLabels).map(x=>'<option value="'+x[0]+'" '+(e.status===x[0]?'selected':'')+'>'+esc(x[1])+'</option>').join('');
 const html='<div class="form-grid"><div class="wide"><b>'+esc(e.full_name)+'</b><div class="muted">'+esc(e.email)+' · '+esc(e.phone)+'</div><p>'+esc(c?.title||'Unknown class')+' · '+dateTime(c?.starts_at)+'</p><p>Student note: '+esc(e.notes||'None')+'</p></div><div class="wide schedule-alert">Paid: '+money(payments(id))+' · Remaining: '+money(balance(e))+'</div><label class="wide">Status<select id="studentStatus">'+options+'</select></label><div class="wide toolbar"><button class="btn good" id="statusSave">Save Status</button><button class="btn secondary" id="fromRequestPayment">Record Payment</button></div></div>';
 modal('Student Request',html);$('statusSave').onclick=()=>run({action:'status',id,status:$('studentStatus').value});$('fromRequestPayment').onclick=()=>showPayment(id);
}
function showClass(id){
 const c=id?cls(id):null,edit=!!c;
 let form='<form id="classForm" class="form-grid"><label class="wide">Class Name<input id="classTitle" required minlength="4" value="'+esc(c?.title||'')+'"></label>';
 if(!edit)form+='<label>Date & Time (Eastern)<input type="datetime-local" id="classStart" required></label>';
 form+='<label>Location<input id="classLocation" value="'+esc(c?.location||'')+'"></label><label>Capacity<input id="classCapacity" type="number" min="1" max="1000" placeholder="No limit" value="'+esc(c?.capacity??'')+'"></label><label>Price ($)<input id="classPrice" type="number" min="0" step="0.01" required value="'+(Number(c?.price_cents||0)/100).toFixed(2)+'"></label><label>Deposit ($)<input id="classDeposit" type="number" min="0" step="0.01" required value="'+(Number(c?.deposit_cents||0)/100).toFixed(2)+'"></label><label class="wide check-line"><input id="classVisible" type="checkbox" '+(c?.visible?'checked':'')+'>Show class on public request page</label>';
 if(edit)form+='<label class="wide check-line"><input id="classActive" type="checkbox" '+(c.active?'checked':'')+'>Class active</label>';
 form+='<div class="wide toolbar"><button class="btn good">Save Class</button></div></form>';
 if(edit)form+='<h3 class="roster-title">Roster · '+seats(c.id)+' confirmed</h3><div class="roster-list">'+(state.enrollments.filter(e=>e.class_id===c.id).map(e=>'<div class="list-item"><div><b>'+esc(e.full_name)+'</b><div class="muted">'+esc(statusLabels[e.status])+'</div></div><button class="btn small" data-request="'+e.id+'">Open</button></div>').join('')||'<div class="muted">No requests yet.</div>')+'</div>';
 modal(edit?'Edit Class & Roster':'Create Class',form);
 $('classForm').onsubmit=ev=>{ev.preventDefault();const b={action:edit?'edit_class':'create_class',title:$('classTitle').value,location:$('classLocation').value,capacity:$('classCapacity').value,price_cents:Math.round(Number($('classPrice').value)*100),deposit_cents:Math.round(Number($('classDeposit').value)*100),visible:$('classVisible').checked};if(edit){b.id=id;b.active=$('classActive').checked}else b.starts_at=$('classStart').value;run(b)};
}
function showPayment(id){
 if(!state.enrollments.length){message('No student requests to record a payment for.',true);return}
 const options=state.enrollments.map(e=>'<option value="'+e.id+'" '+(id===e.id?'selected':'')+'>'+esc(e.full_name)+' · '+esc(cls(e.class_id)?.title||'Class')+'</option>').join('');
 const html='<form id="paymentForm" class="form-grid"><p class="wide muted">Record an outside payment you have already received. This does not charge the student.</p><label class="wide">Student<select id="paymentStudent">'+options+'</select></label><label>Type<select id="paymentKind"><option value="deposit">Deposit</option><option value="balance">Balance Payment</option><option value="refund">Refund</option></select></label><label>Method<select id="paymentMethod"><option value="cash">Cash</option><option value="zelle">Zelle</option><option value="card_external">Card (external)</option><option value="bank">Bank Transfer</option><option value="other">Other</option></select></label><label>Amount ($)<input id="paymentAmount" type="number" min="0.01" step="0.01" required></label><label>Reference<input id="paymentReference" maxlength="120"></label><label class="wide">Internal Note<textarea id="paymentNote" maxlength="500"></textarea></label><div class="wide toolbar"><button class="btn good">Record Payment</button></div></form>';
 modal('Record Payment',html);$('paymentForm').onsubmit=ev=>{ev.preventDefault();let amount=Math.round(Number($('paymentAmount').value)*100);if($('paymentKind').value==='refund')amount=-amount;if(!Number.isSafeInteger(amount)||!amount)return message('Invalid payment amount.',true);run({action:'payment',id:$('paymentStudent').value,kind:$('paymentKind').value,method:$('paymentMethod').value,amount_cents:amount,reference:$('paymentReference').value,note:$('paymentNote').value})};
}

$('resendConfirmation').onclick=async ()=>{
 const button=$('resendConfirmation');
 button.disabled=true;
 $('loginError').classList.add('hidden');
 try{
  const response=await api('POST',{action:'resend_confirmation',email:'redlinedefenseacademy@gmail.com'},false);
  $('loginError').textContent=response.message;
  $('loginError').classList.remove('hidden');
 }catch(error){
  $('loginError').textContent=error.message;
  $('loginError').classList.remove('hidden');
 }finally{button.disabled=false}
};
$('setupAccount').onclick=()=>{
 modal('Activate Your Redline Defense Admin Login',`<form id="activationForm" class="form-grid">
  <p class="wide muted">This creates your private administrator account. Use a NEW password, not one shared in chat. You'll be asked to verify the email address.</p>
  <label class="wide">Admin Email<input id="activationEmail" type="email" readonly value="redlinedefenseacademy@gmail.com"></label>
  <label class="wide">New Password<input id="activationPassword" type="password" autocomplete="new-password" minlength="12" required></label>
  <label class="wide">Confirm Password<input id="activationConfirm" type="password" autocomplete="new-password" minlength="12" required></label>
  <div class="wide toolbar"><button class="btn good">Send Verification Email</button></div>
 </form>`);
 $('activationForm').onsubmit=async ev=>{
  ev.preventDefault();
  const pw=$('activationPassword').value;
  if(pw!==$('activationConfirm').value)return message('Passwords do not match.',true);
  try{
   const result=await api('POST',{action:'register',email:$('activationEmail').value,password:pw},false);
   hideModal();
   $('loginError').textContent=result.message||'Check your email for a verification link.';
   $('loginError').classList.remove('hidden');
  }catch(error){message(error.message,true)}
 };
};
$('loginForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('loginError').classList.add('hidden');try{const d=await api('POST',{action:'login',email:$('loginEmail').value,password:$('loginPassword').value},false);state.access=d.access_token;await reload();$('login').classList.add('hidden');$('app').classList.remove('hidden');showPage(location.hash.slice(1)||'dashboard')}catch(err){$('loginError').textContent=err.message;$('loginError').classList.remove('hidden')}finally{button.disabled=false}};
$('logoutButton').onclick=loggedOut;
$('refreshButton').onclick=()=>reload().catch(()=>{});
$('menuButton').onclick=()=>$('sidebar').classList.toggle('open');
document.querySelectorAll('[data-page]').forEach(x=>x.onclick=()=>showPage(x.dataset.page));
document.querySelectorAll('[data-page-jump]').forEach(x=>x.onclick=()=>showPage(x.dataset.pageJump));
$('requestSearch').oninput=renderRequests;$('requestStatus').onchange=renderRequests;$('studentSearch').oninput=renderStudents;
$('addClass').onclick=()=>showClass();$('addPayment').onclick=()=>showPayment();
document.addEventListener('click',event=>{const el=event.target.closest('[data-request],[data-class]');if(!el)return;if(el.dataset.request)showRequest(el.dataset.request);else if(el.dataset.class)showClass(el.dataset.class)});
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideModal()});
