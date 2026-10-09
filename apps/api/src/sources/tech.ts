import { getJson, getText, plain } from '../http.js';
import { fetchFeed, pool, type FeedDef, type Row } from './feeds.js';
import { ingest } from '../db.js';
import { googleNews, GN, GN_EN } from './local.js';
import { gameTagOf } from '../games.js';
import { isGood } from '../mood.js';

/**
 * Fontes de tecnologia. Só sites de notícia e newsrooms oficiais.
 * `pages`: quantas páginas extras (?paged=N) buscar na carga inicial, para ter histórico.
 */
export const FEEDS: FeedDef[] = [
  // ── Brasil ────────────────────────────────────────────────────────
  { source: 'Tecnoblog', cat: 'tech-br', url: 'https://tecnoblog.net/feed/' },
  { source: 'Canaltech', cat: 'tech-br', url: 'https://canaltech.com.br/rss/' },
  { source: 'Olhar Digital', cat: 'tech-br', url: 'https://olhardigital.com.br/feed/' },
  { source: 'Mobile Time', cat: 'tech-br', url: 'https://www.mobiletime.com.br/feed/', pages: 6 },
  { source: 'G1 Tecnologia', cat: 'tech-br', url: 'https://g1.globo.com/rss/g1/tecnologia/' },
  { source: 'Folha Tec', cat: 'tech-br', url: 'https://feeds.folha.uol.com.br/tec/rss091.xml' },
  { source: 'Showmetech', cat: 'tech-br', url: 'https://www.showmetech.com.br/feed/', pages: 3 },

  // ── Mundo (imprensa) ──────────────────────────────────────────────
  { source: 'Ars Technica', cat: 'tech-mundo', url: 'https://feeds.arstechnica.com/arstechnica/index' },
  { source: 'The Verge', cat: 'tech-mundo', url: 'https://www.theverge.com/rss/index.xml' },
  { source: 'Wired', cat: 'tech-mundo', url: 'https://www.wired.com/feed/rss' },
  { source: 'TechCrunch', cat: 'tech-mundo', url: 'https://techcrunch.com/feed/', pages: 20 },
  { source: 'MIT Technology Review', cat: 'tech-mundo', url: 'https://www.technologyreview.com/feed/' },
  { source: 'BBC Technology', cat: 'tech-mundo', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { source: 'IEEE Spectrum', cat: 'tech-mundo', url: 'https://spectrum.ieee.org/feeds/feed.rss' },
  { source: 'Engadget', cat: 'tech-mundo', url: 'https://www.engadget.com/rss.xml' },
  { source: 'The Register', cat: 'tech-mundo', url: 'https://www.theregister.com/headlines.atom' },

  // ── Boas notícias (sites feitos para isso; o filtro tira o que for pesado) ──────
  { source: 'Só Notícia Boa', cat: 'boas', region: 'br', url: 'https://www.sonoticiaboa.com.br/feed/' },
  { source: 'Good News Network', cat: 'boas', url: 'https://www.goodnewsnetwork.org/feed/' },
  { source: 'Reasons to be Cheerful', cat: 'boas', url: 'https://reasonstobecheerful.world/feed/' },
  { source: 'Optimist Daily', cat: 'boas', url: 'https://www.optimistdaily.com/feed/' },

  // ── Empresas (newsrooms oficiais) ─────────────────────────────────
  { source: 'NVIDIA', cat: 'empresas', url: 'https://blogs.nvidia.com/feed/' },
  { source: 'Apple Newsroom', grp: 'Apple', cat: 'empresas', url: 'https://www.apple.com/newsroom/rss-feed.rss' },
  { source: 'Apple ML Research', grp: 'Apple', cat: 'empresas', url: 'https://machinelearning.apple.com/rss.xml' },
  { source: 'OpenAI', cat: 'empresas', url: 'https://openai.com/news/rss.xml' },
  { source: 'Google', cat: 'empresas', url: 'https://blog.google/rss/' },
  { source: 'Google AI', grp: 'Google', cat: 'empresas', url: 'https://blog.google/technology/ai/rss/' },
  { source: 'Google DeepMind', grp: 'Google', cat: 'empresas', url: 'https://deepmind.google/blog/rss.xml' },
  { source: 'Google Research', grp: 'Google', cat: 'empresas', url: 'https://research.google/blog/rss/' },
  { source: 'Microsoft', cat: 'empresas', url: 'https://blogs.microsoft.com/feed/' },
  { source: 'Meta', cat: 'empresas', url: 'https://about.fb.com/news/feed/' },
  { source: 'AWS', cat: 'empresas', url: 'https://aws.amazon.com/blogs/aws/feed/' },
  { source: 'Samsung', cat: 'empresas', url: 'https://news.samsung.com/global/feed' },
  { source: 'GitHub', cat: 'empresas', url: 'https://github.blog/feed/' },
  { source: 'Hugging Face', cat: 'empresas', url: 'https://huggingface.co/blog/feed.xml' },
  { source: 'Mistral AI', cat: 'empresas', url: 'https://mistral.ai/rss.xml' },
  { source: 'Cloudflare', cat: 'empresas', url: 'https://blog.cloudflare.com/rss/' },

  // ── Esportes: canais gerais (a modalidade é descoberta pelo texto de cada notícia) ──
  { source: 'ge', cat: 'esportes', region: 'br', url: 'https://ge.globo.com/rss/ge/' },
  { source: 'ESPN Brasil', cat: 'esportes', region: 'br', url: 'https://www.espn.com.br/espn/rss/news' },
  { source: 'Gazeta Esportiva', cat: 'esportes', region: 'br', url: 'https://www.gazetaesportiva.com/feed/' },
  { source: 'Folha Esporte', cat: 'esportes', region: 'br', url: 'https://feeds.folha.uol.com.br/esporte/rss091.xml' },
  { source: 'Placar', cat: 'esportes', region: 'br', url: 'https://placar.com.br/feed/' },
  { source: 'Motorsport.com Brasil', cat: 'esportes', region: 'br', url: 'https://motorsport.uol.com.br/rss/all/news/' },
  { source: 'BBC Sport', cat: 'esportes', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { source: 'ESPN', cat: 'esportes', url: 'https://www.espn.com/espn/rss/news' },
  { source: 'Autosport', cat: 'esportes', url: 'https://www.autosport.com/rss/feed/all' },
  { source: 'The Race', cat: 'esportes', url: 'https://www.the-race.com/feed/' },
  // …e canais de uma modalidade só (a modalidade já é conhecida)
  { source: 'Trivela', cat: 'esportes', region: 'br', tag: 'futebol', url: 'https://trivela.com.br/feed/' },
  { source: 'BBC Football', cat: 'esportes', tag: 'futebol', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { source: 'ESPN Soccer', cat: 'esportes', tag: 'futebol', url: 'https://www.espn.com/espn/rss/soccer/news' },
  { source: 'CBS Sports Soccer', cat: 'esportes', tag: 'futebol', url: 'https://www.cbssports.com/rss/headlines/soccer/' },
  { source: 'BBC F1', cat: 'esportes', tag: 'f1', url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml' },
  { source: 'Motorsport.com F1', cat: 'esportes', tag: 'f1', url: 'https://www.motorsport.com/rss/f1/news/' },
  { source: 'Motorsport.com MotoGP', cat: 'esportes', tag: 'motogp', url: 'https://www.motorsport.com/rss/motogp/news/' },
  { source: 'Crash.net', cat: 'esportes', tag: 'motogp', url: 'https://www.crash.net/rss/motogp' },
  { source: 'ESPN NBA', cat: 'esportes', tag: 'basquete', url: 'https://www.espn.com/espn/rss/nba/news' },
  { source: 'CBS Sports NBA', cat: 'esportes', tag: 'basquete', url: 'https://www.cbssports.com/rss/headlines/nba/' },
  { source: 'BBC Basketball', cat: 'esportes', tag: 'basquete', url: 'https://feeds.bbci.co.uk/sport/basketball/rss.xml' },
  { source: 'BBC Tennis', cat: 'esportes', tag: 'tenis', url: 'https://feeds.bbci.co.uk/sport/tennis/rss.xml' },

  // ── Games: Brasil ─────────────────────────────────────────────────
  { source: 'IGN Brasil', cat: 'games', region: 'br', url: 'https://br.ign.com/feed.xml' },
  { source: 'Adrenaline', cat: 'games', region: 'br', url: 'https://www.adrenaline.com.br/feed/' },
  { source: 'Meups', cat: 'games', region: 'br', url: 'https://meups.com.br/feed/' },
  { source: 'Critical Hits', cat: 'games', region: 'br', url: 'https://criticalhits.com.br/feed/' },
  { source: 'GameVicio', cat: 'games', region: 'br', url: 'https://www.gamevicio.com/rss/' },
  { source: 'PSX Brasil', cat: 'games', region: 'br', tag: 'playstation', url: 'https://psxbrasil.com.br/feed/' },
  { source: 'Nintendo Blast', cat: 'games', region: 'br', tag: 'nintendo', url: 'https://www.nintendoblast.com.br/feeds/posts/default' },
  { source: 'Mais Esports', cat: 'games', region: 'br', tag: 'esports', url: 'https://maisesports.com.br/feed/' },
  // ── Games: mundo ──────────────────────────────────────────────────
  { source: 'IGN', cat: 'games', url: 'https://feeds.ign.com/ign/all' },
  { source: 'GameSpot', cat: 'games', url: 'https://www.gamespot.com/feeds/news/' },
  { source: 'Eurogamer', cat: 'games', url: 'https://www.eurogamer.net/feed' },
  { source: 'PC Gamer', cat: 'games', tag: 'pc', url: 'https://www.pcgamer.com/rss/' },
  { source: 'Kotaku', cat: 'games', url: 'https://kotaku.com/rss' },
  { source: 'Polygon', cat: 'games', url: 'https://www.polygon.com/rss/index.xml' },
  { source: 'Rock Paper Shotgun', cat: 'games', tag: 'pc', url: 'https://www.rockpapershotgun.com/feed' },
  { source: 'VGC', cat: 'games', url: 'https://www.videogameschronicle.com/feed/' },
  { source: 'GamesRadar', cat: 'games', url: 'https://www.gamesradar.com/rss/' },
  { source: 'Destructoid', cat: 'games', url: 'https://www.destructoid.com/feed/' },
  { source: 'Dexerto', cat: 'games', url: 'https://www.dexerto.com/feed/' },
  { source: 'Nintendo Life', cat: 'games', tag: 'nintendo', url: 'https://www.nintendolife.com/feeds/latest' },
  { source: 'Push Square', cat: 'games', tag: 'playstation', url: 'https://www.pushsquare.com/feeds/latest' },
  { source: 'PlayStation Blog', cat: 'games', tag: 'playstation', url: 'https://blog.playstation.com/feed/' },
  { source: 'Xbox Wire', cat: 'games', tag: 'xbox', url: 'https://news.xbox.com/en-us/feed/' },
];

// ── Hacker News (API de busca oficial, com filtro por data) ───────────

async function fetchHackerNews(days: number, minPoints: number, pages = 1): Promise<Row[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86_400;
  const out: Row[] = [];
  for (let p = 0; p < pages; p++) {
    const q = `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>${since},points>${minPoints}&hitsPerPage=100&page=${p}`;
    const j = await getJson<{ hits: any[]; nbPages: number }>(q, 25_000);
    for (const h of j.hits) {
      if (!h.title) continue;
      out.push({
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: 'Hacker News',
        grp: 'Hacker News',
        cat: 'tech-mundo',
        title: plain(h.title, 220),
        summary: `${h.points} pontos · ${h.num_comments ?? 0} comentários na discussão`,
        image: null,
        date: new Date(h.created_at_i * 1000).toISOString(),
      });
    }
    if (p + 1 >= j.nbPages) break;
  }
  return out;
}

// ── Anthropic (sem RSS: lê a página oficial /news) ────────────────────

const unescapeFlight = (s: string) => s.replace(/\\"/g, '"');
const jsonStr = (s: string) => {
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s;
  }
};

export async function fetchAnthropic(): Promise<Row[]> {
  const [html, sitemap] = await Promise.all([
    getText('https://www.anthropic.com/news', 30_000),
    getText('https://www.anthropic.com/sitemap.xml', 30_000).catch(() => ''),
  ]);

  // slugs que realmente são /news/ (o bloco de dados também traz pesquisa, engenharia etc.)
  const newsSlugs = new Set<string>(
    [...sitemap.matchAll(/<loc>https:\/\/www\.anthropic\.com\/news\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1]),
  );
  const listed = [...html.matchAll(/<a href="\/news\/([^"/]+)"/g)].map((m) => m[1]);
  for (const s of listed) newsSlugs.add(s);

  const flat = unescapeFlight(html);
  const re =
    /"publishedOn":"([^"]+)","slug":\{"_type":"slug","current":"([^"]+)"\},(?:"subjects":\[[^\]]*?"label":"([^"]*)"[^\]]*\],)?(?:"summary":"([^"]*)",)?"title":"([^"]*)"/g;
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const m of flat.matchAll(re)) {
    const [, published, slug, , summary, title] = m;
    if (!newsSlugs.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    const t = Date.parse(published);
    if (Number.isNaN(t)) continue;
    out.push({
      url: `https://www.anthropic.com/news/${slug}`,
      source: 'Anthropic',
      grp: 'Anthropic',
      cat: 'empresas',
      title: plain(jsonStr(title), 220),
      summary: plain(jsonStr(summary ?? ''), 240),
      image: null,
      date: new Date(Math.min(t, Date.now())).toISOString(),
    });
  }

  // Plano B: se o formato interno mudar, ao menos a lista visível da página.
  if (!out.length) {
    const li = html.matchAll(
      /<a href="(\/news\/[^"]+)"[^>]*>\s*<div[^>]*><time[^>]*>([^<]+)<\/time><span[^>]*>[^<]*<\/span><\/div><span[^>]*>([^<]+)<\/span><\/a>/g,
    );
    for (const m of li) {
      const t = Date.parse(m[2]);
      if (Number.isNaN(t)) continue;
      out.push({
        url: `https://www.anthropic.com${m[1]}`,
        source: 'Anthropic',
        grp: 'Anthropic',
        cat: 'empresas',
        title: plain(m[3], 220),
        summary: '',
        image: null,
        date: new Date(t).toISOString(),
      });
    }
  }
  if (!out.length) throw new Error('Anthropic: página /news em formato inesperado');
  return out;
}

