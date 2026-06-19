// Content-Security-Policy for the *built* app. Injected at build time by
// vite.config (see the inject-csp plugin) so the dev server's HMR — which needs
// inline/eval scripts — keeps working while production stays locked down.
//
// The load-bearing directive is connect-src: the app holds a user API key in
// localStorage, so restricting outbound connections to our own origin + the
// Anthropic API is the real defense-in-depth (a compromised dependency can't
// exfiltrate the key elsewhere). Styles need 'unsafe-inline' because the UI uses
// inline style attributes throughout; recipe photos come from many CC-licensed
// hosts, so img-src allows https: (plus data:/blob: for cook-supplied photos).
export const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "connect-src": ["'self'", "https://api.anthropic.com"],
  "manifest-src": ["'self'"],
  "worker-src": ["'self'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
};

export const cspString = () =>
  Object.entries(CSP_DIRECTIVES).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
