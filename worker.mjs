const json = (status, message) => Response.json({ success: status === 200, message }, { status, headers: { 'Cache-Control': 'no-store' } });
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels = ['Service','Customer Name','Phone #','Email','Vehicle','Vehicle Type','Paint Color','Vehicles Condition','Correction Level','Correction Protection','Paint Conditions','Previous Paintwork','Ceramic Tier','Ceramic Package','Ceramic Add-ons','Ceramic Surface Concerns','Wrap Color','Requested Color / Finish','Preferred Film','Wrap Coverage','Selected Panels','Wrap Options','Inspection Date','Additional Info','Contact Consent','Visualizer Estimate'];
function base64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname !== '/api/quote') return json(404, 'Not found');
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
      const attachments = []; let uploaded = 0;
      for (const name of ['attachment','artwork']) {
        for (const file of form.getAll(name)) {
          if (typeof file === 'string' || !file.size) continue;
          uploaded += file.size;
          if (uploaded > 10 * 1024 * 1024) return json(413, 'Uploads must total 10 MB or less');
          const allowed = name === 'attachment' ? ['image/jpeg','image/png'] : ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
          if (!allowed.includes(file.type)) return json(400, 'Unsupported attachment type');
          attachments.push({ filename: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'), content: base64(new Uint8Array(await file.arrayBuffer())) });
        }
      }
      const result = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: {Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          from: env.QUOTE_FROM, to: [env.QUOTE_TO], reply_to: get('Email'), subject: 'Splash and Dash Quote Request',
          text: rows.map(([key,value]) => `${key}: ${value}`).join('\n'),
          html: `<div style="font-family:Arial,sans-serif;color:#0a3b73;max-width:640px;margin:auto"><h1>Splash and Dash Quote Request</h1><table cellpadding="10" style="border-collapse:collapse;width:100%">${rows.map(([key,value])=>`<tr><th align="left" style="border-bottom:1px solid #ddd">${escape(key)}</th><td style="border-bottom:1px solid #ddd;white-space:pre-wrap">${escape(value)}</td></tr>`).join('')}</table><p style="text-align:center;margin-top:28px"><img src="https://splashanddash.uluxe.site/images/brand-logo-512.png" width="256" alt="Splash and Dash Car Wash and Auto Detail Center" style="max-width:100%;height:auto"></p></div>`,
          attachments
        })
      });
      if (!result.ok) return json(502, 'Email provider could not accept the request');
      const sent = await result.json();
      if (!sent.id) return json(502, 'Email acceptance was not confirmed');
      return json(200, 'Quote accepted');
    } catch { return json(502, 'Could not confirm your submission'); }
  }
};
