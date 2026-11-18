import { store, json, TIMES, isBookableDay, slotKey, todayCentral } from "../lib/shared.mjs";
import { timingSafeEqual, createHash } from "node:crypto";

const MAX_FAILS = 5, LOCK_MS = 15 * 60 * 1000;
const sha = (s) => createHash("sha256").update(String(s)).digest();

export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const PIN = String(process.env.OWNER_PIN || process.env.owner_pin || "").trim();
  if (PIN.length < 6) return json({ error: "pin_not_set" }, 503);

  const s = store();
  const ipKey = `lock/${sha(context.ip || "unknown").toString("hex").slice(0, 24)}`;
  const lock = (await s.get(ipKey, { type: "json" })) || { fails: 0, until: 0 };
  if (lock.until > Date.now()) return json({ error: "locked" }, 429);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (!timingSafeEqual(sha(body.pin ?? ""), sha(PIN))) {
    const fails = lock.fails + 1;
    await s.setJSON(ipKey, fails >= MAX_FAILS ? { fails: 0, until: Date.now() + LOCK_MS } : { fails, until: 0 });
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: fails >= MAX_FAILS ? "locked" : "wrong_pin" }, 401);
  }
  if (lock.fails) await s.delete(ipKey);

  const action = body.action;
  if (action === "cancel") {
    const id = String(body.id || "");
    const rec = await s.get(`booking/${id}`, { type: "json" });
    if (!rec) return json({ error: "not_found" }, 404);
    await s.delete(slotKey(rec.date, rec.time));
    await s.delete(`booking/${id}`);
    return json({ ok: true });
  }
  if (action === "block" || action === "unblock") {
    const date = String(body.date || "");
    const times = body.time === "all" ? TIMES : [String(body.time || "")];
    if (!isBookableDay(date) || !times.every((t) => TIMES.includes(t))) return json({ error: "bad_time" }, 400);
    for (const t of times) {
      const k = slotKey(date, t);
      if (action === "block") await s.setJSON(k, { status: "blocked" }, { onlyIfNew: true });
      else {
        const cur = await s.get(k, { type: "json" });
        if (cur && cur.status === "blocked") await s.delete(k);
      }
    }
    return json({ ok: true });
  }

  // Default: list upcoming bookings and blocked times
  const today = todayCentral();
  const { blobs } = await s.list({ prefix: "booking/" });
  const bookings = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }))))
    .filter((r) => r && r.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const slots = await s.list({ prefix: "slot/" });
  const blocked = [];
  for (const b of slots.blobs) {
    const [, date, hhmm] = b.key.split("/");
    if (date < today) continue;
    const v = await s.get(b.key, { type: "json" });
    if (v && v.status === "blocked") blocked.push({ date, time: `${hhmm.slice(0, 2)}:${hhmm.slice(2)}` });
  }
  blocked.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return json({ bookings, blocked });
};

export const config = { path: "/api/owner" };
