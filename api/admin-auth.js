'use strict';
const a=require('../lib/rda-auth');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return a.json(res,405,{error:'POST required'});
 if(!a.enforceSameOrigin(req,res))return;
 const body=req.body||{},action=body.action;
 if(action==='session')return a.isAdmin(req)?a.json(res,200,{ok:true,role:'admin',user:'Defense Admin'}):a.json(res,401,{error:'Not signed in.'});
 if(action==='logout'){a.logout(res);return a.json(res,200,{ok:true})}
 if(action==='login'){
  if(!a.enforceRateLimit(req,res,'rda-admin-login',7,15*60*1000))return;
  if(!a.configured())return a.json(res,503,{error:'The Defense login is not configured yet.'});
  const email=String(body.email||'').trim().toLowerCase();
  const password=String(body.password||'');
  if(email!==String(process.env.RDA_ADMIN_EMAIL||'').trim().toLowerCase()||password.length>300||!a.verifyPassword(password))return a.json(res,401,{error:'Incorrect email or password.'});
  a.login(res);return a.json(res,200,{ok:true,role:'admin',user:'Defense Admin',expiresIn:14400});
 }
 return a.json(res,400,{error:'Unknown login action.'});
};
