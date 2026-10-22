import { memo } from '../memo.js';
import { plain } from '../http.js';

/**
 * Repositórios do GitHub para a aba Devs.
 *  - "Em alta": lista da página pública github.com/trending (o GitHub não tem API para isso);
 *  - "Novos" e "Atualizados": API oficial de busca do GitHub.
 * Sem chave a busca aceita ~10 consultas por minuto por IP; com GITHUB_TOKEN (opcional) são 30.
 */

export interface Repo {
  name: string; // dono/repositório
  url: string;
  description: string;
  language: string | null;
  color: string | null;
  stars: number;
  forks: number | null;
  /** estrelas ganhas no período (só na lista "Em alta") */
  gained: number | null;
  createdAt: string | null;
  pushedAt: string | null;
}

export const LANGS = [
  'JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C#', 'PHP', 'Kotlin', 'Swift', 'C++', 'Ruby', 'Dart',
] as const;

const COLORS: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Go: '#00ADD8', Rust: '#dea584', Java: '#b07219',
  'C#': '#178600', PHP: '#4F5D95', Kotlin: '#A97BFF', Swift: '#F05138', 'C++': '#f34b7d', C: '#555555', Ruby: '#701516',
  Dart: '#00B4AB', Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', Lua: '#000080', Zig: '#ec915c', Vue: '#41b883',
  'Jupyter Notebook': '#DA5B0B', Scala: '#c22d40', Elixir: '#6e4a7e', Haskell: '#5e5086', Nix: '#7e7eff',
};

const MIN = 60_000;

// ── limitador: no máximo ~9 consultas por minuto à API de busca ───────────────
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const GAP = process.env.GITHUB_TOKEN ? 2_200 : 6_800;

function limited<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastCall + GAP - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// ── busca oficial (Novos e Atualizados) ───────────────────────────────────────

export interface SearchOpts {
  view: 'novos' | 'atualizados';
  days: 1 | 7 | 30;
  lang?: string;
  q?: string;
}

interface GhItem {
  full_name: string; html_url: string; description: string | null; language: string | null;
  stargazers_count: number; forks_count: number; created_at: string; pushed_at: string;
}

async function search(o: SearchOpts): Promise<Repo[]> {
  const terms = [
    o.q?.trim(),
    o.view === 'novos' ? `created:>${day(o.days)}` : `pushed:>${day(o.days)} stars:>${o.days === 1 ? 3000 : 1500}`,
    o.lang ? `language:"${o.lang}"` : undefined,
  ].filter(Boolean);

  const p = new URLSearchParams({
    q: terms.join(' '),
    sort: o.view === 'novos' ? 'stars' : 'updated',
    order: 'desc',
    per_page: '30',
  });

  const res = await limited(() =>
    fetch(`https://api.github.com/search/repositories?${p}`, {
      headers: {
        'user-agent': 'ImporNews/1.0',
        accept: 'application/vnd.github+json',
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    }),
  );
  if (res.status === 403 || res.status === 429) throw new Error('o GitHub limitou as consultas; tente de novo em 1 minuto');
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`);

  const j = (await res.json()) as { items?: GhItem[] };
  return (j.items ?? []).map((r) => ({
    name: r.full_name,
    url: r.html_url,
    description: plain(r.description ?? '', 200),
    language: r.language,
    color: r.language ? COLORS[r.language] ?? null : null,
    stars: r.stargazers_count,
    forks: r.forks_count,
    gained: null,
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
  }));
}

// ── trending (página pública) ────────────────────────────────────────────────

const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && s.match(/\d/) ? n : null;
};

async function trending(since: 'daily' | 'weekly' | 'monthly', lang?: string): Promise<Repo[]> {
  const path = lang ? `/${encodeURIComponent(lang.toLowerCase())}` : '';
  const res = await fetch(`https://github.com/trending${path}?since=${since}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; ImporNews/1.0)', accept: 'text/html' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GitHub Trending respondeu ${res.status}`);
  const html = await res.text();

  const clean = (s: string) => plain(s, 400);
  const out: Repo[] = [];
  for (const art of html.split('<article class="Box-row"').slice(1)) {
    const href = art.match(/<h2[^>]*>[\s\S]*?href="\/([^"?#]+)"/)?.[1];
    if (!href || !href.includes('/')) continue;
    const lang2 = art.match(/itemprop="programmingLanguage">([^<]+)</)?.[1]?.trim() ?? null;
    out.push({
      name: href,
      url: `https://github.com/${href}`,
      description: clean(art.match(/<p class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? ''),
      language: lang2,
      color: art.match(/repo-language-color"[^>]*background-color:\s*([^;"]+)/)?.[1]?.trim() ?? (lang2 ? COLORS[lang2] ?? null : null),
      stars: num(clean(art.match(/href="[^"]*\/stargazers"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '')) ?? 0,
      forks: num(clean(art.match(/href="[^"]*\/forks"[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '')),
      gained: num(art.match(/([\d.,]+)\s+stars?\s+(?:today|this week|this month)/i)?.[1]),
      createdAt: null,
      pushedAt: null,
    });
  }
  if (!out.length) throw new Error('não consegui ler a lista de repositórios em alta (o formato da página pode ter mudado)');
  return out;
}

// ── API pública deste módulo ─────────────────────────────────────────────────

export interface DevsQuery {
  view: 'trending' | 'novos' | 'atualizados';
  days: 1 | 7 | 30;
  lang?: string;
  q?: string;
}

export function devs(o: DevsQuery): Promise<Repo[]> {
  const key = `devs|${o.view}|${o.days}|${o.lang ?? ''}|${(o.q ?? '').toLowerCase()}`;
  return memo(key, o.view === 'trending' ? 30 * MIN : 20 * MIN, () =>
    o.view === 'trending'
      ? trending(o.days === 1 ? 'daily' : o.days === 7 ? 'weekly' : 'monthly', o.lang)
      : search({ view: o.view, days: o.days, lang: o.lang, q: o.q }),
  );
}
