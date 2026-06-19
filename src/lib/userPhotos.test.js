import { describe, it, expect } from "vitest";
import { loadAllUserPhotos, saveUserPhotos, clearAllUserPhotos } from "./userPhotos.js";

// jsdom ships no IndexedDB, so the helpers degrade to safe no-ops: the in-memory
// app state still holds for the session, and a missing store is not an error.
describe("userPhotos (no IndexedDB available)", () => {
  it("loads empty and treats save/clear as successful no-ops", async () => {
    expect(await loadAllUserPhotos()).toEqual({});
    expect(await saveUserPhotos("b1", ["data:image/jpeg;base64,AAAA"])).toBe(true);
    await expect(clearAllUserPhotos()).resolves.toBeUndefined();
  });
});
