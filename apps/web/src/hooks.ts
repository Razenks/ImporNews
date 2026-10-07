import { useEffect, useRef, useState } from 'react';
import {
  fetchArticles, fetchBundle, fetchHistory, openStream,
  type Arc, type ArcGroup, type ArcPage, type ArcQuery, type Bundle, type Point, type Quote,
} from './api';

/** Re-renderiza a cada `ms` — usado para relógios e "há X min". */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Busca o pacote completo a cada minuto (pausa com a aba oculta). */
export function useBundle(): { bundle: Bundle | null; error: boolean } {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchBundle()
        .then((b) => alive && (setBundle(b), setError(false)))
        .catch(() => alive && setError(true));

    load();
    const id = setInterval(() => !document.hidden && load(), 60_000);
    const onVisible = () => !document.hidden && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { bundle, error };
}

/** Cotações ao vivo via SSE, começando pelo valor do pacote. */
export function useLiveQuotes(seed: Quote[] | null | undefined): { quotes: Quote[]; online: boolean; at: number | null } {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [online, setOnline] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (seed?.length && !seeded.current) {
      seeded.current = true;
      setQuotes(seed);
      setAt(Date.now());
    }
  }, [seed]);

  useEffect(
    () =>
      openStream(
        (q) => {
          setQuotes(q);
          setAt(Date.now());
        },
        setOnline,
      ),
    [],
  );

  return { quotes, online, at };
}

/** Histórico por símbolo e período (24h vem do Neon; 30d, diário). */
export function useHistories(symbols: string[], range: '24h' | '30d'): Record<string, Point[]> {
  const [data, setData] = useState<Record<string, Point[]>>({});
  const key = symbols.join(',');

  useEffect(() => {
    let alive = true;
    const load = () =>
      Promise.all(
        key.split(',').map((s) => fetchHistory(s, range).then((p) => [s, p] as const).catch(() => [s, [] as Point[]] as const)),
      ).then((rows) => alive && setData(Object.fromEntries(rows)));
    load();
    const id = setInterval(load, range === '24h' ? 120_000 : 600_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [key, range]);

  return data;
}

/**
 * Lista do arquivo de notícias, com "mostrar mais" e atualização sozinha:
 * a cada minuto busca a primeira página e, se houver itens que a lista ainda não tem,
 * avisa quantos (`fresh`) em vez de bagunçar o que você está lendo.
 */
export function useArticles(query: Omit<ArcQuery, 'offset' | 'limit'>) {
  const PAGE = 20;
  const { cat, days, group, q } = query;
  const [state, setState] = useState<{ items: Arc[]; total: number; groups: ArcGroup[]; loading: boolean; error: boolean }>({
    items: [], total: 0, groups: [], loading: true, error: false,
  });
  const [fresh, setFresh] = useState<ArcPage | null>(null);
  const [more, setMore] = useState(false);
  const itemsRef = useRef<Arc[]>([]);
  itemsRef.current = state.items;

  // troca de filtro: recomeça do zero
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    setFresh(null);
    fetchArticles({ cat, days, group, q, limit: PAGE })
      .then((p) => alive && setState({ items: p.items, total: p.total, groups: p.groups, loading: false, error: false }))
      .catch(() => alive && setState((s) => ({ ...s, loading: false, error: true })));
    return () => {
      alive = false;
    };
  }, [cat, days, group, q]);

  // atualização silenciosa
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (document.hidden) return;
      fetchArticles({ cat, days, group, q, limit: PAGE })
        .then((p) => {
          if (!alive) return;
          const have = new Set(itemsRef.current.map((i) => i.url));
          const novel = p.items.filter((i) => !have.has(i.url));
          // só avisa se o item é mais novo que o topo atual (evita "novas" por reordenação)
          const top = itemsRef.current[0]?.date ?? '';
          setFresh(novel.some((i) => i.date > top) ? p : null);
          setState((s) => ({ ...s, total: p.total, groups: p.groups }));
        })
        .catch(() => {});
    };
    const id = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [cat, days, group, q]);

  const loadMore = () => {
    setMore(true);
    fetchArticles({ cat, days, group, q, limit: PAGE, offset: itemsRef.current.length })
      .then((p) => setState((s) => ({ ...s, items: [...s.items, ...p.items.filter((i) => !s.items.some((x) => x.url === i.url))], total: p.total })))
      .finally(() => setMore(false));
  };

  const applyFresh = () => {
    if (!fresh) return;
    setState((s) => ({ ...s, items: fresh.items, total: fresh.total, groups: fresh.groups }));
    setFresh(null);
  };

  const freshCount = fresh ? fresh.items.filter((i) => !state.items.some((x) => x.url === i.url)).length : 0;
  return { ...state, loadingMore: more, loadMore, freshCount, applyFresh };
}

