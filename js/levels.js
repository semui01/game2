// Level design. Each level teaches one grammar topic: the tile mix favours it
// and the goals ask for it. Example sentences are lists of tiles.

import { W } from './lexicon.js';

const PRON = W.pron('nom');
const PRON_ACC = W.pron('acc', ['mich', 'dich', 'ihn', 'uns', 'euch']);
const ANIMALS = ['Hund', 'Katze', 'Vogel'];
const PEOPLE = ['Kind', 'Mann', 'Frau', 'Lehrer', 'Oma', 'Mädchen', 'Kinder', 'Eltern'];
const NP_SUBJ = W.np([...ANIMALS, ...PEOPLE], 'def', 'nom');
const FOOD = W.np(['Pizza', 'Brot', 'Suppe', 'Kuchen', 'Salat', 'Schokolade', 'Nudeln'], 'zero', 'acc');
const DRINK = W.np(['Kaffee', 'Tee', 'Wasser', 'Milch', 'Saft'], 'zero', 'acc');
const READ = ['ein Buch', 'eine Zeitung', 'einen Brief', 'eine Geschichte'];
const GAMES = ['Fußball', 'Tennis', 'Schach', 'Gitarre'];
const OBJ_EASY = [...FOOD, ...DRINK, ...READ, ...GAMES];

const V_EASY = ['essen', 'trinken', 'schlafen', 'spielen', 'lesen', 'kommen', 'gehen', 'tanzen', 'lachen', 'arbeiten', 'schwimmen', 'kochen', 'singen'];
const V_TRANS = ['sehen', 'kaufen', 'haben', 'lieben', 'brauchen', 'finden', 'suchen', 'besuchen', 'mögen'];
const V_MOTION = ['gehen', 'kommen', 'fahren', 'schwimmen', 'laufen', 'fliegen', 'bleiben'];
const V_PERF_HABEN = ['essen', 'trinken', 'lesen', 'spielen', 'schlafen', 'kaufen', 'arbeiten', 'lachen', 'tanzen', 'schreiben', 'kochen', 'machen', 'sehen'];
const SEP = ['aufstehen', 'einkaufen', 'anrufen', 'fernsehen', 'mitkommen', 'einladen', 'anfangen'];
const ADJ = ['müde', 'hungrig', 'durstig', 'glücklich', 'traurig', 'krank'];

// Tiles are wider than tall (words are horizontal), so the board is 5 × 8.
const R = 8;
const C = 5;
const JELLY_CORE = ['.....', '.....', '.....', '.###.', '.###.', '.....', '.....', '.....'];
const JELLY_BAND = ['.....', '.....', '.....', '.....', '.....', '#####', '.....', '.....'];
const JELLY_X = ['.....', '.#.#.', '..#..', '.#.#.', '..#..', '.#.#.', '.....', '.....'];

const sentences = (count, label, test) => ({ type: 'sentences', count, label, test });

