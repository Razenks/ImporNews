const UA = 'Mozilla/5.0 (compatible; ImporNews/1.0)';

async function request(url: string, accept: string, timeoutMs: number): Promise<Response> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} respondeu ${res.status}`);
  return res;
}

export async function getJson<T = any>(url: string, timeoutMs = 20_000): Promise<T> {
  return (await request(url, 'application/json', timeoutMs)).json() as Promise<T>;
}

export async function getText(url: string, timeoutMs = 20_000): Promise<string> {
  return (await request(url, '*/*', timeoutMs)).text();
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
};

/** Remove tags HTML e decodifica entidades básicas. */
export function plain(html: unknown, max = 240): string {
  const text = String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
}

/** Data de hoje (+ offset de dias) no fuso de São Paulo, como YYYY-MM-DD. */
export function ymd(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
