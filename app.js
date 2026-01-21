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
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* =========================
   Manifest + Nav
========================= */

async function loadManifest() {
  const res = await fetch("pages/pages.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load pages/pages.json (HTTP ${res.status})`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) {
    throw new Error("pages/pages.json must be an array");
  }
  return json;
}

function groupPages(manifest) {
  const home =
    manifest.find(p => p.id === "home") ||
    { id: "home", title: "Home", kind: "home" };

  const rootPages = [];
  const groups = new Map();

  for (const p of manifest) {
    if (!p?.id || p.id === "home") continue;

    const parts = p.id.split("/");
    if (parts.length === 1) {
      rootPages.push(p);
    } else {
      const folder = parts[0];
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(p);
    }
  }

  rootPages.sort((a, b) =>
    String(a.title || a.id).localeCompare(String(b.title || b.id))
  );

  for (const [folder, arr] of groups.entries()) {
    arr.sort((a, b) =>
      String(a.title || a.id).localeCompare(String(b.title || b.id))
    );
    groups.set(folder, arr);
  }

  return { home, rootPages, groups };
}

function renderNav({ home, rootPages, groups }) {
  const nav = document.getElementById("nav");
  if (!nav) return;

  const link = p =>
    `<a href="#/${encodeRoute(p.id)}"
        data-page-id="${escapeHtml(p.id)}">
        ${escapeHtml(p.title || p.id)}
     </a>`;

  const homeLink = link(home);
  const rootLinks = rootPages.map(link).join("");

  const groupBlocks = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, pages]) => `
      <details class="nav-group" data-folder="${escapeHtml(folder)}">
        <summary>${escapeHtml(titleCaseFromFolder(folder))}</summary>
        <div class="nav-group-items">
          ${pages.map(link).join("")}
        </div>
      </details>
    `)
    .join("");

  nav.innerHTML = homeLink + rootLinks + groupBlocks;
}

function setActiveNav(routeId) {
  document.querySelectorAll("#nav a[data-page-id]").forEach(a => {
    a.classList.toggle(
      "active",
      a.getAttribute("data-page-id") === routeId
    );
  });

  document.querySelectorAll("details.nav-group").forEach(d => {
    const folder = d.getAttribute("data-folder");
    d.open = routeId.startsWith(folder + "/") || d.open;
  });
}

/* =========================
   Page rendering
========================= */

function renderMarkdownHtml(title, html) {
  const page = document.getElementById("page");
  page.innerHTML = `
    <h2 style="margin:0;">${escapeHtml(title)}</h2>
    <div id="page-content" style="margin-top:12px; line-height:1.55;">
      ${html}
    </div>
  `;
}

async function renderHomePage() {
  document.getElementById("page").innerHTML = "";
}

async function renderMarkdownPage(pageDef) {
  const title = pageDef.title || pageDef.id;
  const path = pageDef.path || safePagePathFromId(pageDef.id);

  if (!path) {
    renderMarkdownHtml(title, "<p>Invalid page.</p>");
    return;
  }

  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();

    const rawHtml = window.marked.parse(md);
    const safeHtml = window.DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ADD_ATTR: [
        "data-dj-set-summary",
        "data-dj-set-summary-query",
      ],
    });

    renderMarkdownHtml(title, safeHtml);
    await hydrateDjSetSummary(pageDef);
  } catch (err) {
    renderMarkdownHtml(
      title,
      `<p style="color:red;">Failed to load page: ${escapeHtml(err.message)}</p>`
    );
  }
}

/* =========================
   DJ Set Summary Widget
========================= */

async function renderDjSetSummaryInto(container, query) {
  container.innerHTML = `<p style="color:#666;">Loading DJ sets…</p>`;

  let data;
  try {
    const res = await fetch(
      "site_data/deejay_set_collection.json",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    container.innerHTML =
      `<p style="color:red;">Failed to load JSON</p>`;
    return;
  }

  const folders = Array.isArray(data?.folders) ? data.folders : [];
  const q = normalizeForSearch(query);
  const qKey = normalizeToken(query);

  const matches = [];

  for (const folder of folders) {
    for (const it of folder.items || []) {
      const hay = [it.title, it.label]
        .filter(Boolean)
        .map(normalizeForSearch)
        .join(" | ");

      const hayKey = normalizeToken(hay);

      if (hay.includes(q) || hayKey.includes(qKey)) {
        matches.push({ folder: folder.name, it });
      }
    }
  }

  if (!matches.length) {
    container.innerHTML = `
      <p>No sets found matching <strong>${escapeHtml(query)}</strong>.</p>
      <details>
        <summary>Show sample titles</summary>
        <ul>
          ${folders.flatMap(f =>
            (f.items || []).slice(0, 5).map(
              it => `<li>${escapeHtml(it.label || it.title || "")}</li>`
            )
          ).join("")}
        </ul>
      </details>
    `;
    return;
  }

  const byFolder = {};
  for (const m of matches) {
    byFolder[m.folder] ||= [];
    byFolder[m.folder].push(m.it);
  }

  container.innerHTML = Object.entries(byFolder)
    .map(([folder, items]) => `
      <details open>
        <summary>${escapeHtml(folder)} (${items.length})</summary>
        <ul>
          ${items.map(it => `
            <li>
              ${it.date ? `<code>${escapeHtml(it.date)}</code> — ` : ""}
              <a href="${escapeAttr(it.url)}" target="_blank">
                ${escapeHtml(it.label || it.title)}
              </a>
            </li>
          `).join("")}
        </ul>
      </details>
    `)
    .join("");
}

async function hydrateDjSetSummary(pageDef) {
  const container = document.querySelector("[data-dj-set-summary]");
  if (!container) return;

  const query =
    container.getAttribute("data-dj-set-summary-query") ||
    pageDef.id.split("/")[0];

  await renderDjSetSummaryInto(container, query);
}

/* =========================
   App entry
========================= */

async function route(manifest) {
  const routeId = decodeRoute(location.hash);
  setActiveNav(routeId);

  const page =
    manifest.find(p => p.id === routeId) ||
    manifest.find(p => p.id === "home");

  if (!page || page.id === "home") {
    await renderHomePage();
  } else {
    await renderMarkdownPage(page);
  }
}

async function main() {
  const manifest = await loadManifest();
  renderNav(groupPages(manifest));

  window.addEventListener("hashchange", () => route(manifest));
  route(manifest);
}

main();