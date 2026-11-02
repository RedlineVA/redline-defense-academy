'use strict';
const {ready,common,error,sameOrigin,clean,email,uuid,query,notify,crypto}=require('../lib/rda-backend');
module.exports=async(req,res)=>{common(res);if(req.method!=='POST')return error(res,405,'Method not allowed.');
 if(!sameOrigin(req))return error(res,403,'Invalid request origin.');
 if(!ready())return error(res,503,'Online reservations are not yet available. Call or text 540-205-6500.');
 const b=req.body||{};
 if(b.website)return res.status(202).json({ok:true});
 const name=clean(b.name,120),mail=email(b.email),phone=clean(b.phone,30),notes=clean(b.notes,800);
 if(!uuid(b.class_id)||name.length<2||!mail||phone.replace(/\D/g,'').length<10)return error(res,400,'Enter a valid name, email, phone, and class.');
 try{
  const cls=await query('/rest/v1/rda_classes?id=eq.'+encodeURIComponent(b.class_id)+'&active=eq.true&visible=eq.true&select=id');
  if(!cls?.length)return error(res,400,'That class is not accepting requests.');
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const hash=crypto.createHmac('sha256',process.env.RDA_RATE_SALT).update(ip).digest('hex');
  await query('/rest/v1/rpc/rda_submit_request',{method:'POST',body:{p_class_id:b.class_id,p_name:name,p_email:mail,p_phone:phone,p_notes:notes,p_ip_hash:hash}});
  await notify();return res.status(202).json({ok:true,message:'Seat request received. We will contact you after review. No seat is confirmed yet.'});
 }catch(e){const limited=/too many requests/i.test(e.message);return error(res,limited?429:503,limited?'Too many requests. Please try later.':'Could not send your request. Please call or text 540-205-6500.');}
};
