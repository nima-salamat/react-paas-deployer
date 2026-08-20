/**
 * Prefetch thresholds for the chat message list.
 *
 * older  → load when near the TOP of the loaded window (scrollTop small)
 * newer  → load when near the BOTTOM of the loaded window (distBottom small)
 *
 * Larger threshold = start loading earlier (while still farther from the edge).
 */

/** Distance from top that still triggers loadOlder. */
export function olderPrefetchThreshold(clientHeight, isMobile) {
  const h = Math.max(1, Number(clientHeight) || 1);
  // Slightly earlier than a single viewport — not so large that every open fires
  return Math.max(isMobile ? 900 : 700, Math.round(h * 1.55));
}

/** Distance from bottom of loaded window that triggers loadNewer. */
export function newerPrefetchThreshold(clientHeight, isMobile) {
  const h = Math.max(1, Number(clientHeight) || 1);
  // More aggressive toward live edge so scrolling down stays continuous
  return Math.max(isMobile ? 2200 : 1800, Math.round(h * 3.6));
}

/**
 * @param {HTMLElement} el
 * @param {{ isMobile?: boolean, hasMoreNewer?: boolean, loading?: boolean }} opts
 */
export function getScrollPrefetchPlan(el, opts = {}) {
  if (!el) {
    return { loadOlder: false, loadNewer: false, distTop: 0, distBottom: 0 };
  }
  const h = el.clientHeight || 1;
  const distTop = Math.max(0, el.scrollTop);
  const distBottom = Math.max(0, el.scrollHeight - el.scrollTop - h);
  const loading = Boolean(opts.loading);
  const isMobile = Boolean(opts.isMobile);
  const hasMoreNewer = Boolean(opts.hasMoreNewer);

  return {
    loadOlder: !loading && distTop < olderPrefetchThreshold(h, isMobile),
    loadNewer:
      !loading
      && hasMoreNewer
      && distBottom < newerPrefetchThreshold(h, isMobile),
    distTop,
    distBottom,
  };
}

export function shouldChainLoadOlder(el, isMobile) {
  if (!el) return false;
  const h = el.clientHeight || 1;
  return el.scrollTop < Math.max(isMobile ? 800 : 600, Math.round(h * 1.35));
}

export function shouldChainLoadNewer(el, isMobile) {
  if (!el) return false;
  const h = el.clientHeight || 1;
  const distBottom = Math.max(0, el.scrollHeight - el.scrollTop - h);
  return distBottom < Math.max(isMobile ? 1800 : 1400, Math.round(h * 3.0));
}
