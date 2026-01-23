import { renderDjCollectionInto } from "./src/widgets/djCollection/renderDjCollectionInto.js";
import { hydrateWidgets } from "./src/widgets/widgets.js";
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
  return `/pages/${s}.md`;
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
  const res = await fetch("/pages/pages.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load /pages/pages.json (HTTP ${res.status})`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("/pages/pages.json must be an array");
  return json;
}

function ensureSpecialPages(manifest) {
  const out = Array.isArray(manifest) ? [...manifest] : [];

  if (!out.some((p) => p?.id === "home")) {
    out.unshift({ id: "home", title: "Home", kind: "home" });
  }

  return out;
}

function groupPages(manifest) {
  // Preserve the order exactly as listed in pages.json.
  // Root pages appear as links in order.
  // Subfolder pages ("Folder/Page") are grouped into a dropdown the first time that folder appears,
  // and pages within that folder are kept in first-seen order.

  const navOrder = []; // array of {kind:"link", page} or {kind:"group", folder, pages: []}
  const groupsByFolder = new Map();

  for (const p of manifest) {
    if (!p?.id) continue;

    const parts = String(p.id).split("/");
    if (parts.length === 1) {
      navOrder.push({ kind: "link", page: p });
      continue;
    }

    const folder = parts[0];
    if (!groupsByFolder.has(folder)) {
      const group = { kind: "group", folder, pages: [] };
      groupsByFolder.set(folder, group);
      navOrder.push(group);
    }

    groupsByFolder.get(folder).pages.push(p);
  }

  return { navOrder };
}

function renderNav({ navOrder }) {
  const nav = document.getElementById("nav");
  if (!nav) return;

  const link = (p) =>
    `<a href="#/${encodeRoute(p.id)}" data-page-id="${escapeHtml(p.id)}">${escapeHtml(p.title || p.id)}</a>`;

  const html = (navOrder || [])
    .map((item) => {
      if (item.kind === "link") {
        return link(item.page);
      }

      // Dropdown group
      const folder = item.folder;
      const label = titleCaseFromFolder(folder);
      const items = (item.pages || []).map(link).join("");

      return `
        <details class="nav-group" data-folder="${escapeHtml(folder)}">
          <summary>${escapeHtml(label)}</summary>
          <div class="nav-group-items">${items}</div>
        </details>
      `;
    })
    .join("");

  nav.innerHTML = html;
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
  if (page) page.innerHTML = `<p style="color:#666;margin-top:10px;">Loading…</p>`;

  try {
    const res = await fetch(fetchPath, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();

    const rawHtml = window.marked.parse(md);
    const safeHtml = window.DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["iframe"],
      ADD_ATTR: [
        "src", "style", "width", "height", "frameborder", "scrolling", "loading", "referrerpolicy",
        "data-dj-collection", "data-dj-set-summary", "data-dj-set-summary-query",
      ],
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });

    renderMarkdownHtml(title, safeHtml);
    // Default: open rendered markdown links in a new tab.
    // Keep internal hash navigation ("#/...") in the same tab.
    const pageContent = document.getElementById("page-content");
    if (pageContent) {
      pageContent.querySelectorAll("a[href]").forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (!href) return;

        // Keep SPA/internal navigation in the same tab
        if (href.startsWith("#/") || href.startsWith("#")) return;

        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
    }
    await hydrateWidgets(pageDef);
  } catch (err) {
    renderPageHtml(title, `<p style="color:#b00020;">Failed to load ${escapeHtml(fetchPath)}: ${escapeHtml(err?.message || err)}</p>`);
  }
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
