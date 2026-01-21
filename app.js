/* =========================
   Utilities
========================= */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll("`", "&#96;");
}

function normalizeForSearch(str) {
  return String(str || "").toLowerCase();
}

function normalizeToken(str) {
  return normalizeForSearch(str).replace(/[^a-z0-9]+/g, "");
}

/* =========================
   Routing helpers
========================= */

function encodeRoute(id) {
  return String(id || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function decodeRoute(hash) {
  const raw = (hash || "").startsWith("#/") ? hash.slice(2) : "";
  const cleaned = raw.trim();
  return cleaned || "home";
}

function safePagePathFromId(id) {
  const s = String(id || "");
  if (!s || s.includes("..") || s.startsWith("/")) return null;
  return `pages/${s}.md`;
}

function titleCaseFromFolder(folder) {
  return String(folder || "")
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* =========================
   Manifest + Nav
========================= */

async function loadManifest() {
  const res = await fetch("pages/pages.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load pages/pages.json (HTTP ${res.status})`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("pages/pages.json must be an array");
  return json;
}

function ensureSpecialPages(manifest) {
  const out = Array.isArray(manifest) ? [...manifest] : [];

  if (!out.some((p) => p?.id === "home")) {
    out.unshift({ id: "home", title: "Home", kind: "home" });
  }

  // Ensure DJ collection exists for navigation
  if (!out.some((p) => p?.id === "dj/collection")) {
    const idxHome = out.findIndex((p) => p?.id === "home");
    const insertAt = idxHome >= 0 ? idxHome + 1 : 0;
    out.splice(insertAt, 0, { id: "dj/collection", title: "Collection", kind: "dj" });
  } else {
    // normalize kind
    out.forEach((p) => {
      if (p?.id === "dj/collection" && !p.kind) p.kind = "dj";
    });
  }

  return out;
}

function groupPages(manifest) {
  const home = manifest.find((p) => p.id === "home") || { id: "home", title: "Home", kind: "home" };

  const rootPages = [];
  const groups = new Map();

  for (const p of manifest) {
    if (!p?.id || p.id === "home") continue;

    const parts = String(p.id).split("/");
    if (parts.length === 1) {
      rootPages.push(p);
    } else {
      const folder = parts[0];
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(p);
    }
  }

  rootPages.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
  for (const [folder, arr] of groups.entries()) {
    arr.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
    groups.set(folder, arr);
  }

  return { home, rootPages, groups };
}

function renderNav({ home, rootPages, groups }) {
  const nav = document.getElementById("nav");
  if (!nav) return;

  const link = (p) =>
    `<a href="#/${encodeRoute(p.id)}" data-page-id="${escapeHtml(p.id)}">${escapeHtml(p.title || p.id)}</a>`;

  const homeLink = link(home);
  const rootLinks = rootPages.map(link).join("");

  const groupBlocks = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, pages]) => {
      const label = titleCaseFromFolder(folder);
      const items = pages.map(link).join("");
      return `
        <details class="nav-group" data-folder="${escapeHtml(folder)}">
          <summary>${escapeHtml(label)}</summary>
          <div class="nav-group-items">${items}</div>
        </details>
      `;
    })
    .join("");

  nav.innerHTML = homeLink + rootLinks + groupBlocks;
}

function setActiveNav(routeId) {
  document.querySelectorAll('#nav a[data-page-id]').forEach((a) => {
    a.classList.toggle("active", a.getAttribute("data-page-id") === routeId);
  });

  document.querySelectorAll("details.nav-group").forEach((d) => {
    const folder = d.getAttribute("data-folder") || "";
    d.open = routeId.startsWith(folder + "/") || d.open;
  });
}

/* =========================
   Render helpers
========================= */

function renderPageHtml(title, html) {
  const page = document.getElementById("page");
  if (!page) return;
  page.innerHTML = `
    <h2 style="margin: 0;">${escapeHtml(title)}</h2>
    <div id="page-content" style="margin-top: 12px; line-height: 1.55;">${html}</div>
  `;
}

/* =========================
   Home (empty)
========================= */

async function renderHomePage() {
  const page = document.getElementById("page");
  if (!page) return;
  page.innerHTML = "";
}

/* =========================
   DJ Collection (JSON-powered)
========================= */

function renderDjCollection(data, query) {
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

async function renderDjCollectionPage() {
  const page = document.getElementById("page");
  if (!page) return;

  page.innerHTML = `
    <p>
      Data source:
      <a href="site_data/deejay_set_collection.json" target="_blank" rel="noopener">deejay_set_collection.json</a>
    </p>

    <label for="search">Search:</label>
    <input id="search" type="search" placeholder="Type to filter…" style="min-width: 280px;" />
    <div id="status" style="margin-top: 8px; color: #666;"></div>

    <div id="meta" style="margin-top: 12px;"></div>
    <div id="content" style="margin-top: 16px;"></div>
  `;

  const meta = document.getElementById("meta");
  const search = document.getElementById("search");
  const status = document.getElementById("status");
  const content = document.getElementById("content");

  meta.textContent = "Loading…";

  let data;
  try {
    const res = await fetch("site_data/deejay_set_collection.json", { cache: "no-store" });
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

/* =========================
   Markdown pages + DJ summary widget
========================= */

function renderMarkdownHtml(title, html) {
  renderPageHtml(title, html);
}

async function renderMarkdownPage(pageDef) {
  const title = pageDef.title || pageDef.id;
  const path = pageDef.path || safePagePathFromId(pageDef.id);

  if (!path) {
    renderPageHtml(title, `<p style="color:#b00020;">Invalid page id.</p>`);
    return;
  }

  // IMPORTANT: encode spaces in URLs (folders/files with spaces)
  const fetchPath = encodeURI(path);

  const page = document.getElementById("page");
  if (page) page.innerHTML = `<h2 style="margin:0;">${escapeHtml(title)}</h2><p style="color:#666;margin-top:10px;">Loading…</p>`;

  try {
    const res = await fetch(fetchPath, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();

    const rawHtml = window.marked.parse(md);
    const safeHtml = window.DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["data-dj-set-summary", "data-dj-set-summary-query"],
    });

    renderMarkdownHtml(title, safeHtml);
    await hydrateDjSetSummary(pageDef);
  } catch (err) {
    renderPageHtml(title, `<p style="color:#b00020;">Failed to load ${escapeHtml(fetchPath)}: ${escapeHtml(err?.message || err)}</p>`);
  }
}

async function renderDjSetSummaryInto(container, query) {
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

  // Sort folders: Summary first, then years desc, then alpha
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

async function hydrateDjSetSummary(pageDef) {
  const container = document.querySelector("[data-dj-set-summary]");
  if (!container) return;

  const id = String(pageDef?.id || "");
  const defaultDj = id.includes("/") ? id.split("/")[0] : "";

  const queryAttr = container.getAttribute("data-dj-set-summary-query") || "";
  const query = String(queryAttr).trim() || defaultDj;

  await renderDjSetSummaryInto(container, query);
}

/* =========================
   Router + App entry
========================= */

async function route(manifest) {
  const routeId = decodeRoute(location.hash);
  setActiveNav(routeId);

  const pageDef =
    manifest.find((p) => p.id === routeId) ||
    manifest.find((p) => p.id === "home") ||
    { id: "home", title: "Home", kind: "home" };

  if (pageDef.id === "home" || pageDef.kind === "home") {
    await renderHomePage();
    return;
  }

  if (pageDef.kind === "dj" || pageDef.id === "dj/collection") {
    await renderDjCollectionPage();
    return;
  }

  await renderMarkdownPage(pageDef);
}

async function main() {
  let manifest;
  try {
    manifest = ensureSpecialPages(await loadManifest());
  } catch (err) {
    const nav = document.getElementById("nav");
    if (nav) nav.innerHTML = "";
    renderPageHtml("Error", `<p style="color:#b00020;">${escapeHtml(err?.message || err)}</p>`);
    return;
  }

  renderNav(groupPages(manifest));
  window.addEventListener("hashchange", () => route(manifest));
  route(manifest);
}

main();
