import { getJson, plain } from '../http.js';
import { arr, fetchFeed, str, xmlParse, type FeedDef } from './feeds.js';
import { wmoLabel } from './weather.js';
import { memo } from '../memo.js';
import { CAPITAL, UFS, norm } from '../ufs.js';
import { isBad, isGood } from '../mood.js';

const MIN = 60_000;
const HOUR = 60 * MIN;

// ── Notícias da região ────────────────────────────────────────────────

export interface LocalItem {
  url: string;
  title: string;
  source: string;
  date: string;
  summary: string;
}

/** Veículos locais com feed próprio e atualizado (somados ao Google Notícias). */
const DIRECT: Record<string, FeedDef[]> = {
  MS: [
    { source: 'Campo Grande News', cat: 'brasil', url: 'https://www.campograndenews.com.br/rss' },
    { source: 'Primeira Página', cat: 'brasil', url: 'https://www.primeirapagina.com.br/feed/' },
  ],
};

export const GN = (path: string) => `https://news.google.com/rss/${path}${path.includes('?') ? '&' : '?'}hl=pt-BR&gl=BR&ceid=BR:pt-419`;

/** Só letras, números, espaço e hífen: o texto vai para uma busca externa. */
const clean = (s: string | undefined, max = 60): string =>
  (s ?? '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export async function googleNews(url: string): Promise<LocalItem[]> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; ImporNews/1.0)', accept: 'application/rss+xml,*/*' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Google Notícias respondeu ${res.status}`);
  const doc = xmlParse(await res.text());
  return arr<any>(doc?.rss?.channel?.item).flatMap((it) => {
    const source = str(it.source).trim() || 'Google Notícias';
    let title = plain(str(it.title), 220);
    // o Google acrescenta " - Veículo" ao título
    const tail = ` - ${source}`;
    if (title.endsWith(tail)) title = title.slice(0, -tail.length).trim();
    const t = Date.parse(str(it.pubDate));
    const link = str(it.link).trim();
    if (!title || !/^https?:/.test(link) || Number.isNaN(t)) return [];
    return [{ url: link, title, source, date: new Date(Math.min(t, Date.now())).toISOString(), summary: '' }];
  });
}

export interface LocalNewsQuery {
  uf: string;
  city?: string;
  scope: 'city' | 'state';
  days: 1 | 7 | 30;
  q?: string;
  /** só notícias boas (conquistas, solidariedade…) */
  good?: boolean;
  /** esconde crimes e tragédias */
  calm?: boolean;
}

const GOOD_TERMS = '(conquista OR inauguração OR solidariedade OR premiada OR campeã OR campeão OR "boa notícia" OR homenagem OR vitória OR medalha OR doação OR festival OR formatura)';
const NOT_BAD = '-morte -assassinato -assalto -tiroteio -acidente -preso -tragédia';

async function loadLocalNews(p: LocalNewsQuery): Promise<LocalItem[]> {
  const state = UFS[p.uf];
  const city = p.scope === 'city' ? clean(p.city) : '';
  const extra = clean(p.q);
  const base = city ? `"${city}" ("${p.uf}" OR "${state}")` : `"${state}"`;
  const query = `${base}${extra ? ` ${extra}` : ''}${p.good ? ` ${GOOD_TERMS} ${NOT_BAD}` : ''} when:${p.days}d`;

  const jobs: Promise<LocalItem[]>[] = [googleNews(GN(`search?q=${encodeURIComponent(query)}`))];
  // a seção "Local" do Google é a mais precisa para a cidade, mas só existe para o dia
  if (city && p.days === 1 && !extra) {
    jobs.push(googleNews(GN(`headlines/section/geo/${encodeURIComponent(`${city}, ${p.uf}`)}`)));
  }
  for (const f of DIRECT[p.uf] ?? []) {
    jobs.push(
      fetchFeed(f).then((rows) =>
        rows.map((r) => ({ url: r.url, title: r.title, source: r.source, date: r.date, summary: r.summary })),
      ),
    );
  }

  const settled = await Promise.allSettled(jobs);
  const all = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  if (!all.length && settled.every((s) => s.status === 'rejected')) {
    throw new Error((settled[0] as PromiseRejectedResult).reason?.message ?? 'fontes locais indisponíveis');
  }

  const since = Date.now() - p.days * 86_400_000;
  const needle = city ? norm(city) : '';
  const words = extra ? norm(extra).split(' ') : [];
  const seen = new Set<string>();
  return all
    .filter((i) => Date.parse(i.date) >= since)
    .filter((i) => {
      // feeds próprios do estado trazem tudo; para cidade, só o que cita a cidade
      if (i.summary === '' && !DIRECT[p.uf]?.some((f) => f.source === i.source)) return true;
      const hay = norm(`${i.title} ${i.summary}`);
      return (!needle || hay.includes(needle)) && words.every((w) => hay.includes(w));
    })
    .filter((i) => (p.good ? isGood(i.title, i.summary) : p.calm ? !isBad(i.title, i.summary) : true))
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((i) => {
      const k = norm(i.title).slice(0, 70);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 120);
}

export async function localNews(p: LocalNewsQuery, opts: { source?: string; limit: number; offset: number }) {
  const key = `news|${p.uf}|${norm(p.city ?? '')}|${p.scope}|${p.days}|${norm(p.q ?? '')}|${p.good ? 'g' : p.calm ? 'c' : ''}`;
  const list = await memo(key, 10 * MIN, () => loadLocalNews(p));

  const counts = new Map<string, number>();
  for (const i of list) counts.set(i.source, (counts.get(i.source) ?? 0) + 1);
  const sources = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([name, n]) => ({ name, n }));

  const filtered = opts.source ? list.filter((i) => i.source === opts.source) : list;
  return { items: filtered.slice(opts.offset, opts.offset + opts.limit), total: filtered.length, sources };
}

// ── Cidades (IBGE) ────────────────────────────────────────────────────

export interface City {
  id: number;
  nome: string;
}

export const cities = (uf: string): Promise<City[]> =>
  memo(`cities|${uf}`, 7 * 24 * HOUR, async () => {
    const j = await getJson<{ id: number; nome: string }[]>(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
    );
    return j.map((m) => ({ id: m.id, nome: m.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  });

// ── Clima da cidade ───────────────────────────────────────────────────

async function geocode(city: string, uf: string): Promise<{ name: string; lat: number; lon: number }> {
  return memo(`geo|${uf}|${norm(city)}`, 30 * 24 * HOUR, async () => {
    const j = await getJson<{ results?: { name: string; latitude: number; longitude: number; admin1?: string }[] }>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=pt&countryCode=BR`,
    );
    const rs = j.results ?? [];
    const hit = rs.find((r) => norm(r.admin1 ?? '') === norm(UFS[uf])) ?? rs[0];
    if (!hit) throw new Error(`não achei "${city}" no mapa`);
    return { name: hit.name, lat: hit.latitude, lon: hit.longitude };
  });
}

