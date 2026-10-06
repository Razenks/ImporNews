import { useEffect, useRef, useState } from 'react';
import { fetchBundle, fetchHistory, openStream, type Bundle, type Point, type Quote } from './api';

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
