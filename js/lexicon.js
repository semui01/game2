// Wortkonfekt word bank.
// Every tile text maps to one or more analyses: the readings the grammar may try.
// "essen" is an infinitive and also the wir/sie form, "die Katze" can be subject
// or object, so the parser gets every reading and keeps the ones that fit.
//
// Person index: 0 ich · 1 du · 2 er/sie/es · 3 wir · 4 ihr · 5 sie (plural)

import { uniq } from './util.js';

export const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie'];
export const ANIMATE = ['human', 'animal'];

function weak(stem) {
  const e = /[td]$/.test(stem) ? 'e' : '';
  const s2 = /[sßxz]$/.test(stem) ? 't' : 'st';
  return {
    praes: [stem + 'e', stem + e + s2, stem + e + 't', stem + 'en', stem + e + 't', stem + 'en'],
    praet: ['te', 'test', 'te', 'ten', 'tet', 'ten'].map(x => stem + e + x),
  };
}

// en: [base, 3rd person -s, past, past participle]
// obj: 'none' | 'opt' | 'req'   objTags: what the object may be
// subj: what may do it (default: people and animals)
export const VERBS = {
  essen: { en: ['eat', 'eats', 'ate', 'eaten'], praes: 'esse isst isst essen esst essen', praet: 'aß aßest aß aßen aßt aßen', part: 'gegessen', aux: 'haben', obj: 'opt', objTags: ['food'] },
  trinken: { en: ['drink', 'drinks', 'drank', 'drunk'], praes: 'trinke trinkst trinkt trinken trinkt trinken', praet: 'trank trankst trank tranken trankt tranken', part: 'getrunken', aux: 'haben', obj: 'opt', objTags: ['drink'] },
  lesen: { en: ['read', 'reads', 'read', 'read'], praes: 'lese liest liest lesen lest lesen', praet: 'las lasest las lasen last lasen', part: 'gelesen', aux: 'haben', obj: 'opt', objTags: ['text'], subj: ['human'] },
  schreiben: { en: ['write', 'writes', 'wrote', 'written'], praes: 'schreibe schreibst schreibt schreiben schreibt schreiben', praet: 'schrieb schriebst schrieb schrieben schriebt schrieben', part: 'geschrieben', aux: 'haben', obj: 'opt', objTags: ['text'], subj: ['human'] },
  sehen: { en: ['see', 'sees', 'saw', 'seen'], praes: 'sehe siehst sieht sehen seht sehen', praet: 'sah sahst sah sahen saht sahen', part: 'gesehen', aux: 'haben', obj: 'req', objTags: ['any'] },
  finden: { en: ['find', 'finds', 'found', 'found'], praes: 'finde findest findet finden findet finden', praet: 'fand fandest fand fanden fandet fanden', part: 'gefunden', aux: 'haben', obj: 'req', objTags: ['any'] },
  kaufen: { en: ['buy', 'buys', 'bought', 'bought'], ...weak('kauf'), part: 'gekauft', aux: 'haben', obj: 'req', objTags: ['food', 'drink', 'text', 'thing'], subj: ['human'] },
  spielen: { en: ['play', 'plays', 'played', 'played'], ...weak('spiel'), part: 'gespielt', aux: 'haben', obj: 'opt', objTags: ['game'] },
  haben: { en: ['have', 'has', 'had', 'had'], praes: 'habe hast hat haben habt haben', praet: 'hatte hattest hatte hatten hattet hatten', part: 'gehabt', aux: 'haben', obj: 'req', objTags: ['animal', 'food', 'drink', 'text', 'thing', 'task'] },
  machen: { en: ['do', 'does', 'did', 'done'], enAlt: { tags: ['food'], en: ['make', 'makes', 'made', 'made'] }, ...weak('mach'), part: 'gemacht', aux: 'haben', obj: 'req', objTags: ['task', 'food'], subj: ['human'] },
  lieben: { en: ['love', 'loves', 'loved', 'loved'], ...weak('lieb'), part: 'geliebt', aux: 'haben', obj: 'req', objTags: ['any'] },
  mögen: { en: ['like', 'likes', 'liked', 'liked'], praes: 'mag magst mag mögen mögt mögen', praet: 'mochte mochtest mochte mochten mochtet mochten', part: 'gemocht', aux: 'haben', obj: 'req', objTags: ['any'], noGern: true },
  möchten: { en: ['like', 'likes', 'liked', 'liked'], wouldLike: true, praes: 'möchte möchtest möchte möchten möchtet möchten', aux: 'haben', obj: 'req', objTags: ['any'], noGern: true, noInf: true },
  besuchen: { en: ['visit', 'visits', 'visited', 'visited'], ...weak('besuch'), part: 'besucht', aux: 'haben', obj: 'req', objTags: ['human', 'place'], subj: ['human'] },
  kochen: { en: ['cook', 'cooks', 'cooked', 'cooked'], enAlt: { tags: ['drink'], en: ['make', 'makes', 'made', 'made'] }, ...weak('koch'), part: 'gekocht', aux: 'haben', obj: 'opt', objTags: ['cooked'], subj: ['human'] },
  brauchen: { en: ['need', 'needs', 'needed', 'needed'], ...weak('brauch'), part: 'gebraucht', aux: 'haben', obj: 'req', objTags: ['any'] },
  suchen: { en: ['look', 'looks', 'looked', 'looked'], enSfx: 'for', ...weak('such'), part: 'gesucht', aux: 'haben', obj: 'req', objTags: ['any'] },
  hören: { en: ['hear', 'hears', 'heard', 'heard'], ...weak('hör'), part: 'gehört', aux: 'haben', obj: 'opt', objTags: ['human', 'animal', 'music', 'text'] },

  gehen: { en: ['go', 'goes', 'went', 'gone'], praes: 'gehe gehst geht gehen geht gehen', praet: 'ging gingst ging gingen gingt gingen', part: 'gegangen', aux: 'sein', obj: 'none', noWo: true },
  kommen: { en: ['come', 'comes', 'came', 'come'], praes: 'komme kommst kommt kommen kommt kommen', praet: 'kam kamst kam kamen kamt kamen', part: 'gekommen', aux: 'sein', obj: 'none', noWo: true },
  fahren: { en: ['drive', 'drives', 'drove', 'driven'], praes: 'fahre fährst fährt fahren fahrt fahren', praet: 'fuhr fuhrst fuhr fuhren fuhrt fuhren', part: 'gefahren', aux: 'sein', obj: 'none', subj: ['human'], noWo: true },
  laufen: { en: ['run', 'runs', 'ran', 'run'], praes: 'laufe läufst läuft laufen lauft laufen', praet: 'lief liefst lief liefen lieft liefen', part: 'gelaufen', aux: 'sein', obj: 'none' },
  schwimmen: { en: ['swim', 'swims', 'swam', 'swum'], praes: 'schwimme schwimmst schwimmt schwimmen schwimmt schwimmen', praet: 'schwamm schwammst schwamm schwammen schwammt schwammen', part: 'geschwommen', aux: 'sein', obj: 'none' },
  fliegen: { en: ['fly', 'flies', 'flew', 'flown'], praes: 'fliege fliegst fliegt fliegen fliegt fliegen', praet: 'flog flogst flog flogen flogt flogen', part: 'geflogen', aux: 'sein', obj: 'none', subj: ['human', 'bird'], noWo: true },
  bleiben: { en: ['stay', 'stays', 'stayed', 'stayed'], praes: 'bleibe bleibst bleibt bleiben bleibt bleiben', praet: 'blieb bliebst blieb blieben bliebt blieben', part: 'geblieben', aux: 'sein', obj: 'none' },
  schlafen: { en: ['sleep', 'sleeps', 'slept', 'slept'], praes: 'schlafe schläfst schläft schlafen schlaft schlafen', praet: 'schlief schliefst schlief schliefen schlieft schliefen', part: 'geschlafen', aux: 'haben', obj: 'none' },
  arbeiten: { en: ['work', 'works', 'worked', 'worked'], ...weak('arbeit'), part: 'gearbeitet', aux: 'haben', obj: 'none', subj: ['human'] },
  lachen: { en: ['laugh', 'laughs', 'laughed', 'laughed'], ...weak('lach'), part: 'gelacht', aux: 'haben', obj: 'none', subj: ['human'] },
  tanzen: { en: ['dance', 'dances', 'danced', 'danced'], ...weak('tanz'), part: 'getanzt', aux: 'haben', obj: 'none', subj: ['human'] },
  singen: { en: ['sing', 'sings', 'sang', 'sung'], praes: 'singe singst singt singen singt singen', praet: 'sang sangst sang sangen sangt sangen', part: 'gesungen', aux: 'haben', obj: 'none', subj: ['human', 'bird'] },

  // Separable verbs: the finite stem stays in position 2, the prefix goes to the end.
  aufstehen: { sep: 'auf', en: ['get', 'gets', 'got', 'gotten'], enSfx: 'up', praes: 'stehe stehst steht stehen steht stehen', praet: 'stand standest stand standen standet standen', part: 'aufgestanden', aux: 'sein', obj: 'none' },
  einkaufen: { sep: 'ein', en: ['go', 'goes', 'went', 'gone'], enSfx: 'shopping', ...weak('kauf'), part: 'eingekauft', aux: 'haben', obj: 'none', subj: ['human'] },
  anrufen: { sep: 'an', en: ['call', 'calls', 'called', 'called'], praes: 'rufe rufst ruft rufen ruft rufen', praet: 'rief riefst rief riefen rieft riefen', part: 'angerufen', aux: 'haben', obj: 'req', objTags: ['human'], subj: ['human'] },
  fernsehen: { sep: 'fern', en: ['watch', 'watches', 'watched', 'watched'], enSfx: 'TV', praes: 'sehe siehst sieht sehen seht sehen', praet: 'sah sahst sah sahen saht sahen', part: 'ferngesehen', aux: 'haben', obj: 'none', subj: ['human'] },
  mitkommen: { sep: 'mit', en: ['come', 'comes', 'came', 'come'], enSfx: 'along', praes: 'komme kommst kommt kommen kommt kommen', praet: 'kam kamst kam kamen kamt kamen', part: 'mitgekommen', aux: 'sein', obj: 'none', noWo: true },
  einladen: { sep: 'ein', en: ['invite', 'invites', 'invited', 'invited'], praes: 'lade lädst lädt laden ladet laden', praet: 'lud ludst lud luden ludet luden', part: 'eingeladen', aux: 'haben', obj: 'req', objTags: ['human'], subj: ['human'] },
  anfangen: { sep: 'an', en: ['start', 'starts', 'started', 'started'], praes: 'fange fängst fängt fangen fangt fangen', praet: 'fing fingst fing fingen fingt fingen', part: 'angefangen', aux: 'haben', obj: 'none', subj: ['human'] },

  // Copulas take an adjective: "Ich bin müde", "Ich werde müde".
  sein: { copula: true, en: ['be', 'is', 'was', 'been'], praes: 'bin bist ist sind seid sind', praet: 'war warst war waren wart waren', part: 'gewesen', aux: 'sein' },
  werden: { copula: true, en: ['get', 'gets', 'got', 'gotten'], praes: 'werde wirst wird werden werdet werden', praet: 'wurde wurdest wurde wurden wurdet wurden', part: 'geworden', aux: 'sein' },
};

