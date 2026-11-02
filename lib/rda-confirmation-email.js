'use strict';
function gmailConfigured(){return !!(process.env.RDA_GMAIL_USER&&process.env.RDA_GMAIL_APP_PASSWORD)}
function resendConfigured(){return !!(process.env.RDA_RESEND_API_KEY&&process.env.RDA_FROM_EMAIL)}
function configured(){return gmailConfigured()||resendConfigured()}
function money(c){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(c||0)/100)}
function time(v){return new Date(v).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'full',timeStyle:'short'})+' Eastern Time'}
function clean(s){return String(s||'').replace(/[\r\n\t]/g,' ').trim()}
function html(s){return clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function compose(student,cls,totalPaid){
 const lines=[
  'Hello '+clean(student.full_name)+',','',
  'Your deposit is confirmed and your seat is reserved with Redline Defense Academy.','',
  'Course: '+clean(cls.title),
  'Date & time: '+time(cls.starts_at),
  'Location: '+(clean(cls.location)||'Location and arrival details will be provided separately.'),
  'Selected price: '+clean(student.offer_label||'Regular Seat'),
  'Seats reserved: '+(Number(student.party_size)===2?'2 (You + '+clean(student.friend_name||'Guest')+')':'1'),
  'Course price: '+money(Number.isInteger(student.price_total_cents)?student.price_total_cents:cls.price_cents),
  'Total received: '+money(totalPaid),
  'Remaining balance: '+money(Math.max(0,Number.isInteger(student.price_total_cents)?student.price_total_cents-Number(totalPaid):Number(cls.price_cents)-Number(totalPaid))),'',
  'Your instructor will share any additional class-specific preparation details.',
  'Questions? Call or text 540-205-6500.','','Train • Prepare • Protect','Redline Defense Academy'
 ];
 return {subject:'Seat Confirmed — '+clean(cls.title)+' | Redline Defense Academy',text:lines.join('\n'),
 html:'<div style="background:#111820;color:#f2f5f7;padding:30px;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;background:#1c252e;padding:27px;border-top:5px solid #d9252d"><h2>Your Seat Is Confirmed</h2><p style="line-height:1.8">'+lines.map(x=>x?html(x):'&nbsp;').join('<br>')+'</p></div></div>'};
}
async function send(student,cls,totalPaid){
 if(!configured())return {ok:false,code:'not_configured'};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email||''))return {ok:false,code:'invalid_email'};
 const m=compose(student,cls,totalPaid);
 if(gmailConfigured()){
  try{
   const nodemailer=require('nodemailer');
   const transport=nodemailer.createTransport({service:'gmail',auth:{user:process.env.RDA_GMAIL_USER,pass:process.env.RDA_GMAIL_APP_PASSWORD}});
   const result=await transport.sendMail({
    from:'Redline Defense Academy <'+process.env.RDA_GMAIL_USER+'>',
    to:student.email,subject:m.subject,text:m.text,html:m.html
   });
   return result.accepted?.includes(student.email)?{ok:true,id:result.messageId||''}:{ok:false,code:'email_failed'};
  }catch{return {ok:false,code:'email_failed'}}
 }
 try{
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
   Authorization:'Bearer '+process.env.RDA_RESEND_API_KEY,'Content-Type':'application/json',
   'Idempotency-Key':'rda-confirm-'+student.id
  },body:JSON.stringify({from:process.env.RDA_FROM_EMAIL,to:[student.email],subject:m.subject,text:m.text,html:m.html})});
  const data=await r.json().catch(()=>({}));
  return r.ok&&data.id?{ok:true,id:String(data.id)}:{ok:false,code:'email_failed'};
 }catch{return {ok:false,code:'email_failed'}}
}
module.exports={configured,compose,send};
