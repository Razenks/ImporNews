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

export async function fetchQuotes(): Promise<Quote[]> {
  const [fx, cg] = await Promise.allSettled([
    getJson<Record<string, any>>(`https://economia.awesomeapi.com.br/json/last/${PAIRS.map((p) => p.pair).join(',')}`),
    getJson<Record<string, any>>(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',
    ),
  ]);
  if (fx.status === 'rejected') throw fx.reason;

  const usd: Record<string, number | null> = {
    BTC: cg.status === 'fulfilled' ? num(cg.value.bitcoin?.usd) : null,
    ETH: cg.status === 'fulfilled' ? num(cg.value.ethereum?.usd) : null,
  };

  const out: Quote[] = [];
  for (const p of PAIRS) {
    const r = fx.value[p.pair.replace('-', '')];
    const value = num(r?.bid);
    if (!r || value === null) continue;
    out.push({
      symbol: p.symbol,
      name: p.name,
      value,
      pct: num(r.pctChange),
      high: num(r.high),
      low: num(r.low),
      usd: usd[p.symbol] ?? null,
      ts: Number(r.timestamp) * 1000 || Date.now(),
    });
  }
  if (!out.length) throw new Error('AwesomeAPI não retornou cotações');
  return out;
}

/** Série diária dos últimos 30 dias, por símbolo (do mais antigo ao mais novo). */
export async function fetchDaily(): Promise<Record<string, Point[]>> {
  const entries = await Promise.all(
    PAIRS.map(async (p) => {
      const rows = await getJson<any[]>(`https://economia.awesomeapi.com.br/json/daily/${p.pair}/30`);
      const pts: Point[] = rows
        .map((r) => ({ t: Number(r.timestamp) * 1000, v: Number(r.bid) }))
        .filter((x) => Number.isFinite(x.t) && Number.isFinite(x.v))
        .sort((a, b) => a.t - b.t);
      return [p.symbol, pts] as const;
    }),
  );
  return Object.fromEntries(entries);
}

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
