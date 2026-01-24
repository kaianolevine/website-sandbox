import { renderDjCollectionInto } from "./djCollection/renderDjCollectionInto.js";
import { renderRecentHistoryInto } from "./liveHistory/renderRecentHistoryInto.js";
import { renderSubmittedMusicInto } from "./routineMusic/renderSubmittedMusicInto.js";

export async function hydrateWidgets(pageDef) {
  // DJ Collection widgets
  const collections = document.querySelectorAll("[data-dj-collection]");
  for (const el of collections) await renderDjCollectionInto(el);

  // Live History widgets
  const histories = document.querySelectorAll("[data-live-history]");
  for (const el of histories) await renderRecentHistoryInto(el);

  // Routine Music widgets
  const submitted = document.querySelectorAll("[data-submitted-music]");
  for (const el of submitted) await renderSubmittedMusicInto(el);
}