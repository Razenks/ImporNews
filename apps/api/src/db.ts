import pg from 'pg';
import type { Row } from './sources/feeds.js';

export interface Point { t: number; v: number }

const mem = new Map<string, Point[]>();
let pool: pg.Pool | null = null;
let lastWrite = 0;

export async function initDb(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('[db] DATABASE_URL ausente — histórico só em memória');
    return;
  }
  try {
    pool = new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000 });
    await pool.query(`
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
    `);
    console.log('[db] Neon conectado');
  } catch (err) {
    console.warn('[db] indisponível, usando memória:', err instanceof Error ? err.message : err);
    await pool?.end().catch(() => {});
    pool = null;
  }
}

/** Guarda um snapshot das cotações (no máx. 1 por minuto no banco). */
export async function recordQuotes(rows: { symbol: string; value: number }[]): Promise<void> {
  const now = Date.now();
  for (const r of rows) {
    const arr = mem.get(r.symbol) ?? [];
    arr.push({ t: now, v: r.value });
    if (arr.length > 1500) arr.shift();
    mem.set(r.symbol, arr);
  }
  if (!pool || now - lastWrite < 60_000) return;
  lastWrite = now;
  try {
    await pool.query(
      `insert into quote_history (symbol, value) select * from unnest($1::text[], $2::float8[])`,
      [rows.map((r) => r.symbol), rows.map((r) => r.value)],
    );
  } catch (err) {
    console.warn('[db] falha ao gravar:', err instanceof Error ? err.message : err);
  }
}

/** Últimas 24 h, agrupadas em blocos de 15 min. */
export async function history24h(symbol: string): Promise<Point[]> {
  if (pool) {
    try {
      const { rows } = await pool.query(
        `select (extract(epoch from date_bin('15 minutes', ts, timestamptz '2000-01-01')) * 1000)::float8 as t,
                avg(value)::float8 as v
           from quote_history
          where symbol = $1 and ts > now() - interval '24 hours'
          group by 1 order by 1`,
        [symbol],
      );
      if (rows.length >= 2) return rows as Point[];
    } catch (err) {
      console.warn('[db] falha ao ler:', err instanceof Error ? err.message : err);
    }
  }
  const cutoff = Date.now() - 24 * 3_600_000;
  return (mem.get(symbol) ?? []).filter((p) => p.t >= cutoff);
}

export const dbReady = (): boolean => pool !== null;

// ── Arquivo de notícias ──────────────────────────────────────────────

/** O arquivo guarda 30 dias para consulta; o 31º dia é margem e depois é apagado. */
export const ARCHIVE_DAYS = 31;
const memArticles = new Map<string, Row>(); // fallback sem banco

/**
 * Faxina agendada: apaga notícias com mais de 31 dias e cotações com mais de 8 dias.
 * Roda ao iniciar e a cada 6 horas (ver server.ts). Retorna quantas notícias saíram.
 */
export async function purgeOld(): Promise<{ articles: number; quotes: number }> {
  const limit = Date.now() - ARCHIVE_DAYS * 86_400_000;
  for (const [url, r] of memArticles) if (Date.parse(r.date) < limit) memArticles.delete(url);
  if (!pool) return { articles: 0, quotes: 0 };
  const a = await pool.query(`delete from articles where published_at < now() - ($1::int * interval '1 day')`, [ARCHIVE_DAYS]);
  const q = await pool.query(`delete from quote_history where ts < now() - interval '8 days'`);
  return { articles: a.rowCount ?? 0, quotes: q.rowCount ?? 0 };
}

