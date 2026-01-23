import { escapeHtml } from "../../core/strings.js";
import { renderDjCollection } from "./djCollection.js";

export async function renderDjCollectionInto(container) {
  if (!container) return;

  container.innerHTML = `
    <p>
      Data source:
      <a href="public/v1/deejay_set_collection.json" target="_blank" rel="noopener">deejay_set_collection.json</a>
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
    const res = await fetch("public/v1/deejay_set_collection.json", { cache: "no-store" });
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
