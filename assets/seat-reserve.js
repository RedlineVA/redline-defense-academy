'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const fmt=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(c)||0)/100);
 const form=$('reserveForm'),status=$('reserveStatus'),select=$('reserveClass'),button=$('reserveSubmit');
 if(!form||!status||!select)return;
 let classes=[];
 function disable(reason){status.textContent=reason;status.className='reserve-status unavailable';form.classList.add('hidden');$('reserveFallback').classList.remove('hidden')}
 async function load(){
  try{
   const response=await fetch('/api/classes',{cache:'no-store'});
   const data=await response.json();
   if(!response.ok||!Array.isArray(data.classes))return disable('Online seat requests are being set up. Please call or text 540-205-6500 for now.');
   classes=data.classes;if(!classes.length)return disable('No upcoming online classes are listed yet. Call or text us for the next available class.');
   // Never use innerHTML for remote class titles.
   select.replaceChildren(new Option('Select a class',''));
   for(const item of classes){
    const label=item.title+' · '+new Date(item.starts_at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
    select.add(new Option(label,item.id));
   }
   form.classList.remove('hidden');$('reserveFallback').classList.add('hidden');
   status.textContent='Choose a class below. Your seat is not confirmed until staff contacts you.';
   status.className='reserve-status';
  }catch{disable('Online booking is not available right now. Call or text 540-205-6500.')}
 }
 select.onchange=()=>{const x=classes.find(c=>c.id===select.value);$('reserveClassDetail').textContent=x?'Class price '+fmt(x.price_cents)+' · Deposit '+fmt(x.deposit_cents)+' · '+(x.location||'Location provided after enrollment'):''};
 form.onsubmit=async event=>{
  event.preventDefault();button.disabled=true;button.textContent='Sending…';
  const body={class_id:select.value,name:$('reserveName').value.trim(),email:$('reserveEmail').value.trim(),phone:$('reservePhone').value.trim(),notes:$('reserveNotes').value.trim(),website:$('reserveWebsite').value};
  try{
   const response=await fetch('/api/seat-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed.');
   form.reset();$('reserveClassDetail').textContent='';status.textContent='Request received! The academy will contact you after reviewing it. Your seat is not yet confirmed.';status.className='reserve-status success';
  }catch(e){status.textContent=e.message+' Please call or text 540-205-6500 if you need help.';status.className='reserve-status unavailable'}
  finally{button.disabled=false;button.textContent='Request My Seat'}
 };
 load();
})();
