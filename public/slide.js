/** Moves from `at` by (dx, dz), sliding along whatever is in the way. Pure, so it is tested without a browser. */
export function slide(at, dx, dz, blocked, r = 0.34) {
  const free = (x, z) => ![[r, 0], [-r, 0], [0, r], [0, -r]].some(([a, b]) => blocked(x + a, z + b));
  const out = { x: at.x, z: at.z }, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2)); // small steps, so a slow frame cannot jump through a wall
  if (!free(at.x, at.z)) { // standing inside furniture (a chair): any way out is fine
    return { x: at.x + dx, z: at.z + dz };
  }
  for (let i = 0; i < n; i++) { if (free(out.x + dx / n, out.z)) out.x += dx / n; if (free(out.x, out.z + dz / n)) out.z += dz / n; }
  return out;
}

