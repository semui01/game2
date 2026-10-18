import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, FREE_PLAY } from '../js/levels.js';
import { Run } from '../js/engine.js';
import { analyze, explain } from '../js/grammar.js';
import { LEX } from '../js/lexicon.js';
import { mulberry32 } from '../js/util.js';

test('every spawn word exists and every example is a valid sentence', () => {
  for (const level of [...LEVELS, FREE_PLAY]) {
    for (const g of level.spawn) for (const w of g.words) assert.ok(LEX.has(w), `L${level.id}: unknown word «${w}»`);
    for (const [words] of level.examples) {
      const r = analyze(words);
      assert.ok(r.ok, `L${level.id} example «${words.join(' ')}»: ${r.ok ? '' : explain(r.error).text}`);
    }
    for (const row of level.jelly || []) assert.equal(row.length, level.cols, `L${level.id} jelly row width`);
  }
});

test('each level example shows the level’s own topic', () => {
  for (const level of LEVELS) {
    const goals = level.goals.filter(g => g.type === 'sentences');
    for (const g of goals) {
      const hit = level.examples.some(([words]) => {
        const r = analyze(words);
        return r.ok && g.test(r.parse);
      });
      assert.ok(hit, `L${level.id} has no example for goal «${g.label}»`);
    }
  }
});

// A bot that always plays the most useful sentence it can find.
function playLevel(level, seed) {
  const run = new Run(level, { rng: mulberry32(seed) });
  for (let guard = 0; run.state === 'play' && guard < 60; guard++) {
    const best = run.bestMoves({ limit: 60, budgetMs: 400 });
    if (!best.length) run.shuffleBoard();
    else run.play(best[0].cells);
  }
  return run;
}

test('a good player can win every level', () => {
  for (const level of LEVELS) {
    const wins = [11, 22, 33].map(seed => playLevel(level, seed)).filter(r => r.state === 'won').length;
    assert.ok(wins >= 2, `L${level.id} ${level.topic}: bot won only ${wins}/3`);
  }
});

test('long sentences leave special tiles, and specials clear more', () => {
  const level = LEVELS[0];
  const run = new Run(level, { rng: mulberry32(5) });
  const long = run.bestMoves({ limit: 200, budgetMs: 800 }).find(m => m.cells.length >= 4);
  assert.ok(long, 'board offers a 4+ word sentence');
  const res = run.play(long.cells);
  assert.ok(res.ok && res.created, 'a special tile was created');
  assert.ok(['row', 'col', 'bomb', 'star'].includes(res.created.tile.special));
  assert.equal(run.board.grid.flat().filter(Boolean).length, level.rows * level.cols, 'board refilled');
});

test('invalid attempts cost no move but reset the combo', () => {
  const run = new Run(LEVELS[0], { rng: mulberry32(9) });
  const before = run.movesLeft;
  const grid = run.board.grid;
  let bad = null;
  for (let c = 0; c + 1 < run.board.cols && !bad; c++) {
    const cells = [[0, c], [0, c + 1]];
    if (!analyze(cells.map(([r, k]) => grid[r][k].word)).ok) bad = cells;
  }
  assert.ok(bad);
  const res = run.play(bad);
  assert.equal(res.ok, false);
  assert.equal(run.movesLeft, before);
  assert.equal(run.combo, 0);
});

test('a run survives a snapshot round trip', () => {
  const run = new Run(LEVELS[6], { rng: mulberry32(3) });
  const m = run.bestMoves()[0];
  run.play(m.cells);
  const copy = Run.restore(LEVELS[6], JSON.parse(JSON.stringify(run.serialize())));
  assert.equal(copy.score, run.score);
  assert.equal(copy.movesLeft, run.movesLeft);
  assert.deepEqual(copy.board.grid.map(row => row.map(t => t.word)), run.board.grid.map(row => row.map(t => t.word)));
  assert.deepEqual(copy.goals.map(g => g.have), run.goals.map(g => g.have));
});
