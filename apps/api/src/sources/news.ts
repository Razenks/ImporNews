import { XMLParser } from 'fast-xml-parser';
import { getJson, getText, plain } from '../http.js';
import { cleanUrl, type Row } from './feeds.js';

export interface Article {
  title: string;
  summary: string;
  url: string;
  image: string | null;
  date: string | null; // ISO
  source: string;
}

// Os feeds trazem HTML escapado dentro de <description>; o limite padrão de expansões é baixo demais.
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: { enabled: true, maxTotalExpansions: 500_000, maxExpandedLength: 5_000_000 },
});

const iso = (v: unknown): string | null => {
  const d = new Date(String(v ?? ''));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

async function rss(url: string, source: string, limit: number): Promise<Article[]> {
  const doc = xml.parse(await getText(url, 25_000));
  const raw = doc?.rss?.channel?.item;
  const items: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items.slice(0, limit).map((it) => {
    const enclosure = it.enclosure?.['@_url'];
    const media = it['media:content']?.['@_url'] ?? it['media:thumbnail']?.['@_url'];
    const image = it['imagem-destaque'] || media || (/image/.test(it.enclosure?.['@_type'] ?? '') ? enclosure : null);
    return {
      title: plain(it.title, 200),
      summary: plain(it.description, 220),
      url: String(it.link ?? ''),
      image: typeof image === 'string' && image ? image : null,
      date: iso(it.pubDate),
      source,
    };
  });
}

export const fetchAgenciaBrasil = () =>
  rss('https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml', 'Agência Brasil', 20);

export const fetchOnu = () => rss('https://news.un.org/feed/subscribe/pt/news/all/rss.xml', 'ONU News', 12);

/** Datas do IBGE vêm como "dd/mm/yyyy hh:mm:ss". */
const ibgeDate = (v: unknown): string | null => {
  const m = String(v ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? '00'}:${m[5] ?? '00'}:00-03:00` : iso(v);
};

/** Data no formato MM-DD-YYYY que o filtro do IBGE espera. */
const ibgeParam = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;

export async function fetchIbge(opts: { days?: number; page?: number; qtd?: number } = {}): Promise<Article[]> {
  const q = new URLSearchParams({ qtd: String(opts.qtd ?? 20) });
  if (opts.days) {
    q.set('de', ibgeParam(new Date(Date.now() - opts.days * 86_400_000)));
    q.set('ate', ibgeParam(new Date()));
  }
  if (opts.page) q.set('page', String(opts.page));
  const j = await getJson<any>(`https://servicodados.ibge.gov.br/api/v3/noticias/?${q}`);
  return (j.items ?? []).map((n: any) => {
    let image: string | null = null;
    try {
      const imgs = typeof n.imagens === 'string' ? JSON.parse(n.imagens) : n.imagens;
      if (imgs?.image_intro) image = `https://agenciadenoticias.ibge.gov.br/${imgs.image_intro}`;
    } catch { /* sem imagem */ }
    return {
      title: plain(n.titulo, 200),
      summary: plain(n.introducao, 220),
      url: n.link,
      image,
      date: ibgeDate(n.data_publicacao),
      source: 'IBGE',
    };
  });
}

export interface Outbreak {
  title: string;
  summary: string;
  url: string;
  date: string | null;
}

/** Disease Outbreak News da OMS (em inglês). */
export async function fetchOms(): Promise<Outbreak[]> {
  const q = `https://www.who.int/api/news/diseaseoutbreaknews?sf_culture=en&$top=6&$orderby=PublicationDateAndTime%20desc&$select=Title,PublicationDateAndTime,UrlName,Summary`;
  const j = await getJson<{ value: any[] }>(q);
  return (j.value ?? []).map((o) => ({
    title: plain(o.Title, 200),
    summary: plain(o.Summary, 260),
    url: `https://www.who.int/emergencies/disease-outbreak-news/item/${o.UrlName}`,
    date: iso(o.PublicationDateAndTime),
  }));
}

/** Converte as notícias do Brasil para o formato do arquivo. */
export function toRows(list: Article[], cat: Row['cat'] = 'brasil'): Row[] {
  return list
    .filter((a) => a.url && a.title && a.date)
    .map((a) => ({
      url: cleanUrl(a.url),
      source: a.source,
      grp: a.source,
      cat,
      title: a.title,
      summary: a.summary,
      image: a.image,
      date: a.date as string,
    }));
}

/** Histórico do IBGE (tem filtro por data): últimos `days` dias, até 3 páginas de 100. */
export async function backfillIbge(days = 30): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 1; page <= 3; page++) {
    const got = await fetchIbge({ days, page, qtd: 100 });
    rows.push(...toRows(got));
    if (got.length < 100) break;
  }
  return rows;
}
