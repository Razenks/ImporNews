import pg from 'pg';
import { regionOf, type Region, type Row } from './sources/feeds.js';
import { isBad, isGood } from './mood.js';

/**
 * Armazenamento "memória primeiro":
 *  - todas as consultas (notícias e histórico de cotações) saem da MEMÓRIA do servidor;
 *  - o Neon (Postgres) serve só para o que sobrevive a reinícios: uma leitura ao iniciar
 *    e gravações em lote a cada 20 min. Assim o banco pode "dormir" quase o tempo todo
 *    (economiza a cota do plano gratuito) e, se ele cair ou estourar a cota, o site continua
 *    funcionando e volta a gravar sozinho quando o banco voltar.
 */

export interface Point { t: number; v: number }

const FLUSH_EVERY = 20 * 60_000;
const RECONNECT_EVERY = 30 * 60_000;

let pool: pg.Pool | null = null;
let url: string | undefined;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── conexão ──────────────────────────────────────────────────────────

const SCHEMA = `
  create table if not exists quote_history (
    symbol text not null,
    value  double precision not null,
    ts     timestamptz not null default now()
  );
  create index if not exists quote_history_symbol_ts on quote_history (symbol, ts desc);

  create table if not exists articles (
    url          text primary key,
    source       text not null,
    grp          text not null,
    cat          text not null,
    title        text not null,
    summary      text not null default '',
    image        text,
    published_at timestamptz not null,
    fetched_at   timestamptz not null default now()
  );
  create index if not exists articles_cat_pub on articles (cat, published_at desc);
  alter table articles add column if not exists good boolean not null default false;
  alter table articles add column if not exists tag text;
  alter table articles add column if not exists region text;
`;

