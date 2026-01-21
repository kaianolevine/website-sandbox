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
  return String(id || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
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
  const s = String(id || "");
  if (!s || s.includes("..") || s.startsWith("/")) return null;
  // relative path so it works under subpaths too
  return `pages/${s}.md`;
}
function titleCaseFromFolder(folder) {
  return String(folder || "")
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
async function loadManifest() {
  const res = await fetch("pages/pages.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load pages/pages.json (HTTP ${res.status})`);
  const manifest = await res.json();
  if (!Array.isArray(manifest)) throw new Error("pages/pages.json must be an array");
  return manifest;
}
function groupPages(manifest) {
  const home = manifest.find((p) => p.id === "home") || { id: "home", title: "Home", kind: "home" };

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
    <div id="page-content" style="margin-top: 12px; line-height: 1.55;">${html}</div>
  `;
}

function normalizeForSearch(str) {
  return String(str || "").toLowerCase();
}

function escapeAttr(str) {
  // For inserting into HTML attributes safely
  return escapeHtml(str).replaceAll("`", "&#96;");
}

async function renderDjSetSummaryInto(container, djName) {
  if (!container) return;

  const name = String(djName || "").trim();
  if (!name) {
    container.innerHTML = `<p style="color:#b00020;">Missing DJ name for summary.</p>`;
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

  // Filter items where title/label contains the DJ name (case-insensitive)
  const q = normalizeForSearch(name);

  function normalizeToken(s) {
    return normalizeForSearch(s).replace(/[^a-z0-9]+/g, "");
  }

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
    container.innerHTML = `<p>No sets found matching <strong>${escapeHtml(name)}</strong>.</p>`;
    return;
  }

  // Group by folder name (e.g., year folders)
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

  // Sort items inside each folder by date desc when possible, otherwise by label/title
  function itemSortKey(it) {
    // date is expected like YYYY-MM-DD
    const date = String(it?.date || "");
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
    const label = String(it?.label || it?.title || "");
    return { dateKey, label: normalizeForSearch(label) };
  }

  for (const f of folders) {
    const arr = byFolder.get(f) || [];
    arr.sort((a, b) => {
      const ka = itemSortKey(a);
      const kb = itemSortKey(b);
      // date desc if both present
      if (ka.dateKey && kb.dateKey && ka.dateKey !== kb.dateKey) return kb.dateKey.localeCompare(ka.dateKey);
      // fall back to label
      return ka.label.localeCompare(kb.label);
    });
    byFolder.set(f, arr);
  }

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

      // Use details for collapsible sections; open Summary by default
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

  // Default DJ name = first path segment of the page id, e.g. "DJ Marvel/sets" -> "DJ Marvel"
  const id = String(pageDef?.id || "");
  const defaultDj = id.includes("/") ? id.split("/")[0] : "";

  const attr = container.getAttribute("data-dj-set-summary") || "";
  const djName = String(attr).trim() || defaultDj;

  await renderDjSetSummaryInto(container, djName);
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
    const safeHtml = window.DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      // Ensure our embedding marker survives sanitization
      ADD_ATTR: ["data-dj-set-summary"],
    });

    renderMarkdownHtml(title, safeHtml);
    await hydrateDjSetSummary(pageDef);
  } catch (err) {
    renderMarkdownHtml(
      title,
      `<p style="color:#b00020;">Failed to load ${escapeHtml(path)}: ${escapeHtml(err?.message || err)}</p>`,
    );
  }
}

/**
 * Home page is intentionally empty, but nav still renders.
 */
async function renderHomePage() {
  const page = document.getElementById("page");
  page.innerHTML = "";
}

async function route(manifest) {
  const routeId = decodeRoute(location.hash);
  setActiveNav(routeId);

  const pageDef =
    manifest.find((p) => p.id === routeId) ||
    manifest.find((p) => p.id === "home") ||
    { id: "home", title: "Home", kind: "home" };

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
    const nav = document.getElementById("nav");
    if (nav) nav.innerHTML = "";
    document.getElementById("page").innerHTML = `<p style="color:#b00020;">${escapeHtml(err?.message || err)}</p>`;
    return;
  }

  renderNav(groupPages(manifest));

  window.addEventListener("hashchange", () => route(manifest));
  route(manifest);
}

main();