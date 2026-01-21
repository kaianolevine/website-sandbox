# website-sandbox-starter

Static site starter for a DJ set collection.

## Structure

- `index.html` — single-page shell with hash routing
- `pages/*.md` — markdown “pages”
- `site_data/deejay_set_collection.json` — data consumed by Home page

## Local preview

Any static server works. For example:

```bash
python -m http.server 8080
```

Then open:
- http://localhost:8080/#/home
- http://localhost:8080/#/about
