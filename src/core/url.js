export function encodeRoute(id) {
  return String(id || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

export function decodeRoute(hash) {
  const raw = (hash || "").startsWith("#/") ? hash.slice(2) : "";
  const cleaned = raw.trim();
  // Preserve current behavior from your file: if empty, go home.
  // NOTE: This does NOT decode percent-encoding. If you want spaces in ids to work reliably,
  // we can change this to decodeURIComponent(cleaned).
  return cleaned || "home";
}

export function safePagePathFromId(id) {
  const s = String(id || "");
  if (!s || s.includes("..") || s.startsWith("/")) return null;
  return `pages/${s}.md`;
}
