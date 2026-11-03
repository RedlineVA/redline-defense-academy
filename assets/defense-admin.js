'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(c)||0)/100);
const dateTime=v=>v?new Date(v).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'—';
const state={access:'',classes:[],enrollments:[],payments:[],admin:''};
const rdaEasternParts=new Intl.DateTimeFormat('en-US',{
 timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
function rdaEasternInput(iso){
 const date=new Date(iso);if(!Number.isFinite(date.getTime()))return '';
 const pieces=rdaEasternParts.formatToParts(date);
 const part=kind=>pieces.find(p=>p.type===kind)?.value||'';
 return part('year')+'-'+part('month')+'-'+part('day')+'T'+part('hour')+':'+part('minute');
}
function rdaEasternISO(input){
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(input||''));
 if(!match)throw Error('Choose a class date and time.');
 const [,yy,mm,dd,hh,mi]=match;
 const naive=Date.UTC(Number(yy),Number(mm)-1,Number(dd),Number(hh),Number(mi));
 if(!Number.isFinite(naive))throw Error('Invalid class date.');
 const options=[-240,-300].map(offset=>new Date(naive-offset*60000))
   .filter(date=>rdaEasternInput(date.toISOString())===input)
   .sort((a,b)=>a-b);
 if(!options.length)throw Error('That local time does not exist in Eastern Time due to daylight saving. Choose another time.');
 return options[0].toISOString();
}
function rdaClassStartValue(id){
 const input=$('classStart')?.value;
 let startsAt;
 try{startsAt=rdaEasternISO(input)}catch(err){message(err.message,true);return null}
 const previous=id?cls(id)?.starts_at:'';
 const changed=!previous||rdaEasternInput(previous)!==input;
 if(changed&&previous){
  const affected=state.enrollments.filter(e=>e.class_id===id&&activeStatuses.includes(e.status));
  if(affected.length&&!window.confirm('This class already has '+affected.length+' confirmed registration(s). Changing its date will update the public schedule, but will NOT automatically email students who received an earlier confirmation. Save the new date and contact those students?'))return null;
 }
 return {startsAt,changed};
}

const statusLabels={requested:'Requested',contacted:'Contacted',deposit_pending:'Deposit Pending',confirmed:'Confirmed',cancelled:'Cancelled',attended:'Attended'};
const activeStatuses=['confirmed','attended'];
let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
function message(s,bad=false){const el=$('notice');el.textContent=s;el.className='notice'+(bad?' error':'');setTimeout(()=>el.classList.add('hidden'),5500)}
async function api(method='GET',body){const r=await fetch('/api/admin-enrollment',{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body||{})});const d=await r.json().catch(()=>({error:'Unexpected server response'}));if(!r.ok){const e=Error(d.error||'Request failed');e.status=r.status;throw e}return d}
async function authApi(action,extra={}){const r=await fetch('/api/admin-auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});const d=await r.json().catch(()=>({error:'Unexpected login response'}));if(!r.ok){const e=Error(d.error||'Login failed');e.status=r.status;throw e}return d}
function hideModal(){$('modalRoot').innerHTML=''}
function modal(title,body){$('modalRoot').innerHTML='<div class="modal" role="dialog" aria-modal="true"><div class="modal-card"><div class="modal-head"><h2>'+esc(title)+'</h2><button class="close" id="closeModal" type="button">×</button></div>'+body+'</div></div>';$('closeModal').onclick=hideModal}
function loggedOut(){state.access='';$('app').classList.add('hidden');$('login').classList.remove('hidden');$('loginPassword').value=''}
function showPage(p){if(!['dashboard','calendar','requests','classes','students','deposits','settings'].includes(p))return;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+p));document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===p));$('pageTitle').textContent=p==='requests'?'Seat Requests':p==='classes'?'Classes & Rosters':p==='deposits'?'Deposits & Balances':p[0].toUpperCase()+p.slice(1);$('sidebar').classList.remove('open');history.replaceState(null,'','#'+p)}
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

