// The grid of word tiles: spawning, gravity and shuffling.

import { LEX, wordClass, subjPersons, finPersons, auxOfFinite, auxOfPart } from './lexicon.js';
import { clamp, pick, shuffle, weightedPick } from './util.js';
import { findSentences } from './solver.js';

let nextId = 1;

export class Board {
  constructor(level, rng = Math.random) {
    this.rows = level.rows;
    this.cols = level.cols;
    this.rng = rng;
    this.groups = level.spawn.map(g => ({ ...g, words: g.words.filter(w => LEX.has(w)) })).filter(g => g.words.length);
    const total = this.groups.reduce((a, g) => a + g.w, 0);
    for (const g of this.groups) g.share = g.w / total;
    this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(null));
  }

  *tiles() {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[r][c]) yield [r, c, this.grid[r][c]];
  }

  makeTile(special = null, word = null) {
    const next = word ? { word, group: -1 } : this.nextWord();
    return { id: nextId++, word: next.word, group: next.group, special, cls: wordClass(next.word) };
  }

  // Picks the next word so the board stays close to the level's mix of word types,
  // and leans towards verb forms that fit the subjects already on the board.
  nextWord() {
    const rng = this.rng;
    const counts = new Array(this.groups.length).fill(0);
    const seen = new Map();
    const persons = [];
    const auxes = new Set();
    let total = 0;
    for (const [, , t] of this.tiles()) {
      if (t.group >= 0) counts[t.group]++;
      total++;
      seen.set(t.word, (seen.get(t.word) || 0) + 1);
      persons.push(...subjPersons(t.word));
      for (const a of auxOfFinite(t.word)) auxes.add(a);
    }
    const weights = this.groups.map((g, i) => g.w * clamp(1 + (g.share - (total ? counts[i] / total : 0)) * 8, 0.1, 3));
    const gi = weightedPick(this.groups.map((_, i) => i), weights, rng);
    const g = this.groups[gi];
    let options = g.words.filter(w => (seen.get(w) || 0) < 2);
    if (!options.length) options = g.words;
    if (g.agree && persons.length && rng() < 0.75) {
      const p = pick(persons, rng);
      const fit = options.filter(w => finPersons(w).includes(p));
      if (fit.length) options = fit;
    }
    if (g.matchAux && auxes.size && rng() < 0.7) {
      const fit = options.filter(w => auxes.has(auxOfPart(w)));
      if (fit.length) options = fit;
    }
    return { word: pick(options, rng), group: gi };
  }

  fill() {
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (!this.grid[r][c]) this.grid[r][c] = this.makeTile();
  }

  // Fills a fresh board that offers at least a few sentences to start with.
  fillInitial(minSentences = 4) {
    for (let attempt = 0; attempt < 30; attempt++) {
      this.grid = Array.from({ length: this.rows }, () => new Array(this.cols).fill(null));
      this.fill();
      if (findSentences(this.grid, { limit: minSentences, budgetMs: 120, rng: this.rng }).length >= minSentences) return;
    }
  }

  // Lets tiles fall into gaps and drops new tiles in from the top.
  collapse() {
    const moves = [];
    const spawned = [];
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        const t = this.grid[r][c];
        if (!t) continue;
        if (r !== write) {
          this.grid[write][c] = t;
          this.grid[r][c] = null;
          moves.push({ id: t.id, r: write, c, from: r });
        }
        write--;
      }
      const gap = write + 1;
      for (let r = write; r >= 0; r--) {
        const tile = this.makeTile();
        this.grid[r][c] = tile;
        spawned.push({ tile, r, c, from: r - gap });
      }
    }
    return { moves, spawned };
  }

  hasMoves() {
    return findSentences(this.grid, { stopEarly: true, budgetMs: 150, rng: this.rng }).length > 0;
  }

  // Rearranges the tiles; replaces a few words if no order gives a sentence.
  shuffle() {
    const all = [...this.tiles()].map(([, , t]) => t);
    for (let attempt = 0; attempt < 24; attempt++) {
      shuffle(all, this.rng);
      let i = 0;
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.grid[r][c] = all[i++];
      if (findSentences(this.grid, { limit: 3, budgetMs: 80, rng: this.rng }).length >= 3) break;
      if (attempt % 6 === 5) {
        for (let k = 0; k < 6; k++) {
          const j = Math.floor(this.rng() * all.length);
          if (!all[j].special) all[j] = this.makeTile();
        }
      }
    }
    const placed = [];
    for (const [r, c, t] of this.tiles()) placed.push({ tile: t, r, c });
    return placed;
  }
}
