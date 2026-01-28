import { renderDjCollectionInto } from "./widgets/renderDjCollectionInto.js";
import { renderRecentHistoryInto } from "./widgets/renderRecentHistoryInto.js";
import { renderSubmittedMusicInto } from "./widgets/renderSubmittedMusicInto.js";

async function hydrate() {
  for (const el of document.querySelectorAll("[data-dj-collection]")) {
    await renderDjCollectionInto(el);
  }
  for (const el of document.querySelectorAll("[data-live-history]")) {
    await renderRecentHistoryInto(el);
  }
  for (const el of document.querySelectorAll("[data-submitted-music]")) {
    await renderSubmittedMusicInto(el);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", hydrate);
} else {
  hydrate();
}