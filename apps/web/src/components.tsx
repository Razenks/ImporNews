import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Envelope, Quote } from './api';
import { ago, arrow, dir, money, pct } from './format';
import { prefersReduced, setMotion, setReady, useCountUp } from './motion';

/** Liga/desliga todas as animações do site. */
export function MotionToggle() {
  const on = !prefersReduced();
  return (
    <button type="button" className="motion-toggle" aria-pressed={on} onClick={() => setMotion(!on)}>
      <i aria-hidden="true" />
      Animações: {on ? 'ligadas' : 'desligadas'}
    </button>
  );
}

/**
 * Mini-gráfico em SVG, desenhado à mão — sem biblioteca de gráficos.
 * Com `scrub`, um cursor acompanha o mouse/dedo e mostra o valor exato.
 */
export function Spark({
  values,
  tone = 'flat',
  className = '',
  empty = 'coletando…',
  scrub,
}: {
  values: number[];
  tone?: 'up' | 'down' | 'flat';
  className?: string;
  empty?: string;
  scrub?: { fmt: (v: number) => string; times?: number[]; withTime?: boolean };
}) {
  const [idx, setIdx] = useState<number | null>(null);

  if (values.length < 2) {
    return (
      <div className={`spark spark-empty ${className}`} aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="50" x2="100" y2="50" />
        </svg>
        <span>{empty}</span>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 8;
  const y = (v: number) => pad + (1 - (v - min) / span) * (100 - pad * 2);
  const x = (i: number) => (i / (values.length - 1)) * 100;
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
  const last = y(values[values.length - 1]);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setIdx(Math.round(p * (values.length - 1)));
  };

  const when = idx !== null && scrub?.times?.[idx];
  return (
    <div
      className={`spark ${tone} ${scrub ? 'scrubbable' : ''} ${className}`}
      aria-hidden="true"
      onPointerMove={scrub ? move : undefined}
      onPointerDown={scrub ? move : undefined}
      onPointerLeave={scrub ? () => setIdx(null) : undefined}
      onPointerCancel={scrub ? () => setIdx(null) : undefined}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <path className="spark-area" d={`${line} L100 100 L0 100 Z`} />
        <path className="spark-line" d={line} vectorEffect="non-scaling-stroke" />
      </svg>
      <i className="spark-dot" style={{ top: `${last}%` }} />
      {scrub && idx !== null && (
        <>
          <i className="scrub-line" style={{ left: `${x(idx)}%` }} />
          <i className="scrub-dot" style={{ left: `${x(idx)}%`, top: `${y(values[idx])}%` }} />
          <span className={`scrub-tip ${x(idx) > 62 ? 'left' : x(idx) < 14 ? 'start' : ''}`} style={{ left: `${x(idx)}%` }}>
            <b>R$ {scrub.fmt(values[idx])}</b>
            {when ? (
              <em>
                {new Intl.DateTimeFormat('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  ...(scrub.withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
                })
                  .format(Number(when))
                  .replace('.', '')}
              </em>
            ) : null}
          </span>
        </>
      )}
    </div>
  );
}

/** Envolve um valor e o faz piscar (na cor do movimento) quando muda. */
export function Flash({ value, children }: { value: number; children: ReactNode }) {
  const prev = useRef(value);
  const [state, setState] = useState<{ d: '' | 'up' | 'down'; n: number }>({ d: '', n: 0 });
  useEffect(() => {
    if (value !== prev.current) {
      setState((s) => ({ d: value > prev.current ? 'up' : 'down', n: s.n + 1 }));
      prev.current = value;
    }
  }, [value]);
  return (
    <span key={state.n} className={`flash ${state.d}`}>
      {children}
    </span>
  );
}

