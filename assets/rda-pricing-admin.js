'use strict';
(function(){
 const oldShow=showClass,oldRows=renderClasses,oldStudent=showRequest;
 function row(data={}){
  const item=document.createElement('div');item.className='rda-tier';item.dataset.id=data.id||('p'+Math.random().toString(36).slice(2,10));
  const props=[
   ['label','Special Name','text',data.label||'Limited Seats'],
   ['seats_limit','Seat Limit','number',data.seats_limit??5],
   ['group_size','Booking Size','select',data.group_size??1],
   ['price_cents','Total Price ($)','number',((data.price_cents??Number($('classPrice').value)*100)/100).toFixed(2)],
   ['deposit_cents','Deposit ($)','number',((data.deposit_cents??Number($('classDeposit').value)*100)/100).toFixed(2)]
  ];
  for(const [key,caption,kind,val] of props){
   const label=document.createElement('label');label.textContent=caption;
   const control=document.createElement(kind==='select'?'select':'input');control.dataset.key=key;control.required=true;
   if(kind==='select'){control.add(new Option('1 seat','1'));control.add(new Option('2 seats — friend','2'))}
   else{control.type=kind;if(kind==='text')control.maxLength=36;else{control.min=key==='seats_limit'?'1':'0';control.step=key==='seats_limit'?'1':'0.01'}}
   control.value=String(val);label.append(control);item.append(label);
  }
  const remove=document.createElement('button');remove.type='button';remove.className='btn small ghost';remove.textContent='Remove';
  remove.onclick=()=>{item.remove();limits()};item.append(remove);
  const size=item.querySelector('[data-key=group_size]'),seats=item.querySelector('[data-key=seats_limit]');
  size.onchange=()=>{const n=Number(size.value),v=Number(seats.value);if(v<n)seats.value=String(n);else if(n===2&&v%2)seats.value=String(v+1)};
  return item;
 }
 function limits(){const n=$('rdaTiers').children.length;$('addTier').disabled=n>=8;$('addFriend').disabled=n>=8;$('rdaTierCount').textContent=n+' of 8 special offers'}
 showClass=function(id){
  oldShow(id);const form=$('classForm');if(!form)return;
  const section=document.createElement('section');section.className='wide rda-pricing';
  const heading=document.createElement('h3');heading.textContent='Limited Seat Specials & Bring a Friend';
  const p=document.createElement('p');p.className='muted';
  p.textContent='Example: 5 seats at $X, 10 seats at $Y. Each offer has its own seat allocation, total price and deposit. Bring a Friend covers TWO attendees in one booking.';
  const count=document.createElement('small');count.id='rdaTierCount';
  const rows=document.createElement('div');rows.id='rdaTiers';
  const add=document.createElement('button');add.type='button';add.className='btn secondary';add.id='addTier';add.textContent='+ Limited Seat Price';
  const friend=document.createElement('button');friend.type='button';friend.className='btn secondary';friend.id='addFriend';friend.textContent='+ Bring a Friend';
  const actions=document.createElement('div');actions.className='toolbar';actions.append(add,friend);
  section.append(heading,p,count,rows,actions);form.insertBefore(section,form.querySelector('.toolbar'));
  for(const o of (id?cls(id)?.offers:[])||[])rows.append(row(o));
  function addNew(pair){
   if(rows.children.length>=8)return;
   const price=Math.round(Number($('classPrice').value)*100),deposit=Math.round(Number($('classDeposit').value)*100);
   rows.append(row({label:pair?'Bring a Friend':'Limited Seats',seats_limit:pair?10:5,group_size:pair?2:1,
    price_cents:pair?price*2:price,deposit_cents:pair?deposit*2:deposit}));limits();
  }
  add.onclick=()=>addNew(false);friend.onclick=()=>addNew(true);limits();
  form.onsubmit=async event=>{
   event.preventDefault();
   const offers=[...rows.children].map(entry=>{
    const get=k=>entry.querySelector('[data-key='+k+']').value;
    return {id:entry.dataset.id,label:get('label').trim(),seats_limit:Number(get('seats_limit')),group_size:Number(get('group_size')),
     price_cents:Math.round(Number(get('price_cents'))*100),deposit_cents:Math.round(Number(get('deposit_cents'))*100)};
   });
   if(offers.some(o=>o.label.length<2||o.deposit_cents>o.price_cents||!Number.isInteger(o.seats_limit)||
    o.seats_limit<o.group_size||(o.group_size===2&&o.seats_limit%2))){
    message('Check offer names, prices, deposits, and even seat caps for friend offers.',true);return
   }
   const b={action:id?'edit_class':'create_class',title:$('classTitle').value,location:$('classLocation').value,
    capacity:$('classCapacity').value,price_cents:Math.round(Number($('classPrice').value)*100),deposit_cents:Math.round(Number($('classDeposit').value)*100),
    visible:$('classVisible').checked,offers};
   const selected=rdaClassStartValue(id);if(!selected)return;
   if(id){b.id=id;b.active=$('classActive').checked;if(selected.changed)b.starts_at=selected.startsAt}
   else b.starts_at=selected.startsAt;
   await run(b);
  };
 };
 seats=function(id){return state.enrollments.filter(e=>e.class_id===id&&activeStatuses.includes(e.status)).reduce((n,e)=>n+(e.party_size===2?2:1),0)};
 balance=function(e){const c=cls(e.class_id),n=e.party_size===2?2:1;return Math.max(0,(Number.isInteger(e.price_total_cents)?e.price_total_cents:Number(c?.price_cents||0)*n)-payments(e.id))};
 renderClasses=function(){
  oldRows();
  for(const tr of $('classRows')?.querySelectorAll('tr')||[]){
   const btn=tr.querySelector('[data-class]'),c=btn&&cls(btn.dataset.class);if(!c?.offers?.length)continue;
   const line=document.createElement('div');line.className='rda-tier-note';
   line.textContent=c.offers.map(o=>o.label+' · '+o.seats_limit+' seats · '+money(o.price_cents)+(o.group_size===2?' / pair':'')).join(' | ');
   tr.querySelector('td')?.append(line);
  }
 };
 showRequest=function(id){
  oldStudent(id);const e=state.enrollments.find(x=>x.id===id),form=$('modalRoot')?.querySelector('.form-grid');if(!e||!form)return;
  const n=e.party_size===2?2:1,price=Number.isInteger(e.price_total_cents)?e.price_total_cents:Number(cls(e.class_id)?.price_cents||0)*n;
  const dep=Number.isInteger(e.deposit_due_cents)?e.deposit_due_cents:Number(cls(e.class_id)?.deposit_cents||0)*n;
  const d=document.createElement('div');d.className='wide rda-quote';d.textContent=(e.offer_label||'Regular')+' · '+n+' '+(n===1?'seat':'seats')+
   (n===2?' · Friend: '+(e.friend_name||'Not listed'):'')+' · Total '+money(price)+' · Deposit '+money(dep);
  form.prepend(d);
 };
})();