function easternDateKey(value){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
 const pick=name=>parts.find(p=>p.type===name)?.value||'';
 return pick('year')+'-'+pick('month')+'-'+pick('day');
}
function renderCalendar(){
 const year=calendarMonth.getFullYear(),month=calendarMonth.getMonth();
 $('monthLabel').textContent=calendarMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'});
 const first=new Date(year,month,1),last=new Date(year,month+1,0),offset=first.getDay();
 const byDay=new Map();
 for(const c of state.classes){const day=easternDateKey(c.starts_at);if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(c)}
 const total=Math.ceil((offset+last.getDate())/7)*7;
 let html='';
 for(let cell=0;cell<total;cell++){
  const day=cell-offset+1,inside=day>0&&day<=last.getDate();
  const key=inside?year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'):'';
  const events=byDay.get(key)||[];
  html+='<div class="rda-date '+(inside?'':'other-month')+'"><div class="rda-day">'+(inside?day:'')+'</div>'+
   events.map(c=>'<button class="rda-calendar-event" data-class="'+esc(c.id)+'" type="button"><b>'+esc(c.title)+'</b><small>'+seats(c.id)+(c.capacity?'/'+c.capacity:'')+' booked · '+(c.active?'Active':'Archived')+'</small></button>').join('')+'</div>';
 }
 $('monthGrid').innerHTML=html;
}
function render(){renderDashboard();renderCalendar();renderRequests();renderClasses();renderStudents();renderDeposits()}
async function reload(){try{$('sync').textContent='Refreshing…';const data=await api();state.classes=data.classes||[];state.enrollments=data.enrollments||[];state.payments=data.payments||[];state.admin=data.admin||'Admin';state.notificationsConfigured=!!data.notificationsConfigured;$('who').textContent=state.admin;render();$('sync').textContent='Updated '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}catch(e){$('sync').textContent='Update failed';if(e.status===401)loggedOut();message(e.message,true);throw e}}
async function run(body){try{await api('POST',body);hideModal();await reload();message('Saved.')}catch(e){message(e.message,true)}}
function showRequest(id){const e=state.enrollments.find(x=>x.id===id);if(!e)return;const c=cls(e.class_id);const options=Object.entries(statusLabels).map(x=>'<option value="'+x[0]+'" '+(e.status===x[0]?'selected':'')+'>'+esc(x[1])+'</option>').join('');
 const html='<div class="form-grid"><div class="wide"><b>'+esc(e.full_name)+'</b><div class="muted">'+esc(e.email)+' · '+esc(e.phone)+'</div><p>'+esc(c?.title||'Unknown class')+' · '+dateTime(c?.starts_at)+'</p><p>Student note: '+esc(e.notes||'None')+'</p></div><div class="wide schedule-alert">Paid: '+money(payments(id))+' · Remaining: '+money(balance(e))+'</div><label class="wide">Status<select id="studentStatus">'+options+'</select></label><div class="wide toolbar"><button class="btn good" id="statusSave">Save Status</button><button class="btn secondary" id="fromRequestPayment">Record Payment</button></div></div>';
 modal('Student Request',html);$('statusSave').onclick=()=>run({action:'status',id,status:$('studentStatus').value});$('fromRequestPayment').onclick=()=>showPayment(id);
}
function showClass(id){
 const c=id?cls(id):null,edit=!!c;
 let form='<form id="classForm" class="form-grid"><label class="wide">Class Name<input id="classTitle" required minlength="4" value="'+esc(c?.title||'')+'"></label>';
 form+='<label>Date & Time (Eastern)<input type="datetime-local" id="classStart" required value="'+esc(edit?rdaEasternInput(c.starts_at):'')+'"></label>';
 form+='<label>Location<input id="classLocation" value="'+esc(c?.location||'')+'"></label><label>Capacity<input id="classCapacity" type="number" min="1" max="1000" placeholder="No limit" value="'+esc(c?.capacity??'')+'"></label><label>Price ($)<input id="classPrice" type="number" min="0" step="0.01" required value="'+(Number(c?.price_cents||0)/100).toFixed(2)+'"></label><label>Deposit ($)<input id="classDeposit" type="number" min="0" step="0.01" required value="'+(Number(c?.deposit_cents||0)/100).toFixed(2)+'"></label><label class="wide check-line"><input id="classVisible" type="checkbox" '+(!c||c.visible?'checked':'')+'>Publish class on website schedule</label>';
 if(edit&&c.reschedule_notice_required)form+='<p class="wide schedule-alert">This class was rescheduled. Previously confirmed students may still have the old date in their confirmation email. Contact them with the updated class details.</p>';
 if(edit)form+='<label class="wide check-line"><input id="classActive" type="checkbox" '+(c.active?'checked':'')+'>Class active</label>';
 form+='<div class="wide toolbar"><button class="btn good">Save Class</button></div></form>';
 if(edit)form+='<h3 class="roster-title">Roster · '+seats(c.id)+' confirmed</h3><div class="roster-list">'+(state.enrollments.filter(e=>e.class_id===c.id).map(e=>'<div class="list-item"><div><b>'+esc(e.full_name)+'</b><div class="muted">'+esc(statusLabels[e.status])+'</div></div><button class="btn small" data-request="'+e.id+'">Open</button></div>').join('')||'<div class="muted">No requests yet.</div>')+'</div>';
 modal(edit?'Edit Class & Roster':'Create Class',form);
 $('classForm').onsubmit=ev=>{ev.preventDefault();const b={action:edit?'edit_class':'create_class',title:$('classTitle').value,location:$('classLocation').value,capacity:$('classCapacity').value,price_cents:Math.round(Number($('classPrice').value)*100),deposit_cents:Math.round(Number($('classDeposit').value)*100),visible:$('classVisible').checked};const selected=rdaClassStartValue(id);if(!selected)return;if(edit){b.id=id;b.active=$('classActive').checked;if(selected.changed)b.starts_at=selected.startsAt}else b.starts_at=selected.startsAt;run(b)};
}
function showPayment(id){
 if(!state.enrollments.length){message('No student requests to record a payment for.',true);return}
 const options=state.enrollments.map(e=>'<option value="'+e.id+'" '+(id===e.id?'selected':'')+'>'+esc(e.full_name)+' · '+esc(cls(e.class_id)?.title||'Class')+'</option>').join('');
 const html='<form id="paymentForm" class="form-grid"><p class="wide muted">Record an outside payment you have already received. This does not charge the student.</p><label class="wide">Student<select id="paymentStudent">'+options+'</select></label><label>Type<select id="paymentKind"><option value="deposit">Deposit</option><option value="balance">Balance Payment</option><option value="refund">Refund</option></select></label><label>Method<select id="paymentMethod"><option value="cash">Cash</option><option value="zelle">Zelle</option><option value="card_external">Card (external)</option><option value="bank">Bank Transfer</option><option value="other">Other</option></select></label><label>Amount ($)<input id="paymentAmount" type="number" min="0.01" step="0.01" required></label><label>Reference<input id="paymentReference" maxlength="120"></label><label class="wide">Internal Note<textarea id="paymentNote" maxlength="500"></textarea></label><div class="wide toolbar"><button class="btn good">Record Payment</button></div></form>';
 modal('Record Payment',html);$('paymentForm').onsubmit=ev=>{ev.preventDefault();let amount=Math.round(Number($('paymentAmount').value)*100);if($('paymentKind').value==='refund')amount=-amount;if(!Number.isSafeInteger(amount)||!amount)return message('Invalid payment amount.',true);run({action:'payment',id:$('paymentStudent').value,kind:$('paymentKind').value,method:$('paymentMethod').value,amount_cents:amount,reference:$('paymentReference').value,note:$('paymentNote').value})};
}