// ── Boas notícias do Brasil via Google Notícias ───────────────────────

const GOOD_Q =
  '("boa notícia" OR conquista OR recorde OR inauguração OR descoberta OR solidariedade OR premiada OR campeã OR campeão OR "salva vidas") -morte -assassinato -assalto -tiroteio -acidente -preso -tragédia';

async function fetchGoogleGood(days: number): Promise<Row[]> {
  const items = await googleNews(GN(`search?q=${encodeURIComponent(`${GOOD_Q} when:${days}d`)}`));
  return items
    .filter((i) => isGood(i.title))
    .map((i) => ({ url: i.url, source: i.source, grp: i.source, cat: 'boas' as const, title: i.title, summary: '', image: null, date: i.date, region: 'br' as const }));
}

// ── Esportes por modalidade, em português, via Google Notícias ──────────
// (para F1, MotoGP, basquete, vôlei e lutas quase não há feed brasileiro dedicado)

const SPORT_QUERIES: [tag: string, query: string][] = [
  ['f1', '("Fórmula 1" OR F1 OR Verstappen OR Bortoleto OR "GP de")'],
  ['motogp', '(MotoGP OR "Marc Márquez" OR Bagnaia)'],
  ['basquete', '(basquete OR NBA OR NBB OR "Liga Ouro")'],
  ['volei', '(vôlei OR voleibol OR Superliga OR "Liga das Nações de vôlei")'],
  ['tenis', '(tênis OR ATP OR WTA OR "João Fonseca" OR "Roland Garros" OR Wimbledon)'],
  ['fisiculturismo', '(fisiculturismo OR fisiculturista OR "Mr. Olympia" OR bodybuilding)'],
  ['mma', '(UFC OR MMA)'],
  ['boxe', '(boxe OR boxeador)'],
  ['judo', '(judô OR judoca)'],
  ['muaythai', '("muay thai" OR kickboxing)'],
  ['jiujitsu', '("jiu-jitsu" OR BJJ OR ADCC)'],
  ['lutas', '(karatê OR taekwondo OR capoeira OR "luta livre")'],
  ['olimpicos', '(atletismo OR natação OR ginástica OR surfe OR skate OR Olimpíadas OR "Time Brasil")'],
];

