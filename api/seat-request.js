'use strict';
const {str,id,publicClasses,create,validEmail,validPhone}=require('../lib/rda-calendar');
const {enforceRateLimit,enforceSameOrigin}=require('../_security');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'POST required.'});
 if(!enforceSameOrigin(req,res))return;
 if(!enforceRateLimit(req,res,'rda-seat-request',3,30*60*1000))return;
 const b=req.body||{};
 if(b.website)return res.status(202).json({ok:true});
 const name=str(b.name,120),mail=validEmail(b.email),phone=validPhone(b.phone),notes=str(b.notes,800),classId=id(b.class_id);
 if(name.length<2||!mail||!phone||!classId)return res.status(400).json({error:'Enter your name, email, phone and selected class.'});
 try{
  const options=await publicClasses();
  if(!options.some(c=>c.id===classId))return res.status(400).json({error:'This class is not accepting seat requests.'});
  await create('request',{class_id:classId,full_name:name,email:mail,phone,notes,status:'requested'});
  return res.status(202).json({ok:true,message:'Seat request received. A seat is not confirmed until the academy approves it.'});
 }catch{return res.status(503).json({error:'Could not send your request. Please call or text 540-205-6500.'})}
};
