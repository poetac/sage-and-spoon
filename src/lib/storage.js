/* -------------------------------- storage ------------------------------- */
// localStorage with an in-memory fallback (e.g. sandboxed previews).
//
// Two failure modes look the same to `set` but aren't: a *missing* store
// (sandboxed iframe — localStorage absent, expected, silent) versus a *quota
// overflow* (writes had been persisting and now can't, so changes silently stop
// surviving reloads). The latter is worth a heads-up — same class of data loss
// as the user-photo quota path — so a single listener (onStorageFull) is fired
// only on a genuine quota error, and `set` reports whether the write persisted.
const mem = {};
let onFull = null;
// True only for a real quota overflow, across browsers — not for an absent
// localStorage (which throws a ReferenceError/SecurityError instead).
const isQuotaError = (e) =>
  typeof DOMException !== "undefined" && e instanceof DOMException &&
  (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22);
// Register the (single) storage-full handler; pass null to clear it.
export const onStorageFull = (cb) => { onFull = cb; };
export const store = {
  get(key, fallback) {
    try { const v = window.localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return key in mem ? mem[key] : fallback; }
  },
  // Returns true when the value reached localStorage, false when it only made it
  // to the in-memory fallback (so callers can warn on a quota loss).
  set(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) {
      mem[key] = value;
      if (isQuotaError(e) && onFull) onFull();
      return false;
    }
  },
  clear(keys) {
    keys.forEach((k) => { try { window.localStorage.removeItem(k); } catch { /* in-memory only */ } delete mem[k]; });
  },
};
export const K = { prefs: "ss_prefs", plan: "ss_plan", custom: "ss_custom_meals", settings: "ss_settings", favorites: "ss_favorites", pantry: "ss_pantry", history: "ss_history", notes: "ss_notes", hidden: "ss_hidden", shoppingEdits: "ss_shopping_edits", glucose: "ss_glucose" };
