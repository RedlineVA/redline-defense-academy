'use strict';
const {ready,common,error,query}=require('../lib/rda-backend');
module.exports=async(req,res)=>{common(res);if(req.method!=='GET')return error(res,405,'Method not allowed.');
 if(!ready())return error(res,503,'Online reservations are not yet available. Please call or text 540-205-6500.');
 try{
  const classes=await query('/rest/v1/rpc/rda_public_classes',{method:'POST',body:{}});
  return res.status(200).json({classes:classes||[]});
 }catch{return error(res,503,'Online booking is unavailable right now. Please call or text 540-205-6500.')};
};
