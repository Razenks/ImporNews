import { norm } from './ufs.js';

/**
 * Modalidades. As de luta são separadas para o filtro "Artes marciais" poder abrir em
 * MMA/UFC, boxe, judô, muay thai, jiu-jitsu e outras lutas.
 */
export type Sport =
  | 'futebol' | 'f1' | 'motogp' | 'basquete' | 'volei' | 'tenis' | 'fisiculturismo'
  | 'mma' | 'boxe' | 'judo' | 'muaythai' | 'jiujitsu' | 'lutas'
  | 'olimpicos' | 'outros';

// Palavras que identificam cada modalidade (texto sem acento e em minúsculas).
// As específicas são testadas antes do futebol, que é o assunto "padrão" do esporte.
const RULES: [Sport, RegExp][] = [
  ['f1', /\b(formula ?1|formula one|f1|grande premio|gp (da|de|do|dos)|pole position|verstappen|hamilton|leclerc|norris|piastri|russell|alonso|bortoleto|mclaren|red bull racing|pirelli)\b/],
  ['motogp', /\b(moto ?gp|moto2|moto3|superbike|bagnaia|marc marquez|alex marquez|quartararo|jorge martin|bezzecchi|acosta|pecco)\b/],
  ['basquete', /\b(basquete|basketball|nba|nbb|wnba|liga ouro|lebron|curry|durant|jokic|doncic|lakers|celtics|warriors|knicks|spurs|nuggets|bucks)\b/],
  ['volei', /\b(volei|voleibol|volleyball|superliga|vnl|liga das nacoes de volei|bernardinho)\b/],
  ['tenis', /\b(tenis|tennis|atp|wta|roland garros|wimbledon|us open|australian open|djokovic|alcaraz|sinner|nadal|joao fonseca|masters 1000)\b/],
  ['fisiculturismo', /\b(fisiculturismo|fisiculturista|bodybuilding|bodybuilder|mr\.? ?olympia|mr\.? ?olimpia|classic physique|men'?s physique)\b/],
  ['muaythai', /\b(muay[- ]?thai|kickboxing|k-?1)\b/],
  ['jiujitsu', /\b(jiu[- ]?jitsu|bjj|adcc|brazilian jiu)\b/],
  ['judo', /\b(judo|judoca|judokas)\b/],
  ['boxe', /\b(boxe|boxeador|boxeadora|boxing|boxer)\b/],
  ['mma', /\b(ufc|mma|octagono|bellator|pfl|lutador|lutadores|lutadora)\b/],
  ['lutas', /\b(karate|taekwondo|capoeira|luta livre|aikido|krav maga|sumo)\b/],
  ['olimpicos', /\b(atletismo|natacao|ginastica|olimpiada|olimpiadas|olimpico|olimpicos|paralimpiad\w*|surfe|surf|skate|ciclismo|maratona|remo|triatlo|esgrima|time brasil)\b/],
  ['futebol', /\b(futebol|football|soccer|brasileirao|serie [abcd]|libertadores|sul-?americana|copa do brasil|copa do mundo|selecao|eliminatorias|premier league|la ?liga|champions league|bundesliga|ligue 1|mundial de clubes|neymar|messi|cristiano ronaldo|mbappe|haaland|vinicius junior|flamengo|palmeiras|corinthians|sao paulo|santos|vasco|botafogo|fluminense|gremio|internacional|cruzeiro|atletico[- ]mg|atletico mineiro|bahia|fortaleza|athletico|coritiba|goias|cuiaba|bragantino|juventude|real madrid|barcelona|manchester|liverpool|arsenal|chelsea|tottenham|psg|bayern|gol|goleada|rodada|artilheiro|escalacao)\b/],
];

/** Descobre a modalidade pelo texto. Sem pista nenhuma, devolve "outros". */
export function sportOf(title: string, summary = ''): Sport {
  const t = norm(`${title} ${summary}`);
  for (const [sport, rx] of RULES) if (rx.test(t)) return sport;
  return 'outros';
}
