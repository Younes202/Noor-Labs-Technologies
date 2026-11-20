// NOOR owner dashboard web demo: answers the dashboard's API calls inside the browser (by
// intercepting fetch to the demo API address), using the shared demo store
// (demo/shared/demo-store.js) that the till demo also uses. Same response shapes as the real
// FastAPI backend (backend/app/schemas), so the real dashboard screens work unchanged.
(function () {
  const D = window.NoorDemo;
  const S = () => D.state;
  const API = "https://api.demo.noor";
  const SESSION_KEY = "noorlabs_dashboard_session";

  // Land straight in the dashboard (no login step needed for a demo).
  try {
    if (!localStorage.getItem(SESSION_KEY)) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "demo", refresh_token: "demo", user_id: "u1", tenant_id: "t1", tenant_name: S().tenant_name, full_name: "Propriétaire (démo)" }));
    }
  } catch (e) { /* storage blocked: the login page still works with any e-mail */ }

  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const noContent = () => new Response(null, { status: 204 });
  const fail = (status, detail) => json({ detail }, status);

  const menuOut = (m) => ({ id: m.id, name: m.name, price: Number(m.price).toFixed(2), is_active: m.is_active, is_available: m.is_available, category_id: m.category_id, image_data: D.picture(m) });
  const staffOut = (s) => {
    const role = D.ROLES.find((r) => r.id === s.role_id);
    return { id: s.id, full_name: s.full_name, role_id: s.role_id, role_name: role ? role.name : null, is_active: s.is_active, permissions: D.staffPermissions(s) };
  };
  const staffName = (id) => (S().staff.find((s) => s.id === id) || {}).full_name || null;

  function priceOk(p) { const n = Number(p); return Number.isFinite(n) && n > 0; }
  function imageOk(v) { return v === null || v === undefined || (typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length <= 400000); }

  // ------------------------------------------------------------------ reports
  const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  function paidOrders(fromDate) {
    return S().orders.filter((o) => o.order.status === "completed" && !o.order.voided && new Date(o.order.paid_at || o.order.opened_at) >= fromDate);
  }
  function dailySales() {
    const today = paidOrders(dayStart(new Date()));
    const total = today.reduce((s, o) => s + Number(o.order.total), 0);
    return { date: new Date().toISOString().slice(0, 10), total_sales: total.toFixed(2), order_count: today.length };
  }
  function bestSellers(range) {
    const from = dayStart(new Date());
    if (range === "week") from.setDate(from.getDate() - 6);
    if (range === "month") from.setDate(from.getDate() - 29);
    const agg = {};
    for (const o of paidOrders(from)) {
      for (const i of o.items.filter((x) => !x.voided)) {
        const a = (agg[i.item_name] = agg[i.item_name] || { item_name: i.item_name, quantity_sold: 0, revenue: 0 });
        a.quantity_sold += i.quantity;
        a.revenue += Number(i.line_total);
      }
    }
    return Object.values(agg).sort((a, b) => b.quantity_sold - a.quantity_sold || b.revenue - a.revenue).map((a) => ({ ...a, revenue: a.revenue.toFixed(2) }));
  }
  function voids(params) {
    const staffId = params.get("staff_id");
    const from = params.get("date_from") ? new Date(params.get("date_from") + "T00:00:00") : null;
    const to = params.get("date_to") ? new Date(params.get("date_to") + "T23:59:59") : null;
    const out = [];
    for (const o of S().orders) {
      if (o.order.voided) {
        out.push({ scope: "order", order_id: o.order.id, item_name: null, amount: o.order.total, reason: o.order.void_reason, staff_id: o.order.voided_by || null, staff_name: staffName(o.order.voided_by), voided_at: o.order.voided_at || o.order.opened_at });
      }
      for (const i of o.items.filter((x) => x.voided)) {
        out.push({ scope: "item", order_id: o.order.id, item_name: i.item_name, amount: i.line_total, reason: i.void_reason, staff_id: i.voided_by || null, staff_name: staffName(i.voided_by), voided_at: i.voided_at || o.order.opened_at });
      }
    }
    return out
      .filter((v) => (!staffId || v.staff_id === staffId) && (!from || new Date(v.voided_at) >= from) && (!to || new Date(v.voided_at) <= to))
      .sort((a, b) => new Date(b.voided_at) - new Date(a.voided_at));
  }

  // ------------------------------------------------------------------ router
  async function handle(method, path, params, body) {
    D.load();
    let m;
    if (path === "/api/v1/auth/login" && method === "POST") {
      if (!body?.email || !body?.password) return fail(401, "Invalid restaurant, email, or password");
      return json({ access_token: "demo", refresh_token: "demo", token_type: "bearer" });
    }
    if (path === "/api/v1/auth/me") return json({ id: "u1", tenant_id: "t1", tenant_name: S().tenant_name, full_name: "Propriétaire (démo)" });

    // categories
    if (path === "/api/v1/categories" && method === "GET") return json([...S().categories].sort((a, b) => a.sort_order - b.sort_order));
    if (path === "/api/v1/categories" && method === "POST") {
      if (!body?.name?.trim()) return fail(422, "Name is required");
      const c = { id: D.uid(), name: body.name.trim(), sort_order: body.sort_order ?? S().categories.length + 1 };
      S().categories.push(c); D.save(); return json(c, 201);
    }
    if ((m = path.match(/^\/api\/v1\/categories\/([^/]+)$/))) {
      const c = S().categories.find((x) => x.id === m[1]);
      if (!c) return fail(404, "Category not found");
      if (method === "PATCH") { if (body.name !== undefined) c.name = body.name; if (body.sort_order !== undefined) c.sort_order = body.sort_order; D.save(); return json(c); }
      if (method === "DELETE") {
        S().categories = S().categories.filter((x) => x !== c);
        S().menu.forEach((i) => { if (i.category_id === c.id) i.category_id = null; });
        D.save(); return noContent();
      }
    }

    // menu items
    if (path === "/api/v1/menu-items" && method === "GET") {
      const all = params.get("include_inactive") === "true";
      return json(S().menu.filter((i) => all || i.is_active).sort((a, b) => a.name.localeCompare(b.name, "fr")).map(menuOut));
    }
    if (path === "/api/v1/menu-items" && method === "POST") {
      if (!body?.name?.trim()) return fail(422, "Name is required");
      if (!priceOk(body.price)) return fail(422, "Price must be greater than 0");
      if (!imageOk(body.image_data)) return fail(422, "image_data must be a small JPEG, PNG or WebP data URL");
      const i = { id: D.uid(), name: body.name.trim(), price: Number(body.price).toFixed(2), is_active: true, is_available: true, category_id: body.category_id || null, image_data: body.image_data || null, emoji: null };
      S().menu.push(i); D.save(); return json(menuOut(i), 201);
    }
    if ((m = path.match(/^\/api\/v1\/menu-items\/([^/]+)$/))) {
      const i = S().menu.find((x) => x.id === m[1]);
      if (!i) return fail(404, "Menu item not found");
      if (method === "PATCH") {
        if (body.name !== undefined) { if (!String(body.name).trim()) return fail(422, "Name is required"); i.name = body.name.trim(); }
        if (body.price !== undefined) { if (!priceOk(body.price)) return fail(422, "Price must be greater than 0"); i.price = Number(body.price).toFixed(2); }
        if ("category_id" in body) i.category_id = body.category_id || null;
        if (body.is_active !== undefined) i.is_active = !!body.is_active;
        if (body.is_available !== undefined) i.is_available = !!body.is_available;
        if ("image_data" in body) {
          if (!imageOk(body.image_data)) return fail(422, "image_data must be a small JPEG, PNG or WebP data URL");
          i.image_data = body.image_data;
          if (body.image_data === null) i.emoji = null; // "remove photo" also removes the sample drawing
        }
        D.save(); return json(menuOut(i));
      }
      if (method === "DELETE") { S().menu = S().menu.filter((x) => x !== i); D.save(); return noContent(); }
    }

    // reports
    if (path === "/api/v1/reports/daily-sales") return json(dailySales());
    if (path === "/api/v1/reports/best-sellers") return json(bestSellers(params.get("range") || "day"));
    if (path === "/api/v1/reports/voids") return json(voids(params));

    // staff, roles, permissions
    if (path === "/api/v1/roles") return json(D.ROLES);
    if (path === "/api/v1/permissions") return json(D.PERMISSIONS);
    if (path === "/api/v1/staff" && method === "GET") return json(S().staff.map(staffOut));
    if (path === "/api/v1/staff" && method === "POST") {
      if (!body?.full_name?.trim()) return fail(422, "Full name is required");
      if (!/^\d{4,8}$/.test(body.pin || "")) return fail(422, "PIN must be 4 to 8 digits");
      if (S().staff.some((s) => s.pin === body.pin)) return fail(400, "This PIN is already used by another staff member");
      const s = { id: D.uid(), full_name: body.full_name.trim(), pin: body.pin, role_id: body.role_id || null, is_active: true, overrides: {} };
      S().staff.push(s); D.save(); return json(staffOut(s), 201);
    }
    if ((m = path.match(/^\/api\/v1\/staff\/([^/]+)(\/permissions)?$/))) {
      const s = S().staff.find((x) => x.id === m[1]);
      if (!s) return fail(404, "Staff member not found");
      if (m[2] && method === "PUT") {
        s.overrides = {};
        for (const o of body.overrides || []) s.overrides[o.permission_key] = !!o.granted;
        D.save(); return json(staffOut(s));
      }
      if (method === "PATCH") {
        if (body.full_name !== undefined) s.full_name = body.full_name;
        if (body.pin !== undefined) {
          if (!/^\d{4,8}$/.test(body.pin)) return fail(422, "PIN must be 4 to 8 digits");
          if (S().staff.some((x) => x !== s && x.pin === body.pin)) return fail(400, "This PIN is already used by another staff member");
          s.pin = body.pin;
        }
        if ("role_id" in body) s.role_id = body.role_id || null;
        if (body.is_active !== undefined) s.is_active = !!body.is_active;
        D.save(); return json(staffOut(s));
      }
    }
    return fail(404, "Not available in the demo");
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith(API)) return realFetch(input, init);
    const u = new URL(url);
    const method = (init.method || "GET").toUpperCase();
    let body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch (e) { body = null; }
    await new Promise((r) => setTimeout(r, 120)); // feels like a real network call
    return handle(method, u.pathname, u.searchParams, body || {});
  };

  D.ribbon({
    here: "dashboard",
    text: "Espace gérant · données fictives · ce que vous changez ici apparaît sur la caisse démo",
  });
})();
