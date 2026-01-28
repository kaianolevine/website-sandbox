export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttr(str) {
  // For inserting into HTML attributes safely
  return escapeHtml(str).replaceAll("`", "&#96;");
}

export function normalizeForSearch(str) {
  return String(str || "").toLowerCase();
}

export function normalizeToken(str) {
  return normalizeForSearch(str).replace(/[^a-z0-9]+/g, "");
}

export function titleCaseFromFolder(folder) {
  return String(folder || "")
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