export const MODALS = {
  können: { en: 'can', praes: 'kann kannst kann können könnt können', praet: 'konnte konntest konnte konnten konntet konnten' },
  wollen: { en: 'want to', praes: 'will willst will wollen wollt wollen', praet: 'wollte wolltest wollte wollten wolltet wollten' },
  müssen: { en: 'have to', praes: 'muss musst muss müssen müsst müssen', praet: 'musste musstest musste mussten musstet mussten' },
  dürfen: { en: 'may', praes: 'darf darfst darf dürfen dürft dürfen', praet: 'durfte durftest durfte durften durftet durften' },
  sollen: { en: 'should', praes: 'soll sollst soll sollen sollt sollen', praet: 'sollte solltest sollte sollten solltet sollten' },
  möchten: { en: 'would like to', praes: 'möchte möchtest möchte möchten möchtet möchten' },
};

for (const table of [VERBS, MODALS]) {
  for (const v of Object.values(table)) {
    for (const t of ['praes', 'praet']) if (typeof v[t] === 'string') v[t] = v[t].split(' ');
  }
}

// g: m | f | n | pl | prop.  dets: which article forms exist as tiles.
// mass: also usable without article ("Ich trinke Kaffee").  zeroOnly: never takes der/ein.
const COUNT = ['def', 'indef', 'kein'];
const MASS = ['zero', 'def', 'kein'];
const MASS_COUNT = ['zero', 'def', 'indef', 'kein'];
export const NOUNS = {
  Hund: { g: 'm', en: 'dog', tags: ['animal'] },
  Katze: { g: 'f', en: 'cat', tags: ['animal'] },
  Vogel: { g: 'm', en: 'bird', tags: ['animal', 'bird'] },
  Kind: { g: 'n', en: 'child', tags: ['human'] },
  Kinder: { g: 'pl', en: 'children', tags: ['human'] },
  Mann: { g: 'm', en: 'man', tags: ['human'] },
  Frau: { g: 'f', en: 'woman', tags: ['human'] },
  Lehrer: { g: 'm', en: 'teacher', tags: ['human'] },
  Lehrerin: { g: 'f', en: 'teacher', tags: ['human'] },
  Oma: { g: 'f', en: 'grandma', tags: ['human'] },
  Opa: { g: 'm', en: 'grandpa', tags: ['human'] },
  Junge: { g: 'm', en: 'boy', tags: ['human'], acc: 'Jungen' },
  Mädchen: { g: 'n', en: 'girl', tags: ['human'] },
  Freund: { g: 'm', en: 'friend', tags: ['human'] },
  Freundin: { g: 'f', en: 'friend', tags: ['human'] },
  Eltern: { g: 'pl', en: 'parents', tags: ['human'] },

  Apfel: { g: 'm', en: 'apple', an: true, tags: ['food'] },
  Kuchen: { g: 'm', en: 'cake', tags: ['food'], dets: MASS_COUNT, mass: true },
  Pizza: { g: 'f', en: 'pizza', tags: ['food'], dets: MASS_COUNT, mass: true },
  Suppe: { g: 'f', en: 'soup', tags: ['food', 'cooked'], dets: MASS_COUNT, mass: true },
  Brot: { g: 'n', en: 'bread', tags: ['food'], dets: MASS_COUNT, mass: true },
  Ei: { g: 'n', en: 'egg', an: true, tags: ['food', 'cooked'] },
  Banane: { g: 'f', en: 'banana', tags: ['food'] },
  Nudeln: { g: 'pl', en: 'pasta', tags: ['food', 'cooked'], dets: MASS, mass: true },
  Schokolade: { g: 'f', en: 'chocolate', tags: ['food'], dets: MASS, mass: true },
  Salat: { g: 'm', en: 'salad', tags: ['food'], dets: MASS_COUNT, mass: true },
  Kaffee: { g: 'm', en: 'coffee', tags: ['drink', 'cooked'], dets: MASS_COUNT, mass: true },
  Tee: { g: 'm', en: 'tea', tags: ['drink', 'cooked'], dets: MASS, mass: true },
  Wasser: { g: 'n', en: 'water', tags: ['drink'], dets: MASS, mass: true },
  Milch: { g: 'f', en: 'milk', tags: ['drink'], dets: MASS, mass: true },
  Saft: { g: 'm', en: 'juice', tags: ['drink'], dets: MASS_COUNT, mass: true },

  Buch: { g: 'n', en: 'book', tags: ['text'] },
  Brief: { g: 'm', en: 'letter', tags: ['text'] },
  Zeitung: { g: 'f', en: 'newspaper', tags: ['text'] },
  Geschichte: { g: 'f', en: 'story', tags: ['text'] },
  'E-Mail': { g: 'f', en: 'email', an: true, tags: ['text'] },

  Fußball: { g: 'm', en: 'football', tags: ['game'], dets: ['zero', 'kein'], zeroOnly: true },
  Tennis: { g: 'n', en: 'tennis', tags: ['game'], dets: ['zero', 'kein'], zeroOnly: true },
  Schach: { g: 'n', en: 'chess', tags: ['game'], dets: ['zero', 'kein'], zeroOnly: true },
  Gitarre: { g: 'f', en: 'guitar', tags: ['thing', 'game'], zeroTags: ['game'], dets: MASS_COUNT },
  Musik: { g: 'f', en: 'music', tags: ['music'], dets: ['zero', 'def', 'kein'], mass: true },
  Ball: { g: 'm', en: 'ball', tags: ['thing'], zeroTags: ['game'], dets: MASS_COUNT },
  Auto: { g: 'n', en: 'car', tags: ['thing'] },
  Fahrrad: { g: 'n', en: 'bike', tags: ['thing'] },
  Handy: { g: 'n', en: 'phone', tags: ['thing'] },
  Tasche: { g: 'f', en: 'bag', tags: ['thing'] },
  Film: { g: 'm', en: 'film', tags: ['film'] },
  Hausaufgaben: { g: 'pl', en: 'homework', tags: ['task'], dets: ['zero', 'kein'], zeroOnly: true },
  Sport: { g: 'm', en: 'sport', tags: ['task'], dets: ['zero', 'kein'], zeroOnly: true },
  Berlin: { g: 'prop', en: 'Berlin', tags: ['place'], dets: ['zero'] },
  Museum: { g: 'n', en: 'museum', tags: ['place'] },
  Stadt: { g: 'f', en: 'city', tags: ['place'] },
};

