import assert from 'node:assert/strict';
import worker from '../worker.mjs';
const env = {SITE_ORIGIN:'https://splashanddash.uluxe.site', RESEND_API_KEY:'test', QUOTE_FROM:'quotes@example.com',QUOTE_TO:'owner@example.com',QUOTE_LIMITER:{limit:async()=>({success:true})},ASSETS:{fetch:async()=>new Response('asset')}};
const realFetch=globalThis.fetch; let mail;
try {
  for (const service of ['Paint Correction','Ceramic Coating','Vinyl Wrap']) for (const photo of [false,true]) {
    const form=new FormData();
    for(const key of ['Service','Customer Name','Phone #','Vehicle','Vehicle Type','Paint Color','Vehicles Condition']) form.set(key,'<test>');
    form.set('Service',service);
    form.set('Email','customer@example.com');form.set('Contact Consent','Yes');
    if(photo)form.set('attachment',new File(['image bytes'],'car.jpg',{type:'image/jpeg'}));
    globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');mail=JSON.parse(options.body);return Response.json({id:'test-id'})};
    const response=await worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN},body:form}),env);
    assert.equal(response.status,200);
    assert.equal(mail.attachments.length,photo ? 1 : 0);
    if(photo) {
      assert.equal(mail.attachments[0].filename,'car.jpg');
      assert.equal(Buffer.from(mail.attachments[0].content,'base64').toString(),'image bytes');
    }
    assert(!mail.html.includes('/api/quote-files/'));
    assert(!mail.text.includes('/api/quote-files/'));
    assert(mail.html.includes('&lt;test&gt;'));assert(mail.html.includes('brand-logo-512.png'));assert.equal(mail.reply_to,'customer@example.com');
    globalThis.fetch=async()=>Response.json({error:'fail'},{status:500});
    assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN},body:form}),env)).status,502);
  }
  const artworkForm = new FormData();
  for (const key of ['Service','Customer Name','Phone #','Vehicle','Vehicle Type','Paint Color','Vehicles Condition']) artworkForm.set(key,'test');
  artworkForm.set('Email','customer@example.com'); artworkForm.set('Contact Consent','Yes');
  artworkForm.set('artwork',new File(['artwork bytes'],'design.pdf',{type:'application/pdf'}));
  const submit = targetEnv => worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN},body:artworkForm}),targetEnv);
  globalThis.fetch=async(url,options)=>{mail=JSON.parse(options.body);return Response.json({id:'artwork-id'})};
  assert.equal((await submit(env)).status,200);
  assert.equal(mail.attachments[0].filename,'design.pdf');
  assert.equal(Buffer.from(mail.attachments[0].content,'base64').toString(),'artwork bytes');
  artworkForm.set('artwork',new File(['bad'],'bad.svg',{type:'image/svg+xml'}));
  assert.equal((await submit(env)).status,400);
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/'),env)).status,200);
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:'https://other.test'}}),env)).status,403);
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote-files/'+'a'.repeat(32)),env)).status,404);
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote-files/invalid'),env)).status,404);
  console.log('Passed: all three services, optional photos, attachment bytes, artwork, unsupported types, assets, origin, escaped HTML, logo, reply-to, provider failures.');
} finally {globalThis.fetch=realFetch}
