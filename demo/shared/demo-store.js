// Shared data for the NOOR web demos (till: /demo/caisse/, owner dashboard: /demo/dashboard/).
// Both run in the visitor's browser and read/write the same localStorage entry, so an order taken
// on the demo till shows up in the dashboard reports, and a menu change in the dashboard shows up
// on the till. No server is involved. Exposes window.NoorDemo.
(function () {
  const KEY = "noorDemo.v2";
  const PERMISSIONS = [
    { id: "p1", key: "can_void_order", description: "Void or cancel an order or item" },
    { id: "p2", key: "can_manage_menu", description: "Create, edit, or deactivate menu categories and items" },
    { id: "p3", key: "can_manage_staff", description: "Add staff, assign roles, and override individual permissions" },
    { id: "p4", key: "can_view_reports", description: "View sales and void/cancellation reports" },
    { id: "p5", key: "can_transfer_to_kitchen", description: "Transfer an order to the kitchen" },
  ];
  const ROLES = [
    { id: "r1", name: "Gérant", permissions: PERMISSIONS.map((p) => p.key) },
    { id: "r2", name: "Serveur / caissier", permissions: ["can_transfer_to_kitchen"] },
  ];
  const TENANT = "Café Démo · Salé";

  // [id, name, price, emoji, colour from, colour to, available, category]
  const MENU = [
    ["m01", "Café noir", "10.00", "☕", "#6b3e26", "#c08552", 1, "c1"],
    ["m02", "Café crème", "12.00", "🥛", "#a16207", "#f5deb3", 1, "c1"],
    ["m03", "Nos-nos", "12.00", "☕", "#92400e", "#fcd9a8", 1, "c1"],
    ["m04", "Thé à la menthe", "10.00", "🍵", "#2f6b3a", "#9bd17f", 1, "c1"],
    ["m05", "Jus d'orange pressé", "15.00", "🍊", "#e8590c", "#ffd8a8", 1, "c2"],
    ["m06", "Jus d'avocat", "20.00", "🥑", "#3f6212", "#bef264", 1, "c2"],
    ["m07", "Msemen", "5.00", "🫓", "#b7791f", "#fde68a", 1, "c3"],
    ["m08", "Harcha", "5.00", "🥮", "#a16207", "#fef3c7", 1, "c3"],
    ["m09", "Baghrir au miel", "7.00", "🥞", "#b45309", "#fde68a", 1, "c3"],
    ["m10", "Croissant", "6.00", "🥐", "#c2410c", "#fed7aa", 1, "c3"],
    ["m11", "Pain au chocolat", "7.00", "🍫", "#7c2d12", "#fdba74", 1, "c3"],
    ["m12", "Omelette fromage", "20.00", "🍳", "#ca8a04", "#fef08a", 1, "c4"],
    ["m13", "Petit-déjeuner marocain", "35.00", "🍽️", "#7c3aed", "#ddd6fe", 1, "c4"],
    ["m14", "Eau minérale", "6.00", "💧", "#0369a1", "#bae6fd", 1, "c2"],
    ["m15", "Panini poulet", "25.00", "🥪", "#92400e", "#fcd34d", 0, "c4"],
  ];

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2);

  // A few days of past orders so the dashboard reports are not empty on first visit.
  function seedOrders(menu) {
    const orders = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const pick = () => menu[Math.floor(rnd() * 14)];
    const now = new Date();
    for (let day = 6; day >= 0; day--) {
      const count = day === 0 ? 9 : 14 + Math.floor(rnd() * 8);
      for (let k = 0; k < count; k++) {
        const d = new Date(now);
        d.setDate(d.getDate() - day);
        d.setHours(7 + Math.floor((k / count) * (day === 0 ? Math.max(1, now.getHours() - 7) : 12)), Math.floor(rnd() * 60), 0, 0);
        if (d > now) d.setTime(now.getTime() - (count - k) * 60000);
        const items = [];
        const lines = 1 + Math.floor(rnd() * 3);
        for (let l = 0; l < lines; l++) {
          const m = pick();
          const q = 1 + Math.floor(rnd() * 2);
          items.push({ id: uid(), menu_item_id: m.id, item_name: m.name, unit_price: m.price, quantity: q, line_total: money(Number(m.price) * q), voided: 0 });
        }
        const staff = rnd() < 0.6 ? "s1" : "s2";
        const o = { order: { id: uid(), status: "completed", voided: 0, opened_by: staff, opened_at: d.toISOString(), paid_at: d.toISOString(), payment_method: rnd() < 0.8 ? "cash" : "card", synced: true }, items };
        if (day === 0 && k === 3) { items[0].voided = 1; items[0].void_reason = "Client a changé d'avis"; items[0].voided_by = "s1"; items[0].voided_at = d.toISOString(); }
        if (day === 1 && k === 5) Object.assign(o.order, { voided: 1, status: "voided", void_reason: "Erreur de saisie", voided_by: "s1", voided_at: d.toISOString() });
        recompute(o);
        orders.push(o);
      }
    }
    return orders;
  }

  function recompute(o) {
    const subtotal = o.items.filter((i) => !i.voided).reduce((s, i) => s + Number(i.line_total), 0);
    o.order.subtotal = money(subtotal);
    o.order.tax_amount = "0.00";
    o.order.total = money(subtotal);
  }

  function fresh() {
    const menu = MENU.map(([id, name, price, emoji, a, b, ok, cat]) => ({
      id, name, price, emoji, from: a, to: b, is_active: true, is_available: !!ok, category_id: cat, image_data: null,
    }));
    return {
      version: 2,
      tenant_name: TENANT,
      tillSession: true,
      activeStaffId: null,
      online: true,
      printer: null,
      autoStart: true,
      categories: [
        { id: "c1", name: "Boissons chaudes", sort_order: 1 },
        { id: "c2", name: "Jus et boissons fraîches", sort_order: 2 },
        { id: "c3", name: "Viennoiseries et crêpes", sort_order: 3 },
        { id: "c4", name: "Plats", sort_order: 4 },
      ],
      menu,
      staff: [
        { id: "s1", full_name: "Yassine B.", pin: "1234", role_id: "r1", is_active: true, overrides: {} },
        { id: "s2", full_name: "Salma K.", pin: "5678", role_id: "r2", is_active: true, overrides: {} },
      ],
      orders: seedOrders(menu),
    };
  }

  let state;
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      state = saved && saved.version === 2 ? saved : fresh();
    } catch (e) {
      state = fresh();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full or private mode: keep in memory */ }
  }
  load();
  if (!localStorage.getItem(KEY)) save();
  // The other demo (another tab) changed the data: reload it.
  window.addEventListener("storage", (e) => { if (e.key === KEY) load(); });

  // Pictures drawn on the fly for the sample menu (uploaded photos are stored as data URLs instead).
  const tiles = {};
  function tile(item) {
    if (tiles[item.id]) return tiles[item.id];
    const c = document.createElement("canvas");
    c.width = 320; c.height = 200;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 320, 200);
    grad.addColorStop(0, item.from || "#7c3aed"); grad.addColorStop(1, item.to || "#ddd6fe");
    g.fillStyle = grad; g.fillRect(0, 0, 320, 200);
    g.globalAlpha = 0.18; g.fillStyle = "#fff";
    g.beginPath(); g.arc(255, 30, 85, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    if (item.emoji) {
      g.font = '112px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(item.emoji, 160, 106);
    }
    return (tiles[item.id] = c.toDataURL("image/jpeg", 0.85));
  }
  function picture(item) {
    if (item.image_data) return item.image_data;
    return item.emoji ? tile(item) : null;
  }

  function staffPermissions(s) {
    const role = ROLES.find((r) => r.id === s.role_id);
    const set = new Set(role ? role.permissions : []);
    for (const [k, v] of Object.entries(s.overrides || {})) { if (v) set.add(k); else set.delete(k); }
    return [...set];
  }

  function reset() {
    try { localStorage.removeItem(KEY); localStorage.removeItem("noorlabs_dashboard_session"); } catch (e) { /* ignore */ }
    load();
  }

  // ------------------------------------------------------------------ demo ribbon
  const CSS = `
  #noorDemoBar{position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:center;
    padding:7px 12px;background:linear-gradient(90deg,#4c1d95,#7c3aed);color:#fff;font:600 12.5px/1.3 system-ui,"Segoe UI",sans-serif}
  #noorDemoBar b{background:#fff;color:#4c1d95;border-radius:999px;padding:2px 9px;font-size:11px;letter-spacing:.04em}
  #noorDemoBar button,#noorDemoBar a{all:unset;cursor:pointer;border:1px solid rgba(255,255,255,.55);border-radius:999px;padding:3px 10px;color:#fff;font-size:12px}
  #noorDemoBar button:hover,#noorDemoBar a:hover{background:rgba(255,255,255,.15)}
  #noorDemoBar .off{background:#dc2626;border-color:#dc2626}
  #noorDemoBar .here{background:#fff;color:#4c1d95}
  body{padding-top:40px!important}`;

  function ribbon({ text, here, extra }) {
    const build = () => {
      if (document.getElementById("noorDemoBar")) return;
      const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
      const el = document.createElement("div"); el.id = "noorDemoBar";
      el.innerHTML = `<b>DÉMO</b><span>${text}</span>
        <a href="/demo/caisse/" class="${here === "caisse" ? "here" : ""}">🧾 Caisse</a>
        <a href="/demo/dashboard/" class="${here === "dashboard" ? "here" : ""}">📊 Espace gérant</a>
        <button id="noorReset">Réinitialiser</button><a href="/#apps">← Site</a>`;
      document.body.appendChild(el);
      el.querySelector("#noorReset").onclick = () => { reset(); location.href = here === "dashboard" ? "/demo/dashboard/" : "/demo/caisse/"; };
      if (extra) extra(el);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
  }

  window.NoorDemo = {
    get state() { return state; },
    save, load, reset, uid, money, recompute, picture, staffPermissions, ribbon,
    PERMISSIONS, ROLES,
  };
})();