const ART = {
  def: { nom: { m: 'der', f: 'die', n: 'das', pl: 'die' }, acc: { m: 'den', f: 'die', n: 'das', pl: 'die' } },
  indef: { nom: { m: 'ein', f: 'eine', n: 'ein' }, acc: { m: 'einen', f: 'eine', n: 'ein' } },
  kein: { nom: { m: 'kein', f: 'keine', n: 'kein', pl: 'keine' }, acc: { m: 'keinen', f: 'keine', n: 'kein', pl: 'keine' } },
};

export const NOM_PRON = {
  ich: { ps: [0], tags: ['human'], en: 'I', acc: 'mich' },
  du: { ps: [1], tags: ['human'], en: 'you', acc: 'dich' },
  er: { ps: [2], tags: ['any'], en: 'he', acc: 'ihn' },
  sie: { ps: [2, 5], tags: ['any'], en: 'she', enPl: 'they', acc: 'sie' },
  es: { ps: [2], tags: ['any'], en: 'it', acc: 'es' },
  wir: { ps: [3], tags: ['human'], en: 'we', acc: 'uns' },
  ihr: { ps: [4], tags: ['human'], en: 'you all', acc: 'euch' },
};

export const ACC_PRON = {
  mich: { tags: ['human'], en: 'me', nom: 'ich' },
  dich: { tags: ['human'], en: 'you', nom: 'du' },
  ihn: { tags: ['any'], en: 'him', enThing: 'it', nom: 'er', masc: true },
  sie: { tags: ['any'], en: 'her', enThing: 'it', nom: 'sie' },
  es: { tags: ['any'], en: 'it', nom: 'es' },
  uns: { tags: ['human'], en: 'us', nom: 'wir' },
  euch: { tags: ['human'], en: 'you all', nom: 'ihr' },
};

