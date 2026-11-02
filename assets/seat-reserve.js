'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0)/100);
 const displayDate=raw=>new Date(raw).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'long',day:'numeric',year:'numeric'});
 const displayTime=raw=>new Date(raw).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 const monthDay=raw=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'2-digit'}).formatToParts(new Date(raw));
 const form=$('reserveForm'),status=$('reserveStatus'),select=$('reserveClass'),offer=$('reserveOffer'),send=$('reserveSubmit');
 const featured=$('nextClassCard'),list=$('scheduleList'),msg=$('scheduleMessage');
 if(!form||!select||!offer||!featured||!list||!status)return;
 let classes=[];
 function node(tag,klass,text){
  const x=document.createElement(tag);if(klass)x.className=klass;if(text!=null)x.textContent=String(text);return x;
 }
 const optionText=o=>o.label+' · '+money(o.price_cents)+(o.group_size===2?' total for 2':' per person')+' · Deposit '+money(o.deposit_cents);
 function offers(c){return Array.isArray(c?.offers)?c.offers:[]}
 function chosenClass(){return classes.find(c=>c.id===select.value)}
 function chooseOffer(c,selectedId=''){
  offer.replaceChildren(new Option('Select a price',''));
  const choices=offers(c).filter(o=>!o.sold_out);
  for(const o of choices)offer.add(new Option(optionText(o),o.id));
  const matching=choices.find(o=>o.id===selectedId);
  const reg=choices.find(o=>o.id==='regular');
  const pick=matching||reg||choices[0];
  if(pick)offer.value=pick.id;
  updatePrice();
 }
 function updatePrice(){
  const c=chosenClass(),o=offers(c||{}).find(v=>v.id===offer.value);
  const wrap=$('reserveFriendWrap'),friend=$('reserveFriendName');
  wrap.classList.toggle('hidden',!o||o.group_size!==2);friend.required=!!o&&o.group_size===2;
  if(!o||!c){$('reserveOfferDetail').textContent='Select your class and price to see the totals.';return}
  $('reserveOfferDetail').textContent=o.label+' · '+(o.group_size===2?'Two seats for '+money(o.price_cents):'One seat for '+money(o.price_cents))+
   ' · Deposit '+money(o.deposit_cents)+' · Price subject to availability until deposit is confirmed.';
  $('reserveClassDetail').textContent=c.location||'Location shared after enrollment';
 }
 function choose(c,oId='regular'){
  select.value=c.id;chooseOffer(c,oId);
  $('reserve').scrollIntoView({behavior:'smooth',block:'start'});
  select.focus({preventScroll:true});
  if(window.history?.replaceState)window.history.replaceState(null,'','#reserve');
 }
 function btn(c,o,text){
  const b=node('button','btn btn-primary',text||'Reserve Seat');b.type='button';
  b.addEventListener('click',()=>choose(c,o?.id||'regular'));return b;
 }
 function saleOffers(c){
  const choices=offers(c).filter(o=>o.id!=='regular');
  if(!choices.length)return null;
  const area=node('div','rda-public-offers');
  for(const o of choices){
   const entry=node('div','rda-public-offer'+(o.sold_out?' rda-offer-sold':''));
   const label=node('span','rda-public-offer-text');
   label.append(node('strong','',o.label),node('small','',money(o.price_cents)+(o.group_size===2?' for two people':' per seat')+
    ' · '+(o.sold_out?'Sold out':o.seats_remaining+' of '+o.seats_limit+' offer seats left')));
   entry.append(label);
   if(!o.sold_out)entry.append(btn(c,o,'Choose Offer'));
   else entry.append(node('span','rda-sold-out-note','Sold Out'));
   area.append(entry);
  }
  return area;
 }
 function card(c,highlight){
  const wrap=node('article',highlight?'next-class-inner':'schedule-entry');
  const date=node('div','date-badge'),parts=monthDay(c.starts_at);
  date.append(node('span','month',parts.find(p=>p.type==='month')?.value||''),node('strong','day',parts.find(p=>p.type==='day')?.value||''));
  const body=node('div','schedule-entry-details');
  if(highlight)body.append(node('span','next-tag','NEXT CLASS'));
  body.append(node('h3','schedule-class-title',c.title),node('p','schedule-class-info',displayDate(c.starts_at)+' · '+displayTime(c.starts_at)),
   node('p','schedule-class-location',c.location||'Location provided after enrollment'),
   node('p','schedule-class-cost','Regular '+money(c.price_cents)+' · Deposit '+money(c.deposit_cents)));
  const specials=saleOffers(c);if(specials)body.append(specials);
  const action=node('div','schedule-class-actions');
  if(c.sold_out)action.append(node('span','schedule-full','CLASS FULL'));
  else{
   action.append(node('span','schedule-availability',c.seats_remaining==null?'Accepting requests':c.seats_remaining+' seats remaining'));
   const available=offers(c).find(o=>!o.sold_out);
   if(available)action.append(btn(c,available,'Reserve Seat'));
  }
  wrap.append(date,body,action);return wrap;
 }
 function fallback(text){
  featured.replaceChildren(node('p','schedule-empty',text));
  list.replaceChildren();
  const a=node('a','btn btn-ghost','Text for Upcoming Class Dates');
  a.href='sms:+15402056500?&body=Hi%20Redline%20Defense%20Academy%2C%20when%20is%20your%20next%20class%3F';
  list.append(a);msg.textContent='';
 }
 function renderSchedule(){
  if(!classes.length)return fallback('New class dates are being finalized. Contact us to ask about the next training date.');
  featured.replaceChildren(card(classes[0],true));
  list.replaceChildren(...classes.map(c=>card(c,false)));
  msg.textContent='Prices and limited-seat specials update automatically from our class calendar. Seat requests are not confirmed until the academy confirms your deposit.';
 }
 function disable(reason){
  status.textContent=reason;status.className='reserve-status unavailable';form.classList.add('hidden');$('reserveFallback').classList.remove('hidden');
 }
 function renderForm(){
  const available=classes.filter(c=>offers(c).some(o=>!o.sold_out));
  if(!available.length)return disable('No classes currently accept online requests. Please call or text 540-205-6500.');
  const prev=select.value;
  select.replaceChildren(new Option('Select a class',''));
  for(const c of available)select.add(new Option(c.title+' · '+displayDate(c.starts_at)+' · '+displayTime(c.starts_at),c.id));
  if(available.some(c=>c.id===prev))select.value=prev;
  chooseOffer(chosenClass()||null);
  form.classList.remove('hidden');$('reserveFallback').classList.add('hidden');
  status.className='reserve-status';status.textContent='Choose a class and promotional price. Your seats are pending until a deposit is confirmed.';
 }
 async function load(){
  try{
   const r=await fetch('/api/classes',{cache:'no-store'}),data=await r.json();
   if(!r.ok||!Array.isArray(data.classes))throw Error('Calendar unavailable');
   classes=data.classes.filter(c=>c&&c.id&&c.title&&Number.isFinite(Date.parse(c.starts_at))).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
   renderSchedule();renderForm();
  }catch{
   fallback('The live class calendar is temporarily unavailable. Please call or text the academy.');
   disable('Online seat requests are temporarily unavailable. Please call or text 540-205-6500.');
  }
 }
 select.addEventListener('change',()=>chooseOffer(chosenClass()));
 offer.addEventListener('change',updatePrice);
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const c=chosenClass(),o=offers(c||{}).find(x=>x.id===offer.value&&!x.sold_out);
  if(!c||!o){status.textContent='Choose an available class and offer.';return}
  if(o.group_size===2&&$('reserveFriendName').value.trim().length<2){status.textContent='Enter the friend attending with you.';return}
  send.disabled=true;send.textContent='Sending…';
  const req={class_id:c.id,offer_id:o.id,friend_name:o.group_size===2?$('reserveFriendName').value.trim():'',
   name:$('reserveName').value.trim(),email:$('reserveEmail').value.trim(),phone:$('reservePhone').value.trim(),
   notes:$('reserveNotes').value.trim(),website:$('reserveWebsite').value};
  try{
   const res=await fetch('/api/seat-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req)}),
   data=await res.json();
   if(!res.ok)throw Error(data.error||'Request failed.');
   form.reset();$('reserveOfferDetail').textContent='';$('reserveClassDetail').textContent='';
   $('reserveFriendWrap').classList.add('hidden');$('reserveFriendName').required=false;
   status.className='reserve-status success';status.textContent='Seat request received! Your selected offer is pending; the academy will confirm the seat after your deposit is verified.';
  }catch(e){status.className='reserve-status unavailable';status.textContent=e.message+' Contact 540-205-6500 for assistance.'}
  finally{send.disabled=false;send.textContent='Reserve Seat'}
 });
 window.addEventListener('pageshow',event=>{if(event.persisted)load()});
 load();
})();
