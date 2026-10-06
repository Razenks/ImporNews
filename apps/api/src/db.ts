import pg from 'pg';

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
    if (Math.random() < 0.02) {
      await pool.query(`delete from quote_history where ts < now() - interval '8 days'`);
    }
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
