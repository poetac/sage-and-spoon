// Trigger a browser download of `content` as a file. Used for the shopping list
// (.txt) and the settings backup (.json) — same anchor-blob-click-revoke dance
// that was duplicated in both spots.
export function downloadFile(content, filename, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}
