// Finds valid sentences on the board by walking paths of touching tiles.
// Paths are pruned as soon as no reading of the words so far can still work.

import { analyze } from './grammar.js';
import { now, shuffle } from './util.js';

export const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

export function findSentences(grid, { maxLen = 6, limit = 40, budgetMs = 60, rng = Math.random, stopEarly = false } = {}) {
  const R = grid.length;
  const C = grid[0].length;
  const out = [];
  const t0 = now();
  const used = grid.map(row => row.map(() => false));
  const path = [];
  const words = [];
  const cache = new Map();
  let stop = false;

  const check = () => {
    const key = words.join('|');
    let r = cache.get(key);
    if (!r) {
      r = analyze(words, { strict: true });
      cache.set(key, r);
    }
    return r;
  };

  const dfs = (r, c) => {
    used[r][c] = true;
    path.push([r, c]);
    words.push(grid[r][c].word);
    const res = check();
    if (res.viable) {
      if (res.ok && words.length >= 2) {
        out.push({ cells: path.slice(), parse: res.parse });
        if (out.length >= limit || stopEarly) stop = true;
      }
      if (!stop && words.length < maxLen) {
        for (const [dr, dc] of shuffle(DIRS.slice(), rng)) {
          if (stop || now() - t0 > budgetMs) break;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < R && nc >= 0 && nc < C && !used[nr][nc] && grid[nr][nc]) dfs(nr, nc);
        }
      }
    }
    used[r][c] = false;
    path.pop();
    words.pop();
  };

  const starts = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c]) starts.push([r, c]);
  for (const [r, c] of shuffle(starts, rng)) {
    if (stop || now() - t0 > budgetMs) break;
    dfs(r, c);
  }
  return out;
}

export const isAdjacent = ([r1, c1], [r2, c2]) => Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)) === 1;
