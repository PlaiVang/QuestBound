// Original QuestBound sprites: a 16x16 grid, transparent dots, shared ink palette.
const palette: Record<string, string> = {
  k: '#0d0914', w: '#f3ead7', s: '#b3a5c9', g: '#ffcc33', o: '#ff8a3d',
  b: '#4fc3f7', d: '#28749c', v: '#8661b4', p: '#51366e', r: '#e85b59',
  c: '#8ed477', n: '#3e754e', t: '#efb58e', h: '#945d43',
};
const adventurer = [
  '.....kkkkkk.....', '....kAAAAAAk....', '...kAAAaAAAAk...',
  '...kAAAttAAAk...', '....kttttttk....', '....ktktktk.....',
  '.....kttttk.....', '...kkAAAAAAkk...', '..ktkAAaaAAktk..',
  '..ktkAAaaAAktk..', '...kkAAggAAkk...', '....kAAAAAAk....',
  '....kAAkkAAk....', '....khhkkhhk....', '...khhhkkhhhk...',
  '...kkkkkkkkkk...',
];
const dragon = [
  '.kk........kk...', '.krk......krk...', '.krrk.kk.krrk...',
  '.krrrkoookrrk...', '..krkooooork....', '...koowookkk....',
  '..kooookkooook..', '..kooookkkkkk...', '...koooooook....',
  '..krooooookrk...', '.krroooogookrrk.', '.kkkoooggoookkk.',
  '...kooookook....', '..koook.koook...', '..kkkk...kkkk...',
  '................',
];
const knight = [
  '....kk..kk......', '....kgkkgk......', '....kggggk......',
  '...kkkkkkkk.....', '...kAAAAAAk.....', '...kAwkkwAk.....',
  '....kAAAAk......', '..kkkkggkkkk....', '.ksskAAAAkssk...',
  '.kswkAAAAkwsk...', '.ksskAAAAkssk...', '..kkkAggAkkk....',
  '....kAAAAk......', '....kAAkAk......', '...ksskkssk.....',
  '...kkkkkkkk.....',
];
interface Sprite { rows: string[]; colors: Record<string, string> }
const sprite = (rows: string[], colors: Record<string, string> = {}): Sprite => ({ rows, colors: { ...palette, ...colors } });

