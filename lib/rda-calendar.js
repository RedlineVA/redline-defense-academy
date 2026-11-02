'use strict';
const crypto=require('node:crypto');
const {gcal,calendarId}=require('../_google');
const {cleanText,validEmail,validPhone}=require('../_security');
const {parseOffers,options,totalSeats,remaining}=require('./rda-pricing');
const base='/calendars/'+encodeURIComponent(calendarId())+'/events';
const DAY='2095-05-08',NEXT='2095-05-09';
function str(v,n=200){return cleanText(v,n)}
function id(v){const x=String(v||'');return /^[a-z0-9_]{5,120}$/.test(x)?x:''}
function int(v){const n=Number(v);return Number.isSafeInteger(n)&&n>=0&&n<=100000000?n:null}
function iso(v){const d=new Date(v||'');return Number.isFinite(d.getTime())?d.toISOString():''}
function flag(v){return v===true||String(v)==='true'||String(v)==='1'}
function fields(e){return e.extendedProperties?.private||{}}
function fromEvent(e){
 const p=fields(e),type=p.rda_type,common={id:e.id,created_at:p.created_at||e.created||'',updated_at:p.updated_at||e.updated||''};
 if(type==='class')return {...common,title:p.title||'',starts_at:p.starts_at||'',location:p.location||'',capacity:p.capacity?Number(p.capacity):null,price_cents:Number(p.price_cents||0),deposit_cents:Number(p.deposit_cents||0),visible:flag(p.visible),active:flag(p.active),offers:parseOffers(p.offers)};
 if(type==='request')return {...common,class_id:p.class_id||'',full_name:p.full_name||'',phone:p.phone||'',email:p.email||'',notes:p.notes||'',status:p.status||'requested',deposit_recorded_cents:Number(p.deposit_recorded_cents||0),deposit_confirmed_at:p.deposit_confirmed_at||'',deposit_method:p.deposit_method||'',deposit_reference:p.deposit_reference||'',confirmation_state:p.confirmation_state||'',confirmation_sent_at:p.confirmation_sent_at||'',confirmation_error:p.confirmation_error||'',offer_id:p.offer_id||'regular',offer_label:p.offer_label||'Regular Seat',party_size:Number(p.party_size)===2?2:1,friend_name:p.friend_name||'',price_total_cents:p.price_total_cents==null||p.price_total_cents===''?null:Number(p.price_total_cents),deposit_due_cents:p.deposit_due_cents==null||p.deposit_due_cents===''?null:Number(p.deposit_due_cents)};
 if(type==='payment')return {...common,enrollment_id:p.enrollment_id||'',amount_cents:Number(p.amount_cents||0),kind:p.kind||'',method:p.method||'',reference:p.reference||'',note:p.note||''};
 return null;
}
async function list(type){
 if(!['class','request','payment'].includes(type))throw Error('Invalid records');
 const q=new URLSearchParams({timeMin:'2095-05-08T00:00:00Z',timeMax:'2095-05-10T00:00:00Z',singleEvents:'true',maxResults:'2500',privateExtendedProperty:'rda_type='+type});
 let all=[],page='';
 do{if(page)q.set('pageToken',page);const d=await gcal(base+'?'+q);all.push(...(d.items||[]).filter(x=>x.status!=='cancelled'&&fields(x).rda_type===type).map(fromEvent));page=d.nextPageToken||'';}while(page&&all.length<10000);
 return all;
}
async function get(type,eventId){
 const event=await gcal(base+'/'+encodeURIComponent(id(eventId)));if(fields(event).rda_type!==type||event.status==='cancelled')throw Object.assign(Error('Record not found'),{status:404});return event;
}
async function create(type,values){
 const now=new Date().toISOString();
 const props={rda_type:type,created_at:now,updated_at:now};
 for(const [k,v] of Object.entries(values))props[k]=String(v===null||v===undefined?'':v);
 const result=await gcal(base,{method:'POST',body:JSON.stringify({summary:'RDA — '+({class:'Class',request:'Seat Request',payment:'Payment'}[type]),description:'PRIVATE REDLINE DEFENSE ACADEMY RECORD',visibility:'private',transparency:'transparent',start:{date:DAY},end:{date:NEXT},extendedProperties:{private:props}})});
 return fromEvent(result);
}
async function update(type,eventId,patch){
 const e=await get(type,eventId),properties={...fields(e),updated_at:new Date().toISOString()};
 for(const [k,v] of Object.entries(patch))properties[k]=String(v===null||v===undefined?'':v);
 const out=await gcal(base+'/'+encodeURIComponent(e.id),{method:'PATCH',headers:{'If-Match':e.etag},body:JSON.stringify({extendedProperties:{private:properties}})});
 return fromEvent(out);
}
async function publicSchedule(){
 const [classes,enrollments]=await Promise.all([list('class'),list('request')]);
 const now=Date.now();
 return classes.filter(c=>c.active&&c.visible&&Number.isFinite(Date.parse(c.starts_at))&&Date.parse(c.starts_at)>now)
  .map(c=>{
   const occupied=totalSeats(enrollments,c.id),left=remaining(c,enrollments);
   return {...c,confirmed_seats:occupied,seats_remaining:left,sold_out:left!==null&&left===0,
    offers:options(c,enrollments)};
  })
  .sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
}
async function publicClasses(){return (await publicSchedule()).filter(c=>!c.sold_out)}
module.exports={str,id,int,iso,flag,fields,list,get,create,update,publicClasses,publicSchedule,validEmail,validPhone,crypto};
