// Customer list for the staff page: potential and current clients, whether they're interested,
// and a log of every call, text, email or visit. Data lives in Supabase (supabase/schema.sql).
(function(){
  var STAGES = [['potential','Potential client'], ['contacted','Contacted'], ['booked','Booked'], ['client','Client']];
  var INTEREST = [['interested','Interested'], ['not_interested','Not interested'], ['unknown','Not sure yet']];
  var METHODS = [['call','Call'], ['text','Text'], ['email','Email'], ['in_person','In person']];
  var OUTCOMES = [['reached','Reached them'], ['no_answer','No answer'], ['left_message','Left a message']];
  var SERVICE_NAMES = {vinyl:'Vinyl wrap', ceramic:'Ceramic coating', correction:'Paint correction', other:'Custom quote'};
  var QUOTE_TYPES = [['vinyl','Vinyl wrap'], ['ceramic','Ceramic coating'], ['correction','Paint correction'], ['other','Custom']];
  var QUOTE_STATUS = {open:'Needs reply', waiting:'Waiting', closed:'Closed'};
  var QUOTE_OUTCOME = {won:'Won', lost:'Lost'};
  function label(list, id){ var hit = list.filter(function(x){ return x[0] === id; })[0]; return hit ? hit[1] : id; }

  function mount(ctx){
    var el = ctx.el, client = ctx.client;
    var customers = [], stageFilter = 'all', interestFilter = 'all', search = '', selectedId = null, loaded = false, flash = null;

    // ---------- layout: page heading, one filter card, then the list and details ----------
    var stageGroup = el('div', {className:'chips', role:'tablist', 'aria-labelledby':'stageLabel'});
    var interestGroup = el('div', {className:'chips', role:'group', 'aria-labelledby':'interestLabel'});
    var searchBox = el('input', {type:'search', className:'cust-search', id:'customerSearch', placeholder:'Name, phone or email'});
    searchBox.addEventListener('input', function(){ search = searchBox.value.trim().toLowerCase(); renderList(); });
    var addBtn = el('button', {type:'button', className:'btn-primary', text:'+ Add person', on:{click:function(){ selectedId = null; renderList(); renderDetail(addForm()); }}});
    var refreshBtn = el('button', {type:'button', className:'ghost', text:'Refresh', on:{click:function(){ load().then(function(){ if (selectedId) open(selectedId); }); }}});
    var list = el('div', {className:'card list', 'aria-label':'Customers'});
    var detail = el('section', {className:'card detail', 'aria-live':'polite'});
    var panes = el('div', {className:'panes'}, list, detail);
    function filterRow(id, text, control){
      var label = control.tagName === 'INPUT'
        ? el('label', {className:'filter-label', id:id, htmlFor:control.id, text:text})
        : el('span', {className:'filter-label', id:id, text:text});
      return el('div', {className:'filter-row'}, label, control);
    }
    ctx.root.append(
      el('div', {className:'page-head'},
        el('h1', {text:'Customers'}), el('span', {className:'spacer'}), refreshBtn, addBtn,
        el('p', {text:'Everyone who asked for a quote, plus people staff add. Track who\'s interested and log every call or text.'})),
      el('div', {className:'card filter-card'},
        filterRow('stageLabel', 'Stage', stageGroup),
        filterRow('interestLabel', 'Interest', interestGroup),
        filterRow('searchLabel', 'Search', searchBox)),
      panes);

    function count(key, value){ return customers.filter(function(c){ return value === 'all' || c[key] === value; }).length; }
    function renderFilters(){
      stageGroup.replaceChildren.apply(stageGroup, [['all', 'Everyone']].concat(STAGES).map(function(o){
        var n = count('stage', o[0]);
        return el('button', {type:'button', className:'chip', role:'tab', 'aria-selected': String(o[0] === stageFilter),
          on:{click:function(){ stageFilter = o[0]; renderFilters(); renderList(); }}},
          o[1], el('span', {className:'count' + (o[0] === 'all' ? '' : ' stage-' + o[0]), 'aria-label': n + ' people', text: n ? String(n) : ''}));
      }));
      interestGroup.replaceChildren.apply(interestGroup, [['all', 'Any interest']].concat(INTEREST).map(function(o){
        var n = count('interest', o[0]);
        return el('button', {type:'button', className:'chip', 'aria-pressed': String(o[0] === interestFilter),
          on:{click:function(){ interestFilter = o[0]; renderFilters(); renderList(); }}},
          o[1], el('span', {className:'count' + (o[0] === 'all' ? '' : ' interest-' + o[0]), 'aria-label': n + ' people', text: n ? String(n) : ''}));
      }));
    }

    // ---------- data ----------
    async function load(){
      var result = await client.from('customers').select('*').order('created_at', {ascending:false}).limit(2000);
      if (result.error) { list.replaceChildren(el('p', {className:'list-empty', text:'Couldn\'t load the customer list. Try Refresh.'})); return; }
      customers = result.data;
      loaded = true;
      renderFilters(); renderList(); changed();
    }
    function changed(){ if (ctx.onChange) ctx.onChange(); }
    function replace(row){
      var found = false;
      customers = customers.map(function(c){ if (c.id === row.id) { found = true; return row; } return c; });
      if (!found) customers.unshift(row);
      renderFilters(); renderList(); changed();
    }
    function quotesFor(c){
      return c.email ? ctx.getQuotes().filter(function(q){ return (q.email || '').toLowerCase() === c.email; }) : [];
    }

    // ---------- list ----------
    function renderList(){
      var shown = customers.filter(function(c){
        if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
        if (interestFilter !== 'all' && c.interest !== interestFilter) return false;
        return !search || [c.name, c.phone, c.email].some(function(v){ return (v || '').toLowerCase().indexOf(search) >= 0; });
      });
      if (!shown.length) {
        list.replaceChildren(el('p', {className:'list-empty', text: customers.length ? 'Nobody matches these filters.' : 'No customers yet. People who send a quote request show up here, or use Add person.'}));
        return;
      }
      list.replaceChildren.apply(list, shown.map(function(c){
        return el('button', {type:'button', className:'item', 'aria-current': String(c.id === selectedId), on:{click:function(){ open(c.id); }}},
          el('div', {className:'item-top'},
            el('span', {className:'item-name', text:c.name}),
            el('span', {className:'item-date', text: c.last_contacted_at ? 'Contacted ' + ctx.when(c.last_contacted_at) : 'Not contacted'})),
          el('div', {className:'item-sub'},
            el('span', {className:'pill stage-' + c.stage, text:label(STAGES, c.stage)}),
            el('span', {className:'pill interest-' + c.interest, text:label(INTEREST, c.interest)}),
            el('span', {text:c.phone || c.email || ''})));
      }));
    }

    // ---------- detail ----------
    function renderDetail(content){
      panes.classList.toggle('showing-detail', !!content);
      if (!content) { detail.replaceChildren(el('div', {className:'detail-empty', text:'Pick a person to see their status and contact history, or add someone new.'})); return; }
      detail.replaceChildren(content);
      detail.scrollTop = 0;
    }
    function back(){ return el('button', {type:'button', className:'ghost back', text:'← All customers', on:{click:function(){ selectedId = null; renderList(); renderDetail(null); }}}); }
    function note(){ return el('p', {className:'note', role:'status'}); }
    function fail(node, text){ node.className = 'note error'; node.textContent = text; }
    function done(node, text){ node.className = 'note'; node.textContent = text; }
    function field(id, labelText, control){ control.id = id; return el('div', {className:'qb-field'}, el('label', {htmlFor:id, text:labelText}), control); }
    function select(options, value){
      var s = el('select');
      options.forEach(function(o){ s.append(el('option', {value:o[0], text:o[1], selected:o[0] === value})); });
      return s;
    }
    function cleanEmail(v){ v = v.trim().toLowerCase(); return v || null; }
    function saveError(error){
      return error && error.code === '23505' ? 'Someone with that email is already on the list.' : 'Couldn\'t save. Please try again.';
    }

    async function open(id){
      selectedId = id;
      renderList();
      var c = customers.filter(function(x){ return x.id === id; })[0];
      if (!c) { renderDetail(null); return; }
      var contacts = await client.from('customer_contacts').select('*').eq('customer_id', id).order('created_at', {ascending:false});
      if (selectedId !== id) return;
      renderDetail(view(c, contacts.data || []));
    }

    function segmented(options, value, onPick){
      var group = el('div', {className:'status-actions', role:'group'});
      options.forEach(function(o){
        group.append(el('button', {type:'button', className:'ghost', 'aria-pressed': String(o[0] === value), text:o[1], on:{click:function(){
          group.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', String(b === this)); }, this);
          onPick(o[0]);
        }}}));
      });
      return group;
    }

    function view(c, contacts){
      var wrap = el('div');
      wrap.append(back());

      var links = el('div', {className:'cust-links'});
      if (c.phone) {
        var digits = c.phone.replace(/[^\d+]/g, '');
        links.append(el('a', {className:'ghost', href:'tel:' + digits, text:'Call'}), el('a', {className:'ghost', href:'sms:' + digits, text:'Text'}));
      }
      if (c.email) links.append(el('a', {className:'ghost', href:'mailto:' + c.email, text:'Email'}));
      wrap.append(el('div', {className:'detail-head'},
        el('div', null,
          el('h2', {text:c.name}),
          el('div', {className:'contact'},
            c.phone ? el('span', {text:c.phone}) : null,
            c.email ? el('span', {text:c.email}) : null,
            el('span', {text:'Added ' + ctx.whenLong(c.created_at) + (c.source === 'quote' ? ' from a quote request' : c.added_by ? ' by ' + c.added_by : '')}))),
        links));

      // Stage and interest save as soon as staff click.
      var statusNote = note();
      async function setField(key, value){
        var patch = {}; patch[key] = value;
        var result = await client.from('customers').update(patch).eq('id', c.id).select().single();
        if (result.error) return fail(statusNote, 'Couldn\'t save. Please try again.');
        c = result.data; replace(c); done(statusNote, 'Saved.');
      }
      wrap.append(el('h3', {className:'detail-label', text:'Status'}),
        el('div', {className:'cust-status'},
          el('div', null, el('span', {className:'cust-status-label', text:'Stage'}), segmented(STAGES, c.stage, function(v){ setField('stage', v); })),
          el('div', null, el('span', {className:'cust-status-label', text:'Interest'}), segmented(INTEREST, c.interest, function(v){ setField('interest', v); }))),
        statusNote);

      // Create a quote for this person (a service template or Custom line items) and email it as a PDF.
      var quoteArea = el('div');
      var startQuote = el('button', {type:'button', className:'btn-primary', text:'Create a quote', on:{click:function(){
        startQuote.hidden = true; quoteArea.replaceChildren(quotePicker(c));
      }}});
      wrap.append(el('h3', {className:'detail-label', text:'Create a quote'}));
      if (flash && flash.id === c.id) { wrap.append(el('p', {className:'note cust-flash', role:'status', text:flash.text})); flash = null; }
      wrap.append(el('p', {className:'thread-empty', text:'Build a quote for the work ' + c.name.split(' ')[0] + ' wants and email it as a PDF. Their reply shows up under Quotes.'}), startQuote, quoteArea);

      // Log a contact
      var method = select(METHODS, 'call'), outcome = select(OUTCOMES, 'reached');
      var logNote = el('textarea', {rows:3, maxLength:4000, placeholder:'What did you talk about? Next steps?'});
      var logStatus = note();
      var logForm = el('form', {className:'qb'},
        el('div', {className:'qb-grid'}, field('logMethod', 'How', method), field('logOutcome', 'Result', outcome)),
        field('logNote', 'Note', logNote),
        el('div', {className:'reply-actions'}, el('button', {type:'submit', className:'ghost', text:'Log contact'}), logStatus));
      logForm.addEventListener('submit', async function(event){
        event.preventDefault();
        var button = logForm.querySelector('button[type=submit]');
        button.disabled = true;
        var result = await client.from('customer_contacts').insert({customer_id: c.id, method: method.value, outcome: outcome.value, note: logNote.value.trim() || null});
        button.disabled = false;
        if (result.error) return fail(logStatus, 'Couldn\'t log that. Please try again.');
        // The database stamps last-contacted and moves potential clients to Contacted; reload to show it.
        var fresh = await client.from('customers').select('*').eq('id', c.id).single();
        if (fresh.data) replace(fresh.data);
        open(c.id);
      });
      wrap.append(el('h3', {className:'detail-label', text:'Log a contact'}), logForm);

      // History
      wrap.append(el('h3', {className:'detail-label', text:'Contact history'}));
      if (!contacts.length) wrap.append(el('p', {className:'thread-empty', text:'Nobody has logged a contact with ' + c.name.split(' ')[0] + ' yet.'}));
      else {
        var history = el('ul', {className:'cust-history'});
        contacts.forEach(function(h){
          history.append(el('li', null,
            el('div', {className:'msg-meta', text: label(METHODS, h.method) + ' · ' + label(OUTCOMES, h.outcome) + ' · ' + h.author + ' · ' + ctx.whenLong(h.created_at)}),
            h.note ? el('div', {className:'msg-body', text:h.note}) : null));
        });
        wrap.append(history);
      }

      // Their quotes, matched by email
      var theirQuotes = quotesFor(c);
      if (theirQuotes.length) {
        wrap.append(el('h3', {className:'detail-label', text:'Quotes'}));
        var ql = el('div', {className:'cust-quotes'});
        theirQuotes.forEach(function(q){
          ql.append(el('button', {type:'button', className:'ghost', text:(SERVICE_NAMES[q.service] || 'Quote') + ' · ' + ctx.when(q.created_at) + (q.vehicle ? ' · ' + q.vehicle : '') + ' · ' + (q.outcome ? QUOTE_OUTCOME[q.outcome] : QUOTE_STATUS[q.status]), on:{click:function(){ ctx.openQuote(q.id); }}}));
        });
        wrap.append(ql);
      }

      // Details
      var name = el('input', {type:'text', value:c.name, required:true, maxLength:200});
      var phone = el('input', {type:'text', value:c.phone || '', maxLength:60});
      var email = el('input', {type:'email', value:c.email || '', maxLength:200});
      var notes = el('textarea', {rows:4, maxLength:10000, value:c.notes || ''});
      var detailStatus = note();
      var details = el('form', {className:'qb'},
        el('div', {className:'qb-grid'}, field('custName', 'Name', name), field('custPhone', 'Phone', phone), field('custEmail', 'Email', email)),
        field('custNotes', 'Notes', notes),
        el('div', {className:'reply-actions'},
          el('button', {type:'submit', className:'ghost', text:'Save changes'}),
          el('button', {type:'button', className:'text-link danger', text:'Remove from list', on:{click: async function(){
            if (!confirm('Remove ' + c.name + ' and their contact history from the customer list? Their quote requests are kept.')) return;
            var result = await client.from('customers').delete().eq('id', c.id);
            if (result.error) return fail(detailStatus, 'Couldn\'t remove them. Please try again.');
            customers = customers.filter(function(x){ return x.id !== c.id; });
            selectedId = null; renderFilters(); renderList(); renderDetail(null); changed();
          }}}),
          detailStatus));
      details.addEventListener('submit', async function(event){
        event.preventDefault();
        if (!name.value.trim()) return fail(detailStatus, 'Add a name.');
        if (!phone.value.trim() && !email.value.trim()) return fail(detailStatus, 'Add a phone number or email so staff can reach them.');
        var result = await client.from('customers').update({name: name.value.trim(), phone: phone.value.trim() || null, email: cleanEmail(email.value), notes: notes.value.trim() || null}).eq('id', c.id).select().single();
        if (result.error) return fail(detailStatus, saveError(result.error));
        replace(result.data); open(c.id);
      });
      wrap.append(el('h3', {className:'detail-label', text:'Details'}), details);
      return wrap;
    }

    // Pick the kind of quote, then fill in the matching template (assets/staff-quote.js).
    function quotePicker(c){
      var holder = el('div');
      var chips = el('div', {className:'chips', role:'group', 'aria-label':'Kind of quote'});
      QUOTE_TYPES.forEach(function(t){
        chips.append(el('button', {type:'button', className:'chip', 'aria-pressed':'false', text:t[1], on:{click:function(){
          chips.querySelectorAll('.chip').forEach(function(b){ b.setAttribute('aria-pressed', String(b === this)); }, this);
          holder.replaceChildren(StaffQuote.builder({
            quote: {id: c.id, service: t[0], customer_name: c.name, email: c.email || '', phone: c.phone || '', fields: [], files: []},
            // Earlier quotes for this person give the new quote number a -2, -3… suffix.
            messages: quotesFor(c).map(function(){ return {document: true}; }),
            staffName: ctx.staffName(),
            sendBlocked: c.email ? '' : 'Add an email address under Details to send this quote. You can still preview and print the PDF.',
            send: function(payload){ return sendQuote(c, t[0], payload); }
          }));
        }}}));
      });
      var cancel = el('button', {type:'button', className:'ghost', text:'Cancel', on:{click:function(){ open(c.id); }}});
      return el('div', {className:'cust-quote'},
        el('span', {className:'cust-status-label', text:'What kind of quote?'}),
        el('div', {className:'cust-quote-pick'}, chips, cancel), holder);
    }
    async function sendQuote(c, service, payload){
      var token = await ctx.authToken();
      var response = await fetch('/api/staff/quote', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer ' + token},
        body: JSON.stringify(Object.assign({customerId: c.id, service: service}, payload))
      });
      var result = await response.json().catch(function(){ return {}; });
      if (!response.ok) throw new Error(result.message || 'The quote could not be sent.');
      // The new quote lives under Quotes; the logged email may have moved them to Contacted.
      await ctx.reloadQuotes();
      var fresh = await client.from('customers').select('*').eq('id', c.id).single();
      if (fresh.data) replace(fresh.data);
      flash = {id: c.id, text: 'Quote ' + payload.document.number + ' sent to ' + c.email + '. It\'s now under Quotes, and their reply will show up there.'};
      open(c.id);
    }

    function addForm(){
      var name = el('input', {type:'text', required:true, maxLength:200});
      var phone = el('input', {type:'text', maxLength:60});
      var email = el('input', {type:'email', maxLength:200});
      var stage = select(STAGES, 'potential'), interest = select(INTEREST, 'unknown');
      var notes = el('textarea', {rows:4, maxLength:10000, placeholder:'How did they hear about us? What are they interested in?'});
      var status = note();
      var form = el('form', {className:'qb'},
        el('div', {className:'qb-grid'}, field('newName', 'Name', name), field('newPhone', 'Phone', phone), field('newEmail', 'Email', email)),
        el('div', {className:'qb-grid'}, field('newStage', 'Stage', stage), field('newInterest', 'Interest', interest)),
        field('newNotes', 'Notes', notes),
        el('div', {className:'reply-actions'}, el('button', {type:'submit', className:'ghost', text:'Add to list'}), status));
      form.addEventListener('submit', async function(event){
        event.preventDefault();
        if (!name.value.trim()) return fail(status, 'Add a name.');
        if (!phone.value.trim() && !email.value.trim()) return fail(status, 'Add a phone number or email so staff can reach them.');
        var result = await client.from('customers').insert({name: name.value.trim(), phone: phone.value.trim() || null, email: cleanEmail(email.value), stage: stage.value, interest: interest.value, notes: notes.value.trim() || null}).select().single();
        if (result.error) return fail(status, saveError(result.error));
        replace(result.data); open(result.data.id);
      });
      return el('div', null, back(), el('h2', {text:'Add a person'}), el('p', {className:'note', text:'For walk-ins, phone callers, referrals, or anyone staff should follow up with.'}), form);
    }

    renderDetail(null);
    return {
      refresh: load,
      getCustomers: function(){ return customers; },
      openPerson: function(id){ open(id); },
      // Used by the dashboard to land on a filtered list.
      setFilters: function(opts){
        if (opts.stage) stageFilter = opts.stage;
        if (opts.interest) interestFilter = opts.interest;
        search = ''; searchBox.value = '';
        if (!opts.id) { selectedId = null; renderDetail(null); }
        renderFilters(); renderList();
      }
    };
  }

  window.StaffCustomers = {mount: mount};
})();
