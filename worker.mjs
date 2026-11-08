import PostalMime from 'postal-mime';

const json = (status, message, extra) => Response.json({ success: status === 200, message, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = ['Service','Customer Name','Phone #','Email','Vehicle','Vehicle Type','Paint Color','Vehicles Condition','Correction Level','Correction Protection','Paint Conditions','Previous Paintwork','Ceramic Tier','Ceramic Package','Ceramic Add-ons','Ceramic Surface Concerns','Wrap Color','Requested Color / Finish','Preferred Film','Wrap Coverage','Selected Panels','Wrap Options','Inspection Date','Additional Info','Contact Consent','Visualizer Estimate'];
const services = {'Paint Correction':'correction','Ceramic Coating':'ceramic','Vinyl Wrap':'vinyl'};
const serviceNames = {correction:'paint correction', ceramic:'ceramic coating', vinyl:'vinyl wrap', other:''};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const logo = '<p style="text-align:center;margin-top:28px"><img src="https://splashanddash.uluxe.site/images/brand-logo-512.png" width="256" alt="Splash and Dash Car Wash and Auto Detail Center" style="max-width:100%;height:auto"></p>';
function base64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

// ---------- Supabase (REST, service-role key; bypasses RLS) ----------
const supabaseReady = env => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
async function sb(env, path, init = {}) {
  const response = await fetch(env.SUPABASE_URL + path, {
    ...init, signal: AbortSignal.timeout(15000),
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...init.headers }
  });
  if (!response.ok) throw new Error(`Supabase ${path} ${response.status}`);
  return response;
}
const sbInsert = (env, table, row) => sb(env, `/rest/v1/${table}`, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) });
const sbPatchQuote = (env, id, patch) => sb(env, `/rest/v1/quotes?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
async function sbQuote(env, id) {
  if (!uuid.test(id)) return null;
  const rows = await (await sb(env, `/rest/v1/quotes?id=eq.${id}&select=id,service,customer_name,email`)).json();
  return rows[0] || null;
}

function sendEmail(env, message) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST', headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
    signal: AbortSignal.timeout(25000), body: JSON.stringify({ from: env.QUOTE_FROM, ...message })
  });
}
// Each quote gets its own reply address so customer replies land back in that quote's conversation.
const replyAddress = (env, id) => env.REPLY_DOMAIN ? `reply+${id}@${env.REPLY_DOMAIN}` : env.QUOTE_TO;
const staffLink = (env, id) => `${env.SITE_ORIGIN}/staff.html#quote=${id}`;

async function handleQuote(request, env) {
  if (request.method !== 'POST') return json(405, 'Use POST');
  if (request.headers.get('Origin') !== env.SITE_ORIGIN) return json(403, 'Invalid origin');
  if (!env.RESEND_API_KEY || !env.QUOTE_FROM) return json(503, 'Email is not configured yet');
  if (!env.QUOTE_LIMITER) return json(503, 'Submission protection is not configured');
  if (!(await env.QUOTE_LIMITER.limit({key: request.headers.get('CF-Connecting-IP') || 'unknown'})).success) return json(429, 'Please wait before trying again');
  if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data')) return json(415, 'Use multipart form data');
  try {
    // Bound the request before parsing uploads, including chunked requests.
    const reader = request.body.getReader();
    const chunks = []; let size = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 11 * 1024 * 1024) { await reader.cancel(); return json(413, 'Uploads are too large'); }
      chunks.push(value);
    }
    const form = await new Response(new Blob(chunks), {headers: {'Content-Type': request.headers.get('Content-Type')}}).formData();
    const get = key => typeof form.get(key) === 'string' ? form.get(key).trim() : '';
    if (get('website')) return json(400, 'Invalid submission');
    for (const field of ['Service','Customer Name','Phone #','Email','Vehicle','Vehicle Type','Paint Color','Vehicles Condition']) {
      if (!get(field)) return json(400, 'Please complete required fields');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get('Email')) || get('Contact Consent') !== 'Yes') return json(400, 'Invalid email or missing consent');
    const rows = [];
    for (const key of labels) {
      const value = get(key);
      if (value.length > 5000) return json(400, 'A field is too long');
      if (value) rows.push([key, value]);
    }
    const attachments = [], uploads = []; let uploaded = 0;
    for (const name of ['attachment','artwork']) {
      for (const file of form.getAll(name)) {
        if (typeof file === 'string' || !file.size) continue;
        uploaded += file.size;
        if (uploaded > 10 * 1024 * 1024) return json(413, 'Uploads must total 10 MB or less');
        const allowed = name === 'attachment' ? ['image/jpeg','image/png'] : ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
        if (!allowed.includes(file.type)) return json(400, 'Unsupported attachment type');
        const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload';
        const bytes = new Uint8Array(await file.arrayBuffer());
        attachments.push({ filename, content: base64(bytes) });
        uploads.push({ filename, type: file.type, bytes });
      }
    }
    const id = crypto.randomUUID();
    const saving = supabaseReady(env);
    const staffRow = saving ? [['Staff Page', staffLink(env, id)]] : [];
    const result = await sendEmail(env, {
      to: [env.QUOTE_TO], reply_to: get('Email'), subject: 'Splash and Dash Quote Request',
      text: rows.concat(staffRow).map(([key,value]) => `${key}: ${value}`).join('\n'),
      html: `<div style="font-family:Arial,sans-serif;color:#0a3b73;max-width:640px;margin:auto"><h1>Splash and Dash Quote Request</h1><table cellpadding="10" style="border-collapse:collapse;width:100%">${rows.map(([key,value])=>`<tr><th align="left" style="border-bottom:1px solid #ddd">${escape(key)}</th><td style="border-bottom:1px solid #ddd;white-space:pre-wrap">${escape(value)}</td></tr>`).join('')}</table>${saving ? `<p><a href="${escape(staffLink(env, id))}">Open this quote on the staff page</a></p>` : ''}${logo}</div>`,
      attachments
    });
    if (!result.ok) return json(502, 'Email provider could not accept the request');
    const sent = await result.json();
    if (!sent.id) return json(502, 'Email acceptance was not confirmed');
    // The email is the customer's confirmation; a failed save is logged rather than failing the submission.
    if (saving) {
      try {
        const files = [];
        for (const [i, upload] of uploads.entries()) {
          const path = `${id}/${i + 1}-${upload.filename}`;
          await sb(env, `/storage/v1/object/quote-files/${path}`, { method: 'POST', headers: { 'Content-Type': upload.type }, body: upload.bytes });
          files.push({ path, name: upload.filename, type: upload.type });
        }
        await sbInsert(env, 'quotes', {
          id, service: services[get('Service')] || 'other', customer_name: get('Customer Name'), email: get('Email'),
          phone: get('Phone #'), vehicle: get('Vehicle'), fields: rows, files
        });
        try { await alertStaff(env, id, get); } catch (error) { console.error('Staff alert failed', id, error); }
      } catch (error) { console.error('Quote save failed', id, error); }
      // Add the sender to the staff customer list; someone already on it keeps their stage and notes.
      try {
        await sb(env, '/rest/v1/customers?on_conflict=email', {
          method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({ name: get('Customer Name'), email: get('Email').toLowerCase(), phone: get('Phone #'), source: 'quote' })
        });
      } catch (error) { console.error('Customer save failed', id, error); }
    }
    return json(200, 'Quote accepted');
  } catch { return json(502, 'Could not confirm your submission'); }
}

