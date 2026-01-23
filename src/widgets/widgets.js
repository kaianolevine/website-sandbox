import { renderDjCollectionInto } from "./djCollection/renderDjCollectionInto.js";

export async function hydrateWidgets(pageDef) {
  // DJ Collection widgets
  const collections = document.querySelectorAll("[data-dj-collection]");
  for (const el of collections) {
    await renderDjCollectionInto(el);
  }
}
