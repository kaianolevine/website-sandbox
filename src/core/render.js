export function renderPageHtml(_title, html) {
  const page = document.getElementById("page");
  if (!page) return;
  page.innerHTML = `
    <div id="page-content" style="margin-top: 12px; line-height: 1.55;">${html}</div>
  `;
}

export function renderLoading() {
  const page = document.getElementById("page");
  if (!page) return;
  page.innerHTML = `<p style="color:#666;margin-top:10px;">Loading…</p>`;
}
