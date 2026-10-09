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

const NAMED: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·',
  eacute: 'é', egrave: 'è', ecirc: 'ê', aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', iacute: 'í', oacute: 'ó',
  ocirc: 'ô', otilde: 'õ', uacute: 'ú', ccedil: 'ç', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä',
};

/** Decodifica entidades HTML: nomeadas (&amp;), decimais (&#8220;) e hexadecimais (&#x201C;). */
function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,8}));/gi, (m, dec, hex, name) => {
    try {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return NAMED[String(name).toLowerCase()] ?? m;
    } catch {
      return m;
    }
  });
}

/** Remove tags HTML e decodifica entidades. */
export function plain(html: unknown, max = 240): string {
  const text = decodeEntities(String(html ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
}

/** Data de hoje (+ offset de dias) no fuso de São Paulo, como YYYY-MM-DD. */
export function ymd(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
}
