import { useEffect, useRef, useState } from 'react';

const MOTION_KEY = 'impornews:motion';

/** Animações vêm ligadas por padrão; o usuário pode desligar pelo botão do rodapé. */
export function initMotion(): void {
  try {
    if (localStorage.getItem(MOTION_KEY) === 'off') document.documentElement.dataset.motion = 'off';
  } catch { /* storage bloqueado: segue ligado */ }
}

export const prefersReduced = (): boolean => document.documentElement.dataset.motion === 'off';

export function setMotion(on: boolean): void {
  try {
    localStorage.setItem(MOTION_KEY, on ? 'on' : 'off');
  } catch { /* ok */ }
  location.reload(); // recomeça limpo, sem estados de animação pela metade
}

// ── sinal global "a abertura terminou" ───────────────────────────────
let ready = false;
const subs = new Set<() => void>();

export function setReady(): void {
  if (ready) return;
  ready = true;
  document.documentElement.classList.add('ready');
  subs.forEach((f) => f());
  subs.clear();
}

export function whenReady(cb: () => void): () => void {
  if (ready) {
    cb();
    return () => {};
  }
  subs.add(cb);
  return () => subs.delete(cb);
}

// ── revelar ao rolar ─────────────────────────────────────────────────
// Marca com data-r os elementos que entram em cascata e põe data-in quando aparecem.
// (atributos de dados, e não classes: o React reescreve `class` e apagaria o estado)
const REVEAL =
  '.sec-head,.sub-head,.mkt,.qwrap,.ledger-grid,.feed>li,.city-list>li,.alert-list>li,.agenda-list>li,.lead,.count,.dates,.skel';

function tag(): void {
  document.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => {
    if (el.hasAttribute('data-r')) return;
    // itens trazidos por "Mostrar mais" (a partir do 20º) aparecem na hora, sem esperar a rolagem
    if (el.matches('.feed > li:nth-child(n+20)')) {
      el.setAttribute('data-r', '');
      el.setAttribute('data-in', '');
      el.style.setProperty('--d', '0ms');
      return;
    }
    const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.matches(REVEAL)) : [el];
    el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 8) * 70}ms`);
    el.setAttribute('data-r', '');
  });
}

export function useReveal(): void {
  useEffect(() => {
    if (prefersReduced() || !('IntersectionObserver' in window)) return;
    const root = document.documentElement;
    root.classList.add('reveal-on');

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).setAttribute('data-in', '');
          io.unobserve(e.target);
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' },
    );

    let live = false;
    const scan = () => {
      tag();
      if (live) document.querySelectorAll('[data-r]:not([data-in])').forEach((el) => io.observe(el));
    };
    const mo = new MutationObserver(scan);
    mo.observe(document.getElementById('root')!, { childList: true, subtree: true });
    scan();
    const off = whenReady(() => {
      live = true;
      scan();
    });

    return () => {
      off();
      mo.disconnect();
      io.disconnect();
      root.classList.remove('reveal-on');
    };
  }, []);
}

// ── barra de progresso de leitura ────────────────────────────────────
export function useScrollProgress(ref: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - innerHeight;
      const p = h > 0 ? Math.min(1, Math.max(0, scrollY / h)) : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
}

// ── contagem de números ──────────────────────────────────────────────
/**
 * Conta de 0 até `target` quando o elemento aparece (depois da abertura).
 * Atualizações seguintes (dados ao vivo) entram direto, sem recontar.
 */
export function useCountUp<T extends HTMLElement>(target: number, ms = 1200): [number, React.RefObject<T | null>] {
  const ref = useRef<T | null>(null);
  const reduced = prefersReduced();
  const [shown, setShown] = useState(reduced ? target : 0);
  const state = useRef({ started: false, finished: reduced, visible: false, from: 0 });
  const tRef = useRef(target);
  tRef.current = target;

  useEffect(() => {
    const s = state.current;
    if (s.finished) {
      setShown(target);
      return;
    }
    let raf = 0;
    const run = () => {
      if (s.started) return;
      s.started = true;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        const eased = 1 - Math.pow(1 - p, 4);
        setShown(tRef.current * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
        else {
          s.finished = true;
          setShown(tRef.current);
        }
      };
      raf = requestAnimationFrame(tick);
    };

    let off = () => {};
    let io: IntersectionObserver | undefined;
    if (!s.started) {
      off = whenReady(() => {
        const el = ref.current;
        if (!el || !('IntersectionObserver' in window)) return run();
        io = new IntersectionObserver((es) => {
          if (es.some((e) => e.isIntersecting)) {
            io?.disconnect();
            run();
          }
        });
        io.observe(el);
      });
    }
    return () => {
      off();
      io?.disconnect();
      cancelAnimationFrame(raf);
      if (!s.finished) s.started = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms]);

  useEffect(() => {
    if (state.current.finished) setShown(target);
  }, [target]);

  return [shown, ref];
}

/** Depois de "Mostrar mais": leva a tela ao primeiro item novo (eles entram abaixo do botão). */
export function scrollToNew(list: HTMLElement | null, before: number): void {
  if (!list) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const li = list.querySelectorAll(':scope > li')[before] as HTMLElement | undefined;
      li?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' });
    }),
  );
}
