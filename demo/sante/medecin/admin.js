/* NOOR Santé — doctor dashboard */
(function () {
  var ic = UI.ic, esc = UI.esc, root = document.getElementById('root');
  var PAGES = [
    ['today', 'Aujourd\'hui', 'home'], ['agenda', 'Agenda', 'calendar'], ['patients', 'Patients', 'users'],
    ['stats', 'Statistiques', 'chart'], ['algo', 'Algorithme', 'cpu'], ['settings', 'Paramètres', 'cog']
  ];
  var ui = { page: (location.hash || '#today').slice(1), agendaDay: NS.today(), q: '', simPos: 6, simAvg: NS.settings.avg };
  if (!PAGES.some(function (p) { return p[0] === ui.page; })) ui.page = 'today';

  function authed() { try { return sessionStorage.getItem('ns.auth') === '1'; } catch (e) { return true; } }

  /* ---------- login (demo only) ---------- */
  function renderLogin() {
    var s = NS.settings;
    root.innerHTML = '<div class="login"><div class="card"><div class="brandmark"><span class="logo">' + ic('stetho') + '</span><span><b>NOOR Santé</b><small>Espace médecin</small></span></div>' +
      '<h1>Bonjour ' + esc(s.doctor) + '</h1><p class="muted" style="margin:0 0 20px">' + esc(s.cabinet) + ' · ' + NS.longDate(NS.today()) + '</p>' +
      '<div class="field" style="margin-bottom:12px"><label>Identifiant</label><input class="input" value="cabinet-demo" readonly></div>' +
      '<div class="field" style="margin-bottom:18px"><label>Mot de passe</label><input class="input" type="password" value="demo-demo" readonly></div>' +
      '<button class="btn btn-primary btn-lg" style="width:100%" id="enter">' + ic('arrowR') + 'Entrer dans la démo</button>' +
      '<p class="hint" style="margin:14px 0 0;text-align:center">Démo : données fictives, enregistrées dans ce navigateur.</p></div></div>';
    document.getElementById('enter').onclick = function () { try { sessionStorage.setItem('ns.auth', '1'); } catch (e) { } renderShell(); };
  }

  /* ---------- shell ---------- */
  function renderShell() {
    var s = NS.settings, waitingN = NS.waiting(NS.today()).length;
    var nav = PAGES.map(function (p) {
      return '<a class="nav-item' + (ui.page === p[0] ? ' on' : '') + '" href="#' + p[0] + '">' + ic(p[2]) + p[1] + (p[0] === 'today' && waitingN ? '<span class="badge">' + waitingN + '</span>' : '') + '</a>';
    }).join('');
    var mnav = PAGES.map(function (p) { return '<button class="' + (ui.page === p[0] ? 'on' : '') + '" data-go="' + p[0] + '">' + ic(p[2]) + p[1].replace('Aujourd\'hui', 'Jour').replace('Statistiques', 'Stats').replace('Paramètres', 'Réglages').replace('Algorithme', 'Algo') + '</button>'; }).join('');
    var title = PAGES.find(function (p) { return p[0] === ui.page; });
    root.innerHTML = '<div class="app"><aside class="sidebar"><div class="brandmark"><span class="logo">' + ic('stetho') + '</span><span><b>NOOR Santé</b><small>' + esc(s.cabinet) + '</small></span></div>' + nav +
      '<div class="sep"></div><a class="nav-item" href="../index.html" target="_blank">' + ic('globe') + 'Site patient</a><a class="nav-item" href="../ecran.html" target="_blank">' + ic('tv') + 'Écran salle d\'attente</a>' +
      '<div class="bottom"><div class="doc-card"><span class="avatar">' + UI.initials(s.doctor.replace(/^Dr\.?\s*/, '')) + '</span><div><b>' + esc(s.doctor) + '</b><small>' + esc(s.specialty) + '</small></div></div>' +
      '<button class="nav-item" id="logout">' + ic('logout') + 'Se déconnecter</button></div></aside>' +
      '<div class="main"><div class="topbar"><div><h1>' + title[1] + '</h1><div class="sub">' + NS.longDate(NS.today()) + ' · ' + esc(s.cabinet) + '</div></div>' +
      '<div class="right">' + (NS.clockShifted ? '<span class="chip amber" title="Heure simulée pour la démo">' + ic('clock') + 'Démo ' + NS.fmt(Math.floor(NS.nowMin())) + '</span>' : '') + '<a class="btn btn-ghost btn-sm" href="../index.html" target="_blank">' + ic('globe') + '<span>Site patient</span></a><a class="btn btn-ghost btn-sm" href="../ecran.html" target="_blank">' + ic('tv') + '<span>Écran</span></a></div></div>' +
      '<div class="content" id="page"></div></div></div><nav class="mobile-nav">' + mnav + '</nav>';
    document.getElementById('logout').onclick = function () { try { sessionStorage.removeItem('ns.auth'); } catch (e) { } renderLogin(); };
    root.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { location.hash = b.getAttribute('data-go'); }; });
    renderPage();
  }

  function renderPage() {
    var el = document.getElementById('page'); if (!el) return;
    ({ today: pToday, agenda: pAgenda, patients: pPatients, stats: pStats, algo: pAlgo, settings: pSettings })[ui.page](el);
  }

  /* ================= AUJOURD'HUI ================= */
  function kpi(label, val, sub, icon, tone) {
    return '<div class="card kpi"><div class="k-top">' + label + '<span class="k-ico ' + (tone || '') + '">' + ic(icon) + '</span></div><div class="k-val num">' + val + '</div><div class="k-sub">' + sub + '</div></div>';
  }
  function elapsed(ms) { var s = Math.max(0, Math.floor((NS.now() - ms) / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

  function pToday(el) {
    var t = NS.today(), s = NS.settings, all = NS.ofDay(t), act = NS.active(t), q = NS.waiting(t), cur = NS.current(t);
    var done = act.filter(function (x) { return x.status === 'done'; }), abs = act.filter(function (x) { return x.status === 'absent'; });
    var avg = NS.liveAvg(t), cap = NS.capacity(t), open = NS.isWorkingDay(t);
    var lastEta = q.length ? NS.eta(q[q.length - 1]) : null;
    var html = '<div class="kpis">' +
      kpi('Patients du jour', act.length + '<span style="font-size:18px;color:var(--muted)"> / ' + cap + '</span>', done.length + ' vus · ' + NS.remaining(t) + ' places encore libres', 'users') +
      kpi('En attente', q.length, lastEta ? 'Fin estimée vers ' + lastEta.label : 'File vide', 'clock', 'blue') +
      kpi('Durée moyenne', Math.round(avg) + ' min', 'Prévu : ' + s.avg + ' min · ' + (done.length >= 3 ? 'mesurée aujourd\'hui' : 'valeur des paramètres'), 'activity', 'amber') +
      kpi('Absents', abs.length, 'Recette estimée : ' + (done.length * s.fee).toLocaleString('fr-FR') + ' DH', 'userx', 'coral') + '</div>';

    if (!open) {
      html += '<div class="card panel"><div class="empty-state">' + ic('calendar') + '<h3 style="margin:0 0 4px;color:var(--ink)">Pas de consultation aujourd\'hui</h3><p style="margin:0">' + esc(NS.closedLabel(t) || 'Jour de repos') + '. Les patients réservent les prochains jours ouvrables.</p></div></div>';
      el.innerHTML = html; return;
    }
    // current consultation
    var consult = cur ? '<div class="consult"><div class="row1"><div class="cnum num">' + cur.num + '</div><div><div class="lbl">En consultation</div><h2>' + esc(cur.name) + '</h2><div class="meta">' + esc(cur.reason) + ' · ' + UI.SOURCE[cur.source] + (cur.phone ? ' · ' + NS.prettyPhone(cur.phone) : '') + (cur.firstVisit ? ' · 1re visite' : '') + '</div></div>' +
      '<div class="timer"><b class="num" id="timer">' + elapsed(cur.calledAt) + '</b><small>depuis l\'appel</small></div></div>' +
      '<div class="acts"><button class="btn btn-w btn-lg" data-act="next">' + ic('check') + (q.length ? 'Terminer & appeler n° ' + q[0].num : 'Terminer la consultation') + '</button>' +
      '<button class="btn btn-t" data-act="absent" data-id="' + cur.id + '">' + ic('userx') + 'Absent à l\'appel</button></div></div>'
      : '<div class="consult empty"><div class="row1"><div class="cnum num">—</div><div><div class="lbl">Aucun patient en consultation</div><h2>' + (q.length ? 'Prochain : n° ' + q[0].num + ' · ' + esc(q[0].name) : 'La file est vide') + '</h2><div class="meta">' + (q.length ? q.length + ' patient' + (q.length > 1 ? 's' : '') + ' en attente' : 'Ajoutez un patient sur place ou attendez les réservations.') + '</div></div></div>' +
      (q.length ? '<div class="acts"><button class="btn btn-w btn-lg" data-act="next">' + ic('bell') + 'Appeler le n° ' + q[0].num + '</button></div>' : '') + '</div>';

    var qhtml = q.length ? q.map(function (x, i) {
      var e = NS.eta(x);
      return '<div class="qitem' + (i === 0 ? ' first' : '') + (x.priority ? ' prio' : '') + '"><div class="qn num">' + x.num + '</div><div class="who"><b>' + esc(x.name) + '</b><span>' +
        (x.priority ? '<span class="chip coral">Urgence</span>' : '') + (x.late ? '<span class="chip amber">Retard réintégré</span>' : '') +
        '<span class="chip ' + (x.source === 'walkin' ? 'amber' : x.source === 'phone' ? 'blue' : '') + '">' + UI.SOURCE[x.source] + '</span>' + esc(x.reason) + '</span></div>' +
        '<div class="eta"><b class="num">' + e.label + '</b><small>' + (e.wait != null ? 'dans ' + UI.mins(e.wait) : '') + '</small><div class="qa">' +
        '<button class="icon-btn coral" title="Urgence : passer en priorité" data-act="prio" data-id="' + x.id + '">' + ic('zap') + '</button>' +
        '<button class="icon-btn coral" title="Annuler le ticket" data-act="cancel" data-id="' + x.id + '">' + ic('x') + '</button></div></div></div>';
    }).join('') : '<div class="empty-state">' + ic('users') + 'Personne en attente</div>';

    var lateList = abs.length ? '<div class="card panel"><div class="panel-head"><h3>' + ic('userx') + 'Absents à l\'appel</h3><span class="hint">Réintégrés après le patient suivant</span></div><div class="mini-list">' +
      abs.map(function (x) { return '<div class="mini-row"><span class="num">' + x.num + '</span><span class="grow">' + esc(x.name) + '</span><button class="btn btn-soft btn-sm" data-act="reinstate" data-id="' + x.id + '">' + ic('undo') + 'Réintégrer</button></div>'; }).join('') + '</div></div>' : '';

    var doneList = done.length ? '<div class="card panel"><div class="panel-head"><h3>' + ic('check') + 'Déjà reçus (' + done.length + ')</h3></div><div class="mini-list">' +
      done.slice().sort(function (a, b) { return b.doneAt - a.doneAt; }).slice(0, 8).map(function (x) {
        return '<div class="mini-row"><span class="num">' + x.num + '</span><span class="grow">' + esc(x.name) + '</span><span class="muted num">' + NS.fmt(NS.minOf(x.calledAt)) + ' · ' + Math.round((x.doneAt - x.calledAt) / 60000) + ' min</span></div>';
      }).join('') + '</div></div>' : '';

    html += '<div class="grid-2"><div style="display:grid;gap:20px">' + consult +
      '<div class="card panel"><div class="panel-head"><h3>' + ic('list') + 'File d\'attente · ordre de passage</h3><span class="chip">Premier arrivé, premier servi</span></div><div class="qlist">' + qhtml + '</div></div></div>' +
      '<div style="display:grid;gap:20px"><div class="card panel"><div class="panel-head"><h3>' + ic('clock') + 'La journée</h3><span class="hint">' + NS.ranges(t).map(function (r) { return NS.fmt(r[0]) + '–' + NS.fmt(r[1]); }).join(' · ') + '</span></div>' + dayline(t) + '</div>' +
      addForm() + lateList + doneList + '</div></div>';
    el.innerHTML = html;
    bindToday(el);
  }

  function dayline(date) {
    var r = NS.ranges(date); if (!r.length) return '';
    var a = r[0][0], b = r[r.length - 1][1], W = b - a, pos = function (m) { return ((m - a) / W * 100).toFixed(2) + '%'; };
    var avg = NS.liveAvg(date), parts = '';
    for (var i = 0; i < r.length - 1; i++) parts += '<div class="brk" style="left:' + pos(r[i][1]) + ';width:' + ((r[i + 1][0] - r[i][1]) / W * 100) + '%"></div>';
    NS.active(date).forEach(function (x) {
      var st, en, col;
      if (x.status === 'done') { st = NS.minOf(x.calledAt); en = NS.minOf(x.doneAt); col = '#5eead4'; }
      else if (x.status === 'in') { st = NS.minOf(x.calledAt); en = Math.max(NS.nowMin(), st + avg); col = '#16a34a'; }
      else if (x.status === 'waiting') { var e = NS.eta(x); st = e.min; en = e.min + avg; col = x.priority ? '#f2674e' : '#93c5fd'; }
      else return;
      if (st >= b || en <= a) return;
      st = Math.max(a, st); en = Math.min(b, en);
      parts += '<div class="blk" title="n° ' + x.num + '" style="left:' + pos(st) + ';width:calc(' + ((en - st) / W * 100).toFixed(2) + '% - 2px);background:' + col + '"></div>';
    });
    var now = NS.nowMin(); if (now > a && now < b) parts += '<div class="nowline" style="left:' + pos(now) + '"></div>';
    var ticks = ''; for (var h = Math.ceil(a / 60) * 60; h <= b; h += 120) ticks += '<span>' + NS.fmt(h) + '</span>';
    return '<div class="dayline" style="margin-top:14px">' + parts + '</div><div class="axis">' + ticks + '</div>' +
      '<div class="legend"><span><i style="background:#5eead4"></i>Vus</span><span><i style="background:#16a34a"></i>En cours</span><span><i style="background:#93c5fd"></i>Prévu (estimation)</span><span><i style="background:repeating-linear-gradient(-45deg,#eef3f2,#eef3f2 3px,#d5e0de 3px,#d5e0de 6px)"></i>Pause</span></div>';
  }

  function openDays() {
    var out = []; for (var i = 0; i <= NS.settings.horizon; i++) { var d = NS.addDays(NS.today(), i); if (NS.isWorkingDay(d)) out.push(d); } return out;
  }
  function addForm() {
    var days = openDays();
    return '<div class="card panel"><div class="panel-head"><h3>' + ic('plus') + 'Ajouter un patient</h3><span class="hint">Il prend la dernière place de la file</span></div>' +
      '<form id="addForm" class="form-grid" novalidate>' +
      '<div class="field"><label>Nom et prénom</label><input class="input" id="aName" placeholder="Nom du patient"></div>' +
      '<div class="field"><label>Téléphone (facultatif)</label><input class="input" id="aPhone" placeholder="06 …" inputmode="tel"></div>' +
      '<div class="field"><label>Origine</label><select class="input" id="aSrc"><option value="walkin">Sur place</option><option value="phone">Appel téléphonique</option></select></div>' +
      '<div class="field"><label>Jour</label><select class="input" id="aDate">' + days.map(function (d) { var i = NS.dayInfo(d); return '<option value="' + d + '">' + (d === NS.today() ? 'Aujourd\'hui' : NS.longDate(d)) + ' · ' + i.left + ' places</option>'; }).join('') + '</select></div>' +
      '<div class="field full"><label>Motif</label><select class="input" id="aReason">' + NS.REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></div>' +
      '<div class="full" style="display:flex;justify-content:flex-end"><button class="btn btn-primary" type="submit">' + ic('ticket') + 'Donner un ticket</button></div>' +
      '<div class="err full" id="aErr" style="margin:0"></div></form></div>';
  }

  function bindToday(el) {
    el.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-id'), a = b.getAttribute('data-act'), tk = id && NS.find(id);
        if (a === 'next') { var n = NS.callNext(); UI.toast(n ? 'N° ' + n.num + ' appelé — ' + n.name : 'Consultation terminée', n ? 'bell' : 'check'); }
        else if (a === 'absent') { NS.absent(id); UI.toast('N° ' + tk.num + ' marqué absent', 'userx'); }
        else if (a === 'reinstate') { NS.reinstate(id); UI.toast('N° ' + tk.num + ' réintégré après le suivant', 'undo'); }
        else if (a === 'prio') { NS.togglePriority(id); UI.toast(tk.priority ? 'N° ' + tk.num + ' passe en priorité' : 'Priorité retirée', 'zap'); }
        else if (a === 'cancel') {
          if (!b.dataset.sure) { b.dataset.sure = '1'; b.style.background = 'var(--coral-soft)'; b.title = 'Cliquer encore pour confirmer'; UI.toast('Cliquez encore pour annuler le n° ' + tk.num, 'alert'); return; }
          NS.cancel(id); UI.toast('Ticket n° ' + tk.num + ' annulé — la file avance', 'x');
        }
      };
    });
    var f = document.getElementById('addForm');
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      var src = document.getElementById('aSrc').value, phone = document.getElementById('aPhone').value.trim(), er = document.getElementById('aErr');
      if (phone && !NS.validPhone(phone)) { er.textContent = 'Numéro marocain invalide.'; er.classList.add('show'); return; }
      var res = NS.book({ date: document.getElementById('aDate').value, name: document.getElementById('aName').value, phone: phone, reason: document.getElementById('aReason').value, source: src });
      if (res.error) { er.textContent = res.error; er.classList.add('show'); return; }
      UI.toast('Ticket n° ' + res.ticket.num + ' donné à ' + res.ticket.name, 'ticket');
    };
  }

  /* ================= AGENDA ================= */
  function pAgenda(el) {
    var t = NS.today(), d0 = NS.parse(t), shift = (d0.getDay() + 6) % 7, start = NS.addDays(t, -shift), cells = '';
    ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach(function (h) { cells += '<div class="hd">' + h + '</div>'; });
    for (var i = 0; i < 21; i++) {
      var d = NS.addDays(start, i), dt = NS.parse(d), past = d < t, works = NS.isWorkingDay(d), lbl = NS.closedLabel(d);
      var cap = NS.capacity(d), n = NS.active(d).length, pct = cap ? Math.min(100, n / cap * 100) : 0;
      var cls = 'cell' + (works ? '' : ' off') + (past ? ' past' : '') + (ui.agendaDay === d ? ' sel' : '');
      cells += '<button class="' + cls + '" data-day="' + d + '"><div class="d"><span class="num">' + dt.getDate() + '</span>' + (d === t ? '<span class="chip">Auj.</span>' : '') + '</div>' +
        (works ? '<div class="cnt">' + n + ' / ' + cap + '</div><div class="why">' + (n >= cap ? 'Complet' : (cap - n) + ' libres') + '</div><div class="bar"><i class="' + (pct >= 100 ? 'full' : pct > 75 ? 'mid' : '') + '" style="width:' + pct + '%"></i></div>'
          : '<div class="why">' + esc(lbl || 'Repos') + '</div>') + '</button>';
    }
    var d = ui.agendaDay, list = NS.ofDay(d).filter(function (x) { return x.status !== 'cancelled'; }).sort(NS.byOrder), works2 = NS.isWorkingDay(d);
    var rows = list.map(function (x, i) {
      var time = x.status === 'waiting' ? NS.eta(x).label : x.calledAt ? NS.fmt(NS.minOf(x.calledAt)) : (NS.slotStart(d, i) != null ? NS.fmt(NS.slotStart(d, i)) : '—');
      return '<tr><td class="num" style="font-weight:700">' + x.num + '</td><td><div class="person"><span class="avatar">' + UI.initials(x.name) + '</span><div><b>' + esc(x.name) + '</b><small>' + (x.phone ? NS.prettyPhone(x.phone) : '—') + '</small></div></div></td><td>' + esc(x.reason) + '</td><td class="num">' + time + '</td><td>' + UI.SOURCE[x.source] + '</td><td>' + UI.statusChip(x.status) + '</td></tr>';
    }).join('');
    var closedBtn = d >= t ? (NS.settings.closed.some(function (c) { return c.date === d; }) ? '<button class="btn btn-ghost btn-sm" data-open="' + d + '">' + ic('undo') + 'Rouvrir ce jour</button>' : (works2 ? '<button class="btn btn-danger btn-sm" data-close="' + d + '">' + ic('x') + 'Fermer ce jour (congé)</button>' : '')) : '';
    el.innerHTML = '<div class="card panel"><div class="panel-head"><h3>' + ic('calendar') + '3 semaines · réservations ouvertes ' + NS.settings.horizon + ' jours à l\'avance</h3><div class="legend" style="margin:0"><span><i style="background:var(--brand-2)"></i>Places prises</span><span><i style="background:var(--amber)"></i>&gt; 75 %</span><span><i style="background:var(--coral)"></i>Complet</span></div></div><div class="cal">' + cells + '</div></div>' +
      '<div class="card panel"><div class="panel-head"><h3>' + ic('list') + NS.longDate(d) + ' · ' + list.length + ' patient' + (list.length > 1 ? 's' : '') + '</h3><div style="display:flex;gap:8px;align-items:center"><span class="hint">' + (works2 ? NS.ranges(d).map(function (r) { return NS.fmt(r[0]) + '–' + NS.fmt(r[1]); }).join(' · ') : esc(NS.closedLabel(d) || 'Jour de repos')) + '</span>' + closedBtn + '</div></div>' +
      (list.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Patient</th><th>Motif</th><th>Heure</th><th>Origine</th><th>Statut</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty-state">' + ic('calendar') + 'Aucun patient ce jour-là</div>') + '</div>';
    el.querySelectorAll('[data-day]').forEach(function (b) { b.onclick = function () { ui.agendaDay = b.getAttribute('data-day'); pAgenda(el); }; });
    el.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { var c = NS.settings.closed.slice(); c.push({ date: b.getAttribute('data-close'), label: 'Congé du cabinet' }); NS.updateSettings({ closed: c }); UI.toast('Jour fermé : plus de réservation possible', 'calendar'); }; });
    el.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { NS.updateSettings({ closed: NS.settings.closed.filter(function (c) { return c.date !== b.getAttribute('data-open'); }) }); UI.toast('Jour rouvert aux réservations', 'calendar'); }; });
  }

  /* ================= PATIENTS ================= */
  function pPatients(el) {
    var all = NS.patients().filter(function (p) { return p.phone; }), q = ui.q.toLowerCase().trim();
    var list = all.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) >= 0 || p.phone.indexOf(q.replace(/\s/g, '')) >= 0; })
      .sort(function (a, b) { return (b.next ? 1 : 0) - (a.next ? 1 : 0) || (b.last || '').localeCompare(a.last || ''); });
    var regular = all.filter(function (p) { return p.visits >= 3; }).length;
    el.innerHTML = '<div class="kpis">' + kpi('Patients', all.length, 'avec au moins un ticket', 'users') + kpi('Patients fidèles', regular, '3 visites ou plus', 'star', 'amber') +
      kpi('Rendez-vous à venir', all.filter(function (p) { return p.next; }).length, 'dans les ' + NS.settings.horizon + ' prochains jours', 'calendar', 'blue') +
      kpi('Absences répétées', all.filter(function (p) { return p.absences >= 2; }).length, '2 absences ou plus', 'userx', 'coral') + '</div>' +
      '<div class="card panel"><div class="panel-head"><h3>' + ic('users') + 'Fichier patients</h3><div class="search" style="min-width:min(320px,100%)">' + ic('search') + '<input class="input" id="q" placeholder="Rechercher un nom ou un téléphone" value="' + esc(ui.q) + '"></div></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Patient</th><th>Visites</th><th>Dernière visite</th><th>Prochain ticket</th><th>Absences</th></tr></thead><tbody>' +
      list.slice(0, 60).map(function (p) {
        return '<tr class="click" data-p="' + esc(p.key) + '"><td><div class="person"><span class="avatar">' + UI.initials(p.name) + '</span><div><b>' + esc(p.name) + '</b><small>' + NS.prettyPhone(p.phone) + '</small></div></div></td><td class="num">' + p.visits + '</td><td>' + (p.last ? NS.shortDate(p.last) : '—') + '</td><td>' + (p.next ? '<span class="chip blue">' + (p.next === NS.today() ? 'Aujourd\'hui' : NS.shortDate(p.next)) + '</span>' : '—') + '</td><td>' + (p.absences ? '<span class="chip ' + (p.absences >= 2 ? 'coral' : 'gray') + '">' + p.absences + '</span>' : '0') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (list.length > 60 ? '<p class="hint" style="margin:12px 0 0">60 premiers résultats sur ' + list.length + '. Affinez la recherche.</p>' : '') + '</div>';
    var qi = document.getElementById('q');
    qi.oninput = function () { ui.q = qi.value; var pos = qi.selectionStart; pPatients(el); var n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelectorAll('[data-p]').forEach(function (r) { r.onclick = function () { openPatient(r.getAttribute('data-p')); }; });
  }
  function openPatient(key) {
    var p = NS.patients().find(function (x) { return x.key === key; }); if (!p) return;
    var d = document.getElementById('drawer'), bg = document.getElementById('drawerBg');
    var hist = p.tickets.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    d.innerHTML = '<header><span class="avatar">' + UI.initials(p.name) + '</span><div><h3>' + esc(p.name) + '</h3><span class="muted">' + NS.prettyPhone(p.phone) + '</span></div><button class="icon-btn close" id="dClose">' + ic('x') + '</button></header>' +
      '<div class="body"><div class="sim-out"><div><b class="num">' + p.visits + '</b><small>Visites</small></div><div><b class="num">' + p.absences + '</b><small>Absences</small></div><div><b class="num">' + (p.visits * NS.settings.fee).toLocaleString('fr-FR') + '</b><small>DH réglés</small></div></div>' +
      '<div style="display:flex;gap:8px"><a class="btn btn-soft" style="flex:1" href="tel:' + p.phone + '">' + ic('phone') + 'Appeler</a><a class="btn btn-ghost" style="flex:1" target="_blank" rel="noopener" href="https://wa.me/212' + p.phone.slice(1) + '">' + ic('share') + 'WhatsApp</a></div>' +
      '<h4 style="margin:6px 0 0">Historique</h4><div class="mini-list">' + hist.map(function (t) {
        return '<div class="mini-row"><span class="num" style="width:auto;min-width:64px">' + NS.shortDate(t.date) + '</span><span class="grow">' + esc(t.reason) + '</span>' + UI.statusChip(t.status) + '</div>';
      }).join('') + '</div></div>';
    d.classList.add('open'); bg.classList.add('open');
    function close() { d.classList.remove('open'); bg.classList.remove('open'); }
    document.getElementById('dClose').onclick = close; bg.onclick = close;
  }

  /* ================= STATISTIQUES ================= */
  function pStats(el) {
    var t = NS.today(), s = NS.settings, days = [], tot = 0, absN = 0, cancN = 0, durs = [], src = { web: 0, phone: 0, walkin: 0 }, wd = [0, 0, 0, 0, 0, 0, 0], wdN = [0, 0, 0, 0, 0, 0, 0], late = [];
    for (var i = 29; i >= 0; i--) {
      var d = NS.addDays(t, -i), list = NS.ofDay(d), done = list.filter(function (x) { return x.status === 'done'; }), ab = list.filter(function (x) { return x.status === 'absent'; });
      days.push({ d: d, n: done.length, a: ab.length, work: NS.isWorkingDay(d) });
      tot += done.length; absN += ab.length; cancN += list.filter(function (x) { return x.status === 'cancelled'; }).length;
      list.forEach(function (x) { if (x.status !== 'cancelled') src[x.source]++; });
      done.forEach(function (x) { durs.push((x.doneAt - x.calledAt) / 60000); });
      if (NS.isWorkingDay(d) && i > 0) { wd[NS.parse(d).getDay()] += done.length; wdN[NS.parse(d).getDay()]++; }
    }
    var max = Math.max.apply(null, days.map(function (x) { return x.n + x.a; })) || 1;
    var bars = days.map(function (x, i) {
      var dt = NS.parse(x.d);
      return '<div class="b" title="' + NS.longDate(x.d) + ' : ' + x.n + ' vus, ' + x.a + ' absents">' + (x.a ? '<i class="abs" style="height:' + (x.a / max * 100) + '%"></i>' : '') + '<i style="height:' + (x.n / max * 100) + '%;' + (x.n ? '' : 'min-height:0') + '"></i><small>' + (i % 3 === 0 || i === 29 ? dt.getDate() : '&nbsp;') + '</small></div>';
    }).join('');
    var avgD = durs.length ? durs.reduce(function (a, b) { return a + b; }, 0) / durs.length : s.avg;
    var rate = tot + absN ? absN / (tot + absN) * 100 : 0;
    var order = [1, 2, 3, 4, 5, 6], wmax = Math.max.apply(null, order.map(function (k) { return wdN[k] ? wd[k] / wdN[k] : 0; })) || 1;
    var hb = order.filter(function (k) { return s.days[k].on; }).map(function (k) { var v = wdN[k] ? wd[k] / wdN[k] : 0; return '<div class="hbar"><span>' + NS.DAYS[k] + '</span><div class="tr"><i style="width:' + (v / wmax * 100) + '%"></i></div><span class="v num">' + v.toFixed(1) + '</span></div>'; }).join('');
    var sTot = src.web + src.phone + src.walkin || 1, C = 2 * Math.PI * 54, off = 0, cols = { web: '#0f766e', phone: '#60a5fa', walkin: '#f59e0b' };
    var donut = '<svg width="150" height="150" viewBox="0 0 150 150" style="transform:rotate(-90deg)">' + ['web', 'phone', 'walkin'].map(function (k) {
      var len = src[k] / sTot * C, seg = '<circle cx="75" cy="75" r="54" fill="none" stroke="' + cols[k] + '" stroke-width="22" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '"/>'; off += len; return seg;
    }).join('') + '</svg>';
    el.innerHTML = '<div class="kpis">' + kpi('Patients reçus', tot, '30 derniers jours', 'users') + kpi('Recette estimée', (tot * s.fee).toLocaleString('fr-FR') + ' DH', s.fee + ' DH par consultation', 'wallet', 'amber') +
      kpi('Taux d\'absence', rate.toFixed(1) + ' %', absN + ' absents · ' + cancN + ' annulations', 'userx', 'coral') + kpi('Durée réelle', Math.round(avgD) + ' min', 'par consultation (prévu ' + s.avg + ' min)', 'clock', 'blue') + '</div>' +
      '<div class="card panel"><div class="panel-head"><h3>' + ic('chart') + 'Patients par jour · 30 jours</h3><div class="legend" style="margin:0"><span><i style="background:var(--brand-2)"></i>Vus</span><span><i style="background:var(--coral)"></i>Absents</span></div></div><div class="bars">' + bars + '</div></div>' +
      '<div class="grid-2"><div class="card panel"><div class="panel-head"><h3>' + ic('calendar') + 'Moyenne par jour de la semaine</h3></div>' + hb + '</div>' +
      '<div class="card panel"><div class="panel-head"><h3>' + ic('globe') + 'Comment les patients réservent</h3></div><div class="donut-wrap">' + donut + '<div class="donut-legend">' +
      ['web', 'phone', 'walkin'].map(function (k) { return '<div><i style="background:' + cols[k] + '"></i>' + UI.SOURCE[k] + ' · <b class="num">' + Math.round(src[k] / sTot * 100) + ' %</b></div>'; }).join('') +
      '<p class="hint" style="margin:4px 0 0;max-width:240px">Chaque réservation en ligne, c\'est un appel de moins pour le secrétariat.</p></div></div></div></div>';
  }

  /* ================= ALGORITHME ================= */
  function pAlgo(el) {
    var s = NS.settings, t = NS.today(), r = NS.ranges(t).length ? NS.ranges(t) : NS.ranges(nextWork());
    var rules = [
      ['Jours ouvrables uniquement', 'Le calendrier ne propose que les jours de consultation : jours de repos, jours fériés marocains et congés du cabinet sont fermés automatiquement.'],
      ['Capacité calculée', 'Places par jour = minutes de consultation ÷ durée moyenne (' + s.avg + ' min), pause exclue. Le médecin peut fixer un plafond.'],
      ['Premier arrivé, premier servi', 'Chaque ticket reçoit le numéro suivant du jour. L\'ordre de passage est l\'ordre des tickets : personne ne peut doubler.'],
      ['Heure estimée', 'Début de séance + rang dans la file × durée moyenne, en sautant automatiquement la pause de midi.'],
      ['Recalcul en direct', 'Le jour même, l\'estimation repart de l\'heure réelle et de la durée moyenne observée sur les dernières consultations.'],
      ['Absents, retards, urgences', 'Absent à l\'appel : on passe au suivant. À son arrivée, il est réintégré après le prochain patient. Seule une urgence décidée par le médecin passe devant.'],
      ['Annulations', 'Un patient qui annule libère sa place : tous les suivants avancent et leur heure estimée se met à jour.'],
      ['Un ticket par personne', 'Un numéro de téléphone ne peut avoir qu\'un ticket actif par jour : pas de réservations en double.']
    ];
    var sim = simulate(r, ui.simAvg, ui.simPos);
    el.innerHTML = '<div class="card panel"><div class="panel-head"><h3>' + ic('cpu') + 'L\'algorithme de file d\'attente</h3><span class="chip">FIFO · jours ouvrables</span></div>' +
      '<p style="margin:0 0 16px;color:var(--ink-2);max-width:760px">Le cabinet ne donne pas des rendez-vous à heure fixe que personne ne respecte : il gère une <b>file d\'attente ordonnée</b>, accessible en ligne. Le patient garde sa place et sait à quelle heure venir.</p>' +
      '<div class="formula"><span class="c">// places d\'un jour ouvrable</span><br><span class="k">capacité</span> = Σ ⌊ durée de chaque séance ÷ durée moyenne ⌋<br><br>' +
      '<span class="c">// à la réservation</span><br><span class="k">numéro</span> = dernier numéro du jour + 1 &nbsp;&nbsp;<span class="c">// premier arrivé, premier servi</span><br><br>' +
      '<span class="c">// heure estimée (jours suivants)</span><br><span class="k">heure</span> = ouverture + rang × durée moyenne &nbsp;&nbsp;<span class="c">// + pause si on la traverse</span><br><br>' +
      '<span class="c">// heure estimée (aujourd\'hui, en direct)</span><br><span class="k">heure</span> = maintenant + reste de la consultation en cours + patients devant × durée moyenne réelle</div></div>' +
      '<div class="rules">' + rules.map(function (x, i) { return '<div class="card rule"><span class="n">' + (i + 1) + '</span><div><h4>' + x[0] + '</h4><p>' + x[1] + '</p></div></div>'; }).join('') + '</div>' +
      '<div class="card panel"><div class="panel-head"><h3>' + ic('activity') + 'Simulateur</h3><span class="hint">Horaires du jour : ' + r.map(function (x) { return NS.fmt(x[0]) + '–' + NS.fmt(x[1]); }).join(' · ') + '</span></div>' +
      '<div class="sim"><div style="display:grid;gap:18px"><div class="field"><label>Rang dans la file : <b class="num" id="sp">' + ui.simPos + '</b></label><input type="range" class="range" id="simPos" min="1" max="' + Math.max(1, sim.cap) + '" value="' + Math.min(ui.simPos, sim.cap) + '"></div>' +
      '<div class="field"><label>Durée moyenne d\'une consultation : <b class="num" id="sa">' + ui.simAvg + ' min</b></label><input type="range" class="range" id="simAvg" min="8" max="40" step="1" value="' + ui.simAvg + '"></div></div>' +
      '<div><div class="sim-out"><div><b class="num" id="o1">' + sim.cap + '</b><small>Places par jour</small></div><div><b class="num" id="o2">' + sim.eta + '</b><small>Heure estimée</small></div><div><b class="num" id="o3">' + sim.arrive + '</b><small>Arriver vers</small></div></div>' +
      '<div id="simLine" style="margin-top:14px">' + sim.line + '</div></div></div></div>';
    var sp = document.getElementById('simPos'), sa = document.getElementById('simAvg');
    function upd() {
      ui.simPos = +sp.value; ui.simAvg = +sa.value; var x = simulate(r, ui.simAvg, ui.simPos);
      sp.max = Math.max(1, x.cap); if (ui.simPos > x.cap) { ui.simPos = x.cap; sp.value = x.cap; x = simulate(r, ui.simAvg, ui.simPos); }
      document.getElementById('sp').textContent = ui.simPos; document.getElementById('sa').textContent = ui.simAvg + ' min';
      document.getElementById('o1').textContent = x.cap; document.getElementById('o2').textContent = x.eta; document.getElementById('o3').textContent = x.arrive; document.getElementById('simLine').innerHTML = x.line;
    }
    sp.oninput = upd; sa.oninput = upd;
  }
  function nextWork() { for (var i = 1; i < 14; i++) { var d = NS.addDays(NS.today(), i); if (NS.isWorkingDay(d)) return d; } return NS.today(); }
  function simulate(r, avg, pos) {
    var cap = r.reduce(function (n, x) { return n + Math.floor((x[1] - x[0]) / avg); }, 0), p = Math.min(pos, cap) - 1, m = null, k = p;
    for (var i = 0; i < r.length; i++) { var n = Math.floor((r[i][1] - r[i][0]) / avg); if (k < n) { m = r[i][0] + k * avg; break; } k -= n; }
    var a = r[0][0], b = r[r.length - 1][1], W = b - a, html = '<div class="dayline">', j, c = 0;
    for (i = 0; i < r.length - 1; i++) html += '<div class="brk" style="left:' + ((r[i][1] - a) / W * 100) + '%;width:' + ((r[i + 1][0] - r[i][1]) / W * 100) + '%"></div>';
    for (i = 0; i < r.length; i++) for (j = r[i][0]; j + avg <= r[i][1]; j += avg) {
      html += '<div class="blk" style="left:' + ((j - a) / W * 100) + '%;width:calc(' + (avg / W * 100) + '% - 2px);background:' + (c === p ? '#0f766e' : c < p ? '#99f6e4' : '#e2e8f0') + '"></div>'; c++;
    }
    html += '</div><div class="axis"><span>' + NS.fmt(a) + '</span><span>' + NS.fmt(b) + '</span></div><div class="legend"><span><i style="background:#99f6e4"></i>Patients avant</span><span><i style="background:#0f766e"></i>Ce patient</span><span><i style="background:#e2e8f0"></i>Places suivantes</span></div>';
    return { cap: cap, eta: m == null ? '—' : NS.fmt(m), arrive: m == null ? '—' : NS.fmt(Math.max(a - 10, m - NS.settings.arriveEarly)), line: html };
  }

  /* ================= PARAMÈTRES ================= */
  function pSettings(el) {
    var s = NS.settings, order = [1, 2, 3, 4, 5, 6, 0];
    var week = order.map(function (d) {
      var c = s.days[d], r1 = c.ranges[0] || ['', ''], r2 = c.ranges[1] || ['', ''];
      return '<div class="wk' + (c.on ? '' : ' off') + '"><label class="switch"><input type="checkbox" data-day-on="' + d + '"' + (c.on ? ' checked' : '') + '><span class="tr"></span>' + NS.DAYS[d] + '</label>' +
        '<div class="times">Matin <input type="time" data-r="' + d + '-0-0" value="' + r1[0] + '"> – <input type="time" data-r="' + d + '-0-1" value="' + r1[1] + '">' +
        ' Après-midi <input type="time" data-r="' + d + '-1-0" value="' + r2[0] + '"> – <input type="time" data-r="' + d + '-1-1" value="' + r2[1] + '"></div></div>';
    }).join('');
    var closed = s.closed.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (c) {
      return '<div class="closed-row"><b>' + NS.longDate(c.date) + '</b><span class="grow" style="flex:1">' + esc(c.label) + '</span><button class="icon-btn coral" data-del="' + c.date + '">' + ic('x') + '</button></div>';
    }).join('') || '<p class="hint" style="margin:0">Aucune fermeture exceptionnelle.</p>';
    el.innerHTML = '<div class="set-grid"><div style="display:grid;gap:20px"><div class="card panel"><div class="panel-head"><h3>' + ic('stetho') + 'Cabinet</h3></div><div class="form-grid">' +
      fld('cabinet', 'Nom du cabinet', s.cabinet) + fld('doctor', 'Médecin', s.doctor) + fld('specialty', 'Spécialité', s.specialty) + fld('phone', 'Téléphone', s.phone) +
      '<div class="field full"><label>Adresse</label><input class="input" data-k="address" value="' + esc(s.address) + '"></div>' + fld('fee', 'Tarif consultation (DH)', s.fee, 'number') + '</div></div>' +
      '<div class="card panel"><div class="panel-head"><h3>' + ic('cpu') + 'Règles de la file</h3></div><div class="form-grid">' +
      fld('avg', 'Durée moyenne (min)', s.avg, 'number') + fld('maxPerDay', 'Plafond / jour (0 = auto)', s.maxPerDay, 'number') + fld('horizon', 'Réservation jusqu\'à (jours)', s.horizon, 'number') + fld('arriveEarly', 'Venir avant (min)', s.arriveEarly, 'number') +
      '<label class="switch full"><input type="checkbox" data-b="adaptive"' + (s.adaptive ? ' checked' : '') + '><span class="tr"></span>Ajuster l\'heure estimée à la durée réelle du jour</label>' +
      '<label class="switch full"><input type="checkbox" data-b="holidays"' + (s.holidays ? ' checked' : '') + '><span class="tr"></span>Fermer les jours fériés nationaux (dates fixes)</label></div></div></div>' +
      '<div style="display:grid;gap:20px"><div class="card panel"><div class="panel-head"><h3>' + ic('clock') + 'Jours et horaires de travail</h3></div><div class="week">' + week + '</div><p class="hint" style="margin:10px 0 0">Laissez l\'après-midi vide pour une demi-journée.</p></div>' +
      '<div class="card panel"><div class="panel-head"><h3>' + ic('calendar') + 'Fermetures exceptionnelles</h3></div><div class="closed-list">' + closed + '</div>' +
      '<form id="addClosed" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><input class="input" type="date" id="cDate" style="flex:1;min-width:150px" min="' + NS.today() + '"><input class="input" id="cLabel" placeholder="Motif (ex. Aïd, congé)" style="flex:1.4;min-width:150px"><button class="btn btn-soft" type="submit">' + ic('plus') + 'Ajouter</button></form>' +
      '<p class="hint" style="margin:10px 0 0">Les fêtes religieuses (Aïd, Achoura…) changent chaque année : ajoutez-les ici.</p></div>' +
      '<div class="card panel"><div class="panel-head"><h3>' + ic('refresh') + 'Démo</h3></div><p class="hint" style="margin:0 0 12px">Recrée les patients fictifs autour de la date et de l\'heure actuelles. Pour présenter le cabinet en pleine journée à toute heure, simulez une heure.</p>' +
      '<form id="clockForm" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><input class="input" type="time" id="clockIn" style="flex:1;min-width:130px" value="' + (NS.clockShifted ? NS.fmt(Math.floor(NS.nowMin())) : '10:30') + '"><button class="btn btn-soft" type="submit">' + ic('clock') + 'Simuler cette heure</button>' + (NS.clockShifted ? '<button class="btn btn-ghost" type="button" id="clockReal">Heure réelle</button>' : '') + '</form>' +
      '<button class="btn btn-ghost" id="reset">' + ic('refresh') + 'Réinitialiser les données de démo</button></div></div></div>';
    function fld(k, l, v, type) { return '<div class="field"><label>' + l + '</label><input class="input" data-k="' + k + '" type="' + (type || 'text') + '" value="' + esc(v) + '"></div>'; }
    el.querySelectorAll('[data-k]').forEach(function (i) {
      i.onchange = function () {
        var k = i.getAttribute('data-k'), v = i.type === 'number' ? Math.max(0, +i.value || 0) : i.value.trim(), p = {};
        if (k === 'avg' && v < 5) v = 5; if (k === 'horizon') v = Math.min(60, Math.max(1, v));
        p[k] = v; NS.updateSettings(p); UI.toast('Enregistré', 'check');
      };
    });
    el.querySelectorAll('[data-b]').forEach(function (i) { i.onchange = function () { var p = {}; p[i.getAttribute('data-b')] = i.checked; NS.updateSettings(p); UI.toast('Enregistré', 'check'); }; });
    el.querySelectorAll('[data-day-on]').forEach(function (i) {
      i.onchange = function () { var d = i.getAttribute('data-day-on'), days = JSON.parse(JSON.stringify(s.days)); days[d].on = i.checked; NS.updateSettings({ days: days }); pSettings(el); UI.toast(NS.DAYS[d] + (i.checked ? ' ouvert' : ' fermé'), 'calendar'); };
    });
    el.querySelectorAll('[data-r]').forEach(function (i) {
      i.onchange = function () {
        var p = i.getAttribute('data-r').split('-').map(Number), days = JSON.parse(JSON.stringify(s.days)), rs = days[p[0]].ranges;
        while (rs.length <= p[1]) rs.push(['', '']); rs[p[1]] = rs[p[1]] || ['', '']; rs[p[1]][p[2]] = i.value;
        days[p[0]].ranges = rs.filter(function (x, idx) { return idx === 0 || (x[0] || x[1]); });
        NS.updateSettings({ days: days }); UI.toast('Horaires enregistrés', 'clock');
      };
    });
    el.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { NS.updateSettings({ closed: s.closed.filter(function (c) { return c.date !== b.getAttribute('data-del'); }) }); pSettings(el); }; });
    document.getElementById('addClosed').onsubmit = function (e) {
      e.preventDefault(); var d = document.getElementById('cDate').value, l = document.getElementById('cLabel').value.trim() || 'Fermeture';
      if (!d) return; var c = s.closed.filter(function (x) { return x.date !== d; }); c.push({ date: d, label: l }); NS.updateSettings({ closed: c }); pSettings(el); UI.toast('Fermeture ajoutée', 'calendar');
    };
    document.getElementById('clockForm').onsubmit = function (e) { e.preventDefault(); var v = document.getElementById('clockIn').value; NS.setClock(v); NS.reset(); renderShell(); UI.toast('Démo à ' + v, 'clock'); };
    var cr = document.getElementById('clockReal'); if (cr) cr.onclick = function () { NS.setClock('reel'); NS.reset(); renderShell(); UI.toast('Heure réelle', 'clock'); };
    document.getElementById('reset').onclick = function () { NS.reset(); UI.toast('Données de démo recréées', 'refresh'); pSettings(el); };
  }

  /* ---------- routing & live updates ---------- */
  function closeDrawer() { document.getElementById('drawer').classList.remove('open'); document.getElementById('drawerBg').classList.remove('open'); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  window.addEventListener('hashchange', function () {
    closeDrawer();
    var p = location.hash.slice(1); if (!PAGES.some(function (x) { return x[0] === p; })) return;
    ui.page = p; if (authed()) { renderShell(); window.scrollTo(0, 0); }
  });
  NS.subscribe(function () { if (!authed() || !document.getElementById('page')) return; if (ui.page === 'settings') return; renderShell(); });
  setInterval(function () {
    var tm = document.getElementById('timer'), cur = NS.current(NS.today());
    if (tm && cur) tm.textContent = elapsed(cur.calledAt);
  }, 1000);
  setInterval(function () { if (authed() && ui.page === 'today' && !document.activeElement.closest('form')) renderPage(); }, 30000);

  if (authed()) renderShell(); else renderLogin();
})();
