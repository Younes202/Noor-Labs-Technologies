// NOOR Caisse web demo: replaces the Electron bridge (window.noorlabsPos) with an in-browser
// version so the real till screens can be tried on the website. Everything stays in this
// browser (localStorage): no server, no real printer. Same rules as the real till:
// staff PIN, reasons required to void, a paid order can't be edited, orders wait to be sent
// while "internet" is off.
(function () {
  const KEY = "noorCaisseDemo.v1";
  const TAX_RATE = 0; // café prices in Morocco are shown tax included

  const STAFF = [
    { id: "s1", fullName: "Yassine B.", pin: "1234", role: "Gérant", permissions: ["can_void_order"] },
    { id: "s2", fullName: "Salma K.", pin: "5678", role: "Serveuse", permissions: [] },
  ];

  // [id, name, price, emoji, colour from, colour to, available]
  const MENU = [
    ["m01", "Café noir", "10.00", "☕", "#6b3e26", "#c08552", 1],
    ["m02", "Café crème", "12.00", "🥛", "#a16207", "#f5deb3", 1],
    ["m03", "Nos-nos", "12.00", "☕", "#92400e", "#fcd9a8", 1],
    ["m04", "Thé à la menthe", "10.00", "🍵", "#2f6b3a", "#9bd17f", 1],
    ["m05", "Jus d'orange pressé", "15.00", "🍊", "#e8590c", "#ffd8a8", 1],
    ["m06", "Jus d'avocat", "20.00", "🥑", "#3f6212", "#bef264", 1],
    ["m07", "Msemen", "5.00", "🫓", "#b7791f", "#fde68a", 1],
    ["m08", "Harcha", "5.00", "🥮", "#a16207", "#fef3c7", 1],
    ["m09", "Baghrir au miel", "7.00", "🥞", "#b45309", "#fde68a", 1],
    ["m10", "Croissant", "6.00", "🥐", "#c2410c", "#fed7aa", 1],
    ["m11", "Pain au chocolat", "7.00", "🍫", "#7c2d12", "#fdba74", 1],
    ["m12", "Omelette fromage", "20.00", "🍳", "#ca8a04", "#fef08a", 1],
    ["m13", "Petit-déjeuner marocain", "35.00", "🍽️", "#7c3aed", "#ddd6fe", 1],
    ["m14", "Eau minérale", "6.00", "💧", "#0369a1", "#bae6fd", 1],
    ["m15", "Panini poulet", "25.00", "🥪", "#92400e", "#fcd34d", 0],
  ];

  // ------------------------------------------------------------------ storage
  function fresh() {
    return { session: { tenant_name: "Café Démo · Salé", tenant_locked: "false" }, activeStaffId: null, orders: [], online: true, printer: null, autoStart: true };
  }
  function load() {
    try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return fresh(); }
  }
  let state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: memory only */ } }

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ------------------------------------------------------------------ pictures (drawn, no downloads)
  const tiles = {};
  function tile(emoji, from, to) {
    const c = document.createElement("canvas");
    c.width = 320; c.height = 200;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 320, 200);
    grad.addColorStop(0, from); grad.addColorStop(1, to);
    g.fillStyle = grad; g.fillRect(0, 0, 320, 200);
    g.globalAlpha = 0.18; g.fillStyle = "#fff";
    g.beginPath(); g.arc(255, 30, 85, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.font = '112px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(emoji, 160, 106);
    return c.toDataURL("image/jpeg", 0.85);
  }
  function menuItems() {
    return MENU.map(([id, name, price, emoji, a, b, ok]) => ({
      id, name, price, is_active: 1, is_available: ok,
      image_data: tiles[id] || (tiles[id] = tile(emoji, a, b)),
    }));
  }

  // ------------------------------------------------------------------ helpers mirroring the real till
  const activeStaff = () => STAFF.find((s) => s.id === state.activeStaffId) || null;
  function requireStaff() {
    if (!state.session) throw new Error("Not signed in");
    const s = activeStaff();
    if (!s) throw new Error("No staff clocked in -- pick your name and enter your PIN first");
    return s;
  }
  const findOrder = (id) => state.orders.find((o) => o.order.id === id);
  const openOrder = () => state.orders.find((o) => o.order.status === "open" && !o.order.voided);
  function assertOpen(o) {
    if (!o) throw new Error("Order not found");
    if (o.order.voided) throw new Error("Order is voided");
    if (o.order.status !== "open") throw new Error(`Order is already ${o.order.status}`);
  }
  function recompute(o) {
    const subtotal = o.items.filter((i) => !i.voided).reduce((s, i) => s + Number(i.line_total), 0);
    const tax = Math.round(subtotal * TAX_RATE) / 100;
    o.order.subtotal = money(subtotal);
    o.order.tax_amount = money(tax);
    o.order.total = money(subtotal + tax);
  }
  function requireReason(reason) {
    if (typeof reason !== "string" || !reason.trim()) throw new Error("A reason is required to void");
  }
  function markPending(o) { o.order.synced = state.online; }
  function done(o) { save(); return clone(o); }

  // ------------------------------------------------------------------ the bridge (same names as pos/electron/preload.js)
  window.noorlabsPos = {
    ping: async () => "pong",
    getSession: async () => (state.session ? clone(state.session) : null),
    getTenantLockStatus: async () => ({ locked: false, warning: false, daysUntilLock: null }),
    login: async (tenantSlug, email, password) => {
      await delay(400);
      if (!email || !password) throw new Error("Login failed");
      state.session = { tenant_name: "Café Démo · Salé", tenant_locked: "false" };
      save();
      return { ok: true };
    },
    logout: async () => { state.session = null; state.activeStaffId = null; save(); },

    syncMenu: async () => {
      await delay(500);
      if (!state.online) throw new Error("Failed to fetch");
      return { count: MENU.length };
    },
    listMenu: async () => menuItems(),

    listStaff: async () => STAFF.map(({ id, fullName }) => ({ id, fullName })),
    getActiveStaff: async () => {
      const s = activeStaff();
      return s ? { id: s.id, fullName: s.fullName, permissions: s.permissions } : null;
    },
    staffPinLogin: async (pin) => {
      await delay(250);
      if (!state.session) throw new Error("Till is not set up yet -- sign in first");
      const s = STAFF.find((x) => x.pin === pin);
      if (!s) throw new Error("Incorrect PIN");
      state.activeStaffId = s.id; save();
      return { id: s.id, fullName: s.fullName };
    },
    staffClockOut: async () => { state.activeStaffId = null; save(); },

    getCurrentOrder: async () => { const o = openOrder(); return o ? clone(o) : null; },
    listMyOrdersToday: async () => {
      const s = requireStaff();
      const today = new Date().toDateString();
      return state.orders
        .filter((o) => o.order.opened_by === s.id && new Date(o.order.opened_at).toDateString() === today)
        .map((o) => clone(o.order))
        .reverse();
    },
    getOrderById: async (orderId) => { const o = findOrder(orderId); return o ? clone(o) : null; },

    addItem: async (menuItemId, itemName, unitPrice, quantity) => {
      const s = requireStaff();
      let o = openOrder();
      if (!o) {
        o = { order: { id: uid(), status: "open", voided: 0, opened_by: s.id, opened_at: new Date().toISOString(), subtotal: "0.00", tax_amount: "0.00", total: "0.00" }, items: [] };
        state.orders.push(o);
      }
      o.items.push({ id: uid(), menu_item_id: menuItemId, item_name: itemName, unit_price: String(unitPrice), quantity, line_total: money(Number(unitPrice) * quantity), voided: 0 });
      recompute(o);
      return done(o);
    },
    removeItem: async (orderItemId) => {
      const o = state.orders.find((x) => x.items.some((i) => i.id === orderItemId));
      if (!o) return null;
      assertOpen(o);
      o.items = o.items.filter((i) => i.id !== orderItemId);
      recompute(o);
      if (o.items.length === 0) state.orders = state.orders.filter((x) => x !== o);
      save();
      return o.items.length ? clone(o) : null;
    },
    voidItem: async (orderItemId, reason) => {
      const s = requireStaff();
      if (!s.permissions.includes("can_void_order")) throw new Error(`${s.fullName} does not have permission to void`);
      requireReason(reason);
      const o = state.orders.find((x) => x.items.some((i) => i.id === orderItemId));
      if (!o) throw new Error("Item not found");
      assertOpen(o);
      const item = o.items.find((i) => i.id === orderItemId);
      Object.assign(item, { voided: 1, void_reason: reason.trim(), voided_by: s.id });
      recompute(o);
      return done(o);
    },
    voidOrder: async (orderId, reason) => {
      const s = requireStaff();
      if (!s.permissions.includes("can_void_order")) throw new Error(`${s.fullName} does not have permission to void`);
      requireReason(reason);
      const o = findOrder(orderId);
      if (!o) throw new Error("Order not found");
      Object.assign(o.order, { voided: 1, status: "voided", void_reason: reason.trim(), voided_by: s.id });
      markPending(o);
      return done(o);
    },
    recordPayment: async (orderId, paymentMethod) => {
      requireStaff();
      if (!["cash", "card"].includes(paymentMethod)) throw new Error("Payment method must be one of: cash, card");
      const o = findOrder(orderId);
      assertOpen(o);
      Object.assign(o.order, { status: "completed", payment_method: paymentMethod, paid_at: new Date().toISOString() });
      markPending(o);
      save();
      showTicket(o, paymentMethod);
      return clone(o);
    },

    syncPendingCount: async () => state.orders.filter((o) => o.order.status !== "open" && !o.order.synced).length,
    syncNow: async () => {
      await delay(500);
      if (!state.online) return { ok: false };
      state.orders.forEach((o) => { if (o.order.status !== "open") o.order.synced = true; });
      save();
      return { ok: true };
    },

    getPrinterConfig: async () => (state.printer ? clone(state.printer) : null),
    savePrinterConfig: async (config) => { state.printer = config; save(); return { ok: true }; },
    scanForPrinters: async () => { await delay(900); return ["192.168.1.50"]; },
    testPrint: async (config) => {
      await delay(600);
      if (!config || (config.type === "network" && !config.host)) throw new Error("No printer configured -- open Printer Setup to configure one.");
      return { ok: true };
    },
    getAutoStart: async () => !!state.autoStart,
    setAutoStart: async (enabled) => { state.autoStart = !!enabled; save(); },
  };

  // ------------------------------------------------------------------ demo ribbon + ticket preview
  const CSS = `
  #noorDemoBar{position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;justify-content:center;
    padding:7px 12px;background:linear-gradient(90deg,#4c1d95,#7c3aed);color:#fff;font:600 12.5px/1.3 system-ui,"Segoe UI",sans-serif}
  #noorDemoBar b{background:#fff;color:#4c1d95;border-radius:999px;padding:2px 9px;font-size:11px;letter-spacing:.04em}
  #noorDemoBar button,#noorDemoBar a{all:unset;cursor:pointer;border:1px solid rgba(255,255,255,.55);border-radius:999px;padding:3px 10px;color:#fff;font-size:12px}
  #noorDemoBar button:hover,#noorDemoBar a:hover{background:rgba(255,255,255,.15)}
  #noorDemoBar .off{background:#dc2626;border-color:#dc2626}
  body{padding-top:40px!important}
  #noorTicket{position:fixed;inset:0;z-index:10000;background:rgba(15,10,26,.55);display:flex;align-items:center;justify-content:center;padding:16px}
  #noorTicket .paper{background:#fff;color:#111;width:290px;max-width:100%;padding:18px 16px;font:13px/1.45 "Courier New",monospace;box-shadow:0 20px 50px rgba(0,0,0,.35);
    border-radius:4px;max-height:85vh;overflow:auto}
  #noorTicket .c{text-align:center}#noorTicket .row{display:flex;justify-content:space-between;gap:8px}
  #noorTicket hr{border:0;border-top:1px dashed #999;margin:8px 0}
  #noorTicket .note{font:12px system-ui,sans-serif;color:#555;text-align:center;margin-top:10px}
  #noorTicket button{all:unset;display:block;text-align:center;margin:12px auto 0;background:#7c3aed;color:#fff;border-radius:999px;padding:7px 18px;font:600 13px system-ui,sans-serif;cursor:pointer}`;
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function bar() {
    if (document.getElementById("noorDemoBar")) return;
    const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
    const el = document.createElement("div"); el.id = "noorDemoBar";
    el.innerHTML = `<b>DÉMO</b><span>NOOR Caisse · données fictives · connexion : n'importe quel e-mail · PIN Yassine <u>1234</u> (gérant), Salma <u>5678</u></span>
      <button id="noorNet"></button><button id="noorReset">Réinitialiser</button><a href="/#apps">← Retour au site</a>`;
    document.body.appendChild(el);
    const net = el.querySelector("#noorNet");
    const paint = () => { net.textContent = state.online ? "📶 Internet : connecté (simuler une coupure)" : "🚫 Internet coupé (rétablir)"; net.classList.toggle("off", !state.online); };
    net.onclick = () => { state.online = !state.online; save(); paint(); };
    el.querySelector("#noorReset").onclick = () => {
      try { localStorage.removeItem(KEY); } catch (e) {}
      const i = location.pathname.indexOf("/demo/caisse/");
      location.href = i >= 0 ? location.pathname.slice(0, i) + "/demo/caisse/" : "/";
    };
    paint();
  }

  function showTicket(o, method) {
    const lines = o.items.filter((i) => !i.voided)
      .map((i) => `<div class="row"><span>${i.quantity}x ${esc(i.item_name)}</span><span>${i.line_total}</span></div>`).join("");
    const d = new Date();
    const box = document.createElement("div"); box.id = "noorTicket";
    box.innerHTML = `<div class="paper">
      <div class="c"><strong>${esc(state.session.tenant_name)}</strong><br>${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div><hr>
      ${lines}<hr>
      <div class="row"><span>Sous-total :</span><span>${o.order.subtotal}</span></div>
      <div class="row"><span>TVA :</span><span>${o.order.tax_amount}</span></div>
      <div class="row"><strong>Total :</strong><strong>${o.order.total} DH</strong></div>
      <div class="row"><span>Paiement :</span><span>${method === "cash" ? "Espèces" : "Carte"}</span></div><hr>
      <div class="c">Merci de votre visite</div>
      <div class="note">Aperçu du ticket imprimé${method === "cash" ? " · le tiroir-caisse s'ouvre" : ""}${state.online ? "" : " · commande gardée sur la caisse, envoyée au retour d'internet"}</div>
      <button>Commande suivante</button></div>`;
    box.querySelector("button").onclick = () => box.remove();
    box.onclick = (e) => { if (e.target === box) box.remove(); };
    document.body.appendChild(box);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bar); else bar();
})();