// Emails staff who turned on new-quote alerts (staff page → account menu). The shop inbox (QUOTE_TO)
// already got the full request above, so it's skipped here. Only sent once the quote is saved, so the link works.
async function alertStaff(env, id, get) {
  const shop = String(env.QUOTE_TO || '').toLowerCase();
  const found = await (await sb(env, '/rest/v1/rpc/staff_alert_emails', { method: 'POST', body: '{}' })).json();
  const to = [...new Set((Array.isArray(found) ? found : []).filter(e => typeof e === 'string' && e.includes('@') && e !== shop))].slice(0, 50);
  if (!to.length) return;
  const name = get('Customer Name'), service = get('Service'), vehicle = get('Vehicle'), link = staffLink(env, id);
  const details = [['Service', service], ['Vehicle', vehicle], ['Phone', get('Phone #')], ['Email', get('Email')]].filter(([, v]) => v);
  const result = await sendEmail(env, {
    to, subject: `New quote request from ${name}${service ? ` (${service})` : ''}`,
    text: `${name} asked for a quote.\n\n${details.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nOpen it on the staff page: ${link}\n\nTo stop these emails, turn off "Email me new quotes" in the staff page account menu.`,
    html: `<div style="font-family:Arial,sans-serif;color:#0b2036;max-width:640px;margin:auto;font-size:15px;line-height:1.6"><p><strong>${escape(name)}</strong> asked for a quote.</p><table cellpadding="6" style="border-collapse:collapse">${details.map(([k, v]) => `<tr><th align="left" style="color:#5b6b7a;padding-right:16px">${escape(k)}</th><td>${escape(v)}</td></tr>`).join('')}</table><p><a href="${escape(link)}">Open it on the staff page</a></p><p style="font-size:12px;color:#5b6b7a">To stop these emails, turn off "Email me new quotes" in the staff page account menu.</p></div>`
  });
  if (!result.ok) console.error('Staff alert email was not accepted', id, result.status);
}

