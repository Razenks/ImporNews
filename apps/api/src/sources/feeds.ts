import { XMLParser } from 'fast-xml-parser';
import { getText, plain } from '../http.js';
import { sportOf } from '../sports.js';
import { gameTagOf } from '../games.js';

export type Cat = 'brasil' | 'tech-br' | 'tech-mundo' | 'empresas' | 'boas' | 'esportes' | 'games';

/** Origem do veículo: Brasil ou o resto do mundo. */
export type Region = 'br' | 'mundo';

/** Região "padrão" de cada categoria, quando a fonte não diz. */
export const regionOf = (cat: Cat): Region => (cat === 'brasil' || cat === 'tech-br' ? 'br' : 'mundo');

/** Uma notícia pronta para o arquivo. */
export interface Row {
  url: string;
  source: string; // veículo/empresa exibido (ex.: "Google DeepMind")
  grp: string; // agrupamento para filtro (ex.: "Google")
  cat: Cat;
  title: string;
  summary: string;
  image: string | null;
  date: string; // ISO
  /** modalidade (esportes) ou plataforma (games): futebol, f1, playstation… */
  tag?: string;
  /** o veículo é do Brasil ou do mundo */
  region?: Region;
}

export interface FeedDef {
  source: string;
  grp?: string;
  cat: Cat;
  url: string;
  /** Páginas extras (?paged=N) para buscar histórico na primeira carga. */
  pages?: number;
  /** Esportes/games: modalidade ou plataforma fixa do feed (sem isso, é classificada pelo texto). */
  tag?: string;
  /** Veículo do Brasil ou do mundo (sem isso, vale o padrão da categoria). */
  region?: Region;
}

// Feeds trazem HTML escapado dentro de <description>; o limite padrão de expansões é baixo demais.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: { enabled: true, maxTotalExpansions: 1_000_000, maxExpandedLength: 10_000_000 },
});

export const xmlParse = (text: string): any => parser.parse(text);

export const arr = <T>(x: T | T[] | undefined | null): T[] => (Array.isArray(x) ? x : x == null ? [] : [x]);

export const str = (v: any): string =>
  v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : typeof v === 'object' ? str(v['#text']) : '';

const TRACKER = /ebc\.(png|gif)|pixel|feedburner|1x1|spacer|blank\.gif|doubleclick/i;

function firstImg(html: string): string | null {
  const m = html.slice(0, 6000).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m && !TRACKER.test(m[1]) && /^https?:/i.test(m[1]) ? m[1] : null;
}

function linkOf(it: any): string {
  const l = it.link;
  if (typeof l === 'string') return l.trim();
  const ls = arr<any>(l);
  const alt = ls.find((x) => x?.['@_rel'] === 'alternate') ?? ls.find((x) => !x?.['@_rel']) ?? ls[0];
  return str(alt?.['@_href'] ?? alt).trim() || str(it.guid).trim();
}

function imageOf(it: any, html: string): string | null {
  const media = arr<any>(it['media:content']).find(
    (x) => x?.['@_url'] && (!x['@_medium'] || x['@_medium'] === 'image' || /image/.test(x['@_type'] ?? '')),
  );
  const thumb = arr<any>(it['media:thumbnail'])[0];
  const enc = arr<any>(it.enclosure).find((e) => /image/.test(e?.['@_type'] ?? ''));
  const custom = typeof it['imagem-destaque'] === 'string' ? it['imagem-destaque'] : null;
  const url = media?.['@_url'] ?? thumb?.['@_url'] ?? enc?.['@_url'] ?? custom ?? firstImg(html);
  return typeof url === 'string' && /^https?:/i.test(url) && !TRACKER.test(url) ? url : null;
}

/** Tira parâmetros de rastreio e âncoras para o mesmo link não duplicar no arquivo. */
export function cleanUrl(u: string): string {
  try {
    const x = new URL(u);
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$|ref_|mc_)/i.test(k)) x.searchParams.delete(k);
    x.hash = '';
    return x.toString();
  } catch {
    return u;
  }
}

// O arquivo só guarda 31 dias (ver db.ts); itens mais velhos nem entram.
const MAX_AGE = 31 * 86_400_000;

// Rodapés automáticos de WordPress/feeds ("O post X apareceu primeiro em Y", "Continue lendo…").
const SUFFIX =
  /\s*(?:O post .{0,220}? apareceu primeiro em .{0,80}?\.?|The post .{0,220}? appeared first on .{0,80}?\.?|(?:Continue (?:reading|lendo)|Leia mais|Read more)\b.*)$/i;

function summaryOf(src: string, title: string): string {
  let t = plain(src, 900).replace(SUFFIX, '').trim();
  // alguns feeds repetem o título no início do resumo
  if (t.toLowerCase().startsWith(title.toLowerCase())) t = t.slice(title.length).replace(/^[\s:–—-]+/, '');
  return t.length > 240 ? plain(t, 240) : t;
}

export function parseFeed(text: string, def: FeedDef): Row[] {
  const doc = parser.parse(text);
  const items = arr<any>(doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.['rdf:RDF']?.item);
  const now = Date.now();
  const out: Row[] = [];
  for (const it of items) {
    const url = cleanUrl(linkOf(it));
    const title = plain(str(it.title), 220);
    if (!/^https?:/i.test(url) || !title) continue;

    const raw = str(it.pubDate) || str(it.published) || str(it.updated) || str(it['dc:date']);
    let t = Date.parse(raw);
    if (Number.isNaN(t)) t = now;
    if (t > now) t = now; // data no futuro: usa agora
    if (now - t > MAX_AGE) continue;

    const html = (str(it['content:encoded']) || str(it.content) || str(it.description) || str(it.summary)).slice(0, 8000);
    const summary = summaryOf(str(it.description) || str(it.summary) || html, title);
    out.push({
      url,
      source: def.source,
      grp: def.grp ?? def.source,
      cat: def.cat,
      title,
      summary,
      image: imageOf(it, html),
      date: new Date(t).toISOString(),
      tag: def.cat === 'esportes' ? (def.tag ?? sportOf(title, summary)) : def.cat === 'games' ? (def.tag ?? gameTagOf(title, summary)) : undefined,
      region: def.region ?? regionOf(def.cat),
    });
  }
  return out;
}

/** Baixa e interpreta um feed. `page` > 1 usa ?paged=N (WordPress). */
export async function fetchFeed(def: FeedDef, page = 1): Promise<Row[]> {
  let url = def.url;
  if (page > 1) {
    const u = new URL(def.url);
    u.searchParams.set('paged', String(page));
    url = u.toString();
  }
  return parseFeed(await getText(url, 25_000), def);
}

/** Executa `fn` sobre os itens com no máximo `n` em paralelo. */
export async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        try {
          out[k] = { status: 'fulfilled', value: await fn(items[k]) };
        } catch (reason) {
          out[k] = { status: 'rejected', reason };
        }
      }
    }),
  );
  return out;
}
