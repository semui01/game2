// The sentence checker.
//
// A German main clause is modelled with the classic field layout:
//   [Vorfeld] [finite verb] [Mittelfeld …] [right bracket]
// Vorfeld:       one element: subject, object, adverb or question word (empty in yes/no questions)
// finite verb:   always the 2nd element (V2), or the 1st in a yes/no question
// Mittelfeld:    subject first (if not in the Vorfeld), then objects, adverbs, nicht, adjective
// right bracket: Partizip II, infinitive or separable prefix: always last
//
// analyze() walks the words left to right, trying every reading of each word
// (backtracking). Each failed reading leaves an error with a depth; the deepest
// error is the most specific explanation and the one we show.

import { LEX, VERBS, ANIMATE, finiteForm, npText } from './lexicon.js';
import { cap, uniq } from './util.js';

const PAST = new Set(['praeteritum', 'perfekt', 'plusquamperfekt']);

const START = {
  slot: 'VF',
  picks: [],
  subj: null,
  obj: null,
  fin: null,
  rb: null,
  adj: null,
  vf: null,
  advs: [],
  nicht: -1,
  nichtScoped: false,
  mf: 0,
  person: null,
  question: null,
  soft: [],
};

function E(depth, code, ctx = {}) {
  return { err: { depth, code, ctx } };
}

function tagsMatch(a, b) {
  if (a.includes('any') || b.includes('any')) return true;
  return a.some(x => b.includes(x));
}

// Case and agreement slips are "soft": the reading goes on as if the form were
// right, so a sentence that is correct apart from one ending gets exactly that
// explanation instead of some far-fetched other reading.
function soft(t, code, ctx) {
  t.soft = [...t.soft, { depth: 6, code, ctx }];
}

function agree(t) {
  const ps = t.subj.ps.filter(p => t.fin.ps.includes(p));
  if (ps.length) t.person = ps[0];
  else {
    t.person = t.subj.ps[0];
    soft(t, 'agree', { subj: t.subj, fin: t.fin, at: t.finPos });
  }
  return t;
}

function place(t, a, i) {
  switch (a.r) {
    case 'subj':
      if (t.subj) return E(3, 'two-subj', { a, at: i });
      if (!a.caseOk) soft(t, 'case-subj', { a, at: i });
      t.subj = a;
      t.subjPos = i;
      return t.fin ? agree(t) : t;
    case 'obj':
      if (t.obj) return E(3, 'two-obj', { a, at: i });
      if (!a.caseOk) soft(t, 'case-obj', { a, at: i });
      if (t.nicht >= 0 && !t.nichtScoped && !a.zeroOnly) return E(5, 'nicht-before-obj', { a, at: t.nicht });
      // Object pronouns come early in the Mittelfeld: «Er liest es gern», not «Er liest gern es».
      if (a.pron && (t.mfAdv || t.nicht >= 0)) return E(5, 'pron-late', { a, at: i });
      t.obj = a;
      t.objPos = i;
      return t;
    case 'adv':
      if (t.advs.some(b => b.word === a.word)) return E(3, 'dup', { a, at: i });
      if (a.type === 'time' && t.advs.some(b => b.type === 'time')) return E(5, 'two-time', { a, at: i });
      if (t.nicht >= 0) {
        // "nicht gern", "nicht oft", "nicht immer" are fine; "nicht heute" is not.
        if (t.nicht === i - 1 && (a.type === 'freq' || a.type === 'manner')) t.nichtScoped = true;
        else return E(5, 'nicht-before-adv', { a, at: t.nicht });
      }
      t.advs = [...t.advs, a];
      if (t.fin) t.mfAdv = true;
      return t;
    case 'nicht':
      if (t.nicht >= 0) return E(3, 'dup', { a, at: i });
      t.nicht = i;
      return t;
    case 'adj':
      t.adj = a;
      t.adjPos = i;
      return t;
  }
  return E(1, 'unknown', { a, at: i });
}

