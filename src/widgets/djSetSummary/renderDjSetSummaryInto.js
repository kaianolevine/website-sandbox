import { escapeHtml, escapeAttr, normalizeForSearch, normalizeToken } from "../../core/strings.js";

export async function renderDjSetSummaryInto(container, query) {
  if (!container) return;

  const name = String(query || "").trim();
  if (!name) {
    container.innerHTML = `<p style="color:#b00020;">Missing query for summary.</p>`;
    return;
  }

  container.innerHTML = `<p style="color:#666;">Loading DJ set summary…</p>`;

  let data;
  try {
    const res = await fetch("site_data/deejay_set_collection.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    container.innerHTML = `<p style="color:#b00020;">Failed to load collection JSON: ${escapeHtml(err?.message || err)}</p>`;
    return;
  }

  const foldersRaw = Array.isArray(data?.folders) ? data.folders : [];
  const q = normalizeForSearch(name);
  const qKey = normalizeToken(name);

  const matches = [];
  for (const folder of foldersRaw) {
    const folderName = folder?.name || "";
    const items = Array.isArray(folder?.items) ? folder.items : [];
    for (const it of items) {
      const hay = [it?.title, it?.label].filter(Boolean).map(normalizeForSearch).join(" | ");
      const hayKey = normalizeToken(hay);
      if (hay.includes(q) || (qKey && hayKey.includes(qKey))) {
        matches.push({ folderName, it });
      }
    }
  }

  if (matches.length === 0) {
    const samples = [];
    for (const folder of foldersRaw) {
      const items = Array.isArray(folder?.items) ? folder.items : [];
      for (const it of items) {
        const label = it?.label || it?.title;
        if (label) samples.push(label);
        if (samples.length >= 10) break;
      }
      if (samples.length >= 10) break;
    }

    const sampleHtml = samples.length
      ? `<details style="margin-top: 10px;">
           <summary style="cursor:pointer; user-select:none;">Show sample set titles</summary>
           <ul style="margin-top: 8px;">${samples.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
         </details>`
      : "";

    container.innerHTML = `
      <p>No sets found matching <strong>${escapeHtml(name)}</strong>.</p>
      <p style="color:#666; margin-top: 6px;">
        Matching is done against each item’s <code>title</code> and <code>label</code> in
        <code>site_data/deejay_set_collection.json</code>.
      </p>
      <p style="color:#666; margin-top: 6px;">
        Tip: set <code>data-dj-set-summary-query</code> on the div to match whatever text actually appears in your titles.
      </p>
      ${sampleHtml}
    `;
    return;
  }

  // Group by folder
  const byFolder = new Map();
  for (const m of matches) {
    if (!byFolder.has(m.folderName)) byFolder.set(m.folderName, []);
    byFolder.get(m.folderName).push(m.it);
  }

  function folderSortKey(folderName) {
    const lower = String(folderName || "").toLowerCase();
    if (lower === "summary") return { group: 0, year: -1, label: lower };
    const yearMatch = lower.match(/^\d{4}$/);
    if (yearMatch) return { group: 1, year: Number(lower), label: lower };
    return { group: 2, year: -1, label: lower };
  }

  const folders = Array.from(byFolder.keys()).sort((a, b) => {
    const ka = folderSortKey(a);
    const kb = folderSortKey(b);
    if (ka.group !== kb.group) return ka.group - kb.group;
    if (ka.group === 1 && kb.group === 1) return kb.year - ka.year;
    return ka.label.localeCompare(kb.label);
  });

  const sections = folders
    .map((folderName) => {
      const items = byFolder.get(folderName) || [];
      const list = items
        .map((it) => {
          const label = it?.label || it?.title || "(untitled)";
          const url = it?.url || "#";
          const date = it?.date ? `<span style="font-family: monospace;">${escapeHtml(it.date)}</span> — ` : "";
          return `<li>${date}<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a></li>`;
        })
        .join("");

      const lower = String(folderName || "").toLowerCase();
      const openAttr = lower === "summary" ? " open" : "";

      return `
        <section style="margin-top: 16px;">
          <details${openAttr}>
            <summary style="cursor: pointer; user-select: none;">
              <span style="font-weight: 700;">${escapeHtml(folderName || "(Unknown)")}</span>
              <span style="color:#666; margin-left: 8px;">(${items.length})</span>
            </summary>
            <ul style="margin-top: 10px;">${list}</ul>
          </details>
        </section>
      `;
    })
    .join("");

  container.innerHTML = `
    <div>
      <p style="margin: 0; color:#666;">
        Showing <strong>${matches.length}</strong> matching set(s) for <strong>${escapeHtml(name)}</strong>.
      </p>
      ${sections}
    </div>
  `;
}