// type: time (one per sentence) · freq · manner.  past / future / now: tense limits.
export const ADVERBS = {
  heute: { type: 'time', en: 'today' },
  gestern: { type: 'time', en: 'yesterday', past: true },
  morgen: { type: 'time', en: 'tomorrow', future: true },
  bald: { type: 'time', en: 'soon', future: true },
  jetzt: { type: 'time', en: 'now', now: true },
  oft: { type: 'freq', en: 'often' },
  immer: { type: 'freq', en: 'always' },
  gern: { type: 'manner', en: 'gladly' },
};

// tags: who or what the adjective can describe.  coldTrap: "Ich bin kalt" means something else.
export const ADJECTIVES = {
  müde: { en: 'tired', tags: ANIMATE },
  hungrig: { en: 'hungry', tags: ANIMATE },
  durstig: { en: 'thirsty', tags: ANIMATE },
  glücklich: { en: 'happy', tags: ANIMATE },
  traurig: { en: 'sad', tags: ANIMATE },
  krank: { en: 'sick', tags: ANIMATE },
  lecker: { en: 'tasty', tags: ['food', 'drink'] },
  kalt: { en: 'cold', tags: ['food', 'drink', 'thing', 'place'], coldTrap: true },
  heiß: { en: 'hot', tags: ['food', 'drink', 'thing', 'place'], coldTrap: true },
  groß: { en: 'big', tags: ['any'] },
  klein: { en: 'small', tags: ['any'] },
  alt: { en: 'old', tags: ['any'] },
  neu: { en: 'new', tags: ['any'] },
  schön: { en: 'beautiful', tags: ['any'] },
};