/** Tenta conectar, criar as tabelas e carregar o que já estava guardado. Nunca lança erro. */
async function connect(): Promise<boolean> {
  if (!url) return false;
  const p = new pg.Pool({ connectionString: url, max: 2, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
  try {
    await p.query(SCHEMA);
    await loadFromDb(p);
    pool = p;
    console.log('[db] Neon conectado');
    return true;
  } catch (err) {
    console.warn('[db] indisponível (o site segue funcionando só com a memória):', errMsg(err));
    await p.end().catch(() => {});
    return false;
  }
}

export async function initDb(): Promise<void> {
  url = process.env.DATABASE_URL;
  if (!url) {
    console.log('[db] DATABASE_URL ausente — tudo em memória');
    return;
  }
  await connect();

  // ao ser desligado (deploy novo), grava o que está pendente antes de sair
  process.once('SIGTERM', () => {
    void Promise.race([flush(), new Promise((r) => setTimeout(r, 4_000))]).finally(() => process.exit(0));
  });

  // grava em lote de tempos em tempos e, se o banco estiver fora, tenta reconectar
  setInterval(() => void flush(), FLUSH_EVERY).unref();
  setInterval(() => {
    if (!pool) void connect().then((ok) => { if (ok) void flush(); });
  }, RECONNECT_EVERY).unref();
}

export const dbReady = (): boolean => pool !== null;

export const dbStats = () => ({ connected: pool !== null, articles: articles.size, pendingArticles: dirty.size, pendingQuotes: qPending.length });

// ── notícias (memória + gravação em lote) ────────────────────────────

/** O arquivo guarda 30 dias para consulta; o 31º dia é margem e depois é apagado. */
export const ARCHIVE_DAYS = 31;
const MAX_ARTICLES = 40_000;

type Stored = Row & { good: boolean; region: Region };

const articles = new Map<string, Stored>();
const dirty = new Set<string>(); // links ainda não gravados no banco

// notícias de produto/empresa de tecnologia, esporte e games não contam como "boas notícias"
const NOT_GOOD_CATS = new Set(['tech-br', 'tech-mundo', 'empresas', 'esportes', 'games']);
const isGoodRow = (r: Pick<Row, 'cat' | 'title' | 'summary'>): boolean =>
  NOT_GOOD_CATS.has(r.cat) ? false : r.cat === 'boas' ? !isBad(r.title, r.summary) : isGood(r.title, r.summary);

// luta de entretenimento (WWE) não é arte marcial
const WWE = /(wwe|wrestl|ladder match|smackdown|wrestlemania|royal rumble)/i;

/** Lê do banco o que estava guardado (últimos 31 dias) para a memória. Roda ao iniciar/reconectar. */
async function loadFromDb(p: pg.Pool): Promise<void> {
  const { rows } = await p.query(
    `select url, source, grp, cat, title, summary, image, published_at, tag, region
       from articles where published_at > now() - ($1::int * interval '1 day')`,
    [ARCHIVE_DAYS],
  );
  let n = 0;
  for (const r of rows) {
    if (r.tag && ['lutas', 'mma'].includes(r.tag) && WWE.test(r.title)) continue;
    const row: Row = {
      url: r.url, source: r.source, grp: r.grp, cat: r.cat, title: r.title, summary: r.summary ?? '',
      image: r.image, date: new Date(r.published_at).toISOString(), tag: r.tag ?? undefined,
    };
    const region: Region =
      (r.region as Region | null) ??
      (r.cat === 'boas' && (r.source === 'Só Notícia Boa' || String(r.url).startsWith('https://news.google.com/')) ? 'br' : regionOf(r.cat));
    // o que já veio coletado nesta execução é mais novo que o do banco: não sobrescreve
    if (!articles.has(row.url)) articles.set(row.url, { ...row, good: isGoodRow(row), region });
    n++;
  }
  console.log(`[db] ${n} notícias carregadas do banco para a memória`);
}

/** Guarda notícias (sem duplicar pelo link). Retorna quantas eram novas. */
export async function ingest(rows: Row[]): Promise<number> {
  if (!rows.length) return 0;
  const cutoff = Date.now() - ARCHIVE_DAYS * 86_400_000;
  let added = 0;
  for (const r of rows) {
    if (Date.parse(r.date) < cutoff) continue;
    const prev = articles.get(r.url);
    const region = r.region ?? prev?.region ?? regionOf(r.cat);
    const next: Stored = {
      ...r,
      summary: r.summary || prev?.summary || '',
      image: prev?.image ?? r.image,
      tag: r.tag ?? prev?.tag,
      region,
      good: isGoodRow(r),
    };
    articles.set(r.url, next);
    if (!prev) {
      added++;
      dirty.add(r.url);
    } else if (prev.title !== next.title || prev.tag !== next.tag || prev.good !== next.good || prev.summary !== next.summary) {
      dirty.add(r.url);
    }
  }
  trim();
  return added;
}

function trim(): void {
  if (articles.size <= MAX_ARTICLES) return;
  const keep = [...articles.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_ARTICLES - 2_000);
  const keepSet = new Set(keep.map((r) => r.url));
  for (const u of articles.keys()) if (!keepSet.has(u)) { articles.delete(u); dirty.delete(u); }
}

/** Grava no banco (em lote) o que ainda não foi gravado. Se o banco estiver fora, tenta de novo depois. */
export async function flush(): Promise<void> {
  await flushQuotes();
  if (!pool || !dirty.size) return;
  const urls = [...dirty];
  const batchRows = urls.map((u) => articles.get(u)).filter((r): r is Stored => !!r);
  try {
    for (let i = 0; i < batchRows.length; i += 400) {
      const b = batchRows.slice(i, i + 400);
      await pool.query(
        `insert into articles (url, source, grp, cat, title, summary, image, published_at, good, tag, region)
         select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::timestamptz[], $9::boolean[], $10::text[], $11::text[])
         on conflict (url) do update
            set title = excluded.title,
                summary = case when excluded.summary <> '' then excluded.summary else articles.summary end,
                image = coalesce(articles.image, excluded.image),
                good = excluded.good,
                tag = coalesce(excluded.tag, articles.tag),
                region = coalesce(excluded.region, articles.region)`,
        [
          b.map((r) => r.url), b.map((r) => r.source), b.map((r) => r.grp), b.map((r) => r.cat),
          b.map((r) => r.title), b.map((r) => r.summary), b.map((r) => r.image), b.map((r) => r.date),
          b.map((r) => r.good), b.map((r) => r.tag ?? null), b.map((r) => r.region),
        ],
      );
      for (const r of b) dirty.delete(r.url);
    }
    console.log(`[db] gravou ${batchRows.length} notícias em lote`);
  } catch (err) {
    console.warn('[db] falha ao gravar notícias (tento de novo no próximo lote):', errMsg(err));
    // se a cota estourou, solta a conexão para o banco poder dormir; a reconexão automática cuida do resto
    const p = pool;
    pool = null;
    void p?.end().catch(() => {});
  }
}

/** Faxina agendada: apaga notícias com mais de 31 dias e cotações com mais de 8 dias. */
export async function purgeOld(): Promise<{ articles: number; quotes: number }> {
  const limit = Date.now() - ARCHIVE_DAYS * 86_400_000;
  let local = 0;
  for (const [u, r] of articles) if (Date.parse(r.date) < limit) { articles.delete(u); dirty.delete(u); local++; }
  const qLimit = Date.now() - 8 * 86_400_000;
  for (const [s, arr] of qMem) qMem.set(s, arr.filter((p) => p.t >= qLimit));
  if (!pool) return { articles: local, quotes: 0 };
  try {
    const a = await pool.query(`delete from articles where published_at < now() - ($1::int * interval '1 day')`, [ARCHIVE_DAYS]);
    const q = await pool.query(`delete from quote_history where ts < now() - interval '8 days'`);
    return { articles: a.rowCount ?? local, quotes: q.rowCount ?? 0 };
  } catch (err) {
    console.warn('[db] falha na faxina do banco:', errMsg(err));
    return { articles: local, quotes: 0 };
  }
}

// ── consulta (sempre na memória) ─────────────────────────────────────

export interface ArticleQuery {
  cats: string[];
  days: number;
  group?: string;
  /** modalidades (esportes); várias = "qualquer uma destas" */
  tags?: string[];
  /** 'br' ou 'mundo' */
  region?: string;
  q?: string;
  limit: number;
  offset: number;
}

export interface ArticleGroup {
  grp: string;
  n: number; // no período escolhido
  oldest: string; // a notícia mais antiga que o arquivo tem desse grupo
}

export interface ArticlePage {
  items: (Omit<Row, 'date'> & { date: string })[];
  total: number;
  groups: ArticleGroup[];
  /** quantas notícias há por modalidade no período (só categorias com modalidade) */
  tagCounts: { tag: string; n: number }[];
}

export async function queryArticles(q: ArticleQuery): Promise<ArticlePage> {
  const since = Date.now() - q.days * 86_400_000;
  const goodOnly = q.cats.length === 1 && q.cats[0] === 'boas';
  const needle = q.q?.toLowerCase();

  const all = [...articles.values()].filter((r) => (goodOnly ? r.good : q.cats.includes(r.cat)));
  const inPeriod = all.filter((r) => Date.parse(r.date) > since);
  const filtered = inPeriod
    .filter((r) => !q.group || r.grp === q.group)
    .filter((r) => !q.tags?.length || (r.tag !== undefined && q.tags.includes(r.tag)))
    .filter((r) => !q.region || r.region === q.region)
    .filter((r) => !needle || r.title.toLowerCase().includes(needle) || r.summary.toLowerCase().includes(needle))
    .sort((a, b) => b.date.localeCompare(a.date));

  const g = new Map<string, ArticleGroup>();
  for (const r of all) {
    const cur = g.get(r.grp) ?? { grp: r.grp, n: 0, oldest: r.date };
    if (Date.parse(r.date) > since) cur.n++;
    if (r.date < cur.oldest) cur.oldest = r.date;
    g.set(r.grp, cur);
  }

  const tagCounts = goodOnly
    ? []
    : [...inPeriod.reduce((m, r) => (r.tag ? m.set(r.tag, (m.get(r.tag) ?? 0) + 1) : m), new Map<string, number>())]
        .map(([tag, n]) => ({ tag, n }))
        .sort((a, b) => b.n - a.n);

  return {
    items: filtered.slice(q.offset, q.offset + q.limit).map((r) => ({
      url: r.url, source: r.source, grp: r.grp, cat: r.cat, title: r.title,
      summary: r.summary, image: r.image, date: r.date, tag: r.tag,
    })),
    total: filtered.length,
    groups: [...g.values()].sort((a, b) => b.n - a.n || a.grp.localeCompare(b.grp)),
    tagCounts,
  };
}

// ── histórico de cotações ────────────────────────────────────────────

const SAMPLE_EVERY = 5 * 60_000; // um ponto a cada 5 min por moeda
const qMem = new Map<string, Point[]>();
const qLast = new Map<string, number>();
let qPending: { symbol: string; value: number; t: number }[] = [];

/** Guarda um ponto de cada cotação a cada 5 min (em memória; vai para o banco em lote). */
export async function recordQuotes(rows: { symbol: string; value: number }[]): Promise<void> {
  const now = Date.now();
  for (const r of rows) {
    if (now - (qLast.get(r.symbol) ?? 0) < SAMPLE_EVERY) continue;
    qLast.set(r.symbol, now);
    const arr = qMem.get(r.symbol) ?? [];
    arr.push({ t: now, v: r.value });
    if (arr.length > 2_500) arr.shift();
    qMem.set(r.symbol, arr);
    qPending.push({ symbol: r.symbol, value: r.value, t: now });
  }
  if (qPending.length > 5_000) qPending = qPending.slice(-3_000);
}

async function flushQuotes(): Promise<void> {
  if (!pool || !qPending.length) return;
  const batch = qPending;
  qPending = [];
  try {
    await pool.query(
      `insert into quote_history (symbol, value, ts)
       select * from unnest($1::text[], $2::float8[], $3::timestamptz[])`,
      [batch.map((x) => x.symbol), batch.map((x) => x.value), batch.map((x) => new Date(x.t).toISOString())],
    );
  } catch (err) {
    qPending = [...batch, ...qPending].slice(-3_000);
    console.warn('[db] falha ao gravar cotações:', errMsg(err));
  }
}

/** Últimas 24 h, agrupadas em blocos de 15 min (a partir da memória). */
export async function history24h(symbol: string): Promise<Point[]> {
  const cutoff = Date.now() - 24 * 3_600_000;
  const pts = (qMem.get(symbol) ?? []).filter((p) => p.t >= cutoff);
  const bucket = 15 * 60_000;
  const m = new Map<number, { s: number; n: number }>();
  for (const p of pts) {
    const k = Math.floor(p.t / bucket) * bucket;
    const c = m.get(k) ?? { s: 0, n: 0 };
    c.s += p.v;
    c.n++;
    m.set(k, c);
  }
  return [...m].sort((a, b) => a[0] - b[0]).map(([t, c]) => ({ t, v: c.s / c.n }));
}