async function fetchGoogleSport(tag: string, query: string, days: number): Promise<Row[]> {
  const items = await googleNews(GN(`search?q=${encodeURIComponent(`${query} when:${days}d`)}`));
  return items.map((i) => ({
    url: i.url, source: i.source, grp: i.source, cat: 'esportes' as const,
    title: i.title, summary: '', image: null, date: i.date, tag, region: 'br' as const,
  }));
}

// O "mundo" das modalidades que não têm feed internacional: mesma busca, em inglês.
const SPORT_QUERIES_EN: [tag: string, query: string][] = [
  ['volei', '(volleyball OR VNL)'],
  ['tenis', '(tennis OR ATP OR WTA)'],
  ['fisiculturismo', '(bodybuilding OR "Mr. Olympia")'],
  ['mma', '(UFC OR MMA)'],
  ['boxe', '(boxing)'],
  ['judo', '(judo)'],
  ['muaythai', '("muay thai" OR kickboxing)'],
  ['jiujitsu', '("jiu-jitsu" OR BJJ OR ADCC)'],
  ['lutas', '(karate OR taekwondo OR sumo OR "Greco-Roman")'],
  ['olimpicos', '(athletics OR swimming OR gymnastics OR Olympics)'],
];

async function fetchGoogleSportEn(tag: string, query: string, days: number): Promise<Row[]> {
  const items = await googleNews(GN_EN(`search?q=${encodeURIComponent(`${query} when:${days}d`)}`));
  return items.map((i) => ({
    url: i.url, source: i.source, grp: i.source, cat: 'esportes' as const,
    title: i.title, summary: '', image: null, date: i.date, tag, region: 'mundo' as const,
  }));
}

