import { getStore } from "@netlify/blobs";

export const TIMES = ["09:00", "11:00", "13:00", "15:00"];
export const SERVICES = {
  one: { label: "One headlight", price: 35 },
  both: { label: "Both headlights", price: 50 },
  semi: { label: "Semi or big truck headlights (set)", price: 75 },
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
