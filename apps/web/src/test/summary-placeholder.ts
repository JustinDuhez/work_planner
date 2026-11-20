/** The summary card placeholder (SummarySkeleton) while the page data loads, or null. */
export function summaryPlaceholder() {
  return document.querySelector('[data-state="loading"]');
}