/** Número que "conta" até o valor ao aparecer na tela. */
export function CountUp({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const [shown, ref] = useCountUp<HTMLSpanElement>(value);
  return (
    <span ref={ref} className={className}>
      {format(shown)}
    </span>
  );
}

export function Delta({ value, className = '' }: { value: number | null; className?: string }) {
  const d = dir(value);
  return (
    <span className={`delta ${d} ${className}`}>
      <i aria-hidden="true">{arrow(d)}</i>
      {pct(value)}
    </span>
  );
}

/** Faixa de cotações rolando no topo. Pausa ao passar o mouse. */
export function Ticker({ quotes }: { quotes: Quote[] }) {
  if (!quotes.length) return <div className="ticker" aria-hidden="true" />;
  const items = quotes.map((q) => (
    <span className="tick" key={q.symbol}>
      <b>{q.symbol}</b>
      <Flash value={q.value}>
        <span className="tick-v">{money(q.symbol, q.value)}</span>
      </Flash>
      <Delta value={q.pct} />
    </span>
  ));
  return (
    <div className="ticker" role="marquee" aria-label="Cotações">
      <div className="ticker-track">
        <div className="ticker-set">{items}</div>
        <div className="ticker-set" aria-hidden="true">{items}</div>
      </div>
    </div>
  );
}

export function SectionHead({
  id,
  n,
  title,
  env,
  now,
  children,
}: {
  id: string;
  n: string;
  title: string;
  env?: Envelope<unknown> | (Envelope<unknown> | undefined)[];
  now: number;
  children?: ReactNode;
}) {
  const list = (Array.isArray(env) ? env : [env]).filter(Boolean) as Envelope<unknown>[];
  const stale = list.some((e) => e.stale || (e.error && !e.data));
  const times = list.map((e) => e.updatedAt).filter((t): t is number => !!t);
  const oldest = times.length ? Math.min(...times) : null;
  return (
    <header className="sec-head">
      <span className="sec-n">{n}</span>
      <h2 id={`${id}-t`}>{title}</h2>
      <span className="sec-rule" />
      {children}
      <span className={`sec-meta ${stale ? 'warn' : ''}`}>
        {stale ? 'desatualizado' : oldest ? `atualizado ${ago(oldest, now)}` : 'carregando…'}
      </span>
    </header>
  );
}

export function Empty({ env, text = 'Sem dados no momento.' }: { env?: Envelope<unknown>; text?: string }) {
  return <p className="empty">{env?.error && !env.data ? 'Fonte indisponível agora. Tentando de novo em breve.' : text}</p>;
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skel" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <i key={i} style={{ width: `${70 + ((i * 13) % 30)}%` }} />
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="seg" role="group" aria-label={label} style={{ ['--n' as string]: options.length, ['--i' as string]: i }}>
      <span className="seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Ext({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  );
}

/** Imagem dentro de uma moldura (permite zoom no hover sem vazar). */
export function Img({ src, className = '' }: { src: string | null; className?: string }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return null;
  return (
    <span className={`media ${className}`}>
      <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setOk(false)} />
    </span>
  );
}

/**
 * Item de lista que expande ao clicar (ou Enter/Espaço), revelando `more` com animação.
 * Sem `more`, vira um item comum (só ganha os efeitos de hover).
 */
export function Item({
  children,
  more,
  className = '',
}: {
  children: ReactNode;
  more?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!more) {
    return (
      <li className="item">
        <div className={`item-hit static ${className}`}>{children}</div>
      </li>
    );
  }
  const toggle = () => setOpen((o) => !o);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };
  return (
    <li className={`item ${open ? 'open' : ''}`}>
      <div className={`item-hit ${className}`} role="button" tabIndex={0} aria-expanded={open} onClick={toggle} onKeyDown={onKey}>
        {children}
        <i className="plus" aria-hidden="true" />
      </div>
      <div className="item-more" inert={!open}>
        <div>
          <div className="more-body">{more}</div>
        </div>
      </div>
    </li>
  );
}

/** Abertura: a marca se desenha, a barra enche e a cortina sobe. Uma vez por sessão. */
export function Splash() {
  const [show, setShow] = useState(() => {
    if (prefersReduced()) return false;
    try {
      return !sessionStorage.getItem('impornews:splash');
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!show) {
      setReady();
      return;
    }
    const t1 = setTimeout(setReady, 1150);
    const t2 = setTimeout(() => {
      setShow(false);
      try { sessionStorage.setItem('impornews:splash', '1'); } catch { /* ok */ }
    }, 1750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [show]);

  if (!show) return null;
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-brand">
        <span>impor</span>
        <i>/</i>
        <span>news</span>
      </div>
      <div className="splash-bar" />
    </div>
  );
}

/** Fontes oficiais que ainda não estão conectadas: ficam cinza e não clicam. */
export function Soon({ items }: { items: { name: string; what: string }[] }) {
  return (
    <div className="soon">
      <h3 className="sub-head">Em breve <span>fontes ainda não conectadas</span></h3>
      <ul>
        {items.map((i) => (
          <li key={i.name} aria-disabled="true" title="Ainda não está conectada ao painel">
            <b>{i.name}</b>
            <span>{i.what}</span>
            <em>em breve</em>
          </li>
        ))}
      </ul>
    </div>
  );
}
