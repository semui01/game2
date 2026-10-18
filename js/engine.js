// Rules of one level: moves, scoring, specials, jelly and goals.
// The UI animates what play() reports; the bot in the tests plays the same rules.

import { Board } from './board.js';
import { analyze } from './grammar.js';
import { findSentences } from './solver.js';

const TENSE_LABEL = {
  praesens: 'Präsens',
  praeteritum: 'Präteritum',
  perfekt: 'Perfekt',
  plusquamperfekt: 'Plusquamperfekt',
  futur1: 'Futur I',
};
const TENSE_BONUS = { praesens: 0, praeteritum: 0.5, perfekt: 0.5, plusquamperfekt: 1, futur1: 0.5 };
const LEN_MULT = [0, 0, 1, 1.5, 2, 2.6, 3.2, 4, 5];

export function features(info) {
  const f = [{ key: 'tense', label: TENSE_LABEL[info.tense], bonus: TENSE_BONUS[info.tense] }];
  if (info.modal) f.push({ key: 'modal', label: 'Modalverb', bonus: 0.5 });
  if (info.passive) f.push({ key: 'passive', label: 'Passiv', bonus: 1 });
  if (info.question === 'yn') f.push({ key: 'question', label: 'Ja/Nein-Frage', bonus: 0.5 });
  if (info.question === 'w') f.push({ key: 'wquestion', label: 'W-Frage', bonus: 0.75 });
  if (info.inversion) f.push({ key: 'inversion', label: 'Inversion', bonus: 0.5 });
  if (info.negation) f.push({ key: 'negation', label: `Negation (${info.negation})`, bonus: 0.5 });
  if (info.separable) f.push({ key: 'separable', label: 'Trennbar', bonus: 0.75 });
  if (info.accMasc) f.push({ key: 'akk', label: 'Akkusativ', bonus: 0.25 });
  return f;
}

export function scoreSentence(info, combo = 1) {
  const feats = features(info);
  const bonus = feats.reduce((a, f) => a + f.bonus, 0);
  const comboMult = 1 + Math.min(Math.max(combo - 1, 0), 10) * 0.1;
  const base = info.len * 10 * LEN_MULT[Math.min(info.len, 8)];
  return { points: Math.round((base * (1 + bonus) * comboMult) / 5) * 5, feats, comboMult };
}

export const SPECIAL_FOR_LENGTH = len => (len >= 6 ? 'star' : len === 5 ? 'bomb' : len === 4 ? 'line' : null);

