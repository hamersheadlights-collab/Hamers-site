import { store, json, todayCentral, cutoffCentral, addDays, DAYS_AHEAD } from "../lib/shared.mjs";

// Returns which times are taken. No customer details are ever sent here.
export default async () => {
  try {
    const { blobs } = await store().list({ prefix: "slot/" });
    const from = todayCentral(), to = addDays(from, DAYS_AHEAD);
    const taken = [];
    for (const b of blobs) {
      const [, date, hhmm] = b.key.split("/");
      if (date > from && date <= to) taken.push(`${date}_${hhmm}`);
    }
    return json({ today: from, cutoff: cutoffCentral(), taken });
  } catch (e) {
    return json({ error: "unavailable" }, 503);
  }
};

export const config = { path: "/api/availability" };
