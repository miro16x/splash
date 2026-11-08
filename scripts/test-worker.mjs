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

  // ---------- Supabase: saving quotes, staff replies, inbound email ----------
  const sbEnv = {...env, SUPABASE_URL:'https://sb.test', SUPABASE_ANON_KEY:'anon', SUPABASE_SERVICE_ROLE_KEY:'service', REPLY_DOMAIN:'splashanddash.uluxe.site'};
  const quoteId = '11111111-2222-4333-8444-555555555555';
  const customerId = '33333333-2222-4333-8444-555555555555', noEmailId = '44444444-2222-4333-8444-555555555555';
  let calls, staffRows, mails = [], alertRows = [];
  const fakeSupabase = async (url, options = {}) => {
    calls.push({url, method: options.method || 'GET', body: options.body, headers: options.headers});
    if (url === 'https://api.resend.com/emails') { mail = JSON.parse(options.body); mails.push(mail); return Response.json({id:'mail-id'}); }
    if (url === 'https://sb.test/rest/v1/rpc/staff_alert_emails') return Response.json(alertRows);
    if (url === 'https://sb.test/auth/v1/user') return options.headers.Authorization === 'Bearer good' ? Response.json({id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', email:'staff@example.com'}) : new Response('', {status:401});
    if (url.startsWith('https://sb.test/rest/v1/staff')) return Response.json(staffRows);
    if (url.startsWith('https://sb.test/rest/v1/customers?id=eq.') && !options.method) return Response.json(url.includes(customerId) ? [{id:customerId, name:'Marcus Hill', email:'marcus@example.com', phone:'(340) 555-0199'}] : url.includes(noEmailId) ? [{id:noEmailId, name:'Walk In', email:null, phone:'555'}] : []);
    if (url.startsWith('https://sb.test/rest/v1/quotes?id=eq.') && !options.method) return Response.json(url.includes(quoteId) ? [{id:quoteId, service:'vinyl', customer_name:'Dana Customer', email:'customer@example.com'}] : []);
    return new Response(null, {status: 201});
  };
  globalThis.fetch = fakeSupabase;

  calls = [];
  const saveForm = new FormData();
  for (const key of ['Customer Name','Phone #','Vehicle','Vehicle Type','Paint Color','Vehicles Condition']) saveForm.set(key,'test');
  saveForm.set('Service','Vinyl Wrap'); saveForm.set('Email','customer@example.com'); saveForm.set('Contact Consent','Yes');
  saveForm.set('attachment', new File(['image bytes'],'my car.jpg',{type:'image/jpeg'}));
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN},body:saveForm}),sbEnv)).status,200);
  const upload = calls.find(c => c.url.includes('/storage/v1/object/quote-files/'));
  assert(upload && upload.url.endsWith('/1-my_car.jpg') && upload.headers['Content-Type'] === 'image/jpeg');
  const saved = JSON.parse(calls.find(c => c.url === 'https://sb.test/rest/v1/quotes' && c.method === 'POST').body);
  assert.equal(saved.service,'vinyl'); assert.equal(saved.email,'customer@example.com'); assert.equal(saved.files[0].name,'my_car.jpg');
  assert(upload.url.includes(saved.id)); assert(mail.html.includes('staff.html#quote=' + saved.id));
  const customer = calls.find(c => c.url === 'https://sb.test/rest/v1/customers?on_conflict=email');
  assert(customer && customer.headers.Prefer.includes('ignore-duplicates'));
  assert.deepEqual(JSON.parse(customer.body), {name:'test', email:'customer@example.com', phone:'test', source:'quote'});

  // No one opted in: only the shop inbox email goes out.
  assert.equal(mails.length, 1);

  // New-quote alerts go to opted-in staff (not the shop inbox again), after the quote is saved.
  calls = []; mails = []; alertRows = ['ana@example.com', 'owner@example.com', 'ana@example.com', 'not-an-email'];
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN},body:saveForm}),sbEnv)).status,200);
  assert.equal(mails.length, 2);
  assert.deepEqual(mails[0].to, ['owner@example.com']);
  const alert = mails[1], alertedId = JSON.parse(calls.find(c => c.url === 'https://sb.test/rest/v1/quotes' && c.method === 'POST').body).id;
  assert.deepEqual(alert.to, ['ana@example.com']); assert.equal(alert.subject, 'New quote request from test (Vinyl Wrap)');
  assert(alert.html.includes('staff.html#quote=' + alertedId) && alert.text.includes('staff.html#quote=' + alertedId));
  assert(calls.findIndex(c => c.url.endsWith('/rpc/staff_alert_emails')) > calls.findIndex(c => c.url === 'https://sb.test/rest/v1/quotes'));
  // A broken alert lookup (e.g. the schema section not run yet) doesn't affect the submission or the saved customer.
  globalThis.fetch = async (url, options) => url.endsWith('/rpc/staff_alert_emails') ? new Response('missing', {status:404}) : fakeSupabase(url, options);
  calls = []; mails = [];
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN},body:saveForm}),sbEnv)).status,200);
  assert.equal(mails.length, 1); assert(calls.some(c => c.url === 'https://sb.test/rest/v1/customers?on_conflict=email'));
  globalThis.fetch = fakeSupabase; alertRows = [];

  // A failed save must not fail the customer's submission once the email went out.
  globalThis.fetch = async (url, options) => url.startsWith('https://sb.test') ? new Response('down', {status:500}) : fakeSupabase(url, options);
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN},body:saveForm}),sbEnv)).status,200);
  globalThis.fetch = fakeSupabase;

  const reply = (token, body) => worker.fetch(new Request(env.SITE_ORIGIN+'/api/staff/reply',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token} : {})},body:JSON.stringify(body)}),sbEnv);
  calls = []; staffRows = [{user_id:'x'}];
  assert.equal((await reply(null, {quoteId, message:'hi'})).status,401);
  assert.equal((await reply('bad', {quoteId, message:'hi'})).status,401);
  staffRows = [];
  assert.equal((await reply('good', {quoteId, message:'hi'})).status,401);
  staffRows = [{user_id:'x'}];
  assert.equal((await reply('good', {quoteId, message:''})).status,400);
  assert.equal((await reply('good', {quoteId:'22222222-2222-4333-8444-555555555555', message:'hi'})).status,404);
  assert.equal((await reply('good', {quoteId:'1 or 1=1', message:'hi'})).status,404);
  calls = [];
  assert.equal((await reply('good', {quoteId, message:'Hi <Dana>,\nYour wrap is $1,400.'})).status,200);
  assert.deepEqual(mail.to,['customer@example.com']); assert.equal(mail.reply_to,`reply+${quoteId}@splashanddash.uluxe.site`);
  assert.equal(mail.subject,'Your Splash and Dash vinyl wrap quote'); assert(mail.html.includes('Hi &lt;Dana&gt;'));
  const outbound = JSON.parse(calls.find(c => c.url === 'https://sb.test/rest/v1/quote_messages').body);
  assert.equal(outbound.direction,'outbound'); assert.equal(outbound.author,'staff@example.com');
  assert.equal(JSON.parse(calls.find(c => c.method === 'PATCH').body).status,'waiting');
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/staff/reply',{method:'POST',headers:{Origin:'https://other.test'}}),sbEnv)).status,403);

  // Quote PDFs from the staff page's templates
  const pdfContent = Buffer.from('%PDF-1.7 test quote').toString('base64');
  const quoteDoc = {number:'VW-261103-1111', total:3650, deposit:500, validThrough:'2026-12-03'};
  calls = [];
  assert.equal((await reply('good', {quoteId, message:'Your quote is attached.', attachment:{filename:'Vinyl-Wrap-Quote-VW-261103-1111.pdf', content:pdfContent}, document:quoteDoc})).status,200);
  assert.deepEqual(mail.attachments,[{filename:'Vinyl-Wrap-Quote-VW-261103-1111.pdf', content:pdfContent}]);
  const pdfUpload = calls.find(c => c.url.includes('/storage/v1/object/quote-files/'+quoteId+'/sent/'));
  assert(pdfUpload && pdfUpload.headers['Content-Type'] === 'application/pdf');
  const withPdf = JSON.parse(calls.find(c => c.url === 'https://sb.test/rest/v1/quote_messages').body);
  assert.equal(withPdf.attachment.name,'Vinyl-Wrap-Quote-VW-261103-1111.pdf'); assert.deepEqual(withPdf.document, quoteDoc);
  for (const attachment of [{filename:'quote.exe', content:pdfContent}, {filename:'q.pdf', content:Buffer.from('<html>').toString('base64')}, {filename:'q.pdf', content:'%%%not base64'}, {filename:'../q.pdf', content:pdfContent}]) {
    assert.equal((await reply('good', {quoteId, message:'hi', attachment})).status,400);
  }
  // A failed PDF copy still records the sent quote, just without a download link.
  globalThis.fetch = async (url, options) => url.includes('/storage/') ? new Response('down', {status:500}) : fakeSupabase(url, options);
  calls = [];
  assert.equal((await reply('good', {quoteId, message:'Attached.', attachment:{filename:'q.pdf', content:pdfContent}, document:quoteDoc})).status,200);
  const noCopy = JSON.parse(calls.find(c => c.url === 'https://sb.test/rest/v1/quote_messages').body);
  assert.equal(noCopy.attachment, undefined); assert.equal(noCopy.document.number,'VW-261103-1111');
  globalThis.fetch = fakeSupabase;

  // Quotes started from the customer list
  const staffQuote = (token, body) => worker.fetch(new Request(env.SITE_ORIGIN+'/api/staff/quote',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json',...(token ? {Authorization:'Bearer '+token} : {})},body:JSON.stringify(body)}),sbEnv);
  const quoteBody = {customerId, service:'other', message:'Your quote is attached.', attachment:{filename:'Service-Quote-SQ-261105-3333.pdf', content:pdfContent}, document:{number:'SQ-261105-3333', total:900, deposit:0, validThrough:'2026-12-05'}};
  staffRows = [{user_id:'x'}];
  assert.equal((await staffQuote(null, quoteBody)).status,401);
  assert.equal((await staffQuote('good', {...quoteBody, service:'wash'})).status,400);
  assert.equal((await staffQuote('good', {...quoteBody, attachment:undefined})).status,400);
  assert.equal((await staffQuote('good', {...quoteBody, customerId:'55555555-2222-4333-8444-555555555555'})).status,404);
  assert.equal((await staffQuote('good', {...quoteBody, customerId:noEmailId})).status,400);
  calls = []; mail = null;
  const created = await staffQuote('good', quoteBody);
  assert.equal(created.status,200);
  const newQuoteId = (await created.json()).quoteId;
  assert.deepEqual(mail.to,['marcus@example.com']); assert.equal(mail.reply_to,`reply+${newQuoteId}@splashanddash.uluxe.site`);
  assert.equal(mail.subject,'Your Splash and Dash quote'); assert.equal(mail.attachments[0].filename,'Service-Quote-SQ-261105-3333.pdf');
  const newQuote = JSON.parse(calls.find(c => c.url === 'https://sb.test/rest/v1/quotes' && c.method === 'POST').body);
  assert.equal(newQuote.id,newQuoteId); assert.equal(newQuote.service,'other'); assert.equal(newQuote.status,'waiting'); assert.equal(newQuote.email,'marcus@example.com');
  const newMessage = JSON.parse(calls.find(c => c.url === 'https://sb.test/rest/v1/quote_messages').body);
  assert.equal(newMessage.quote_id,newQuoteId); assert.equal(newMessage.document.number,'SQ-261105-3333');
  const logged = JSON.parse(calls.find(c => c.url === 'https://sb.test/rest/v1/customer_contacts').body);
  assert.equal(logged.customer_id,customerId); assert.equal(logged.method,'email'); assert.equal(logged.author,'staff@example.com');
  // Nothing is saved when the email can't be sent.
  globalThis.fetch = async (url, options) => url === 'https://api.resend.com/emails' ? Response.json({error:'fail'},{status:500}) : fakeSupabase(url, options);
  calls = [];
  assert.equal((await staffQuote('good', quoteBody)).status,502);
  assert(!calls.some(c => c.method === 'POST' && c.url.startsWith('https://sb.test/rest/v1/')));
  globalThis.fetch = fakeSupabase;

  const config = await (await worker.fetch(new Request(env.SITE_ORIGIN+'/api/staff/config'),sbEnv)).json();
  assert.equal(config.supabaseAnonKey,'anon'); assert(!JSON.stringify(config).includes('service'));
  assert.equal((await worker.fetch(new Request(env.SITE_ORIGIN+'/api/staff/config'),env)).status,503);

  const raw = s => new Response(s).body;
  const inbound = (to, text) => { const forwarded = []; return {forwarded, message:{to, from:'customer@example.com', raw: raw(`From: customer@example.com\r\nTo: ${to}\r\nSubject: Re: Your quote\r\nContent-Type: text/plain\r\n\r\n${text}`), forward: async address => { forwarded.push(address); }}}; };
  calls = []; mail = null;
  const known = inbound(`reply+${quoteId}@splashanddash.uluxe.site`, 'Sounds great, Tuesday works.\r\n\r\nOn Mon, Nov 2, 2026 at 9:00 AM Splash and Dash <quotes@example.com> wrote:\r\n> Hi Dana');
  await worker.email(known.message, sbEnv);
  const saved_in = JSON.parse(calls.find(c => c.url === 'https://sb.test/rest/v1/quote_messages').body);
  assert.equal(saved_in.direction,'inbound'); assert.equal(saved_in.body,'Sounds great, Tuesday works.');
  assert.equal(JSON.parse(calls.find(c => c.method === 'PATCH').body).status,'open');
  assert.deepEqual(mail.to,['owner@example.com']); assert(mail.subject.includes('Dana Customer')); assert(mail.text.includes('staff.html#quote='+quoteId));
  assert.equal(known.forwarded.length,0);
  for (const to of ['hello@splashanddash.uluxe.site', 'reply+22222222-2222-4333-8444-555555555555@splashanddash.uluxe.site']) {
    const other = inbound(to, 'hello'); await worker.email(other.message, sbEnv); assert.deepEqual(other.forwarded,['owner@example.com']);
  }
  globalThis.fetch = async () => new Response('down', {status:500});
  const failing = inbound(`reply+${quoteId}@splashanddash.uluxe.site`, 'hello'); await worker.email(failing.message, sbEnv);
  assert.deepEqual(failing.forwarded,['owner@example.com']);
  console.log('Passed: quote saving with photos, new-quote staff alerts, save failures, staff reply auth and sending, customer-list quotes, config, inbound replies, forwarding.');
} finally {globalThis.fetch=realFetch}
