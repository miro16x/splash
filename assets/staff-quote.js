// Quote builder for the staff page: fills the Splash and Dash quote templates and renders them to PDF.
// Prices mirror the tables in assets/site.js and the printed templates; update all of them together.
(function(){
  var VEHICLE_TYPES = ["2-Door Coupe","Small Sedan","Large Sedan","Small SUV/Crossover","Mid-Size SUV","Large SUV","Small Pickup","Mid-Size Pickup","Full-Size Pickup","Large Truck/SUV","Van/Commercial"];
  // [display price, number used to pre-fill or null when the price is a range]
  var FULL_WRAP = {"2-Door Coupe":"$2,200","Small Sedan":"$2,400","Large Sedan":"$2,600","Small SUV/Crossover":"$2,600","Mid-Size SUV":"$2,800","Large SUV":"$3,100","Small Pickup":"$2,800","Mid-Size Pickup":"$3,000","Full-Size Pickup":"$3,300","Large Truck/SUV":"$3,500+","Van/Commercial":"$3,500+"};
  var PARTIAL_WRAP = [["Roof","$450"],["Hood","$400"],["Trunk/Liftgate","$400"],["Spoiler","$250"],["Mirror Caps - Pair","$300"],["Two Doors","$600"],["Four Doors","$950"],["Fenders - Pair","$550"],["Quarter Panels - Pair","$650"],["Front Bumper","$550"],["Rear Bumper","$550"],["Both Bumpers","$950"],["A/B/C Pillars","$200"],["Chrome Delete","$400-$600"]];
  var CORRECTION = {"2-Door Coupe":["$300","$450-$650","$800-$1,100"],"Small Sedan":["$350","$500-$700","$850-$1,200"],"Large Sedan":["$400","$550-$750","$950-$1,300"],"Small SUV/Crossover":["$400","$600-$800","$1,000-$1,400"],"Mid-Size SUV":["$450","$650-$850","$1,100-$1,500"],"Large SUV":["$500","$700-$950","$1,200-$1,700"],"Small Pickup":["$450","$600-$850","$1,050-$1,450"],"Mid-Size Pickup":["$500","$650-$900","$1,100-$1,550"],"Full-Size Pickup":["$550","$700-$950","$1,200-$1,700"],"Large Truck/SUV":["$600+","$800+","$1,400+"],"Van/Commercial":["$650+","$900+","$1,600+"]};
  var CERAMIC = {"2-Door Coupe":["$800","$1,200"],"Small Sedan":["$850","$1,300"],"Large Sedan":["$900","$1,400"],"Small SUV/Crossover":["$950","$1,450"],"Mid-Size SUV":["$1,050","$1,600"],"Large SUV":["$1,200","$1,800"],"Small Pickup":["$1,000","$1,500"],"Mid-Size Pickup":["$1,100","$1,650"],"Full-Size Pickup":["$1,250","$1,850"],"Large Truck/SUV":["$1,400+","$2,000+"],"Van/Commercial":["$1,500+","$2,800+"]};
  var CERAMIC_ADDONS = [["Windshield glass",150],["Full glass",350],["Wheel faces",250],["Wheels-off",500],["Brake calipers",200],["Trim/plastic coating",200],["Leather/interior vinyl",350],["Fabric/carpet protection",250],["Convertible soft top",300]];
  var LEVELS = ["Enhancement / one-step polish","Stage 1","Stage 2"];
  var TIERS = ["Entry Tier","Premium Tier"];
  var PACKAGES = ["Full exterior","Glass & Trim","Wheel & Caliper","Interior Defense","Full Exterior Accents","Total Armor"];
  var PROTECTION = ["Ceramic coating","Paint sealant","Wax","No protection"];
  var CONDITIONS = ["Scratches","Swirls","Oxidation","Water spots"];
  var WRAP_SCOPE = ["Full color change","Partial wrap","Chrome delete"];
  var WRAP_EXTRAS = ["Door jambs","Custom graphics","Existing-wrap removal"];
  var ADDRESS = "4394 Annas Retreat, Suite 1  |  St. Thomas, USVI 00802  |  340-775-7405  |  angelkhatib4@gmail.com";

  var TEMPLATES = {
    vinyl: {
      title: "VINYL WRAP QUOTE", name: "Vinyl Wrap", prefix: "VW", file: "Vinyl-Wrap-Quote", colorLabel: "Current paint color",
      lines: [["base","Base wrap"],["prep","Preparation/removal"],["film","Film upgrade"],["graphics","Graphics/additional"]],
      fine: "Estimate only. Vinyl is included unless stated otherwise. Door jambs, specialty graphics, disassembly, body repair, paint correction, and removal are additional unless listed. Final scope and price require an in-person inspection or review of clear vehicle photographs."
    },
    correction: {
      title: "PAINT CORRECTION QUOTE", name: "Paint Correction", prefix: "PC", file: "Paint-Correction-Quote", colorLabel: "Paint color", previous: true,
      lines: [["base","Correction service"],["decon","Decontamination"],["protection","Protection"],["labor","Additional labor"]],
      fine: "Estimate only. Correction percentages and outcomes are not guaranteed. Some defects may remain to protect clear-coat integrity. Rock chips, dents, rust, missing paint, deep gouges, and failing clear coat may need repair. Final scope and price require inspection or clear photographs."
    },
    ceramic: {
      title: "CERAMIC COATING QUOTE", name: "Ceramic Coating", prefix: "CC", file: "Ceramic-Coating-Quote", colorLabel: "Paint color",
      lines: [["base","Base coating"],["prep","Preparation minimum"],["correction","Paint correction"],["addons","Components/add-ons"]],
      fine: "Estimate only. Preparation starts at $200. Final pricing depends on size, condition, preparation, coating grade, correction needs, existing layers, and water spots. Ceramic coating is not paint repair or dent protection. Final scope and price require inspection or clear vehicle photographs."
    },
    // Custom: staff list any work as line items (used from the customer list for jobs outside one template).
    other: {
      title: "SERVICE QUOTE", name: "Custom", prefix: "SQ", file: "Service-Quote", colorLabel: "Paint color", custom: true, lines: [],
      fine: "Estimate only. Prices cover the work listed above; anything not listed is additional. Final scope and price require an in-person inspection or review of clear vehicle photographs."
    }
  };

  // ---------- helpers ----------
  function el(tag, props){
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function(key){
      if (key === 'text') node.textContent = props[key];
      else if (key === 'on') Object.keys(props.on).forEach(function(evt){ node.addEventListener(evt, props.on[evt]); });
      else if (key in node && key !== 'list') node[key] = props[key];
      else node.setAttribute(key, props[key]);
    });
    for (var i = 2; i < arguments.length; i++) if (arguments[i] != null) node.append(arguments[i]);
    return node;
  }
  // "$1,400" → 1400, "$3,500+" → 3500, ranges like "$450-$650" → null (staff picks the amount).
  function fixedPrice(text){ return !text || /-/.test(text) ? null : Number(text.replace(/[^\d.]/g, '')); }
  function money(n){ return n === '' || n == null || isNaN(n) ? '' : '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2}); }
  function isoDate(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function niceDate(iso){ if (!iso) return ''; var p = iso.split('-'); return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}); }
  function list(text){ return (text || '').split(/,\s*/).map(function(s){ return s.trim(); }).filter(Boolean); }

  // ---------- pre-fill from the customer's request ----------
  function initialDoc(quote, messages, staffName){
    var f = {}; (quote.fields || []).forEach(function(row){ f[row[0]] = row[1]; });
    var sent = messages.filter(function(m){ return m.document; }).length;
    var today = new Date(), valid = new Date(); valid.setDate(valid.getDate() + 30);
    var doc = {
      number: TEMPLATES[quote.service].prefix + '-' + isoDate(today).slice(2).replace(/-/g, '') + '-' + quote.id.slice(0, 4).toUpperCase() + (sent ? '-' + (sent + 1) : ''),
      date: isoDate(today), validThrough: isoDate(valid),
      name: quote.customer_name || '', phone: quote.phone || '', email: quote.email || '',
      model: f['Vehicle'] || '', type: VEHICLE_TYPES.indexOf(f['Vehicle Type']) >= 0 ? f['Vehicle Type'] : '',
      color: f['Paint Color'] || '', condition: f['Vehicles Condition'] || '',
      previous: f['Previous Paintwork'] === 'Yes' ? 'Reported by customer' : '',
      checks: {}, panels: '', colorFinish: '', film: '', level: '', tier: '',
      amounts: {}, deposit: '', notes: '', preparedBy: staffName || '',
      items: [{desc:'', amount:''}]
    };
    if (quote.service === 'vinyl') {
      doc.checks['Full color change'] = f['Wrap Coverage'] === 'Full wrap';
      doc.checks['Partial wrap'] = f['Wrap Coverage'] === 'Partial wrap';
      if (doc.checks['Partial wrap']) doc.panels = f['Selected Panels'] || '';
      doc.colorFinish = f['Requested Color / Finish'] || '';
      doc.film = f['Preferred Film'] || '';
      var opts = list(f['Wrap Options']);
      doc.checks['Chrome delete'] = opts.indexOf('Chrome delete') >= 0;
      doc.checks['Door jambs'] = opts.indexOf('Door jambs') >= 0;
      doc.checks['Custom graphics'] = opts.indexOf('Custom graphics') >= 0;
      doc.checks['Existing-wrap removal'] = opts.indexOf('Existing wrap removal') >= 0;
    } else if (quote.service === 'correction') {
      var level = f['Correction Level'] || '';
      doc.level = /enhancement/i.test(level) ? LEVELS[0] : LEVELS.indexOf(level) >= 0 ? level : '';
      var protection = f['Correction Protection'];
      doc.checks[protection === 'None yet' ? 'No protection' : protection] = PROTECTION.indexOf(protection) >= 0 || protection === 'None yet';
      list(f['Paint Conditions']).forEach(function(c){ if (CONDITIONS.indexOf(c) >= 0) doc.checks[c] = true; });
    } else if (quote.service === 'ceramic') {
      doc.tier = TIERS.indexOf(f['Ceramic Tier']) >= 0 ? f['Ceramic Tier'] : '';
      if (PACKAGES.indexOf(f['Ceramic Package']) >= 0) doc.checks[f['Ceramic Package']] = true;
      var addonMap = {'Glass':'Full glass', 'Wheels':'Wheel faces', 'Interior':'Leather/interior vinyl'};
      list(f['Ceramic Add-ons']).forEach(function(a){ if (addonMap[a]) doc.checks[addonMap[a]] = true; });
    }
    return doc;
  }

  // Suggested amounts from the price tables; null where staff must choose (ranges, unknown type).
  function suggestions(service, doc){
    var s = {}, hints = {};
    if (service === 'vinyl') {
      var base = 0, known = true, parts = [];
      if (doc.checks['Full color change']) {
        var full = FULL_WRAP[doc.type];
        if (full) { parts.push('Full color change ' + full); base += fixedPrice(full); } else known = false;
      }
      if (doc.checks['Partial wrap']) {
        var text = doc.panels.toLowerCase();
        PARTIAL_WRAP.forEach(function(p){ if (p[0] !== 'Chrome Delete' && text.indexOf(p[0].toLowerCase()) >= 0) { parts.push(p[0] + ' ' + p[1]); base += fixedPrice(p[1]); } });
      }
      s.base = known && parts.length ? base : null;
      hints.base = parts.length ? 'Starting prices: ' + parts.join(' + ') : (doc.checks['Full color change'] ? 'Pick a vehicle type to see the starting price.' : '');
      if (doc.checks['Chrome delete']) hints.graphics = 'Chrome delete starts at $400–$600.';
    } else if (service === 'correction') {
      var row = CORRECTION[doc.type], i = LEVELS.indexOf(doc.level);
      var price = row && i >= 0 ? row[i] : '';
      s.base = fixedPrice(price);
      hints.base = price ? doc.level + ' for a ' + doc.type + ': ' + price.replace('-', '–') : 'Pick a vehicle type and stage to see the starting price.';
    } else if (service === 'ceramic') {
      var tierRow = CERAMIC[doc.type], t = TIERS.indexOf(doc.tier);
      var tierPrice = tierRow && t >= 0 ? tierRow[t] : '';
      s.base = fixedPrice(tierPrice);
      hints.base = tierPrice ? doc.tier + ' full exterior for a ' + doc.type + ': ' + tierPrice : 'Pick a vehicle type and tier to see the starting price.';
      s.prep = 200; hints.prep = 'Preparation starts at $200.';
      var addons = CERAMIC_ADDONS.filter(function(a){ return doc.checks[a[0]]; });
      s.addons = addons.length ? addons.reduce(function(sum, a){ return sum + a[1]; }, 0) : null;
      if (addons.length) hints.addons = addons.map(function(a){ return a[0] + ' $' + a[1]; }).join(' + ');
    }
    return {amounts: s, hints: hints};
  }

  function total(service, doc){
    if (TEMPLATES[service].custom) return doc.items.reduce(function(sum, it){ var v = parseFloat(it.amount); return sum + (isNaN(v) ? 0 : v); }, 0);
    return TEMPLATES[service].lines.reduce(function(sum, line){ var v = parseFloat(doc.amounts[line[0]]); return sum + (isNaN(v) ? 0 : v); }, 0);
  }

  // ---------- builder form ----------
  function builder(opts){
    var quote = opts.quote, service = quote.service, tpl = TEMPLATES[service];
    var doc = initialDoc(quote, opts.messages, opts.staffName);
    var edited = {};  // amount fields staff typed into stop following the price tables
    var amountInputs = {}, hintNodes = {}, totalNode;
    var uid = 'qb-' + quote.id.slice(0, 8) + '-';

    function input(key, label, type, attrs){
      var field = el('input', Object.assign({type: type || 'text', id: uid + key, value: doc[key] || ''}, attrs || {}));
      field.addEventListener('input', function(){ doc[key] = field.value; refresh(); });
      return el('div', {className:'qb-field'}, el('label', {htmlFor: uid + key, text: label}), field);
    }
    function select(key, label, options){
      var field = el('select', {id: uid + key}, el('option', {value:'', text:'Select…'}));
      options.forEach(function(o){ field.append(el('option', {value:o, text:o, selected: doc[key] === o})); });
      field.addEventListener('change', function(){ doc[key] = field.value; refresh(); });
      return el('div', {className:'qb-field'}, el('label', {htmlFor: uid + key, text: label}), field);
    }
    function checks(title, names, single){
      var group = el('fieldset', {className:'qb-checks'}, el('legend', {text: title}));
      names.forEach(function(name){
        var label = Array.isArray(name) ? name[0] + ' ($' + name[1] + ')' : name;
        name = Array.isArray(name) ? name[0] : name;
        var box = el('input', {type: single ? 'radio' : 'checkbox', name: uid + title, checked: single ? doc[single] === name : !!doc.checks[name]});
        box.addEventListener('change', function(){
          if (single) doc[single] = name; else doc.checks[name] = box.checked;
          refresh();
        });
        group.append(el('label', {className:'qb-check'}, box, ' ' + label));
      });
      return group;
    }
    function amount(key, label){
      var field = el('input', {type:'number', min:'0', step:'0.01', inputMode:'decimal', id: uid + key, placeholder:'0'});
      field.addEventListener('input', function(){ edited[key] = field.value !== ''; doc.amounts[key] = field.value; refresh(); });
      amountInputs[key] = field;
      hintNodes[key] = el('span', {className:'qb-hint'});
      return el('div', {className:'qb-field'}, el('label', {htmlFor: uid + key, text: label + ' ($)'}), field, hintNodes[key]);
    }
    function refresh(){
      var sug = suggestions(service, doc);
      tpl.lines.forEach(function(line){
        var key = line[0];
        if (!edited[key]) {
          var v = sug.amounts[key];
          doc.amounts[key] = v == null ? '' : String(v);
          amountInputs[key].value = doc.amounts[key];
        }
        hintNodes[key].textContent = sug.hints[key] || '';
      });
      totalNode.textContent = money(total(service, doc)) || '$0';
    }

    var grid = function(){ return el('div', {className:'qb-grid'}); };
    var details = grid(); details.append(input('number', 'Quote #'), input('date', 'Date', 'date'), input('validThrough', 'Valid through', 'date'));
    var customer = grid(); customer.append(input('name', 'Name'), input('phone', 'Phone'), input('email', 'Email', 'email', {readOnly: true, title: 'The quote is sent to the email on the request.'}));
    var vehicle = grid(); vehicle.append(input('model', 'Year / Make / Model'), select('type', 'Vehicle type', VEHICLE_TYPES), input('color', tpl.colorLabel), input('condition', service === 'correction' ? 'Current condition' : 'Condition / prior work'));
    if (tpl.previous) vehicle.append(input('previous', 'Previous polishing / repaint / bodywork'));

    var scope = el('div', {className:'qb-scope'});
    if (service === 'vinyl') {
      scope.append(checks('Scope', WRAP_SCOPE));
      var vg = grid(); vg.append(input('panels', 'Selected panels'), input('colorFinish', 'Requested color / finish'), input('film', 'Preferred film'));
      scope.append(vg, checks('Extras', WRAP_EXTRAS));
    } else if (service === 'correction') {
      scope.append(checks('Correction level', LEVELS, 'level'), checks('Protection', PROTECTION), checks('Conditions', CONDITIONS));
    } else if (service === 'ceramic') {
      scope.append(checks('Tier', TIERS, 'tier'), checks('Package', PACKAGES), checks('Component / accent options', CERAMIC_ADDONS));
    } else {
      scope.append(itemsEditor());
    }

    // Custom quotes: one row per piece of work, each with its own price.
    function itemsEditor(){
      var wrap = el('div', {className:'qb-items'});
      function draw(){
        wrap.replaceChildren();
        doc.items.forEach(function(it, i){
          var desc = el('input', {type:'text', value:it.desc, maxLength:300, placeholder:'e.g. Satin black roof wrap', 'aria-label':'Work ' + (i + 1)});
          var amt = el('input', {type:'number', min:'0', step:'0.01', inputMode:'decimal', value:it.amount, placeholder:'0', 'aria-label':'Price for work ' + (i + 1) + ' ($)'});
          desc.addEventListener('input', function(){ it.desc = desc.value; });
          amt.addEventListener('input', function(){ it.amount = amt.value; refresh(); });
          var remove = el('button', {type:'button', className:'ghost qb-item-remove', 'aria-label':'Remove work ' + (i + 1), text:'✕', disabled: doc.items.length === 1, on:{click:function(){ doc.items.splice(i, 1); draw(); refresh(); }}});
          wrap.append(el('div', {className:'qb-item'}, desc, amt, remove));
        });
        wrap.append(el('button', {type:'button', className:'ghost', text:'+ Add work', on:{click:function(){
          doc.items.push({desc:'', amount:''}); draw(); wrap.querySelectorAll('.qb-item input[type=text]')[doc.items.length - 1].focus();
        }}}));
      }
      draw();
      return wrap;
    }

    var pricing = grid();
    tpl.lines.forEach(function(line){ pricing.append(amount(line[0], line[1])); });
    var deposit = el('input', {type:'number', min:'0', step:'0.01', inputMode:'decimal', id: uid + 'deposit', placeholder:'0'});
    deposit.addEventListener('input', function(){ doc.deposit = deposit.value; });
    pricing.append(el('div', {className:'qb-field'}, el('label', {htmlFor: uid + 'deposit', text:'Deposit required ($)'}), deposit));
    totalNode = el('strong');
    var totalRow = el('p', {className:'qb-total'}, 'Estimated total: ', totalNode);

    var notes = el('textarea', {id: uid + 'notes', rows: 3});
    notes.addEventListener('input', function(){ doc.notes = notes.value; });
    var first = (quote.customer_name || '').split(' ')[0];
    var subject = el('input', {type:'text', id: uid + 'subject', maxLength: 200, value: 'Your Splash and Dash ' + (tpl.custom ? '' : tpl.name + ' ') + 'quote'});
    var message = el('textarea', {id: uid + 'message', rows: 5, value:
      'Hi ' + first + ',\n\nThanks for reaching out to Splash and Dash. Your quote is attached. Reply to this email to approve it or if you have any questions.\n\n' + (opts.staffName ? opts.staffName + '\n' : '') + 'Splash and Dash Car Wash & Auto Detail Center\n340-775-7405'});
    var note = el('p', {className:'note', role:'status'});

    function payloadDoc(){ return Object.assign({}, doc, {total: total(service, doc)}); }
    var preview = el('button', {type:'button', className:'ghost', text:'Preview PDF', on:{click: async function(){
      var win = window.open('', '_blank');
      try {
        var bytes = await renderPdf(service, payloadDoc());
        var url = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'}));
        if (win) win.location = url; else location.href = url;
      } catch (error) { if (win) win.close(); note.className = 'note error'; note.textContent = 'Couldn\'t build the PDF. ' + error.message; }
    }}});
    var send = el('button', {type:'submit', className:'hover-btn hover-btn-sm'},
      el('span', {className:'hover-btn-label', 'data-label':'', text:'Send quote'}),
      el('span', {className:'hover-btn-reveal', 'aria-hidden':'true'}, el('span', {'data-label':'', text:'Send quote'})),
      el('span', {className:'hover-btn-dot', 'aria-hidden':'true'}));
    function setSendLabel(text){ send.querySelectorAll('[data-label]').forEach(function(n){ n.textContent = text; }); }

    var form = el('form', {className:'qb'},
      el('h4', {text:'Quote details'}), details,
      el('h4', {text:'Customer'}), customer,
      el('h4', {text:'Vehicle'}), vehicle,
      el('h4', {text: tpl.custom ? 'Work to be done' : 'Selected scope'}), scope,
      el('h4', {text:'Pricing'}), pricing, totalRow,
      el('h4', {text:'Notes on the quote'}), notes,
      el('h4', {text:'Email'}),
      el('div', {className:'qb-field'}, el('label', {htmlFor: uid + 'subject', text:'Subject'}), subject),
      el('div', {className:'qb-field'}, el('label', {htmlFor: uid + 'message', text:'Message (the PDF is attached)'}), message),
      el('div', {className:'reply-actions'}, send, preview, note));
    form.addEventListener('submit', async function(event){
      event.preventDefault();
      if (opts.sendBlocked) { note.className = 'note error'; note.textContent = opts.sendBlocked; return; }
      if (!total(service, doc)) { note.className = 'note error'; note.textContent = 'Add at least one price before sending.'; return; }
      if (!message.value.trim()) { note.className = 'note error'; note.textContent = 'Write a short message to go with the quote.'; return; }
      send.disabled = true; setSendLabel('Sending…'); note.className = 'note'; note.textContent = '';
      try {
        var d = payloadDoc();
        var bytes = await renderPdf(service, d);
        var binary = ''; for (var i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        await opts.send({
          subject: subject.value, message: message.value,
          attachment: {filename: tpl.file + '-' + d.number.replace(/[^A-Za-z0-9-]/g, '') + '.pdf', content: btoa(binary)},
          document: {number: d.number, total: d.total, deposit: parseFloat(d.deposit) || 0, validThrough: d.validThrough}
        });
      } catch (error) {
        send.disabled = false; setSendLabel('Send quote');
        note.className = 'note error'; note.textContent = (error.message || 'The quote could not be sent.') + ' Your quote is still here.';
      }
    });
    if (opts.sendBlocked) { send.disabled = true; note.textContent = opts.sendBlocked; }
    refresh();
    return form;
  }

  // ---------- PDF ----------
  var logoBytes;
  async function renderPdf(service, doc){
    var tpl = TEMPLATES[service], P = window.PDFLib;
    var pdf = await P.PDFDocument.create();
    pdf.setTitle(tpl.name + ' Quote ' + doc.number);
    pdf.setAuthor('Splash and Dash Car Wash & Auto Detail Center');
    var regular = await pdf.embedFont(P.StandardFonts.Helvetica);
    var bold = await pdf.embedFont(P.StandardFonts.HelveticaBold);
    var italic = await pdf.embedFont(P.StandardFonts.HelveticaOblique);
    if (!logoBytes) logoBytes = await (await fetch('images/brand-logo-512.png')).arrayBuffer();
    var logo = await pdf.embedPng(logoBytes);

    var NAVY = P.rgb(0.09, 0.2, 0.29), TEAL = P.rgb(0.07, 0.64, 0.71), INK = P.rgb(0.1, 0.12, 0.15), GREY = P.rgb(0.42, 0.45, 0.5);
    var LINE = P.rgb(0.79, 0.83, 0.86), ZEBRA = P.rgb(0.95, 0.96, 0.97), MARK = P.rgb(0.86, 0.95, 0.96), WHITE = P.rgb(1, 1, 1);
    var W = 612, H = 792, M = 36, CW = W - M * 2;
    var page, y;

    // Standard fonts only cover Windows-1252; swap anything else so customer text can't break the PDF.
    var ok = {};
    function safe(text){
      return String(text == null ? '' : text).replace(/[‐-‒]/g, '-').replace(/\s+/g, ' ').split('').map(function(c){
        if (!(c in ok)) { try { regular.encodeText(c); ok[c] = true; } catch (e) { ok[c] = false; } }
        return ok[c] ? c : '?';
      }).join('');
    }
    function width(text, font, size){ return font.widthOfTextAtSize(text, size); }
    function draw(text, x, yy, size, font, color){ page.drawText(safe(text), {x: x, y: yy, size: size, font: font || regular, color: color || INK}); }
    function wrap(text, font, size, max){
      var words = safe(text).split(' '), lines = [], line = '';
      words.forEach(function(w){
        var next = line ? line + ' ' + w : w;
        if (width(next, font, size) > max && line) { lines.push(line); line = w; } else line = next;
      });
      if (line) lines.push(line);
      return lines;
    }
    function newPage(){ page = pdf.addPage([W, H]); y = H - M; }
    function need(h){ if (y - h < M + 8) newPage(); }
    function bar(title){
      need(40);
      y -= 15;
      page.drawRectangle({x: M, y: y - 4, width: CW, height: 14, color: TEAL});
      draw(title, M + 7, y, 8.5, bold, WHITE);
      y -= 9;
    }
    // "Label: value____" with the value written on the line, like the printed template.
    function field(label, value, x, w){
      var lw = width(label + ':', bold, 8.5) + 4;
      draw(label + ':', x, y, 8.5, bold);
      var lines = wrap(value || '', regular, 9, w - lw - 4);
      draw(lines[0] || '', x + lw, y + 0.5, 9);
      page.drawLine({start: {x: x + lw, y: y - 2.5}, end: {x: x + w, y: y - 2.5}, thickness: 0.5, color: GREY});
    }
    function row(pairs){
      need(18);
      y -= 14;
      var w = (CW - 16 * (pairs.length - 1)) / pairs.length;
      pairs.forEach(function(p, i){ field(p[0], p[1], M + i * (w + 16), w); });
    }
    function box(x, yy, checked){
      page.drawRectangle({x: x, y: yy - 1, width: 7.5, height: 7.5, borderColor: INK, borderWidth: 0.7, color: WHITE});
      if (checked) page.drawRectangle({x: x + 1.6, y: yy + 0.6, width: 4.3, height: 4.3, color: NAVY});
    }
    function checkRow(title, names, isChecked){
      need(16);
      y -= 13;
      var x = M + 4;
      if (title) { draw(title, x, y, 8.5, bold); x += width(title, bold, 8.5) + 8; }
      names.forEach(function(n){
        var label = Array.isArray(n) ? n[0] + ' $' + n[1] : n, key = Array.isArray(n) ? n[0] : n;
        var w = width(label, regular, 8.5) + 22;
        if (x + w > M + CW) { y -= 13; need(13); x = M + 4 + (title ? width(title, bold, 8.5) + 8 : 0); }
        box(x, y, isChecked(key));
        draw(label, x + 11, y, 8.5);
        x += w;
      });
    }
    // Price table; rows are arrays of cells, `mark` highlights the customer's vehicle type.
    function table(headers, rows, widths, mark){
      var rh = 11.5;
      need(rh * 2);
      y -= 4;
      var x = M;
      page.drawRectangle({x: M, y: y - rh, width: CW, height: rh, color: NAVY});
      headers.forEach(function(h, i){ draw(h, x + widths[i] / 2 - width(safe(h), bold, 8) / 2, y - rh + 3.4, 8, bold, WHITE); x += widths[i]; });
      y -= rh;
      rows.forEach(function(cells, r){
        need(rh);
        var marked = mark && mark(cells);
        page.drawRectangle({x: M, y: y - rh, width: CW, height: rh, color: r % 2 ? ZEBRA : WHITE, borderColor: LINE, borderWidth: 0.4});
        x = M;
        cells.forEach(function(c, i){
          if (marked && marked.indexOf(i) >= 0) page.drawRectangle({x: x, y: y - rh, width: widths[i], height: rh, color: MARK});
          var f = marked && marked.indexOf(i) >= 0 ? bold : regular;
          var tx = i === 0 || (headers.length === 4 && i === 2 && !/\$/.test(c)) ? x + 5 : x + widths[i] / 2 - width(safe(c), f, 8) / 2;
          draw(c, tx, y - rh + 3.4, 8, f);
          x += widths[i];
        });
        y -= rh;
      });
    }
    // Custom quotes: description (wrapped) and price for each piece of work.
    function workItems(list){
      var rh = 11.5, priceX = M + CW - 6;
      need(rh * 2);
      y -= 4;
      page.drawRectangle({x: M, y: y - rh, width: CW, height: rh, color: NAVY});
      draw('Work', M + 5, y - rh + 3.4, 8, bold, WHITE);
      draw('Price', priceX - width('Price', bold, 8), y - rh + 3.4, 8, bold, WHITE);
      y -= rh;
      if (!list.length) list = [{desc:'', amount:''}];
      list.forEach(function(it, r){
        var lines = wrap(it.desc || '', regular, 8.5, CW * 0.78);
        if (!lines.length) lines = [''];
        var h = Math.max(13, lines.length * 10.5 + 4);
        need(h);
        page.drawRectangle({x: M, y: y - h, width: CW, height: h, color: r % 2 ? ZEBRA : WHITE, borderColor: LINE, borderWidth: 0.4});
        lines.forEach(function(line, i){ draw(line, M + 5, y - 9.5 - i * 10.5, 8.5); });
        var price = money(parseFloat(it.amount));
        if (price) draw(price, priceX - width(safe(price), regular, 8.5), y - 9.5, 8.5);
        y -= h;
      });
    }
    // [label, amount] cells in the template's 2-column grid; the last row (total and deposit) is bold.
    function amounts(cells){
      var rh = 15, lab = CW * 0.22, val = CW * 0.28;
      var rowsCount = cells.length / 2;
      need(rh * rowsCount + 4);
      y -= 6;
      for (var r = 0; r < rowsCount; r++) {
        var x = M, strong = r === rowsCount - 1, f = strong ? bold : regular;
        if (strong) page.drawRectangle({x: M, y: y - rh, width: CW, height: rh, color: MARK});
        [cells[r * 2], cells[r * 2 + 1]].forEach(function(cell){
          page.drawRectangle({x: x, y: y - rh, width: lab, height: rh, borderColor: TEAL, borderWidth: 0.6});
          page.drawRectangle({x: x + lab, y: y - rh, width: val, height: rh, borderColor: TEAL, borderWidth: 0.6});
          draw(cell[0] + ':', x + 5, y - rh + 4.5, 8.5, bold);
          var text = money(cell[1]) || '$';
          draw(text, x + lab + val - 6 - width(safe(text), f, 9), y - rh + 4.5, 9, f);
          x += lab + val;
        });
        y -= rh;
      }
    }

    newPage();
    var lw = 112, lh = lw * logo.height / logo.width;
    page.drawImage(logo, {x: W / 2 - lw / 2, y: y - lh + 6, width: lw, height: lh});
    y -= lh - 2;
    draw(ADDRESS, W / 2 - width(safe(ADDRESS), regular, 7.5) / 2, y, 7.5, regular, GREY);
    y -= 18;
    page.drawRectangle({x: M, y: y - 5, width: CW, height: 19, color: NAVY});
    draw(tpl.title, W / 2 - width(tpl.title, bold, 13) / 2, y, 13, bold, WHITE);
    y -= 8;
    row([['Quote #', doc.number], ['Date', niceDate(doc.date)], ['Valid through', niceDate(doc.validThrough)]]);

    bar('CUSTOMER');
    row([['Name', doc.name], ['Phone', doc.phone]]);
    row([['Email', doc.email]]);

    bar('VEHICLE');
    row([['Year / Make / Model', doc.model]]);
    row([['Vehicle type', doc.type], [tpl.colorLabel, doc.color]]);
    row([[service === 'correction' ? 'Current condition' : 'Condition / prior work', doc.condition]]);
    if (tpl.previous) row([['Previous polishing / repaint / bodywork', doc.previous]]);

    var markType = function(cells){ var hits = []; cells.forEach(function(c, i){ if (c === doc.type) hits.push(i, i + 1); }); return hits.length ? hits : null; };
    var isChecked = function(name){ return !!doc.checks[name]; };
    if (service === 'vinyl') {
      bar('FULL COLOR-CHANGE STARTING PRICES');
      var fullRows = [];
      for (var i = 0; i < VEHICLE_TYPES.length; i += 2) fullRows.push([VEHICLE_TYPES[i], FULL_WRAP[VEHICLE_TYPES[i]], VEHICLE_TYPES[i + 1] || '', VEHICLE_TYPES[i + 1] ? FULL_WRAP[VEHICLE_TYPES[i + 1]] : '']);
      table(['Vehicle Type', 'From', 'Vehicle Type', 'From'], fullRows, [CW * .34, CW * .16, CW * .34, CW * .16], markType);
      bar('PARTIAL-WRAP STARTING PRICES');
      var partRows = [];
      for (var j = 0; j < PARTIAL_WRAP.length; j += 2) partRows.push([PARTIAL_WRAP[j][0], PARTIAL_WRAP[j][1], PARTIAL_WRAP[j + 1][0], PARTIAL_WRAP[j + 1][1]]);
      var panelText = doc.panels.toLowerCase();
      table(['Service', 'From', 'Service', 'From'], partRows, [CW * .34, CW * .16, CW * .34, CW * .16], doc.checks['Partial wrap'] ? function(cells){
        var hits = []; [0, 2].forEach(function(i){ if (panelText.indexOf(cells[i].toLowerCase()) >= 0 || (cells[i] === 'Chrome Delete' && doc.checks['Chrome delete'])) hits.push(i, i + 1); });
        return hits.length ? hits : null;
      } : null);
      bar('SELECTED SCOPE');
      checkRow('', WRAP_SCOPE, isChecked);
      row([['Selected panels', doc.panels], ['Requested color / finish', doc.colorFinish]]);
      row([['Preferred film', doc.film]]);
      checkRow('', WRAP_EXTRAS, isChecked);
    } else if (service === 'correction') {
      bar('PAINT-CORRECTION STARTING PRICES');
      table(['Vehicle Type', 'Enhancement', 'Stage 1', 'Stage 2'], VEHICLE_TYPES.map(function(t){ return [t].concat(CORRECTION[t]); }), [CW * .37, CW * .21, CW * .21, CW * .21], function(cells){
        if (cells[0] !== doc.type) return null;
        var i = LEVELS.indexOf(doc.level); return i >= 0 ? [0, i + 1] : [0];
      });
      bar('SELECTED SCOPE');
      checkRow('', LEVELS, function(n){ return doc.level === n; });
      checkRow('Protection:', PROTECTION, isChecked);
      checkRow('Conditions:', CONDITIONS, isChecked);
    } else if (service === 'ceramic') {
      bar('FULL-EXTERIOR STARTING PRICES');
      table(['Vehicle Type', 'Entry Tier', 'Premium Tier'], VEHICLE_TYPES.map(function(t){ return [t].concat(CERAMIC[t]); }), [CW * .5, CW * .25, CW * .25], function(cells){
        if (cells[0] !== doc.type) return null;
        var i = TIERS.indexOf(doc.tier); return i >= 0 ? [0, i + 1] : [0];
      });
      bar('COMPONENT / ACCENT OPTIONS');
      checkRow('', CERAMIC_ADDONS, isChecked);
      bar('SELECTED SCOPE');
      checkRow('', TIERS, function(n){ return doc.tier === n; });
      checkRow('Package:', PACKAGES, isChecked);
    } else {
      bar('QUOTED WORK');
      workItems(doc.items.filter(function(it){ return (it.desc || '').trim() || it.amount !== ''; }));
    }

    amounts(tpl.lines.map(function(line){ return [line[1], parseFloat(doc.amounts[line[0]])]; })
      .concat([['ESTIMATED TOTAL', doc.total], ['Deposit required', parseFloat(doc.deposit)]]));

    bar('NOTES');
    var noteLines = doc.notes.trim() ? doc.notes.split('\n').reduce(function(all, p){ return all.concat(p.trim() ? wrap(p, regular, 9, CW - 8) : ['']); }, []) : ['', '', ''];
    noteLines.forEach(function(line){
      need(13);
      y -= 12;
      draw(line, M + 4, y, 9);
      page.drawLine({start: {x: M + 2, y: y - 3}, end: {x: M + CW * .78, y: y - 3}, thickness: 0.5, color: GREY});
    });

    y -= 8;
    need(52);
    y -= 13;
    draw('To approve this quote, reply to the email it came with.', M, y, 8.5, italic, GREY);
    row([['Customer approval', ''], ['Date', '']]);
    row([['Prepared by', doc.preparedBy], ['Date', niceDate(doc.date)]]);
    y -= 6;
    wrap(tpl.fine, italic, 7, CW).forEach(function(line){ need(9); y -= 8.5; draw(line, M, y, 7, italic, GREY); });

    pdf.getPages().forEach(function(p, i, all){
      var footer = 'Splash & Dash  |  Quote ' + doc.number + (all.length > 1 ? '  |  Page ' + (i + 1) + ' of ' + all.length : '');
      p.drawText(safe(footer), {x: W / 2 - width(safe(footer), regular, 7) / 2, y: 18, size: 7, font: regular, color: GREY});
    });
    return pdf.save();
  }

  window.StaffQuote = {
    supports: function(service){ return !!TEMPLATES[service]; },
    builder: builder,
    renderPdf: renderPdf
  };
})();
