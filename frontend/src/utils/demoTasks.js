// ⚠️ PLACEHOLDER DATA — NOT REAL.
//
// There is no task feature in this app: no tasks table, no API, no way to
// assign or complete anything. These numbers are generated from the user's id
// purely so the "who's present now" widget can show the intended layout.
//
// To make this real: add a `tasks` table (user_id, title, date, status),
// expose CRUD + a per-day summary endpoint, then delete this file and read
// the counts from the API instead. Anything rendered from here should stay
// visibly marked as demo data so nobody mistakes it for a real figure.

const hash = (value) => {
  let h = 0;
  for (const ch of String(value)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

// Deterministic per user, so the numbers don't jump around between renders.
export const demoTaskCounts = (userId) => {
  const h = hash(userId);
  const total = 3 + (h % 4); // 3–6 assigned
  const done = h % (total + 1); // 0–total completed
  return { done, total };
};

export const DEMO_TASKS = true;
