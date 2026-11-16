// Launch Radar's page. It reads window.RADAR (data.js, written beside dashboard/ by main.ts) and
// renders the pre-token board, the category evidence strip, the Already trading set, and a detail
// drawer per protocol with the model's own arithmetic — both pricing anchors, the peer band and
// the farm plan with its costs rolled up. No fetch, no framework, no network: every byte it shows
// arrived in data.js, and every implied value it prints is the one main.ts computed.
(function () {
  'use strict';

  var D = window.RADAR;
  if (!D) return;
  var M = D.model;
  var state = { tab: 'board', q: '', category: 'all', chain: 'all', tier: 'all', min: 0, sort: 'rank', dir: 1, selected: null };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 730) return (days / 365).toFixed(1) + 'y';
    if (days >= 60) return Math.round(days / 30.4) + 'mo';
    return days + 'd';
  }
  function fmtMult(n) { return n === null || n === undefined ? 'n/a' : n.toFixed(3) + '\u00D7'; }
  function esc(s) { return String(s === null || s === undefined ? '' : s); }

  /* — header stats — */
  var stats = [
    [String(D.board_size), 'protocols ranked'],
    [String(D.watchlist_size) + '/' + String(D.watchlist_size), 'watchlist covered'],
    [fmtUsd(D.rows.length ? D.rows[0].implied_value_usd : 0), 'top implied value'],
    [String(D.pretoken_size), 'record no token'],
    [D.as_of, 'snapshot date'],
  ];
  stats.forEach(function (s) {
    var d = el('div', 'stat');
    d.appendChild(el('b', null, s[0]));
    d.appendChild(el('span', null, s[1]));
    $('stats').appendChild(d);
  });

  /* — the model, stated on the page it produced — */
  $('modelbar').innerHTML =
    '<span class="fx">MODEL ' + esc(D.model_version) + '</span> &nbsp;implied = TVL &times; <b>base multiple</b> &times; <b>growth</b> ' +
    '(7d TVL change, weight ' + M.growth_weight + ') &times; <b>maturity</b> (years live with no token, saturating) &times; <b>breadth</b> ' +
    '(chains) &times; <b>' + M.product_multiple + '</b> if a wrapped, staked or bridged product of another. The base multiple blends ' +
    '<b>two anchors</b> read off the same launched peers: their <b>median mcap/TVL</b> and a <b>power-law size fit</b> ' +
    '(needs ' + M.fit_min_peers + '+ peers; the global median ' + D.global_multiple.toFixed(3) + ' stands in where a category is thin). ' +
    'Every row also carries the <b>peer band</b> \u2014 the price at the peers\u2019 25th\u201375th percentile multiples \u2014 and a ' +
    '<b>signal score</b>: years without a token, momentum, footprint and category standing, 0\u2013100 against this board, independent of size. ' +
    'Nothing is priced by name: the same functions score every row.';

  /* — the evidence strip: what the market pays per $1 of TVL, by category — */
  (function renderEvidence() {
    var wrap = $('evidence');
    var head = el('div', 'evhead');
    head.appendChild(el('span', 'evtitle', 'WHAT THE MARKET PAYS PER $1 OF TVL \u2014 LAUNCHED PEERS, BY CATEGORY'));
    head.appendChild(el('span', 'evnote', 'median multiple, with the 25th\u201375th percentile band; the global band is ' +
      D.global_p25.toFixed(2) + '\u00D7\u2013' + D.global_p75.toFixed(2) + '\u00D7, so the band is the honest part of every price below'));
    wrap.appendChild(head);
    var strip = el('div', 'evstrip');
    D.categories.slice(0, 8).forEach(function (c) {
      var chip = el('div', 'evchip');
      chip.appendChild(el('div', 'evcat', c.category));
      var line = el('div', 'evline');
      line.appendChild(el('b', null, c.median.toFixed(2) + '\u00D7'));
      line.appendChild(el('span', null, ' band ' + c.p25.toFixed(2) + '\u2013' + c.p75.toFixed(2) + '\u00D7 \u00B7 ' + c.peers + ' peers'));
      chip.appendChild(line);
      strip.appendChild(chip);
    });
    wrap.appendChild(strip);
  })();

  /* — filters — */
  function fillSelect(sel, values, label) {
    sel.appendChild(el('option', null, label));
    sel.options[0].value = 'all';
    values.forEach(function (v) {
      var o = el('option', null, v);
      o.value = v;
      sel.appendChild(o);
    });
  }
  var cats = [], chains = [], seenC = {}, seenH = {};
  D.rows.forEach(function (r) {
    if (r.category && !seenC[r.category]) { seenC[r.category] = 1; cats.push(r.category); }
    r.chains.forEach(function (c) { if (!seenH[c]) { seenH[c] = 1; chains.push(c); } });
  });
  cats.sort(); chains.sort();
  fillSelect($('f-category'), cats, 'All categories');
  fillSelect($('f-chain'), chains, 'All chains');

  /* — board — */
  var COLS = [
    { k: 'rank', t: '#', num: false },
    { k: 'name', t: 'Protocol', num: false },
    { k: 'tier', t: 'Tier', num: false },
    { k: 'category', t: 'Category', num: false, cls: 'hidemb' },
    { k: 'chains', t: 'Chains', num: false, cls: 'hidemb' },
    { k: 'tvl', t: 'TVL', num: true },
    { k: 'change', t: '7d', num: true },
    { k: 'age', t: 'Age', num: true, cls: 'hidemb' },
    { k: 'implied', t: 'Implied value', num: true },
    { k: 'signal', t: 'Signal', num: true },
  ];
  function sortVal(r, k) {
    if (k === 'rank') return r.rank;
    if (k === 'name') return r.name.toLowerCase();
    if (k === 'tier') return r.tier;
    if (k === 'category') return (r.category || '').toLowerCase();
    if (k === 'chains') return r.chains.length;
    if (k === 'tvl') return r.tvl_usd;
    if (k === 'change') return r.change_7d === null ? -1e9 : r.change_7d;
    if (k === 'age') return r.age_days === null ? -1 : r.age_days;
    if (k === 'implied') return r.implied_value_usd;
    if (k === 'signal') return r.signal_score;
    return r.rank;
  }
  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.tier !== 'all' && r.tier !== state.tier) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (r.implied_value_usd < state.min) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
    var k = state.sort, dir = state.dir;
    rows.sort(function (a, b) {
      var va = sortVal(a, k), vb = sortVal(b, k);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a.rank - b.rank;
    });
    return rows;
  }
  function renderBoard() {
    var t = $('board');
    t.textContent = '';
    var thead = el('thead'), htr = el('tr');
    COLS.forEach(function (c) {
      var th = el('th', (c.num ? 'num ' : '') + (c.cls || ''), c.t);
      if (c.k !== 'tier') {
        th.classList.add('sortable');
        if (state.sort === c.k) {
          var d = el('span', 'dir', state.dir === 1 ? ' \u2191' : ' \u2193');
          th.appendChild(d);
        }
        th.addEventListener('click', function () {
          if (state.sort === c.k) state.dir = -state.dir;
          else { state.sort = c.k; state.dir = c.k === 'name' || c.k === 'category' ? 1 : -1; if (c.k === 'rank') state.dir = 1; }
          renderBoard();
        });
      }
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    t.appendChild(thead);
    var rows = visibleRows();
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(el('td', 'rank', String(r.rank)));
      var nameTd = el('td');
      nameTd.appendChild(el('div', 'pname', r.name));
      nameTd.appendChild(el('div', 'pslug', r.slug));
      tr.appendChild(nameTd);
      var tierTd = el('td');
      tierTd.appendChild(el('span', 'badge ' + r.tier, r.tier === 'watchlist' ? 'Watchlist' : r.tier === 'early' ? 'Early' : 'Product'));
      tr.appendChild(tierTd);
      tr.appendChild(el('td', 'cat hidemb', r.category || 'Uncategorised'));
      tr.appendChild(el('td', 'chains hidemb', r.chains.length ? r.chains[0] + (r.chains.length > 1 ? ' +' + (r.chains.length - 1) : '') : '\u2014'));
      tr.appendChild(el('td', 'num', fmtUsd(r.tvl_usd)));
      var ch = el('td', 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), fmtPct(r.change_7d));
      tr.appendChild(ch);
      tr.appendChild(el('td', 'num hidemb', fmtAge(r.age_days)));
      var imp = el('td', 'num');
      imp.appendChild(el('div', 'implied', fmtUsd(r.implied_value_usd)));
      imp.appendChild(el('div', 'band', 'band ' + fmtUsd(r.implied_low_usd) + '\u2013' + fmtUsd(r.implied_high_usd)));
      tr.appendChild(imp);
      var sig = el('td', 'sig');
      var sline = el('div', 'sigline');
      sline.appendChild(el('b', 'signum', String(r.signal_score)));
      var bar = el('div', 'sigbar');
      var fill = el('i');
      fill.style.width = r.signal_score + '%';
      bar.appendChild(fill);
      sline.appendChild(bar);
      sig.appendChild(sline);
      tr.appendChild(sig);
      tr.addEventListener('click', function () { openDetail(r.slug); });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    $('count').textContent = 'SHOWING ' + rows.length + ' OF ' + D.board_size + ' RANKED PROTOCOLS \u2014 CLICK A ROW FOR ITS MODEL AND FARM PLAN';
    $('empty').classList.toggle('hidden', rows.length > 0);
  }

  /* — live set: already trading, at the market's own values — */
  function renderLive() {
    var t = $('liveboard');
    t.textContent = '';
    var thead = el('thead'), htr = el('tr');
    ['Protocol', 'Symbol', 'Category', 'TVL', 'Market cap', 'Mcap / TVL', '7d'].forEach(function (h, i) {
      htr.appendChild(el('th', i >= 3 ? 'num' : '', h));
    });
    thead.appendChild(htr);
    t.appendChild(thead);
    var tb = el('tbody');
    D.live.forEach(function (r) {
      var tr = el('tr');
      var nameTd = el('td');
      nameTd.appendChild(el('div', 'pname', r.name));
      nameTd.appendChild(el('div', 'pslug', r.slug));
      tr.appendChild(nameTd);
      tr.appendChild(el('td', 'cat', r.symbol || '\u2014'));
      tr.appendChild(el('td', 'cat', r.category || 'Uncategorised'));
      tr.appendChild(el('td', 'num', fmtUsd(r.tvl_usd)));
      tr.appendChild(el('td', 'num implied', fmtUsd(r.mcap_usd)));
      tr.appendChild(el('td', 'num', r.mcap_tvl === null ? 'n/a' : r.mcap_tvl.toFixed(2)));
      tr.appendChild(el('td', 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), fmtPct(r.change_7d)));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    $('count').textContent = 'ALREADY TRADING \u2014 THE MARKET\u2019S OWN VALUES, NEVER THE MODEL\u2019S. THESE ' + D.live_size + ' ARE THE LARGEST OF THE LAUNCHED SET THE BOARD IS PRICED FROM.';
  }

  /* — detail drawer — */
  function mrow(why, val) {
    var d = el('div', 'mrow');
    d.appendChild(el('span', 'why', why));
    d.appendChild(el('b', null, val));
    return d;
  }
  function openDetail(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    state.selected = slug;
    var d = $('drawer');
    d.textContent = '';
    var close = el('button', 'close', 'CLOSE \u2715');
    close.addEventListener('click', closeDetail);
    d.appendChild(close);
    d.appendChild(el('h2', null, r.name));
    d.appendChild(el('div', 'dslug', r.slug + ' \u2014 rank #' + r.rank + ' of ' + D.board_size + ' \u00B7 signal ' + r.signal_score + '/100'));
    var badge = el('span', 'badge ' + r.tier, r.tier === 'watchlist' ? 'On the house watchlist' : r.tier === 'early' ? 'Early find, below the floor' : 'Product of another protocol');
    d.appendChild(badge);
    var grid = el('div', 'dgrid');
    [
      ['Implied launch value', fmtUsd(r.implied_value_usd)],
      ['Peer band (P25\u2013P75)', fmtUsd(r.implied_low_usd) + ' \u2013 ' + fmtUsd(r.implied_high_usd)],
      ['TVL', fmtUsd(r.tvl_usd)],
      ['TVL change, 7d', fmtPct(r.change_7d)],
      ['Tracked for', fmtAge(r.age_days) + (r.listed_at ? ' (since ' + r.listed_at + ')' : '')],
      ['Chains', r.chains.length ? r.chains.slice(0, 5).join(', ') + (r.chains.length > 5 ? ' +' + (r.chains.length - 5) + ' more' : '') : 'none recorded'],
    ].forEach(function (c) {
      var cell = el('div', 'dcell');
      cell.appendChild(el('span', null, c[0]));
      cell.appendChild(el('b', null, c[1]));
      grid.appendChild(cell);
    });
    d.appendChild(grid);
    var m = r.model;
    d.appendChild(el('h3', null, 'The peer evidence'));
    d.appendChild(mrow(m.peer_scope === 'category'
      ? 'Launched peers in ' + (r.category || 'this category')
      : (r.category || 'This category') + ' has too few launched peers \u2014 priced on the global set', String(m.peer_count) + ' peers'));
    d.appendChild(mrow('What they pay per $1 of TVL \u2014 25th / median / 75th percentile',
      m.peer_p25.toFixed(2) + '\u00D7 / ' + m.median_multiple.toFixed(2) + '\u00D7 / ' + m.peer_p75.toFixed(2) + '\u00D7'));
    if (m.fit_multiple !== null) {
      d.appendChild(mrow('Size fit at this TVL \u2014 the power law\u2019s own price', fmtMult(m.fit_multiple)));
      d.appendChild(mrow('Anchor agreement \u2014 the two anchors land within',
        '\u00D7' + m.anchor_spread.toFixed(2) + (m.anchor_spread <= 1.5 ? ' \u00B7 close' : ' \u00B7 wide')));
    } else {
      d.appendChild(mrow('Size fit', 'does not reach this row \u2014 too few peers, or a size outside the range they span; the median anchor prices it alone'));
    }
    d.appendChild(el('h3', null, 'How the model prices it'));
    d.appendChild(mrow('TVL, the base', fmtUsd(r.tvl_usd)));
    d.appendChild(mrow('Base multiple \u2014 the two anchors blended', '\u00D7 ' + m.anchor_multiple.toFixed(3)));
    d.appendChild(mrow('Growth \u2014 7d change of ' + fmtPct(r.change_7d) + ', weight ' + M.growth_weight, '\u00D7 ' + m.growth_multiplier.toFixed(3)));
    d.appendChild(mrow('Maturity \u2014 ' + fmtAge(r.age_days) + ' live with no token', '\u00D7 ' + m.maturity_multiplier.toFixed(3)));
    d.appendChild(mrow('Breadth \u2014 ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's'), '\u00D7 ' + m.breadth_multiplier.toFixed(3)));
    if (m.product_multiplier !== 1) d.appendChild(mrow('Product discount \u2014 a spin-off\u2019s launch, not its own', '\u00D7 ' + m.product_multiplier.toFixed(2)));
    d.appendChild(mrow('Implied value', fmtUsd(r.implied_value_usd)));
    d.appendChild(mrow('At the band\u2019s edges', fmtUsd(r.implied_low_usd) + ' \u2013 ' + fmtUsd(r.implied_high_usd)));
    d.appendChild(el('h3', null, 'The farm plan'));
    var chips = el('div', 'planchips');
    [
      'Upfront \u2248 ' + fmtUsd(r.plan.upfront_usd),
      'Weekly \u2248 ' + (r.plan.weekly_usd < 1 ? 'under $1' : fmtUsd(r.plan.weekly_usd)) + ' gas',
      '\u2248 ' + r.plan.minutes_per_week + ' min a week',
      'Hold \u2265 ' + r.plan.hold_days + ' days',
    ].forEach(function (t) { chips.appendChild(el('span', 'planchip', t)); });
    d.appendChild(chips);
    var ol = el('ol', 'plan');
    r.farm_steps.forEach(function (s) { ol.appendChild(el('li', null, s)); });
    d.appendChild(ol);
    d.appendChild(el('p', 'note',
      'As of ' + D.as_of + ', ' + r.name + ' records no token in the snapshot this board is built from \u2014 that is a statement about the record, not a promise about the future. The implied value is this board\u2019s own claim: what a launch would be worth if the protocol\u2019s record stayed as it is. It is not a prediction that a token will be issued.'));
    d.classList.remove('hidden');
    $('scrim').classList.remove('hidden');
  }
  function closeDetail() {
    state.selected = null;
    $('drawer').classList.add('hidden');
    $('scrim').classList.add('hidden');
  }
  $('scrim').addEventListener('click', closeDetail);

  /* — controls wiring — */
  $('tab-board').addEventListener('click', function () { setTab('board'); });
  $('tab-live').addEventListener('click', function () { setTab('live'); });
  function setTab(tab) {
    state.tab = tab;
    $('tab-board').classList.toggle('on', tab === 'board');
    $('tab-live').classList.toggle('on', tab === 'live');
    $('board').classList.toggle('hidden', tab !== 'board');
    $('liveboard').classList.toggle('hidden', tab !== 'live');
    $('controls').style.opacity = tab === 'live' ? '0.45' : '1';
    if (tab === 'live') renderLive(); else renderBoard();
  }
  $('q').addEventListener('input', function (e) { state.q = e.target.value; if (state.tab === 'board') renderBoard(); });
  $('f-category').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  $('f-chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('f-min').addEventListener('change', function (e) { state.min = Number(e.target.value); renderBoard(); });
  $('f-tier').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tier]');
    if (!b) return;
    state.tier = b.getAttribute('data-tier');
    Array.prototype.forEach.call($('f-tier').children, function (c) { c.classList.toggle('on', c === b); });
    renderBoard();
  });

  /* — footer: the method, the exclusions, the honesty — */
  $('foot').innerHTML =
    '<div class="cols">' +
    '<div><h4>The board</h4><p><b>' + D.board_size + ' protocols ranked</b> out of ' + D.protocol_size + ' in the snapshot: the whole ' +
    D.watchlist_size + '-protocol watchlist, ' + D.early_size + ' early finds below its $' + (D.floor_usd / 1e6) + 'M floor, and ' + D.product_size +
    ' product-flagged rows priced as spin-offs. Click any row for its peer evidence, its model and its farm plan.</p></div>' +
    '<div><h4>How a price is made</h4><p>Each category\u2019s launched peers give two anchors: the <b>median</b> of what the market pays per $1 of TVL, ' +
    'and a <b>power-law fit</b> of market cap on TVL, because size bends the multiple. The median is the robust anchor: the fit adjusts it by at most ' +
    '\u00D71.41 either way, and only inside the size range its peers actually span. The result is adjusted for the week\u2019s growth, the years run ' +
    'without a token and the chain footprint. The band beside each price is the same arithmetic at the peers\u2019 25th and 75th percentiles: ' +
    'where the anchors disagree, the band is the honest answer.</p></div>' +
    '<div><h4>Set aside, never ranked</h4><p>' + (D.protocol_size - D.pretoken_size) + ' protocols whose token already trades \u2014 the largest ' +
    D.live_size + ' are under <b>Already trading</b> at market value, and they are the peer set the anchors are measured from. A further ' +
    D.excluded_size + ' records that show no token are exchanges, official chain bridges, exchange products or versioned pools: not launches.</p></div>' +
    '<div><h4>Read it honestly</h4><p>The snapshot is DefiLlama\u2019s record, fetched once and frozen (' + esc(D.source) + '). A protocol here ' +
    '<b>records no token</b>; that is not proof it has none. Implied values are this board\u2019s claims, not predictions, and a farm plan is a starting ' +
    'point, not advice: re-check every step in the protocol\u2019s own app before acting.</p></div>' +
    '</div>';

  renderBoard();

  /* A small handle so the entry's own screenshot run can pose the page deterministically. */
  window.LAUNCH_RADAR = {
    open: openDetail,
    close: closeDetail,
    tier: function (t) {
      state.tier = t;
      Array.prototype.forEach.call($('f-tier').children, function (c) { c.classList.toggle('on', c.getAttribute('data-tier') === t); });
      renderBoard();
    },
    category: function (c) { state.category = c; $('f-category').value = c; renderBoard(); },
    tab: setTab,
  };
})();
