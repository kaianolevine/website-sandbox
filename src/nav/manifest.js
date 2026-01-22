export async function loadManifest() {
  const res = await fetch("pages/pages.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load pages/pages.json (HTTP ${res.status})`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("pages/pages.json must be an array");
  return json;
}

export function ensureSpecialPages(manifest) {
  const out = Array.isArray(manifest) ? [...manifest] : [];
  if (!out.some((p) => p?.id === "home")) {
    out.unshift({ id: "home", title: "Home", kind: "home" });
  }
  return out;
}