export const WH = { was: 'what', wer: 'who', wen: 'whom', wann: 'when', wo: 'where', warum: 'why' };

// ---------------------------------------------------------------------------
// Analysis table

export const LEX = new Map();

function add(text, a) {
  a.text = text;
  if (!LEX.has(text)) LEX.set(text, []);
  LEX.get(text).push(a);
}

function addFin(text, props, p) {
  const list = LEX.get(text) || [];
  const same = list.find(
    a => a.r === 'fin' && a.fk === props.fk && a.lemma === props.lemma && a.aux === props.aux && a.tense === props.tense && a.sep === props.sep,
  );
  if (same) {
    if (!same.ps.includes(p)) same.ps.push(p);
  } else {
    add(text, { r: 'fin', ...props, ps: [p] });
  }
}

for (const [lemma, v] of Object.entries(VERBS)) {
  for (const tense of ['praes', 'praet']) {
    (v[tense] || []).forEach((f, p) => {
      const fk = v.copula ? 'cop' : 'lex';
      addFin(f, { fk, lemma, aux: null, tense, sep: v.sep || null }, p);
    });
  }
  if (v.part) add(v.part, { r: 'rb', rk: 'part2', lemma });
  if (!v.noInf) add(lemma, { r: 'rb', rk: 'inf', lemma });
}
for (const prefix of uniq(Object.values(VERBS).map(v => v.sep).filter(Boolean))) {
  add(prefix, { r: 'rb', rk: 'ptcl', prefix });
}
for (const aux of ['haben', 'sein', 'werden']) {
  for (const tense of ['praes', 'praet']) {
    VERBS[aux][tense].forEach((f, p) => addFin(f, { fk: 'aux', lemma: aux, aux, tense, sep: null }, p));
  }
}
for (const [lemma, m] of Object.entries(MODALS)) {
  for (const tense of ['praes', 'praet']) {
    (m[tense] || []).forEach((f, p) => addFin(f, { fk: 'modal', lemma, aux: null, tense, sep: null }, p));
  }
}

