# Wortkonfekt

A Candy-Crush-style game for learning German. Word tiles drop onto the board like sweets; drag across touching tiles to link them into a real German sentence. If the grammar is right, the sentence pops, the tiles above fall down and new words drop in. If it's wrong, you get an explanation of the mistake and, where possible, the correct word order.

```
 gestern ─ habe ─ ich ─ Pizza ─ gegessen   →  Gestern habe ich Pizza gegessen.  ≈ Yesterday I ate pizza.
 Adverb    Hilfsverb  Subjekt  Akkusativ  Partizip II              Perfekt +50% · Inversion +50%
```

## Play

- **Quickest:** `npm run build`, then open `dist/wortkonfekt.html` in a browser. It is one self-contained file and also works offline.
- **From source:** `npm start` (or any static server, e.g. `python3 -m http.server`) and open http://localhost:5173. The source uses ES modules, which browsers don't load from `file://`.
- It also works as a static site (e.g. GitHub Pages) straight from the repository root.

### How it works

- Drag across touching tiles (diagonals count) and let go. You can also tap tiles one by one and press **Prüfen**.
- Each valid sentence uses one move. Wrong sentences cost nothing but reset your combo.
- **Hold** a tile to see what the word is: meaning, tense, person, case, gender.
- Colour *and* shape show the word type (pronoun, noun, verb, helper/modal verb, participle/prefix, adverb, adjective, question word), so the game stays readable for colour-blind players.
- Long sentences leave special tiles, like striped candies: **4 words** → line (clears a row or column), **5** → bomb (clears 3×3), **6+** → star (row and column). Using a special in a later sentence sets it off.
- Pink **jelly** cells are cleared by using the tile on them (or blasting it).
- Every valid sentence gets an English translation and is read aloud in German (toggle *Vorlesen*).
- Leftover moves at the end become bonus points (*Zuckerrausch*), and the score decides 1–3 stars.

### Lessons

| # | Topic | # | Topic |
|---|---|---|---|
| 1 | Präsens: subject + verb agreement | 9 | Präteritum |
| 2 | Nouns as subjects (der/die/das, plural) | 10 | Futur I (+ jelly) |
| 3 | Akkusativ (der → den, ein → einen) | 11 | Questions: yes/no and W-questions |
| 4 | Inversion (verb stays in position 2) | 12 | Negation: nicht vs. kein |
| 5 | Perfekt with haben | 13 | Separable verbs (aufstehen → ich stehe auf) |
| 6 | Perfekt with sein | 14 | Passive (werden + Partizip II) |
| 7 | Jelly party | 15 | Plusquamperfekt |
| 8 | Modal verbs | 16 | Final exam: everything |

Plus **Freies Spiel**: no move limit, all patterns, high score.

## What the grammar checks

`js/grammar.js` models a German main clause with the classic field layout, `[Vorfeld] [finite verb] [Mittelfeld] [right bracket]`, and tries every reading of every tile (backtracking), because many forms are ambiguous: *essen* is an infinitive and the wir/sie form, *die Katze* can be subject or object, *sie* is she or they.

It checks:

- **V2 / V1 word order:** the conjugated verb is 2nd in statements and 1st in yes/no questions; question words come first.
- **Subject–verb agreement** for all six persons, including *sie* (she vs. they).
- **Case:** nominative subject, accusative object (*den Hund, einen Apfel, ihn, mich*), including weak nouns (*den Jungen*).
- **Verb complexes:** Perfekt and Plusquamperfekt with the right auxiliary (haben vs. sein), Futur I, modal + infinitive, passive with werden, separable prefixes at the end, *möchte* + object.
- **Valency:** verbs that need an object (*kaufen*), can't take one (*gehen*), or take an adjective (*sein, werden*).
- **Tense and time words:** *gestern* needs a past tense, *morgen* doesn't fit one.
- **Negation:** position of *nicht*, *kein* instead of *nicht ein*, no double negation.
- **Pronoun position:** *Er liest es gern*, not *Er liest gern es*; an object pronoun doesn't open the sentence (*Es hat der Hund …*).
- **Adverbs:** time before frequency before *gern* (*heute oft gern*), time and frequency words before a noun without article (*Ich trinke heute Kaffee*), and no contradictions (*oft immer*, *immer morgen*).
- **Question words:** *wer* for people, *was* for things; *wo* is not used with *gehen*/*kommen* (that's *wohin*/*woher*).
- **Meaning:** grammatical sentences that make no sense are flagged kindly ("Grammar ✓, but a dog can't read!"), including the classic trap *Ich bin kalt* → *Mir ist kalt*.

Case and agreement slips are "soft": the parser carries on as if the form were right, so a sentence with one wrong ending is told exactly which ending to fix (*«ich esse», not «ich isst»*) rather than getting a far-fetched alternative reading. For word-order mistakes, `suggest()` searches all orderings of the same tiles and offers the closest valid one.

## Project layout

```
index.html          page shell (loads js/main.js as a module)
css/style.css       all styles; light and dark themes via CSS tokens
js/lexicon.js       word bank: verbs (all persons, Präsens/Präteritum/Partizip), nouns, pronouns, adverbs …
js/grammar.js       sentence parser, error explanations, word-order suggestions
js/english.js       English translation of a parsed sentence
js/solver.js        finds valid sentences on the board (hints, dead-board detection)
js/board.js         grid, balanced word spawning, gravity, shuffling
js/engine.js        rules of a level: moves, scoring, specials, jelly, goals, stars
js/levels.js        the 16 lessons and free play
js/game.js          game screen: input, rendering, animations
js/app.js           lesson map, intro/result sheets, settings, saved progress
js/audio.js         synthesised sound effects and German speech
scripts/build.mjs   bundles everything into dist/wortkonfekt.html
tests/              grammar and level tests (node --test)
```

No dependencies and no build step needed for development.

## Tests

```
npm test
```

- `tests/grammar.test.mjs`: 61 correct sentences with their expected English, 36 typical mistakes with the expected diagnosis, explanation wording, word-order suggestions and search pruning.
- `tests/levels.test.mjs`: every spawn word exists, every example sentence is valid and shows its lesson's topic, a bot can win every level, specials and refills work, wrong attempts cost no move, and a game survives a save/restore round trip.

## Adding words

- **Verb:** add an entry to `VERBS` in `js/lexicon.js` with its English forms, Präsens and Präteritum forms (ich, du, er, wir, ihr, sie), Partizip II, auxiliary (`haben`/`sein`), whether it takes an object (`none`/`opt`/`req`) and what kinds of objects (`objTags`). Regular verbs can use `...weak('stem')`.
- **Noun:** add it to `NOUNS` with gender, English and tags (`food`, `drink`, `text`, `human`, …). The article forms (der/den/ein/einen/kein …) are generated.
- Then put the new words into a level's `spawn` lists in `js/levels.js`, and run `npm test`.
