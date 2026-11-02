'use strict';
const {publicClasses}=require('../lib/rda-calendar');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'GET required.'});
 try{const list=await publicClasses();return res.status(200).json({classes:list.map(x=>({id:x.id,title:x.title,starts_at:x.starts_at,location:x.location,capacity:x.capacity,price_cents:x.price_cents,deposit_cents:x.deposit_cents}))})}
 catch(e){return res.status(503).json({error:'Online booking is temporarily unavailable. Please call or text 540-205-6500.'})}
};
