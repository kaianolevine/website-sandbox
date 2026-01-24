import { decodeRoute } from "../core/url.js";
import { setActiveNav } from "../nav/nav.js";
import { renderMarkdownPage } from "../markdown/markdown.js";

async function renderHomePage() {
  const page = document.getElementById("page");
  if (!page) return;
  page.innerHTML = "";
}

export async function route(manifest) {
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

export function attachRouter(manifest) {
  window.addEventListener("hashchange", () => route(manifest));
  return () => window.removeEventListener("hashchange", () => route(manifest));
}
