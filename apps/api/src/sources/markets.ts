import { getJson } from '../http.js';
import type { Point } from '../db.js';

export interface Quote {
  symbol: string;
  name: string;
  value: number;
  pct: number | null;
  high: number | null;
  low: number | null;
  usd: number | null; // valor em dólar (cripto)
  ts: number;
}

const PAIRS = [
  { symbol: 'USD', name: 'Dólar', pair: 'USD-BRL' },
  { symbol: 'EUR', name: 'Euro', pair: 'EUR-BRL' },
  { symbol: 'GBP', name: 'Libra', pair: 'GBP-BRL' },
  { symbol: 'BTC', name: 'Bitcoin', pair: 'BTC-BRL' },
  { symbol: 'ETH', name: 'Ethereum', pair: 'ETH-BRL' },
] as const;

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Chave opcional da AwesomeAPI (gratuita, aumenta o limite de uso por IP).
const AWESOME_TOKEN = process.env.AWESOMEAPI_TOKEN;
const awesome = (u: string) =>
  AWESOME_TOKEN ? `${u}${u.includes('?') ? '&' : '?'}token=${encodeURIComponent(AWESOME_TOKEN)}` : u;

async function awesomeQuotes(): Promise<Quote[]> {
  const fx = await getJson<Record<string, any>>(
    awesome(`https://economia.awesomeapi.com.br/json/last/${PAIRS.map((p) => p.pair).join(',')}`),
  );

  const out: Quote[] = [];
  for (const p of PAIRS) {
    const r = fx[p.pair.replace('-', '')];
    const value = num(r?.bid);
    if (!r || value === null) continue;
    out.push({
      symbol: p.symbol,
      name: p.name,
      value,
      pct: num(r.pctChange),
      high: num(r.high),
      low: num(r.low),
      usd: null,
      ts: Number(r.timestamp) * 1000 || Date.now(),
    });
  }
  if (!out.length) throw new Error('AwesomeAPI não retornou cotações');

  // valor da cripto em dólar = preço em reais ÷ cotação do dólar (sem outra chamada)
  const dollar = out.find((q) => q.symbol === 'USD')?.value;
  if (dollar) for (const q of out) if (q.symbol === 'BTC' || q.symbol === 'ETH') q.usd = q.value / dollar;
  return out;
}

/** Série diária dos últimos 30 dias, por símbolo (do mais antigo ao mais novo). */
async function awesomeDaily(): Promise<Record<string, Point[]>> {
  const entries = await Promise.all(
    PAIRS.map(async (p) => {
      const rows = await getJson<any[]>(awesome(`https://economia.awesomeapi.com.br/json/daily/${p.pair}/30`));
      const pts: Point[] = rows
        .map((r) => ({ t: Number(r.timestamp) * 1000, v: Number(r.bid) }))
        .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.v))
        .sort((a, b) => a.t - b.t);
      return [p.symbol, pts] as const;
    }),
  );
  return Object.fromEntries(entries);
}

// ── Plano B: BCE (Frankfurter) + Coinbase ─────────────────────────────
// A AwesomeAPI limita por IP (429), e servidores de hospedagem compartilham IPs.
// Quando ela recusa, usamos estas duas fontes, que não exigem chave.
// O câmbio do BCE é uma referência diária (não muda a cada segundo); a cripto continua ao vivo.

const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

type FxRates = Record<string, Record<string, number>>; // dia → { BRL, EUR, GBP } por 1 USD

async function frankfurter(daysBack: number): Promise<{ days: string[]; rates: FxRates }> {
  const j = await getJson<{ rates: FxRates }>(
    `https://api.frankfurter.dev/v1/${isoDay(-daysBack)}..?base=USD&symbols=BRL,EUR,GBP`,
  );
  const days = Object.keys(j.rates).sort();
  if (!days.length) throw new Error('Frankfurter sem dados');
  return { days, rates: j.rates };
}

/** Reais por 1 unidade da moeda `cur` num dia. */
const brlPer = (r: Record<string, number>, cur: 'USD' | 'EUR' | 'GBP') => (cur === 'USD' ? r.BRL : r.BRL / r[cur]);

const COINBASE = 'https://api.exchange.coinbase.com';

async function coinbaseStats(id: 'BTC' | 'ETH') {
  const j = await getJson<{ open: string; high: string; low: string; last: string }>(`${COINBASE}/products/${id}-USD/stats`);
  return { open: Number(j.open), high: Number(j.high), low: Number(j.low), last: Number(j.last) };
}

async function fallbackQuotes(): Promise<Quote[]> {
  const [fx, btc, eth] = await Promise.allSettled([frankfurter(8), coinbaseStats('BTC'), coinbaseStats('ETH')]);
  const out: Quote[] = [];

  if (fx.status === 'fulfilled') {
    const { days, rates } = fx.value;
    const last = rates[days[days.length - 1]];
    const prev = days.length > 1 ? rates[days[days.length - 2]] : null;
    const ts = new Date(`${days[days.length - 1]}T12:00:00Z`).getTime();
    for (const p of PAIRS.slice(0, 3)) {
      const cur = p.symbol as 'USD' | 'EUR' | 'GBP';
      const value = brlPer(last, cur);
      const before = prev ? brlPer(prev, cur) : null;
      out.push({
        symbol: p.symbol, name: p.name, value,
        pct: before ? ((value - before) / before) * 100 : null,
        high: null, low: null, usd: null, ts,
      });
    }
  }

  // cripto: preço em dólar da Coinbase × cotação do dólar do BCE
  const dollar = out.find((q) => q.symbol === 'USD')?.value;
  if (dollar) {
    for (const [p, res] of [[PAIRS[3], btc], [PAIRS[4], eth]] as const) {
      if (res.status !== 'fulfilled' || !Number.isFinite(res.value.last)) continue;
      const s = res.value;
      out.push({
        symbol: p.symbol, name: p.name, value: s.last * dollar,
        pct: s.open ? ((s.last - s.open) / s.open) * 100 : null,
        high: s.high * dollar, low: s.low * dollar, usd: s.last, ts: Date.now(),
      });
    }
  }

  if (!out.length) throw new Error('Plano B de cotações também falhou');
  return out;
}

