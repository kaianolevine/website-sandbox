# How it works

1. A GitHub Action generates `/v1/deejay-sets/deejay_set_collection.json`
2. Cloudflare Pages serves the static site
3. **Home** loads the JSON and renders the folder + set list
4. Other pages are Markdown rendered client-side

## Adding a new page

1. Add an entry to the `PAGES` array in `index.html`
2. Create the corresponding file in `/pages/*.md`