for (const [w, d] of Object.entries(NOM_PRON)) {
  add(w, { r: 'subj', pron: true, ps: d.ps, tags: d.tags, en: d.en, enPl: d.enPl, caseOk: true });
  if (!ACC_PRON[w]) add(w, { r: 'obj', pron: true, tags: d.tags, en: d.en, caseOk: false, accText: d.acc });
}
for (const [w, d] of Object.entries(ACC_PRON)) {
  add(w, { r: 'obj', pron: true, tags: d.tags, en: d.en, enThing: d.enThing, masc: !!d.masc, caseOk: true });
  if (!NOM_PRON[w]) add(w, { r: 'subj', pron: true, ps: NOM_PRON[d.nom].ps, tags: d.tags, en: d.en, caseOk: false, nomText: d.nom });
}

export function npText(noun, det, cas) {
  const N = NOUNS[noun];
  if (!N) return null;
  const form = cas === 'acc' && N.acc ? N.acc : noun;
  if (det === 'zero') return form;
  const art = ART[det]?.[cas]?.[N.g];
  return art ? `${art} ${form}` : null;
}

function enNP(N, det) {
  const a = N.an ? 'an ' : 'a ';
  if (det === 'def') return (N.g === 'prop' ? '' : 'the ') + N.en;
  if (det === 'indef') return a + N.en;
  if (det === 'kein') return N.zeroOnly ? N.en : N.mass || N.g === 'pl' ? 'any ' + N.en : a + N.en;
  return N.en;
}

