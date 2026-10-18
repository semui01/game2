// Rough English rendering of a parsed sentence, shown under every valid sentence.
// German Perfekt is translated as simple past, because that is how it is used in speech.

import { VERBS } from './lexicon.js';
import { cap } from './util.js';

const BE = { pres: { '1sg': 'am', '3sg': 'is', pl: 'are' }, past: { '1sg': 'was', '3sg': 'was', pl: 'were' } };
const NEG = {
  do: "don't",
  does: "doesn't",
  did: "didn't",
  is: "isn't",
  are: "aren't",
  was: "wasn't",
  were: "weren't",
  have: "haven't",
  has: "hasn't",
  had: "hadn't",
  can: "can't",
  could: "couldn't",
  will: "won't",
  would: "wouldn't",
  should: "shouldn't",
};
const HAVE = ['have', 'has', 'had', 'had'];
const WANT = ['want', 'wants', 'wanted', 'wanted'];
const LIKE = ['like', 'likes', 'liked', 'liked'];

const conj = (f, t, k) => (t === 'past' ? f[2] : k === '3sg' ? f[1] : f[0]);

function enForms(v, obj) {
  if (v.enAlt && obj && obj.tags.some(t => v.enAlt.tags.includes(t))) return v.enAlt.en;
  return v.en;
}

// er/sie/es can mean a thing. When the rest of the sentence only fits things
// («Sie wird kalt sein» about the soup, «Er wird gegessen»), say "it".
const notHuman = tags => !tags.includes('human') && !tags.includes('any');
function subjectWord(info) {
  const s = info.subj;
  if (s.pron && s.enPl && info.person === 5) return s.enPl;
  const thing = (info.adj && notHuman(info.adj.tags)) || (info.passive && notHuman(VERBS[info.main].objTags));
  if (s.pron && s.tags.includes('any') && thing) return 'it';
  return s.en;
}

function objectWord(obj, v) {
  if (obj.pron && obj.enThing && !(v.objTags.includes('human') || v.objTags.includes('any'))) return obj.enThing;
  return obj.en;
}

export function toEnglish(info) {
  const v = VERBS[info.main];
  const k = info.person === 0 ? '1sg' : info.person === 2 ? '3sg' : 'pl';
  const t = info.tense === 'praeteritum' || info.tense === 'perfekt' ? 'past' : 'pres';
  const isBe = info.main === 'sein';
  let gern = info.advs.some(a => a.word === 'gern') && !v.noGern && !v.copula && info.mode !== 'passive' && info.modal !== 'möchten';
  let M = enForms(v, info.obj);
  // «etwas gern haben» is the idiom "to like something".
  if (gern && info.main === 'haben') {
    M = LIKE;
    gern = false;
  }
  const sfx = v.enSfx ? [v.enSfx] : [];
  const lex = f => ({ lex: f, t });
  const op = w => ({ op: w });
  const be = tt => op(BE[tt][k]);

  let chain;
  switch (info.mode) {
    case 'simple':
    case 'perfekt':
      if (isBe) chain = [be(t)];
      else if (v.wouldLike) chain = [op('would'), 'like'];
      else if (gern) chain = [lex(LIKE), 'to', M[0], ...sfx];
      else chain = [lex(M), ...sfx];
      break;
    case 'plusq':
      if (isBe) chain = [op('had'), 'been'];
      else if (gern) chain = [op('had'), 'liked', 'to', M[0], ...sfx];
      else chain = [op('had'), M[3], ...sfx];
      break;
    case 'futur':
      chain = [op('will'), gern ? 'gladly' : null, isBe ? 'be' : M[0], ...sfx];
      break;
    case 'modal': {
      const tail = [gern ? 'gladly' : null, isBe ? 'be' : M[0], ...sfx];
      const past = t === 'past';
      switch (info.modal) {
        case 'können':
          chain = [op(past ? 'could' : 'can'), ...tail];
          break;
        case 'müssen':
          chain = [lex(HAVE), 'to', ...tail];
          break;
        case 'wollen':
          chain = [lex(WANT), 'to', ...tail];
          break;
        case 'dürfen':
          chain = past ? [be('past'), 'allowed', 'to', ...tail] : [op('may'), ...tail];
          break;
        case 'sollen':
          chain = past ? [be('past'), 'supposed', 'to', ...tail] : [op('should'), ...tail];
          break;
        default:
          chain = [op('would'), 'like', 'to', ...tail];
      }
      break;
    }
    case 'passive':
      chain = [be(t), M[3], ...sfx];
      break;
  }
  chain = chain.filter(Boolean);

  const neg = info.negation != null;
  const wh = info.vf && info.vf.wh ? info.vf : null;
  const whSubj = wh && wh.r === 'subj';
  const invert = !!info.question && !whSubj;
  let [first, ...rest] = chain;
  if (first.lex && (neg || invert)) {
    rest = [first.lex[0], ...rest];
    first = op(first.t === 'past' ? 'did' : k === '3sg' ? 'does' : 'do');
  }

  const freq = info.advs.filter(a => a.type === 'freq').map(a => a.en);
  const frontTime = !info.question && info.vf && info.vf.r === 'adv' && info.vf.type === 'time';
  const time = info.advs.filter(a => a.type === 'time' && !(frontTime && a === info.vf)).map(a => a.en);
  const subj = subjectWord(info);
  const tail = [];
  if (info.obj && !info.obj.wh) tail.push(objectWord(info.obj, v));
  if (info.adj) tail.push(info.adj.en);

  let words;
  if (first.op) {
    const w = first.op;
    if (invert) {
      const lead = neg ? (NEG[w] ? [NEG[w], subj] : [w, subj, 'not']) : [w, subj];
      words = [...lead, ...freq, ...rest, ...tail, ...time];
    } else {
      words = [subj, neg ? NEG[w] || `${w} not` : w, ...freq, ...rest, ...tail, ...time];
    }
  } else {
    words = [subj, ...freq, conj(first.lex, first.t, k), ...rest, ...tail, ...time];
  }
  if (wh && !whSubj) words.unshift(wh.en);
  if (frontTime) words.unshift(info.vf.en);
  return cap(words.join(' ')) + (info.question ? '?' : '.');
}