// Confirms the bearer token belongs to a Supabase user who is listed in public.staff.
async function staffUser(request, env) {
  const token = /^Bearer (.+)$/.exec(request.headers.get('Authorization') || '')?.[1];
  if (!token) return null;
  const auth = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!auth.ok) return null;
  const user = await auth.json();
  if (!user?.id || !uuid.test(user.id)) return null;
  const staff = await (await sb(env, `/rest/v1/staff?user_id=eq.${user.id}&select=user_id`)).json();
  return staff.length ? user : null;
}

// Checks the staff request and reads the outgoing email (and optional quote PDF) from its JSON body.
async function staffOutgoing(request, env) {
  if (request.method !== 'POST') return { error: json(405, 'Use POST') };
  if (request.headers.get('Origin') !== env.SITE_ORIGIN) return { error: json(403, 'Invalid origin') };
  if (!supabaseReady(env) || !env.SUPABASE_ANON_KEY || !env.RESEND_API_KEY || !env.QUOTE_FROM) return { error: json(503, 'Staff messaging is not configured yet') };
  const user = await staffUser(request, env);
  if (!user) return { error: json(401, 'Please sign in with a staff account') };
  if (Number(request.headers.get('Content-Length') || 0) > 8 * 1024 * 1024) return { error: json(413, 'The quote PDF is too large') };
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const subject = (typeof body.subject === 'string' ? body.subject.trim() : '').slice(0, 200);
  if (!message || message.length > 10000) return { error: json(400, 'Write a message of up to 10,000 characters') };
  // Optional quote PDF built on the staff page from a quote template.
  let pdf = null;
  if (body.attachment) {
    const filename = String(body.attachment.filename || '');
    const content = String(body.attachment.content || '');
    if (!/^[A-Za-z0-9._-]{1,80}\.pdf$/.test(filename) || content.length > 6 * 1024 * 1024) return { error: json(400, 'Invalid quote PDF') };
    let bytes;
    try { bytes = Uint8Array.from(atob(content), c => c.charCodeAt(0)); } catch { return { error: json(400, 'Invalid quote PDF') }; }
    if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') return { error: json(400, 'Invalid quote PDF') };
    pdf = { filename, content, bytes };
  }
  const doc = body.document && typeof body.document === 'object' ? body.document : {};
  return { user, body, out: { message, subject, pdf, doc } };
}

// Emails the customer about a quote; replies come back to that quote's own reply address.
async function emailCustomer(env, quote, out) {
  out.finalSubject = out.subject || `Your Splash and Dash ${serviceNames[quote.service]} quote`.replace('  ', ' ');
  const result = await sendEmail(env, {
    to: [quote.email], reply_to: replyAddress(env, quote.id), subject: out.finalSubject, text: out.message,
    html: `<div style="font-family:Arial,sans-serif;color:#0b2036;max-width:640px;margin:auto;font-size:15px;line-height:1.6"><div style="white-space:pre-wrap">${escape(out.message)}</div>${logo}</div>`,
    ...(out.pdf ? { attachments: [{ filename: out.pdf.filename, content: out.pdf.content }] } : {})
  });
  return result.ok && !!(await result.json()).id;
}

