export const RACK_COLUMNS = 10;
export const RACK_SLOTS = RACK_COLUMNS * 2;
export type RackLayout = Array<number | null>;

export function emptyRack(): RackLayout {
  return Array.from({ length: RACK_SLOTS }, () => null);
}

function defaultPositions(count: number) {
  const firstRow = Math.ceil(count / 2);
  return Array.from({ length: count }, (_, i) => i < firstRow ? i : RACK_COLUMNS + i - firstRow);
}

export function reconcileRack(previous: RackLayout | null, hand: number[], preferredSlot: number | null = null): RackLayout {
  const allowed = new Set(hand);
  const next = emptyRack();
  const seen = new Set<number>();
  if (Array.isArray(previous)) {
    for (let i = 0; i < RACK_SLOTS; i++) {
      const tile = previous[i];
      if (typeof tile === "number" && allowed.has(tile) && !seen.has(tile)) {
        next[i] = tile;
        seen.add(tile);
      }
    }
  }
  const missing = hand.filter(tile => !seen.has(tile));
  const positions = defaultPositions(hand.length);
  for (const tile of missing) {
    const desired = preferredSlot !== null && preferredSlot >= 0 && preferredSlot < RACK_SLOTS ? preferredSlot : null;
    if (desired !== null && next[desired] !== null) {
      const right = next.findIndex((value, i) => i > desired && value === null);
      if (right >= 0) {
        for (let i = right; i > desired; i--) next[i] = next[i - 1];
      } else {
        const left = next.lastIndexOf(null, desired - 1);
        for (let i = left; i < desired; i++) next[i] = next[i + 1];
      }
      next[desired] = tile;
    } else {
      const position = desired ?? positions.find(i => next[i] === null) ?? next.findIndex(x => x === null);
      if (position >= 0) next[position] = tile;
    }
    preferredSlot = null;
  }
  return next;
}

export function moveRackTile(layout: RackLayout, from: number, to: number): RackLayout {
  if (from < 0 || from >= RACK_SLOTS || to < 0 || to >= RACK_SLOTS || layout[from] === null || from === to) return layout;
  const next = [...layout];
  const tile = next[from];
  if (next[to] === null) {
    next[from] = null;
    next[to] = tile;
  } else {
    next.splice(from, 1);
    next.splice(from < to ? to - 1 : to, 0, tile);
  }
  return next;
}

export function arrangeRack(hand: number[], compare: (a: number, b: number) => number): RackLayout {
  const next = emptyRack();
  const sorted = [...hand].sort(compare);
  const positions = defaultPositions(sorted.length);
  sorted.forEach((tile, i) => { next[positions[i]] = tile; });
  return next;
}
