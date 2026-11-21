// NOOR Caisse web demo: replaces the Electron bridge (window.noorlabsPos) with an in-browser
// version so the real till screens can be tried on the website. Data lives in the shared demo
// store (demo/shared/demo-store.js), so orders taken here appear in the demo owner dashboard
// and menu changes made there appear here. Same rules as the real till: staff PIN, reasons
// required to void, a paid order can't be edited, orders wait to be sent while "internet" is off.
(function () {
  const D = window.NoorDemo;
  const S = () => D.state;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const clone = (x) => JSON.parse(JSON.stringify(x));

  const session = () => (S().tillSession ? { tenant_name: S().tenant_name, tenant_locked: "false" } : null);
  const activeStaff = () => {
    const s = S().staff.find((x) => x.id === S().activeStaffId && x.is_active);
    return s ? { id: s.id, fullName: s.full_name, permissions: D.staffPermissions(s) } : null;
  };
  function requireStaff() {
    if (!session()) throw new Error("Not signed in");
    const s = activeStaff();
    if (!s) throw new Error("No staff clocked in -- pick your name and enter your PIN first");
    return s;
  }
  const findOrder = (id) => S().orders.find((o) => o.order.id === id);
  const openOrder = () => S().orders.find((o) => o.order.status === "open" && !o.order.voided);
  function assertOpen(o) {
    if (!o) throw new Error("Order not found");
    if (o.order.voided) throw new Error("Order is voided");
    if (o.order.status !== "open") throw new Error(`Order is already ${o.order.status}`);
  }
  function requireReason(reason) {
    if (typeof reason !== "string" || !reason.trim()) throw new Error("A reason is required to void");
  }
  function requireVoid(s) {
    if (!s.permissions.includes("can_void_order")) throw new Error(`${s.fullName} does not have permission to void`);
  }
  const done = (o) => { D.save(); return clone(o); };

  window.noorlabsPos = {
    ping: async () => "pong",
    getSession: async () => session(),
    getTenantLockStatus: async () => ({ locked: false, warning: false, daysUntilLock: null }),
    login: async (tenantSlug, email, password) => {
      await delay(400);
      if (!email || !password) throw new Error("Login failed");
      S().tillSession = true; D.save();
      return { ok: true };
    },
    logout: async () => { S().tillSession = false; S().activeStaffId = null; D.save(); },

    syncMenu: async () => {
      await delay(500);
      if (!S().online) throw new Error("Failed to fetch");
      D.load();
      return { count: S().menu.filter((m) => m.is_active).length };
    },
    listMenu: async () => {
      D.load();
      return S().menu.filter((m) => m.is_active).map((m) => ({
        id: m.id, name: m.name, price: m.price, is_active: 1, is_available: m.is_available ? 1 : 0, image_data: D.picture(m),
        category_id: m.category_id || null,
        category_name: ((S().categories || []).find((c) => c.id === m.category_id) || {}).name || null,
        category_sort: ((S().categories || []).find((c) => c.id === m.category_id) || {}).sort_order || 99,
      })).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },

    listStaff: async () => S().staff.filter((s) => s.is_active).map((s) => ({ id: s.id, fullName: s.full_name })),
    getActiveStaff: async () => activeStaff(),
    staffPinLogin: async (pin) => {
      await delay(250);
      if (!session()) throw new Error("Till is not set up yet -- sign in first");
      const s = S().staff.find((x) => x.is_active && x.pin === pin);
      if (!s) throw new Error("Incorrect PIN");
      S().activeStaffId = s.id; D.save();
      return { id: s.id, fullName: s.full_name };
    },
    staffClockOut: async () => { S().activeStaffId = null; D.save(); },

    getCurrentOrder: async () => { const o = openOrder(); return o ? clone(o) : null; },
    listMyOrdersToday: async () => {
      const s = requireStaff();
      const today = new Date().toDateString();
      return S().orders
        .filter((o) => o.order.opened_by === s.id && new Date(o.order.opened_at).toDateString() === today)
        .map((o) => clone(o.order))
        .reverse();
    },
    getOrderById: async (orderId) => { const o = findOrder(orderId); return o ? clone(o) : null; },

    addItem: async (menuItemId, itemName, unitPrice, quantity) => {
      const s = requireStaff();
      let o = openOrder();
      if (!o) {
        o = { order: { id: D.uid(), status: "open", voided: 0, opened_by: s.id, opened_at: new Date().toISOString(), subtotal: "0.00", tax_amount: "0.00", total: "0.00" }, items: [] };
        S().orders.push(o);
      }
      o.items.push({ id: D.uid(), menu_item_id: menuItemId, item_name: itemName, unit_price: String(unitPrice), quantity, line_total: D.money(Number(unitPrice) * quantity), voided: 0 });
      D.recompute(o);
      return done(o);
    },
    removeItem: async (orderItemId) => {
      const o = S().orders.find((x) => x.items.some((i) => i.id === orderItemId));
      if (!o) return null;
      assertOpen(o);
      o.items = o.items.filter((i) => i.id !== orderItemId);
      D.recompute(o);
      if (o.items.length === 0) S().orders = S().orders.filter((x) => x !== o);
      D.save();
      return o.items.length ? clone(o) : null;
    },
    voidItem: async (orderItemId, reason) => {
      const s = requireStaff();
      requireVoid(s);
      requireReason(reason);
      const o = S().orders.find((x) => x.items.some((i) => i.id === orderItemId));
      if (!o) throw new Error("Item not found");
      assertOpen(o);
      Object.assign(o.items.find((i) => i.id === orderItemId), { voided: 1, void_reason: reason.trim(), voided_by: s.id, voided_at: new Date().toISOString() });
      D.recompute(o);
      return done(o);
    },
    voidOrder: async (orderId, reason) => {
      const s = requireStaff();
      requireVoid(s);
      requireReason(reason);
      const o = findOrder(orderId);
      if (!o) throw new Error("Order not found");
      Object.assign(o.order, { voided: 1, status: "voided", void_reason: reason.trim(), voided_by: s.id, voided_at: new Date().toISOString(), synced: S().online });
      return done(o);
    },
    recordPayment: async (orderId, paymentMethod) => {
      requireStaff();
      if (!["cash", "card"].includes(paymentMethod)) throw new Error("Payment method must be one of: cash, card");
      const o = findOrder(orderId);
      assertOpen(o);
      Object.assign(o.order, { status: "completed", payment_method: paymentMethod, paid_at: new Date().toISOString(), synced: S().online });
      D.save();
      showTicket(o, paymentMethod);
      return clone(o);
    },

    syncPendingCount: async () => S().orders.filter((o) => o.order.status !== "open" && !o.order.synced).length,
    syncNow: async () => {
      await delay(500);
      if (!S().online) return { ok: false };
      S().orders.forEach((o) => { if (o.order.status !== "open") o.order.synced = true; });
      D.save();
      return { ok: true };
    },

    getPrinterConfig: async () => (S().printer ? clone(S().printer) : null),
    savePrinterConfig: async (config) => { S().printer = config; D.save(); return { ok: true }; },
    scanForPrinters: async () => { await delay(900); return ["192.168.1.50"]; },
    testPrint: async (config) => {
      await delay(600);
      if (!config || (config.type === "network" && !config.host)) throw new Error("No printer configured -- open Printer Setup to configure one.");
      return { ok: true };
    },
    getAutoStart: async () => !!S().autoStart,
    setAutoStart: async (enabled) => { S().autoStart = !!enabled; D.save(); },
  };

  // The till is an online (cloud) service: older demo sessions may still carry the removed "internet cut" toggle.
  try { D.load(); if (!S().online) { S().online = true; D.save(); } } catch (e) { /* ignore */ }

  // ------------------------------------------------------------------ ribbon + printed-ticket preview
  D.ribbon({
    here: "caisse",
    text: "NOOR Caisse · données fictives · PIN Yassine <u>1234</u> (gérant), Salma <u>5678</u>",
  });

  const TICKET_CSS = `
  #noorTicket{position:fixed;inset:0;z-index:10000;background:rgba(15,10,26,.55);display:flex;align-items:center;justify-content:center;padding:16px}
  #noorTicket .paper{background:#fff;color:#111;width:290px;max-width:100%;padding:18px 16px;font:13px/1.45 "Courier New",monospace;box-shadow:0 20px 50px rgba(0,0,0,.35);
    border-radius:4px;max-height:85vh;overflow:auto}
  #noorTicket .c{text-align:center}#noorTicket .row{display:flex;justify-content:space-between;gap:8px}
  #noorTicket hr{border:0;border-top:1px dashed #999;margin:8px 0}
  #noorTicket .note{font:12px system-ui,sans-serif;color:#555;text-align:center;margin-top:10px}
  #noorTicket button{all:unset;display:block;text-align:center;margin:12px auto 0;background:#7c3aed;color:#fff;border-radius:999px;padding:7px 18px;font:600 13px system-ui,sans-serif;cursor:pointer}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function showTicket(o, method) {
    if (!document.getElementById("noorTicketCss")) {
      const st = document.createElement("style"); st.id = "noorTicketCss"; st.textContent = TICKET_CSS; document.head.appendChild(st);
    }
    const lines = o.items.filter((i) => !i.voided)
      .map((i) => `<div class="row"><span>${i.quantity}x ${esc(i.item_name)}</span><span>${i.line_total}</span></div>`).join("");
    const d = new Date();
    const box = document.createElement("div"); box.id = "noorTicket";
    box.innerHTML = `<div class="paper">
      <div class="c"><strong>${esc(S().tenant_name)}</strong><br>${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div><hr>
      ${lines}<hr>
      <div class="row"><span>Sous-total :</span><span>${o.order.subtotal}</span></div>
      <div class="row"><span>TVA :</span><span>${o.order.tax_amount}</span></div>
      <div class="row"><strong>Total :</strong><strong>${o.order.total} DH</strong></div>
      <div class="row"><span>Paiement :</span><span>${method === "cash" ? "Espèces" : "Carte"}</span></div><hr>
      <div class="c">Merci de votre visite</div>
      <div class="note">Aperçu du ticket imprimé${method === "cash" ? " · le tiroir-caisse s'ouvre" : ""}
        <br>Elle apparaît aussi dans l'<a href="/demo/dashboard/reports" target="_blank">espace gérant</a>.</div>
      <button>Commande suivante</button></div>`;
    box.querySelector("button").onclick = () => box.remove();
    box.onclick = (e) => { if (e.target === box) box.remove(); };
    document.body.appendChild(box);
  }
})();
