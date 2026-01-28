import { escapeHtml, escapeAttr, normalizeForSearch } from "./strings.js";

function renderRecentHistory(entries, query) {
  const q = normalizeForSearch(query);
  const filtered = (entries || []).filter((e) => {
    if (!q) return true;
    const hay = [e?.dt, e?.title, e?.artist]
      .filter(Boolean)
      .map(normalizeForSearch)
      .join(" | ");
    return hay.includes(q);
  });

  const rows = filtered
    .map((e) => {
      const dt = escapeHtml(e?.dt || "");
      const title = escapeHtml(e?.title || "");
      const artist = escapeHtml(e?.artist || "");
      return `<tr>
        <td style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${dt}</td>
        <td>${title}</td>
        <td>${artist}</td>
      </tr>`;
    })
    .join("");

  return {
    html:
      rows ||
      `<tr><td colspan="3" style="color:#666;">No matching entries.</td></tr>`,
    count: filtered.length,
    queryActive: Boolean(q),
  };
}

export async function renderRecentHistoryInto(container) {
  if (!container) return;

  container.innerHTML = `
    <p>
      Data source:
      <a href="/v1/live-history/recent_history.json" target="_blank" rel="noopener">recent_history.json</a>
    </p>

    <label>Search:</label>
    <input data-live-history-search type="search" placeholder="Type to filter…" style="min-width: 280px;" />
    <div data-live-history-status style="margin-top: 8px; color: #666;"></div>

    <div data-live-history-meta style="margin-top: 12px;"></div>

    <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
      <thead>
        <tr>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding: 6px 4px;">Time</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding: 6px 4px;">Title</th>
          <th style="text-align:left; border-bottom:1px solid #ddd; padding: 6px 4px;">Artist</th>
        </tr>
      </thead>
      <tbody data-live-history-body></tbody>
    </table>
  `;

  const search = container.querySelector("[data-live-history-search]");
  const status = container.querySelector("[data-live-history-status]");
  const meta = container.querySelector("[data-live-history-meta]");
  const body = container.querySelector("[data-live-history-body]");
  if (!search || !status || !meta || !body) return;

  meta.textContent = "Loading…";

  let data;
  try {
    const res = await fetch("/v1/live-history/recent_history.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    meta.innerHTML = `<p style="color:#b00020;">Failed to load JSON: ${escapeHtml(err?.message || String(err))}</p>`;
    status.textContent = "";
    return;
  }

  const generatedAt = data?.generated_at ? escapeHtml(data.generated_at) : "(unknown)";
  meta.innerHTML = `<div><strong>Generated:</strong> <span style="font-family: monospace;">${generatedAt}</span></div>`;

  const entries = Array.isArray(data?.entries) ? data.entries : [];

  const rerender = () => {
    const { html, count, queryActive } = renderRecentHistory(entries, search.value);
    body.innerHTML = html;
    status.textContent = queryActive ? `${count} matching entr(y/ies)` : `${count} total entr(y/ies)`;
  };

  search.addEventListener("input", rerender);
  rerender();
}