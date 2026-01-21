async function renderHomePage() {
  const page = document.getElementById("page");
  // Intentionally blank home page.
  page.innerHTML = "";
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
    await hydrateDjSetSummary(pageDef);
  } catch (err) {
    renderMarkdownHtml(
      title,
      `<p style="color:#b00020;">Failed to load ${escapeHtml(path)}: ${escapeHtml(err?.message || err)}</p>`,
    );
  }
}
