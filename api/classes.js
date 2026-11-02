'use strict';
const {ready,common,error,query}=require('../lib/rda-backend');
module.exports=async(req,res)=>{common(res);if(req.method!=='GET')return error(res,405,'Method not allowed.');
 if(!ready())return error(res,503,'Online reservations are not yet available. Please call or text 540-205-6500.');
 try{
  const now=encodeURIComponent(new Date().toISOString());
  const classes=await query('/rest/v1/rda_classes?select=id,title,starts_at,location,capacity,price_cents,deposit_cents&active=eq.true&visible=eq.true&starts_at=gte.'+now+'&order=starts_at.asc');
  return res.status(200).json({classes:classes||[]});
 }catch{return error(res,503,'Online booking is unavailable right now. Please call or text 540-205-6500.')};
};
