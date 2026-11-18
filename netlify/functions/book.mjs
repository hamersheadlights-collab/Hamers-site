import { store, json, TIMES, SERVICES, isBookableDay, isPastCutoff, slotKey, todayCentral } from "../lib/shared.mjs";
import { createHash } from "node:crypto";

// One device can book at most this many appointments a day, so a bot cannot fill the calendar.
const MAX_PER_DAY = 3;

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (clean(body.company, 50)) return json({ ok: true, id: "x" }); // spam trap

  const b = {
    date: clean(body.date, 10),
    time: clean(body.time, 5),
    service: clean(body.service, 10),
    name: clean(body.name, 80),
    phone: clean(body.phone, 30),
    email: clean(body.email, 120),
    address: clean(body.address, 200),
    vehicle: clean(body.vehicle, 100),
    notes: clean(body.notes, 500),
  };
  if (!isBookableDay(b.date) || !TIMES.includes(b.time)) return json({ error: "bad_time" }, 400);
  if (!isPastCutoff(b.date, b.time)) return json({ error: "too_soon" }, 400);
  if (!SERVICES[b.service]) return json({ error: "bad_service" }, 400);
  if (!b.name || !b.address || !b.vehicle) return json({ error: "missing" }, 400);
  if (b.phone.replace(/\D/g, "").length < 10) return json({ error: "bad_phone" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return json({ error: "bad_email" }, 400);

  const s = store();
  const ipHash = createHash("sha256").update(String(context?.ip || "unknown")).digest("hex").slice(0, 24);
  const rateKey = `rate/${todayCentral()}/${ipHash}`;
  const used = Number((await s.get(rateKey, { type: "json" }))?.count || 0);
  if (used >= MAX_PER_DAY) return json({ error: "too_many" }, 429);
  const id = crypto.randomUUID();
  const claim = await s.setJSON(slotKey(b.date, b.time), { status: "booked", id }, { onlyIfNew: true });
  if (!claim.modified) return json({ error: "taken" }, 409);

  const record = { id, ...b, price: SERVICES[b.service].price, serviceLabel: SERVICES[b.service].label, createdAt: new Date().toISOString() };
  try {
    await s.setJSON(`booking/${id}`, record);
  } catch (e) {
    await s.delete(slotKey(b.date, b.time)).catch(() => {});
    return json({ error: "save_failed" }, 500);
  }
  await s.setJSON(rateKey, { count: used + 1 }).catch(() => {});
  return json({ ok: true, id });
};

export const config = { path: "/api/book" };