// Games do Brasil via Google Notícias (somado aos feeds)
const GAMES_Q = '(games OR videogame OR PlayStation OR Xbox OR Nintendo OR "Free Fire" OR "League of Legends" OR Steam)';

async function fetchGoogleGames(days: number): Promise<Row[]> {
  const items = await googleNews(GN(`search?q=${encodeURIComponent(`${GAMES_Q} when:${days}d`)}`));
  return items.map((i) => ({
    url: i.url, source: i.source, grp: i.source, cat: 'games' as const,
    title: i.title, summary: '', image: null, date: i.date, tag: gameTagOf(i.title), region: 'br' as const,
  }));
}

// ── Coleta ───────────────────────────────────────────────────────────

export interface CollectStats {
  total: number;
  ok: number;
  failed: string[];
  added: number;
}

/** Busca todos os feeds (página 1), guarda no arquivo e devolve o resumo da rodada. */
export async function collectTech(): Promise<CollectStats> {
  const jobs: { name: string; run: () => Promise<Row[]> }[] = [
    ...FEEDS.map((f) => ({ name: f.source, run: () => fetchFeed(f) })),
    { name: 'Hacker News', run: () => fetchHackerNews(2, 120) },
    { name: 'Google Notícias · boas', run: () => fetchGoogleGood(3) },
    ...SPORT_QUERIES.map(([tag, q]) => ({ name: `Google Notícias · ${tag}`, run: () => fetchGoogleSport(tag, q, 3) })),
    ...SPORT_QUERIES_EN.map(([tag, q]) => ({ name: `Google News · ${tag}`, run: () => fetchGoogleSportEn(tag, q, 3) })),
    { name: 'Google Notícias · games', run: () => fetchGoogleGames(3) },
    { name: 'Anthropic', run: fetchAnthropic },
  ];
  const results = await pool(jobs, 6, (j) => j.run());

  const rows: Row[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') rows.push(...r.value);
    else {
      failed.push(jobs[i].name);
      console.warn(`[tech] ${jobs[i].name}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
    }
  });
  const added = await ingest(rows);
  return { total: jobs.length, ok: jobs.length - failed.length, failed, added };
}

/**
 * Carga inicial de histórico (roda uma vez por inicialização):
 * páginas extras dos feeds que aceitam ?paged=N e a busca por data do Hacker News.
 */
export async function backfillTech(days = 30): Promise<number> {
  const cutoff = Date.now() - days * 86_400_000;
  let added = 0;

  const paged = FEEDS.filter((f) => f.pages);
  await pool(paged, 3, async (f) => {
    for (let p = 2; p <= (f.pages ?? 1) + 1; p++) {
      const rows = await fetchFeed(f, p).catch(() => [] as Row[]);
      if (!rows.length) break;
      added += await ingest(rows);
      if (Math.min(...rows.map((r) => Date.parse(r.date))) < cutoff) break;
    }
  });

  added += await ingest(await fetchHackerNews(days, 200, 2).catch(() => []));
  added += await ingest(await fetchGoogleGood(days).catch(() => []));
  const sport = await pool(SPORT_QUERIES, 3, ([tag, q]) => fetchGoogleSport(tag, q, days));
  for (const r of sport) if (r.status === 'fulfilled') added += await ingest(r.value);
  const sportEn = await pool(SPORT_QUERIES_EN, 3, ([tag, q]) => fetchGoogleSportEn(tag, q, days));
  for (const r of sportEn) if (r.status === 'fulfilled') added += await ingest(r.value);
  added += await ingest(await fetchGoogleGames(days).catch(() => []));
  return added;
}
