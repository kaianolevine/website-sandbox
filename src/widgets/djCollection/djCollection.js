import { escapeHtml, escapeAttr, normalizeForSearch } from "../../core/strings.js";

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
