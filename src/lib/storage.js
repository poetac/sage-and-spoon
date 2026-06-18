/* -------------------------------- storage ------------------------------- */
// localStorage with an in-memory fallback (e.g. sandboxed previews).
const mem = {};
export const store = {
  get(key, fallback) {
    try { const v = window.localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return key in mem ? mem[key] : fallback; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); }
    catch { mem[key] = value; }
  },
  clear(keys) {
    keys.forEach((k) => { try { window.localStorage.removeItem(k); } catch { /* in-memory only */ } delete mem[k]; });
  },
};
export const K = { prefs: "ss_prefs", plan: "ss_plan", custom: "ss_custom_meals", settings: "ss_settings", favorites: "ss_favorites", pantry: "ss_pantry", history: "ss_history", notes: "ss_notes", hidden: "ss_hidden" };
