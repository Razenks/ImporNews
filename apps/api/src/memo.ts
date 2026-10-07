/**
 * Cache em memória com validade, que também junta chamadas simultâneas iguais
 * (várias pessoas pedindo a mesma coisa = uma só ida à fonte).
 */
interface Entry<T> {
  at: number;
  value?: T;
  pending?: Promise<T>;
}

const store = new Map<string, Entry<unknown>>();
const MAX = 600;

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit) {
    if (hit.pending) return hit.pending;
    if (Date.now() - hit.at < ttlMs) return hit.value as T;
  }

  const pending = fn();
  store.set(key, { at: Date.now(), pending });
  try {
    const value = await pending;
    store.set(key, { at: Date.now(), value });
    if (store.size > MAX) {
      // descarta os mais antigos
      const old = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, store.size - MAX + 50);
      for (const [k] of old) store.delete(k);
    }
    return value;
  } catch (err) {
    // se falhou e havia um valor antigo, serve o antigo em vez de quebrar
    if (hit?.value !== undefined) {
      store.set(key, { at: Date.now() - ttlMs + 30_000, value: hit.value }); // tenta de novo em 30 s
      return hit.value as T;
    }
    store.delete(key);
    throw err;
  }
}
