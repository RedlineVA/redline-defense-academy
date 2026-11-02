'use strict';
const crypto=require('node:crypto');
function ready(){return !!(process.env.RDA_SUPABASE_URL&&process.env.RDA_SUPABASE_SERVICE_KEY&&process.env.RDA_SUPABASE_ANON_KEY&&process.env.RDA_RATE_SALT)}
function common(res){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer')}
function error(res,status,message){return res.status(status).json({error:message})}
function sameOrigin(req){try{const origin=req.headers.origin;const host=req.headers.host;return !origin||new URL(origin).host===host}catch{return false}}
function clean(v,max=200){return String(v||'').trim().slice(0,max)}
function email(v){const x=clean(v,254).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)?x:''}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
function cents(v){const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=100000000?n:null}
async function query(path,opts={}){
 if(!ready())throw Object.assign(new Error('Enrollment storage is not configured.'),{status:503});
 const url=process.env.RDA_SUPABASE_URL.replace(/\/$/,'')+path,key=process.env.RDA_SUPABASE_SERVICE_KEY;
 const resp=await fetch(url,{method:opts.method||'GET',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:opts.body===undefined?undefined:JSON.stringify(opts.body)});
 const raw=await resp.text();let parsed;try{parsed=raw?JSON.parse(raw):null}catch{parsed=null}
 if(!resp.ok)throw Object.assign(new Error(parsed?.message||parsed?.error||'Storage error'),{status:resp.status});
 return parsed;
}
async function auth(body,grant){
 if(!ready())throw Object.assign(new Error('Admin setup is incomplete.'),{status:503});
 const res=await fetch(process.env.RDA_SUPABASE_URL.replace(/\/$/,'')+'/auth/v1/token?grant_type='+grant,{method:'POST',headers:{apikey:process.env.RDA_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const o=await res.json().catch(()=>({}));if(!res.ok||!o.access_token)throw Object.assign(new Error('Login failed. Check credentials.'),{status:401});return o;
}
async function requireAdmin(accessToken){
 if(!accessToken)throw Object.assign(new Error('Please log in.'),{status:401});
 const res=await fetch(process.env.RDA_SUPABASE_URL.replace(/\/$/,'')+'/auth/v1/user',{headers:{apikey:process.env.RDA_SUPABASE_ANON_KEY,Authorization:'Bearer '+accessToken}});
 if(!res.ok)throw Object.assign(new Error('Session expired. Please log in.'),{status:401});
 const user=await res.json();if(!uuid(user.id)||!user.email_confirmed_at)throw Object.assign(new Error('Verify your admin account before logging in.'),{status:403});
 const a=await query('/rest/v1/rda_admins?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id');
 if(!a?.length)throw Object.assign(new Error('This account does not have admin access.'),{status:403});
 return user;
}
function bearer(req){const v=String(req.headers.authorization||'');return v.startsWith('Bearer ')?v.slice(7):''}
async function notify(){
 if(!(process.env.RESEND_API_KEY&&process.env.RDA_NOTIFY_EMAIL&&process.env.RDA_FROM_EMAIL))return false;
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.RESEND_API_KEY},body:JSON.stringify({from:process.env.RDA_FROM_EMAIL,to:[process.env.RDA_NOTIFY_EMAIL],subject:'Redline Defense Academy: new seat request',text:'A class request is waiting in your secure Redline Defense dashboard: https://www.redlinedefenseacademy.com/admin/'})});return response.ok}catch{return false}
}
module.exports={crypto,ready,common,error,sameOrigin,clean,email,uuid,cents,query,auth,requireAdmin,bearer,notify};
