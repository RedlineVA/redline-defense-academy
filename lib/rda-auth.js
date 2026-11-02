'use strict';
const crypto=require('node:crypto');
const {enforceRateLimit,enforceSameOrigin}=require('../_security');
function configured(){return !!(process.env.RDA_ADMIN_PASSWORD_HASH&&process.env.RDA_AUTH_SECRET&&process.env.RDA_ADMIN_EMAIL)}
function cookieValue(req){const header=String(req.headers?.cookie||'');for(const seg of header.split(';')){const i=seg.indexOf('=');if(i>0&&seg.slice(0,i).trim()==='__Host-rda_session')return decodeURIComponent(seg.slice(i+1).trim())}return ''}
function mac(s){return crypto.createHmac('sha256',process.env.RDA_AUTH_SECRET).update('rda-session:'+s).digest()}
function issue(){
 const payload=Buffer.from(JSON.stringify({exp:Date.now()+4*60*60*1000,nonce:crypto.randomBytes(16).toString('hex')})).toString('base64url');
 return payload+'.'+mac(payload).toString('base64url');
}
function isAdmin(req){
 if(!configured())return false;
 try{const [p,s]=cookieValue(req).split('.');if(!p||!s||p.length>500)return false;const sig=Buffer.from(s,'base64url');if(sig.length!==32||!crypto.timingSafeEqual(sig,mac(p)))return false;const j=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));return typeof j.exp==='number'&&j.exp>Date.now()}catch{return false}
}
function verifyPassword(password){
 if(!configured())return false;try{const [salt,expected]=process.env.RDA_ADMIN_PASSWORD_HASH.split(':');if(!/^[a-f0-9]{48}$/.test(salt)||!/^[a-f0-9]{64}$/.test(expected))return false;const want=Buffer.from(expected,'hex');const actual=crypto.pbkdf2Sync(String(password||''),Buffer.from(salt,'hex'),250000,32,'sha256');return crypto.timingSafeEqual(actual,want)}catch{return false}
}
function login(res){res.setHeader('Set-Cookie','__Host-rda_session='+encodeURIComponent(issue())+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=14400')}
function logout(res){res.setHeader('Set-Cookie','__Host-rda_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0')}
function json(res,status,obj){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(obj)}
module.exports={configured,isAdmin,verifyPassword,login,logout,json,enforceRateLimit,enforceSameOrigin};
