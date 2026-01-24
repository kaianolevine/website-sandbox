# website-sandbox-starter

[https://website-sandbox.pages.dev/]
Static site starter for a DJ set collection.

## Structure

- `index.html` — single-page shell with hash routing
- `pages/*.md` — markdown “pages”
- `public/v1/deejay-sets/deejay_set_collection.json` — data consumed by Home page

## Local preview

Any static server works. For example:

```bash
python -m http.server 8080
```

Then open:
- http://localhost:8080/#/home
- http://localhost:8080/#/about

# website-sandbox

Static, client‑side–only website for publishing DJ set collections and related pages.
All content lives in markdown and JSON, with a small modular JavaScript runtime that
handles navigation, routing, and optional interactive widgets.

---

## High‑level design

This site is a **single‑page application (SPA)** with:
- Hash‑based routing (`#/page-id`)
- Markdown files as the primary content source
- A JSON‑driven navigation manifest
- Optional embedded widgets for dynamic data (DJ collections, summaries, etc.)

There is **no build step** and **no server‑side code**.

---

## Directory structure

```
.
├── index.html                 # App shell (loads app.js as an ES module)
├── app.js                     # Entry point (wires nav + router)
├── pages/
│   ├── pages.json             # Navigation manifest (ORDER MATTERS)
│   ├── home.md                # Home page (may be empty)
│   ├── about.md
│   └── DJ Marvel/
│       └── DJ Marvel Sets.md
├── v1/deejay-sets/
│   └── deejay_set_collection.json
└── src/
    ├── core/                  # Pure helpers (strings, urls, rendering)
    ├── nav/                   # Manifest loading + navbar rendering
    ├── router/                # Hash routing
    ├── markdown/              # Markdown loading + sanitization
    └── widgets/               # Optional dynamic components
```

---

## Pages & navigation

### `pages/pages.json`

This file is the **source of truth** for navigation order.

- Pages appear in the navbar **exactly in the order listed**
- Folder paths (e.g. `DJ Marvel/DJ Marvel Sets`) create dropdown menus
- Any `.md` file not referenced here may be appended automatically by tooling,
  but existing order is always preserved

Example:

```json
[
  { "id": "home", "title": "Home" },
  { "id": "about", "title": "About" },
  { "id": "DJ Marvel/DJ Marvel Sets", "title": "DJ Marvel — Sets" }
]
```

### Markdown pages

Each page ID maps to:

```
pages/<id>.md
```

Examples:
- `about` → `pages/about.md`
- `DJ Marvel/DJ Marvel Sets` → `pages/DJ Marvel/DJ Marvel Sets.md`

Only the **literal markdown content** is rendered — no title injection or front‑matter
is required.

---

## Widgets (optional dynamic content)

Markdown files may include **HTML placeholders** that are hydrated at runtime.

### DJ collection (full library)

```html
<div data-dj-collection></div>
```

### DJ set summary (filtered by name)

```html
<div data-dj-set-summary data-dj-set-summary-query="DJ Marvel"></div>
```

Widgets:
- Are opt‑in
- Do not affect static markdown rendering
- Pull data from `/v1/deejay-sets/deejay_set_collection.json`

---

## Link behavior

All external links rendered from markdown automatically open in a new tab:

```
target="_blank" rel="noopener noreferrer"
```

Internal hash links (`#/page`) are unaffected.

---

## Local development

Any static server works:

```bash
python -m http.server 8080
```

Then open:

- http://localhost:8080/#/home
- http://localhost:8080/#/about

---

## Deployment

This site is compatible with:
- Cloudflare Pages
- GitHub Pages
- Any static hosting provider

No build or bundling step is required.

---

## Philosophy

- Markdown first
- JSON for structure
- JavaScript only where behavior is needed
- No frameworks
- No build tooling
