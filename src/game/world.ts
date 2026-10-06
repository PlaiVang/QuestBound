export interface BossGoal {
  distanceM: number;
  /** Optional time limit for covering distanceM. */
  timeLimitSec?: number;
}

export interface Boss {
  id: string;
  name: string;
  icon: string;
  goal: BossGoal;
  goalText: string;
  xp: number;
  gold: number;
  taunt: string;
}

export interface Region {
  id: string;
  name: string;
  icon: string;
  /** Total map distance at which this region's gate stands. */
  atKm: number;
  lore: string;
  /** Boss guarding the gate. The hero cannot travel past it until it is defeated. */
  boss?: Boss;
  /** Position on the SVG map, 0–100. */
  x: number;
  y: number;
}

export const REGIONS: Region[] = [
  {
    id: 'hearthvale',
    name: 'Hearthvale',
    icon: '🏡',
    atKm: 0,
    lore: 'Your quest begins in a quiet village. The road east calls to you.',
    x: 12,
    y: 88,
  },
  {
    id: 'whispering-woods',
    name: 'Whispering Woods',
    icon: '🌲',
    atKm: 5,
    lore: 'Ancient trees murmur secrets. Something small and sneaky blocks the trail.',
    x: 35,
    y: 80,
    boss: {
      id: 'goblin-scout',
      name: 'Goblin Scout',
      icon: '👺',
      goal: { distanceM: 3000 },
      goalText: 'Run 3 km in a single run',
      xp: 40,
      gold: 25,
      taunt: 'Hehe! You will never catch me!',
    },
  },
  {
    id: 'mirefen',
    name: 'Mirefen Marsh',
    icon: '🐸',
    atKm: 15,
    lore: 'Sticky mud and foul air. A troll guards the only bridge.',
    x: 62,
    y: 84,
    boss: {
      id: 'bog-troll',
      name: 'Bog Troll',
      icon: '🧌',
      goal: { distanceM: 5000 },
      goalText: 'Run 5 km in a single run',
      xp: 60,
      gold: 40,
      taunt: 'TOLL! Pay toll or turn back!',
    },
  },
  {
    id: 'stonepeak',
    name: 'Stonepeak Pass',
    icon: '⛰️',
    atKm: 30,
    lore: 'A narrow pass through the mountains, guarded by living rock.',
    x: 84,
    y: 70,
    boss: {
      id: 'stone-golem',
      name: 'Stone Golem',
      icon: '🗿',
      goal: { distanceM: 5000, timeLimitSec: 35 * 60 },
      goalText: 'Run 5 km in under 35:00',
      xp: 80,
      gold: 50,
      taunt: 'SLOW... AND... STEADY...',
    },
  },
  {
    id: 'emberwild',
    name: 'Emberwild',
    icon: '🌋',
    atKm: 50,
    lore: 'Scorched plains where the ground still smolders.',
    x: 64,
    y: 56,
    boss: {
      id: 'fire-drake',
      name: 'Fire Drake',
      icon: '🐉',
      goal: { distanceM: 8000 },
      goalText: 'Run 8 km in a single run',
      xp: 100,
      gold: 70,
      taunt: 'I will burn the road beneath your feet!',
    },
  },
  {
    id: 'frostmere',
    name: 'Frostmere',
    icon: '❄️',
    atKm: 80,
    lore: 'A frozen lake under a pale sky. Speed is the only warmth here.',
    x: 34,
    y: 50,
    boss: {
      id: 'frost-wraith',
      name: 'Frost Wraith',
      icon: '👻',
      goal: { distanceM: 5000, timeLimitSec: 30 * 60 },
      goalText: 'Run 5 km in under 30:00',
      xp: 130,
      gold: 90,
      taunt: 'Your breath freezes. Your legs slow...',
    },
  },
  {
    id: 'shadowkeep',
    name: 'Shadowkeep',
    icon: '🏰',
    atKm: 120,
    lore: 'A dark fortress. Its knight has never lost a duel of endurance.',
    x: 14,
    y: 36,
    boss: {
      id: 'shadow-knight',
      name: 'Shadow Knight',
      icon: '🦹',
      goal: { distanceM: 10000 },
      goalText: 'Run 10 km in a single run',
      xp: 160,
      gold: 120,
      taunt: 'Many have come. None have endured.',
    },
  },
  {
    id: 'dragons-spine',
    name: "Dragon's Spine",
    icon: '🦴',
    atKm: 170,
    lore: 'The bones of an ancient dragon form a winding ridge.',
    x: 40,
    y: 20,
    boss: {
      id: 'elder-dragon',
      name: 'Elder Dragon',
      icon: '🐲',
      goal: { distanceM: 15000 },
      goalText: 'Run 15 km in a single run',
      xp: 220,
      gold: 160,
      taunt: 'Little hero. Do you have the legs for this?',
    },
  },
  {
    id: 'sky-citadel',
    name: 'Sky Citadel',
    icon: '🏯',
    atKm: 250,
    lore: 'A castle among the clouds. Its king commands the storm itself.',
    x: 74,
    y: 12,
    boss: {
      id: 'storm-king',
      name: 'Storm King',
      icon: '⚡',
      goal: { distanceM: 10000, timeLimitSec: 60 * 60 },
      goalText: 'Run 10 km in under 60:00',
      xp: 300,
      gold: 250,
      taunt: 'Outrun the lightning, if you can.',
    },
  },
];

export const BOSSES = REGIONS.flatMap((r) => (r.boss ? [r.boss] : []));
