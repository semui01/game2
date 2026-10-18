// Game screen: renders a Run, handles drag / tap / keyboard input and animates
// what the engine reports (pop → blasts → jelly → special → gravity → refill).

import { Run } from './engine.js';
import { analyze, explain, suggest, formatSentence } from './grammar.js';
import { toEnglish } from './english.js';
import { CLASS_LABELS, describe, wordClass } from './lexicon.js';
import { findSentences, isAdjacent } from './solver.js';
import { speak } from './audio.js';
import { cap } from './util.js';

const sleep = ms => new Promise(res => setTimeout(res, ms));
const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const sameCell = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

// Cells are wider than tall: words read horizontally.
export const CELL_ASPECT = 0.8;

export const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.5c2 0 3.2 1 4.3 2.8l.4.7m0 0 .4.7C13.7 13 14.9 14 17 14h3m0 0-2.5-2.5M20 14l-2.5 2.5M4 17h3.5c1.4 0 2.4-.5 3.2-1.4M14.4 8.4c.8-.9 1.8-1.4 3.1-1.4H20m0 0-2.5-2.5M20 7l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z" fill="currentColor"/></svg>',
  row: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  col: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bomb: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="14" r="7" fill="currentColor"/><path d="M15.5 8.5l2-2M18 3v2M21 6h-2M20.2 3.8l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// ---------------------------------------------------------------------------
// Tile text layout

const VOWEL = /[aeiouäöüy]/i;
const PREFIXES = ['aufge', 'einge', 'mitge', 'fernge', 'ange', 'ge', 'auf', 'ein', 'mit', 'fern', 'an'];

// Candidate line breaks: after a verb prefix (auf|ge|standen), or at a syllable
// boundary (V|CV, VC|CV). Prefix breaks get a small bonus.
function breaks(w) {
  const out = [];
  for (const p of PREFIXES) if (w.startsWith(p) && w.length - p.length >= 4) out.push({ i: p.length, bonus: 1.08 });
  for (let i = 2; i <= w.length - 2; i++) {
    const a = w[i - 1];
    const b = w[i];
    const next = w[i + 1];
    const syllable =
      (VOWEL.test(a) && !VOWEL.test(b) && VOWEL.test(next)) ||
      (!VOWEL.test(a) && !VOWEL.test(b) && VOWEL.test(next) && VOWEL.test(w.slice(0, i - 1)) && !['ch', 'ck', 'ph', 'th', 'qu'].includes(a + b) && !(a === 's' && b === 'c') && !w.slice(0, i).endsWith('sch'));
    if (syllable) out.push({ i, bonus: 1 });
  }
  return out;
}

