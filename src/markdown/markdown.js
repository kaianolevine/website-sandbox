import { escapeHtml } from "../core/strings.js";
import { safePagePathFromId } from "../core/url.js";
import { renderPageHtml, renderLoading } from "../core/render.js";
import { hydrateWidgets } from "../widgets/widgets.js";

function openLinksInNewTab(container) {
  if (!container) return;
  container.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href) return;
    if (href.startsWith("#/") || href.startsWith("#")) return;
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
}

export async function renderMarkdownPage(pageDef) {
  const title = pageDef.title || pageDef.id;
  const path = pageDef.path || safePagePathFromId(pageDef.id);

  if (!path) {
    renderPageHtml(title, `<p style="color:#b00020;">Invalid page id.</p>`);
    return;
  }

  const fetchPath = encodeURI(path);
  renderLoading();

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

    // Render ONLY what is in the markdown (renderPageHtml ignores title)
    renderPageHtml(title, safeHtml);

    const pageContent = document.getElementById("page-content");
    openLinksInNewTab(pageContent);

    await hydrateWidgets(pageDef);
  } catch (err) {
    renderPageHtml(title, `<p style="color:#b00020;">Failed to load ${escapeHtml(fetchPath)}: ${escapeHtml(err?.message || err)}</p>`);
  }
}
