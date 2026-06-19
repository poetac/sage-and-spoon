import { describe, it, expect, afterEach } from "vitest";
import { shouldShowA2HS, A2HS_DISMISS_KEY } from "./pwa.js";
import { store } from "./storage.js";

const iosUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
const iosNav = { userAgent: iosUA, platform: "iPhone", maxTouchPoints: 5, standalone: false };
const win = { matchMedia: () => ({ matches: false }) };

afterEach(() => store.set(A2HS_DISMISS_KEY, false));

describe("shouldShowA2HS", () => {
  it("shows on iOS Safari that isn't installed", () => {
    expect(shouldShowA2HS(iosNav, win)).toBe(true);
  });

  it("detects iPadOS reporting itself as a Mac", () => {
    const ipad = { userAgent: "Mozilla/5.0 (Macintosh; ...) Version/16 Safari/605", platform: "MacIntel", maxTouchPoints: 5, standalone: false };
    expect(shouldShowA2HS(ipad, win)).toBe(true);
  });

  it("hides when already running standalone", () => {
    expect(shouldShowA2HS({ ...iosNav, standalone: true }, win)).toBe(false);
    expect(shouldShowA2HS(iosNav, { matchMedia: () => ({ matches: true }) })).toBe(false);
  });

  it("hides on Chrome for iOS (only Safari can install)", () => {
    const crios = { ...iosNav, userAgent: iosUA.replace("Version/16.0", "CriOS/120.0") };
    expect(shouldShowA2HS(crios, win)).toBe(false);
  });

  it("hides on non-iOS browsers", () => {
    const desktop = { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/120 Safari/537", platform: "Win32", maxTouchPoints: 0 };
    expect(shouldShowA2HS(desktop, win)).toBe(false);
  });

  it("stays hidden once dismissed", () => {
    store.set(A2HS_DISMISS_KEY, true);
    expect(shouldShowA2HS(iosNav, win)).toBe(false);
  });
});
