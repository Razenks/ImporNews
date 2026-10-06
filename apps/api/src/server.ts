import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { bundle, keys, read, register } from './store.js';
import { dbReady, history24h, ingest, initDb, purgeOld, queryArticles, recordQuotes, type Point } from './db.js';
import { fetchDaily, fetchIndicators, fetchQuotes, type Quote } from './sources/markets.js';
import { fetchCamara, fetchSenado } from './sources/gov.js';
import { backfillIbge, fetchAgenciaBrasil, fetchIbge, fetchOms, fetchOnu, toRows } from './sources/news.js';
import { backfillTech, collectTech } from './sources/tech.js';
import { fetchAlerts, fetchWeather } from './sources/weather.js';

const PORT = Number(process.env.PORT ?? 3001);
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = Fastify({ logger: { level: 'warn' }, trustProxy: true });

await app.register(cors, {
  origin: (origin, cb) => cb(null, !origin || ORIGINS.includes(origin)),
  methods: ['GET'],
});
await app.register(rateLimit, { max: 180, timeWindow: '1 minute' });

// ── SSE: cotações ao vivo ────────────────────────────────────────────
const clients = new Set<import('node:http').ServerResponse>();

function broadcast(quotes: Quote[]): void {
  const msg = `event: quotes\ndata: ${JSON.stringify(quotes)}\n\n`;
  for (const c of clients) c.write(msg);
}

app.get('/api/stream', (req, reply) => {
  reply.hijack();
  const cors = Object.fromEntries(
    Object.entries(reply.getHeaders()).filter(([k]) => k.startsWith('access-control') || k === 'vary'),
  ) as Record<string, string>;
  reply.raw.writeHead(200, {
    ...cors,
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  const snap = read('quotes');
  if (snap?.data) reply.raw.write(`event: quotes\ndata: ${JSON.stringify(snap.data)}\n\n`);
  clients.add(reply.raw);
  const beat = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);
  req.raw.on('close', () => {
    clearInterval(beat);
    clients.delete(reply.raw);
  });
});

// ── Dados ────────────────────────────────────────────────────────────
app.get('/api/health', async () => ({ ok: true, db: dbReady(), clients: clients.size, sources: keys() }));
app.get('/api/bundle', async () => bundle());

app.get<{ Params: { symbol: string }; Querystring: { range?: string } }>(
  '/api/history/:symbol',
  async (req, reply) => {
    const symbol = req.params.symbol.toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(symbol)) return reply.code(400).send({ error: 'símbolo inválido' });
    if (req.query.range === '24h') return { range: '24h', points: await history24h(symbol) };
    const daily = read('daily')?.data as Record<string, Point[]> | null | undefined;
    return { range: '30d', points: daily?.[symbol] ?? [] };
  },
);

// Arquivo de notícias: período de 1 a 30 dias, por categoria, veículo e texto.
const CATS = new Set(['brasil', 'tech-br', 'tech-mundo', 'empresas']);
const int = (v: string | undefined, d: number, lo: number, hi: number): number => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

app.get<{ Querystring: { cat?: string; days?: string; group?: string; q?: string; limit?: string; offset?: string } }>(
  '/api/articles',
  async (req, reply) => {
    const cats = (req.query.cat ?? '').split(',').map((s) => s.trim()).filter((c) => CATS.has(c));
    if (!cats.length) return reply.code(400).send({ error: 'categoria inválida' });
    const text = (req.query.q ?? '').trim().slice(0, 80);
    const page = await queryArticles({
      cats,
      days: int(req.query.days, 7, 1, 30),
      group: req.query.group?.trim().slice(0, 60) || undefined,
      q: text || undefined,
      limit: int(req.query.limit, 20, 1, 50),
      offset: int(req.query.offset, 0, 0, 5000),
    });
    reply.header('cache-control', 'public, max-age=20');
    return page;
  },
);

app.get<{ Params: { key: string } }>('/api/:key', async (req, reply) => {
  const entry = read(req.params.key);
  return entry ?? reply.code(404).send({ error: 'fonte desconhecida' });
});

// ── Jobs (intervalo, escalonados para não disparar tudo junto) ───────
const min = (n: number) => n * 60_000;

register('quotes', 30_000, fetchQuotes, (q) => {
  broadcast(q);
  void recordQuotes(q.map((x) => ({ symbol: x.symbol, value: x.value })));
});
register('daily', min(30), fetchDaily, undefined, 1_000);
register('indicators', min(30), fetchIndicators, undefined, 1_500);
register('camara', min(10), fetchCamara, undefined, 2_000);
register('senado', min(10), fetchSenado, undefined, 2_500);
register('agenciabrasil', min(5), fetchAgenciaBrasil, (a) => void ingest(toRows(a)), 3_000);
register('ibge', min(10), () => fetchIbge(), (a) => void ingest(toRows(a)), 3_500);
register('onu', min(10), fetchOnu, undefined, 4_000);
register('oms', min(30), fetchOms, undefined, 4_500);
register('weather', min(15), fetchWeather, undefined, 5_000);
register('alerts', min(15), fetchAlerts, undefined, 5_500);

// Tecnologia: ~40 fontes (veículos e newsrooms oficiais), a cada 10 min, direto para o arquivo.
register('tech', min(10), collectTech, (s) => {
  console.log(`[tech] ${s.ok}/${s.total} fontes ok, +${s.added} novas${s.failed.length ? ` (falharam: ${s.failed.join(', ')})` : ''}`);
}, 6_000);

// Faxina automática: nada com mais de 31 dias fica no banco.
register('purge', min(6 * 60), purgeOld, (r) => {
  if (r.articles || r.quotes) console.log(`[faxina] apagou ${r.articles} notícias e ${r.quotes} cotações antigas`);
}, 20_000);

await initDb();

// Histórico inicial (30 dias), uma vez por inicialização; é idempotente.
setTimeout(async () => {
  try {
    const added = (await backfillTech(30)) + (await ingest(await backfillIbge(30)));
    console.log(`[arquivo] histórico inicial: +${added} notícias`);
  } catch (err) {
    console.warn('[arquivo] histórico inicial falhou:', err instanceof Error ? err.message : err);
  }
}, 12_000).unref();

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`ImporNews API em http://localhost:${PORT}  (origens: ${ORIGINS.join(', ')})`);