async function fallbackDaily(): Promise<Record<string, Point[]>> {
  const candles = (id: 'BTC' | 'ETH') =>
    getJson<[number, number, number, number, number, number][]>(`${COINBASE}/products/${id}-USD/candles?granularity=86400`);
  const [fx, btc, eth] = await Promise.allSettled([frankfurter(31), candles('BTC'), candles('ETH')]);

  const out: Record<string, Point[]> = {};
  if (fx.status === 'fulfilled') {
    const { days, rates } = fx.value;
    for (const cur of ['USD', 'EUR', 'GBP'] as const) {
      out[cur] = days.map((d) => ({ t: new Date(`${d}T12:00:00Z`).getTime(), v: brlPer(rates[d], cur) }));
    }

    // cripto em reais: fechamento diário (USD) × dólar do último dia útil conhecido até aquele dia
    const dollarOn = (iso: string): number => {
      let v = rates[days[0]].BRL;
      for (const d of days) {
        if (d > iso) break;
        v = rates[d].BRL;
      }
      return v;
    };
    for (const [sym, res] of [['BTC', btc], ['ETH', eth]] as const) {
      if (res.status !== 'fulfilled') continue;
      out[sym] = res.value
        .slice(0, 31) // a Coinbase devolve do mais novo para o mais antigo
        .reverse()
        .map(([t, , , , close]) => ({ t: t * 1000, v: close * dollarOn(new Date(t * 1000).toISOString().slice(0, 10)) }));
    }
  }
  if (!Object.keys(out).length) throw new Error('Plano B do histórico também falhou');
  return out;
}

// ── escolha da fonte ──────────────────────────────────────────────────
// Se a AwesomeAPI recusar (429 ou erro), fica de molho por um tempo e o plano B assume.

let awesomeBackoffUntil = 0;

async function withFallback<T>(primary: () => Promise<T>, backup: () => Promise<T>): Promise<T> {
  if (Date.now() >= awesomeBackoffUntil) {
    try {
      return await primary();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      awesomeBackoffUntil = Date.now() + (msg.includes('429') ? 10 * 60_000 : 90_000);
      console.warn(`[cotações] AwesomeAPI indisponível (${msg}); usando plano B`);
    }
  }
  return backup();
}

export const fetchQuotes = (): Promise<Quote[]> => withFallback(awesomeQuotes, fallbackQuotes);
/** Série diária dos últimos 30 dias, por símbolo (do mais antigo ao mais novo). */
export const fetchDaily = (): Promise<Record<string, Point[]>> => withFallback(awesomeDaily, fallbackDaily);

// ── Banco Central (SGS) ───────────────────────────────────────────────

export interface Indicator {
  id: string;
  label: string;
  unit: 'BRL' | '%' | '% a.a.';
  value: number;
  prev: number | null;
  ref: string; // data de referência (ISO)
  series: number[];
  note: string;
}

const SGS = [
  { id: 'ptax', label: 'Dólar PTAX', code: 1, n: 20, unit: 'BRL', note: 'Taxa de venda · fechamento diário' },
  { id: 'selic', label: 'Selic meta', code: 432, n: 12, unit: '% a.a.', note: 'Definida pelo Copom' },
  { id: 'ipca', label: 'IPCA mensal', code: 433, n: 12, unit: '%', note: 'Inflação oficial · variação no mês' },
  { id: 'ipca12', label: 'IPCA 12 meses', code: 13522, n: 12, unit: '%', note: 'Inflação acumulada em 12 meses' },
] as const;

const isoFromBr = (d: string): string => {
  const [dd, mm, yyyy] = d.split('/');
  return `${yyyy}-${mm}-${dd}`;
};

export async function fetchIndicators(): Promise<Indicator[]> {
  const results = await Promise.allSettled(
    SGS.map(async (s) => {
      const rows = await getJson<{ data: string; valor: string }[]>(
        `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s.code}/dados/ultimos/${s.n}?formato=json`,
      );
      const vals = rows.map((r) => Number(r.valor)).filter(Number.isFinite);
      if (!vals.length) throw new Error(`série ${s.code} vazia`);
      const last = rows[rows.length - 1];
      const ind: Indicator = {
        id: s.id,
        label: s.label,
        unit: s.unit,
        value: vals[vals.length - 1],
        prev: vals.length > 1 ? vals[vals.length - 2] : null,
        ref: isoFromBr(last.data),
        series: vals,
        note: s.note,
      };
      return ind;
    }),
  );
  const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (!ok.length) throw new Error('Banco Central indisponível');
  return ok;
}
