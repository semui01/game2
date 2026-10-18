import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, explain, suggest } from '../js/grammar.js';
import { toEnglish } from '../js/english.js';

// Tiles: "den Hund" is one tile, so join articles with their noun.
const ARTICLES = /^(der|die|das|den|ein|eine|einen|kein|keine|keinen)$/;
function tiles(sentence) {
  const out = [];
  const t = sentence.split(' ');
  for (let i = 0; i < t.length; i++) {
    if (ARTICLES.test(t[i]) && t[i + 1]) out.push(`${t[i]} ${t[++i]}`);
    else out.push(t[i]);
  }
  return out;
}

const VALID = [
  ['ich esse', 'I eat.'],
  ['du trinkst Kaffee', 'You drink coffee.'],
  ['sie isst Pizza', 'She eats pizza.'],
  ['sie essen Pizza', 'They eat pizza.'],
  ['heute esse ich Pizza', 'Today I eat pizza.'],
  ['oft trinke ich Kaffee', 'I often drink coffee.'],
  ['die Kinder spielen Fußball', 'The children play football.'],
  ['ich sehe den Hund', 'I see the dog.'],
  ['den Apfel isst der Junge', 'The boy eats the apple.'],
  ['ich sehe den Jungen', 'I see the boy.'],
  ['ich habe Pizza gegessen', 'I ate pizza.'],
  ['gestern habe ich Pizza gegessen', 'Yesterday I ate pizza.'],
  ['ich bin gegangen', 'I went.'],
  ['ich hatte Pizza gegessen', 'I had eaten pizza.'],
  ['ich kann schwimmen', 'I can swim.'],
  ['du musst Hausaufgaben machen', 'You have to do homework.'],
  ['ich möchte Pizza essen', 'I would like to eat pizza.'],
  ['ich möchte Pizza', 'I would like pizza.'],
  ['ich mag Pizza', 'I like pizza.'],
  ['ich werde Pizza essen', 'I will eat pizza.'],
  ['morgen werde ich müde sein', 'Tomorrow I will be tired.'],
  ['ich bin müde', 'I am tired.'],
  ['der Kaffee ist kalt', 'The coffee is cold.'],
  ['es ist kalt', 'It is cold.'],
  ['ich will glücklich sein', 'I want to be happy.'],
  ['isst du Pizza', 'Do you eat pizza?'],
  ['kann ich mitkommen', 'Can I come along?'],
  ['was isst du', 'What do you eat?'],
  ['wer isst Pizza', 'Who eats pizza?'],
  ['wo schläft der Hund', 'Where does the dog sleep?'],
  ['warum bist du müde', 'Why are you tired?'],
  ['ich esse keine Pizza', "I don't eat any pizza."],
  ['ich sehe den Hund nicht', "I don't see the dog."],
  ['ich bin nicht müde', 'I am not tired.'],
  ['ich esse nicht gern Pizza', "I don't like to eat pizza."],
  ['ich spiele nicht Fußball', "I don't play football."],
  ['ich habe gestern nicht geschlafen', "I didn't sleep yesterday."],
  ['ich esse gern Pizza', 'I like to eat pizza.'],
  ['er liest es gern', 'He likes to read it.'],
  ['ich stehe auf', 'I get up.'],
  ['ich rufe dich an', 'I call you.'],
  ['ich habe dich angerufen', 'I called you.'],
  ['heute kaufen wir ein', 'Today we go shopping.'],
  ['die Pizza wird gegessen', 'The pizza is eaten.'],
  ['das Buch wurde gestern gelesen', 'The book was read yesterday.'],
  ['der Vogel fliegt', 'The bird flies.'],
  ['ich koche Tee', 'I make tea.'],
  ['ich esse ihn', 'I eat it.'],
  ['ich sehe ihn', 'I see him.'],
  ['ich besuche Berlin nicht', "I don't visit Berlin."],
];

const INVALID = [
  ['ich isst', 'agree'],
  ['die Kinder spielt Fußball', 'agree'],
  ['heute ich esse Pizza', 'v2'],
  ['ich habe gegangen', 'aux-wrong'],
  ['ich bin gegessen', 'aux-wrong'],
  ['ich sehe der Hund', 'case-obj'],
  ['der Hund liest', 'sem-subj'],
  ['ich esse ein Buch', 'sem-obj'],
  ['ich kann geschwommen', 'modal-part2'],
  ['ich habe essen', 'aux-inf'],
  ['ich esse Pizza nicht', 'nicht-kein'],
  ['ich esse nicht keine Pizza', 'nicht-before-obj'],
  ['ich stehe', 'sep-missing'],
  ['ich bin kalt', 'cold-trap'],
  ['gestern esse ich Pizza', 'adv-past'],
  ['morgen habe ich Pizza gegessen', 'adv-future'],
  ['ich habe gegessen Pizza', 'after-rb'],
  ['ich bin müde heute', 'after-adj'],
  ['du isst was', 'wh-late'],
  ['heute isst den Apfel der Hund', 'subj-after-fin'],
  ['er liest gern es', 'pron-late'],
  ['ich kaufe', 'obj-req'],
  ['ich gehe Pizza', 'obj-none'],
  ['ich kann', 'modal-no-inf'],
  ['ich wurde Pizza essen', 'wurde-inf'],
  ['der Hund wird gegessen', 'sem-passive'],
];

test('valid sentences pass and translate', () => {
  for (const [s, en] of VALID) {
    const r = analyze(tiles(s));
    assert.ok(r.ok, `should be valid: «${s}» (${r.ok ? '' : explain(r.error).text})`);
    assert.equal(toEnglish(r.parse), en, `translation of «${s}»`);
  }
});

test('mistakes are caught with the right explanation', () => {
  for (const [s, code] of INVALID) {
    const r = analyze(tiles(s));
    assert.ok(!r.ok, `should be invalid: «${s}»`);
    assert.equal(r.error.code, code, `diagnosis for «${s}»: ${explain(r.error).text}`);
    assert.ok(explain(r.error).text.length > 10);
  }
});

test('explanations name the correct form', () => {
  assert.match(explain(analyze(['ich', 'isst']).error).text, /«ich esse»/);
  assert.match(explain(analyze(['ich', 'sehe', 'der Hund']).error).text, /«den Hund»/);
  assert.match(explain(analyze(['ich', 'habe', 'gegangen']).error).text, /«ich bin … gegangen»/);
});

test('word order suggestions', () => {
  assert.equal(suggest(['heute', 'ich', 'esse', 'Pizza']), 'Heute esse ich Pizza.');
  assert.equal(suggest(['ich', 'habe', 'gegessen', 'Pizza']), 'Ich habe Pizza gegessen.');
  assert.equal(suggest(['ich', 'isst']), null);
});

test('prefix viability lets the board search prune early', () => {
  assert.equal(analyze(['ich', 'habe'], { strict: true }).viable, true);
  assert.equal(analyze(['ich', 'Pizza'], { strict: true }).viable, false);
  assert.equal(analyze(['ich', 'isst'], { strict: true }).viable, false);
});
