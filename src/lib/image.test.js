import { describe, it, expect } from "vitest";
import { fileToResizedDataUrl } from "./image.js";

// The happy path needs a real canvas encoder (browser-only), so here we just
// pin the input guard. The resize/encode is exercised manually in the app.
describe("fileToResizedDataUrl", () => {
  it("rejects a non-image file", async () => {
    const file = new File(["plain text"], "notes.txt", { type: "text/plain" });
    await expect(fileToResizedDataUrl(file)).rejects.toThrow(/not an image/);
  });

  it("rejects a missing file", async () => {
    await expect(fileToResizedDataUrl(null)).rejects.toThrow(/not an image/);
  });
});
