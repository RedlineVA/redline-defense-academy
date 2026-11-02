'use strict';
const {publicSchedule}=require('../lib/rda-calendar');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(req.method!=='GET')return res.status(405).json({error:'GET required.'});
 try{
  const classes=await publicSchedule();
  return res.status(200).json({classes:classes.map(c=>({
   id:c.id,title:c.title,starts_at:c.starts_at,location:c.location,
   capacity:c.capacity,price_cents:c.price_cents,deposit_cents:c.deposit_cents,
   confirmed_seats:c.confirmed_seats,seats_remaining:c.seats_remaining,sold_out:c.sold_out
  }))});
 }catch(e){
  console.error('Public class schedule unavailable:',e?.message||e);
  return res.status(503).json({error:'Class calendar is temporarily unavailable. Please call or text 540-205-6500.'});
 }
};
