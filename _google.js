
const crypto = require('crypto');

function base64url(input){
  return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
async function getAccessToken(){
  const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey=(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY||'').replace(/\\n/g,'\n');
  if(!email||!privateKey) throw new Error('Google service account not configured.');
  const now=Math.floor(Date.now()/1000);
  const h=base64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const c=base64url(JSON.stringify({
    iss:email,scope:'https://www.googleapis.com/auth/calendar',
    aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600
  }));
  const unsigned=`${h}.${c}`;
  const signer=crypto.createSign('RSA-SHA256'); signer.update(unsigned);
  const jwt=`${unsigned}.${base64url(signer.sign(privateKey))}`;
  const r=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt})
  });
  const d=await r.json();
  if(!r.ok) throw new Error(d.error_description||d.error||'Google token error');
  return d.access_token;
}
async function gcal(path,opts={}){
  const token=await getAccessToken();
  const r=await fetch('https://www.googleapis.com/calendar/v3'+path,{
    ...opts,
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(opts.headers||{})}
  });
  if(r.status===204)return null;
  const d=await r.json();
  if(!r.ok) throw new Error(d.error?.message||'Google Calendar API error');
  return d;
}
function calendarId(){return process.env.GOOGLE_CALENDAR_ID||'redlineautostylings@gmail.com'}
function authSecret(){return process.env.APPROVAL_SECRET||''}
function signSession(role='admin',user='Admin',username='admin'){
  const payload=Buffer.from(JSON.stringify({iat:Date.now(),exp:Date.now()+4*60*60*1000,nonce:crypto.randomBytes(12).toString('hex'),role,user,username})).toString('base64url');
  const sig=crypto.createHmac('sha256',authSecret()).update('crm-session:'+payload).digest('base64url');
  return payload+'.'+sig;
}
function verifySession(token){
  try{
    const [payload,sig]=String(token||'').split('.');
    if(!payload||!sig||authSecret().length<24)return null;
    const expected=crypto.createHmac('sha256',authSecret()).update('crm-session:'+payload).digest();
    const actual=Buffer.from(sig,'base64url');
    if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return null;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(!(data.exp>Date.now()&&data.iat<=Date.now()+60000))return null;
    return{role:['admin','sales','tech'].includes(data.role)?data.role:'admin',user:data.user||'User',username:data.username||''};
  }catch{return null}
}
function cookieValue(req,name){
  const header=String(req.headers?.cookie||'');
  for(const part of header.split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    if(part.slice(0,i).trim()===name)return decodeURIComponent(part.slice(i+1).trim());
  }
  return '';
}
function getAuth(req){
  return verifySession(cookieValue(req,'__Host-redline_session'));
}
function isAdmin(req){return getAuth(req)?.role==='admin'}
function hasRole(req,...roles){const auth=getAuth(req);return auth&&roles.includes(auth.role)?auth:null}
function signAdminSession(){return signSession('admin','Admin','admin')}
module.exports={gcal,calendarId,isAdmin,hasRole,getAuth,signSession,signAdminSession};
