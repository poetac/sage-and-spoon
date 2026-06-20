import { describe, it, expect, vi } from "vitest";
import { store, K, onStorageFull } from "./storage.js";

// In node there is no `window`, so every localStorage access throws and the
// store must fall back to its in-memory map — the same path used by
// sandboxed iframes. These tests pin that fallback behavior.
describe("store (in-memory fallback)", () => {
  it("round-trips values without localStorage", () => {
    store.set("t_key", { a: 1, b: [2, 3] });
    expect(store.get("t_key", null)).toEqual({ a: 1, b: [2, 3] });
  });
  it("returns the fallback for missing keys", () => {
    expect(store.get("t_missing", "fb")).toBe("fb");
    expect(store.get("t_missing2", null)).toBeNull();
  });
  it("clears keys", () => {
    store.set("t_a", 1);
    store.set("t_b", 2);
    store.clear(["t_a", "t_b"]);
    expect(store.get("t_a", "gone")).toBe("gone");
    expect(store.get("t_b", "gone")).toBe("gone");
  });
});

describe("storage keys", () => {
  it("uses the ss_ namespace", () => {
    expect(Object.values(K).every((k) => k.startsWith("ss_"))).toBe(true);
  });
});

describe("store — quota overflow (ARCH-7)", () => {
  it("reports success when a write persists", () => {
    expect(store.set("t_ok", 1)).toBe(true);
  });

  it("reports failure and fires the storage-full listener on a quota error", () => {
    let fired = 0;
    onStorageFull(() => { fired++; });
    const spy = vi.spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    const ok = store.set("t_quota", { big: "x" });
    spy.mockRestore();
    onStorageFull(null);
    expect(ok).toBe(false);
    expect(fired).toBe(1);
  });

  it("stays silent for a non-quota write failure", () => {
    let fired = 0;
    onStorageFull(() => { fired++; });
    const spy = vi.spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => { throw new Error("nope"); });
    const ok = store.set("t_other", 1);
    spy.mockRestore();
    onStorageFull(null);
    expect(ok).toBe(false);
    expect(fired).toBe(0);
  });
});
