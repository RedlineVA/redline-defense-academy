'use strict';
(function(){
 const originalApi=api,originalPayments=payments,originalRun=run,
  originalRequest=showRequest,originalRequests=renderRequests,
  originalStudents=renderStudents,originalFinance=renderDeposits,originalDashboard=renderDashboard;
 state.emailConfigured=false;
 api=async function(method='GET',body){
  const result=await originalApi(method,body);
  if(method==='GET')state.emailConfigured=!!result.emailConfigured;
  return result;
 };
 payments=function(id){
  const e=state.enrollments.find(x=>x.id===id);
  return originalPayments(id)+Number(e?.deposit_recorded_cents||0);
 };
 run=async function(body){
  try{
   const response=await api('POST',body);
   hideModal();
   await reload();
   message(response.message||'Saved.',response.emailStatus==='failed');
   return response;
  }catch(e){message(e.message,true);return null}
 };
 const priorDeposit=id=>state.payments.filter(p=>p.enrollment_id===id&&p.kind==='deposit').reduce((sum,p)=>sum+Number(p.amount_cents||0),0);
 const emailLabel=e=>e.confirmation_sent_at?'Email sent '+dateTime(e.confirmation_sent_at):e.deposit_confirmed_at?'Email '+(e.confirmation_state==='failed'?'failed':state.emailConfigured?'pending':'not configured'):'Email after deposit';
 function enhanceRows(selector){
  for(const tr of document.querySelectorAll(selector+' tr')){
   const open=tr.querySelector('[data-request]');if(!open)continue;
   const enrollment=state.enrollments.find(e=>e.id===open.dataset.request);if(!enrollment)continue;
   const td=open.closest('td');if(!td)continue;
   const btn=document.createElement('button');
   btn.type='button';btn.className='btn small good';
   btn.textContent=enrollment.deposit_confirmed_at?'Deposit Confirmed':'Confirm Deposit';
   btn.disabled=!!enrollment.deposit_confirmed_at;
   btn.setAttribute('data-confirm-deposit',enrollment.id);
   td.insertBefore(btn,open);
   const p=tr.querySelector('td:nth-child(5)');
   if(p){const label=document.createElement('div');label.className='rda-email-status';label.textContent=emailLabel(enrollment);p.append(label)}
  }
 }
 renderRequests=function(){originalRequests();enhanceRows('#requestRows')};
 renderStudents=function(){originalStudents();enhanceRows('#studentRows')};
 renderDashboard=function(){
  originalDashboard();
  const amount=state.payments.reduce((sum,p)=>sum+Number(p.amount_cents||0),0)+state.enrollments.reduce((sum,e)=>sum+Number(e.deposit_recorded_cents||0),0);
  const cards=$('dashStats')?.querySelectorAll('.stat');
  if(cards?.[2])cards[2].querySelector('b').textContent=money(amount);
  const note=$('notificationStatus');
  if(note)note.textContent=state.emailConfigured?'Student confirmations send after deposit approval.':'Student emails need an email sending account before automatic delivery works.';
 };
 renderDeposits=function(){
  originalFinance();
  const deposits=state.enrollments.filter(e=>e.deposit_confirmed_at&&Number(e.deposit_recorded_cents)>0);
  let total=state.payments.reduce((s,p)=>s+Number(p.amount_cents||0),0);
  let totalDeposits=state.payments.filter(p=>p.kind==='deposit').reduce((s,p)=>s+Number(p.amount_cents||0),0);
  for(const e of deposits){
   total+=Number(e.deposit_recorded_cents);totalDeposits+=Number(e.deposit_recorded_cents);
   const tr=document.createElement('tr');
   for(const val of [dateTime(e.deposit_confirmed_at),e.full_name,'deposit',e.deposit_method,money(e.deposit_recorded_cents),e.deposit_reference||'—']){
    const cell=document.createElement('td');cell.textContent=val;tr.append(cell);
   }
   $('paymentRows')?.prepend(tr);
  }
  const cards=$('financeStats')?.querySelectorAll('.stat');
  if(cards?.[0])cards[0].querySelector('b').textContent=money(total);
  if(cards?.[1])cards[1].querySelector('b').textContent=money(totalDeposits);
  if(deposits.length&&$('paymentRows')?.querySelector('.empty-table'))$('paymentRows').querySelector('.empty-table').closest('tr')?.remove();
 };
 showRequest=function(id){
  originalRequest(id);
  const e=state.enrollments.find(x=>x.id===id);if(!e)return;
  if(!e.deposit_confirmed_at){
   document.querySelector('#studentStatus option[value="confirmed"]')?.remove();
   document.querySelector('#studentStatus option[value="attended"]')?.remove();
  }
  const form=$('modalRoot')?.querySelector('.form-grid');if(!form)return;
  const section=document.createElement('div');
  section.className='wide rda-deposit-detail';
  const title=document.createElement('b');
  title.textContent=e.deposit_confirmed_at?'Deposit Confirmed':'Deposit Not Confirmed';
  const email=document.createElement('p');email.className='rda-modal-note';email.textContent=emailLabel(e);
  section.append(title,email);
  if(!e.deposit_confirmed_at){
   const btn=document.createElement('button');btn.type='button';btn.className='btn good';
   btn.textContent='Confirm Deposit & Reserve Seat';
   btn.onclick=()=>showDeposit(id);section.append(btn);
  }else if(!e.confirmation_sent_at){
   const btn=document.createElement('button');btn.type='button';btn.className='btn secondary';
   btn.textContent=state.emailConfigured?'Send Confirmation Email':'Email Not Configured';
   btn.disabled=!state.emailConfigured;btn.onclick=()=>run({action:'send_confirmation',id});
   section.append(btn);
  }
  if(e.deposit_confirmed_at){
   const preview=document.createElement('button');
   preview.type='button';preview.className='btn ghost';
   preview.textContent='Preview Confirmation Email';
   preview.onclick=async()=>{
    try{
     const response=await api('POST',{action:'preview_confirmation',id});
     modal('Confirmation Email Preview','<p class="muted">Recipient: '+esc(response.recipient)+'</p>'+
       '<label>Subject<input readonly id="previewSubject" value="'+esc(response.subject)+'"></label>'+
       '<label>Email Text<textarea readonly id="previewEmail" rows="14" style="width:100%;min-height:240px">'+esc(response.text)+'</textarea></label>'+
       '<p class="muted">'+(response.alreadySent?'This email is already marked as sent.':'This is a preview, not proof of delivery.')+'</p>'+
       '<button class="btn" id="copyEmail">Copy Confirmation</button>');
     $('copyEmail').onclick=async()=>{
      const content=$('previewSubject').value+'\n\n'+$('previewEmail').value;
      try{await navigator.clipboard.writeText(content);message('Confirmation copied.')}catch{message('Select and copy the text manually.',true)}
     };
    }catch(error){message(error.message,true)}
   };
   section.append(preview);
  }
  form.prepend(section);
 };
 function showDeposit(id){
  const e=state.enrollments.find(x=>x.id===id);if(!e)return;
  if(e.deposit_confirmed_at)return message('Deposit is already confirmed.');
  const c=cls(e.class_id),already=priorDeposit(id),needed=Math.max(0,Number(e.deposit_due_cents??c?.deposit_cents??0)-already);
  const other=already>0?'<option value="already_recorded">Previously Recorded</option>':'';
  const content='<form id="rdaDepositForm" class="form-grid">'+
   '<p class="wide rda-modal-note">Only confirm a deposit you have <b>already received</b>. The seat will be reserved immediately.</p>'+
   '<div class="wide schedule-alert"><b>'+esc(e.full_name)+'</b><p>'+esc(c?.title||'Class')+'</p>Required deposit: '+money(e.deposit_due_cents??c?.deposit_cents??0)+' · Previously recorded: '+money(already)+'</div>'+
   '<label>New Deposit Amount ($)<input id="rdaDepositAmount" type="number" step="0.01" min="0" required value="'+(needed/100).toFixed(2)+'"></label>'+
   '<label>Payment Method<select id="rdaDepositMethod">'+
   '<option value="cash">Cash</option><option value="zelle">Zelle</option><option value="card_external">External card payment</option><option value="bank">Bank Transfer</option><option value="other">Other</option>'+other+'</select></label>'+
   '<label class="wide">Reference / Receipt<input id="rdaDepositReference" maxlength="120"></label>'+
   '<p class="wide rda-modal-note">'+(state.emailConfigured?'The student will receive an automatic email after you confirm.':'Email delivery is not configured. Deposit and seat will still be confirmed; no email will be sent yet.')+'</p>'+
   '<div class="wide toolbar"><button class="btn good">Deposit Confirmed — Reserve Seat</button></div></form>';
  modal('Confirm Deposit',content);
  if(already>0&&needed===0)$('rdaDepositMethod').value='already_recorded';
  $('rdaDepositForm').onsubmit=async event=>{
   event.preventDefault();
   const amount=Math.round(Number($('rdaDepositAmount').value)*100),method=$('rdaDepositMethod').value,button=event.submitter;
   if(!Number.isSafeInteger(amount)||amount<0)return message('Enter a valid received deposit.',true);
   if(method==='already_recorded'&&amount!==0)return message('Use $0 for a previously recorded payment.',true);
   button.disabled=true;
   const result=await run({action:'confirm_deposit',id,amount_cents:amount,method,reference:$('rdaDepositReference').value});
   if(!result&&document.contains(button))button.disabled=false;
  };
 }
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-confirm-deposit]');if(!button||button.disabled)return;
  event.stopImmediatePropagation();showDeposit(button.getAttribute('data-confirm-deposit'));
 });
})();
