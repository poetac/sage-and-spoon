import { describe, it, expect, vi, afterEach } from "vitest";
import { copyText } from "./clipboard.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.execCommand; // jsdom doesn't define it; remove any test stub
});

describe("copyText", () => {
  it("uses the async Clipboard API when available and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("hello")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when the Clipboard API rejects", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    document.execCommand = vi.fn().mockReturnValue(true); // jsdom has no execCommand
    expect(await copyText("hi")).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns false when both paths fail", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    document.execCommand = vi.fn().mockReturnValue(false);
    expect(await copyText("nope")).toBe(false);
  });
});