// Rough text width in "average letters": m and w are wide, i and l narrow.
function textWidth(s) {
  let w = 0;
  for (const ch of s) w += /[mwMW]/.test(ch) ? 1.45 : /[iljtfr.,'-]/.test(ch) ? 0.62 : /[A-ZÄÖÜ]/.test(ch) ? 1.15 : 1;
  return w;
}

// Font size as a share of the cell width.
function fit(s) {
  return Math.min(0.232, 1.36 / textWidth(s));
}

// Lays a word out on one line, or two if a break gives clearly bigger text.
function layoutWord(w) {
  let best = { lines: [w], fs: fit(w), score: fit(w) * 1.15 };
  if (w.length > 7) {
    for (const { i, bonus } of breaks(w)) {
      const lines = [w.slice(0, i) + '-', w.slice(i)];
      const fs = Math.min(fit(lines[0]), fit(lines[1]));
      if (fs * bonus > best.score) best = { lines, fs, score: fs * bonus };
    }
  }
  return best;
}

export function tileContent(word) {
  const parts = word.split(' ');
  const line = l => `<span class="w">${esc(l)}</span>`;
  if (parts.length === 2) {
    const noun = layoutWord(parts[1]);
    const fs = Math.min(noun.fs, fit(parts[0]) / 0.72, noun.lines.length > 1 ? 0.2 : 1);
    return { html: `<span class="det">${esc(parts[0])}</span>${noun.lines.map(line).join('')}`, fs };
  }
  const { lines, fs } = layoutWord(word);
  return { html: lines.map(line).join(''), fs };
}

export function miniTile(word, cls = wordClass(word), extra = '') {
  return `<span class="mini c-${cls}${extra}">${esc(word)}</span>`;
}

const ROLE = (pick, info) => {
  if (pick.wh) return 'Fragewort';
  switch (pick.r) {
    case 'subj':
      return 'Subjekt';
    case 'obj':
      return info.passive ? 'Objekt' : 'Akkusativ';
    case 'fin':
      return pick.fk === 'modal' ? 'Modalverb' : pick.fk === 'aux' ? 'Hilfsverb' : 'Verb';
    case 'rb':
      return pick.rk === 'part2' ? 'Partizip II' : pick.rk === 'inf' ? 'Infinitiv' : 'Präfix';
    case 'adv':
      return 'Adverb';
    case 'nicht':
      return 'Negation';
    default:
      return 'Adjektiv';
  }
};

const PRAISE = [
  [700, 'Sensationell!'],
  [420, 'Fantastisch!'],
  [260, 'Wunderbar!'],
  [160, 'Toll!'],
  [90, 'Super!'],
];

const SPECIAL_NAME = { row: 'Reihen-Blitz', col: 'Spalten-Blitz', bomb: 'Bonbon-Bombe', star: 'Stern' };

// ---------------------------------------------------------------------------

export class GameView {
  constructor(root, { level, sfx, settings, onExit, onEnd, restore = null }) {
    this.root = root;
    this.level = level;
    this.sfx = sfx;
    this.settings = settings;
    this.onExit = onExit;
    this.onEnd = onEnd;
    this.free = !Number.isFinite(level.moves);
    this.run = restore ? Run.restore(level, restore.run) : new Run(level);
    this.log = restore?.log || [];
    this.chain = [];
    this.busy = false;
    this.els = new Map();
    this.pointer = null;
    this.particles = [];
    this.cursor = null;
    this.shownScore = this.run.score;
    this.build();
    this.bind();
    this.layout();
    this.syncTiles(false);
    this.updateHud(false);
    this.stripIdle();
    this.armIdleHint();
  }

  get R() {
    return this.level.rows;
  }

  get C() {
    return this.level.cols;
  }

  snapshot() {
    return { levelId: this.level.id, run: this.run.serialize(), log: this.log };
  }

  build() {
    const l = this.level;
    const eyebrow = this.free ? 'Freies Spiel' : `Lektion ${l.id} · ${l.topic}`;
    this.root.innerHTML = `
      <div class="game">
        <header class="hud">
          <button class="icon-btn" data-act="exit" aria-label="${this.free ? 'Spiel beenden' : 'Zurück zur Karte'}">${ICON.back}</button>
          <div class="hud-level">
            <span class="eyebrow">${esc(eyebrow)}</span>
            <span class="hud-title">${esc(l.title)}</span>
          </div>
          <div class="hud-stat"><b data-moves></b><small>Züge</small></div>
          <div class="hud-stat"><b data-score>0</b><small>Punkte</small></div>
        </header>
        ${this.free ? '' : `<div class="meter" aria-hidden="true"><div class="meter-fill"></div>${[1, 2].map(i => `<span class="meter-star" data-star="${i}">${ICON.star}</span>`).join('')}</div>`}
        <ul class="goals" aria-label="Ziele"></ul>
        <section class="strip" aria-live="polite"></section>
        <div class="board-frame">
          <div class="board" tabindex="0" role="application" aria-label="Spielfeld. Pfeiltasten bewegen, Leertaste wählt, Enter prüft." style="--cols:${this.C};--rows:${this.R}">
            <div class="wells"></div>
            <svg class="trail" viewBox="0 0 ${this.C} ${this.R}" preserveAspectRatio="none" aria-hidden="true">
              <polyline class="trail-back" points=""/><polyline class="trail-front" points=""/>
            </svg>
            <div class="tiles"></div>
            <div class="frames" aria-hidden="true"></div>
            <div class="blasts" aria-hidden="true"></div>
            <canvas class="fx" aria-hidden="true"></canvas>
            <div class="praise" aria-hidden="true"></div>
          </div>
        </div>
        <footer class="tools">
          <button class="tool" data-act="hint">${ICON.bulb}<span>Tipp</span><em data-hints></em></button>
          <button class="tool" data-act="shuffle">${ICON.shuffle}<span>Mischen</span></button>
          <button class="tool" data-act="clear" disabled>${ICON.x}<span>Leeren</span></button>
          <button class="tool primary" data-act="submit" disabled>${ICON.check}<span>Prüfen</span></button>
        </footer>
        <div class="word-card" role="tooltip" hidden></div>
      </div>`;
    const $ = s => this.root.querySelector(s);
    this.gameEl = $('.game');
    this.frameEl = $('.board-frame');
    this.boardEl = $('.board');
    this.wellsEl = $('.wells');
    this.tilesEl = $('.tiles');
    this.framesEl = $('.frames');
    this.trailBack = $('.trail-back');
    this.trailFront = $('.trail-front');
    this.blastsEl = $('.blasts');
    this.fx = $('.fx');
    this.praiseEl = $('.praise');
    this.stripEl = $('.strip');
    this.goalsEl = $('.goals');
    this.cardEl = $('.word-card');
    this.movesEl = $('[data-moves]');
    this.scoreEl = $('[data-score]');
    this.hintsEl = $('[data-hints]');
    this.meterFill = $('.meter-fill');
    this.btn = {
      hint: $('[data-act="hint"]'),
      shuffle: $('[data-act="shuffle"]'),
      clear: $('[data-act="clear"]'),
      submit: $('[data-act="submit"]'),
    };
    this.buildWells();
  }

  buildWells() {
    let wells = '';
    let frames = '';
    for (let r = 0; r < this.R; r++) {
      for (let c = 0; c < this.C; c++) {
        const jelly = this.run.jelly[r][c] > 0;
        wells += `<div class="well${(r + c) % 2 ? ' alt' : ''}${jelly ? ' jelly' : ''}" data-r="${r}" data-c="${c}"></div>`;
        if (jelly) frames += `<div class="frame" data-r="${r}" data-c="${c}" style="--x:${c};--y:${r}"></div>`;
      }
    }
    this.wellsEl.innerHTML = wells;
    this.framesEl.innerHTML = frames;
  }

  bind() {
    this.root.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      this.sfx.unlock();
      if (act === 'exit') this.onExit(this);
      if (act === 'hint') this.showHint();
      if (act === 'shuffle') this.manualShuffle();
      if (act === 'clear') this.clearChain(true);
      if (act === 'submit') this.submit();
      if (act === 'say') this.say(e.target.closest('[data-say]')?.dataset.say);
    });
    const b = this.boardEl;
    b.addEventListener('pointerdown', e => this.onDown(e));
    b.addEventListener('pointermove', e => this.onMove(e));
    b.addEventListener('pointerup', e => this.onUp(e));
    b.addEventListener('pointercancel', () => this.cancelPointer());
    b.addEventListener('contextmenu', e => e.preventDefault());
    b.addEventListener('keydown', e => this.onKey(e));
    b.addEventListener('blur', () => this.renderCursor());
    this.resizeObs = new ResizeObserver(() => this.layout());
    this.resizeObs.observe(this.root);
  }

  destroy() {
    this.resizeObs?.disconnect();
    clearTimeout(this.idleTimer);
    cancelAnimationFrame(this.raf);
    globalThis.speechSynthesis?.cancel?.();
  }

  // Fits the board into the height the other rows leave free. Very short
  // screens keep a playable minimum width and scroll instead.
  layout() {
    const game = this.gameEl;
    const cs = getComputedStyle(game);
    const w = game.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const rows = [...game.children].filter(el => el !== this.frameEl && !el.hidden && getComputedStyle(el).position !== 'absolute');
    const gap = parseFloat(cs.rowGap) || 0;
    const fcs = getComputedStyle(this.frameEl);
    const used =
      rows.reduce((a, el) => a + el.offsetHeight, 0) +
      gap * rows.length +
      parseFloat(cs.paddingTop) +
      parseFloat(cs.paddingBottom) +
      parseFloat(fcs.paddingTop) +
      parseFloat(fcs.paddingBottom) +
      20;
    const h = this.root.clientHeight - used;
    if (w <= 0) return;
    const ratio = this.C / (this.R * CELL_ASPECT);
    const width = Math.floor(Math.min(w, 560, Math.max(h * ratio, Math.min(w, 300))));
    const height = Math.floor(width / ratio);
    const cell = width / this.C;
    Object.assign(this.boardEl.style, { width: `${width}px`, height: `${height}px` });
    this.boardEl.style.setProperty('--cell', `${cell}px`);
    this.cellW = cell;
    this.cellH = height / this.R;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.fx.width = Math.round(width * dpr);
    this.fx.height = Math.round(height * dpr);
    this.fx.style.width = `${width}px`;
    this.fx.style.height = `${height}px`;
    this.fxScale = dpr;
  }

  // ---------------------------------------------------------------- tiles

  makeEl(tile) {
    const el = document.createElement('div');
    el.className = `tile c-${tile.cls}${tile.special ? ` sp sp-${tile.special}` : ''}`;
    el.dataset.id = tile.id;
    el.dataset.word = tile.word;
    el.setAttribute('aria-label', tile.special ? `${tile.word}, ${SPECIAL_NAME[tile.special]}` : tile.word);
    const { html, fs } = tileContent(tile.word);
    el.style.setProperty('--fs', fs.toFixed(3));
    const badge = tile.special ? `<i class="sp-badge" title="${SPECIAL_NAME[tile.special]}">${ICON[tile.special === 'star' ? 'star' : tile.special]}</i>` : '';
    el.innerHTML = `<div class="candy">${html}${badge}</div><i class="order"></i>`;
    this.els.set(tile.id, el);
    this.tilesEl.append(el);
    return el;
  }

  place(el, r, c, fallMs = 0) {
    el.style.setProperty('--fall', `${fallMs}ms`);
    el.style.setProperty('--x', c);
    el.style.setProperty('--y', r);
  }

  // Puts every DOM tile where the grid says, creating and removing as needed.
  syncTiles(animate = true) {
    const live = new Set();
    for (const [r, c, t] of this.run.board.tiles()) {
      live.add(t.id);
      let el = this.els.get(t.id);
      if (!el) {
        el = this.makeEl(t);
        this.place(el, animate ? -1 : r, c, 0);
        if (animate) {
          void el.offsetWidth;
          this.place(el, r, c, 420);
        }
      } else this.place(el, r, c, animate ? 420 : 0);
    }
    for (const [id, el] of this.els) {
      if (!live.has(id)) {
        el.remove();
        this.els.delete(id);
      }
    }
  }

  tileAt([r, c]) {
    return this.run.board.grid[r]?.[c] || null;
  }

  elAt(cell) {
    const t = this.tileAt(cell);
    return t ? this.els.get(t.id) : null;
  }

  // ---------------------------------------------------------------- input

  cellAt(x, y, strict) {
    const rect = this.boardEl.getBoundingClientRect();
    const fx = ((x - rect.left) / rect.width) * this.C;
    const fy = ((y - rect.top) / rect.height) * this.R;
    const c = Math.floor(fx);
    const r = Math.floor(fy);
    if (r < 0 || r >= this.R || c < 0 || c >= this.C) return null;
    // While dragging, only count the inner part of a tile so diagonal moves
    // don't clip the neighbouring tiles.
    if (strict) {
      const dx = fx - c - 0.5;
      const dy = fy - r - 0.5;
      if (dx * dx + dy * dy > 0.4 * 0.4) return null;
    }
    return [r, c];
  }

  indexInChain(cell) {
    return this.chain.findIndex(x => sameCell(x, cell));
  }

  onDown(e) {
    if (e.button > 0) return;
    this.sfx.unlock();
    this.bumpIdle();
    if (this.busy || this.run.state !== 'play') return;
    const cell = this.cellAt(e.clientX, e.clientY, false);
    if (!cell || !this.tileAt(cell)) return;
    e.preventDefault();
    this.boardEl.setPointerCapture?.(e.pointerId);
    this.clearHint();
    const p = { id: e.pointerId, moved: false, start: cell, tapSubmit: false, card: false };
    p.timer = setTimeout(() => {
      if (this.pointer === p && !p.moved) {
        p.card = true;
        this.showWordCard(cell);
      }
    }, 480);
    this.pointer = p;
    const last = this.chain[this.chain.length - 1];
    const idx = this.indexInChain(cell);
    if (this.chain.length >= 2 && sameCell(cell, last)) p.tapSubmit = true;
    else if (idx >= 0) this.setChain(this.chain.slice(0, idx + 1));
    else if (last && isAdjacent(last, cell)) this.setChain([...this.chain, cell]);
    else this.setChain([cell]);
  }

  onMove(e) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id || p.card) return;
    const cell = this.cellAt(e.clientX, e.clientY, true);
    if (!cell || !this.tileAt(cell)) return;
    if (!p.moved && sameCell(cell, p.start)) return;
    if (!p.moved) {
      p.moved = true;
      clearTimeout(p.timer);
    }
    const idx = this.indexInChain(cell);
    if (idx >= 0) {
      if (idx === this.chain.length - 2) this.setChain(this.chain.slice(0, -1));
      return;
    }
    const last = this.chain[this.chain.length - 1];
    if (last && isAdjacent(last, cell)) this.setChain([...this.chain, cell]);
  }

  onUp(e) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) return;
    clearTimeout(p.timer);
    this.pointer = null;
    if (p.card) {
      this.hideWordCard();
      return;
    }
    if (p.tapSubmit && !p.moved) this.submit();
    else if (p.moved && this.chain.length >= 2) this.submit();
  }

  cancelPointer() {
    if (!this.pointer) return;
    clearTimeout(this.pointer.timer);
    this.pointer = null;
    this.hideWordCard();
  }

  onKey(e) {
    const k = e.key;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    this.keyboard = true;
    this.sfx.unlock();
    this.bumpIdle();
    if (moves[k]) {
      e.preventDefault();
      const [dr, dc] = moves[k];
      const cur = this.cursor || [this.R - 1, 0];
      this.moveCursor([Math.max(0, Math.min(this.R - 1, cur[0] + dr)), Math.max(0, Math.min(this.C - 1, cur[1] + dc))]);
      return;
    }
    if (this.busy || this.run.state !== 'play') return;
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      const cur = this.cursor;
      if (!cur) return;
      const last = this.chain[this.chain.length - 1];
      if (k === 'Enter' && this.chain.length >= 2 && (sameCell(cur, last) || this.indexInChain(cur) >= 0)) return this.submit();
      if (this.indexInChain(cur) >= 0) return;
      if (!last || isAdjacent(last, cur)) this.setChain([...this.chain, cur]);
      else this.setChain([cur]);
    } else if (k === 'Backspace') {
      e.preventDefault();
      this.setChain(this.chain.slice(0, -1));
    } else if (k === 'Escape') {
      this.clearChain(true);
    } else if (k === 'h' || k === 'H') {
      this.showHint();
    }
  }

  moveCursor(cell) {
    this.cursor = cell;
    this.renderCursor();
  }

  renderCursor() {
    this.tilesEl.querySelector('.cursor')?.classList.remove('cursor');
    if (this.keyboard && document.activeElement === this.boardEl && this.cursor) this.elAt(this.cursor)?.classList.add('cursor');
  }

  setChain(cells) {
    const grew = cells.length > this.chain.length;
    this.chain = cells;
    if (grew) this.sfx.select(cells.length - 1);
    this.renderChain();
  }

  clearChain(resetStrip = false) {
    this.chain = [];
    this.renderChain();
    if (resetStrip) this.stripIdle();
  }

  renderChain() {
    for (const el of this.tilesEl.querySelectorAll('.tile.sel')) {
      el.classList.remove('sel');
      el.querySelector('.order').textContent = '';
    }
    this.chain.forEach((cell, i) => {
      const el = this.elAt(cell);
      if (!el) return;
      el.classList.add('sel');
      el.querySelector('.order').textContent = i + 1;
    });
    const pts = this.chain.map(([r, c]) => `${c + 0.5},${r + 0.5}`).join(' ');
    this.trailBack.setAttribute('points', pts);
    this.trailFront.setAttribute('points', pts);
    this.btn.clear.disabled = !this.chain.length;
    this.btn.submit.disabled = this.chain.length < 2;
    if (this.chain.length) this.stripBuilding();
    else if (this.stripMode === 'building') this.stripIdle();
  }

  // ---------------------------------------------------------------- strip

  setStrip(mode, html) {
    this.stripMode = mode;
    this.stripEl.dataset.mode = mode;
    this.stripEl.innerHTML = html;
  }

  stripIdle() {
    const first = this.run.sentences.length === 0;
    this.setStrip(
      'idle',
      `<p class="strip-lead">${first ? 'Ziehe über benachbarte Wörter, um einen Satz zu bauen.' : 'Nächster Satz?'}</p>
       <p class="strip-sub">${first ? 'Drag across touching tiles, diagonals count. Hold a tile to see what the word is.' : 'Long sentences leave special tiles behind.'}</p>`,
    );
  }

  stripBuilding() {
    const words = this.run.wordsAt(this.chain);
    const res = this.chain.length >= 2 ? analyze(words) : null;
    const chips = words.map(w => miniTile(w)).join('');
    let status = '<span class="strip-status">…</span>';
    let sub = this.chain.length < 2 ? 'Keep going: a sentence needs at least two words.' : 'Not a sentence yet. Release or press Prüfen to check it.';
    if (res?.ok) {
      status = `<span class="strip-status ok">${ICON.check}</span>`;
      sub = `<span class="ok-text">Satz komplett!</span> ≈ ${esc(toEnglish(res.parse))}`;
    }
    this.setStrip('building', `<div class="strip-row">${chips}${status}</div><p class="strip-sub">${sub}</p>`);
  }

  stripValid(result) {
    const { info, points, feats, comboMult } = result;
    const german = formatSentence(info.words, !!info.question);
    const chips = info.picks
      .map((p, i) => `<span class="mini role c-${wordClass(p.text)}"><b>${esc(i === 0 ? cap(p.text) : p.text)}</b><small>${ROLE(p, info)}</small></span>`)
      .join('');
    const tags = feats.map(f => `<span class="tag${f.bonus ? ' bonus' : ''}">${esc(f.label)}${f.bonus ? ` +${Math.round(f.bonus * 100)}%` : ''}</span>`).join('');
    const combo = comboMult > 1 ? `<span class="tag combo">Kombo ×${comboMult.toFixed(1)}</span>` : '';
    this.setStrip(
      'valid',
      `<div class="strip-row" aria-label="${esc(german)}">${chips}<span class="punct">${info.question ? '?' : '.'}</span></div>
       <p class="strip-en"><button class="say" data-act="say" data-say="${esc(german)}" aria-label="Vorlesen: ${esc(german)}">${ICON.speaker}</button><span>≈ ${esc(toEnglish(info))}</span></p>
       <div class="strip-tags"><div class="tags">${tags}${combo}</div><span class="points">+${points}</span></div>`,
    );
    return german;
  }

  stripInvalid(words, error) {
    const ex = explain(error);
    const better = suggest(words);
    const chips = words.map((w, i) => miniTile(w, wordClass(w), i === ex.at ? ' bad' : '')).join('');
    this.setStrip(
      'invalid',
      `<div class="strip-row">${chips}</div>
       <p class="strip-sentence"><b class="bad-title">${esc(ex.title)}</b> ${esc(ex.text)}</p>
       ${better ? `<p class="strip-sub">Richtig wäre: <button class="say inline" data-act="say" data-say="${esc(better)}">${esc(better)}</button></p>` : ''}`,
    );
    return ex;
  }

  say(text) {
    if (text && this.settings.speech) speak(text);
  }

  // ---------------------------------------------------------------- HUD

  updateHud(animate = true) {
    const run = this.run;
    this.movesEl.textContent = this.free ? '∞' : run.movesLeft;
    this.movesEl.parentElement.classList.toggle('low', !this.free && run.movesLeft <= 3);
    this.hintsEl.textContent = run.hints;
    this.btn.hint.disabled = run.hints <= 0;
    this.countScore(run.score, animate);
    if (this.meterFill) {
      const [, two, three] = this.level.stars;
      this.meterFill.style.width = `${Math.min(100, (run.score / three) * 100)}%`;
      const two$ = this.root.querySelector('[data-star="1"]');
      const three$ = this.root.querySelector('[data-star="2"]');
      two$.style.left = `${(two / three) * 100}%`;
      three$.style.left = '100%';
      two$.classList.toggle('lit', run.score >= two);
      three$.classList.toggle('lit', run.score >= three);
    }
    if (this.free) {
      this.goalsEl.innerHTML = `<li class="goal"><span>Sätze</span><b>${run.sentences.length}</b></li><li class="goal"><span>Beste Kombo</span><b>${run.bestCombo}</b></li>`;
    } else {
      this.goalsEl.innerHTML = run.goals
        .map(g => {
          const done = g.have >= g.need;
          return `<li class="goal${done ? ' done' : ''}${g.type === 'jelly' ? ' jelly' : ''}"><span>${esc(g.label)}</span><b>${done ? ICON.check : `${g.have}/${g.need}`}</b></li>`;
        })
        .join('');
    }
  }

  countScore(to, animate) {
    const from = this.shownScore;
    this.shownScore = to;
    if (!animate || reducedMotion() || from === to) {
      this.scoreEl.textContent = to;
      return;
    }
    const t0 = performance.now();
    const tick = t => {
      const k = Math.min(1, (t - t0) / 550);
      this.scoreEl.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1 && this.shownScore === to) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- moves

  async submit() {
    if (this.busy || this.run.state !== 'play') return;
    if (this.chain.length < 2) return;
    this.bumpIdle();
    const cells = this.chain.slice();
    const words = this.run.wordsAt(cells);
    // The engine changes the grid right away; keep the tiles as they were for the animation.
    const before = new Map([...this.run.board.tiles()].map(([, , t]) => [t.id, t]));
    const chainTiles = cells.map(c => this.tileAt(c));
    this.busy = true;
    const result = this.run.play(cells);
    if (!result.ok) {
      await this.rejectMove(cells, words, result.res.error);
      this.busy = false;
      return;
    }
    await this.resolveMove(cells, chainTiles, before, result);
    this.busy = false;
    if (this.run.state !== 'play') this.finish();
    else this.armIdleHint();
  }

  async rejectMove(cells, words, error) {
    this.sfx.invalid();
    const ex = this.stripInvalid(words, error);
    const els = cells.map(c => this.elAt(c));
    els.forEach((el, i) => el?.classList.add('shake', ...(i === ex.at ? ['err'] : [])));
    this.boardEl.classList.add('rejected');
    await sleep(reducedMotion() ? 150 : 420);
    els.forEach(el => el?.classList.remove('shake', 'err'));
    this.boardEl.classList.remove('rejected');
    this.chain = [];
    this.renderChain();
    this.updateHud();
  }

  async resolveMove(cells, chainTiles, before, result) {
    const quick = reducedMotion();
    const german = this.stripValid(result);
    this.log.push({ german, english: toEnglish(result.info), points: result.points });
    this.say(german);
    this.sfx.valid(cells.length);
    this.chain = [];
    this.trailBack.setAttribute('points', '');
    this.trailFront.setAttribute('points', '');
    this.btn.clear.disabled = true;
    this.btn.submit.disabled = true;

    // 1. Pop the sentence, word by word.
    const chainIds = new Set(chainTiles.map(t => t.id));
    for (const [i, cell] of cells.entries()) {
      const tile = chainTiles[i];
      const el = this.els.get(tile.id);
      if (!el) continue;
      el.classList.remove('sel');
      el.classList.add('pop');
      this.burst(cell[0], cell[1], tile.cls, quick ? 4 : 12);
      this.sfx.pop(i);
      if (!quick) await sleep(70);
    }

    // 2. Special tiles go off.
    if (result.blasts.length) {
      this.sfx.blast();
      for (const b of result.blasts) this.showBlast(b);
      await sleep(quick ? 60 : 260);
      for (const x of result.removed) {
        if (chainIds.has(x.id)) continue;
        this.els.get(x.id)?.classList.add('pop');
        this.burst(x.r, x.c, before.get(x.id)?.cls || 'adv', quick ? 2 : 6);
      }
    }

    // 3. Jelly.
    for (const j of result.jellyHits) {
      if (j.left > 0) continue;
      const at = `[data-r="${j.r}"][data-c="${j.c}"]`;
      this.wellsEl.querySelector(at)?.classList.remove('jelly');
      const frame = this.framesEl.querySelector(at);
      frame?.classList.add('gone');
      setTimeout(() => frame?.remove(), 520);
    }

    this.updateHud();
    this.praise(result);
    await sleep(quick ? 80 : 240);
    for (const x of result.removed) {
      this.els.get(x.id)?.remove();
      this.els.delete(x.id);
    }

    // 4. A long sentence leaves a special tile where it ended.
    if (result.created) {
      const { tile } = result.created;
      const el = this.makeEl(tile);
      this.place(el, result.created.r, result.created.c, 0);
      el.classList.add('born');
      this.sfx.special();
      this.flashNote(`${SPECIAL_NAME[tile.special]}!`, tile.special === 'bomb' ? '5 Wörter' : tile.special === 'star' ? '6+ Wörter' : '4 Wörter');
    }

    // 5. Gravity and refill.
    let longest = 0;
    for (const m of result.moves) {
      const el = this.els.get(m.id);
      if (!el) continue;
      const ms = quick ? 120 : 260 + (m.r - m.from) * 70;
      longest = Math.max(longest, ms);
      this.place(el, m.r, m.c, ms);
    }
    for (const s of result.spawned) {
      const el = this.makeEl(s.tile);
      this.place(el, s.from, s.c, 0);
    }
    void this.tilesEl.offsetWidth;
    for (const s of result.spawned) {
      const el = this.els.get(s.tile.id);
      const ms = quick ? 140 : 320 + (s.r - s.from) * 60;
      longest = Math.max(longest, ms);
      this.place(el, s.r, s.c, ms);
    }
    await sleep(longest + 40);

    if (result.shuffled) {
      this.flashNote('Gemischt!', 'No sentence was left on the board.');
      await sleep(quick ? 100 : 500);
      this.syncTiles(true);
      await sleep(450);
    }
    this.updateHud();
  }

  showBlast(b) {
    const el = document.createElement('div');
    el.className = `blast blast-${b.type}`;
    el.style.setProperty('--x', b.c);
    el.style.setProperty('--y', b.r);
    this.blastsEl.append(el);
    setTimeout(() => el.remove(), 700);
  }

  praise(result) {
    const extra = result.extra > 0 ? 160 : 0;
    const hit = PRAISE.find(([min]) => result.points + extra >= min);
    if (!hit) return;
    const el = document.createElement('span');
    el.textContent = hit[1];
    this.praiseEl.replaceChildren(el);
    setTimeout(() => el.remove(), 1300);
  }

  flashNote(title, sub) {
    const el = document.createElement('span');
    el.className = 'note';
    el.innerHTML = `<b>${esc(title)}</b><small>${esc(sub)}</small>`;
    this.praiseEl.append(el);
    setTimeout(() => el.remove(), 1500);
  }

  // ---------------------------------------------------------------- particles

  burst(r, c, cls, n) {
    if (!n) return;
    const color = getComputedStyle(this.boardEl).getPropertyValue(`--c-${cls}`).trim() || '#e0314b';
    const x = (c + 0.5) * this.cellW;
    const y = (r + 0.5) * this.cellH;
    const palette = [color, '#ffffff', '#ffd23f', '#ff7fb3'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1.5 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 2,
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        color: palette[i % palette.length],
        w: 3 + Math.random() * 3,
        h: 7 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
      });
    }
    if (!this.raf) this.raf = requestAnimationFrame(() => this.tickFx());
  }

  tickFx() {
    const ctx = this.fx.getContext('2d');
    const s = this.fxScale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, this.fx.width, this.fx.height);
    this.particles = this.particles.filter(p => p.life > 0);
    for (const p of this.particles) {
      p.vy += 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.decay;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, p.w / 2);
      else ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.fill();
      ctx.restore();
    }
    this.raf = this.particles.length ? requestAnimationFrame(() => this.tickFx()) : 0;
  }

  // ---------------------------------------------------------------- helpers

  showHint() {
    if (this.busy || this.run.state !== 'play') return;
    const best = this.run.hint();
    this.updateHud(false);
    if (!best) {
      this.flashNote('Kein Tipp', this.run.hints <= 0 ? 'No hints left in this level.' : 'Try shuffling the board.');
      return;
    }
    this.clearChain();
    this.markHint(best.cells, true);
    this.setStrip(
      'hint',
      `<p class="strip-lead">Tipp: folge den wackelnden Bonbons.</p><p class="strip-sub">Start at <b>${esc(this.tileAt(best.cells[0]).word)}</b> and follow the numbers.</p>`,
    );
  }

  markHint(cells, numbered) {
    this.clearHint();
    this.hintCells = cells;
    cells.forEach((cell, i) => {
      const el = this.elAt(cell);
      if (!el) return;
      el.classList.add('hint');
      el.style.setProperty('--hint-delay', `${i * 90}ms`);
      if (numbered) el.querySelector('.order').textContent = i + 1;
    });
    const pts = cells.map(([r, c]) => `${c + 0.5},${r + 0.5}`).join(' ');
    if (numbered) {
      this.trailBack.setAttribute('points', pts);
      this.trailFront.setAttribute('points', pts);
      this.boardEl.classList.add('hinting');
    }
  }

  clearHint() {
    if (!this.hintCells) return;
    for (const el of this.tilesEl.querySelectorAll('.tile.hint')) {
      el.classList.remove('hint');
      if (!el.classList.contains('sel')) el.querySelector('.order').textContent = '';
    }
    this.boardEl.classList.remove('hinting');
    this.hintCells = null;
    if (!this.chain.length) {
      this.trailBack.setAttribute('points', '');
      this.trailFront.setAttribute('points', '');
    }
  }

  // After a long pause, two tiles of a valid sentence wiggle (free, unlike Tipp).
  armIdleHint() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.busy || this.chain.length || this.run.state !== 'play' || this.hintCells) return this.armIdleHint();
      const found = findSentences(this.run.board.grid, { stopEarly: true, budgetMs: 60 });
      if (found[0]) {
        this.markHint(found[0].cells.slice(0, 2), false);
        setTimeout(() => this.clearHint(), 2600);
      }
      this.armIdleHint();
    }, 20000);
  }

  bumpIdle() {
    this.armIdleHint();
  }

  async manualShuffle() {
    if (this.busy || this.run.state !== 'play') return;
    this.busy = true;
    this.clearChain();
    this.clearHint();
    this.run.shuffleBoard();
    this.flashNote('Gemischt!', this.free ? 'Shuffling is free here.' : 'That cost one move.');
    this.syncTiles(true);
    this.updateHud();
    await sleep(480);
    this.busy = false;
    if (this.run.state !== 'play') this.finish();
  }

  showWordCard(cell) {
    const tile = this.tileAt(cell);
    const el = this.elAt(cell);
    if (!tile || !el) return;
    const lines = describe(tile.word);
    const special = tile.special ? `<p class="wc-special">${SPECIAL_NAME[tile.special]}: use it in a sentence to clear ${tile.special === 'bomb' ? 'the tiles around it' : tile.special === 'star' ? 'its row and column' : `its whole ${tile.special === 'row' ? 'row' : 'column'}`}.</p>` : '';
    this.cardEl.innerHTML = `<p class="wc-word">${miniTile(tile.word, tile.cls)}<span>${CLASS_LABELS[tile.cls]}</span></p><ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>${special}`;
    this.cardEl.hidden = false;
    const g = this.gameEl.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    const card = this.cardEl.getBoundingClientRect();
    const left = Math.max(8, Math.min(g.width - card.width - 8, t.left - g.left + t.width / 2 - card.width / 2));
    const above = t.top - g.top - card.height - 10;
    const top = above > 8 ? above : t.bottom - g.top + 10;
    this.cardEl.style.left = `${left}px`;
    this.cardEl.style.top = `${top}px`;
    this.clearChain(true);
    this.say(tile.word);
  }

  hideWordCard() {
    this.cardEl.hidden = true;
  }

  async finish() {
    const run = this.run;
    clearTimeout(this.idleTimer);
    if (run.state === 'won') {
      if (run.bonus > 0) {
        this.flashNote('Zuckerrausch!', `+${run.bonus} for ${run.bonus / 100} moves left`);
        this.updateHud();
      }
      this.sfx.win();
      await sleep(1300);
    } else if (run.state === 'lost') {
      this.sfx.lose();
      this.flashNote('Keine Züge mehr', 'Out of moves.');
      await sleep(1100);
    }
    this.onEnd({ level: this.level, run, log: this.log });
  }
}
