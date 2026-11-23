/* NOOR Santé — patient site (booking widget, live queue, hours) */
(function () {
  var ic = UI.ic, esc = UI.esc;
  var $ = function (s) { return document.querySelector(s); };
  var sel = { date: null, step: 1, ticket: null, form: { name: '', phone: '', reason: NS.REASONS[0], firstVisit: false } };

  function fillStatic() {
    var s = NS.settings;
    document.querySelectorAll('[data-s]').forEach(function (el) { el.textContent = s[el.getAttribute('data-s')]; });
    $('#logo').innerHTML = ic('stetho');
    $('#navCta').innerHTML = ic('ticket') + '<span>Prendre un ticket</span>';
    $('#heroCta').innerHTML = ic('ticket') + 'Prendre un ticket';
    $('#heroTrack').innerHTML = ic('search') + 'Suivre mon ticket';
    $('#hoursTitle').innerHTML = ic('clock') + 'Horaires de consultation';
    $('#findTitle').innerHTML = ic('search') + 'Retrouver mon ticket';
    $('#findBtn').textContent = 'Suivre';
    $('#addrTitle').innerHTML = ic('pin') + 'Adresse';
    $('#facts').innerHTML =
      '<div><span class="ico-b">' + ic('pin') + '</span>' + esc(s.address.split('—').pop().trim()) + '</div>' +
      '<div><span class="ico-b">' + ic('wallet') + '</span>Consultation ' + s.fee + ' DH</div>' +
      '<div><span class="ico-b">' + ic('phone') + '</span>' + esc(s.phone) + '</div>';
    var svcs = [['stetho', 'Consultation générale', 'Adultes et enfants, bilan et orientation.'], ['heart', 'Suivi tension et diabète', 'Contrôles réguliers et adaptation du traitement.'], ['baby', 'Pédiatrie', 'Suivi de croissance et vaccinations.'], ['syringe', 'Vaccination', 'Calendrier national et voyages.'], ['file', 'Certificats', 'Sport, travail, aptitude.'], ['activity', 'ECG au cabinet', 'Électrocardiogramme sur place.']];
    $('#svcs').innerHTML = svcs.map(function (x) { return '<div class="card svc"><span class="ico-b">' + ic(x[0]) + '</span><div><h4>' + x[1] + '</h4><p>' + x[2] + '</p></div></div>'; }).join('');
  }

  function rangesText(date) {
    var r = NS.ranges(date);
    return r.map(function (x) { return NS.fmt(x[0]) + '–' + NS.fmt(x[1]); }).join(' · ');
  }

  function renderHours() {
    var s = NS.settings, todayDow = NS.parse(NS.today()).getDay(), order = [1, 2, 3, 4, 5, 6, 0];
    $('#hours').innerHTML = order.map(function (d) {
      var c = s.days[d], txt = c.on ? c.ranges.filter(function (r) { return r && r[0]; }).map(function (r) { return r[0] + '–' + r[1]; }).join(' · ') : 'Fermé';
      return '<div class="' + (d === todayDow ? 'is-today' : '') + (c.on ? '' : ' closed') + '"><span>' + NS.DAYS[d] + '</span><span>' + txt + '</span></div>';
    }).join('');
    var t = NS.today(), lbl = NS.closedLabel(t), r = NS.ranges(t), now = NS.nowMin();
    var badge;
    if (!r.length) badge = '<span class="dot" style="color:#94a3b8"></span>Fermé aujourd\'hui' + (lbl ? ' · ' + esc(lbl) : '');
    else if (now < r[0][0]) badge = '<span class="dot pulse"></span>Ouvre aujourd\'hui à ' + NS.fmt(r[0][0]);
    else if (now >= r[r.length - 1][1]) badge = '<span class="dot" style="color:#94a3b8"></span>Consultations terminées pour aujourd\'hui';
    else if (r.some(function (x) { return now >= x[0] && now < x[1]; })) badge = '<span class="dot pulse"></span>Ouvert maintenant · ' + rangesText(t);
    else badge = '<span class="dot" style="color:#d98a0b"></span>Pause · reprise à ' + NS.fmt(r.find(function (x) { return x[0] > now; })[0]);
    $('#openBadge').innerHTML = badge;
  }

  function nextOpenDay() {
    for (var i = 1; i <= NS.settings.horizon; i++) { var d = NS.addDays(NS.today(), i); if (NS.dayInfo(d).open) return d; }
    return null;
  }

  function newTicketWait(date) {
    var avg = NS.liveAvg(date), cur = NS.current(date), q = NS.waiting(date), now = NS.nowMin(), r = NS.ranges(date);
    var start = Math.max(now, r.length ? r[0][0] : now), rest = cur ? Math.max(2, avg - (now - NS.minOf(cur.calledAt))) : 0;
    return NS.advance(date, start, rest + q.length * avg).min;
  }

  function renderLive() {
    var t = NS.today(), el = $('#live');
    if (!NS.isWorkingDay(t)) {
      var nx = nextOpenDay(), lbl = NS.closedLabel(t);
      el.innerHTML = '<div class="live-head"><h3>File d\'attente</h3><span class="chip gray">' + (lbl ? esc(lbl) : 'Fermé aujourd\'hui') + '</span></div>' +
        '<div class="now-serving" style="background:linear-gradient(135deg,#334155,#1e293b)"><div class="big num">' + ic('calendar', '') + '</div><div><small>Prochain jour de consultation</small><b>' + (nx ? NS.longDate(nx) : '—') + '</b></div></div>' +
        '<div class="live-foot">' + ic('ticket') + 'Les tickets pour les prochains jours sont ouverts.</div>';
      el.querySelector('.big .ico').style.cssText = 'width:44px;height:44px';
      return;
    }
    var cur = NS.current(t), q = NS.waiting(t), all = NS.active(t), done = all.filter(function (x) { return x.status === 'done'; }).length;
    var left = NS.remaining(t), avg = NS.liveAvg(t), now = NS.nowMin(), r = NS.ranges(t);
    var ended = now >= r[r.length - 1][1] && !cur && !q.length;
    var serving = cur ? '<div class="big num">' + cur.num + '</div><div><small>En consultation</small><b>Ticket n° ' + cur.num + '</b></div>'
      : ended ? '<div class="big num">' + done + '</div><div><small>Journée terminée</small><b>' + done + ' patients reçus</b></div>'
        : '<div class="big num">—</div><div><small>' + (now < r[0][0] ? 'Ouverture à ' + NS.fmt(r[0][0]) : 'Entre deux patients') + '</small><b>' + (q.length ? 'Prochain : n° ' + q[0].num : 'Aucun patient en attente') + '</b></div>';
    var wait = left > 0 ? newTicketWait(t) : null;
    el.innerHTML = '<div class="live-head"><h3>File d\'attente aujourd\'hui</h3><span class="chip ok"><span class="dot pulse"></span>En direct</span></div>' +
      '<div class="now-serving">' + serving + '</div>' +
      '<div class="live-stats">' +
      '<div><b class="num">' + q.length + '</b><span>En attente</span></div>' +
      '<div><b class="num">' + (wait == null ? '—' : NS.fmt(wait)) + '</b><span>Passage si ticket pris maintenant</span></div>' +
      '<div><b class="num">' + left + '</b><span>Places restantes</span></div></div>' +
      (q.length ? '<div class="next-nums">Prochains :' + q.slice(0, 5).map(function (x) { return '<span class="n num">' + x.num + '</span>'; }).join('') + (q.length > 5 ? '<span>+' + (q.length - 5) + '</span>' : '') + '</div>' : '') +
      '<div class="live-foot">' + ic('activity') + 'Durée moyenne observée : <b>' + Math.round(avg) + ' min</b> · ' + done + ' patients déjà reçus</div>';
  }

  /* ---------- booking widget ---------- */
  function steps(n) { return '<div class="steps">' + [1, 2, 3].map(function (i) { return '<span class="' + (i <= n ? 'on' : '') + '"></span>'; }).join('') + '</div>'; }

  function previewFor(date) {
    var info = NS.dayInfo(date), num = NS.ofDay(date).reduce(function (m, x) { return Math.max(m, x.num); }, 0) + 1, est;
    if (date === NS.today()) est = newTicketWait(date);
    else est = NS.slotStart(date, NS.active(date).length);
    return { num: num, est: est, left: info.left };
  }

  function renderStep1() {
    var t = NS.today(), cells = '';
    for (var i = 0; i <= NS.settings.horizon; i++) {
      var d = NS.addDays(t, i), info = NS.dayInfo(d), dt = NS.parse(d);
      var pct = info.capacity ? Math.round(info.booked / info.capacity * 100) : 0;
      var cls = 'day' + (info.open ? '' : ' off') + (info.open && info.left <= 5 ? ' low' : '') + (sel.date === d ? ' sel' : '');
      cells += '<button type="button" class="' + cls + '" data-date="' + d + '"' + (info.open ? '' : ' aria-disabled="true"') + '>' +
        (i === 0 ? '<span class="today-tag">Auj.</span>' : '') +
        '<div class="dow">' + NS.DAYS_SHORT[dt.getDay()] + '</div><div class="dnum num">' + dt.getDate() + '</div><div class="mon">' + NS.MONTHS[dt.getMonth()] + '</div>' +
        (info.open ? '<div class="meter"><i style="width:' + pct + '%"></i></div><div class="left">' + info.left + ' place' + (info.left > 1 ? 's' : '') + '</div>'
          : '<div class="meter" style="visibility:hidden"><i></i></div><div class="left">' + esc(info.reason) + '</div>') + '</button>';
    }
    var pv = '';
    if (sel.date && NS.dayInfo(sel.date).open) {
      var p = previewFor(sel.date);
      pv = '<div class="preview"><div class="pnum num">' + p.num + '</div><div><b>' + NS.longDate(sel.date) + '</b><p>Vous auriez le ticket <b>n° ' + p.num + '</b> · passage estimé vers <b>' + NS.fmt(p.est) + '</b></p><p style="opacity:.8;font-size:13px">' + rangesText(sel.date) + '</p></div></div>';
    }
    $('#book').innerHTML = steps(1) + '<div class="step-title"><h3>1. Choisissez votre jour</h3><small>' + NS.settings.horizon + ' prochains jours</small></div>' +
      '<div class="days">' + cells + '</div>' + pv +
      '<div class="actions"><span class="muted" style="font-size:13px;align-self:center">' + ic('shield').replace('class="ico ', 'class="ico " style="display:inline;vertical-align:-4px;width:16px;margin-right:4px" ') + 'Premier arrivé, premier servi</span>' +
      '<button class="btn btn-primary" id="toStep2"' + (sel.date && NS.dayInfo(sel.date).open ? '' : ' disabled') + '>Continuer' + ic('arrowR') + '</button></div>';
    $('#book').querySelectorAll('.day').forEach(function (b) {
      b.addEventListener('click', function () { if (b.classList.contains('off')) return; sel.date = b.getAttribute('data-date'); renderStep1(); });
    });
    $('#toStep2').addEventListener('click', function () { sel.step = 2; render(); });
  }

  function renderStep2() {
    var p = previewFor(sel.date), f = sel.form;
    $('#book').innerHTML = steps(2) + '<div class="step-title"><h3>2. Vos coordonnées</h3><small>' + NS.longDate(sel.date) + ' · n° ' + p.num + ' · vers ' + NS.fmt(p.est) + '</small></div>' +
      '<form id="bform" novalidate><div class="form-grid">' +
      '<div class="field"><label for="fName">Nom et prénom</label><input class="input" id="fName" autocomplete="name" placeholder="Ex. Amina Berrada" value="' + esc(f.name) + '"></div>' +
      '<div class="field"><label for="fPhone">Téléphone</label><input class="input" id="fPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="06 12 34 56 78" value="' + esc(f.phone) + '"></div>' +
      '<div class="field full"><label for="fReason">Motif de la consultation</label><select class="input" id="fReason">' + NS.REASONS.map(function (r) { return '<option' + (r === f.reason ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') + '</select></div>' +
      '<label class="check full"><input type="checkbox" id="fFirst"' + (f.firstVisit ? ' checked' : '') + '> C\'est ma première visite au cabinet</label>' +
      '</div><div class="err" id="bErr"></div>' +
      '<div class="actions"><button type="button" class="btn btn-ghost" id="back1">' + ic('arrowL') + 'Retour</button><button type="submit" class="btn btn-primary">' + ic('ticket') + 'Confirmer mon ticket</button></div></form>';
    $('#back1').addEventListener('click', function () { keep(); sel.step = 1; render(); });
    $('#bform').addEventListener('submit', function (e) {
      e.preventDefault(); keep();
      var res = NS.book({ date: sel.date, name: f.name, phone: f.phone, reason: f.reason, firstVisit: f.firstVisit, source: 'web' });
      if (res.error) { var er = $('#bErr'); er.textContent = res.error; er.classList.add('show'); return; }
      sel.ticket = res.ticket; sel.step = 3; render();
      document.getElementById('reserver').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    function keep() { f.name = $('#fName').value; f.phone = $('#fPhone').value; f.reason = $('#fReason').value; f.firstVisit = $('#fFirst').checked; }
  }

  function renderStep3() {
    var tk = NS.find(sel.ticket.id) || sel.ticket, e = NS.eta(tk), arrive = e.min != null ? NS.fmt(Math.max(e.min - NS.settings.arriveEarly, NS.ranges(tk.date)[0][0] - 10)) : '—';
    var link = new URL('suivi.html?c=' + tk.code, location.href).href;
    var wa = 'https://wa.me/?text=' + encodeURIComponent('Mon ticket chez ' + NS.settings.doctor + ' : n° ' + tk.num + ', ' + NS.longDate(tk.date) + ', passage estimé vers ' + (e.label || '') + '. Suivi en direct : ' + link);
    $('#book').innerHTML = steps(3) + '<div class="step-title"><h3>Votre ticket est confirmé ' + '✓' + '</h3><small>Code ' + tk.code + '</small></div>' +
      '<div class="confirm-grid"><div class="ticket"><div class="ticket-top"><div class="lbl">' + esc(NS.settings.cabinet) + '</div><div class="tnum num">' + tk.num + '</div><div class="tdate">' + NS.longDate(tk.date) + '</div></div>' +
      '<div class="ticket-cut"><i></i></div><div class="ticket-bot"><div><small>Passage estimé</small><b class="num">' + (e.label || '—') + '</b></div><div><small>Code de suivi</small><b class="num ticket-code">' + tk.code + '</b></div>' +
      '<div><small>Patient</small><b style="font-size:15px">' + esc(tk.name) + '</b></div><div><small>Devant vous</small><b class="num">' + (e.ahead != null ? e.ahead : 0) + '</b></div></div></div>' +
      '<div><ul class="confirm-list">' +
      '<li><span class="ico-b">' + ic('clock') + '</span><span>Présentez-vous vers <b>' + arrive + '</b>, soit ' + NS.settings.arriveEarly + ' min avant l\'heure estimée.</span></li>' +
      '<li><span class="ico-b">' + ic('activity') + '</span><span>L\'heure <b>s\'ajuste en direct</b> selon l\'avancement réel du cabinet. Suivez-la sur votre page de suivi.</span></li>' +
      '<li><span class="ico-b">' + ic('bell') + '</span><span>Un empêchement ? <b>Annulez depuis le suivi</b> : les patients suivants avancent.</span></li>' +
      '</ul><div style="display:grid;gap:10px;margin-top:20px">' +
      '<a class="btn btn-primary btn-lg" href="suivi.html?c=' + tk.code + '">' + ic('activity') + 'Suivre ma place en direct</a>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-ghost" style="flex:1" target="_blank" rel="noopener" href="' + wa + '">' + ic('share') + 'Envoyer sur WhatsApp</a>' +
      '<button class="btn btn-ghost" style="flex:1" id="again">' + ic('plus') + 'Autre ticket</button></div></div></div></div>';
    $('#again').addEventListener('click', function () { sel = { date: null, step: 1, ticket: null, form: { name: '', phone: '', reason: NS.REASONS[0], firstVisit: false } }; render(); });
  }

  function render() {
    if (sel.step === 1) renderStep1(); else if (sel.step === 2) renderStep2(); else renderStep3();
  }

  $('#findForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#findInput').value.trim(), er = $('#findErr'); er.classList.remove('show');
    var tk = NS.byCode(v);
    if (tk) { location.href = 'suivi.html?c=' + tk.code; return; }
    if (NS.validPhone(v)) {
      var list = NS.byPhone(v);
      if (list.length) { location.href = 'suivi.html?c=' + list[0].code; return; }
      er.textContent = 'Aucun ticket à venir pour ce numéro.';
    } else er.textContent = 'Code ou numéro introuvable.';
    er.classList.add('show');
  });

  fillStatic(); renderHours(); renderLive(); render();
  NS.subscribe(function () { fillStatic(); renderHours(); renderLive(); if (sel.step === 1) renderStep1(); });
  setInterval(function () { renderLive(); renderHours(); }, 20000);
})();
