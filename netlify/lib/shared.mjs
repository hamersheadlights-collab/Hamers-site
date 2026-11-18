import { getStore } from "@netlify/blobs";

export const TIMES = ["09:00", "11:00", "13:00", "15:00"];
export const SERVICES = {
  one: { label: "One headlight", price: 35 },
  both: { label: "Car headlights, both", price: 60 },
  semi: { label: "Truck headlights, both (pickups to semis)", price: 75 },
};
export const DAYS_AHEAD = 60;

export const store = () => getStore({ name: "bookings", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Today's date in the Quad Cities, as YYYY-MM-DD
export function todayCentral() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// The Quad Cities local date and time 24 hours from now, as "YYYY-MM-DD HH:MM".
// No appointment can start before this.
export function cutoffCentral(hours = 24) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + hours * 3600 * 1000)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export const isPastCutoff = (date, time) => `${date} ${time}` >= cutoffCentral();

export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function isBookableDay(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.toISOString().slice(0, 10) !== ymd) return false;
  if (t.getUTCDay() === 0) return false; // closed Sundays
  const today = todayCentral();
  return ymd > today && ymd <= addDays(today, DAYS_AHEAD);
}

export const slotKey = (date, time) => `slot/${date}/${time.replace(":", "")}`;
