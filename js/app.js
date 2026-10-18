// App shell: lesson map, level intro, results, how-to, settings and saved progress.

import { LEVELS, FREE_PLAY } from './levels.js';
import { GameView, ICON, esc, miniTile } from './game.js';
import { Sfx, canSpeak, speak } from './audio.js';
import { CLASS_LABELS } from './lexicon.js';
import { analyze, formatSentence } from './grammar.js';

const STORE_KEY = 'wortkonfekt.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    // Private windows can refuse storage; progress then lasts for this visit.
  }
}

const levelById = id => (id === FREE_PLAY.id ? FREE_PLAY : LEVELS.find(l => l.id === id));

const tileRow = words => `<span class="tile-row">${words.map(w => miniTile(w)).join('')}</span>`;

const stars = (n, cls = '') => `<span class="stars ${cls}" aria-label="${n} von 3 Sternen">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}">${ICON.star}</i>`).join('')}</span>`;

export class App {
  constructor(root, boot = {}) {
    this.root = root;
    const stored = load();
    this.data = {
      progress: boot.progress || stored.progress || {},
      settings: { sound: true, speech: canSpeak(), ...(stored.settings || {}), ...(boot.settings || {}) },
      freeBest: boot.freeBest ?? stored.freeBest ?? 0,
    };
    this.sfx = new Sfx();
    this.sfx.on = this.data.settings.sound;
    this.view = null;
    this.modal = document.createElement('div');
    this.modal.className = 'modal';
    this.modal.hidden = true;
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    document.body.append(this.modal);
    this.modal.addEventListener('click', e => this.onModalClick(e));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !this.modal.hidden && this.modal.dataset.dismiss !== 'no') this.closeModal();
    });
    this.root.addEventListener('click', e => this.onClick(e));
    if (boot.game && levelById(boot.game.levelId)) this.startLevel(levelById(boot.game.levelId), boot.game);
    else this.showMap();
  }

  persist() {
    save(this.data);
  }

  snapshot() {
    return { ...this.data, game: this.view && this.view.run.state === 'play' ? this.view.snapshot() : null };
  }

  unlocked(level) {
    return level.id === 1 || (this.data.progress[level.id - 1]?.stars || 0) > 0;
  }

  nextLevel() {
    return LEVELS.find(l => this.unlocked(l) && !(this.data.progress[l.id]?.stars > 0)) || LEVELS[LEVELS.length - 1];
  }

  // ------------------------------------------------------------------ map

  showMap() {
    this.view?.destroy();
    this.view = null;
    document.body.dataset.screen = 'map';
    const next = this.nextLevel();
    const total = LEVELS.reduce((a, l) => a + (this.data.progress[l.id]?.stars || 0), 0);
    const demo = ['gestern', 'habe', 'ich', 'Pizza', 'gegessen'];
    const s = this.data.settings;
    this.root.innerHTML = `
      <div class="map">
        <header class="hero">
          <div class="hero-bar">
            <span class="eyebrow">Deutsch lernen · Satz für Satz</span>
            <div class="toggles">
              <button class="toggle${s.sound ? ' on' : ''}" data-act="sound" aria-pressed="${s.sound}">Ton</button>
              ${canSpeak() ? `<button class="toggle${s.speech ? ' on' : ''}" data-act="speech" aria-pressed="${s.speech}">Vorlesen</button>` : ''}
            </div>
          </div>
          <h1 class="logo">Wortkonfekt</h1>
          <p class="tagline">German words drop in like sweets. Link touching tiles into real sentences: the right ending, case and word order make them pop.</p>
          <div class="demo" aria-label="Beispiel: Gestern habe ich Pizza gegessen.">
            ${demo.map((w, i) => `<span class="demo-tile" style="--i:${i}">${miniTile(w)}</span>`).join('')}
          </div>
          <p class="demo-en">Gestern habe ich Pizza gegessen. <span>≈ Yesterday I ate pizza.</span></p>
          <div class="hero-actions">
            <button class="btn primary" data-act="play" data-id="${next.id}">${this.data.progress[1] ? `Weiter: Lektion ${next.id}` : 'Los geht’s'}</button>
            <button class="btn" data-act="howto">So geht’s</button>
          </div>
        </header>

        <section class="lessons" aria-labelledby="lessons-h">
          <div class="section-head">
            <h2 id="lessons-h">Lektionen</h2>
            <span class="total">${ICON.star}<b>${total}</b>/${LEVELS.length * 3}</span>
          </div>
          <ol class="path">
            ${LEVELS.map((l, i) => {
              const p = this.data.progress[l.id];
              const open = this.unlocked(l);
              const state = p?.stars ? 'done' : open ? 'open' : 'locked';
              return `<li class="node ${state}${l.id === next.id ? ' current' : ''}${i % 2 ? ' right' : ''}">
                <button class="bonbon" data-act="play" data-id="${l.id}" ${open ? '' : 'disabled'} aria-label="Lektion ${l.id}: ${esc(l.topic)}${open ? '' : ' (gesperrt)'}">
                  <span>${l.id}</span>
                </button>
                <div class="node-text">
                  <span class="eyebrow">${esc(l.topic)}</span>
                  <span class="node-title">${esc(l.title)}</span>
                  ${p?.stars ? stars(p.stars, 'small') : open ? '<span class="node-hint">Bereit</span>' : '<span class="node-hint">Erst die vorige Lektion</span>'}
                </div>
              </li>`;
            }).join('')}
          </ol>
        </section>

        <section class="free">
          <div>
            <h2>Freies Spiel</h2>
            <p>No move limit, every pattern counts. ${this.data.freeBest ? `Your best: <b>${this.data.freeBest}</b> points.` : 'Play for a high score.'}</p>
          </div>
          <button class="btn" data-act="play" data-id="frei">Spielen</button>
        </section>

        <footer class="map-foot">
          <div class="legend">${Object.entries(CLASS_LABELS).map(([cls, label]) => `<span class="legend-item"><i class="swatch c-${cls}"></i>${esc(label)}</span>`).join('')}</div>
          <button class="link" data-act="reset">Fortschritt zurücksetzen</button>
        </footer>
      </div>`;
  }

  onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || this.view) return;
    this.sfx.unlock();
    const act = btn.dataset.act;
    if (act === 'play') {
      const id = btn.dataset.id === 'frei' ? 'frei' : Number(btn.dataset.id);
      this.showIntro(levelById(id));
    } else if (act === 'howto') this.showHowTo();
    else if (act === 'sound' || act === 'speech') {
      this.data.settings[act] = !this.data.settings[act];
      this.sfx.on = this.data.settings.sound;
      this.persist();
      btn.classList.toggle('on', this.data.settings[act]);
      btn.setAttribute('aria-pressed', this.data.settings[act]);
      if (act === 'speech' && this.data.settings.speech) speak('Hallo!');
    } else if (act === 'reset') this.confirmReset();
  }

  // ------------------------------------------------------------------ modal

  openModal(html, { dismiss = true } = {}) {
    this.modal.innerHTML = `<div class="sheet">${html}</div>`;
    this.modal.dataset.dismiss = dismiss ? 'yes' : 'no';
    this.modal.hidden = false;
    requestAnimationFrame(() => this.modal.querySelector('.sheet [data-focus]')?.focus());
  }

  closeModal() {
    this.modal.hidden = true;
    this.modal.innerHTML = '';
  }

  onModalClick(e) {
    if (e.target === this.modal && this.modal.dataset.dismiss !== 'no') return this.closeModal();
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    this.sfx.unlock();
    const act = btn.dataset.act;
    const level = levelById(btn.dataset.id === 'frei' ? 'frei' : Number(btn.dataset.id));
    if (act === 'close') this.closeModal();
    if (act === 'start') {
      this.closeModal();
      this.startLevel(level);
    }
    if (act === 'retry') {
      this.closeModal();
      this.startLevel(level);
    }
    if (act === 'next') {
      this.closeModal();
      this.showIntro(level);
    }
    if (act === 'map') {
      this.closeModal();
      this.showMap();
    }
    if (act === 'resume') this.closeModal();
    if (act === 'quit') {
      this.closeModal();
      if (this.view?.free && this.view.run.sentences.length) this.endLevel({ level: this.view.level, run: this.view.run, log: this.view.log });
      else this.showMap();
    }
    if (act === 'say') speak(btn.dataset.say);
    if (act === 'reset-yes') {
      this.data.progress = {};
      this.data.freeBest = 0;
      this.persist();
      this.closeModal();
      this.showMap();
    }
  }

  showIntro(level) {
    const examples = level.examples
      .map(([words, en]) => {
        const r = analyze(words);
        const german = r.ok ? formatSentence(words, !!r.parse.question) : words.join(' ');
        return `<li>${tileRow(words)}<button class="say inline" data-act="say" data-say="${esc(german)}">${ICON.speaker}<span>${esc(german)}</span></button><span class="en">${esc(en)}</span></li>`;
      })
      .join('');
    const goals = level.goals.length
      ? level.goals
          .map(g => {
            if (g.type === 'jelly') {
              const n = (level.jelly || []).join('').split('#').length - 1;
              return `<li><b>${n}</b> Gelee-Felder räumen</li>`;
            }
            if (g.type === 'score') return `<li><b>${g.target}</b> Punkte</li>`;
            return `<li><b>${g.count}</b> × ${esc(g.label)}</li>`;
          })
          .join('')
      : '<li>Keine Ziele: spiel einfach</li>';
    this.openModal(`
      <p class="eyebrow">${level.id === 'frei' ? 'Freies Spiel' : `Lektion ${level.id} · ${esc(level.topic)}`}</p>
      <h2 class="sheet-title">${esc(level.title)}</h2>
      <p class="sheet-intro">${esc(level.intro)}</p>
      ${examples ? `<ul class="examples">${examples}</ul>` : ''}
      <div class="sheet-goals">
        <div><span class="eyebrow">Ziel</span><ul>${goals}</ul></div>
        <div><span class="eyebrow">Züge</span><b class="big-num">${Number.isFinite(level.moves) ? level.moves : '∞'}</b></div>
      </div>
      <div class="sheet-actions">
        <button class="btn" data-act="close">Zurück</button>
        <button class="btn primary" data-act="start" data-id="${level.id}" data-focus>Los geht’s</button>
      </div>`);
  }

  showHowTo() {
    const shapes = Object.entries(CLASS_LABELS)
      .map(([cls, label]) => `<li><span class="mini c-${cls}">${esc({ pron: 'ich', noun: 'den Hund', verb: 'isst', aux: 'habe', end: 'gegessen', adv: 'gestern', adj: 'müde', wh: 'wo' }[cls])}</span>${esc(label)}</li>`)
      .join('');
    this.openModal(`
      <p class="eyebrow">So geht’s</p>
      <h2 class="sheet-title">How to play</h2>
      <ol class="steps">
        <li><b>Drag</b> across touching tiles (diagonals count) to link words into a German sentence, then let go. You can also tap tiles one by one and press <i>Prüfen</i>.</li>
        <li>A correct sentence pops. Its tiles disappear, the ones above fall down, and new words drop in. Each valid sentence uses one move.</li>
        <li>A wrong sentence costs nothing. You get an explanation and, where possible, the correct word order.</li>
        <li><b>Hold</b> a tile to see the word’s meaning, tense or case.</li>
      </ol>
      <h3>Word types</h3>
      <p class="sheet-intro">Colour and shape show the word type, not where it goes. Working that out is the game.</p>
      <ul class="shapes">${shapes}</ul>
      <h3>Special tiles</h3>
      <ul class="specials">
        <li><i class="sp-demo sp-row"></i><span><b>4 words</b> leave a line tile: use it to clear its row or column.</span></li>
        <li><i class="sp-demo sp-bomb"></i><span><b>5 words</b> leave a bomb: it clears the tiles around it.</span></li>
        <li><i class="sp-demo sp-star"></i><span><b>6+ words</b> leave a star: it clears its row and column.</span></li>
      </ul>
      <p class="sheet-intro">Bonus points for harder grammar: Perfekt, Präteritum, Futur, modal verbs, questions, inversion, negation, separable verbs and the passive. Moves you have left at the end turn into bonus points.</p>
      <div class="sheet-actions"><button class="btn primary" data-act="close" data-focus>Verstanden</button></div>`);
  }

  confirmReset() {
    this.openModal(`
      <h2 class="sheet-title">Fortschritt zurücksetzen?</h2>
      <p class="sheet-intro">This removes your stars and unlocked lessons on this device.</p>
      <div class="sheet-actions">
        <button class="btn" data-act="close" data-focus>Abbrechen</button>
        <button class="btn danger" data-act="reset-yes">Zurücksetzen</button>
      </div>`);
  }

  // ------------------------------------------------------------------ game

  startLevel(level, restore = null) {
    this.view?.destroy();
    document.body.dataset.screen = 'game';
    this.view = new GameView(this.root, {
      level,
      sfx: this.sfx,
      settings: this.data.settings,
      restore,
      onExit: view => this.askQuit(view),
      onEnd: result => this.endLevel(result),
    });
    this.view.boardEl.focus({ preventScroll: true });
  }

  askQuit(view) {
    if (!view.run.sentences.length) return this.showMap();
    this.openModal(`
      <h2 class="sheet-title">${view.free ? 'Spiel beenden?' : 'Lektion verlassen?'}</h2>
      <p class="sheet-intro">${view.free ? 'You’ll see your sentences and score.' : 'Your progress in this lesson will be lost.'}</p>
      <div class="sheet-actions">
        <button class="btn" data-act="resume" data-focus>Weiterspielen</button>
        <button class="btn primary" data-act="quit">${view.free ? 'Beenden' : 'Zur Karte'}</button>
      </div>`);
  }

  endLevel({ level, run, log }) {
    const won = run.state === 'won';
    const free = level.id === 'frei';
    const n = run.stars();
    let record = false;
    if (free) {
      record = run.score > this.data.freeBest;
      this.data.freeBest = Math.max(this.data.freeBest, run.score);
    } else if (won) {
      const p = this.data.progress[level.id] || { stars: 0, best: 0 };
      record = run.score > p.best;
      this.data.progress[level.id] = { stars: Math.max(p.stars, n), best: Math.max(p.best, run.score) };
    }
    this.persist();
    const next = !free && LEVELS.find(l => l.id === level.id + 1);
    const sentences = log
      .slice(-12)
      .reverse()
      .map(x => `<li><button class="say inline" data-act="say" data-say="${esc(x.german)}">${ICON.speaker}<span>${esc(x.german)}</span></button><span class="en">${esc(x.english)}</span><b>+${x.points}</b></li>`)
      .join('');
    const title = free ? 'Gut gespielt!' : won ? (n === 3 ? 'Ausgezeichnet!' : n === 2 ? 'Sehr gut!' : 'Geschafft!') : 'Keine Züge mehr';
    this.openModal(
      `
      <p class="eyebrow">${free ? 'Freies Spiel' : `Lektion ${level.id} · ${esc(level.topic)}`}</p>
      <h2 class="sheet-title">${title}</h2>
      ${free ? '' : stars(n, 'big')}
      <p class="result-score"><b>${run.score}</b> Punkte</p>
      ${record || run.bonus ? `<p class="result-tags">${record ? '<span class="tag bonus">Rekord</span>' : ''}${run.bonus ? `<span class="tag">Zuckerrausch +${run.bonus}</span>` : ''}</p>` : ''}
      ${!won && !free ? `<p class="sheet-intro">${run.goals.map(g => `${esc(g.label)}: ${g.have}/${g.need}`).join(' · ')}. Try again: shorter sentences of the target type are often the quickest way.</p>` : ''}
      ${sentences ? `<h3>Deine Sätze</h3><ul class="log">${sentences}</ul>` : ''}
      <div class="sheet-actions">
        <button class="btn" data-act="map">Karte</button>
        <button class="btn${won && next ? '' : ' primary'}" data-act="retry" data-id="${level.id}">Nochmal</button>
        ${won && next ? `<button class="btn primary" data-act="next" data-id="${next.id}" data-focus>Weiter</button>` : ''}
      </div>`,
      { dismiss: false },
    );
    this.view?.destroy();
    this.view = null;
    this.showMap();
  }
}
