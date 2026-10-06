/**
 * Cache em memória com jobs periódicos.
 * Cada fonte roda isolada: se uma cair, serve o último dado bom marcado como "stale".
 */
export interface Envelope<T = unknown> {
  data: T | null;
  updatedAt: number | null;
  stale: boolean;
  error: string | null;
}

interface Job {
  entry: Envelope;
  running: boolean;
}

const jobs = new Map<string, Job>();

export function register<T>(
  key: string,
  intervalMs: number,
  fn: () => Promise<T>,
  onUpdate?: (data: T) => void,
  startDelayMs = 0,
): void {
  const job: Job = { entry: { data: null, updatedAt: null, stale: false, error: null }, running: false };
  jobs.set(key, job);

  const run = async () => {
    if (job.running) return;
    job.running = true;
    try {
      const data = await fn();
      job.entry = { data, updatedAt: Date.now(), stale: false, error: null };
      onUpdate?.(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      job.entry = { ...job.entry, stale: job.entry.data !== null, error: msg };
      console.warn(`[${key}] falhou: ${msg}`);
    } finally {
      job.running = false;
    }
  };

  setTimeout(() => {
    void run();
    setInterval(run, intervalMs).unref();
  }, startDelayMs);
}

export const read = (key: string): Envelope | undefined => jobs.get(key)?.entry;
export const keys = (): string[] => [...jobs.keys()];
export const bundle = (): Record<string, Envelope> =>
  Object.fromEntries([...jobs].map(([k, j]) => [k, j.entry]));
