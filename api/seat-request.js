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
  const cls=options.find(c=>c.id===classId);
  if(!cls)return res.status(400).json({error:'This class is not accepting seat requests.'});
  const selected=cls.offers.find(o=>o.id===(str(b.offer_id,20)||'regular'));
  if(!selected||selected.sold_out)return res.status(409).json({error:'That price is no longer available. Please refresh the schedule.'});
  const friend=str(b.friend_name,120);
  if(selected.group_size===2&&friend.length<2)return res.status(400).json({error:'Enter the name of the friend attending with you.'});
  await create('request',{class_id:classId,full_name:name,email:mail,phone,notes,status:'requested',
   offer_id:selected.id,offer_label:selected.label,party_size:selected.group_size,
   friend_name:selected.group_size===2?friend:'',price_total_cents:selected.price_cents,deposit_due_cents:selected.deposit_cents});
  return res.status(202).json({ok:true,message:'Seat request received. A seat is not confirmed until the academy approves it.'});
 }catch(error){return res.status(error?.status===400?409:503).json({error:error?.status===400?error.message:'Could not send your request. Please call or text 540-205-6500.'})}
};