// Records a sent email in the quote's conversation, keeping a copy of any quote PDF.
async function saveOutbound(env, user, quote, out, now) {
  const row = { quote_id: quote.id, direction: 'outbound', author: user.email, subject: out.finalSubject, body: out.message, created_at: now };
  if (out.pdf) {
    // The email already went out, so a failed copy only loses the staff-page download, not the quote.
    const path = `${quote.id}/sent/${Date.now()}-${out.pdf.filename}`;
    try {
      await sb(env, `/storage/v1/object/quote-files/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: out.pdf.bytes });
      row.attachment = { path, name: out.pdf.filename, type: 'application/pdf' };
    } catch (error) { console.error('Quote PDF save failed', quote.id, error); }
    row.document = { number: String(out.doc.number || '').slice(0, 40), total: Number(out.doc.total) || 0, deposit: Number(out.doc.deposit) || 0, validThrough: String(out.doc.validThrough || '').slice(0, 20) };
  }
  await sbInsert(env, 'quote_messages', row);
}

async function handleStaffReply(request, env) {
  try {
    const { error, user, body, out } = await staffOutgoing(request, env);
    if (error) return error;
    const quote = await sbQuote(env, String(body.quoteId || ''));
    if (!quote) return json(404, 'Quote not found');
    if (!(await emailCustomer(env, quote, out))) return json(502, 'The email could not be sent');
    const now = new Date().toISOString();
    await saveOutbound(env, user, quote, out, now);
    await sbPatchQuote(env, quote.id, { status: 'waiting', last_message_at: now });
    return json(200, 'Message sent');
  } catch { return json(502, 'The message could not be sent'); }
}

// A quote staff start from the customer list: creates the quote (so replies have a conversation to land in),
// sends it, and logs the email on the customer.
const staffQuoteServices = { vinyl: 'Vinyl Wrap', ceramic: 'Ceramic Coating', correction: 'Paint Correction', other: 'Custom quote' };
async function handleStaffQuote(request, env) {
  try {
    const { error, user, body, out } = await staffOutgoing(request, env);
    if (error) return error;
    const service = String(body.service || '');
    if (!staffQuoteServices[service]) return json(400, 'Pick a service for the quote');
    if (!out.pdf) return json(400, 'Attach the quote PDF');
    const customerId = String(body.customerId || '');
    if (!uuid.test(customerId)) return json(404, 'Customer not found');
    const customer = (await (await sb(env, `/rest/v1/customers?id=eq.${customerId}&select=id,name,email,phone`)).json())[0];
    if (!customer) return json(404, 'Customer not found');
    if (!customer.email) return json(400, 'Add an email address for this person before sending a quote');
    const quote = { id: crypto.randomUUID(), service, customer_name: customer.name, email: customer.email };
    if (!(await emailCustomer(env, quote, out))) return json(502, 'The email could not be sent');
    const now = new Date().toISOString();
    await sbInsert(env, 'quotes', {
      id: quote.id, service, status: 'waiting', customer_name: customer.name, email: customer.email, phone: customer.phone || null,
      fields: [['Service', staffQuoteServices[service]], ['Customer Name', customer.name], ['Phone #', customer.phone || ''], ['Email', customer.email], ['Started by', user.email + ' from the customer list']]
        .filter(([, value]) => value),
      created_at: now, last_message_at: now
    });
    await saveOutbound(env, user, quote, out, now);
    try {
      await sbInsert(env, 'customer_contacts', { customer_id: customer.id, method: 'email', outcome: 'reached', author: user.email, note: `Sent quote ${String(out.doc.number || '').slice(0, 40)}`.trim(), created_at: now });
    } catch (e) { console.error('Contact log failed', customer.id, e); }
    return json(200, 'Quote sent', { quoteId: quote.id });
  } catch { return json(502, 'The quote could not be sent'); }
}

// Keeps only the new part of an email reply: drops the quoted thread that mail apps append.
function newReplyText(text) {
  const cut = text.search(/^(On\s[\s\S]{0,300}?wrote:\s*$|-{2,}\s*Original Message|From:\s.+$)/im);
  const kept = (cut > 0 ? text.slice(0, cut) : text).split('\n').filter(line => !line.startsWith('>')).join('\n').trim();
  return kept || text.trim();
}
const htmlText = html => html.replace(/<(br|\/p|\/div)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

async function handleInboundEmail(message, env) {
  const id = /^reply\+([^@]+)@/i.exec(message.to)?.[1];
  const quote = id && supabaseReady(env) ? await sbQuote(env, id) : null;
  if (!quote) return message.forward(env.QUOTE_TO);
  const email = await PostalMime.parse(message.raw);
  const body = newReplyText(email.text || htmlText(email.html || '')).slice(0, 20000) || '(empty message)';
  const now = new Date().toISOString();
  await sbInsert(env, 'quote_messages', { quote_id: quote.id, direction: 'inbound', author: message.from, subject: email.subject || '', body, created_at: now });
  await sbPatchQuote(env, quote.id, { status: 'open', last_message_at: now });
  const link = staffLink(env, quote.id);
  await sendEmail(env, {
    to: [env.QUOTE_TO], subject: `New reply from ${quote.customer_name}`,
    text: `${quote.customer_name} (${message.from}) replied:\n\n${body}\n\nReply from the staff page: ${link}`,
    html: `<div style="font-family:Arial,sans-serif;color:#0b2036;max-width:640px;margin:auto;font-size:15px;line-height:1.6"><p><strong>${escape(quote.customer_name)}</strong> (${escape(message.from)}) replied:</p><blockquote style="margin:0;padding:12px 16px;border-left:4px solid #1fbfd1;background:#eefafb;white-space:pre-wrap">${escape(body)}</blockquote><p><a href="${escape(link)}">Reply from the staff page</a></p></div>`
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/quote') return handleQuote(request, env);
    if (url.pathname === '/api/staff/reply') return handleStaffReply(request, env);
    if (url.pathname === '/api/staff/quote') return handleStaffQuote(request, env);
    if (url.pathname === '/api/staff/config') {
      // Public values only: the anon key is safe in the browser because RLS limits it to staff.
      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json(503, 'The staff page is not configured yet');
      return json(200, 'ok', { supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY });
    }
    return json(404, 'Not found');
  },
  // Cloudflare Email Routing (catch-all → this Worker) delivers customer replies here.
  async email(message, env) {
    try { await handleInboundEmail(message, env); }
    catch (error) { console.error('Inbound email failed', error); await message.forward(env.QUOTE_TO); }
  }
};