export class Run {
  constructor(level, { rng = Math.random, fill = true } = {}) {
    this.level = level;
    this.rng = rng;
    this.board = new Board(level, rng);
    const R = level.rows;
    const C = level.cols;
    this.jelly = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => (level.jelly?.[r]?.[c] === '#' ? 1 : 0)));
    this.jellyTotal = this.jellyLeft();
    this.score = 0;
    this.movesLeft = level.moves ?? Infinity;
    this.combo = 0;
    this.bestCombo = 0;
    this.sentences = [];
    this.hints = level.hints ?? 3;
    this.state = 'play';
    this.bonus = 0;
    this.goals = (level.goals || []).map(g => ({
      ...g,
      have: 0,
      need: g.type === 'jelly' ? this.jellyTotal : g.type === 'score' ? g.target : g.count,
    }));
    if (fill) this.board.fillInitial(level.minStart ?? 4);
  }

  // Plain data for the viewer's live-update snapshot.
  serialize() {
    return {
      grid: this.board.grid.map(row => row.map(t => t && [t.word, t.special])),
      jelly: this.jelly,
      score: this.score,
      movesLeft: Number.isFinite(this.movesLeft) ? this.movesLeft : null,
      combo: this.combo,
      bestCombo: this.bestCombo,
      hints: this.hints,
      goals: this.goals.map(g => g.have),
      count: this.sentences.length,
    };
  }

  static restore(level, data, opts = {}) {
    const run = new Run(level, { ...opts, fill: false });
    run.board.grid = data.grid.map(row => row.map(cell => (cell ? run.board.makeTile(cell[1], cell[0]) : null)));
    run.board.fill();
    run.jelly = data.jelly;
    run.score = data.score;
    run.movesLeft = data.movesLeft ?? Infinity;
    run.combo = data.combo;
    run.bestCombo = data.bestCombo;
    run.hints = data.hints;
    run.goals.forEach((g, i) => (g.have = data.goals[i] ?? 0));
    run.sentences = Array.from({ length: data.count || 0 }, () => ({}));
    return run;
  }

  jellyLeft() {
    return this.jelly.reduce((a, row) => a + row.reduce((b, x) => b + x, 0), 0);
  }

  wordsAt(cells) {
    return cells.map(([r, c]) => this.board.grid[r][c].word);
  }

  check(cells) {
    return analyze(this.wordsAt(cells));
  }

  blastArea(type, r, c) {
    const { rows: R, cols: C } = this.board;
    const out = [];
    if (type === 'row' || type === 'star') for (let x = 0; x < C; x++) out.push([r, x]);
    if (type === 'col' || type === 'star') for (let y = 0; y < R; y++) if (!(type === 'star' && y === r)) out.push([y, c]);
    if (type === 'bomb') {
      for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (y >= 0 && y < R && x >= 0 && x < C) out.push([y, x]);
    }
    return out;
  }

  play(cells) {
    if (this.state !== 'play') return null;
    const res = this.check(cells);
    if (!res.ok) {
      this.combo = 0;
      return { ok: false, res };
    }
    const info = res.parse;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (Number.isFinite(this.movesLeft)) this.movesLeft--;
    const sc = scoreSentence(info, this.combo);
    let points = sc.points;

    const grid = this.board.grid;
    const C = this.board.cols;
    const cleared = new Map();
    const take = (r, c) => {
      const k = r * C + c;
      if (cleared.has(k) || !grid[r][c]) return null;
      cleared.set(k, { r, c, id: grid[r][c].id });
      return grid[r][c];
    };
    for (const [r, c] of cells) take(r, c);

    // Special tiles in the sentence go off, and can set each other off.
    const blasts = [];
    const fired = new Set();
    const queue = cells.filter(([r, c]) => grid[r][c].special);
    while (queue.length) {
      const [r, c] = queue.shift();
      const k = r * C + c;
      if (fired.has(k)) continue;
      fired.add(k);
      const type = grid[r][c].special;
      const area = this.blastArea(type, r, c);
      blasts.push({ type, r, c, cells: area });
      for (const [ar, ac] of area) {
        const hit = take(ar, ac);
        if (hit && hit.special) queue.push([ar, ac]);
      }
    }
    const extra = cleared.size - cells.length;
    points += extra * 20;

    const jellyHits = [];
    for (const { r, c } of cleared.values()) {
      if (this.jelly[r][c] > 0) {
        this.jelly[r][c]--;
        jellyHits.push({ r, c, left: this.jelly[r][c] });
        points += 60;
      }
    }

    const removed = [...cleared.values()];
    for (const { r, c } of removed) grid[r][c] = null;

    // Long sentences leave a special tile where they ended.
    let created = null;
    const kind = SPECIAL_FOR_LENGTH(cells.length);
    if (kind) {
      const [r, c] = cells[cells.length - 1];
      const type = kind === 'line' ? (this.rng() < 0.5 ? 'row' : 'col') : kind;
      const tile = this.board.makeTile(type);
      grid[r][c] = tile;
      created = { tile, r, c };
    }

    const { moves, spawned } = this.board.collapse();
    this.score += points;
    this.sentences.push({ words: info.words, question: info.question, info, points });
    for (const g of this.goals) {
      if (g.type === 'sentences' && g.test(info)) g.have = Math.min(g.need, g.have + 1);
    }
    this.syncGoals();
    const shuffled = this.board.hasMoves() ? null : this.board.shuffle();
    this.updateState();
    return {
      ok: true,
      info,
      points,
      feats: sc.feats,
      combo: this.combo,
      comboMult: sc.comboMult,
      extra,
      removed,
      blasts,
      created,
      moves,
      spawned,
      jellyHits,
      shuffled,
      state: this.state,
      bonus: this.bonus,
    };
  }

  syncGoals() {
    for (const g of this.goals) {
      if (g.type === 'jelly') g.have = this.jellyTotal - this.jellyLeft();
      if (g.type === 'score') g.have = Math.min(g.need, this.score);
    }
  }

  goalsMet() {
    return this.goals.length > 0 && this.goals.every(g => g.have >= g.need);
  }

  updateState() {
    if (this.state !== 'play') return;
    if (this.goalsMet()) {
      this.state = 'won';
      this.bonus = Number.isFinite(this.movesLeft) ? this.movesLeft * 100 : 0;
      this.score += this.bonus;
    } else if (this.movesLeft <= 0) {
      this.state = 'lost';
    }
  }

  stars() {
    if (this.state !== 'won') return 0;
    const [, two, three] = this.level.stars;
    return 1 + (this.score >= two ? 1 : 0) + (this.score >= three ? 1 : 0);
  }

  // How useful a found sentence is right now: points plus progress on open goals.
  // Hints prefer clear sentences over ones like «Es trinkt es».
  value(found) {
    let v = scoreSentence(found.parse, this.combo + 1).points;
    const { subj, obj } = found.parse;
    if (obj?.pron && obj.tags.includes('any')) v -= subj.pron ? 80 : 40;
    for (const g of this.goals) {
      if (g.have >= g.need) continue;
      if (g.type === 'sentences' && g.test(found.parse)) v += 600;
      if (g.type === 'jelly') v += 150 * found.cells.filter(([r, c]) => this.jelly[r][c] > 0).length;
    }
    return v;
  }

  bestMoves({ limit = 40, budgetMs = 90 } = {}) {
    const found = findSentences(this.board.grid, { limit, budgetMs, rng: this.rng });
    return found.map(f => ({ ...f, value: this.value(f) })).sort((a, b) => b.value - a.value);
  }

  hint() {
    if (this.hints <= 0) return null;
    const best = this.bestMoves()[0];
    if (!best) return null;
    this.hints--;
    return best;
  }

  shuffleBoard() {
    if (Number.isFinite(this.movesLeft)) this.movesLeft--;
    const placed = this.board.shuffle();
    this.combo = 0;
    this.updateState();
    return placed;
  }
}
