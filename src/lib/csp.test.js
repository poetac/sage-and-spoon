import { describe, it, expect } from "vitest";
import { CSP_DIRECTIVES, cspString } from "./csp.js";

// The CSP ships only in the built HTML (injected by vite.config). These lock the
// load-bearing directives so a future edit can't silently widen them.
describe("CSP policy (SEC-1)", () => {
  it("restricts outbound connections to self + the Anthropic API", () => {
    expect(CSP_DIRECTIVES["connect-src"]).toEqual(["'self'", "https://api.anthropic.com"]);
  });
  it("allows scripts only from same-origin (no unsafe-eval / unsafe-inline)", () => {
    expect(CSP_DIRECTIVES["script-src"]).toEqual(["'self'"]);
  });
  it("blocks plugins and locks the base URI", () => {
    expect(CSP_DIRECTIVES["object-src"]).toEqual(["'none'"]);
    expect(CSP_DIRECTIVES["base-uri"]).toEqual(["'self'"]);
  });
  it("serializes to a single-line policy without script eval/inline", () => {
    const s = cspString();
    expect(s).toContain("connect-src 'self' https://api.anthropic.com");
    expect(s).toContain("object-src 'none'");
    expect(s).not.toMatch(/script-src[^;]*unsafe-(eval|inline)/);
  });
});