const NP_INFO = new Map(); // text -> { noun, det, cases }
for (const [noun, N] of Object.entries(NOUNS)) {
  const dets = N.dets || (N.g === 'pl' ? ['def', 'kein'] : COUNT);
  for (const det of dets) {
    for (const cas of ['nom', 'acc']) {
      if (det === 'kein' && cas === 'nom') continue; // kein stays an object here
      const text = npText(noun, det, cas);
      if (!text) continue;
      const info = NP_INFO.get(text) || { noun, det, cases: new Set() };
      info.cases.add(cas);
      NP_INFO.set(text, info);
    }
  }
}
for (const [text, { noun, det, cases }] of NP_INFO) {
  const N = NOUNS[noun];
  const base = {
    np: true,
    noun,
    g: N.g,
    det,
    tags: (det === 'zero' && N.zeroTags) || N.tags,
    en: enNP(N, det),
    ps: N.g === 'pl' ? [5] : [2],
    masc: N.g === 'm' && det !== 'zero',
    zeroOnly: !!N.zeroOnly && det === 'zero',
    nomText: npText(noun, det === 'kein' ? 'def' : det, 'nom'),
    accText: npText(noun, det, 'acc'),
  };
  add(text, { r: 'subj', ...base, caseOk: cases.has('nom'), keinSubj: det === 'kein' });
  add(text, { r: 'obj', ...base, caseOk: cases.has('acc') });
}

for (const [word, d] of Object.entries(ADVERBS)) add(word, { r: 'adv', word, ...d });
for (const [word, d] of Object.entries(ADJECTIVES)) add(word, { r: 'adj', word, ...d });
add('nicht', { r: 'nicht', word: 'nicht' });

// «was» as subject asks about things; people and animals take «wer».
add('was', { r: 'subj', wh: true, ps: [2], tags: ['thing', 'food', 'drink', 'text', 'place', 'film', 'music', 'game', 'task', 'cooked'], en: 'what', caseOk: true });
add('was', { r: 'obj', wh: true, tags: ['any'], en: 'what', caseOk: true });
add('wer', { r: 'subj', wh: true, ps: [2], tags: ['human'], en: 'who', caseOk: true });
add('wer', { r: 'obj', wh: true, tags: ['human'], en: 'who', caseOk: false, accText: 'wen' });
add('wen', { r: 'obj', wh: true, tags: ['human', 'animal'], en: 'who', masc: true, caseOk: true });
add('wen', { r: 'subj', wh: true, ps: [2], tags: ['human'], en: 'who', caseOk: false, nomText: 'wer' });
for (const w of ['wann', 'wo', 'warum']) add(w, { r: 'adv', wh: true, type: 'wh', word: w, en: WH[w] });

// ---------------------------------------------------------------------------
// Lookups used by the board, the UI and the error messages

export function finiteForm(fin, p) {
  if (fin.fk === 'modal') return MODALS[fin.lemma][fin.tense]?.[p];
  return VERBS[fin.lemma][fin.tense]?.[p];
}

// Display class: decides the candy colour and shape of a tile.
const CLASS_ORDER = ['pron', 'noun', 'wh', 'aux', 'verb', 'end', 'adv', 'adj'];
function classOfAnalysis(a) {
  if (a.wh) return 'wh';
  if (a.pron) return 'pron';
  if (a.np) return 'noun';
  if (a.r === 'fin') return a.fk === 'lex' ? 'verb' : 'aux';
  if (a.r === 'rb') return a.rk === 'inf' ? 'verb' : 'end';
  if (a.r === 'adv' || a.r === 'nicht') return 'adv';
  return 'adj';
}
const CLASS_CACHE = new Map();
export function wordClass(text) {
  if (CLASS_CACHE.has(text)) return CLASS_CACHE.get(text);
  const set = new Set((LEX.get(text) || []).map(classOfAnalysis));
  const cls = CLASS_ORDER.find(c => set.has(c)) || 'adv';
  CLASS_CACHE.set(text, cls);
  return cls;
}

export const CLASS_LABELS = {
  pron: 'Pronomen',
  noun: 'Nomen',
  verb: 'Verb',
  aux: 'Hilfs- & Modalverb',
  end: 'Partizip & Präfix',
  adv: 'Adverb',
  adj: 'Adjektiv',
  wh: 'Fragewort',
};

export function subjPersons(text) {
  return uniq((LEX.get(text) || []).filter(a => a.r === 'subj' && a.caseOk && !a.wh).flatMap(a => a.ps));
}
export function finPersons(text) {
  return uniq((LEX.get(text) || []).filter(a => a.r === 'fin').flatMap(a => a.ps));
}
export function auxOfFinite(text) {
  return uniq((LEX.get(text) || []).filter(a => a.r === 'fin' && a.fk === 'aux' && a.aux !== 'werden').map(a => a.aux));
}
export function auxOfPart(text) {
  const a = (LEX.get(text) || []).find(x => x.rk === 'part2');
  return a ? VERBS[a.lemma].aux : null;
}

