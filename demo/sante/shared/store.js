/* NOOR Santé — demo data store + first-come-first-served queue engine.
   Everything lives in localStorage so the patient site, the tracking page,
   the waiting-room screen and the doctor dashboard share one live state
   (open them in several tabs: a change in one updates the others). */
(function () {
  'use strict';
  var KEY = 'noorsante.v1';
  var VERSION = 3;

  /* ---------- date helpers (local time, dates as 'YYYY-MM-DD') ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function toMin(t) { var p = t.split(':').map(Number); return p[0] * 60 + p[1]; }
  function fmt(m) { m = Math.round(m); return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
  /* demo clock: ?heure=10:30 shows the cabinet at 10:30 today (shared by all tabs) */
  var CLOCK = 'noorsante.clock', offset = 0;
  try { offset = +localStorage.getItem(CLOCK) || 0; } catch (e) { }
  function now() { return Date.now() + offset; }
  function today() { return iso(new Date(now())); }
  function nowMin() { var d = new Date(now()); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
  function setClock(hhmm) {
    var real = new Date(), target;
    if (!hhmm || hhmm === 'reel') offset = 0;
    else { target = new Date(real.getFullYear(), real.getMonth(), real.getDate()); target.setMinutes(toMin(hhmm)); offset = target.getTime() - real.getTime(); }
    try { if (offset) localStorage.setItem(CLOCK, String(offset)); else localStorage.removeItem(CLOCK); localStorage.removeItem(KEY); } catch (e) { }
  }
  (function () {
    var m = /[?&]heure=([0-9]{1,2}[:h][0-9]{2}|reel)/.exec(location.search);
    if (m) setClock(m[1].replace('h', ':'));
  })();
  function msAt(date, min) { var d = parse(date); d.setMinutes(Math.round(min)); return d.getTime(); }
  function minOf(ms) { var d = new Date(ms); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }

  var DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  var DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function longDate(s) { var d = parse(s); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function shortDate(s) { var d = parse(s); return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()]; }

  /* Moroccan public holidays with a fixed date. Religious holidays move with
     the lunar calendar: the doctor adds them in Paramètres > Fermetures. */
  var FIXED_HOLIDAYS = {
    '01-01': "Nouvel An", '01-11': "Manifeste de l'Indépendance", '01-14': 'Nouvel An amazigh',
    '05-01': 'Fête du Travail', '07-30': 'Fête du Trône', '08-14': 'Allégeance Oued Ed-Dahab',
    '08-20': 'Révolution du Roi et du Peuple', '08-21': 'Fête de la Jeunesse',
    '10-31': "Fête de l'Unité", '11-06': 'Marche Verte', '11-18': "Fête de l'Indépendance"
  };

  /* ---------- seeded random so the demo looks the same on each reset ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  var FIRST = ['Youssef', 'Fatima Zahra', 'Mohamed', 'Khadija', 'Amine', 'Salma', 'Hamza', 'Imane', 'Omar', 'Meryem', 'Mehdi', 'Hajar', 'Anas', 'Sara', 'Ayoub', 'Nadia', 'Karim', 'Zineb', 'Rachid', 'Houda', 'Ilyas', 'Laila', 'Othmane', 'Siham', 'Hicham', 'Asmae', 'Badr', 'Ghita', 'Soufiane', 'Rim', 'Adil', 'Kenza', 'Nabil', 'Loubna', 'Zakaria', 'Wiam', 'Tarik', 'Najat', 'Reda', 'Aya'];
  var LAST = ['Benali', 'El Amrani', 'Alaoui', 'Bennani', 'Tazi', 'Chraibi', 'El Idrissi', 'Berrada', 'Lahlou', 'Ouazzani', 'Fassi', 'Bouzidi', 'Naciri', 'Haddad', 'Kettani', 'Sqalli', 'Mansouri', 'Ziani', 'El Khatib', 'Rami', 'Amrani', 'Belhaj', 'Saidi', 'Tahiri', 'Jaidi', 'Hamdaoui', 'Filali', 'Ouali'];
  var REASONS = ['Consultation générale', 'Suivi tension artérielle', 'Renouvellement ordonnance', 'Fièvre / grippe', 'Résultats d\'analyses', 'Certificat médical', 'Suivi diabète', 'Douleurs abdominales', 'Contrôle enfant', 'Vaccination', 'Toux persistante', 'Mal de dos'];

  function defaults() {
    return {
      cabinet: 'Cabinet Médical Al Amal',
      doctor: 'Dr. Salma Idrissi',
      specialty: 'Médecine générale',
      address: '24, avenue de France, Agdal — Rabat',
      phone: '05 37 00 00 00',
      fee: 250,
      avg: 15,              // minutes per consultation (planned)
      maxPerDay: 0,         // 0 = automatic (hours / avg)
      horizon: 14,          // patients can book this many days ahead
      arriveEarly: 15,      // advice: arrive N minutes before the estimate
      adaptive: true,       // live ETA uses today's real average duration
      holidays: true,       // close on Moroccan fixed public holidays
      days: {
        0: { on: false, ranges: [['09:00', '12:30'], ['14:30', '18:30']] },
        1: { on: true, ranges: [['09:00', '12:30'], ['14:30', '18:30']] },
        2: { on: true, ranges: [['09:00', '12:30'], ['14:30', '18:30']] },
        3: { on: true, ranges: [['09:00', '12:30'], ['14:30', '18:30']] },
        4: { on: true, ranges: [['09:00', '12:30'], ['14:30', '18:30']] },
        5: { on: true, ranges: [['09:00', '12:00'], ['15:00', '18:30']] },
        6: { on: true, ranges: [['09:00', '13:00']] }
      },
      closed: []            // [{date, label}]
    };
  }

  var state = null;
  var listeners = [];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.version === VERSION && s.seededOn === today()) return s;
      }
    } catch (e) { /* storage blocked: fall back to memory */ }
    return seed();
  }
  function save(silent) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
    if (!silent) emit();
  }
  function emit() { listeners.forEach(function (f) { try { f(state); } catch (e) { console.error(e); } }); }
  window.addEventListener('storage', function (e) {
    if (e.key === CLOCK) { offset = +e.newValue || 0; return; }
    if (e.key !== KEY || !e.newValue) return;
    try { state = JSON.parse(e.newValue); emit(); } catch (err) { }
  });

  /* ---------- calendar ---------- */
  function holidayLabel(date) {
    if (!state.settings.holidays) return null;
    return FIXED_HOLIDAYS[date.slice(5)] || null;
  }
  function closedLabel(date) {
    var c = state.settings.closed.find(function (x) { return x.date === date; });
    return c ? c.label : holidayLabel(date);
  }
  function dayConfig(date) { return state.settings.days[parse(date).getDay()]; }
  function ranges(date) {
    var c = dayConfig(date);
    if (!c.on || closedLabel(date)) return [];
    return c.ranges.filter(function (r) { return r && r[0] && r[1] && toMin(r[1]) > toMin(r[0]); })
      .map(function (r) { return [toMin(r[0]), toMin(r[1])]; });
  }
  function isWorkingDay(date) { return ranges(date).length > 0; }
  function slotsIn(rs, avg) { return rs.reduce(function (n, r) { return n + Math.floor((r[1] - r[0]) / avg); }, 0); }
  function capacity(date) {
    var s = state.settings, n = slotsIn(ranges(date), s.avg);
    return s.maxPerDay > 0 ? Math.min(n, s.maxPerDay) : n;
  }
  /* planned start of the p-th consultation (0-based), skipping the breaks */
  function slotStart(date, p) {
    var avg = state.settings.avg, rs = ranges(date);
    for (var i = 0; i < rs.length; i++) {
      var n = Math.floor((rs[i][1] - rs[i][0]) / avg);
      if (p < n) return rs[i][0] + p * avg;
      p -= n;
    }
    return null;
  }
  /* walk `minutes` of working time forward from `start`, jumping the breaks */
  function advance(date, start, minutes) {
    var rs = ranges(date), t = start;
    for (var i = 0; i < rs.length; i++) {
      if (t < rs[i][0]) t = rs[i][0];
      if (t >= rs[i][1]) continue;
      var avail = rs[i][1] - t;
      if (minutes < avail || (minutes === avail && i === rs.length - 1)) return { min: t + minutes, overflow: false };
      minutes -= avail; t = rs[i][1];
    }
    return { min: t + minutes, overflow: true };
  }
  function workLeft(date, from) {
    return ranges(date).reduce(function (n, r) { return n + Math.max(0, r[1] - Math.max(r[0], from)); }, 0);
  }

  /* ---------- tickets ---------- */
  function ofDay(date) { return state.tickets.filter(function (t) { return t.date === date; }); }
  function active(date) { return ofDay(date).filter(function (t) { return t.status !== 'cancelled'; }); }
  function byOrder(a, b) { return (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || a.order - b.order; }
  function waiting(date) { return ofDay(date).filter(function (t) { return t.status === 'waiting'; }).sort(byOrder); }
  function current(date) { return ofDay(date).find(function (t) { return t.status === 'in'; }) || null; }

  /* average real consultation length today (needs 3 finished visits) */
  function liveAvg(date) {
    var s = state.settings;
    if (!s.adaptive) return s.avg;
    var d = ofDay(date).filter(function (t) { return t.status === 'done' && t.calledAt && t.doneAt; });
    if (d.length < 3) return s.avg;
    var last = d.sort(function (a, b) { return a.doneAt - b.doneAt; }).slice(-8);
    var m = last.reduce(function (n, t) { return n + (t.doneAt - t.calledAt) / 60000; }, 0) / last.length;
    return Math.max(5, Math.min(60, m));
  }

  /* remaining places for a day (counts only; today also limited by the clock) */
  function remaining(date) {
    var t = today();
    if (date < t || !isWorkingDay(date)) return 0;
    var left = capacity(date) - active(date).length;
    if (date === t) {
      var avg = liveAvg(date), queued = waiting(date).length + (current(date) ? 1 : 0);
      var byClock = Math.floor(workLeft(date, nowMin()) / avg) - queued;
      left = Math.min(left, byClock);
    }
    return Math.max(0, left);
  }

  function dayInfo(date) {
    var t = today(), lbl = closedLabel(date), cfg = dayConfig(date);
    var info = { date: date, open: false, reason: '', capacity: 0, booked: 0, left: 0 };
    if (date < t) { info.reason = 'Passé'; return info; }
    if (date > addDays(t, state.settings.horizon)) { info.reason = 'Pas encore ouvert'; return info; }
    if (lbl) { info.reason = lbl; return info; }
    if (!cfg.on) { info.reason = 'Jour de repos'; return info; }
    info.capacity = capacity(date); info.booked = active(date).length; info.left = remaining(date);
    info.open = info.left > 0;
    if (!info.open) info.reason = date === t && info.booked < info.capacity ? 'Journée terminée' : 'Complet';
    return info;
  }

  /* Estimated start time of a ticket.
     - future day: planned slot of its place in the queue;
     - today: now + rest of current consultation + (patients ahead × real average),
       skipping the lunch break. */
  function eta(tk) {
    var s = state.settings, date = tk.date;
    if (tk.status !== 'waiting') return { status: tk.status };
    if (date > today()) {
      var list = active(date).sort(byOrder), p = list.indexOf(list.find(function (x) { return x.id === tk.id; }));
      var m = slotStart(date, p);
      return { status: 'waiting', kind: 'planned', ahead: p, position: p + 1, min: m, label: m == null ? '—' : fmt(m) };
    }
    var q = waiting(date), ahead = q.findIndex(function (x) { return x.id === tk.id; });
    var avg = liveAvg(date), cur = current(date), now = nowMin(), rs = ranges(date);
    var start = Math.max(now, rs.length ? rs[0][0] : now), rest = 0;
    if (cur) rest = Math.max(2, avg - (now - minOf(cur.calledAt)));
    var r = advance(date, start, rest + ahead * avg);
    return { status: 'waiting', kind: 'live', ahead: ahead, position: ahead + 1, min: r.min, label: fmt(r.min), overflow: r.overflow, wait: Math.max(0, Math.round(r.min - now)), avg: avg };
  }

  function normPhone(p) {
    p = String(p || '').replace(/[\s.\-()]/g, '');
    if (p.indexOf('+212') === 0) p = '0' + p.slice(4);
    else if (p.indexOf('00212') === 0) p = '0' + p.slice(5);
    return p;
  }
  function validPhone(p) { return /^0[5-7]\d{8}$/.test(normPhone(p)); }
  function prettyPhone(p) { p = normPhone(p); return p.replace(/(\d{2})(?=\d)/g, '$1 ').trim(); }
  function code() {
    var a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', c;
    do { c = ''; for (var i = 0; i < 4; i++) c += a[Math.floor(Math.random() * a.length)]; }
    while (state.tickets.some(function (t) { return t.code === c; }));
    return c;
  }
  function nextNum(date) { return ofDay(date).reduce(function (m, t) { return Math.max(m, t.num); }, 0) + 1; }

  function book(o) {
    var date = o.date, name = String(o.name || '').trim(), phone = normPhone(o.phone);
    if (name.length < 3) return { error: 'Indiquez votre nom et prénom.' };
    if (o.source !== 'walkin' && !validPhone(phone)) return { error: 'Numéro de téléphone marocain invalide (ex. 06 12 34 56 78).' };
    var info = dayInfo(date);
    if (!info.open && o.source !== 'walkin') return { error: info.reason ? 'Ce jour n\'est pas disponible : ' + info.reason.toLowerCase() + '.' : 'Ce jour n\'est pas disponible.' };
    if (phone && active(date).some(function (t) { return t.phone === phone && t.status !== 'absent'; }))
      return { error: 'Ce numéro a déjà un ticket pour ce jour.' };
    var num = nextNum(date);
    var tk = {
      id: 't' + now().toString(36) + Math.random().toString(36).slice(2, 6), code: code(), date: date, num: num, order: num,
      name: name, phone: phone, reason: o.reason || 'Consultation générale', source: o.source || 'web',
      status: 'waiting', priority: false, firstVisit: !!o.firstVisit, createdAt: now()
    };
    state.tickets.push(tk); save();
    return { ticket: tk };
  }
  function find(id) { return state.tickets.find(function (t) { return t.id === id; }); }
  function byCode(c) { c = String(c || '').toUpperCase().trim(); return state.tickets.find(function (t) { return t.code === c; }); }
  function byPhone(p) {
    p = normPhone(p); var t = today();
    return state.tickets.filter(function (x) { return x.phone === p && x.date >= t && (x.status === 'waiting' || x.status === 'in'); })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  function finish(id) { var t = find(id); if (!t) return; t.status = 'done'; t.doneAt = now(); save(); }
  function callNext(date) {
    date = date || today();
    var cur = current(date);
    if (cur) { cur.status = 'done'; cur.doneAt = now(); }
    var nx = waiting(date)[0];
    if (nx) { nx.status = 'in'; nx.calledAt = now(); }
    save(); return nx || null;
  }
  function absent(id) { var t = find(id); if (!t) return; t.status = 'absent'; t.absentAt = now(); save(); }
  /* a late patient comes back: they go right after the next patient in line */
  function reinstate(id) {
    var t = find(id); if (!t) return;
    var q = waiting(t.date).filter(function (x) { return !x.priority; });
    t.order = q.length === 0 ? nextNum(t.date) : (q.length === 1 ? q[0].order + 0.5 : (q[0].order + q[1].order) / 2);
    t.status = 'waiting'; t.late = true; save();
  }
  function togglePriority(id) { var t = find(id); if (!t) return; t.priority = !t.priority; save(); }
  function cancel(id) { var t = find(id); if (!t) return; t.status = 'cancelled'; t.cancelledAt = now(); save(); }
  function updateSettings(patch) { Object.assign(state.settings, patch); save(); }

  function patients() {
    var map = {};
    state.tickets.forEach(function (t) {
      var k = t.phone || ('walkin:' + t.name);
      var p = map[k] || (map[k] = { key: k, name: t.name, phone: t.phone, visits: 0, absences: 0, last: null, next: null, tickets: [] });
      p.tickets.push(t);
      if (t.status === 'done') { p.visits++; if (!p.last || t.date > p.last) p.last = t.date; }
      if (t.status === 'absent') p.absences++;
      if ((t.status === 'waiting' || t.status === 'in') && t.date >= today() && (!p.next || t.date < p.next)) p.next = t.date;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  /* ---------- demo data, built around the real current date and time ---------- */
  function person(r) {
    var f = FIRST[Math.floor(r() * FIRST.length)], l = LAST[Math.floor(r() * LAST.length)];
    var ph = '06' + String(Math.floor(r() * 1e8)).padStart(8, '0');
    if (r() < 0.35) ph = '07' + ph.slice(2);
    return { name: f + ' ' + l, phone: ph };
  }
  function seed() {
    var r = rng(20261124), t = today();
    state = { version: VERSION, seededOn: t, settings: defaults(), tickets: [] };
    // a short leave inside the booking window, to show closed days
    var leave = addDays(t, 9); while (parse(leave).getDay() === 0) leave = addDays(leave, 1);
    state.settings.closed.push({ date: leave, label: 'Congrès médical' });

    var pool = []; for (var i = 0; i < 140; i++) pool.push(person(r));
    var s = state.settings, ids = 0;
    function mk(date, num, p, extra) {
      var tk = Object.assign({
        id: 's' + (ids++), code: '', date: date, num: num, order: num, name: p.name, phone: p.phone,
        reason: REASONS[Math.floor(r() * REASONS.length)], source: r() < 0.62 ? 'web' : (r() < 0.5 ? 'phone' : 'walkin'),
        status: 'waiting', priority: false, firstVisit: r() < 0.2, createdAt: msAt(addDays(date, -1 - Math.floor(r() * 4)), 600 + r() * 600)
      }, extra || {});
      if (tk.source === 'walkin') tk.createdAt = msAt(date, (slotStart(date, Math.max(0, num - 4)) || 540) - 5);
      state.tickets.push(tk); return tk;
    }
    // past 35 days: finished visits for history and statistics
    for (var d = 35; d >= 1; d--) {
      var date = addDays(t, -d);
      if (!isWorkingDay(date)) continue;
      var cap = capacity(date), n = Math.min(cap, Math.round(cap * (0.62 + r() * 0.33))), p = 0, clock = null;
      for (var k = 1; k <= n; k++) {
        var who = pool[Math.floor(r() * pool.length)], st = r();
        var status = st < 0.05 ? 'cancelled' : st < 0.12 ? 'absent' : 'done';
        var tk = mk(date, k, who, { status: status });
        if (status === 'done') {
          var planned = slotStart(date, p) || 1080;
          var start = Math.max(planned + (r() * 12 - 4), clock || 0);
          var len = s.avg * (0.6 + r() * 0.8);
          tk.calledAt = msAt(date, start); tk.doneAt = msAt(date, start + len); clock = start + len;
        }
        if (status !== 'cancelled') p++;
      }
    }
    // today: what a real day looks like at the current time
    if (isWorkingDay(t)) {
      var capT = capacity(t), nT = Math.round(capT * 0.74), now = nowMin(), clockT = null, pT = 0, called = false;
      for (var j = 1; j <= nT; j++) {
        var w = pool[Math.floor(r() * pool.length)];
        var tkT = mk(t, j, w, {});
        if (j === 6 || j === 13) { tkT.source = 'walkin'; }
        var plannedT = slotStart(t, pT) || 1080;
        var startT = Math.max(plannedT + (r() * 8 - 2), clockT || 0);
        var lenT = s.avg * (0.7 + r() * 0.6);
        if (j === 4 && startT + lenT < now) { tkT.status = 'absent'; tkT.absentAt = msAt(t, startT); pT++; continue; }
        if (startT + lenT < now) {
          tkT.status = 'done'; tkT.calledAt = msAt(t, startT); tkT.doneAt = msAt(t, startT + lenT); clockT = startT + lenT;
        } else if (!called && startT <= now) {
          tkT.status = 'in'; tkT.calledAt = msAt(t, startT); called = true; clockT = startT + lenT;
        }
        pT++;
      }
      // during opening hours, always show someone in consultation
      var inHours = ranges(t).some(function (x) { return now >= x[0] && now < x[1] - 2; });
      if (!called && inHours) {
        var nxt = state.tickets.filter(function (x) { return x.date === t && x.status === 'waiting'; }).sort(byOrder)[0];
        if (nxt) { nxt.status = 'in'; nxt.calledAt = msAt(t, now - 4); }
      }
    }
    // upcoming working days inside the booking window
    for (var f = 1; f <= s.horizon; f++) {
      var fd = addDays(t, f);
      if (!isWorkingDay(fd)) continue;
      var fill = Math.max(0.08, 0.86 - f * 0.07 + (r() * 0.16 - 0.08));
      if (f === 2) fill = 1; // one full day, to show "Complet"
      var nf = Math.min(capacity(fd), Math.round(capacity(fd) * fill));
      for (var q = 1; q <= nf; q++) mk(fd, q, pool[Math.floor(r() * pool.length)], { source: r() < 0.75 ? 'web' : 'phone' });
    }
    state.tickets.forEach(function (x) { if (!x.code) x.code = code(); });
    save(true);
    return state;
  }
  function reset() { try { localStorage.removeItem(KEY); offset = +localStorage.getItem(CLOCK) || 0; } catch (e) { } state = seed(); emit(); }

  state = load();

  window.NS = {
    get state() { return state; }, get settings() { return state.settings; },
    now: now, setClock: setClock, get clockShifted() { return offset !== 0; },
    subscribe: function (f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; },
    today: today, addDays: addDays, parse: parse, iso: iso, fmt: fmt, toMin: toMin, nowMin: nowMin, minOf: minOf,
    longDate: longDate, shortDate: shortDate, DAYS: DAYS, DAYS_SHORT: DAYS_SHORT, MONTHS: MONTHS,
    ranges: ranges, isWorkingDay: isWorkingDay, capacity: capacity, slotStart: slotStart, advance: advance,
    dayInfo: dayInfo, closedLabel: closedLabel, remaining: remaining, liveAvg: liveAvg,
    ofDay: ofDay, active: active, waiting: waiting, current: current, eta: eta, byOrder: byOrder,
    book: book, find: find, byCode: byCode, byPhone: byPhone, callNext: callNext, finish: finish,
    absent: absent, reinstate: reinstate, togglePriority: togglePriority, cancel: cancel,
    updateSettings: updateSettings, save: save, patients: patients, reset: reset,
    normPhone: normPhone, validPhone: validPhone, prettyPhone: prettyPhone, REASONS: REASONS
  };
})();
