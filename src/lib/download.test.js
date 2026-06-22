import { describe, it, expect, vi, afterEach } from "vitest";
import { downloadFile } from "./download.js";

afterEach(() => vi.restoreAllMocks());

describe("downloadFile", () => {
  it("creates a named blob link, clicks it, and revokes the object URL", async () => {
    let capturedBlob;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (blob) => { capturedBlob = blob; return "blob:mock"; };
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      downloadFile('{"a":1}', "data.json", "application/json");
      expect(click).toHaveBeenCalledTimes(1);
      expect(capturedBlob.type).toBe("application/json");
      expect(await capturedBlob.text()).toBe('{"a":1}');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
      // No stray anchor left in the DOM.
      expect(document.querySelector("a[download]")).toBeNull();
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });

  it("defaults to text/plain", async () => {
    let capturedBlob;
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (blob) => { capturedBlob = blob; return "blob:mock"; };
    URL.revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      downloadFile("plain", "x.txt");
      expect(capturedBlob.type).toBe("text/plain");
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