export interface LocalWeather {
  place: { name: string; uf: string; capital: boolean };
  now: { temp: number; feels: number; humidity: number; wind: number; label: string };
  days: { date: string; min: number; max: number; rain: number | null; label: string }[];
}

export async function localWeather(uf: string, cityRaw?: string): Promise<LocalWeather> {
  const asked = clean(cityRaw);
  const city = asked || CAPITAL[uf];
  const geo = await geocode(city, uf);
  const forecast = await memo(`wx|${geo.lat.toFixed(2)}|${geo.lon.toFixed(2)}`, 10 * MIN, async () => {
    const q = new URLSearchParams({
      latitude: String(geo.lat),
      longitude: String(geo.lon),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'America/Sao_Paulo',
      forecast_days: '4',
    });
    const j = await getJson<any>(`https://api.open-meteo.com/v1/forecast?${q}`);
    return {
      now: {
        temp: Math.round(j.current.temperature_2m),
        feels: Math.round(j.current.apparent_temperature),
        humidity: Math.round(j.current.relative_humidity_2m),
        wind: Math.round(j.current.wind_speed_10m),
        label: wmoLabel(j.current.weather_code),
      },
      days: (j.daily.time as string[]).map((date, i) => ({
        date,
        min: Math.round(j.daily.temperature_2m_min[i]),
        max: Math.round(j.daily.temperature_2m_max[i]),
        rain: j.daily.precipitation_probability_max?.[i] ?? null,
        label: wmoLabel(j.daily.weather_code[i]),
      })),
    };
  });
  // o "lugar" fica fora do cache: o mesmo ponto pode ser pedido como cidade ou como capital do estado
  return { place: { name: geo.name, uf, capital: !asked }, ...forecast };
}

// ── Bancada federal do estado ─────────────────────────────────────────

export interface Parlamentar {
  id: number;
  nome: string;
  partido: string;
  foto: string | null;
  url: string;
}

export interface Bancada {
  senadores: Parlamentar[];
  deputados: Parlamentar[];
}

export const bancada = (uf: string): Promise<Bancada> =>
  memo(`bancada|${uf}`, 12 * HOUR, async () => {
    const [dep, sen] = await Promise.all([
      getJson<{ dados: any[] }>(
        `https://dadosabertos.camara.leg.br/api/v2/deputados?siglaUf=${uf}&itens=100&ordem=ASC&ordenarPor=nome`,
      ),
      getJson<any>(`https://legis.senado.leg.br/dadosabertos/senador/lista/atual?uf=${uf}`),
    ]);
    const senadores = arr<any>(sen?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar).map((p) => {
      const i = p.IdentificacaoParlamentar;
      return {
        id: Number(i.CodigoParlamentar),
        nome: i.NomeParlamentar,
        partido: i.SiglaPartidoParlamentar ?? '',
        foto: i.UrlFotoParlamentar ?? null,
        url: `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${i.CodigoParlamentar}`,
      };
    });
    const deputados = dep.dados.map((d) => ({
      id: d.id as number,
      nome: d.nome as string,
      partido: (d.siglaPartido as string) ?? '',
      foto: (d.urlFoto as string) ?? null,
      url: `https://www.camara.leg.br/deputados/${d.id}`,
    }));
    return { senadores, deputados };
  });
