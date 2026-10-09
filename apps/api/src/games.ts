import { norm } from './ufs.js';

/** Plataforma/assunto de uma notícia de games. */
export type GameTag = 'esports' | 'playstation' | 'xbox' | 'nintendo' | 'mobile' | 'pc' | 'outros';

// Texto sem acento e em minúsculas. A ordem importa: eSports e consoles antes de "pc".
const RULES: [GameTag, RegExp][] = [
  ['esports', /\b(esports?|e-sports?|league of legends|lol|valorant|cs2|counter-?strike|dota ?2?|cblol|furia|loud|pain gaming|free fire world series|worlds 20\d\d|msi 20\d\d|vct|riot games|mundial de lol|overwatch league)\b/],
  ['playstation', /\b(playstation|ps5|ps4|ps vita|ps portal|psn|sony interactive|ps plus|dualsense|god of war|the last of us|astro bot|spider-?man 2)\b/],
  ['xbox', /\b(xbox|game pass|microsoft gaming|halo|forza|starfield|fable|gears of war)\b/],
  ['nintendo', /\b(nintendo|switch ?2?|zelda|mario|pokemon|splatoon|kirby|metroid|donkey kong|animal crossing|smash bros)\b/],
  ['mobile', /\b(mobile|celular|android|ios|free fire|clash royale|clash of clans|genshin|honor of kings|pubg mobile|call of duty mobile|brawl stars|roblox)\b/],
  ['pc', /\b(pc|steam|steam deck|epic games|valve|gog|geforce|rtx|radeon|mods?|early access|minecraft|baldur|elden ring|cyberpunk)\b/],
];

export function gameTagOf(title: string, summary = ''): GameTag {
  const t = norm(`${title} ${summary}`);
  for (const [tag, rx] of RULES) if (rx.test(t)) return tag;
  return 'outros';
}