/** Guarda notícias (sem duplicar pelo link). Retorna quantas eram novas. */
export async function ingest(rows: Row[]): Promise<number> {
  if (!rows.length) return 0;
  const cutoff = Date.now() - ARCHIVE_DAYS * 86_400_000;
  const fresh = rows.filter((r) => Date.parse(r.date) >= cutoff);
  if (!fresh.length) return 0;

  if (!pool) {
    let added = 0;
    for (const r of fresh) {
      if (!memArticles.has(r.url)) added++;
      memArticles.set(r.url, r);
    }
    if (memArticles.size > 6000) {
      const keep = [...memArticles.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5000);
      memArticles.clear();
      keep.forEach((r) => memArticles.set(r.url, r));
    }
    return added;
  }

  // sem repetir o mesmo link dentro do mesmo lote (o Postgres recusa)
  const uniq = [...new Map(fresh.map((r) => [r.url, r])).values()];
  let added = 0;
  try {
    for (let i = 0; i < uniq.length; i += 400) {
      const b = uniq.slice(i, i + 400);
      const { rows: res } = await pool.query(
        `insert into articles (url, source, grp, cat, title, summary, image, published_at)
         select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::timestamptz[])
         on conflict (url) do update
            set title = excluded.title,
                summary = case when excluded.summary <> '' then excluded.summary else articles.summary end,
                image = coalesce(articles.image, excluded.image)
         returning (xmax = 0) as inserted`,
        [
          b.map((r) => r.url), b.map((r) => r.source), b.map((r) => r.grp), b.map((r) => r.cat),
          b.map((r) => r.title), b.map((r) => r.summary), b.map((r) => r.image), b.map((r) => r.date),
        ],
      );
      added += res.filter((x) => x.inserted).length;
    }
  } catch (err) {
    console.warn('[db] falha ao arquivar notícias:', err instanceof Error ? err.message : err);
  }
  return added;
}

export interface ArticleQuery {
  cats: string[];
  days: number;
  group?: string;
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
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

export async function queryArticles(q: ArticleQuery): Promise<ArticlePage> {
  const since = Date.now() - q.days * 86_400_000;

  if (pool) {
    try {
      const params: unknown[] = [q.cats, q.days];
      let where = `cat = any($1::text[]) and published_at > now() - ($2::int * interval '1 day')`;
      if (q.group) {
        params.push(q.group);
        where += ` and grp = $${params.length}`;
      }
      if (q.q) {
        params.push(`%${likeEscape(q.q)}%`);
        where += ` and (title ilike $${params.length} or summary ilike $${params.length})`;
      }
      const [items, total, groups] = await Promise.all([
        pool.query(
          `select url, source, grp, cat, title, summary, image, published_at
             from articles where ${where}
            order by published_at desc limit ${q.limit} offset ${q.offset}`,
          params,
        ),
        pool.query(`select count(*)::int as n from articles where ${where}`, params),
        pool.query(
          `select grp,
                  (count(*) filter (where published_at > now() - ($2::int * interval '1 day')))::int as n,
                  min(published_at) as oldest
             from articles where cat = any($1::text[])
            group by grp order by n desc, grp`,
          [q.cats, q.days],
        ),
      ]);
      return {
        items: items.rows.map((r) => ({
          url: r.url, source: r.source, grp: r.grp, cat: r.cat, title: r.title,
          summary: r.summary, image: r.image, date: new Date(r.published_at).toISOString(),
        })),
        total: total.rows[0].n,
        groups: groups.rows.map((g) => ({ grp: g.grp, n: g.n, oldest: new Date(g.oldest).toISOString() })),
      };
    } catch (err) {
      console.warn('[db] falha ao consultar notícias:', err instanceof Error ? err.message : err);
    }
  }

  // fallback em memória
  const needle = q.q?.toLowerCase();
  const all = [...memArticles.values()].filter((r) => q.cats.includes(r.cat));
  const inPeriod = all.filter((r) => Date.parse(r.date) > since);
  const filtered = inPeriod
    .filter((r) => !q.group || r.grp === q.group)
    .filter((r) => !needle || r.title.toLowerCase().includes(needle) || r.summary.toLowerCase().includes(needle))
    .sort((a, b) => b.date.localeCompare(a.date));
  const g = new Map<string, ArticleGroup>();
  for (const r of all) {
    const cur = g.get(r.grp) ?? { grp: r.grp, n: 0, oldest: r.date };
    if (Date.parse(r.date) > since) cur.n++;
    if (r.date < cur.oldest) cur.oldest = r.date;
    g.set(r.grp, cur);
  }
  return {
    items: filtered.slice(q.offset, q.offset + q.limit),
    total: filtered.length,
    groups: [...g.values()].sort((a, b) => b.n - a.n || a.grp.localeCompare(b.grp)),
  };
}
