import { escapeHtml } from "./strings.js";

export function renderDjCollection(data, query) {
  const q = normalizeForSearch(query);
  const foldersRaw = Array.isArray(data?.folders) ? data.folders : [];

  function folderSortKey(name) {
    const n = String(name || "");
    const lower = n.toLowerCase();
    if (lower === "summary") return { group: 0, year: -1, label: lower };
    const yearMatch = lower.match(/^\d{4}$/);
    if (yearMatch) return { group: 1, year: Number(lower), label: lower };
    return { group: 2, year: -1, label: lower };
  }

  const folders = [...foldersRaw].sort((a, b) => {
    const ka = folderSortKey(a?.name);
    const kb = folderSortKey(b?.name);
    if (ka.group !== kb.group) return ka.group - kb.group;
    if (ka.group === 1 && kb.group === 1) return kb.year - ka.year;
    return ka.label.localeCompare(kb.label);
  });

  const firstYearFolderName = folders.find((f) => String(f?.name || "").match(/^\d{4}$/))?.name;

  let totalMatched = 0;

  const folderHtml = folders
    .map((folder) => {
      const folderName = folder?.name || "(Unnamed folder)";
      const items = Array.isArray(folder?.items) ? folder.items : [];

      const filtered = items.filter((it) => {
        if (!q) return true;
        const haystack = [it?.date, it?.title, it?.label, it?.url, folderName]
          .filter(Boolean)
          .map(normalizeForSearch)
          .join(" | ");
        return haystack.includes(q);
      });

      if (q && filtered.length === 0) return "";

      totalMatched += filtered.length;

      const list = filtered
        .map((it) => {
          const label = it?.label || it?.title || "(untitled)";
          const url = it?.url || "#";
          const date = it?.date ? `<span style="font-family: monospace;">${escapeHtml(it.date)}</span> — ` : "";
          const title = it?.title && it?.title !== label ? ` <span>(${escapeHtml(it.title)})</span>` : "";
          return `<li>${date}<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>${title}</li>`;
        })
        .join("");

      const lower = String(folderName).toLowerCase();
      const openAttr = lower === "summary" || (firstYearFolderName && folderName === firstYearFolderName) ? " open" : "";

      return `
        <section style="margin-top: 18px;">
          <details${openAttr}>
            <summary style="cursor: pointer; user-select: none;">
              <span style="font-weight: 700;">${escapeHtml(folderName)}</span>
              <span style="color: #666; margin-left: 8px;">(${filtered.length})</span>
            </summary>
            <ul style="margin-top: 10px;">${list}</ul>
          </details>
        </section>
      `;
    })
    .join("");

  return { html: folderHtml || "<p>No matching items.</p>", totalMatched, queryActive: Boolean(q) };
}

export async function renderDjCollectionInto(container) {
  if (!container) return;

  container.innerHTML = `
    <p>
      Data source:
      <a href="/v1/deejay-sets/deejay_set_collection.json" target="_blank" rel="noopener">deejay_set_collection.json</a>
    </p>

    <label>Search:</label>
    <input data-dj-collection-search type="search" placeholder="Type to filter…" style="min-width: 280px;" />
    <div data-dj-collection-status style="margin-top: 8px; color: #666;"></div>

    <div data-dj-collection-meta style="margin-top: 12px;"></div>
    <div data-dj-collection-content style="margin-top: 16px;"></div>
  `;

  const meta = container.querySelector("[data-dj-collection-meta]");
  const search = container.querySelector("[data-dj-collection-search]");
  const status = container.querySelector("[data-dj-collection-status]");
  const content = container.querySelector("[data-dj-collection-content]");

  if (!meta || !search || !status || !content) return;

  meta.textContent = "Loading…";

  let data;
  try {
    const res = await fetch("/v1/deejay-sets/deejay_set_collection.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    meta.innerHTML = `<p style="color:#b00020;">Failed to load JSON: ${escapeHtml(err?.message || err)}</p>`;
    status.textContent = "";
    return;
  }

  const generatedAt = data?.generated_at ? escapeHtml(data.generated_at) : "(unknown)";
  meta.innerHTML = `<div><strong>Generated:</strong> <span style="font-family: monospace;">${generatedAt}</span></div>`;

  const rerender = () => {
    const { html, totalMatched, queryActive } = renderDjCollection(data, search.value);
    content.innerHTML = html;
    status.textContent = queryActive ? `${totalMatched} matching item(s)` : `${totalMatched} total item(s)`;
  };

  search.addEventListener("input", rerender);
  rerender();
}
