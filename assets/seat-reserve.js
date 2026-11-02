'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const formatMoney=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((Number(c)||0)/100);
 const localDate=d=>new Date(d).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'long',day:'numeric',year:'numeric'});
 const localTime=d=>new Date(d).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 const partsDate=d=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'2-digit'}).formatToParts(new Date(d));
 const form=$('reserveForm'),status=$('reserveStatus'),select=$('reserveClass'),submit=$('reserveSubmit');
 const spotlight=$('nextClassCard'),list=$('scheduleList'),msg=$('scheduleMessage');
 if(!form||!status||!select||!spotlight||!list||!msg)return;
 let classes=[];
 const el=(tag,klass,content)=>{
  const node=document.createElement(tag);
  if(klass)node.className=klass;
  if(content!==undefined)node.textContent=String(content);
  return node;
 };
 function detail(c){return 'Course fee '+formatMoney(c.price_cents)+' · Deposit '+formatMoney(c.deposit_cents)+' · '+(c.location||'Location shared after confirmation')}
 function makeButton(c){
  const btn=el('button','btn btn-primary','Reserve Seat');btn.type='button';
  btn.addEventListener('click',()=>{
   select.value=c.id;
   select.dispatchEvent(new Event('change'));
   $('reserve').scrollIntoView({behavior:'smooth',block:'start'});
   select.focus({preventScroll:true});
   if(window.history?.replaceState)window.history.replaceState(null,'','#reserve');
  });
  return btn;
 }
 function card(c,featured){
  const outer=el('article',featured?'next-class-inner':'schedule-entry');
  const dt=new Date(c.starts_at);
  const badge=el('div','date-badge');
  const fragments=partsDate(c.starts_at);
  badge.append(el('span','month',fragments.find(x=>x.type==='month')?.value||''),el('strong','day',fragments.find(x=>x.type==='day')?.value||'')); 
  const body=el('div','schedule-entry-details');
  if(featured)body.append(el('span','next-tag','NEXT CLASS'));
  body.append(el('h3','schedule-class-title',c.title));
  const info=el('p','schedule-class-info',localDate(c.starts_at)+' · '+localTime(c.starts_at));
  const location=el('p','schedule-class-location',c.location||'Location supplied after enrollment');
  const terms=el('p','schedule-class-cost','Class '+formatMoney(c.price_cents)+' · Deposit '+formatMoney(c.deposit_cents));
  body.append(info,location,terms);
  const action=el('div','schedule-class-actions');
  if(c.sold_out){action.append(el('span','schedule-full','CLASS FULL'));}
  else{
   const remaining=Number.isInteger(c.seats_remaining)?c.seats_remaining:null;
   action.append(el('span','schedule-availability',remaining===null?'Accepting seat requests':remaining===1?'1 seat remaining':remaining+' seats remaining'));
   action.append(makeButton(c));
  }
  outer.append(badge,body,action);
  return outer;
 }
 function fallback(s){
  spotlight.replaceChildren();
  spotlight.append(el('p','schedule-empty',s));
  list.replaceChildren();
  msg.replaceChildren();
  const link=el('a','btn btn-ghost','Text for Class Dates');
  link.href='sms:+15402056500?&body=Hi%20Redline%20Defense%20Academy%2C%20when%20is%20your%20next%20class%3F';
  list.append(link);
 }
 function renderSchedule(){
  if(!classes.length){fallback('New class dates are being finalized. Contact us for upcoming training options.');return;}
  spotlight.replaceChildren(card(classes[0],true));
  list.replaceChildren();
  for(const c of classes)list.append(card(c,false));
  msg.textContent='Classes update automatically when the Academy publishes or changes a session in its Command Center.';
 }
 function disable(s){
  status.textContent=s;status.className='reserve-status unavailable';
  form.classList.add('hidden');$('reserveFallback').classList.remove('hidden');
 }
 function renderForm(){
  const available=classes.filter(c=>!c.sold_out);
  if(!available.length)return disable('There are currently no classes accepting online requests. Please call or text 540-205-6500.');
  const previous=select.value;
  select.replaceChildren(new Option('Select a class',''));
  for(const c of available){
   select.add(new Option(c.title+' · '+localDate(c.starts_at)+' · '+localTime(c.starts_at),c.id));
  }
  if(available.some(c=>c.id===previous))select.value=previous;
  form.classList.remove('hidden');$('reserveFallback').classList.add('hidden');
  status.textContent='Select a class and send a request. Your seat is not confirmed until the Academy approves it.';
  status.className='reserve-status';
 }
 async function load(){
  try{
   const response=await fetch('/api/classes',{cache:'no-store'});
   const data=await response.json();
   if(!response.ok||!Array.isArray(data.classes))throw Error('Calendar unavailable');
   classes=data.classes.filter(c=>c&&c.id&&c.title&&Number.isFinite(Date.parse(c.starts_at)))
    .sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
   renderSchedule();
   renderForm();
  }catch(e){
   fallback('Our live schedule is temporarily unavailable. Call or text the Academy for the next class.');
   disable('Online seat requests are temporarily unavailable. Please call or text 540-205-6500.');
  }
 }
 select.addEventListener('change',()=>{
  const cls=classes.find(c=>c.id===select.value);
  $('reserveClassDetail').textContent=cls?detail(cls):'';
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();submit.disabled=true;submit.textContent='Sending…';
  const body={class_id:select.value,name:$('reserveName').value.trim(),email:$('reserveEmail').value.trim(),phone:$('reservePhone').value.trim(),notes:$('reserveNotes').value.trim(),website:$('reserveWebsite').value};
  try{
   const response=await fetch('/api/seat-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed.');
   form.reset();$('reserveClassDetail').textContent='';
   status.textContent='Request received! The Academy will contact you after reviewing it. Your seat is not yet confirmed.';
   status.className='reserve-status success';
  }catch(error){
   status.textContent=error.message+' Please call or text 540-205-6500 if you need help.';
   status.className='reserve-status unavailable';
  }finally{submit.disabled=false;submit.textContent='Reserve Seat'}
 });
 window.addEventListener('pageshow',event=>{if(event.persisted)load()});
 load();
})();