function step(s, a, i) {
  const t = { ...s, picks: [...s.picks, a] };
  if (a.wh && i > 0) return E(3, 'wh-late', { a, at: i });
  if (s.slot === 'VF') {
    if (a.r === 'fin') {
      t.fin = a;
      t.finPos = i;
      t.slot = 'MF';
      t.question = 'yn';
      return t;
    }
    if (a.r === 'rb') return E(1, 'rb-first', { a, at: i });
    if (a.r === 'nicht') return E(1, 'nicht-first', { a, at: i });
    if (a.r === 'adj') return E(1, 'adj-first', { a, at: i });
    t.vf = a;
    t.slot = 'FIN';
    if (a.wh) t.question = 'w';
    return place(t, a, i);
  }
  if (s.slot === 'FIN') {
    if (a.r !== 'fin') return E(2, 'v2', { first: s.vf, a, at: i });
    t.fin = a;
    t.finPos = i;
    t.slot = 'MF';
    return t.subj ? agree(t) : t;
  }
  if (s.rb) return E(3, 'after-rb', { rb: s.rb, a, at: s.rbPos });
  if (a.r === 'fin') return E(3, 'two-fin', { a, at: i });
  if (a.r === 'rb') {
    t.rb = a;
    t.rbPos = i;
    return t;
  }
  if (s.adj) return E(3, 'after-adj', { adj: s.adj, a, at: s.adjPos });
  if (!s.subj && a.r !== 'subj') return E(3, 'subj-after-fin', { a, at: i });
  t.mf = s.mf + 1;
  return place(t, a, i);
}

function finish(s, n) {
  if (n < 2) return E(1, 'short', { at: 0 });
  if (!s.fin) return E(2, 'v2-missing', { first: s.vf, at: 0 });
  if (!s.subj) return E(3, 'no-subj', { s, at: s.finPos });
  const { fin, rb } = s;
  const simpleTense = fin.tense === 'praes' ? 'praesens' : 'praeteritum';
  let mode;
  let tense;
  let main;
  let aux = null;
  let modal = null;

  if (fin.fk === 'lex' || fin.fk === 'cop') {
    if (fin.sep) {
      if (!rb) return E(4, 'sep-missing', { s, at: s.finPos });
      if (rb.rk !== 'ptcl') return E(4, 'lex-rb', { s, at: s.rbPos });
      if (rb.prefix !== fin.sep) return E(5, 'sep-wrong', { s, at: s.rbPos });
    } else if (rb) {
      return rb.rk === 'ptcl' ? E(5, 'ptcl-wrong', { s, at: s.rbPos }) : E(4, 'lex-rb', { s, at: s.rbPos });
    }
    mode = 'simple';
    tense = simpleTense;
    main = fin.lemma;
  } else if (fin.fk === 'aux') {
    if (!rb) return E(4, 'aux-no-rb', { s, at: s.finPos });
    if (rb.rk === 'ptcl') return E(5, 'ptcl-wrong', { s, at: s.rbPos });
    main = rb.lemma;
    if (fin.aux === 'werden') {
      if (rb.rk === 'inf') {
        if (fin.tense !== 'praes') return E(5, 'wurde-inf', { s, at: s.finPos });
        mode = 'futur';
        tense = 'futur1';
      } else {
        mode = 'passive';
        tense = simpleTense;
      }
    } else {
      if (rb.rk === 'inf') return E(5, 'aux-inf', { s, at: s.rbPos });
      aux = fin.aux;
      mode = fin.tense === 'praes' ? 'perfekt' : 'plusq';
      tense = fin.tense === 'praes' ? 'perfekt' : 'plusquamperfekt';
      if (VERBS[main].aux !== aux) return E(6, 'aux-wrong', { s, need: VERBS[main].aux, at: s.finPos });
    }
  } else {
    if (!rb) return E(4, 'modal-no-inf', { s, at: s.finPos });
    if (rb.rk !== 'inf') return E(5, rb.rk === 'part2' ? 'modal-part2' : 'ptcl-wrong', { s, at: s.rbPos });
    mode = 'modal';
    modal = fin.lemma;
    tense = simpleTense;
    main = rb.lemma;
  }

  const v = VERBS[main];
  const ctx = { s, main, v };
  if (mode === 'passive') {
    if (v.copula || v.obj === 'none') return E(6, 'passive-intrans', { ...ctx, at: s.rbPos });
    if (s.obj) return E(5, 'passive-obj', { ...ctx, at: s.objPos });
    if (s.adj) return E(5, 'adj-no-cop', { ...ctx, at: s.adjPos });
    if (!tagsMatch(s.subj.tags, v.objTags)) return E(7, 'sem-passive', { ...ctx, at: s.subjPos });
  } else if (v.copula) {
    if (s.obj) return E(5, 'cop-obj', { ...ctx, at: s.objPos });
    if (!s.adj) return E(5, 'cop-no-adj', { ...ctx, at: s.finPos });
    if (!tagsMatch(s.subj.tags, s.adj.tags)) {
      const trap = s.adj.coldTrap && s.subj.tags.includes('human');
      return E(7, trap ? 'cold-trap' : 'sem-adj', { ...ctx, at: s.adjPos });
    }
  } else {
    if (s.adj) return E(5, 'adj-no-cop', { ...ctx, at: s.adjPos });
    if (v.obj === 'none' && s.obj) return E(5, 'obj-none', { ...ctx, at: s.objPos });
    if (v.obj === 'req' && !s.obj) return E(5, 'obj-req', { ...ctx, at: s.finPos });
    if (!tagsMatch(s.subj.tags, v.subj || ANIMATE)) return E(7, 'sem-subj', { ...ctx, at: s.subjPos });
    if (s.obj && !tagsMatch(s.obj.tags, v.objTags)) return E(7, 'sem-obj', { ...ctx, at: s.objPos });
  }

  const past = PAST.has(tense);
  for (const adv of s.advs) {
    const at = s.picks.indexOf(adv);
    if (adv.past && !past) return E(6, 'adv-past', { ...ctx, adv, at });
    if (adv.future && past) return E(6, 'adv-future', { ...ctx, adv, at });
    if (adv.now && (tense === 'praeteritum' || tense === 'plusquamperfekt')) return E(6, 'adv-now', { ...ctx, adv, at });
  }

  if (s.nicht >= 0 && s.obj && s.obj.det === 'kein') return E(6, 'double-neg', { ...ctx, at: s.nicht });
  if (s.nicht >= 0 && !s.nichtScoped && s.obj && s.obj.np && !s.obj.zeroOnly && s.obj.g !== 'prop' && (s.obj.det === 'indef' || s.obj.det === 'zero')) {
    return E(6, 'nicht-kein', { ...ctx, at: s.objPos });
  }

  return {
    ok: {
      words: s.picks.map(a => a.text),
      picks: s.picks,
      subj: s.subj,
      obj: s.obj,
      fin,
      rb,
      advs: s.advs,
      adj: s.adj,
      vf: s.vf,
      person: s.person,
      mode,
      tense,
      main,
      aux,
      modal,
      question: s.question,
      inversion: !s.question && !!s.vf && s.vf.r !== 'subj',
      negation: s.nicht >= 0 ? 'nicht' : s.obj && s.obj.det === 'kein' ? 'kein' : null,
      separable: !!v.sep,
      accMasc: !!(s.obj && s.obj.masc),
      nounSubj: !!s.subj.np,
      copula: !!v.copula,
      passive: mode === 'passive',
      len: n,
      subjPos: s.subjPos,
    },
  };
}

