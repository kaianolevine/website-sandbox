function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function encodeRoute(id) {
  // keep slashes readable by encoding each segment
  return id.split("/").map(encodeURIComponent).join("/");
}

function decodeRoute(hash) {
  // supports nested routes like #/Booking/overview
  const raw = (hash || "").startsWith("#/") ? hash.slice(2) : "";
  const cleaned = raw.trim();
  if (!cleaned) return "home";
  return decodeURIComponent(cleaned);
}

function safePagePathFromId(id) {
  // Basic guard against weird paths
  if (!id || id.includes("..") || id.startsWith("/")) return null;
  return `/pages/${id}.md`;
}

function titleCaseFromFolder(folder) {
  return String(folder || "")
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function loadManifest() {
  const res = await fetch("/pages/pages.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load /pages/pages.json (HTTP ${res.status})`);
  const manifest = await res.json();
  if (!Array.isArray(manifest)) throw new Error("pages.json must be an array");
  return manifest;
}

function groupPages(manifest) {
  const home = manifest.find(p => p.id === "home") || { id: "home", title: "Home", kind: "home" };

  const rootPages = [];
  const groups = new Map(); // folder -> pages[]

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

  // sort nicely
  rootPages.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
  for (const [folder, arr] of groups.entries()) {
    arr.sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
    groups.set(folder, arr);
  }

  return { home, rootPages, groups };
}

function renderNav({ home, rootPages, groups }) {
  const nav = document.getElementById("nav");

  const link = (p) =>
    `<a href="#/${encodeRoute(p.id)}" data-page-id="${escapeHtml(p.id)}">${escapeHtml(p.title || p.id)}</a>`;

  const homeLink = `<a href="#/${encodeRoute(home.id)}" data-page-id="${escapeHtml(home.id)}">${escapeHtml(home.title || "Home")}</a>`;
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
  document.querySelectorAll("#nav a[data-page-id]").forEach((a) => {
    const active = a.getAttribute("data-page-id") === routeId;
    a.classList.toggle("active", active);
  });

  // open dropdown if active route lives inside it
  document.querySelectorAll("details.nav-group").forEach((d) => {
    const folder = d.getAttribute("data-folder");
    const shouldOpen = routeId.startsWith(folder + "/");
    d.open = shouldOpen || d.open; // keep user-opened state
  });
}

function renderMarkdownHtml(title, html) {
  const page = document.getElementById("page");
  page.innerHTML = `
    <h2 style="margin: 0;">${escapeHtml(title)}</h2>
    <div style="margin-top: 12px; line-height: 1.55;">${html}</div>
  `;
}

async function renderMarkdownPage(pageDef) {
  const title = pageDef.title || pageDef.id;
  const path = pageDef.path || safePagePathFromId(pageDef.id);

  if (!path) {
    renderMarkdownHtml(title, `<p style="color:#b00020;">Invalid page id.</p>`);
    return;
  }

  const page = document.getElementById("page");
  page.innerHTML = `<h2 style="margin:0;">${escapeHtml(title)}</h2><p style="color:#666;margin-top:10px;">Loading…</p>`;

  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();

    const rawHtml = window.marked.parse(md);
    const safeHtml = window.DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });

    renderMarkdownHtml(title, safeHtml);
  } catch (err) {
    renderMarkdownHtml(title, `<p style="color:#b00020;">Failed to load ${escapeHtml(path)}: ${escapeHtml(err?.message || err)}</p>`);
  }
}

/**
 * Your existing JSON-powered “Home” view (kept intact but isolated).
 * If you want, we can move this into /pages/home.md later to remove this entirely.
 */
function normalizeForSearch(str) {
  return String(str || "").toLowerCase();
}

function renderCollection(data, query) {
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
          return `<li>${date}<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>${title}</li>`;
        })
        .join("");

      const lower = String(folderName).toLowerCase();
      const isSummary = lower === "summary";
      const isFirstYear = firstYearFolderName && folderName === firstYearFolderName;
      const openAttr = isSummary || isFirstYear ? " open" : "";

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

  return {
    html: folderHtml || "<p>No matching items.</p>",
    totalMatched,
    queryActive: Boolean(q),
  };
}

async function renderHomePage() {
  const page = document.getElementById("page");

  page.innerHTML = `
    <p>
      Data source:
      <a href="/site_data/deejay_set_collection.json" target="_blank" rel="noopener">deejay_set_collection.json</a>
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
    const res = await fetch("/site_data/deejay_set_collection.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    meta.innerHTML = `<p style="color: #b00020;">Failed to load JSON: ${escapeHtml(err?.message || err)}</p>`;
    status.textContent = "";
    return;
  }

  const generatedAt = data?.generated_at ? escapeHtml(data.generated_at) : "(unknown)";
  meta.innerHTML = `<div><strong>Generated:</strong> <span style="font-family: monospace;">${generatedAt}</span></div>`;

  const rerender = () => {
    const { html, totalMatched, queryActive } = renderCollection(data, search.value);
    content.innerHTML = html;
    status.textContent = queryActive ? `${totalMatched} matching item(s)` : `${totalMatched} total item(s)`;
  };

  search.addEventListener("input", rerender);
  rerender();
}

async function route(manifest) {
  const routeId = decodeRoute(location.hash);
  setActiveNav(routeId);

  const pageDef = manifest.find(p => p.id === routeId) || manifest.find(p => p.id === "home") || { id: "home", title: "Home", kind: "home" };

  if (pageDef.kind === "home") {
    await renderHomePage();
    return;
  }

  await renderMarkdownPage(pageDef);
}

async function main() {
  let manifest;
  try {
    manifest = await loadManifest();
  } catch (err) {
    document.getElementById("page").innerHTML =
      `<p style="color:#b00020;">${escapeHtml(err?.message || err)}</p>`;
    return;
  }

  renderNav(groupPages(manifest));

  window.addEventListener("hashchange", () => route(manifest));
  route(manifest);
}

main();