export const LEVELS = [
  {
    id: 1,
    topic: 'Präsens',
    title: 'Ich esse.',
    intro: 'Start simple: subject + verb. Drag across touching tiles (diagonals count) to build a sentence. The verb ending has to fit the subject: ich esse, du isst, wir essen.',
    examples: [
      [['ich', 'esse'], 'I eat.'],
      [['du', 'trinkst', 'Kaffee'], 'You drink coffee.'],
      [['wir', 'spielen', 'Fußball'], 'We play football.'],
    ],
    moves: 14,
    goals: [sentences(6, 'Sätze', () => true)],
    stars: [0, 950, 1400],
    spawn: [
      { w: 30, words: PRON },
      { w: 32, agree: true, words: W.fin(V_EASY, 'praes') },
      { w: 28, words: [...FOOD, ...DRINK, 'ein Buch', 'eine Zeitung', ...GAMES] },
      { w: 8, words: ['heute', 'gern', 'oft', 'jetzt'] },
    ],
  },
  {
    id: 2,
    topic: 'Nomen als Subjekt',
    title: 'Der Hund schläft.',
    intro: 'Nouns come with an article: der (masculine), die (feminine), das (neuter). A singular noun takes the er/sie/es form, a plural the sie form: Der Hund schläft. Die Kinder spielen.',
    examples: [
      [['der Hund', 'schläft'], 'The dog sleeps.'],
      [['die Kinder', 'spielen', 'Fußball'], 'The children play football.'],
      [['die Katze', 'trinkt', 'Milch'], 'The cat drinks milk.'],
    ],
    moves: 15,
    goals: [sentences(5, 'Nomen-Subjekt', i => i.nounSubj)],
    stars: [0, 1000, 1350],
    spawn: [
      { w: 26, words: NP_SUBJ },
      { w: 8, words: ['ich', 'du', 'wir'] },
      { w: 34, agree: true, words: W.fin([...V_EASY, 'laufen', 'fliegen'], 'praes') },
      { w: 24, words: OBJ_EASY },
      { w: 8, words: ['heute', 'gern', 'oft', 'immer'] },
    ],
  },
  {
    id: 3,
    topic: 'Akkusativ',
    title: 'Ich sehe den Hund.',
    intro: 'The object of the verb takes the accusative. Only masculine words change: der → den, ein → einen. Feminine, neuter and plural stay the same: die Katze, das Buch.',
    examples: [
      [['ich', 'sehe', 'den Hund'], 'I see the dog.'],
      [['du', 'kaufst', 'einen Apfel'], 'You buy an apple.'],
      [['der Lehrer', 'liebt', 'die Katze'], 'The teacher loves the cat.'],
    ],
    moves: 16,
    goals: [sentences(4, 'Akkusativ (den/einen)', i => i.accMasc)],
    stars: [0, 1250, 1500],
    spawn: [
      { w: 22, words: PRON },
      { w: 8, words: W.np(['Hund', 'Mann', 'Lehrer', 'Junge', 'Opa'], 'def', 'nom') },
      { w: 30, agree: true, words: W.fin([...V_TRANS, 'essen', 'trinken'], 'praes') },
      { w: 24, words: [...W.np(['Hund', 'Apfel', 'Kuchen', 'Lehrer', 'Ball', 'Film', 'Freund', 'Brief', 'Opa', 'Junge'], 'def', 'acc'), ...W.np(['Apfel', 'Kuchen', 'Ball', 'Saft', 'Hund'], 'indef', 'acc')] },
      { w: 10, words: ['die Katze', 'das Buch', 'eine Tasche', 'ein Auto', 'die Oma', 'Pizza', 'Kaffee'] },
      { w: 6, words: ['heute', 'gern', 'oft'] },
    ],
  },
  {
    id: 4,
    topic: 'Inversion',
    title: 'Heute esse ich Pizza.',
    intro: 'The conjugated verb always stays in position 2. If a time word comes first, the subject moves behind the verb: Heute esse ich Pizza. Morgen spielt der Hund.',
    examples: [
      [['heute', 'esse', 'ich', 'Pizza'], 'Today I eat pizza.'],
      [['morgen', 'spielt', 'der Hund'], 'Tomorrow the dog plays.'],
      [['oft', 'trinken', 'wir', 'Tee'], 'We often drink tea.'],
    ],
    moves: 16,
    goals: [sentences(4, 'Inversion', i => i.inversion)],
    stars: [0, 1300, 1700],
    spawn: [
      { w: 18, words: ['heute', 'morgen', 'jetzt', 'oft', 'gern', 'immer', 'bald'] },
      { w: 24, words: PRON },
      { w: 8, words: NP_SUBJ },
      { w: 30, agree: true, words: W.fin(V_EASY, 'praes') },
      { w: 20, words: OBJ_EASY },
    ],
  },
  {
    id: 5,
    topic: 'Perfekt mit haben',
    title: 'Ich habe gegessen.',
    intro: 'Perfekt = haben in position 2 + Partizip II at the very end. Ich habe Pizza gegessen. In English this is usually the simple past: I ate pizza.',
    examples: [
      [['ich', 'habe', 'Pizza', 'gegessen'], 'I ate pizza.'],
      [['gestern', 'hat', 'der Hund', 'geschlafen'], 'Yesterday the dog slept.'],
      [['wir', 'haben', 'Fußball', 'gespielt'], 'We played football.'],
    ],
    moves: 16,
    goals: [sentences(4, 'Perfekt', i => i.tense === 'perfekt')],
    stars: [0, 1500, 1900],
    spawn: [
      { w: 20, words: PRON },
      { w: 6, words: NP_SUBJ },
      { w: 22, agree: true, words: W.aux('haben') },
      { w: 22, words: W.part(V_PERF_HABEN) },
      { w: 20, words: [...OBJ_EASY, 'einen Apfel', 'den Film', 'Hausaufgaben'] },
      { w: 10, words: ['gestern', 'heute', 'gern', 'oft'] },
    ],
  },
  {
    id: 6,
    topic: 'Perfekt mit sein',
    title: 'Ich bin gegangen.',
    intro: 'Verbs of movement and change of place build the Perfekt with sein: ich bin gegangen, du bist gefahren, wir sind geblieben. Most other verbs take haben.',
    examples: [
      [['ich', 'bin', 'gegangen'], 'I went.'],
      [['gestern', 'sind', 'wir', 'geschwommen'], 'Yesterday we swam.'],
      [['der Vogel', 'ist', 'geflogen'], 'The bird flew.'],
    ],
    moves: 16,
    goals: [sentences(4, 'Perfekt mit sein', i => i.tense === 'perfekt' && i.aux === 'sein')],
    stars: [0, 1450, 1850],
    spawn: [
      { w: 20, words: PRON },
      { w: 8, words: NP_SUBJ },
      { w: 16, agree: true, words: W.aux('sein') },
      { w: 8, agree: true, words: W.aux('haben') },
      { w: 26, matchAux: true, words: [...W.part(V_MOTION), ...W.part(['essen', 'schlafen', 'spielen'])] },
      { w: 10, words: ['Pizza', 'Fußball', 'Kaffee'] },
      { w: 10, words: ['gestern', 'heute', 'oft'] },
    ],
  },
  {
    id: 7,
    topic: 'Gelee',
    title: 'Gelee-Party',
    intro: 'Pink cells hold jelly. Use the tile on a jelly cell in a sentence to clear it. Long sentences make special tiles: 4 words → line, 5 → bomb, 6 → star. Use them to clear many cells at once.',
    examples: [
      [['heute', 'habe', 'ich', 'Kuchen', 'gegessen'], 'Today I ate cake. (5 words → bomb tile)'],
      [['wir', 'sind', 'gestern', 'gelaufen'], 'We ran yesterday.'],
    ],
    moves: 22,
    jelly: JELLY_CORE,
    goals: [{ type: 'jelly', label: 'Gelee' }],
    stars: [0, 2150, 2950],
    spawn: [
      { w: 22, words: PRON },
      { w: 8, words: NP_SUBJ },
      { w: 16, agree: true, words: W.fin(V_EASY, 'praes') },
      { w: 10, agree: true, words: [...W.aux('haben'), ...W.aux('sein')] },
      { w: 14, matchAux: true, words: W.part([...V_PERF_HABEN.slice(0, 8), ...V_MOTION.slice(0, 4)]) },
      { w: 18, words: OBJ_EASY },
      { w: 10, words: ['heute', 'gestern', 'gern', 'oft'] },
    ],
  },
  {
    id: 8,
    topic: 'Modalverben',
    title: 'Ich kann schwimmen.',
    intro: 'Modal verbs (können, wollen, müssen, dürfen, möchten) sit in position 2, the second verb goes to the end as an infinitive: Ich kann schwimmen. Wir wollen Pizza essen.',
    examples: [
      [['ich', 'kann', 'schwimmen'], 'I can swim.'],
      [['du', 'musst', 'Hausaufgaben', 'machen'], 'You have to do homework.'],
      [['wir', 'möchten', 'Kuchen', 'essen'], 'We would like to eat cake.'],
    ],
    moves: 16,
    goals: [sentences(5, 'Modalverb', i => !!i.modal)],
    stars: [0, 1650, 2200],
    spawn: [
      { w: 20, words: PRON },
      { w: 6, words: NP_SUBJ },
      { w: 22, agree: true, words: W.modal(['können', 'wollen', 'müssen', 'möchten', 'dürfen']) },
      { w: 22, words: W.inf(['schwimmen', 'essen', 'trinken', 'schlafen', 'spielen', 'lesen', 'gehen', 'tanzen', 'arbeiten', 'machen', 'kaufen', 'kommen']) },
      { w: 20, words: [...OBJ_EASY, 'Hausaufgaben', 'Sport'] },
      { w: 10, words: ['heute', 'morgen', 'jetzt', 'gern'] },
    ],
  },
  {
    id: 9,
    topic: 'Präteritum',
    title: 'Ich war müde.',
    intro: 'The Präteritum is the past of stories and of sein, haben and modal verbs: ich war, ich hatte, ich konnte, ich ging. Gestern war ich müde.',
    examples: [
      [['gestern', 'war', 'ich', 'müde'], 'Yesterday I was tired.'],
      [['der Hund', 'hatte', 'einen Ball'], 'The dog had a ball.'],
      [['wir', 'gingen', 'oft'], 'We often went.'],
    ],
    moves: 16,
    goals: [sentences(5, 'Präteritum', i => i.tense === 'praeteritum')],
    stars: [0, 1300, 1700],
    spawn: [
      { w: 22, words: PRON },
      { w: 8, words: NP_SUBJ },
      { w: 26, agree: true, words: [...W.fin(['sein', 'haben', 'gehen', 'essen', 'kommen', 'sehen', 'lesen', 'schlafen', 'trinken', 'spielen'], 'praet')] },
      { w: 8, agree: true, words: W.modal(['können', 'wollen', 'müssen'], 'praet') },
      { w: 6, words: W.inf(['schwimmen', 'tanzen', 'arbeiten', 'essen']) },
      { w: 12, words: ADJ },
      { w: 12, words: ['Pizza', 'Kaffee', 'einen Ball', 'ein Buch', 'einen Hund', 'Fußball'] },
      { w: 8, words: ['gestern', 'oft', 'immer'] },
    ],
  },
  {
    id: 10,
    topic: 'Futur I',
    title: 'Morgen werde ich …',
    intro: 'Futur I = werden in position 2 + infinitive at the end: Ich werde schlafen. Morgen wird es kalt sein. Clear the jelly while you go.',
    examples: [
      [['ich', 'werde', 'schlafen'], 'I will sleep.'],
      [['morgen', 'werden', 'wir', 'Pizza', 'essen'], 'Tomorrow we will eat pizza.'],
      [['es', 'wird', 'kalt', 'sein'], 'It will be cold.'],
    ],
    moves: 22,
    jelly: JELLY_BAND,
    goals: [sentences(3, 'Futur I', i => i.tense === 'futur1'), { type: 'jelly', label: 'Gelee' }],
    stars: [0, 2800, 3800],
    spawn: [
      { w: 20, words: PRON },
      { w: 6, words: NP_SUBJ },
      { w: 18, agree: true, words: W.aux('werden') },
      { w: 20, words: W.inf(['schlafen', 'essen', 'trinken', 'spielen', 'lesen', 'gehen', 'kommen', 'sein', 'arbeiten', 'tanzen']) },
      { w: 6, words: ['müde', 'kalt', 'glücklich', 'hungrig'] },
      { w: 16, words: OBJ_EASY },
      { w: 10, words: ['morgen', 'bald', 'heute', 'jetzt'] },
      { w: 6, agree: true, words: W.fin(['essen', 'spielen', 'schlafen'], 'praes') },
    ],
  },
  {
    id: 11,
    topic: 'Fragen',
    title: 'Isst du Pizza?',
    intro: 'Yes/no question: the verb comes first. Isst du Pizza? W-question: question word first, then the verb: Was isst du? Wo schläft der Hund?',
    examples: [
      [['isst', 'du', 'Pizza'], 'Do you eat pizza?'],
      [['was', 'trinkt', 'ihr'], 'What do you all drink?'],
      [['wo', 'schläft', 'der Hund'], 'Where does the dog sleep?'],
    ],
    moves: 16,
    goals: [sentences(3, 'Ja/Nein-Fragen', i => i.question === 'yn'), sentences(3, 'W-Fragen', i => i.question === 'w')],
    stars: [0, 1200, 1550],
    spawn: [
      { w: 14, words: ['was', 'wer', 'wann', 'wo', 'warum', 'wen'] },
      { w: 30, agree: true, words: W.fin([...V_EASY, 'sehen', 'kaufen'], 'praes') },
      { w: 22, words: PRON },
      { w: 8, words: NP_SUBJ },
      { w: 16, words: OBJ_EASY },
      { w: 6, words: ['heute', 'gern', 'oft'] },
    ],
  },
  {
    id: 12,
    topic: 'Negation',
    title: 'Nicht oder kein?',
    intro: '«nicht» negates verbs, adjectives and definite things, and it goes near the end: Ich schlafe nicht. Ich sehe den Hund nicht. Nouns with «ein» or no article take kein: keine Pizza, keinen Apfel.',
    examples: [
      [['ich', 'schlafe', 'nicht'], 'I don’t sleep.'],
      [['wir', 'essen', 'keine Pizza'], 'We don’t eat any pizza.'],
      [['du', 'bist', 'nicht', 'müde'], 'You are not tired.'],
    ],
    moves: 16,
    goals: [sentences(5, 'Negation', i => !!i.negation)],
    stars: [0, 1550, 1900],
    spawn: [
      { w: 20, words: PRON },
      { w: 6, words: NP_SUBJ },
      { w: 24, agree: true, words: W.fin([...V_EASY.slice(0, 8), 'sehen', 'haben', 'mögen'], 'praes') },
      { w: 6, agree: true, words: W.fin(['sein'], 'praes') },
      { w: 10, words: ['nicht'] },
      { w: 12, words: [...W.np(['Pizza', 'Apfel', 'Kaffee', 'Buch', 'Hund', 'Kuchen', 'Saft', 'Fußball'], 'kein', 'acc')] },
      { w: 10, words: ['den Hund', 'die Katze', 'das Buch', 'den Film', 'Fußball', 'Tennis'] },
      { w: 6, words: ['müde', 'hungrig', 'krank'] },
      { w: 6, words: ['heute', 'gern', 'oft'] },
    ],
  },
  {
    id: 13,
    topic: 'Trennbare Verben',
    title: 'Ich stehe auf.',
    intro: 'Separable verbs split up: the prefix goes to the very end. aufstehen → Ich stehe auf. anrufen → Ich rufe dich an. In the Perfekt, ge- sits inside: aufgestanden, eingekauft.',
    examples: [
      [['ich', 'stehe', 'auf'], 'I get up.'],
      [['ich', 'rufe', 'dich', 'an'], 'I call you.'],
      [['heute', 'kaufen', 'wir', 'ein'], 'Today we go shopping.'],
    ],
    moves: 16,
    goals: [sentences(4, 'Trennbar', i => i.separable)],
    stars: [0, 1700, 1950],
    spawn: [
      { w: 20, words: PRON },
      { w: 6, words: NP_SUBJ },
      { w: 24, agree: true, words: W.fin(SEP, 'praes') },
      { w: 18, words: W.ptcl(SEP) },
      { w: 12, words: [...PRON_ACC, 'den Lehrer', 'die Oma'] },
      { w: 10, words: ['heute', 'morgen', 'jetzt', 'gern'] },
      { w: 4, agree: true, words: [...W.aux('haben'), ...W.aux('sein')] },
      { w: 6, matchAux: true, words: W.part(SEP) },
    ],
  },
  {
    id: 14,
    topic: 'Passiv',
    title: 'Die Pizza wird gegessen.',
    intro: 'Passive = werden + Partizip II. The object of the active sentence becomes the subject: Ich esse die Pizza → Die Pizza wird gegessen. Past: Das Buch wurde gelesen.',
    examples: [
      [['die Pizza', 'wird', 'gegessen'], 'The pizza is eaten.'],
      [['das Buch', 'wurde', 'gestern', 'gelesen'], 'The book was read yesterday.'],
      [['der Kuchen', 'wird', 'oft', 'gekauft'], 'The cake is often bought.'],
    ],
    moves: 16,
    goals: [sentences(4, 'Passiv', i => i.passive)],
    stars: [0, 1550, 1800],
    spawn: [
      { w: 26, words: W.np(['Pizza', 'Buch', 'Kuchen', 'Brief', 'Auto', 'Apfel', 'Suppe', 'Zeitung', 'Kaffee', 'Film'], 'def', 'nom') },
      { w: 6, words: ['Nudeln', 'die Kinder'] },
      { w: 20, agree: true, words: [...W.aux('werden'), ...W.aux('werden', 'praet')] },
      { w: 22, words: W.part(['essen', 'lesen', 'kaufen', 'schreiben', 'kochen', 'trinken', 'sehen', 'finden']) },
      { w: 10, words: ['heute', 'gestern', 'oft', 'jetzt', 'immer'] },
      { w: 8, words: PRON },
      { w: 6, words: ['müde', 'kalt', 'lecker'] },
    ],
  },
  {
    id: 15,
    topic: 'Plusquamperfekt',
    title: 'Ich hatte gegessen.',
    intro: 'Plusquamperfekt = hatte / war + Partizip II: the past before the past. Ich hatte schon gegessen. Er war gegangen.',
    examples: [
      [['ich', 'hatte', 'Pizza', 'gegessen'], 'I had eaten pizza.'],
      [['er', 'war', 'gegangen'], 'He had gone.'],
      [['wir', 'hatten', 'Tennis', 'gespielt'], 'We had played tennis.'],
    ],
    moves: 16,
    goals: [sentences(4, 'Plusquamperfekt', i => i.tense === 'plusquamperfekt')],
    stars: [0, 1650, 2100],
    spawn: [
      { w: 20, words: PRON },
      { w: 8, words: NP_SUBJ },
      { w: 12, agree: true, words: W.aux('haben', 'praet') },
      { w: 10, agree: true, words: W.aux('sein', 'praet') },
      { w: 22, matchAux: true, words: W.part([...V_PERF_HABEN.slice(0, 7), ...V_MOTION.slice(0, 5)]) },
      { w: 18, words: OBJ_EASY },
      { w: 8, words: ['gestern', 'oft', 'immer'] },
    ],
  },
  {
    id: 16,
    topic: 'Meisterprüfung',
    title: 'Alles zusammen',
    intro: 'Everything at once: tenses, modal verbs, questions, negation. Clear the jelly and reach the score. Long sentences make special tiles, and they are your best tool here.',
    examples: [
      [['gestern', 'habe', 'ich', 'den Film', 'gesehen'], 'Yesterday I saw the film.'],
      [['kannst', 'du', 'morgen', 'mitkommen'], 'Can you come along tomorrow?'],
      [['wir', 'essen', 'nicht', 'gern', 'Suppe'], 'We don’t like to eat soup.'],
    ],
    moves: 22,
    jelly: JELLY_X,
    goals: [{ type: 'jelly', label: 'Gelee' }, { type: 'score', target: 3000, label: 'Punkte' }],
    stars: [0, 3400, 4100],
    spawn: [
      { w: 20, words: PRON },
      { w: 8, words: NP_SUBJ },
      { w: 14, agree: true, words: W.fin([...V_EASY, ...V_TRANS.slice(0, 4)], 'praes') },
      { w: 10, agree: true, words: [...W.aux('haben'), ...W.aux('sein'), ...W.modal(['können', 'wollen'])] },
      { w: 12, matchAux: true, words: [...W.part([...V_PERF_HABEN.slice(0, 6), ...V_MOTION.slice(0, 4)]), ...W.inf(['essen', 'schwimmen', 'mitkommen', 'spielen'])] },
      { w: 16, words: [...OBJ_EASY, 'den Film', 'einen Apfel', 'den Hund'] },
      { w: 10, words: ['heute', 'gestern', 'morgen', 'gern', 'oft', 'nicht'] },
      { w: 4, words: ['was', 'wo', 'wann'] },
    ],
  },
];

