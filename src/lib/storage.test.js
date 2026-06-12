import { describe, it, expect } from "vitest";
import { store, K } from "./storage.js";

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