/** Valor que só "assenta" depois de `ms` sem mudar (para a busca por texto). */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Carrega algo uma vez (e de novo quando `deps` mudam). `enabled=false` não faz nada. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({ data: null, loading: enabled, error: false });
  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: false });
      return;
    }
    let alive = true;
    setState((s) => ({ data: s.data, loading: true, error: false }));
    fn()
      .then((data) => alive && setState({ data, loading: false, error: false }))
      .catch(() => alive && setState((s) => ({ data: s.data, loading: false, error: true })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);
  return state;
}

/**
 * Lista paginada ("mostrar mais") com atualização silenciosa: de tempos em tempos busca a
 * primeira página e, se houver algo mais novo que o topo, avisa em `freshCount`.
 */
export function usePagedList<T, X extends { items: T[]; total: number }>(
  page: (offset: number, limit: number) => Promise<X>,
  keyOf: (t: T) => string,
  dateOf: (t: T) => string,
  deps: unknown[],
  enabled = true,
  refreshMs = 120_000,
) {
  const PAGE = 20;
  const [s, setS] = useState<{ items: T[]; extra: Omit<X, 'items'> | null; loading: boolean; error: boolean }>({
    items: [], extra: null, loading: enabled, error: false,
  });
  const [fresh, setFresh] = useState<X | null>(null);
  const [more, setMore] = useState(false);
  const ref = useRef(s.items);
  ref.current = s.items;
  const pageRef = useRef(page);
  pageRef.current = page;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setS((x) => ({ ...x, loading: true, error: false }));
    setFresh(null);
    pageRef.current(0, PAGE)
      .then(({ items, ...extra }) => alive && setS({ items, extra: extra as Omit<X, 'items'>, loading: false, error: false }))
      .catch(() => alive && setS((x) => ({ ...x, items: [], loading: false, error: true })));

    const id = setInterval(() => {
      if (document.hidden) return;
      pageRef.current(0, PAGE)
        .then((p) => {
          if (!alive) return;
          const have = new Set(ref.current.map(keyOf));
          const top = ref.current[0] ? dateOf(ref.current[0]) : '';
          setFresh(p.items.some((i) => !have.has(keyOf(i)) && dateOf(i) > top) ? p : null);
        })
        .catch(() => {});
    }, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  const loadMore = () => {
    setMore(true);
    pageRef.current(ref.current.length, PAGE)
      .then(({ items, ...extra }) =>
        setS((x) => ({
          ...x,
          items: [...x.items, ...items.filter((i) => !x.items.some((y) => keyOf(y) === keyOf(i)))],
          extra: extra as Omit<X, 'items'>,
        })),
      )
      .finally(() => setMore(false));
  };

  const applyFresh = () => {
    if (!fresh) return;
    const { items, ...extra } = fresh;
    setS((x) => ({ ...x, items, extra: extra as Omit<X, 'items'> }));
    setFresh(null);
  };

  const freshCount = fresh ? fresh.items.filter((i) => !s.items.some((y) => keyOf(y) === keyOf(i))).length : 0;
  return { ...s, loadingMore: more, loadMore, freshCount, applyFresh };
}
