import { escapeHtml, titleCaseFromFolder } from "../core/strings.js";
import { encodeRoute } from "../core/url.js";

export function groupPages(manifest) {
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

export function renderNav({ navOrder }) {
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

export function setActiveNav(routeId) {
  document.querySelectorAll('#nav a[data-page-id]').forEach((a) => {
    a.classList.toggle("active", a.getAttribute("data-page-id") === routeId);
  });

  document.querySelectorAll("details.nav-group").forEach((d) => {
    const folder = d.getAttribute("data-folder") || "";
    d.open = routeId.startsWith(folder + "/") || d.open;
  });
}
