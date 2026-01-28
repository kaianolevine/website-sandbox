import { escapeHtml, normalizeForSearch } from "./strings.js";

function normalizeRows(headers, rows) {
  const width = (headers || []).length;
  return (rows || []).map((r) => {
    const rr = Array.isArray(r) ? [...r] : [];
    if (rr.length < width) rr.push(...Array(width - rr.length).fill(""));
    if (rr.length > width) rr.length = width;
    return rr;
  });
}

function renderDivisionTable(divisionObj, query) {
  const headers = divisionObj?.headers || [];
  const rows = normalizeRows(headers, divisionObj?.rows || []);
  const q = normalizeForSearch(query);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    return normalizeForSearch(r.join(" | ")).includes(q);
  });

  const thead = headers
    .map((h) => `<th style="text-align:left; border-bottom:1px solid #ddd; padding: 6px 4px;">${escapeHtml(h)}</th>`)
    .join("");

  const tbody =
    filtered
      .map((r) => {
        const tds = r
          .map((c) => `<td style="border-bottom:1px solid #f0f0f0; padding: 6px 4px;">${escapeHtml(c || "")}</td>`)
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("") ||
    `<tr><td colspan="${Math.max(headers.length, 1)}" style="color:#666;">No matching rows.</td></tr>`;

  return { thead, tbody, count: filtered.length, queryActive: Boolean(q) };
}

export async function renderSubmittedMusicInto(container) {
  if (!container) return;

  container.innerHTML = `
    <p>
      Data source:
      <a href="/v1/routine-music/submitted_music.json" target="_blank" rel="noopener">submitted_music.json</a>
    </p>

    <label>Division:</label>
    <select data-routine-division style="min-width: 280px;"></select>

    <span style="margin-left: 12px;">
      <label>Search:</label>
      <input data-routine-search type="search" placeholder="Type to filter…" style="min-width: 280px;" />
    </span>

    <div data-routine-status style="margin-top: 8px; color: #666;"></div>
    <div data-routine-meta style="margin-top: 12px;"></div>

    <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
      <thead><tr data-routine-thead></tr></thead>
      <tbody data-routine-tbody></tbody>
    </table>
  `;

  const sel = container.querySelector("[data-routine-division]");
  const search = container.querySelector("[data-routine-search]");
  const status = container.querySelector("[data-routine-status]");
  const meta = container.querySelector("[data-routine-meta]");
  const theadRow = container.querySelector("[data-routine-thead]");
  const tbody = container.querySelector("[data-routine-tbody]");
  if (!sel || !search || !status || !meta || !theadRow || !tbody) return;

  meta.textContent = "Loading…";

  let data;
  try {
    const res = await fetch("/v1/routine-music/submitted_music.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    meta.innerHTML = `<p style="color:#b00020;">Failed to load JSON: ${escapeHtml(err?.message || String(err))}</p>`;
    status.textContent = "";
    return;
  }

  const generatedAt = data?.generated_at ? escapeHtml(data.generated_at) : "(unknown)";
  meta.innerHTML = `<div><strong>Generated:</strong> <span style="font-family: monospace;">${generatedAt}</span></div>`;

  const divisions = Array.isArray(data?.divisions) ? data.divisions : [];
  const divisionNames = divisions.map((d) => String(d?.division || "UnknownDivision"));

  sel.innerHTML = divisionNames
    .map((name, i) => `<option value="${i}">${escapeHtml(name)}</option>`)
    .join("");

  const rerender = () => {
    const idx = Number(sel.value || 0);
    const d = divisions[idx];
    if (!d) {
      theadRow.innerHTML = "";
      tbody.innerHTML = `<tr><td style="color:#666;">No divisions found.</td></tr>`;
      status.textContent = "";
      return;
    }
    const { thead, tbody: bodyHtml, count, queryActive } = renderDivisionTable(d, search.value);
    theadRow.innerHTML = thead;
    tbody.innerHTML = bodyHtml;
    status.textContent = queryActive ? `${count} matching row(s)` : `${count} total row(s)`;
  };

  sel.addEventListener("change", rerender);
  search.addEventListener("input", rerender);
  rerender();
}