// Returns { ok, viable, parse | error }.
// viable: some reading survives every word so far, so adding words could still work.
// strict: drop readings with soft slips at once (the board search only needs valid ones).
export function analyze(words, { strict = false } = {}) {
  const n = words.length;
  const toks = words.map(w => LEX.get(w));
  if (!n || toks.some(t => !t)) return { ok: false, viable: false, error: { depth: 0, code: n ? 'unknown' : 'short', ctx: {} } };
  let best = null;
  let bestErr = null;
  let viable = false;
  const fail = (e, s) => {
    // A reading that already needed repairs explains less, and a meaning
    // complaint ("Grammar ✓, but …") only makes sense for a clean reading.
    const meaning = e.code.startsWith('sem-') || e.code === 'cold-trap';
    const depth = s.soft.length ? (meaning ? 0 : e.depth - 3 * s.soft.length) : e.depth;
    if (!bestErr || depth > bestErr.depth) bestErr = { ...e, depth };
  };
  const rec = (s, i) => {
    if (i === n) {
      if (!s.soft.length) viable = true;
      const r = finish(s, n);
      if (r.err) fail(r.err, s);
      else if (s.soft.length) {
        const e = s.soft[0];
        const depth = 10 - s.soft.length;
        if (!bestErr || depth > bestErr.depth) bestErr = { ...e, depth };
      } else if (!best || r.ok.subjPos < best.subjPos) best = r.ok;
      return;
    }
    for (const a of toks[i]) {
      const r = step(s, a, i);
      if (r.err) fail(r.err, s);
      else if (!(strict && r.soft.length)) rec(r, i + 1);
    }
  };
  rec(START, 0);
  return best ? { ok: true, viable, parse: best } : { ok: false, viable, error: bestErr };
}

