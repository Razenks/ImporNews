const BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export interface Envelope<T> {
  data: T | null;
  updatedAt: number | null;
  stale: boolean;
  error: string | null;
}

export interface Quote {
  symbol: string;
  name: string;
  value: number;
  pct: number | null;
  high: number | null;
  low: number | null;
  usd: number | null;
  ts: number;
}

export interface Indicator {
  id: string;
  label: string;
  unit: 'BRL' | '%' | '% a.a.';
  value: number;
  prev: number | null;
  ref: string;
  series: number[];
  note: string;
}

export interface Point { t: number; v: number }

export interface Article {
  title: string;
  summary: string;
  url: string;
  image: string | null;
  date: string | null;
  source: string;
}

/** Notícia do arquivo (guardada no banco por até 31 dias). */
export interface Arc {
  tag?: string;
  url: string;
  source: string;
  grp: string;
  cat: string;
  title: string;
  summary: string;
  image: string | null;
  date: string;
}

export interface ArcGroup {
  grp: string;
  n: number; // no período escolhido
  oldest: string; // a notícia mais antiga que o arquivo já tem dessa fonte
}

export interface ArcPage {
  items: Arc[];
  total: number;
  groups: ArcGroup[];
  /** quantas notícias por modalidade/plataforma no período (esportes e games) */
  tagCounts?: { tag: string; n: number }[];
}

export interface ArcQuery {
  cat: string;
  days: 1 | 7 | 30;
  group?: string;
  /** modalidades/plataformas, separadas por vírgula */
  tag?: string;
  /** só veículos do Brasil ('br') ou do mundo ('mundo') */
  region?: 'br' | 'mundo';
  q?: string;
  limit?: number;
  offset?: number;
}

export interface Outbreak { title: string; summary: string; url: string; date: string | null }

export interface Proposicao { id: number; ref: string; ementa: string; data: string; url: string; casa: 'Câmara' | 'Senado' }

export interface Camara {
  proposicoes: Proposicao[];
  eventos: { id: number; inicio: string; tipo: string; descricao: string; local: string | null; situacao: string; url: string }[];
  votacoes: {
    id: string; data: string; descricao: string; aprovada: boolean | null; orgao: string;
    url: string | null; ref: string | null; propUrl: string | null;
  }[];
}

export interface Senado {
  votacoes: {
    id: number; ref: string; descricao: string; data: string;
    resultado: 'aprovada' | 'rejeitada' | 'outro';
    sim: number | null; nao: number | null; abst: number | null;
    url: string | null;
  }[];
  materias: {
    id: number; ref: string; ementa: string; autoria: string; situacao: string; data: string;
    url: string | null; doc: string | null;
  }[];
}

// ── Minha região ─────────────────────────────────────────────────────
export interface LocalItem { url: string; title: string; source: string; date: string; summary: string }
export interface LocalNewsPage { items: LocalItem[]; total: number; sources: { name: string; n: number }[] }
export interface City { id: number; nome: string }
export interface LocalWeather {
  place: { name: string; uf: string; capital: boolean };
  now: { temp: number; feels: number; humidity: number; wind: number; label: string };
  days: { date: string; min: number; max: number; rain: number | null; label: string }[];
}
export interface Parlamentar { id: number; nome: string; partido: string; foto: string | null; url: string }
export interface Bancada { senadores: Parlamentar[]; deputados: Parlamentar[] }
export interface LocalAlerts { total: number; avisos: Alerts['avisos'] }
export interface SearchResult { news: Arc[]; newsTotal: number; proposicoes: Proposicao[] }

export interface CityWeather {
  name: string; uf: string; temp: number; feels: number; min: number; max: number;
  humidity: number; rain: number | null; wind: number; label: string;
}

export interface Alerts {
  total: number;
  porSeveridade: Record<string, number>;
  avisos: {
    id: number; tipo: string; severidade: string; rank: number; cor: string;
    estados: string; ufs: string[]; inicio: string; fim: string; risco: string;
  }[];
}

export interface Bundle {
  quotes: Envelope<Quote[]>;
  daily: Envelope<Record<string, Point[]>>;
  indicators: Envelope<Indicator[]>;
  camara: Envelope<Camara>;
  senado: Envelope<Senado>;
  agenciabrasil: Envelope<Article[]>;
  ibge: Envelope<Article[]>;
  onu: Envelope<Article[]>;
  oms: Envelope<Outbreak[]>;
  weather: Envelope<CityWeather[]>;
  alerts: Envelope<Alerts>;
  tech: Envelope<{ total: number; ok: number; failed: string[]; added: number }>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchBundle = () => get<Bundle>('/api/bundle');

export interface LocalNewsQuery {
  uf: string;
  city?: string;
  scope: 'city' | 'state';
  days: 1 | 7 | 30;
  q?: string;
  source?: string;
  limit?: number;
  offset?: number;
  /** só notícias boas */
  good?: boolean;
  /** esconde crimes e tragédias */
  calm?: boolean;
}

export function fetchLocalNews(q: LocalNewsQuery): Promise<LocalNewsPage> {
  const p = new URLSearchParams({ uf: q.uf, scope: q.scope, days: String(q.days), limit: String(q.limit ?? 20) });
  if (q.city) p.set('city', q.city);
  if (q.q) p.set('q', q.q);
  if (q.source) p.set('source', q.source);
  if (q.good) p.set('good', '1');
  else if (q.calm) p.set('calm', '1');
  if (q.offset) p.set('offset', String(q.offset));
  return get<LocalNewsPage>(`/api/local/news?${p}`);
}

export const fetchCities = (uf: string) => get<City[]>(`/api/local/cidades?uf=${uf}`);
export const fetchLocalWeather = (uf: string, city?: string) =>
  get<LocalWeather>(`/api/local/clima?uf=${uf}${city ? `&city=${encodeURIComponent(city)}` : ''}`);
export const fetchBancada = (uf: string) => get<Bancada>(`/api/local/bancada?uf=${uf}`);
export const fetchLocalAlerts = (uf: string) => get<LocalAlerts>(`/api/local/alertas?uf=${uf}`);
export const searchProposicoes = (q: string) => get<Proposicao[]>(`/api/congresso/busca?q=${encodeURIComponent(q)}`);
export const searchAll = (q: string) => get<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`);

export function fetchArticles(q: ArcQuery): Promise<ArcPage> {
  const p = new URLSearchParams({ cat: q.cat, days: String(q.days), limit: String(q.limit ?? 20) });
  if (q.offset) p.set('offset', String(q.offset));
  if (q.group) p.set('group', q.group);
  if (q.tag) p.set('tag', q.tag);
  if (q.region) p.set('region', q.region);
  if (q.q) p.set('q', q.q);
  return get<ArcPage>(`/api/articles?${p}`);
}

export const fetchHistory = (symbol: string, range: '24h' | '30d') =>
  get<{ range: string; points: Point[] }>(`/api/history/${symbol}?range=${range}`).then((r) => r.points);

/** Abre o canal de cotações ao vivo (SSE). Reconecta sozinho. Retorna função de encerramento. */
export function openStream(onQuotes: (q: Quote[]) => void, onStatus: (online: boolean) => void): () => void {
  const es = new EventSource(`${BASE}/api/stream`);
  es.addEventListener('quotes', (e) => {
    try {
      onQuotes(JSON.parse((e as MessageEvent).data));
      onStatus(true);
    } catch { /* mensagem malformada */ }
  });
  es.onopen = () => onStatus(true);
  es.onerror = () => onStatus(false);
  return () => es.close();
}