$('loginForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;$('loginError').classList.add('hidden');try{await authApi('login',{email:$('loginEmail').value,password:$('loginPassword').value});await reload();$('login').classList.add('hidden');$('app').classList.remove('hidden');showPage(location.hash.slice(1)||'dashboard')}catch(err){$('loginError').textContent=err.message;$('loginError').classList.remove('hidden')}finally{button.disabled=false}};
$('logoutButton').onclick=async()=>{try{await authApi('logout')}catch{}loggedOut()};
$('refreshButton').onclick=()=>reload().catch(()=>{});
$('menuButton').onclick=()=>$('sidebar').classList.toggle('open');
document.querySelectorAll('[data-page]').forEach(x=>x.onclick=()=>showPage(x.dataset.page));
document.querySelectorAll('[data-page-jump]').forEach(x=>x.onclick=()=>showPage(x.dataset.pageJump));
$('requestSearch').oninput=renderRequests;$('requestStatus').onchange=renderRequests;$('studentSearch').oninput=renderStudents;
$('addClass').onclick=()=>showClass();$('calendarNewClass').onclick=()=>showClass();$('addPayment').onclick=()=>showPayment();
$('prevMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar()};$('nextMonth').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);renderCalendar()};
document.addEventListener('click',event=>{const el=event.target.closest('[data-request],[data-class]');if(!el)return;if(el.dataset.request)showRequest(el.dataset.request);else if(el.dataset.class)showClass(el.dataset.class)});
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideModal()});
