// Small shared helpers. Kept dependency-free so the grammar runs in Node tests too.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];

export function shuffle(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function weightedPick(items, weights, rnd = Math.random) {
  let total = 0;
  for (const w of weights) total += w;
  let x = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const uniq = arr => [...new Set(arr)];
export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
