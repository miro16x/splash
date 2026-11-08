// Staff dashboard: stat tiles and widgets built from the quotes and customer lists already loaded
// on the staff page. Every tile and row jumps to the matching filtered list.
(function(){
  var SERVICES = [['vinyl','Vinyl Wraps','#1fbfd1'], ['ceramic','Ceramic Coatings','#5aa9e6'], ['correction','Paint Correction','#a582e8']];
  var STAGES = [['potential','Potential client'], ['contacted','Contacted'], ['booked','Booked'], ['client','Client']];
  // Chart series. Colours are CSS variables (light/dark steps in staff.html), checked with the dataviz validator.
  var QUOTE_STATUS = [{key:'open', label:'Needs reply', color:'--viz-open'}, {key:'waiting', label:'Waiting on customer', color:'--viz-waiting'}, {key:'closed', label:'Closed', color:'--viz-closed'}];
  var INTEREST_SERIES = [{key:'interested', label:'Interested', color:'--viz-interested'}, {key:'unknown', label:'Not sure yet', color:'--viz-unsure'}, {key:'not_interested', label:'Not interested', color:'--viz-not'}];
  var SERVICE_NAMES = {vinyl:'vinyl wrap', ceramic:'ceramic coating', correction:'paint correction', other:'quote'};
  var STAGE_NAMES = {potential:'Potential client', contacted:'Contacted', booked:'Booked', client:'Client'};
  var INTEREST_NAMES = {interested:'Interested', not_interested:'Not interested', unknown:'Not sure yet'};
  var METHOD_VERBS = {call:'called', text:'texted', email:'emailed', in_person:'met with'};
  var OUTCOME_NAMES = {reached:'reached them', no_answer:'no answer', left_message:'left a message'};
  var ICONS = {
    reply: '<path d="M4 4h16v12H5.2L4 17.2z"/><path d="M8 9h8M8 12h5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'
  };
  var DAY = 864e5;

  function ago(iso){
    var days = Math.floor((Date.now() - new Date(iso)) / DAY);
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
  }
  function first(name){ return (name || '').split(' ')[0]; }
  function cap(text){ return (text || '').replace(/^./, function(c){ return c.toUpperCase(); }); }
  function money(n){ return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }
  // Short money for axis ticks and column caps: $800, $1.5k, $12k.
  function moneyShort(n){
    n = Math.round(Number(n) || 0);
    if (n < 1000) return '$' + n;
    var k = n / 1000;
    return '$' + (k >= 10 || k === Math.floor(k) ? Math.round(k) : k.toFixed(1)) + 'k';
  }
  var REASON_NAMES = {price:'Price', timing:'Timing', went_elsewhere:'Went elsewhere', no_response:'Stopped replying', not_a_lead:'Not a real lead', other:'Other'};
  function staffShort(email){ var n = (email || 'staff').split('@')[0]; return n.charAt(0).toUpperCase() + n.slice(1); }

  function mount(ctx){
    var el = ctx.el, root = ctx.root, renderToken = 0;

    function icon(name){
      var span = el('span'); span.setAttribute('aria-hidden', 'true');
      span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';
      return span.firstChild;
    }
    function stat(tone, iconName, label, value, hint, onClick){
      var tile = el('button', {type:'button', className:'stat', on:{click:onClick}},
        el('span', {className:'stat-label'}, icon(iconName), label),
        el('span', {className:'stat-value', text:String(value)}),
        el('span', {className:'stat-hint', text:hint}));
      tile.style.setProperty('--tone', tone);
      return tile;
    }
    function widget(title, linkText, onLink, extraClass){
      var body = el('div');
      var card = el('section', {className:'card widget' + (extraClass ? ' ' + extraClass : '')},
        el('div', {className:'widget-head'}, el('h2', {text:title}),
          linkText ? el('button', {type:'button', className:'widget-link', text:linkText, on:{click:onLink}}) : null),
        body);
      return {card: card, body: body};
    }
    function empty(text){ return el('p', {className:'widget-empty', text:text}); }
    function row(main, meta, action, tone){
      var r = el('div', {className:'row'});
      if (tone) { var dot = el('span', {className:'dot'}); dot.style.setProperty('--tone', tone); r.append(dot); }
      r.append(main);
      if (meta) r.append(el('span', {className:'row-meta', text:meta}));
      if (action) r.append(action);
      return r;
    }
    function rowMain(title, subParts, onClick){
      var sub = el('span', {className:'row-sub'});
      subParts.forEach(function(p){ if (p) sub.append(typeof p === 'string' ? el('span', {text:p}) : p); });
      return el('button', {type:'button', className:'row-main', on:{click:onClick}}, el('span', {className:'row-title', text:title}), sub);
    }

    // ---------- charts (stacked bars / columns, built from plain HTML so they stay responsive) ----------
    function niceScale(max){
      var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000];
      var step = steps.filter(function(s){ return Math.ceil(Math.max(max, 1) / s) <= 5; })[0] || 1000000;
      var top = Math.max(step, Math.ceil(max / step) * step), ticks = [];
      for (var t = 0; t <= top; t += step) ticks.push(t);
      return {top: top, ticks: ticks};
    }
    function legend(series){
      var ul = el('ul', {className:'viz-legend'});
      series.forEach(function(s){
        var sw = el('span', {className:'viz-swatch'}); sw.style.background = 'var(' + s.color + ')';
        ul.append(el('li', null, sw, s.label));
      });
      return ul;
    }
    // One tooltip per chart: the category, then every series value-first with a short line key.
    function tooltipFor(box, fmt){
      var tip = el('div', {className:'viz-tip', role:'tooltip', hidden:true});
      box.append(tip);
      return {
        show: function(cat, rows, x, y){
          tip.replaceChildren(el('div', {className:'viz-tip-title', text:cat}));
          rows.forEach(function(r){
            var key = el('span', {className:'viz-tip-key'});
            if (r.color) key.style.background = 'var(' + r.color + ')'; else key.style.visibility = 'hidden';
            tip.append(el('div', {className:'viz-tip-row'}, key, el('strong', {text:fmt(r.value)}), el('span', {text:r.label})));
          });
          tip.hidden = false;
          var bw = box.clientWidth, tw = tip.offsetWidth;
          tip.style.left = Math.max(0, Math.min(bw - tw, x - tw / 2)) + 'px';
          tip.style.top = Math.max(0, y - tip.offsetHeight - 10) + 'px';
        },
        hide: function(){ tip.hidden = true; }
      };
    }
    function hover(target, box, tip, cat, rows){
      function at(event){
        var b = box.getBoundingClientRect();
        if (event && event.clientX != null) tip.show(cat, rows, event.clientX - b.left, event.clientY - b.top);
        else { var t = target.getBoundingClientRect(); tip.show(cat, rows, t.left - b.left + t.width / 2, t.top - b.top + 8); }
      }
      target.addEventListener('pointermove', at);
      target.addEventListener('focus', function(){ at(null); });
      target.addEventListener('pointerleave', tip.hide);
      target.addEventListener('blur', tip.hide);
    }
    function stackedBars(cats, series, value, onPick){
      var box = el('div', {className:'viz'}), tip = tooltipFor(box, String);
      var totals = cats.map(function(c){ return series.reduce(function(sum, s){ return sum + value(c, s); }, 0); });
      var scale = niceScale(Math.max.apply(null, totals));
      var plot = el('div', {className:'hbar-plot'});
      var grid = el('div', {className:'hbar-grid', 'aria-hidden':'true'});
      scale.ticks.forEach(function(t){ var line = el('span'); line.style.left = (t / scale.top * 100) + '%'; grid.append(line); });
      plot.append(grid);
      cats.forEach(function(c, i){
        var rows = series.map(function(s){ return {label:s.label, value:value(c, s), color:s.color}; });
        var stack = el('span', {className:'hbar-stack'}); stack.style.width = (totals[i] / scale.top * 100) + '%';
        rows.forEach(function(r){
          if (!r.value) return;
          var seg = el('span', {className:'hbar-seg'}); seg.style.flexGrow = r.value; seg.style.background = 'var(' + r.color + ')';
          stack.append(seg);
        });
        var name = c.label + ': ' + totals[i] + ' total, ' + rows.map(function(r){ return r.value + ' ' + r.label.toLowerCase(); }).join(', ');
        var row = el('button', {type:'button', className:'hbar-row', 'aria-label':name, on:{click:function(){ onPick(c); }}},
          el('span', {className:'hbar-label', text:c.label}),
          el('span', {className:'hbar-track'}, stack, el('span', {className:'hbar-value', text:String(totals[i])})));
        hover(row, box, tip, c.label, rows);
        plot.append(row);
      });
      var axis = el('div', {className:'hbar-axis', 'aria-hidden':'true'});
      scale.ticks.forEach(function(t){ var lab = el('span', {text:String(t)}); lab.style.left = (t / scale.top * 100) + '%'; axis.append(lab); });
      plot.append(axis);
      box.append(legend(series), plot);
      return box;
    }
    // opts.fmt formats values (money for revenue), opts.unit names what's counted, and
    // opts.tipRows(cat) can add a breakdown under the total in the tooltip.
    function stackedColumns(cats, series, value, onPick, opts){
      opts = opts || {};
      var fmt = opts.fmt || String;
      var box = el('div', {className:'viz'}), tip = tooltipFor(box, fmt);
      var totals = cats.map(function(c){ return series.reduce(function(sum, s){ return sum + value(c, s); }, 0); });
      var scale = niceScale(Math.max.apply(null, totals));
      var yaxis = el('div', {className:'vcol-y', 'aria-hidden':'true'});
      var area = el('div', {className:'vcol-area'});
      var grid = el('div', {className:'vcol-grid', 'aria-hidden':'true'});
      scale.ticks.forEach(function(t){
        var pct = (t / scale.top * 100) + '%';
        var line = el('span'); line.style.bottom = pct; grid.append(line);
        var lab = el('span', {text:opts.axisFmt ? opts.axisFmt(t) : String(t)}); lab.style.bottom = pct; yaxis.append(lab);
      });
      var cols = el('div', {className:'vcol-cols'}), labels = el('div', {className:'vcol-x', 'aria-hidden':'true'});
      cats.forEach(function(c, i){
        var rows = series.map(function(s){ return {label:s.label, value:value(c, s), color:s.color}; });
        var tipRows = opts.tipRows ? rows.concat(opts.tipRows(c)) : rows;
        var stack = el('span', {className:'vcol-stack'}); stack.style.height = (totals[i] / scale.top * 100) + '%';
        rows.forEach(function(r){
          if (!r.value) return;
          var seg = el('span', {className:'vcol-seg'}); seg.style.flexGrow = r.value; seg.style.background = 'var(' + r.color + ')';
          stack.append(seg);
        });
        var capLabel = el('span', {className:'vcol-value', text:opts.capFmt ? opts.capFmt(totals[i]) : fmt(totals[i])}); capLabel.style.bottom = 'calc(' + (totals[i] / scale.top * 100) + '% + 4px)';
        var name = c.label + ': ' + fmt(totals[i]) + (opts.unit ? ' ' + opts.unit : '') + ', ' + tipRows.map(function(r){ return fmt(r.value) + ' ' + r.label.toLowerCase(); }).join(', ');
        var col = el('button', {type:'button', className:'vcol', 'aria-label':name, on:{click:function(){ onPick(c); }}}, stack, capLabel);
        hover(col, box, tip, c.label, tipRows);
        cols.append(col);
        labels.append(el('span', {text:c.label}));
      });
      area.append(grid, cols);
      // One series needs no legend: the widget title names it.
      if (series.length > 1) box.append(legend(series));
      box.append(el('div', {className:'vcol-plot'}, yaxis, area, el('span'), labels));
      return box;
    }
    function dataTable(cats, series, value, fmt){
      fmt = fmt || String;
      var table = el('table', {className:'viz-table'});
      var head = el('tr', null, el('th', {scope:'col', text:''}));
      series.forEach(function(s){ head.append(el('th', {scope:'col', text:s.label})); });
      head.append(el('th', {scope:'col', text:'Total'}));
      table.append(el('thead', null, head));
      var body = el('tbody');
      cats.forEach(function(c){
        var tr = el('tr', null, el('th', {scope:'row', text:c.label})), total = 0;
        series.forEach(function(s){ var v = value(c, s); total += v; tr.append(el('td', {text:fmt(v)})); });
        tr.append(el('td', {text:fmt(total)}));
        body.append(tr);
      });
      table.append(body);
      return table;
    }
    // A widget holding a chart, with a Chart/Table switch so every value is readable without hovering.
    // opts (columns only) is passed to stackedColumns; opts.table {series, value} sets what the table view lists.
    function chartWidget(title, subtitle, linkText, onLink, cats, series, value, form, onPick, emptyText, opts){
      opts = opts || {};
      var w = widget(title, linkText, onLink, opts.wide ? 'wide' : '');
      var hasData = cats.some(function(c){ return series.some(function(s){ return value(c, s) > 0; }); });
      if (opts.before) w.body.append(opts.before);
      w.body.append(el('p', {className:'widget-foot', text:subtitle}));
      if (!hasData) { w.body.append(empty(emptyText)); return w; }
      var chart = form === 'bars' ? stackedBars(cats, series, value, onPick) : stackedColumns(cats, series, value, onPick, opts);
      var table = opts.table ? dataTable(cats, opts.table.series, opts.table.value, opts.fmt) : dataTable(cats, series, value, opts.fmt);
      table.hidden = true;
      var toggle = el('button', {type:'button', className:'widget-link viz-toggle', 'aria-pressed':'false', text:'Table', on:{click:function(){
        var showTable = table.hidden;
        table.hidden = !showTable; chart.hidden = showTable;
        toggle.textContent = showTable ? 'Chart' : 'Table';
        toggle.setAttribute('aria-pressed', String(showTable));
      }}});
      w.card.querySelector('.widget-head').insertBefore(toggle, w.card.querySelector('.widget-head .widget-link'));
      w.body.append(chart, table);
      return w;
    }

    // ---------- jobs ----------
    function nextStepButton(job){
      var step = job.status === 'scheduled' ? ['in_progress', 'Start'] : job.status === 'in_progress' ? ['done', 'Done'] : null;
      if (!step) return null;
      return el('button', {type:'button', className:'ghost row-action', text:step[1], 'aria-label':step[1] + ' ' + job.customer_name + '\'s job',
        on:{click:function(){ ctx.jobs.setStatus(job, step[0]); }}});
    }
    function jobsTodayWidget(){
      var J = ctx.jobs, today = new Date(); today.setHours(0, 0, 0, 0);
      var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      var w = widget('Today\'s jobs', 'Calendar', function(){ ctx.goCalendar(new Date()); });
      if (!J.isReady()) { w.body.append(empty('The calendar isn\'t set up yet (see DEPLOYMENT.md).')); return w; }
      var list = J.getJobs().filter(function(j){ return j.status !== 'cancelled' && new Date(j.starts_at) < tomorrow && new Date(j.ends_at) > today; })
        .sort(function(a, b){ return new Date(a.starts_at) - new Date(b.starts_at); });
      if (!list.length) w.body.append(empty('Nothing booked today.'));
      list.slice(0, 8).forEach(function(j){
        w.body.append(row(
          rowMain(j.customer_name, [J.timeOn(j, today), J.serviceLabel(j.service), j.vehicle, J.staffLabel(j.assigned_to)], function(){ J.openJob(j.id); }),
          J.statusLabel(j.status), nextStepButton(j), j.status === 'done' ? '#1baf7a' : j.status === 'in_progress' ? '#eb6834' : '#2a78d6'));
      });
      if (list.length > 8) w.body.append(el('p', {className:'widget-foot', text:'And ' + (list.length - 8) + ' more on the calendar.'}));
      return w;
    }
    function toScheduleWidget(){
      var J = ctx.jobs, list = J.isReady() ? J.unscheduled() : [];
      var w = widget('Won, not scheduled yet', list.length ? 'Calendar' : '', function(){ ctx.goCalendar(); });
      if (!J.isReady()) { w.body.append(empty('The calendar isn\'t set up yet (see DEPLOYMENT.md).')); return w; }
      if (!list.length) w.body.append(empty('Every won quote has a job booked.'));
      list.slice(0, 6).forEach(function(q){
        w.body.append(row(
          rowMain(q.customer_name, [cap(SERVICE_NAMES[q.service]), q.vehicle, q.won_amount != null ? money(q.won_amount) : ''], function(){ ctx.goQuotes({service:'all', filter:'won', id:q.id}); }),
          q.decided_at ? 'Won ' + ago(q.decided_at) : '',
          el('button', {type:'button', className:'ghost row-action', text:'Schedule', 'aria-label':'Schedule ' + q.customer_name + '\'s job', on:{click:function(){ J.scheduleQuote(q); }}}),
          '#1baf7a'));
      });
      return w;
    }

    // ---------- revenue from won quotes ----------
    function revenueWidget(quotes){
      var tracks = quotes.some(function(q){ return 'outcome' in q; });
      var won = quotes.filter(function(q){ return q.outcome === 'won' && q.decided_at; });
      function sum(list){ return list.reduce(function(total, q){ return total + (Number(q.won_amount) || 0); }, 0); }
      var now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      var months = [5, 4, 3, 2, 1, 0].map(function(back){
        var start = new Date(now.getFullYear(), now.getMonth() - back, 1), end = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
        return {key:start.toISOString(), start:start, end:end,
          label: start.toLocaleDateString([], {month:'short', year: start.getFullYear() === now.getFullYear() ? undefined : '2-digit'})};
      });
      function inMonth(m){ return won.filter(function(q){ var d = new Date(q.decided_at); return d >= m.start && d < m.end; }); }
      var thisMonth = won.filter(function(q){ return new Date(q.decided_at) >= monthStart; });
      var sixMonths = won.filter(function(q){ return new Date(q.decided_at) >= months[0].start; });
      // Close rate over 90 days; spam and duplicates aren't real chances to win, so they're left out.
      var since = Date.now() - 90 * DAY;
      var decided = quotes.filter(function(q){ return q.outcome && q.decided_at && new Date(q.decided_at) >= since && q.lost_reason !== 'not_a_lead'; });
      var won90 = decided.filter(function(q){ return q.outcome === 'won'; }).length, lost90 = decided.length - won90;
      var reasons = {};
      decided.forEach(function(q){ if (q.outcome === 'lost' && q.lost_reason) reasons[q.lost_reason] = (reasons[q.lost_reason] || 0) + 1; });
      var reasonText = Object.keys(reasons).sort(function(a, b){ return reasons[b] - reasons[a]; })
        .map(function(k){ return REASON_NAMES[k] + ' ' + reasons[k]; }).join(' · ');

      function fig(label, value, hint){
        var v = el('span', {className:'money-fig-value', text:value}), h = el('span', {className:'money-fig-hint', text:hint});
        return {node: el('div', {className:'money-fig'}, el('span', {className:'money-fig-label', text:label}), v, h), value:v, hint:h};
      }
      var pending = fig('Quotes out', '…', 'Sent quotes still waiting on a yes or no');
      var figs = el('div', {className:'money-figs'},
        fig('Won this month', money(sum(thisMonth)), thisMonth.length + (thisMonth.length === 1 ? ' quote won' : ' quotes won')).node,
        fig('Last 6 months', money(sum(sixMonths)), sixMonths.length + (sixMonths.length === 1 ? ' quote won' : ' quotes won')).node,
        fig('Close rate', decided.length ? Math.round(won90 / decided.length * 100) + '%' : '–', decided.length ? won90 + ' won, ' + lost90 + ' lost in the last 90 days' : 'No won or lost quotes in the last 90 days').node,
        pending.node);
      var before = el('div', null, figs, reasonText ? el('p', {className:'widget-foot', text:'Why quotes were lost (90 days): ' + reasonText}) : null);

      var w;
      if (!tracks) {
        w = widget('Revenue from won quotes', '', null, 'wide');
        w.body.append(empty('Run the won/lost part of supabase/schema.sql in Supabase to start tracking revenue (see DEPLOYMENT.md).'));
        return {card:w.card, tracks:false, fillPending:function(){}};
      }
      var services = [['vinyl', 'Vinyl wraps'], ['ceramic', 'Ceramic'], ['correction', 'Correction'], ['other', 'Other']];
      w = chartWidget('Revenue from won quotes', 'Agreed price of each quote marked won, by the month it was won.', 'Won quotes', function(){ ctx.goQuotes({service:'all', filter:'won'}); },
        months, [{key:'won', label:'Won', color:'--viz-closed'}],
        function(m){ return sum(inMonth(m)); },
        'columns',
        function(){ ctx.goQuotes({service:'all', filter:'won'}); },
        'No quotes won in the last 6 months yet. Mark a quote Won to start tracking revenue.',
        {wide:true, before:before, fmt:money, axisFmt:moneyShort, capFmt:moneyShort,
          tipRows: function(m){
            var list = inMonth(m);
            return services.map(function(s){ return {label:s[1], value:sum(list.filter(function(q){ return q.service === s[0]; }))}; })
              .filter(function(r){ return r.value > 0; });
          },
          table: {series: services.map(function(s){ return {key:s[0], label:s[1]}; }),
            value: function(m, s){ return sum(inMonth(m).filter(function(q){ return q.service === s.key; })); }}});

      // The latest quote PDF sent on each undecided, still-open quote.
      function fillPending(docs){
        var latest = {};
        docs.forEach(function(m){ if (!latest[m.quote_id] && m.document) latest[m.quote_id] = Number(m.document.total) || 0; });
        var open = quotes.filter(function(q){ return !q.outcome && q.status !== 'closed' && latest[q.id] != null; });
        pending.value.textContent = money(open.reduce(function(t, q){ return t + latest[q.id]; }, 0));
        pending.hint.textContent = open.length ? 'Across ' + open.length + (open.length === 1 ? ' sent quote' : ' sent quotes') + ' waiting on a yes or no' : 'No sent quotes are waiting on a decision';
      }
      return {card:w.card, tracks:true, fillPending:fillPending};
    }

    function greeting(){
      var h = new Date().getHours();
      var name = first(ctx.staffName && ctx.staffName());
      return (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + (name && name.indexOf('@') < 0 ? ', ' + name : '');
    }

    async function render(){
      var token = ++renderToken;
      var quotes = ctx.getQuotes(), customers = ctx.getCustomers();
      var weekAgo = Date.now() - 7 * DAY;
      var open = quotes.filter(function(q){ return q.status === 'open'; });
      var waiting = quotes.filter(function(q){ return q.status === 'waiting'; });
      var fresh = quotes.filter(function(q){ return new Date(q.created_at) >= weekAgo; });
      var interested = customers.filter(function(c){ return c.interest === 'interested'; });
      // Worth a call: still a lead, not ruled out, and not reached in the last 3 days. Interested and never-contacted first.
      var followUp = customers.filter(function(c){
        return (c.stage === 'potential' || c.stage === 'contacted') && c.interest !== 'not_interested'
          && (!c.last_contacted_at || Date.now() - new Date(c.last_contacted_at) > 3 * DAY);
      }).sort(function(a, b){
        return (a.interest === 'interested' ? 0 : 1) - (b.interest === 'interested' ? 0 : 1)
          || (a.last_contacted_at ? 1 : 0) - (b.last_contacted_at ? 1 : 0)
          || new Date(a.last_contacted_at || a.created_at) - new Date(b.last_contacted_at || b.created_at);
      });
      var oldestOpen = open.slice().sort(function(a, b){ return new Date(a.last_message_at) - new Date(b.last_message_at); });

      var head = el('div', {className:'page-head'},
        el('h1', {text:greeting()}),
        el('p', {text: open.length ? open.length + (open.length === 1 ? ' quote needs' : ' quotes need') + ' a reply. Here\'s what to look at today.' : 'You\'re all caught up on quote replies.'}));

      var stats = el('div', {className:'stats'},
        stat('#e8634a', 'reply', 'Need a reply', open.length, oldestOpen.length ? 'Oldest waiting since ' + ago(oldestOpen[0].last_message_at) : 'Nothing waiting on you', function(){ ctx.goQuotes({service:'all', filter:'open'}); }),
        stat('#5aa9e6', 'clock', 'Waiting on customer', waiting.length, 'You replied, they haven\'t yet', function(){ ctx.goQuotes({service:'all', filter:'waiting'}); }),
        stat('#1fbfd1', 'spark', 'New this week', fresh.length, 'Quote requests in the last 7 days', function(){ ctx.goQuotes({service:'all', filter:'all'}); }),
        stat('#3cc47c', 'heart', 'Interested customers', interested.length, followUp.length + ' to follow up with', function(){ ctx.goCustomers({stage:'all', interest:'interested'}); }));

      // Needs a reply: oldest first so nobody waits too long.
      var reply = widget('Needs a reply', open.length ? 'See all ' + open.length : '', function(){ ctx.goQuotes({service:'all', filter:'open'}); });
      if (!oldestOpen.length) reply.body.append(empty('No quotes are waiting on a reply.'));
      oldestOpen.slice(0, 6).forEach(function(q){
        reply.body.append(row(
          rowMain(q.customer_name, [SERVICE_NAMES[q.service].replace(/^./, function(c){ return c.toUpperCase(); }), q.vehicle], function(){ ctx.goQuotes({service:'all', filter:'open', id:q.id}); }),
          ago(q.last_message_at), null, '#e8634a'));
      });

      var follow = widget('Follow up next', 'Customer list', function(){ ctx.goCustomers({stage:'all', interest:'all'}); });
      if (!followUp.length) follow.body.append(empty('Nobody is due a follow-up right now.'));
      followUp.slice(0, 6).forEach(function(c){
        var stage = el('span', {className:'pill stage-' + c.stage, text:STAGE_NAMES[c.stage]});
        var interest = el('span', {className:'pill interest-' + c.interest, text:INTEREST_NAMES[c.interest]});
        var call = c.phone ? el('a', {className:'ghost row-action', href:'tel:' + c.phone.replace(/[^\d+]/g, ''), text:'Call'}) : null;
        follow.body.append(row(
          rowMain(c.name, [stage, interest], function(){ ctx.goCustomers({stage:'all', interest:'all', id:c.id}); }),
          c.last_contacted_at ? 'Last ' + ago(c.last_contacted_at) : 'Never contacted', call));
      });

      // Quotes by service: one horizontal stacked bar per service, split by status.
      var byService = chartWidget('Quotes by service', 'How many quote requests each service has, and where they stand.', 'All quotes', function(){ ctx.goQuotes({service:'all', filter:'all'}); },
        SERVICES.map(function(s){ return {key:s[0], label:s[1]}; }),
        QUOTE_STATUS,
        function(cat, ser){ return quotes.filter(function(q){ return q.service === cat.key && q.status === ser.key; }).length; },
        'bars',
        function(cat){ ctx.goQuotes({service:cat.key, filter:'all'}); },
        'No quote requests yet.');

      // Customer pipeline: one stacked column per stage, split by interest (interested at the baseline).
      var pipeline = chartWidget('Customer pipeline', 'People at each stage, and how interested they are.', 'Customer list', function(){ ctx.goCustomers({stage:'all', interest:'all'}); },
        STAGES.map(function(s){ return {key:s[0], label:s[1]}; }),
        INTEREST_SERIES,
        function(cat, ser){ return customers.filter(function(c){ return c.stage === cat.key && c.interest === ser.key; }).length; },
        'columns',
        function(cat){ ctx.goCustomers({stage:cat.key, interest:'all'}); },
        'No customers yet.', {unit:'people'});

      var jobsToday = jobsTodayWidget(), toSchedule = toScheduleWidget();
      var revenue = revenueWidget(quotes);

      var activity = widget('Recent activity', '', null, 'wide');
      activity.body.append(empty('Loading…'));

      root.replaceChildren(head, stats, el('div', {className:'widgets'}, reply.card, follow.card, jobsToday.card, toSchedule.card, revenue.card, byService.card, pipeline.card, activity.card));

      // Recent activity mixes new quote requests, emails both ways, and logged calls/texts.
      // The sent quote PDFs give the value of quotes still waiting on a decision.
      var results = await Promise.all([
        ctx.client.from('quote_messages').select('created_at,direction,author,quote_id,document').order('created_at', {ascending:false}).limit(8),
        ctx.client.from('customer_contacts').select('created_at,method,outcome,author,customer_id').order('created_at', {ascending:false}).limit(8),
        revenue.tracks ? ctx.client.from('quote_messages').select('quote_id,document,created_at').not('document', 'is', null).order('created_at', {ascending:false}).limit(1000) : Promise.resolve({data:[]})
      ]);
      if (token !== renderToken) return;
      revenue.fillPending(results[2].data || []);
      var quoteById = {}, customerById = {};
      quotes.forEach(function(q){ quoteById[q.id] = q; });
      customers.forEach(function(c){ customerById[c.id] = c; });
      var events = [];
      quotes.slice().sort(function(a, b){ return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 8).forEach(function(q){
        events.push({at:q.created_at, tone:'#1fbfd1', text:q.customer_name + ' requested a ' + SERVICE_NAMES[q.service] + ' quote', go:function(){ ctx.goQuotes({service:'all', filter:'all', id:q.id}); }});
      });
      (results[0].data || []).forEach(function(m){
        var q = quoteById[m.quote_id]; if (!q) return;
        events.push(m.direction === 'inbound'
          ? {at:m.created_at, tone:'#e8634a', text:q.customer_name + ' replied by email', go:function(){ ctx.goQuotes({service:'all', filter:'all', id:q.id}); }}
          : {at:m.created_at, tone:'#5aa9e6', text:staffShort(m.author) + (m.document ? ' sent quote ' + m.document.number + ' to ' : ' emailed ') + q.customer_name, go:function(){ ctx.goQuotes({service:'all', filter:'all', id:q.id}); }});
      });
      quotes.filter(function(q){ return q.outcome && q.decided_at; }).forEach(function(q){
        events.push({at:q.decided_at, tone: q.outcome === 'won' ? '#1baf7a' : '#a3b1bd',
          text: q.customer_name + '\'s ' + SERVICE_NAMES[q.service] + ' was marked ' + q.outcome + (q.outcome === 'won' && q.won_amount != null ? ' (' + money(q.won_amount) + ')' : ''),
          go:function(){ ctx.goQuotes({service:'all', filter:q.outcome, id:q.id}); }});
      });
      (results[1].data || []).forEach(function(h){
        var c = customerById[h.customer_id]; if (!c) return;
        events.push({at:h.created_at, tone:'#3cc47c', text:staffShort(h.author) + ' ' + METHOD_VERBS[h.method] + ' ' + c.name + ' (' + OUTCOME_NAMES[h.outcome] + ')', go:function(){ ctx.goCustomers({stage:'all', interest:'all', id:c.id}); }});
      });
      events.sort(function(a, b){ return new Date(b.at) - new Date(a.at); });
      activity.body.replaceChildren();
      if (!events.length) activity.body.append(empty('Nothing yet. New quote requests, emails and logged calls show up here.'));
      events.slice(0, 8).forEach(function(e){
        activity.body.append(row(rowMain(e.text, [], e.go), ctx.when(e.at), null, e.tone));
      });
    }

    return {render: render};
  }

  window.StaffDashboard = {mount: mount};
})();