for (const l of LEVELS) {
  l.rows ??= R;
  l.cols ??= C;
}

export const FREE_PLAY = {
  id: 'frei',
  topic: 'Freies Spiel',
  title: 'Freies Spiel',
  intro: 'No move limit, no goals: every tense and pattern counts. Play for a high score and try long sentences.',
  examples: [],
  rows: R,
  cols: C,
  moves: Infinity,
  goals: [],
  stars: [0, Infinity, Infinity],
  spawn: [
    { w: 20, words: PRON },
    { w: 10, words: NP_SUBJ },
    { w: 16, agree: true, words: W.fin([...V_EASY, ...V_TRANS], 'praes') },
    { w: 6, agree: true, words: W.fin(['sein', 'haben', 'gehen', 'essen'], 'praet') },
    { w: 10, agree: true, words: [...W.aux('haben'), ...W.aux('sein'), ...W.aux('werden'), ...W.modal(['können', 'wollen', 'müssen', 'möchten'])] },
    { w: 12, matchAux: true, words: [...W.part([...V_PERF_HABEN.slice(0, 8), ...V_MOTION.slice(0, 5)]), ...W.inf(['essen', 'schwimmen', 'spielen', 'schlafen', 'lesen', 'sein'])] },
    { w: 16, words: [...OBJ_EASY, 'den Film', 'einen Apfel', 'den Hund', ...W.np(['Pizza', 'Apfel'], 'kein', 'acc')] },
    { w: 10, words: ['heute', 'gestern', 'morgen', 'gern', 'oft', 'nicht'] },
    { w: 4, words: [...ADJ.slice(0, 4), 'was', 'wo'] },
  ],
};
