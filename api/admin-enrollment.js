'use strict';
const {ready,common,error,sameOrigin,clean,email,uuid,cents,query,auth,requireAdmin,bearer}=require('../lib/rda-backend');
async function run(req,res){
 common(res);if(!sameOrigin(req))return error(res,403,'Invalid request origin.');
 if(!ready())return error(res,503,'Enrollment system setup is not complete. Connect its private database before using admin login.');
 const b=req.body||{};
 if(req.method==='POST'&&b.action==='register'){
  const mail=email(b.email),password=String(b.password||'');
  if(!mail||mail!==String(process.env.RDA_ADMIN_EMAIL||'').toLowerCase())return error(res,403,'Only the academy owner email can activate this account.');
  if(password.length<12||password.length>200)return error(res,400,'Choose a fresh password of at least 12 characters.');
  const response=await fetch(process.env.RDA_SUPABASE_URL.replace(/\/$/,'')+'/auth/v1/signup',{
   method:'POST',headers:{apikey:process.env.RDA_SUPABASE_ANON_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({email:mail,password})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)return error(res,response.status===429?429:400,result.msg||result.error_description||'Unable to activate account. Check email settings.');
  return res.status(202).json({ok:true,message:'Check your Gmail inbox to verify your account, then return here and sign in.'});
 }
 if(req.method==='POST'&&b.action==='login'){
  const mail=email(b.email),pass=String(b.password||'');
  if(!mail||!pass||pass.length>300)return error(res,400,'Enter a valid admin email and password.');
  const session=await auth({email:mail,password:pass},'password');
  await requireAdmin(session.access_token);
  return res.status(200).json({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in});
 }
 if(req.method==='POST'&&b.action==='refresh'){
  const session=await auth({refresh_token:clean(b.refresh_token,2000)},'refresh_token');
  await requireAdmin(session.access_token);
  return res.status(200).json({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in});
 }
 const token=bearer(req);
 const admin=await requireAdmin(token);
 if(req.method==='GET'){
  const [classes,enrollments,payments]=await Promise.all([
   query('/rest/v1/rda_classes?select=*&order=starts_at.desc',{token}),
   query('/rest/v1/rda_enrollments?select=*&order=created_at.desc',{token}),
   query('/rest/v1/rda_payments?select=*&order=created_at.desc',{token})
  ]);
  return res.status(200).json({classes,enrollments,payments,admin:admin.email,notificationsConfigured:!!(process.env.RESEND_API_KEY&&process.env.RDA_NOTIFY_EMAIL&&process.env.RDA_FROM_EMAIL)});
 }
 if(req.method!=='POST')return error(res,405,'Method not allowed.');
 if(b.action==='create_class'){
  const name=clean(b.title,160),start=new Date(b.starts_at||''),price=cents(b.price_cents),deposit=cents(b.deposit_cents),capacity=b.capacity===''||b.capacity==null?null:Number(b.capacity);
  if(name.length<4||!Number.isFinite(start.getTime())||price===null||deposit===null||deposit>price||(capacity!==null&&(!Number.isInteger(capacity)||capacity<1||capacity>1000)))return error(res,400,'Check the class name, date, capacity, price and deposit.');
  const item={title:name,starts_at:start.toISOString(),location:clean(b.location,160),price_cents:price,deposit_cents:deposit,capacity,active:true,visible:b.visible===true};
  const rows=await query('/rest/v1/rda_classes',{method:'POST',body:item,token});return res.status(201).json({class:rows[0]});
 }
 if(b.action==='edit_class'){
  if(!uuid(b.id))return error(res,400,'Invalid class.');
  const item={};if(typeof b.active==='boolean')item.active=b.active;if(typeof b.visible==='boolean')item.visible=b.visible;
  if(b.title!==undefined){if(clean(b.title,160).length<4)return error(res,400,'Invalid class title.');item.title=clean(b.title,160)}
  if(b.location!==undefined)item.location=clean(b.location,160);
  if(b.capacity!==undefined){const n=b.capacity===''||b.capacity==null?null:Number(b.capacity);if(n!==null&&(!Number.isInteger(n)||n<1||n>1000))return error(res,400,'Invalid capacity.');item.capacity=n}
  if(b.price_cents!==undefined){const n=cents(b.price_cents);if(n===null)return error(res,400,'Invalid price.');item.price_cents=n}
  if(b.deposit_cents!==undefined){const n=cents(b.deposit_cents);if(n===null)return error(res,400,'Invalid deposit.');item.deposit_cents=n}
  if(item.deposit_cents!==undefined||item.price_cents!==undefined){
   const current=await query('/rest/v1/rda_classes?id=eq.'+encodeURIComponent(b.id)+'&select=price_cents,deposit_cents',{token});
   if(!current?.length)return error(res,404,'Class not found.');
   if((item.deposit_cents??current[0].deposit_cents)>(item.price_cents??current[0].price_cents))return error(res,400,'Deposit cannot exceed class price.');
  }
  if(!Object.keys(item).length)return error(res,400,'Nothing to update.');
  await query('/rest/v1/rda_classes?id=eq.'+encodeURIComponent(b.id),{method:'PATCH',body:item,token});return res.status(200).json({ok:true});
 }
 if(b.action==='status'){
  if(!uuid(b.id)||!['requested','contacted','deposit_pending','confirmed','cancelled','attended'].includes(b.status))return error(res,400,'Invalid status.');
  await query('/rest/v1/rpc/rda_set_status',{method:'POST',body:{p_id:b.id,p_status:b.status},token});
  return res.status(200).json({ok:true});
 }
 if(b.action==='payment'){
  const amount=Number(b.amount_cents);
  if(!uuid(b.id)||!['deposit','balance','refund'].includes(b.kind)||!['cash','zelle','card_external','bank','other'].includes(b.method)||!Number.isInteger(amount)||Math.abs(amount)>100000000||amount===0)return error(res,400,'Invalid payment.');
  if((b.kind==='refund'&&amount>=0)||(b.kind!=='refund'&&amount<=0))return error(res,400,'Use a positive payment amount or a negative refund.');
  const students=await query('/rest/v1/rda_enrollments?id=eq.'+encodeURIComponent(b.id)+'&select=id',{token});
  if(!students?.length)return error(res,404,'Student request not found.');
  await query('/rest/v1/rda_payments',{method:'POST',body:{enrollment_id:b.id,kind:b.kind,method:b.method,amount_cents:amount,reference:clean(b.reference,120),note:clean(b.note,500)},token});
  return res.status(201).json({ok:true});
 }
 return error(res,400,'Unknown action.');
}
module.exports=async(req,res)=>{try{await run(req,res)}catch(e){if(!res.headersSent)error(res,[400,401,403,404,409,429,503].includes(e.status)?e.status:500,[401,403,404,409].includes(e.status)?e.message:'Could not complete the request. Try again.');}};
