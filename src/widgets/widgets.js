import { renderDjCollectionInto } from "./djCollection/renderDjCollectionInto.js";
import { renderDjSetSummaryInto } from "./djSetSummary/renderDjSetSummaryInto.js";

export async function hydrateWidgets(pageDef) {
  // DJ Collection widgets
  const collections = document.querySelectorAll("[data-dj-collection]");
  for (const el of collections) {
    await renderDjCollectionInto(el);
  }

  // DJ Set Summary widgets
  const summaries = document.querySelectorAll("[data-dj-set-summary]");
  if (summaries.length) {
    const id = String(pageDef?.id || "");
    const defaultDj = id.includes("/") ? id.split("/")[0] : "";

    for (const container of summaries) {
      const queryAttr = container.getAttribute("data-dj-set-summary-query") || "";
      const query = String(queryAttr).trim() || defaultDj;
      await renderDjSetSummaryInto(container, query);
    }
  }
}
