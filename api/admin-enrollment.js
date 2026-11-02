'use strict';
const {str,id,int,iso,list,get,create,update}=require('../lib/rda-calendar');
const {isAdmin,json,enforceSameOrigin}=require('../lib/rda-auth');
const statuses=['requested','contacted','deposit_pending','confirmed','cancelled','attended'];
async function handle(req,res){
 if(!isAdmin(req))return json(res,401,{error:'Your admin session has expired. Please sign in again.'});
 if(req.method==='GET'){
  const [classes,enrollments,payments]=await Promise.all([list('class'),list('request'),list('payment')]);
  return json(res,200,{classes:classes.sort((a,b)=>b.starts_at.localeCompare(a.starts_at)),enrollments:enrollments.sort((a,b)=>b.created_at.localeCompare(a.created_at)),payments:payments.sort((a,b)=>b.created_at.localeCompare(a.created_at)),admin:process.env.RDA_ADMIN_EMAIL,notificationsConfigured:false});
 }
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
 if(!enforceSameOrigin(req,res))return;
 const b=req.body||{};
 if(b.action==='create_class'){
  const title=str(b.title,160),date=iso(b.starts_at),price=int(b.price_cents),deposit=int(b.deposit_cents),capacity=b.capacity===''||b.capacity==null?null:Number(b.capacity);
  if(title.length<4||!date||price===null||deposit===null||deposit>price||(capacity!==null&&(!Number.isInteger(capacity)||capacity<1||capacity>1000)))return json(res,400,{error:'Check the class details, date, prices and capacity.'});
  const row=await create('class',{title,starts_at:date,location:str(b.location,160),capacity:capacity??'',price_cents:price,deposit_cents:deposit,active:true,visible:b.visible===true});
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
  await update('class',eventId,patch);return json(res,200,{ok:true});
 }
 if(b.action==='status'){
  const eId=id(b.id),status=str(b.status,30);if(!eId||!statuses.includes(status))return json(res,400,{error:'Invalid status.'});
  const event=await get('request',eId);const p=event.extendedProperties?.private||{};
  if(status==='confirmed'&&!['confirmed','attended'].includes(p.status)){
   const classes=await list('class'),c=classes.find(x=>x.id===p.class_id);
   if(!c)return json(res,400,{error:'The class no longer exists.'});
   if(c.capacity){const students=await list('request');const filled=students.filter(x=>x.class_id===c.id&&['confirmed','attended'].includes(x.status)).length;if(filled>=c.capacity)return json(res,409,{error:'This class is full.'})}
  }
  await update('request',eId,{status});return json(res,200,{ok:true});
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