export const SPRITES = {
  hero: sprite(adventurer, { A: '#8661b4', a: '#51366e' }),
  ranger: sprite(adventurer, { A: '#8ed477', a: '#3e754e' }),
  rogue: sprite(adventurer, { A: '#b3a5c9', a: '#e85b59' }),
  paladin: sprite(knight, { A: '#4fc3f7' }),
  berserker: sprite(adventurer, { A: '#ff8a3d', a: '#945d43' }),
  'goblin-scout': sprite([
    '..kk......kk....', '..kck....kck....', '..kcckkkkcck....', '...kcccccck.....',
    '...kcwccwck.....', '...kckcckck.....', '....kcccck......', '.....kkkk.......',
    '...kkhhhkk......',     '..kckhghkck.....', '..kckhhhhkck....',
    '...kkhhhkk......', '....kccck.......', '...kcckcck......', '...kkkkkkk......', '................',
  ]),
  'bog-troll': sprite([
    '....kkkkkk......', '...knnnnnnk.....', '..knccccccnk....', '..kcwccccwck....',
    '..kckcccckck....', '...kcttttck.....', '...kccwwcck.....', '..kkcccccckk....',
    '.knnccccccnnk...', '.knnccccccnnk...', '.knkccggccknk...', '..kkhhhhhhkk....',
    '...knnknnnk.....', '...knnkknnk.....', '..knnnkknnnk....', '..kkkkkkkkkk....',
  ]),
  'stone-golem': sprite([
    '....kkkkkk......', '...kssssssk.....', '...kswwwssk.....', '...ksbkksbk.....',
    '...kssssssk.....', '....kkkkkk......', '..kksssssskk....', '.ksskswwskssk...',
    '.ksskswbskssk...', '.ksskswwskssk...', '..kksssssskk....', '....kssssk......',
    '...kssksssk.....', '...kssksssk.....', '..kssskssssk....', '..kkkkkkkkkk....',
  ]),
  'fire-drake': sprite(dragon),
  'elder-dragon': sprite(dragon, { o: '#8661b4', r: '#4fc3f7', g: '#f3ead7' }),
  'frost-wraith': sprite([
    '.....kkkk.......', '....kbbbbk......', '...kbwwwbbk.....', '..kbwwwwwbbk....',
    '..kbwkwwkwbk....', '..kbwdwwdwbk....', '..kbwwwwwbbk....', '...kbbbbbbk.....',
    '..kkbbbbbbkk....', '.kbkbbwwbbkbk...', '.kkkbbbbbbkkk...', '...kbbwwbbk.....',
    '..kbbbbbbbbk....', '..kbkbbkbbbk....', '..kk.kk.kkkk....', '................',
  ]),
  'shadow-knight': sprite(knight, { A: '#51366e', w: '#e85b59', s: '#8661b4' }),
  'storm-king': sprite(knight, { A: '#8661b4', s: '#4fc3f7', w: '#ffcc33' }),
  map: sprite([
    '................', '.kkkkkkkkkkkkkk.', '.kwwwwkcccckwwk.', '.kwgwwkcncckwwk.',
    '.kwwwwkccnckwwk.', '.kwwwwkcccckwwk.', '.kwwwwkcccckwwk.', '.kwwwwkcccckwwk.',
    '.kwwwwkcccckwwk.', '.kwwwwkcccckwwk.', '.kwwwwkcccckgwk.', '.kwwwwkcccckwwk.',
    '.kwwwwkcccckwwk.', '.kkkkkkkkkkkkkk.', '................', '................',
  ]),
  run: sprite([
    '.......kkkk.....', '.......kook.....', '.......kttk.....', '........kk......',
    '.....kkkbbk.....', '....ktkkbbkkk...', '....kk.kbbktk...', '.......kbbkk....',
    '......kkbbk.....', '.....kssssk.....', '....ksskssk.....', '...kssk.kssk....',
    '..kwwk...kssk...', '..kkkk....kwwk..', '..........kkkk..', '................',
  ]),
  plan: sprite([
    '...kk......kk...', '...kgk....kgk...', '.kkkkkkkkkkkkkk.', '.kppppppppppppk.',
    '.kkkkkkkkkkkkkk.', '.kwwwwwwwwwwwwk.', '.kwkkwkkwkkwwwk.', '.kwbbwbbwbbwwwk.',
    '.kwwwwwwwwwwwwk.', '.kwkkwkkwkkwwwk.', '.kwggwsswsswwwk.', '.kwwwwwwwwwwwwk.',
    '.kwwwwwwwwwwwwk.', '.kkkkkkkkkkkkkk.', '................', '................',
  ]),
  log: sprite([
    '................', '..kkkkkkkkkkk...', '.khhhhhhhhhhk...', '.khkwwwwwwwhk...',
    '.khkwwwwwwwhk...', '.khkwssssswhk...', '.khkwwwwwwwhk...', '.khkwssssswhk...',
    '.khkwwwwwwwhk...', '.khkwssssswhk...', '.khkwwwwwwwhk...', '.khkwwwwwgwhk...',
    '.khkkkkkkkkhk...', '.khhhhhhhhhhk...', '..kkkkkkkkkkk...', '................',
  ]),
  coin: sprite([
    '................', '.....kkkkkk.....', '...kkggggggkk...', '..kggggggggggk..',
    '..kgggwooggggk..', '.kgggwooooggggk.', '.kgggwoggoggggk.', '.kgggwooogggggk.',
    '.kgggggoowggggk.', '.kggggooowggggk.', '.kgggggowgggggk.', '..kggggggggggk..',
    '..kggggggggggk..', '...kkggggggkk...', '.....kkkkkk.....', '................',
  ]),
  chest: sprite([
    '................', '................', '...kkkkkkkkkk...', '..khhhggghhhhk..',
    '.khhhhggghhhhhk.', '.khhhhggghhhhhk.', '.kkkkkkkkkkkkkk.', '.khhhhggghhhhhk.',
    '.khhhhgwghhhhhk.', '.khhhhggghhhhhk.', '.khhhhhhhhhhhhk.', '.khhhhhhhhhhhhk.',
    '.kkkkkkkkkkkkkk.', '................', '................', '................',
  ]),
  unknown: sprite([
    '................', '.....kkkkkk.....', '....kvvvvvvk....', '...kvvwwwwvvk...',
    '...kvwwkkwwvk...', '...kvvkkkwwvk...', '...kvvvkwwvvk...', '...kvvkwwvvvk...',
    '...kvvkwwvvvk...', '...kvvvvvvvvk...', '...kvvwwwvvvk...', '....kvwwwvvk....',
    '.....kkkkkk.....', '................', '................', '................',
  ]),
} satisfies Record<string, Sprite>;

export type SpriteId = keyof typeof SPRITES;

export const BOSS_ART: Record<string, SpriteId> = {
  'goblin-scout': 'goblin-scout', 'bog-troll': 'bog-troll', 'stone-golem': 'stone-golem',
  'fire-drake': 'fire-drake', 'frost-wraith': 'frost-wraith', 'shadow-knight': 'shadow-knight',
  'elder-dragon': 'elder-dragon', 'storm-king': 'storm-king',
};
