const nf = (min: number, max = min) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });

const FX = nf(4);
const INT = nf(0);
const PCT = nf(2);

/** Valor de uma cotação: 4 casas para moedas, inteiro para cripto. */
export const money = (symbol: string, v: number): string =>
  symbol === 'BTC' || symbol === 'ETH' ? INT.format(v) : FX.format(v);

export const intl = (v: number): string => INT.format(v);
export const dec = (v: number, digits = 2): string => nf(digits).format(v);

/** +0,39% / −0,39% (com sinal de menos tipográfico). */
export const pct = (v: number | null): string =>
  v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${PCT.format(Math.abs(v))}%`;

export const dir = (v: number | null): 'up' | 'down' | 'flat' =>
  v === null || v === 0 ? 'flat' : v > 0 ? 'up' : 'down';

export const arrow = (d: 'up' | 'down' | 'flat'): string => (d === 'up' ? '▲' : d === 'down' ? '▼' : '■');

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'short' });

/** "há 3 min", "ontem", "em 2 dias" — a partir de data ISO ou timestamp. */
export function ago(input: string | number | null | undefined, now = Date.now()): string {
  if (input === null || input === undefined || input === '') return '';
  const t = typeof input === 'number' ? input : new Date(input).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.round((t - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'agora';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86_400 * 30) return rtf.format(Math.round(s / 86_400), 'day');
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(t);
}

export const dayMonth = (input: string | null | undefined): string => {
  if (!input) return '';
  const d = new Date(input.length === 10 ? `${input}T12:00:00` : input);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(d).replace('.', '');
};

export const weekdayTime = (input: string): string => {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit' }).format(d).replace('.', '');
  const hm = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
  return `${day} · ${hm}`;
};

export const monthYear = (iso: string): string =>
  new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(new Date(`${iso}T12:00:00`)).replace('.', '');

export const clock = (t: number): string =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(t);

/** Dias inteiros até uma data (YYYY-MM-DD), no fuso local. */
export function daysUntil(iso: string, now = Date.now()): number {
  const target = new Date(`${iso}T00:00:00-03:00`).getTime();
  return Math.ceil((target - now) / 86_400_000);
}

/** "qua 08" a partir de YYYY-MM-DD. */
export const weekdayShort = (iso: string): string =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit' }).format(new Date(`${iso}T12:00:00`)).replace('.', '');
