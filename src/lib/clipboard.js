// Copy text to the clipboard, falling back to a hidden textarea + execCommand
// where the async Clipboard API is unavailable (older browsers, non-secure
// contexts). Resolves true on success, false otherwise — the caller decides
// what to tell the user.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
