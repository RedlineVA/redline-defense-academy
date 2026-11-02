const crypto=require('crypto');

const buckets=globalThis.__redlineRateBuckets||new Map();
globalThis.__redlineRateBuckets=buckets;

function clientIp(req){
  const forwarded=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim();
  return forwarded||String(req.headers?.['x-real-ip']||req.socket?.remoteAddress||'unknown');
}
function bucketKey(req,scope){
  return crypto.createHash('sha256').update(String(scope)+'|'+clientIp(req)).digest('hex');
}
function enforceRateLimit(req,res,scope,limit,windowMs){
  const now=Date.now(),key=bucketKey(req,scope),current=buckets.get(key);
  const state=!current||current.resetAt<=now?{count:0,resetAt:now+windowMs}:current;
  if(state.count>=limit){
    const retry=Math.max(1,Math.ceil((state.resetAt-now)/1000));
    res.setHeader('Retry-After',String(retry));
    res.setHeader('Cache-Control','no-store');
    res.status(429).json({error:'Too many requests. Please wait and try again.'});
    return false;
  }
  state.count+=1;buckets.set(key,state);
  if(buckets.size>5000){
    for(const [k,v] of buckets){if(v.resetAt<=now)buckets.delete(k);if(buckets.size<=3500)break}
  }
  return true;
}
function cleanText(value,max=250){
  return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
}
function validEmail(value){
  const s=cleanText(value,254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:'';
}
function validPhone(value){
  const s=cleanText(value,40);
  const digits=s.replace(/\D/g,'');
  return digits.length>=7&&digits.length<=15?s:'';
}
function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function requestHost(req){
  return String(req.headers?.['x-forwarded-host']||req.headers?.host||'').split(',')[0].trim().toLowerCase();
}
function enforceSameOrigin(req,res){
  if(['GET','HEAD','OPTIONS'].includes(String(req.method||'GET').toUpperCase()))return true;
  const host=requestHost(req),origin=String(req.headers?.origin||'').trim(),referer=String(req.headers?.referer||'').trim(),site=String(req.headers?.['sec-fetch-site']||'').trim().toLowerCase();
  let ok=false;
  try{if(origin){const u=new URL(origin);ok=u.protocol==='https:'&&u.host.toLowerCase()===host}}catch{}
  if(!origin&&site==='same-origin')ok=true;
  if(!origin&&!site&&referer){try{const u=new URL(referer);ok=u.protocol==='https:'&&u.host.toLowerCase()===host}catch{}}
  if(ok)return true;
  res.setHeader('Cache-Control','no-store');
  res.status(403).json({error:'Request origin was not accepted.'});
  return false;
}
module.exports={enforceRateLimit,enforceSameOrigin,cleanText,validEmail,validPhone,escapeHtml};