export function formatSentence(words, question = false) {
  if (!words.length) return '';
  const text = words.join(' ');
  return cap(text) + (question ? '?' : '.');
}

// ---------------------------------------------------------------------------
// Explanations

const Q = s => `«${s}»`;
const EXAMPLE_OBJ = {
  food: 'einen Apfel',
  drink: 'Kaffee',
  text: 'ein Buch',
  thing: 'ein Auto',
  human: 'den Lehrer',
  animal: 'den Hund',
  place: 'Berlin',
  task: 'Hausaufgaben',
  game: 'Fußball',
  music: 'Musik',
  film: 'den Film',
  any: 'den Hund',
};

function gloss(v) {
  return v.en[0] + (v.enSfx ? ' ' + v.enSfx : '');
}

function subjLead(s) {
  return s.subj ? s.subj.text : 'ich';
}

export function explain(error) {
  const c = error.ctx || {};
  const s = c.s;
  const v = c.v;
  let title = 'Hoppla!';
  let text = 'These words don’t make a sentence yet.';
  switch (error.code) {
    case 'short':
      title = 'Zu kurz';
      text = 'A sentence needs at least a subject and a verb, like «Ich esse».';
      break;
    case 'rb-first':
      title = 'Ans Ende!';
      text = `${Q(c.a.text)} belongs at the end of the sentence: «Ich habe … ${c.a.text}».`;
      break;
    case 'nicht-first':
      title = 'Nicht hier';
      text = '«nicht» can’t open a sentence. It goes near the end: «Ich schlafe nicht».';
      break;
    case 'adj-first':
      title = 'Ans Ende!';
      text = `Start with the subject. The adjective goes at the end: «Ich bin ${c.a.text}».`;
      break;
    case 'v2':
      title = 'Verb an Position 2!';
      text = `The conjugated verb is always the 2nd element. After ${Q(c.first.text)} comes the verb: «${cap(c.first.text)} + Verb + …».`;
      break;
    case 'v2-missing':
      title = 'Verb fehlt';
      text = 'Every sentence needs a conjugated verb in position 2.';
      break;
    case 'wh-late':
      title = 'Fragewort zuerst';
      text = `Question words open the question: «${cap(c.a.text)} … ?»`;
      break;
    case 'after-rb':
      title = 'Ans Ende!';
      text = `${Q(c.rb.text)} closes the sentence, so it must be the last word.`;
      break;
    case 'two-fin':
      title = 'Ein Verb zu viel';
      text = 'Only one conjugated verb per sentence. A second verb goes to the end as infinitive or Partizip II.';
      break;
    case 'after-adj':
      title = 'Adjektiv ans Ende';
      text = `The adjective comes last: «Ich bin heute ${c.adj.text}».`;
      break;
    case 'subj-after-fin':
      title = 'Wer?';
      text = 'The subject comes right after the verb when something else is first: «Heute isst der Hund Pizza», «Isst du Pizza?».';
      break;
    case 'two-subj':
      title = 'Zwei Subjekte?';
      text = 'A sentence has one subject. The other noun needs the accusative: den Hund, einen Apfel, mich, ihn …';
      break;
    case 'two-obj':
      title = 'Ein Objekt reicht';
      text = 'These verbs take just one object.';
      break;
    case 'dup':
      title = 'Doppelt';
      text = `${Q(c.a.text)} twice? Once is enough.`;
      break;
    case 'two-time':
      title = 'Zwei Zeitangaben';
      text = 'Use one time word per sentence: heute, gestern, morgen …';
      break;
    case 'nicht-before-obj':
      title = 'Wohin mit nicht?';
      text = `«nicht» goes after the object: «… ${c.a.text} nicht». With «ein» or no article, use «kein»: keinen Apfel, keine Pizza.`;
      break;
    case 'pron-late':
      title = 'Pronomen nach vorn';
      text = `Short pronouns like ${Q(c.a.text)} come right after the verb and subject, before adverbs and «nicht»: «Er liest ${c.a.text} gern», «Ich sehe ${c.a.text} nicht».`;
      break;
    case 'nicht-before-adv':
      title = 'Wohin mit nicht?';
      text = `«nicht» goes after time words, near the end: «Ich komme ${c.a.text} nicht».`;
      break;
    case 'case-subj':
      if (c.a.keinSubj) {
        title = 'kein als Objekt';
        text = `Here «kein» negates the object: «Ich habe ${c.a.text}».`;
      } else {
        title = 'Nominativ!';
        text = `The subject takes the nominative: ${Q(c.a.nomText)}, not ${Q(c.a.text)}.`;
      }
      break;
    case 'case-obj':
      title = 'Akkusativ!';
      text = `The object takes the accusative: ${Q(c.a.accText)}, not ${Q(c.a.text)}.`;
      if (c.a.np && c.a.g === 'm') text += ' Only masculine changes: der → den, ein → einen.';
      if (c.a.pron) text += ' Pronouns: ich → mich, du → dich, er → ihn, wir → uns.';
      break;
    case 'agree': {
      title = 'Konjugation';
      const right = uniq(c.subj.ps.map(p => `${c.subj.text} ${finiteForm(c.fin, p)}`));
      text = `${right.map(Q).join(' or ')}, not ${Q(`${c.subj.text} ${c.fin.text}`)}.`;
      break;
    }
    case 'no-subj':
      title = 'Wer?';
      text = 'The sentence needs a subject: ich, du, der Hund …';
      break;
    case 'sep-missing':
      title = 'Trennbares Verb';
      text = `${Q(s.fin.lemma)} splits: the prefix goes to the end. «${cap(subjLead(s))} ${s.fin.text} … ${s.fin.sep}».`;
      break;
    case 'sep-wrong':
      title = 'Falsches Präfix';
      text = `${Q(s.rb.text)} doesn’t fit here. ${s.fin.lemma} → «${s.fin.text} … ${s.fin.sep}».`;
      break;
    case 'ptcl-wrong':
      title = 'Falsches Präfix';
      text = `${Q(s.rb.text)} doesn’t belong to ${Q(s.fin.text)}.`;
      break;
    case 'lex-rb':
      title = 'Nur ein Hauptverb';
      text = `${Q(s.fin.text)} is a full verb and can’t take ${Q(s.rb.text)}. Perfekt is haben/sein + Partizip («ich habe gegessen»); an infinitive needs a modal («ich kann essen»).`;
      break;
    case 'aux-no-rb':
      title = 'Partizip fehlt';
      text = `${Q(s.fin.text)} as a helper verb needs a Partizip II at the end: «${cap(subjLead(s))} ${s.fin.text} … gegessen».`;
      break;
    case 'aux-inf': {
      title = 'Partizip II!';
      const part = VERBS[s.rb.lemma].part;
      text = `The Perfekt needs the Partizip II: ${Q(part)}, not ${Q(s.rb.text)}.`;
      break;
    }
    case 'aux-wrong': {
      title = 'haben oder sein?';
      const auxForm = VERBS[c.need][s.fin.tense][s.person];
      text = `${Q(s.rb.lemma)} builds the Perfekt with ${Q(c.need)}: «${subjLead(s)} ${auxForm} … ${s.rb.text}».`;
      text += c.need === 'sein' ? ' Movement and change of place take sein.' : ' Most verbs take haben.';
      break;
    }
    case 'wurde-inf':
      title = 'Futur mit werden';
      text = `Futur I uses the present of werden: «ich werde … ${s.rb.text}». «wurde» + Partizip II is the passive.`;
      break;
    case 'modal-no-inf':
      title = 'Infinitiv fehlt';
      text = `Modal verbs need an infinitive at the end: «${cap(subjLead(s))} ${s.fin.text} … schwimmen».`;
      break;
    case 'modal-part2':
      title = 'Infinitiv!';
      text = `After a modal verb comes the infinitive: ${Q(s.rb.lemma)}, not ${Q(s.rb.text)}.`;
      break;
    case 'passive-intrans':
      title = 'Kein Passiv';
      text = `${Q(c.main)} has no object, so it has no passive. Try «Die Pizza wird gegessen».`;
      break;
    case 'passive-obj':
      title = 'Passiv';
      text = 'In the passive the object becomes the subject, so there is no accusative object left.';
      break;
    case 'cop-obj':
      title = 'Kein Objekt';
      text = `${Q(c.main)} doesn’t take an accusative object. Try an adjective: «Ich bin müde».`;
      break;
    case 'cop-no-adj':
      title = 'Wie?';
      text = `${Q(c.main)} needs an adjective here: «Ich bin müde», «Der Kaffee ist heiß».`;
      break;
    case 'adj-no-cop':
      title = 'Adjektiv';
      text = `Adjectives like ${Q(s.adj ? s.adj.text : 'müde')} go with sein or werden: «Ich bin ${s.adj ? s.adj.text : 'müde'}».`;
      break;
    case 'obj-none':
      title = 'Kein Objekt';
      text = `${Q(c.main)} doesn’t take an accusative object.`;
      break;
    case 'obj-req': {
      title = 'Was?';
      const ex = EXAMPLE_OBJ[v.objTags[0]] || 'den Hund';
      const tail = s.rb ? ` ${s.rb.text}` : '';
      text = `${Q(c.main)} needs an object: «${cap(subjLead(s))} ${s.fin.text} ${ex}${tail}».`;
      break;
    }
    case 'sem-subj':
      title = 'Sinn?';
      text = `Grammar ✓, but ${s.subj.en} can’t ${gloss(v)}!`;
      break;
    case 'sem-obj':
      title = 'Sinn?';
      text = `Grammar ✓, but you can’t ${gloss(v)} ${s.obj.en}!`;
      break;
    case 'sem-passive':
      title = 'Sinn?';
      text = `Grammar ✓, but ${s.subj.en} can’t be ${v.en[3]}!`;
      break;
    case 'sem-adj':
      title = 'Sinn?';
      text = `Grammar ✓, but does ${Q(s.adj.text)} (${s.adj.en}) really fit ${Q(s.subj.text)}?`;
      break;
    case 'cold-trap':
      title = 'Vorsicht!';
      text = `«Ich bin ${s.adj.text}» sounds like ${s.adj.word === 'kalt' ? '“I’m cold-hearted”' : '“I’m hot” in the flirty sense'}. Germans say «Mir ist ${s.adj.text}». For things it works: «Der Kaffee ist ${s.adj.text}».`;
      break;
    case 'adv-past':
      title = 'Zeitform';
      text = `${Q(c.adv.word)} needs a past tense: «${cap(c.adv.word)} habe ich … gegessen», «${cap(c.adv.word)} war ich müde».`;
      break;
    case 'adv-future':
      title = 'Zeitform';
      text = `${Q(c.adv.word)} points to the future: use Präsens or Futur I, «${cap(c.adv.word)} esse ich …», «${cap(c.adv.word)} werde ich … essen».`;
      break;
    case 'adv-now':
      title = 'Zeitform';
      text = '«jetzt» doesn’t fit the Präteritum. Use Präsens: «Jetzt esse ich».';
      break;
    case 'double-neg':
      title = 'Doppelt verneint';
      text = `${Q(s.obj.text)} already negates. Drop «nicht».`;
      break;
    case 'nicht-kein': {
      title = 'kein statt nicht';
      const kein = npText(s.obj.noun, 'kein', 'acc');
      text = `Nouns with «ein» or without article are negated with kein: ${Q(kein)} instead of «nicht … ${s.obj.text}».`;
      break;
    }
  }
  return { title, text, at: c.at ?? -1 };
}

// Tries every word order of the same tiles and returns the closest valid one.
export function suggest(words) {
  const n = words.length;
  if (n < 2 || n > 7) return null;
  let best = null;
  let bestD = Infinity;
  const order = [];
  const used = new Array(n).fill(false);
  const distance = perm => {
    let d = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (perm[i] > perm[j]) d++;
    return d;
  };
  const rec = () => {
    const tried = new Set();
    for (let i = 0; i < n; i++) {
      if (used[i] || tried.has(words[i])) continue;
      tried.add(words[i]);
      order.push(i);
      const r = analyze(order.map(k => words[k]));
      if (r.viable) {
        if (order.length === n) {
          if (r.ok && order.some((k, j) => k !== j)) {
            const d = distance(order) + (r.parse.question ? 0.5 : 0);
            if (d < bestD) {
              bestD = d;
              best = r.parse;
            }
          }
        } else {
          used[i] = true;
          rec();
          used[i] = false;
        }
      }
      order.pop();
    }
  };
  rec();
  return best ? formatSentence(best.words, !!best.question) : null;
}