const TENSE_NAME = { praes: 'Präsens', praet: 'Präteritum' };
const CASE_NAME = { nom: 'Nominativ', acc: 'Akkusativ' };
const GENDER_NAME = { m: 'maskulin', f: 'feminin', n: 'neutrum', pl: 'Plural', prop: 'Name' };

// Human-readable notes for the long-press word card.
export function describe(text) {
  const lines = [];
  const seen = new Set();
  const push = s => {
    if (!seen.has(s)) {
      seen.add(s);
      lines.push(s);
    }
  };
  for (const a of LEX.get(text) || []) {
    const who = a.ps ? a.ps.map(p => PERSONS[p]).join(', ') : '';
    if (a.r === 'fin') {
      const t = TENSE_NAME[a.tense];
      if (a.fk === 'lex') {
        const v = VERBS[a.lemma];
        const gloss = v.wouldLike ? 'would like' : `to ${v.en[0]}${v.enSfx ? ' ' + v.enSfx : ''}`;
        push(`${a.lemma} (${gloss}) · ${t} · ${who}${a.sep ? ` · trennbar: … ${a.sep}` : ''}`);
      } else if (a.fk === 'aux') push(`Hilfsverb ${a.aux} · ${t} · ${who}`);
      else if (a.fk === 'modal') push(`Modalverb ${a.lemma} (${MODALS[a.lemma].en}) · ${t} · ${who}`);
      else push(`${a.lemma} (${a.lemma === 'sein' ? 'to be' : 'to become'}) · ${t} · ${who}`);
    } else if (a.r === 'rb') {
      if (a.rk === 'part2') push(`Partizip II von ${a.lemma} · Perfekt mit ${VERBS[a.lemma].aux}`);
      else if (a.rk === 'inf') push(`Infinitiv (to ${VERBS[a.lemma].en[0]}${VERBS[a.lemma].enSfx ? ' ' + VERBS[a.lemma].enSfx : ''})`);
      else {
        const verbs = Object.keys(VERBS).filter(l => VERBS[l].sep === a.prefix);
        push(`Präfix von ${verbs.join(', ')} · steht am Ende`);
      }
    } else if (a.wh) {
      push(`Fragewort (${a.en}) · steht am Anfang`);
    } else if (a.pron && a.caseOk) {
      push(`${a.r === 'subj' ? 'Nominativ (Subjekt)' : 'Akkusativ (Objekt)'}: ${a.r === 'subj' && a.enPl ? `${a.en} / ${a.enPl}` : a.en}`);
    } else if (a.np && a.caseOk) {
      const N = NOUNS[a.noun];
      const cases = NP_INFO.get(text);
      push(`${GENDER_NAME[N.g]} · ${[...cases.cases].map(c => CASE_NAME[c]).join(' & ')} (${a.en})`);
    } else if (a.r === 'adv') {
      const extra = a.past ? ' · braucht Vergangenheit' : a.future ? ' · Präsens oder Futur' : '';
      push(`Adverb (${a.en})${extra}`);
    } else if (a.r === 'nicht') push('Negation (not) · steht meist hinten');
    else if (a.r === 'adj') push(`Adjektiv (${a.en}) · mit sein / werden`);
  }
  return lines;
}

// Pool helpers for level design.
export const W = {
  pron: (kind = 'nom', only = null) => Object.keys(kind === 'nom' ? NOM_PRON : ACC_PRON).filter(w => !only || only.includes(w)),
  np: (nouns, det = 'def', cas = 'nom') => nouns.map(n => npText(n, det, cas)).filter(t => t && LEX.has(t)),
  fin: (lemmas, tense = 'praes') => uniq(lemmas.flatMap(l => VERBS[l][tense] || [])),
  aux: (aux, tense = 'praes') => uniq(VERBS[aux][tense]),
  modal: (lemmas, tense = 'praes') => uniq(lemmas.flatMap(l => MODALS[l][tense] || [])),
  part: lemmas => lemmas.map(l => VERBS[l].part),
  inf: lemmas => lemmas.slice(),
  ptcl: lemmas => uniq(lemmas.map(l => VERBS[l].sep)),
};
