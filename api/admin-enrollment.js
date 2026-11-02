'use strict';
const {str,id,int,iso,list,get,create,update}=require('../lib/rda-calendar');
const {isAdmin,json,enforceSameOrigin}=require('../lib/rda-auth');
const emailService=require('../lib/rda-confirmation-email');
const {normalizeOffers,parseOffers,options,snapshot,sizeOf,totalSeats,remaining}=require('../lib/rda-pricing');
const statuses=['requested','contacted','deposit_pending','confirmed','cancelled','attended'];

async function sendConfirmation(enrollmentId,student,cls,totalPaid){
 let current=await get('request',enrollmentId),p=current.extendedProperties?.private||{};
 if(!p.deposit_confirmed_at)return {state:'unconfirmed',ok:false,message:'Deposit not confirmed.'};
 if(p.confirmation_sent_at)return {state:'sent',ok:true,message:'Confirmation was already sent.'};
 if(!emailService.configured()){
  await update('request',enrollmentId,{confirmation_state:'not_configured'});
  return {state:'not_configured',ok:false,message:'Deposit confirmed and seat reserved. Email sending is not configured yet; no email was sent.'};
 }
 if(p.confirmation_state==='sending'&&Date.now()-Date.parse(p.confirmation_attempt_at||'')<120000)
  return {state:'sending',ok:false,message:'An email is being processed already.'};
 await update('request',enrollmentId,{confirmation_state:'sending',confirmation_attempt_at:new Date().toISOString(),confirmation_error:''});
 const result=await emailService.send(student,cls,totalPaid);
 if(result.ok){
  await update('request',enrollmentId,{confirmation_state:'sent',confirmation_sent_at:new Date().toISOString(),confirmation_error:'',confirmation_message_id:result.id||''});
  return {state:'sent',ok:true,message:'Confirmation email sent.'};
 }
 await update('request',enrollmentId,{confirmation_state:'failed',confirmation_error:result.code||'email_failed'});
 return {state:'failed',ok:false,message:'Seat reserved, but email sending failed. You can retry from the student record.'};
}
async function handle(req,res){
 if(!isAdmin(req))return json(res,401,{error:'Your admin session has expired. Please sign in again.'});
 if(req.method==='GET'){
  const [classes,enrollments,payments]=await Promise.all([list('class'),list('request'),list('payment')]);
  return json(res,200,{classes:classes.sort((a,b)=>b.starts_at.localeCompare(a.starts_at)),enrollments:enrollments.sort((a,b)=>b.created_at.localeCompare(a.created_at)),payments:payments.sort((a,b)=>b.created_at.localeCompare(a.created_at)),admin:process.env.RDA_ADMIN_EMAIL,notificationsConfigured:false,emailConfigured:emailService.configured()});
 }
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
 if(!enforceSameOrigin(req,res))return;
 const b=req.body||{};
 if(b.action==='create_class'){
  const title=str(b.title,160),date=iso(b.starts_at),price=int(b.price_cents),deposit=int(b.deposit_cents),capacity=b.capacity===''||b.capacity==null?null:Number(b.capacity);
  if(title.length<4||!date||price===null||deposit===null||deposit>price||(capacity!==null&&(!Number.isInteger(capacity)||capacity<1||capacity>1000)))return json(res,400,{error:'Check the class details, date, prices and capacity.'});
  const offers=normalizeOffers(b.offers||[]);
  const row=await create('class',{title,starts_at:date,location:str(b.location,160),capacity:capacity??'',price_cents:price,deposit_cents:deposit,active:true,visible:b.visible===true,offers:JSON.stringify(offers)});
  return json(res,201,{class:row});
 }
 if(b.action==='edit_class'){
  const eventId=id(b.id);if(!eventId)return json(res,400,{error:'Invalid class ID.'});
  const current=await get('class',eventId);const patch={};
  if(b.title!==undefined){const name=str(b.title,160);if(name.length<4)return json(res,400,{error:'Invalid class name.'});patch.title=name}
  if(b.location!==undefined)patch.location=str(b.location,160);
  if(b.visible!==undefined)patch.visible=!!b.visible;
  if(b.active!==undefined)patch.active=!!b.active;
  if(b.capacity!==undefined){const c=b.capacity===''||b.capacity===null?null:Number(b.capacity);if(c!==null&&(!Number.isInteger(c)||c<1||c>1000))return json(res,400,{error:'Invalid capacity.'});patch.capacity=c??''}
  if(b.price_cents!==undefined){const n=int(b.price_cents);if(n===null)return json(res,400,{error:'Invalid price.'});patch.price_cents=n}
  if(b.deposit_cents!==undefined){const n=int(b.deposit_cents);if(n===null)return json(res,400,{error:'Invalid deposit.'});patch.deposit_cents=n}
  if(Number(patch.deposit_cents??(current.extendedProperties?.private?.deposit_cents||0))>Number(patch.price_cents??(current.extendedProperties?.private?.price_cents||0)))return json(res,400,{error:'Deposit cannot exceed class price.'});
  if(b.offers!==undefined){
   const offers=normalizeOffers(b.offers);
   patch.offers=JSON.stringify(offers);
  }
  await update('class',eventId,patch);return json(res,200,{ok:true});
 }
 if(b.action==='status'){
  const eId=id(b.id),status=str(b.status,30);if(!eId||!statuses.includes(status))return json(res,400,{error:'Invalid status.'});
  const event=await get('request',eId);const p=event.extendedProperties?.private||{};
  if(['confirmed','attended'].includes(status)&&!p.deposit_confirmed_at)return json(res,409,{error:'Confirm the deposit first, so the seat and email are handled correctly.'});
  if(status==='attended'&&!['confirmed','attended'].includes(p.status))
   return json(res,409,{error:'Confirm this seat before marking attendance.'});
  if(status==='confirmed'&&!['confirmed','attended'].includes(p.status)){
   const classes=await list('class'),c=classes.find(x=>x.id===p.class_id);
   if(!c)return json(res,400,{error:'The class no longer exists.'});
   const students=await list('request'),qty=sizeOf(p);
   if(c.capacity!==null&&totalSeats(students,c.id)+qty>c.capacity)return json(res,409,{error:'This class is full.'});
   if(p.offer_id&&p.offer_id!=='regular'){
    const offer=options(c,students).find(o=>o.id===p.offer_id);
    if(!offer||offer.sold_out||offer.seats_remaining<qty)
     return json(res,409,{error:'This special pricing tier is sold out.'});
   }
  }
  await update('request',eId,{status});return json(res,200,{ok:true});
 }
 if(b.action==='preview_confirmation'){
  const enrollmentId=id(b.id);
  if(!enrollmentId)return json(res,400,{error:'Invalid student request.'});
  const event=await get('request',enrollmentId),p=event.extendedProperties?.private||{};
  if(!p.deposit_confirmed_at)return json(res,409,{error:'Confirm deposit before generating the reservation email.'});
  const cls=(await list('class')).find(c=>c.id===p.class_id);
  if(!cls)return json(res,404,{error:'Class not found.'});
  const paid=Number(p.deposit_recorded_cents||0)+(await list('payment')).filter(x=>x.enrollment_id===enrollmentId).reduce((n,x)=>n+x.amount_cents,0);
  const m=emailService.compose({id:enrollmentId,full_name:p.full_name,email:p.email,party_size:Number(p.party_size)||1,
   friend_name:p.friend_name,offer_label:p.offer_label,price_total_cents:p.price_total_cents==null||p.price_total_cents===''?null:Number(p.price_total_cents)},cls,paid);
  return json(res,200,{subject:m.subject,text:m.text,recipient:p.email,alreadySent:!!p.confirmation_sent_at});
 }
 if(b.action==='confirm_deposit'){
  const enrollmentId=id(b.id),newAmount=int(b.amount_cents),method=str(b.method,30),reference=str(b.reference,120);
  if(!enrollmentId||newAmount===null||!['cash','zelle','card_external','bank','other','already_recorded'].includes(method))return json(res,400,{error:'Enter the deposit received and payment method.'});
  const record=await get('request',enrollmentId),p=record.extendedProperties?.private||{};
  if(p.deposit_confirmed_at)return json(res,409,{error:'Deposit already confirmed. Open the student to view email status.'});
  if(p.status==='cancelled')return json(res,409,{error:'Cannot confirm a cancelled request.'});
  const cls=(await list('class')).find(x=>x.id===p.class_id);
  if(!cls)return json(res,404,{error:'Class not found.'});
  const current=(await list('request')),quote=snapshot({
   offer_id:p.offer_id,offer_label:p.offer_label,party_size:Number(p.party_size),
   price_total_cents:p.price_total_cents==null||p.price_total_cents===''?null:Number(p.price_total_cents),
   deposit_due_cents:p.deposit_due_cents==null||p.deposit_due_cents===''?null:Number(p.deposit_due_cents)
  },cls);
  if(cls.capacity!==null&&totalSeats(current,cls.id)+quote.party_size>cls.capacity)
   return json(res,409,{error:'Not enough seats remain for this reservation.'});
  if(quote.offer_id!=='regular'){
   const offer=options(cls,current).find(o=>o.id===quote.offer_id);
   if(!offer||offer.sold_out||offer.seats_remaining<quote.party_size)
    return json(res,409,{error:'This promotional price has sold out. Please contact the student before changing their offer.'});
  }
  const prior=(await list('payment')).filter(x=>x.enrollment_id===enrollmentId);
  const depositAlreadyRecorded=prior.filter(x=>x.kind==='deposit').reduce((n,x)=>n+x.amount_cents,0);
  if(depositAlreadyRecorded+newAmount<quote.deposit_due_cents)return json(res,400,{error:'Deposit amount must reach the required class deposit.'});
  if(depositAlreadyRecorded+newAmount>quote.price_total_cents)return json(res,400,{error:'Recorded deposit cannot exceed the class price.'});
  if(method==='already_recorded'&&newAmount!==0)return json(res,400,{error:'Use $0 when confirming a previously recorded deposit.'});
  if(newAmount===0&&depositAlreadyRecorded===0&&quote.deposit_due_cents>0)return json(res,400,{error:'Enter the deposit that has actually been received.'});
  // Money is tracked on the request event atomically with status, never as an additional ledger event.
  // An older manually recorded payment remains in the separate ledger and is counted only once.
  const result=await update('request',enrollmentId,{
   deposit_confirmed_at:new Date().toISOString(),deposit_recorded_cents:newAmount,
   deposit_method:method,deposit_reference:reference,status:'confirmed',confirmation_state:'pending'
  });
  const paid=prior.reduce((n,x)=>n+x.amount_cents,0)+newAmount;
  const sent=await sendConfirmation(enrollmentId,result,cls,paid);
  return json(res,200,{ok:true,emailSent:sent.ok,emailStatus:sent.state,message:sent.message});
 }
 if(b.action==='send_confirmation'){
  const enrollmentId=id(b.id);if(!enrollmentId)return json(res,400,{error:'Invalid request.'});
  const event=await get('request',enrollmentId),p=event.extendedProperties?.private||{};
  if(!p.deposit_confirmed_at)return json(res,409,{error:'Confirm the deposit first.'});
  if(p.confirmation_sent_at)return json(res,409,{error:'Email was already sent.'});
  if(p.status==='cancelled')return json(res,409,{error:'Cancelled reservations cannot be emailed.'});
  const cls=(await list('class')).find(x=>x.id===p.class_id);
  if(!cls)return json(res,404,{error:'Class not found.'});
  const paid=Number(p.deposit_recorded_cents||0)+(await list('payment')).filter(x=>x.enrollment_id===enrollmentId).reduce((n,x)=>n+x.amount_cents,0);
  const sent=await sendConfirmation(enrollmentId,{id:enrollmentId,full_name:p.full_name,email:p.email,
   offer_label:p.offer_label,party_size:Number(p.party_size)||1,friend_name:p.friend_name,
   price_total_cents:p.price_total_cents==null||p.price_total_cents===''?null:Number(p.price_total_cents),
   deposit_recorded_cents:Number(p.deposit_recorded_cents||0)},cls,paid);
  return json(res,200,{ok:sent.ok,emailSent:sent.ok,emailStatus:sent.state,message:sent.message});
 }
 if(b.action==='payment'){
  const eId=id(b.id),amt=Number(b.amount_cents),kind=str(b.kind,30),method=str(b.method,30);
  if(!eId||!Number.isSafeInteger(amt)||!amt||Math.abs(amt)>100000000||!['deposit','balance','refund'].includes(kind)||!['cash','zelle','card_external','bank','other'].includes(method)||(kind==='refund'&&amt>0)||(kind!=='refund'&&amt<0))return json(res,400,{error:'Invalid payment details.'});
  await get('request',eId);
  await create('payment',{enrollment_id:eId,amount_cents:amt,kind,method,reference:str(b.reference,120),note:str(b.note,500)});
  return json(res,201,{ok:true});
 }
 return json(res,400,{error:'Unknown action.'});
}
module.exports=async(req,res)=>{try{return await handle(req,res)}catch(e){return json(res,[400,401,403,404,409].includes(e.status)?e.status:503,{error:[400,404,409].includes(e.status)?e.message:'The enrollment calendar is unavailable. Please try again.'})}};
