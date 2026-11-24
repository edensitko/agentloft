// Which labels to show when many of them land on the same spot. No DOM here, so it can be tested in node.
const PAD = 2;
/**
 * boxes: [{ id, x, y, w, h, rank, count }] - lower rank is more important; `shown` keeps what is already visible in place, so labels
 * do not flicker while the camera moves. Returns { hidden: Set of ids, more: Map(id -> how many people are behind this label) }.
 */
export function declutter(boxes, shown = new Set()) {
  const order = [...boxes].sort((a, b) => a.rank - b.rank || (shown.has(b.id) - shown.has(a.id)) || String(a.id).localeCompare(String(b.id))), kept = [], hidden = new Set(), more = new Map();
  for (const b of order) {
    const on = kept.find((k) => b.x < k.x + k.w + PAD && k.x < b.x + b.w + PAD && b.y < k.y + k.h + PAD && k.y < b.y + b.h + PAD);
    if (!on) { kept.push(b); continue; }
    hidden.add(b.id); if (b.count && on.count) more.set(on.id, (more.get(on.id) ?? 0) + 1);
  }
  return { hidden, more };
}

/** How far to slide a label centred on `at` so that all of it stays inside 0..size; null when what it names is itself off the screen. */
export function nudge(at, length, size, gap = 4) {
  if (at < 0 || at > size) return null;
  const half = Math.min(length, size - 2 * gap) / 2 + gap;
  return Math.max(half, Math.min(size - half, at)) - at;
}
