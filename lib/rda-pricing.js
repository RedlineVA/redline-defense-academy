'use strict';
const MAX_OFFERS=8;
function bad(message){return Object.assign(new Error(message),{status:400})}
function safeInt(v){const n=Number(v);return Number.isSafeInteger(n)&&n>=0&&n<=100000000?n:null}
function parseOffers(raw){
 if(Array.isArray(raw))return raw;
 try{const arr=JSON.parse(String(raw||'[]'));return Array.isArray(arr)?arr:[]}catch{return []}
}
function normalizeOffers(raw){
 if(!Array.isArray(raw)||raw.length>MAX_OFFERS)throw bad('A class can have up to eight pricing offers.');
 const ids=new Set();
 const offers=raw.map((v,i)=>{
  const id=String(v.id||'').trim(),label=String(v.label||'').trim().replace(/\s+/g,' ');
  const seats=Number(v.seats_limit),size=Number(v.group_size),price=safeInt(v.price_cents),deposit=safeInt(v.deposit_cents);
  if(!/^[a-zA-Z0-9_-]{2,20}$/.test(id)||id==='regular'||ids.has(id))throw bad('Each special offer must have a unique ID.');
  if(label.length<2||label.length>36||!Number.isInteger(seats)||seats<1||seats>1000||
   ![1,2].includes(size)||price===null||deposit===null||deposit>price||seats<size||
   (size===2&&seats%2!==0))throw bad('Check special offer '+(i+1)+': name, seat limit, group size, total price and deposit.');
  ids.add(id);
  return {id,label,seats_limit:seats,group_size:size,price_cents:price,deposit_cents:deposit};
 });
 if(JSON.stringify(offers).length>1800)throw bad('Specials are too large. Use shorter offer names.');
 return offers;
}
function sizeOf(e){return Number(e.party_size)===2?2:1}
function totalSeats(requests,classId){return requests.filter(e=>e.class_id===classId&&['confirmed','attended'].includes(e.status)).reduce((sum,e)=>sum+sizeOf(e),0)}
function remaining(cls,requests){return cls.capacity===null?null:Math.max(0,cls.capacity-totalSeats(requests,cls.id))}
function options(cls,requests){
 const left=remaining(cls,requests);
 const normal={id:'regular',label:'Regular Seat',group_size:1,seats_limit:null,price_cents:cls.price_cents,deposit_cents:cls.deposit_cents,seats_remaining:left,sold_out:left!==null&&left<1};
 const others=parseOffers(cls.offers).map(o=>{
  const used=requests.filter(e=>e.class_id===cls.id&&['confirmed','attended'].includes(e.status)&&e.offer_id===o.id).reduce((s,e)=>s+sizeOf(e),0);
  const free=Math.max(0,o.seats_limit-used);
  const available=left===null?free:Math.min(free,left);
  return {...o,seats_remaining:available,sold_out:available<o.group_size};
 });
 return [normal,...others];
}
function selection(cls,requests,offerId){
 const chosen=options(cls,requests).find(o=>o.id===(offerId||'regular'));
 if(!chosen)throw bad('This special offer is no longer available. Select a current price.');
 if(chosen.sold_out)throw bad('The selected price has reached its seat limit. Please choose another offer.');
 return chosen;
}
function snapshot(e,cls){
 const quantity=sizeOf(e),price=Number.isInteger(e.price_total_cents)?e.price_total_cents:cls.price_cents*quantity;
 const deposit=Number.isInteger(e.deposit_due_cents)?e.deposit_due_cents:cls.deposit_cents*quantity;
 return {party_size:quantity,price_total_cents:price,deposit_due_cents:deposit,offer_id:e.offer_id||'regular',offer_label:e.offer_label||'Regular Seat'};
}
module.exports={MAX_OFFERS,parseOffers,normalizeOffers,sizeOf,totalSeats,remaining,options,selection,snapshot};
