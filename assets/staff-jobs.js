// Jobs calendar for the staff page: booked work by day, who's doing it, and won quotes that still
// need a date. Data lives in Supabase (the "Jobs" part of supabase/schema.sql). Times are shown in
// the browser's own time zone.
(function(){
  var SERVICES = [['vinyl','Vinyl wrap'], ['ceramic','Ceramic coating'], ['correction','Paint correction'], ['wash','Wash / detail'], ['other','Other']];
  var STATUSES = [['scheduled','Scheduled'], ['in_progress','In progress'], ['done','Done'], ['cancelled','Cancelled']];
  // Typical length of each kind of job in hours, used to suggest an end time. Staff can change it.
  var HOURS = {wash:2, correction:8, ceramic:24, vinyl:48, other:2};

  function label(list, id){ var hit = list.filter(function(x){ return x[0] === id; })[0]; return hit ? hit[1] : id; }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  // datetime-local inputs take local time as YYYY-MM-DDTHH:MM.
  function toInput(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function startOfDay(d){ var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n){ var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function startOfWeek(d){ var x = startOfDay(d); return addDays(x, -((x.getDay() + 6) % 7)); }   // weeks start on Monday
  function sameDay(a, b){ return a.toDateString() === b.toDateString(); }
  function time(d){ return d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}); }
  function dayName(d){ return d.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'}); }
  function money(n){ return '$' + Number(n).toLocaleString('en-US', {maximumFractionDigits: 2}); }
  function overlapsDay(job, day){ return new Date(job.starts_at) < addDays(day, 1) && new Date(job.ends_at) > day; }
  // When a job runs on this day, as a short label for its card.
  function timeOn(job, day){
    var s = new Date(job.starts_at), e = new Date(job.ends_at);
    var starts = sameDay(s, day), ends = e <= addDays(day, 1);
    if (starts && ends) return time(s) + ' – ' + time(e);
    if (starts) return 'From ' + time(s);
    if (ends) return 'Until ' + time(e);
    return 'All day';
  }
  function whenText(job){
    var s = new Date(job.starts_at), e = new Date(job.ends_at);
    return dayName(s) + ', ' + time(s) + ' – ' + (sameDay(s, new Date(e - 1)) ? '' : dayName(e) + ', ') + time(e);
  }

  function mount(ctx){
    var el = ctx.el, client = ctx.client;
    var jobs = [], staff = [], weekStart = startOfWeek(new Date()), who = 'all', missing = false;

    // ---------- layout ----------
    var whoGroup = el('div', {className:'chips', role:'group', 'aria-labelledby':'calWhoLabel'});
    var readyBox = el('div');
    var rangeLabel = el('h2', {className:'cal-range', 'aria-live':'polite'});
    var grid = el('div', {className:'cal-week'});
    var nav = el('div', {className:'cal-nav'},
      el('button', {type:'button', className:'ghost', 'aria-label':'Previous week', text:'‹', on:{click:function(){ weekStart = addDays(weekStart, -7); renderWeek(); }}}),
      el('button', {type:'button', className:'ghost', text:'This week', on:{click:function(){ weekStart = startOfWeek(new Date()); renderWeek(); }}}),
      el('button', {type:'button', className:'ghost', 'aria-label':'Next week', text:'›', on:{click:function(){ weekStart = addDays(weekStart, 7); renderWeek(); }}}),
      rangeLabel);
    ctx.root.append(
      el('div', {className:'page-head'},
        el('h1', {text:'Calendar'}), el('span', {className:'spacer'}),
        el('button', {type:'button', className:'ghost', text:'Refresh', on:{click:function(){ load(); }}}),
        el('button', {type:'button', className:'btn-primary', text:'+ New job', on:{click:function(){ openEditor(newJob({})); }}}),
        el('p', {text:'Booked work for the week and who\'s doing it. Click a job to change it, or a day\'s + to add one.'})),
      el('div', {className:'card filter-card'},
        el('div', {className:'filter-row'}, el('span', {className:'filter-label', id:'calWhoLabel', text:'Who'}), whoGroup)),
      readyBox, nav, grid);

    var dialog = el('dialog', {className:'card job-dialog', 'aria-labelledby':'jobDialogTitle'});
    document.body.append(dialog);

    // ---------- data ----------
    async function load(){
      var results = await Promise.all([
        client.from('jobs').select('*').order('starts_at', {ascending:false}).limit(2000),
        client.from('staff').select('user_id,name')
      ]);
      missing = !!results[0].error;
      jobs = missing ? [] : results[0].data;
      staff = (results[1].data || []).slice().sort(function(a, b){ return staffLabel(a.user_id).localeCompare(staffLabel(b.user_id)); });
      render();
      if (ctx.onChange) ctx.onChange();
    }
    function staffLabel(id){
      var s = staff.filter(function(x){ return x.user_id === id; })[0];
      return s ? ((s.name || '').trim() || 'Staff member') : '';
    }
    function liveJobs(){ return jobs.filter(function(j){ return j.status !== 'cancelled'; }); }
    function jobsForQuote(id){ return jobs.filter(function(j){ return j.quote_id === id; }).sort(function(a, b){ return new Date(a.starts_at) - new Date(b.starts_at); }); }
    // Quotes won in the last 60 days with no job booked yet (cancelled jobs don't count). Older wins
    // drop off so work done without the calendar doesn't linger here forever.
    function unscheduled(){
      var booked = {}, since = Date.now() - 60 * 864e5;
      liveJobs().forEach(function(j){ if (j.quote_id) booked[j.quote_id] = true; });
      return ctx.getQuotes().filter(function(q){ return q.outcome === 'won' && !booked[q.id] && new Date(q.decided_at || 0) >= since; })
        .sort(function(a, b){ return new Date(b.decided_at || 0) - new Date(a.decided_at || 0); });
    }

    // ---------- rendering ----------
    function render(){ renderWho(); renderReady(); renderWeek(); }
    function renderWho(){
      var options = [['all', 'Everyone']].concat(staff.map(function(s){ return [s.user_id, staffLabel(s.user_id)]; }), [['none', 'Unassigned']]);
      if (!options.some(function(o){ return o[0] === who; })) who = 'all';
      whoGroup.replaceChildren.apply(whoGroup, options.map(function(o){
        return el('button', {type:'button', className:'chip', 'aria-pressed': String(o[0] === who), text:o[1],
          on:{click:function(){ who = o[0]; renderWho(); renderWeek(); }}});
      }));
    }
    function renderReady(){
      var ready = missing ? [] : unscheduled();
      if (!ready.length) { readyBox.replaceChildren(); return; }
      var card = el('section', {className:'card widget cal-ready', 'aria-labelledby':'calReadyTitle'},
        el('div', {className:'widget-head'}, el('h2', {id:'calReadyTitle', text:'Won, not scheduled yet'})));
      ready.slice(0, 8).forEach(function(q){
        card.append(el('div', {className:'row'},
          el('button', {type:'button', className:'row-main', on:{click:function(){ ctx.openQuote(q.id); }}},
            el('span', {className:'row-title', text:q.customer_name}),
            el('span', {className:'row-sub', text:[label(SERVICES, q.service), q.vehicle, q.won_amount != null ? money(q.won_amount) : ''].filter(Boolean).join(' · ')})),
          el('button', {type:'button', className:'ghost row-action', text:'Schedule', on:{click:function(){ scheduleQuote(q); }}})));
      });
      if (ready.length > 8) card.append(el('p', {className:'widget-foot', text:'And ' + (ready.length - 8) + ' more. Open them from Quotes → Won.'}));
      readyBox.replaceChildren(card);
    }
    function renderWeek(){
      var end = addDays(weekStart, 6);
      // "Nov 9 – 15, 2026", or "Nov 30 – Dec 6, 2026" across months.
      var month = function(d){ return d.toLocaleDateString([], {month:'short'}); };
      rangeLabel.textContent = month(weekStart) + ' ' + weekStart.getDate() +
        (weekStart.getFullYear() !== end.getFullYear() ? ', ' + weekStart.getFullYear() : '') + ' – ' +
        (end.getMonth() !== weekStart.getMonth() ? month(end) + ' ' : '') + end.getDate() + ', ' + end.getFullYear();
      if (missing) {
        grid.replaceChildren(el('p', {className:'card list-empty cal-missing', text:'The calendar isn\'t set up yet. Run the "Won/lost, revenue, jobs calendar" section of supabase/schema.sql in Supabase, then Refresh.'}));
        return;
      }
      var shown = jobs.filter(function(j){ return who === 'all' || (who === 'none' ? !j.assigned_to : j.assigned_to === who); });
      var today = new Date();
      var days = [0, 1, 2, 3, 4, 5, 6].map(function(i){ return addDays(weekStart, i); });
      grid.replaceChildren.apply(grid, days.map(function(day){
        var list = shown.filter(function(j){ return overlapsDay(j, day); }).sort(function(a, b){ return new Date(a.starts_at) - new Date(b.starts_at); });
        var isToday = sameDay(day, today);
        var col = el('section', {className:'card cal-day' + (isToday ? ' today' : ''), 'aria-label': day.toLocaleDateString([], {weekday:'long', month:'long', day:'numeric'}) + (isToday ? ' (today)' : '')},
          el('div', {className:'cal-day-head'},
            el('span', {className:'cal-dow', text: day.toLocaleDateString([], {weekday:'short'})}),
            el('span', {className:'cal-date', text: String(day.getDate())}),
            el('button', {type:'button', className:'cal-add', 'aria-label':'Add a job on ' + dayName(day), text:'+', on:{click:function(){
              var start = new Date(day); start.setHours(9, 0, 0, 0);
              openEditor(newJob({starts_at: start.toISOString()}));
            }}})));
        if (!list.length) col.append(el('p', {className:'cal-empty', text:'No jobs'}));
        list.forEach(function(j){ col.append(card(j, day)); });
        return col;
      }));
    }
    function card(job, day){
      var person = staffLabel(job.assigned_to);
      return el('button', {type:'button', className:'job-card job-' + job.status, on:{click:function(){ openEditor(job); }}},
        el('span', {className:'job-time', text:timeOn(job, day)}),
        el('span', {className:'job-name', text:job.customer_name}),
        el('span', {className:'job-sub', text:[label(SERVICES, job.service), job.vehicle].filter(Boolean).join(' · ')}),
        el('span', {className:'job-foot'},
          el('span', {className:'pill job-' + job.status, text:label(STATUSES, job.status)}),
          el('span', {text: person || 'Unassigned'})));
    }

    // ---------- add / edit ----------
    function newJob(prefill){
      var start = prefill.starts_at ? new Date(prefill.starts_at) : (function(){ var d = addDays(startOfDay(new Date()), 1); d.setHours(9, 0, 0, 0); return d; })();
      var service = prefill.service || 'other';
      return Object.assign({service: service, status: 'scheduled', customer_name: '', starts_at: start.toISOString(),
        ends_at: new Date(+start + HOURS[service] * 36e5).toISOString()}, prefill, {id: null});
    }
    function scheduleQuote(q){
      var email = (q.email || '').toLowerCase();
      var person = email ? ctx.getCustomers().filter(function(c){ return c.email === email; })[0] : null;
      openEditor(newJob({quote_id: q.id, customer_id: person ? person.id : null, customer_name: q.customer_name,
        phone: q.phone || (person && person.phone) || '', vehicle: q.vehicle || '', service: q.service, price: q.won_amount}));
    }

    function field(id, text, control, hint){
      control.id = id;
      return el('div', {className:'qb-field'}, el('label', {htmlFor:id, text:text}), control, hint ? el('span', {className:'qb-hint', text:hint}) : null);
    }
    function select(options, value){
      var s = el('select');
      options.forEach(function(o){ s.append(el('option', {value:o[0], text:o[1], selected:o[0] === value})); });
      return s;
    }

    function openEditor(job){
      var editing = !!job.id;
      var customerId = job.customer_id || null;
      var names = el('datalist', {id:'jobCustomers'});
      ctx.getCustomers().slice(0, 1000).forEach(function(c){ names.append(el('option', {value:c.name})); });
      var name = el('input', {type:'text', required:true, maxLength:200, value:job.customer_name || '', autocomplete:'off'});
      name.setAttribute('list', 'jobCustomers');
      var phone = el('input', {type:'tel', maxLength:60, value:job.phone || ''});
      var vehicle = el('input', {type:'text', maxLength:200, value:job.vehicle || '', placeholder:'e.g., 2021 Toyota 4Runner'});
      var service = select(SERVICES, job.service);
      var start = el('input', {type:'datetime-local', required:true, value:toInput(new Date(job.starts_at)), step:900});
      var end = el('input', {type:'datetime-local', required:true, value:toInput(new Date(job.ends_at)), step:900});
      var assigned = select([['', 'Unassigned']].concat(staff.map(function(s){ return [s.user_id, staffLabel(s.user_id)]; })), job.assigned_to || '');
      var status = select(STATUSES, job.status);
      var price = el('input', {type:'number', min:'0', step:'0.01', value: job.price != null ? String(job.price) : ''});
      var notes = el('textarea', {rows:3, maxLength:10000, value:job.notes || '', placeholder:'Bay, drop-off details, anything the team should know'});
      var linked = el('span', {className:'qb-hint'});
      var note = el('p', {className:'note', role:'status'});
      var endTouched = editing;

      function showLink(){
        var c = customerId && ctx.getCustomers().filter(function(x){ return x.id === customerId; })[0];
        linked.textContent = c ? 'Linked to ' + c.name + ' on the customer list.' : '';
      }
      // Picking a known name links the job to that person (and fills in their phone).
      name.addEventListener('input', function(){
        var v = name.value.trim().toLowerCase();
        var c = ctx.getCustomers().filter(function(x){ return x.name.toLowerCase() === v; })[0];
        customerId = c ? c.id : (job.quote_id ? job.customer_id : null);
        if (c && !phone.value.trim() && c.phone) phone.value = c.phone;
        showLink();
      });
      var lastStart = new Date(start.value);
      start.addEventListener('change', function(){
        var s = new Date(start.value);
        if (isNaN(s)) return;
        // Moving the start keeps the job's length.
        var e = new Date(end.value), len = !isNaN(e) && !isNaN(lastStart) ? e - lastStart : HOURS[service.value] * 36e5;
        end.value = toInput(new Date(+s + Math.max(len, 15 * 6e4)));
        lastStart = s;
      });
      end.addEventListener('change', function(){ endTouched = true; });
      service.addEventListener('change', function(){
        if (endTouched) return;
        var s = new Date(start.value);
        if (!isNaN(s)) end.value = toInput(new Date(+s + HOURS[service.value] * 36e5));
      });
      showLink();

      var form = el('form', {className:'qb'},
        el('div', {className:'job-dialog-head'},
          el('h2', {id:'jobDialogTitle', text: editing ? 'Edit job' : 'New job'}),
          el('button', {type:'button', className:'ghost theme-btn', 'aria-label':'Close', text:'×', on:{click:close}})),
        el('div', {className:'qb-grid'}, field('jobName', 'Customer', name), field('jobPhone', 'Phone', phone)),
        linked,
        el('div', {className:'qb-grid'}, field('jobVehicle', 'Vehicle', vehicle), field('jobService', 'Service', service)),
        el('div', {className:'qb-grid'}, field('jobStart', 'Starts', start), field('jobEnd', 'Ends', end, editing ? '' : 'Suggested from the service. Change it if needed.')),
        el('div', {className:'qb-grid'}, field('jobAssigned', 'Who\'s doing it', assigned), field('jobStatus', 'Status', status), field('jobPrice', 'Price ($)', price, job.quote_id && job.price != null && !editing ? 'From the won quote.' : '')),
        field('jobNotes', 'Notes', notes),
        el('div', {className:'reply-actions'},
          el('button', {type:'submit', className:'btn-primary', text: editing ? 'Save changes' : 'Add to calendar'}),
          el('button', {type:'button', className:'ghost', text:'Cancel', on:{click:close}}),
          job.quote_id ? el('button', {type:'button', className:'ghost', text:'Open quote', on:{click:function(){ close(); ctx.openQuote(job.quote_id); }}}) : null,
          editing ? el('button', {type:'button', className:'text-link danger', text:'Delete job', on:{click:remove}}) : null),
        note, names);

      function fail(text){ note.className = 'note error'; note.textContent = text; }
      async function remove(){
        if (!confirm('Delete this job for ' + job.customer_name + '? To keep a record, set its status to Cancelled instead.')) return;
        var result = await client.from('jobs').delete().eq('id', job.id);
        if (result.error) return fail('Couldn\'t delete the job. Please try again.');
        jobs = jobs.filter(function(j){ return j.id !== job.id; });
        close(); render(); saved(job);
      }
      form.addEventListener('submit', async function(event){
        event.preventDefault();
        var s = new Date(start.value), e = new Date(end.value);
        if (!name.value.trim()) return fail('Add the customer\'s name.');
        if (isNaN(s) || isNaN(e)) return fail('Pick when the job starts and ends.');
        if (e <= s) return fail('The job has to end after it starts.');
        if (price.value !== '' && !(Number(price.value) >= 0)) return fail('Enter a price of $0 or more, or leave it blank.');
        var row = {
          quote_id: job.quote_id || null, customer_id: customerId, customer_name: name.value.trim(), phone: phone.value.trim() || null,
          vehicle: vehicle.value.trim() || null, service: service.value, starts_at: s.toISOString(), ends_at: e.toISOString(),
          assigned_to: assigned.value || null, status: status.value, price: price.value === '' ? null : Number(price.value), notes: notes.value.trim() || null
        };
        // Warn (but allow) double-booking the same person.
        if (row.assigned_to && row.status !== 'cancelled') {
          var clash = liveJobs().filter(function(j){
            return j.id !== job.id && j.assigned_to === row.assigned_to && new Date(j.starts_at) < e && new Date(j.ends_at) > s;
          })[0];
          if (clash && !confirm(staffLabel(row.assigned_to) + ' already has a job then: ' + clash.customer_name + ', ' + whenText(clash) + '. Save anyway?')) return;
        }
        var button = form.querySelector('button[type=submit]');
        button.disabled = true; note.className = 'note'; note.textContent = '';
        var result = editing
          ? await client.from('jobs').update(row).eq('id', job.id).select().single()
          : await client.from('jobs').insert(row).select().single();
        button.disabled = false;
        if (result.error) return fail('Couldn\'t save the job. Please try again.');
        jobs = jobs.filter(function(j){ return j.id !== result.data.id; }).concat([result.data]);
        weekStart = startOfWeek(new Date(result.data.starts_at));
        close(); render(); saved(result.data);
      });

      function close(){ if (dialog.open) dialog.close(); }
      dialog.replaceChildren(form);
      dialog.showModal();
      // New jobs start at the name; existing ones keep focus on Close so phones don't pop up the keyboard.
      if (!editing) name.focus();
    }
    // Lets the rest of the page catch up (quote detail, dashboard, customer stages changed by the database).
    function saved(job){ if (ctx.onSaved) ctx.onSaved(job); if (ctx.onChange) ctx.onChange(); }

    async function setStatus(job, value){
      var result = await client.from('jobs').update({status: value}).eq('id', job.id).select().single();
      if (result.error) { alert('Couldn\'t update the job. Please try again.'); return; }
      jobs = jobs.map(function(j){ return j.id === job.id ? result.data : j; });
      render(); saved(result.data);
    }

    render();
    return {
      refresh: load,
      render: render,
      getJobs: function(){ return jobs; },
      isReady: function(){ return !missing; },
      staffLabel: staffLabel,
      jobsForQuote: jobsForQuote,
      unscheduled: unscheduled,
      whenText: whenText,
      timeOn: timeOn,
      statusLabel: function(s){ return label(STATUSES, s); },
      serviceLabel: function(s){ return label(SERVICES, s); },
      openJob: function(id){ var j = jobs.filter(function(x){ return x.id === id; })[0]; if (j) openEditor(j); },
      scheduleQuote: scheduleQuote,
      setStatus: setStatus,
      showWeekOf: function(date){ weekStart = startOfWeek(date || new Date()); renderWeek(); }
    };
  }

  window.StaffJobs = {mount: mount};
})();
