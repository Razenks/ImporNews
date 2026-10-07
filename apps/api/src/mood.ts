import { norm } from './ufs.js';

/**
 * Classificação simples por palavras (português e inglês) para separar notícias boas das ruins.
 * Não é perfeita: serve para tirar o grosso de crimes e tragédias e achar conquistas e avanços.
 * "Ruim" vence "bom": se a manchete tem qualquer palavra pesada, não entra como boa.
 */

// palavras inteiras (evita pegar "mata" em "matagal", "preso" em "presidente"…)
const BAD_WORDS = [
  // pt
  'morte', 'mortes', 'morre', 'morrem', 'morreu', 'morreram', 'morto', 'morta', 'mortos', 'mortas',
  'mata', 'matam', 'matou', 'mataram', 'assassinato', 'assassinatos', 'assassinado', 'assassinada', 'assassino',
  'homicidio', 'homicidios', 'latrocinio', 'feminicidio', 'chacina', 'execucao', 'suicidio',
  'assalto', 'assaltos', 'assaltante', 'assaltantes', 'assaltado', 'roubo', 'roubos', 'roubado', 'roubam', 'furto', 'furtos',
  'tiroteio', 'baleado', 'baleada', 'balearam', 'esfaqueado', 'esfaqueada', 'estupro', 'estuprador', 'abuso', 'abusos', 'abusado',
  'preso', 'presa', 'presos', 'presas', 'prisao', 'prende', 'prendem', 'prendeu', 'presos',
  'acidente', 'acidentes', 'tragedia', 'tragico', 'tragica', 'incendio', 'explosao', 'desabamento', 'naufragio', 'afogado',
  'colisao', 'colide', 'capotou', 'atropelado', 'atropelada', 'atropelamento',
  'guerra', 'ataque', 'ataques', 'atentado', 'bomba', 'terror', 'terrorista', 'sequestro', 'sequestrado',
  'trafico', 'traficante', 'drogas', 'faccao', 'corrupcao', 'fraude', 'golpe', 'golpista', 'escandalo',
  'acusado', 'acusada', 'condenado', 'condenada', 'reu', 'denuncia', 'denunciado', 'investigacao', 'investiga', 'investigado',
  'vitima', 'vitimas', 'ferido', 'feridos', 'ferida', 'desaparecido', 'desaparecida', 'violencia', 'violento', 'violenta',
  'agressao', 'agressor', 'agredido', 'agredida', 'crime', 'crimes', 'criminoso', 'criminosa', 'criminosos',
  'luto', 'velorio', 'sepultado', 'enterro', 'falece', 'faleceu', 'tumulto', 'panico',
  'enchente', 'enchentes', 'alagamento', 'deslizamento', 'desabrigados', 'surto', 'epidemia', 'pandemia',
  'demite', 'demissao', 'demissoes', 'falencia', 'calote', 'ameaca', 'ameacado', 'ameacada', 'briga', 'confusao',
  'polemica', 'racismo', 'racista', 'tortura', 'torturado', 'refem', 'refens', 'massacre', 'bombardeio', 'invasao',
  'pior', 'piora', 'piorou', 'derrota', 'derrotado', 'perde', 'perdeu', 'cassacao', 'cassado', 'multa', 'multado', 'rombo',
  'prejuizo', 'prejuizos', 'afastado', 'afastamento', 'exonerado', 'impeachment', 'inadimplencia', 'protesto', 'revolta',
  // en
  'killed', 'kills', 'dies', 'died', 'dead', 'death', 'deaths', 'murder', 'murdered', 'shot', 'shooting', 'stabbed', 'rape',
  'arrested', 'crash', 'crashes', 'accident', 'tragedy', 'fire', 'blaze', 'explosion', 'war', 'attack', 'attacks', 'terror',
  'kidnap', 'kidnapped', 'scandal', 'fraud', 'victim', 'victims', 'injured', 'missing', 'suicide', 'violence', 'crime', 'crimes',
  'convicted', 'charged', 'collapse', 'disaster', 'famine', 'layoffs', 'lawsuit', 'abuse', 'assault', 'robbery', 'hostage',
];

// começos de palavra
const GOOD_STEMS = [
  // pt
  'conquist', 'vitoria', 'venceu', 'vencem', 'campea', 'campeo', 'medalh', 'recorde', 'premi', 'descobert', 'descobr',
  'cura', 'curou', 'avanco', 'avancos', 'inovac', 'inaugur', 'solidaried', 'doac', 'doador', 'voluntari', 'sucesso',
  'comemor', 'celebr', 'gratuit', 'melhora', 'melhorou', 'recuper', 'renasc', 'esperanc', 'emocion', 'reconhec',
  'sustentav', 'reciclag', 'preserv', 'adoc', 'reencontr', 'superac', 'transforma', 'resgat', 'orgulho', 'feliz',
  'alegria', 'sorris', 'abrac', 'bondade', 'heroi', 'gesto', 'ajud', 'sonho', 'realiza', 'formatura', 'homenage',
  'oportunidade', 'bolsa', 'vacina', 'energia limpa', 'energia solar', 'cresce', 'crescimento', 'amplia', 'expande',
  'salva vidas', 'salvou', 'boa noticia', 'boas noticias', 'festival', 'aprovad', 'lancamento', 'estreia',
  // en
  'breakthrough', 'cure', 'record', 'wins', 'won ', 'award', 'celebrat', 'rescued', 'hope', 'solar', 'renewable',
  'recover', 'discover', 'milestone', 'donat', 'volunteer', 'kindness', 'hero', 'reunit', 'success', 'improv',
  'thriving', 'restor', 'protect', 'conserv', 'inspir', 'heartwarming', 'joy', 'happy', 'first-ever', 'first ever',
];

// começos de palavra que quase nunca aparecem em contexto bom (pegam plurais e flexões)
const BAD_STEMS = [
  'assassin', 'homicid', 'estupr', 'tiroteio', 'esfaque', 'balead', 'assalt', 'sequestr', 'traficant', 'acusad', 'condenad',
  'agress', 'criminos', 'violenc', 'tragedi', 'incendi', 'explosa', 'naufrag', 'atropel', 'matar', 'matand', 'mortal',
  'letal', 'feminicid', 'chacin', 'suicid', 'terroris', 'esquarte', 'decapit', 'linch', 'espanc', 'torturad',
];

const bad = new RegExp(`\\b(?:${BAD_WORDS.join('|')})\\b|\\b(?:${BAD_STEMS.join('|')})`);
const good = new RegExp(`\\b(?:${GOOD_STEMS.join('|')})`);

const prep = (...parts: (string | undefined)[]) => norm(parts.filter(Boolean).join(' '));

/** Tem palavra de crime, morte, acidente, guerra…? */
export const isBad = (title: string, summary = ''): boolean => bad.test(prep(title, summary));

/**
 * Manchete boa: a palavra de conquista, descoberta, solidariedade… tem de estar no TÍTULO
 * (no resumo qualquer texto cita "sucesso" ou "premiado"), e não pode haver palavra pesada
 * nem no título nem no resumo.
 */
export const isGood = (title: string, summary = ''): boolean =>
  good.test(prep(title)) && !bad.test(prep(title, summary));
